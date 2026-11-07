// services/auth/authService.ts
/**
 * AuthService
 * Production-ready singleton managing student authentication,
 * session lifecycle, local account migration, and cross-layer state observers.
 */

import { AuthUser, AuthSession, AuthCredentials, AuthResult } from './authTypes';
import { IAuthAdapter } from './authAdapter';
import { localAuthAdapter } from './localAuthAdapter';
import { supabaseAuthAdapter } from './supabaseAuthAdapter';
import { isSupabaseConfigured } from '../supabase/supabaseConfig';
import { getDatabaseConnection } from '../../database/db';
import { useAppStore } from '../../store/useAppStore';
import { addBreadcrumb, captureException, setUserContext } from '@/services/monitoring/sentryService';

export class AuthService {
  private static instance: AuthService;
  private adapter: IAuthAdapter;
  private currentSession: AuthSession | null = null;
  private currentUser: AuthUser | null = null;
  private isInitialized = false;
  private listeners: ((user: AuthUser | null) => void)[] = [];

  private constructor(adapter?: IAuthAdapter) {
    if (adapter) {
      this.adapter = adapter;
    } else if (isSupabaseConfigured()) {
      this.adapter = supabaseAuthAdapter;
    } else {
      this.adapter = localAuthAdapter;
    }
  }

  public static getInstance(adapter?: IAuthAdapter): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(adapter);
    }
    return AuthService.instance;
  }

  /**
   * Reset instance for tests
   */
  public static resetInstance(): void {
    if (AuthService.instance) {
      AuthService.instance.currentSession = null;
      AuthService.instance.currentUser = null;
      AuthService.instance.isInitialized = false;
      AuthService.instance.listeners = [];
    }
    AuthService.instance = undefined as any;
  }

  /**
   * Initialize and restore session from storage
   */
  public async init(): Promise<AuthUser | null> {
    if (this.isInitialized) {
      return this.currentUser;
    }

    try {
      const session = await this.adapter.getCurrentSession();
      if (session) {
        this.currentSession = session;
        this.currentUser = session.user;
      } else {
        this.currentSession = null;
        this.currentUser = null;
      }
    } catch (error) {
      console.warn('[AuthService] Failed to restore session on boot:', error);
      this.currentSession = null;
      this.currentUser = null;
    }

    this.isInitialized = true;
    this.notifyListeners();
    return this.currentUser;
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public subscribe(listener: (user: AuthUser | null) => void): () => void {
    this.listeners.push(listener);
    // Send immediate initial value
    listener(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentUser);
      } catch (err) {
        console.error('[AuthService] Listener error:', err);
        captureException(err, { service: 'auth', operation: 'notifyListeners' });
      }
    }

    // Sentry: Update user context on auth state change
    if (this.currentUser) {
      setUserContext({
        id: this.currentUser.id,
        email: this.currentUser.email,
        name: this.currentUser.name,
      });
      addBreadcrumb({
        category: 'auth',
        message: `User signed in: ${this.currentUser.id}`,
        level: 'info',
        data: { userId: this.currentUser.id },
      });
    } else {
      setUserContext(null);
      addBreadcrumb({
        category: 'auth',
        message: 'User signed out',
        level: 'info',
      });
    }
  }

  /**
   * Sign Up new account
   */
  public async signUp(credentials: AuthCredentials): Promise<AuthResult> {
    const result = await this.adapter.signUp(credentials);
    if (result.success && result.session) {
      this.currentSession = result.session;
      this.currentUser = result.session.user;

      // Migrate existing local unauthenticated data if student is not in demo mode
      await this.migrateLocalDataToUser(result.session.user.id);

      this.notifyListeners();
    } else if (!result.success && result.error) {
      captureException(new Error(result.error.message || 'Sign up failed'), { operation: 'signUp' });
    }
    return result;
  }

  /**
   * Sign In existing account
   */
  public async signIn(credentials: AuthCredentials): Promise<AuthResult> {
    const result = await this.adapter.signIn(credentials);
    if (result.success && result.session) {
      this.currentSession = result.session;
      this.currentUser = result.session.user;

      // Migrate existing local unauthenticated data if student is not in demo mode
      await this.migrateLocalDataToUser(result.session.user.id);

      this.notifyListeners();
    } else if (!result.success && result.error) {
      captureException(new Error(result.error.message || 'Sign in failed'), { operation: 'signIn' });
    }
    return result;
  }

  /**
   * Sign In with Google (supports ID token exchange or direct OAuth)
   */
  public async signInWithGoogle(idToken?: string, rawNonce?: string): Promise<AuthResult> {
    const result = await this.adapter.signInWithGoogle(idToken, rawNonce);
    if (result.success && result.session) {
      this.currentSession = result.session;
      this.currentUser = result.session.user;

      // Migrate existing local unauthenticated data if student is not in demo mode
      await this.migrateLocalDataToUser(result.session.user.id);

      this.notifyListeners();
    }
    return result;
  }

  /**
   * Sign In with Google ID Token directly (Google Identity Services)
   */
  public async signInWithGoogleIdToken(idToken: string, rawNonce?: string): Promise<AuthResult> {
    return this.signInWithGoogle(idToken, rawNonce);
  }

  /**
   * Sign Out
   */
  public async signOut(): Promise<void> {
    await this.adapter.signOut();
    this.currentSession = null;
    this.currentUser = null;
    this.notifyListeners();
  }

  /**
   * Reset Password
   */
  public async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    return this.adapter.resetPassword(email);
  }

  /**
   * Delete Account
   */
  public async deleteAccount(): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      return { success: false, error: 'No active user session' };
    }
    const userId = this.currentUser.id;
    const success = await this.adapter.deleteAccount(userId);
    if (success) {
      try {
        const db = await getDatabaseConnection();
        const tables = [
          'students',
          'colleges',
          'semesters',
          'subjects',
          'tasks',
          'exams',
          'class_sessions',
          'attendance_records',
          'revision_records',
          'notes',
          'timetable_slots',
          'sync_metadata',
          'sync_queue',
        ];
        for (const tbl of tables) {
          try {
            await db.runAsync(`DELETE FROM ${tbl} WHERE user_id = ?;`, [userId]);
          } catch {
            // Ignore in environments where column/table might not be present
          }
        }
      } catch (e) {
        console.warn('[AuthService] Local cleanup error on deleteAccount:', e);
      }

      this.currentSession = null;
      this.currentUser = null;
      this.notifyListeners();
      return { success: true };
    }
    return { success: false, error: 'Failed to delete account' };
  }

  /**
   * Migrates local unassigned records (user_id IS NULL) to the newly authenticated user.
   * Isolates and ignores demo data so demo mock records are never migrated as real data.
   */
  public async migrateLocalDataToUser(userId: string): Promise<{ migratedCount: number }> {
    const isDemo = useAppStore.getState().isDemoMode;
    if (isDemo) {
      // Never migrate demo state into authenticated cloud user
      return { migratedCount: 0 };
    }

    try {
      const db = await getDatabaseConnection();
      let migratedCount = 0;

      const tables = [
        'students',
        'colleges',
        'semesters',
        'subjects',
        'tasks',
        'exams',
        'class_sessions',
        'attendance_records',
        'revision_records',
        'notes',
      ];

      for (const table of tables) {
        try {
          const res = await db.runAsync(
            `UPDATE ${table} SET user_id = ? WHERE user_id IS NULL;`,
            [userId]
          );
          migratedCount += res.changes || 0;
        } catch {
          // Table or column might not exist or be empty in some test setups
        }
      }

      return { migratedCount };
    } catch (e) {
      console.warn('[AuthService] migrateLocalDataToUser error:', e);
      return { migratedCount: 0 };
    }
  }
}

export const authService = AuthService.getInstance();
