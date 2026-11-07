/**
 * BunkMatKar — Auth Adapter Interface (Phase 10)
 *
 * Defines the contract for authentication adapters (local/SQLite, Supabase, Firebase, etc.).
 */

import type { AuthCredentials, AuthResult, AuthSession, AuthStateChangeCallback } from './authTypes';

export interface IAuthAdapter {
  signUp(credentials: AuthCredentials): Promise<AuthResult>;
  signIn(credentials: AuthCredentials): Promise<AuthResult>;
  signInWithGoogle(idToken?: string, rawNonce?: string): Promise<AuthResult>;
  signInWithIdToken?(token: string, rawNonce?: string, provider?: 'google' | 'apple'): Promise<AuthResult>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<{ success: boolean; message: string }>;
  getCurrentSession(): Promise<AuthSession | null>;
  deleteAccount(userId: string): Promise<boolean>;
  onAuthStateChange(callback: AuthStateChangeCallback): () => void;
}
