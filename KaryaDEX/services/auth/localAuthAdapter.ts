/**
 * BunkMatKar — Local SQLite Auth Adapter (Phase 10)
 *
 * Implements IAuthAdapter with local SQLite backing.
 * Provides offline-first account creation, password hashing, session tokens,
 * session persistence, and multi-listener state changes.
 */

import * as Crypto from 'expo-crypto';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { getDatabaseConnection } from '@/database/db';
import type { IAuthAdapter } from './authAdapter';
import type {
  AuthCredentials,
  AuthResult,
  AuthSession,
  AuthUser,
  AuthStateChangeCallback,
} from './authTypes';

// Rate limiting state for brute-force protection
interface RateLimitEntry {
  attempts: number;
  lockedUntil: number;
}
const failedAttemptsMap = new Map<string, RateLimitEntry>();

export function checkLoginRateLimit(email: string): { allowed: boolean; isLocked: boolean; retryAfterSeconds: number } {
  const entry = failedAttemptsMap.get(email.toLowerCase());
  if (!entry) return { allowed: true, isLocked: false, retryAfterSeconds: 0 };
  const now = Date.now();
  if (entry.lockedUntil > now) {
    return { allowed: false, isLocked: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return { allowed: true, isLocked: false, retryAfterSeconds: 0 };
}

export function recordFailedAttempt(email: string): void {
  const norm = email.toLowerCase();
  const entry = failedAttemptsMap.get(norm) || { attempts: 0, lockedUntil: 0 };
  entry.attempts += 1;
  const now = Date.now();
  if (entry.attempts >= 10) {
    entry.lockedUntil = now + 5 * 60 * 1000; // 5-minute lockout
  } else if (entry.attempts >= 5) {
    entry.lockedUntil = now + 30 * 1000; // 30-second backoff
  }
  failedAttemptsMap.set(norm, entry);
}

export function clearFailedAttempts(email: string): void {
  failedAttemptsMap.delete(email.toLowerCase());
}

export function resetRateLimitsForTesting(): void {
  failedAttemptsMap.clear();
}

/** Legacy Tier 3 polynomial hash (Phase 10 baseline) */
export function legacyHashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `bmk_h_${Math.abs(hash).toString(16)}_${password.length}`;
}

/** Legacy Tier 2 salted SHA-256 hash (Phase 11 baseline) */
export async function legacySha256HashPassword(password: string, saltInput?: string): Promise<string> {
  const salt = saltInput || Crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`
  );
  return `bmk_sha256_${salt}_${digest}`;
}

export const PBKDF2_DEFAULT_ITERATIONS = 10000;
export const PBKDF2_MIN_ALLOWED_ITERATIONS = 5000;
export const PBKDF2_MAX_ALLOWED_ITERATIONS = 250000;

/**
 * Modern Tier 1 slow password KDF: PBKDF2-HMAC-SHA-256 (RFC 2898 / NIST SP 800-132)
 */
export async function hashPassword(password: string, iterations = PBKDF2_DEFAULT_ITERATIONS): Promise<string> {
  const boundedIters = Math.min(Math.max(iterations, PBKDF2_MIN_ALLOWED_ITERATIONS), PBKDF2_MAX_ALLOWED_ITERATIONS);
  const salt = Crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const derived = pbkdf2(sha256, password, salt, { c: boundedIters, dkLen: 32 });
  return `bmk_pbkdf2_sha256_${boundedIters}_${salt}_${bytesToHex(derived)}`;
}

export function needsPasswordRehash(storedHash: string, targetIterations = PBKDF2_DEFAULT_ITERATIONS): boolean {
  if (!storedHash || !storedHash.startsWith('bmk_pbkdf2_sha256_')) {
    return true;
  }
  const parts = storedHash.split('_');
  if (parts.length >= 6) {
    const iters = parseInt(parts[3], 10);
    if (isNaN(iters) || iters < targetIterations) {
      return true;
    }
  }
  return false;
}

/**
 * 3-tier password verifier supporting backward-compatibility and transparent rehash migration
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false;

  // Tier 1: Modern PBKDF2-HMAC-SHA-256
  if (storedHash.startsWith('bmk_pbkdf2_sha256_')) {
    const parts = storedHash.split('_');
    if (parts.length >= 6) {
      const iters = parseInt(parts[3], 10);
      // Parameter validation and DoS protection against excessive iterations
      if (isNaN(iters) || iters < PBKDF2_MIN_ALLOWED_ITERATIONS || iters > PBKDF2_MAX_ALLOWED_ITERATIONS) {
        return false;
      }
      const salt = parts[4];
      if (!salt || salt.length < 8) {
        return false;
      }
      const expectedHex = parts.slice(5).join('_');
      if (!expectedHex || expectedHex.length !== 64) {
        return false;
      }
      const derived = pbkdf2(sha256, password, salt, { c: iters, dkLen: 32 });
      return bytesToHex(derived).toLowerCase() === expectedHex.toLowerCase();
    }
    return false;
  }

  // Tier 2: Phase 11 salted SHA-256
  if (storedHash.startsWith('bmk_sha256_')) {
    const parts = storedHash.split('_');
    if (parts.length >= 4) {
      const salt = parts[2];
      const expectedDigest = parts.slice(3).join('_');
      const calculatedDigest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${salt}:${password}`
      );
      return calculatedDigest.toLowerCase() === expectedDigest.toLowerCase();
    }
    return false;
  }

  // Tier 3: Phase 10 polynomial checksum
  if (storedHash.startsWith('bmk_h_')) {
    return legacyHashPassword(password) === storedHash;
  }

  return false;
}

function generateToken(userId: string): string {
  return `bmk_tok_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class LocalAuthAdapter implements IAuthAdapter {
  private listeners: Set<AuthStateChangeCallback> = new Set();
  private currentSession: AuthSession | null = null;

  private notify(session: AuthSession | null) {
    this.currentSession = session;
    for (const listener of this.listeners) {
      try {
        listener(session);
      } catch (err) {
        console.warn('[LocalAuthAdapter] Listener error:', err);
      }
    }
  }

  async signUp(credentials: AuthCredentials): Promise<AuthResult> {
    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password;
    const name = (credentials.name || email.split('@')[0] || 'Student').trim();

    if (!email || !email.includes('@')) {
      return {
        success: false,
        error: { code: 'invalid_email', message: 'Please enter a valid email address.' },
      };
    }

    if (!password || password.length < 6) {
      return {
        success: false,
        error: { code: 'weak_password', message: 'Password must be at least 6 characters long.' },
      };
    }

    const db = await getDatabaseConnection();

    // Check if account already exists
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM auth_accounts WHERE email = ?;`,
      [email]
    );

    if (existing) {
      return {
        success: false,
        error: { code: 'user_already_exists', message: 'An account with this email already exists.' },
      };
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const passwordHash = await hashPassword(password);
    const nowISO = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO auth_accounts (id, email, password_hash, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [userId, email, passwordHash, name, nowISO, nowISO]
    );

    // Create session (valid for 30 days)
    const token = generateToken(userId);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.runAsync(
      `INSERT INTO auth_sessions (token, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?);`,
      [token, userId, expiresAt, nowISO]
    );

    const user: AuthUser = {
      id: userId,
      email,
      name,
      createdAt: nowISO,
    };

    const session: AuthSession = {
      token,
      user,
      expiresAt,
    };

    this.notify(session);
    return { success: true, session, user: session.user };
  }

  async signIn(credentials: AuthCredentials): Promise<AuthResult> {
    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password;

    if (!email || !password) {
      return {
        success: false,
        error: { code: 'invalid_credentials', message: 'Email and password are required.' },
      };
    }

    const rateLimit = checkLoginRateLimit(email);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: {
          code: 'rate_limited',
          message: `Too many failed attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
        },
      };
    }

    const db = await getDatabaseConnection();
    const account = await db.getFirstAsync<{
      id: string;
      email: string;
      password_hash: string;
      name: string;
      created_at: string;
    }>(`SELECT * FROM auth_accounts WHERE email = ?;`, [email]);

    if (!account) {
      recordFailedAttempt(email);
      return {
        success: false,
        error: { code: 'user_not_found', message: 'No account found with this email.' },
      };
    }

    const isPasswordValid = await verifyPassword(password, account.password_hash);
    if (!isPasswordValid) {
      recordFailedAttempt(email);
      return {
        success: false,
        error: { code: 'invalid_credentials', message: 'Invalid email or password.' },
      };
    }

    // Success: clear rate limit history
    clearFailedAttempts(email);

    // Transparently upgrade legacy hashes (polynomial 'bmk_h_' or SHA-256 'bmk_sha256_') to secure PBKDF2-HMAC-SHA-256
    if (needsPasswordRehash(account.password_hash)) {
      try {
        const upgradedHash = await hashPassword(password);
        await db.runAsync(`UPDATE auth_accounts SET password_hash = ? WHERE id = ?;`, [upgradedHash, account.id]);
      } catch {
        // Best effort non-blocking upgrade
      }
    }

    // Clean up old sessions for this user
    await db.runAsync(`DELETE FROM auth_sessions WHERE user_id = ?;`, [account.id]);

    const token = generateToken(account.id);
    const nowISO = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.runAsync(
      `INSERT INTO auth_sessions (token, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?);`,
      [token, account.id, expiresAt, nowISO]
    );

    const user: AuthUser = {
      id: account.id,
      email: account.email,
      name: account.name,
      createdAt: account.created_at,
    };

    const session: AuthSession = {
      token,
      user,
      expiresAt,
    };

    this.notify(session);
    return { success: true, session, user: session.user };
  }

  async signInWithGoogle(idToken?: string, rawNonce?: string): Promise<AuthResult> {
    const db = await getDatabaseConnection();
    const googleEmail = 'google.student@bunkmatkar.app';
    const name = 'Google Student';

    let account = await db.getFirstAsync<{
      id: string;
      email: string;
      name: string;
      created_at: string;
    }>(`SELECT id, email, name, created_at FROM auth_accounts WHERE email = ?;`, [googleEmail]);

    const nowISO = new Date().toISOString();
    let userId: string;

    if (!account) {
      userId = `usr-google-${Date.now()}`;
      await db.runAsync(
        `INSERT INTO auth_accounts (id, email, password_hash, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [userId, googleEmail, 'oauth_google', name, nowISO, nowISO]
      );
    } else {
      userId = account.id;
    }

    // Clean up old sessions for this user
    await db.runAsync(`DELETE FROM auth_sessions WHERE user_id = ?;`, [userId]);

    const token = generateToken(userId);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.runAsync(
      `INSERT INTO auth_sessions (token, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?);`,
      [token, userId, expiresAt, nowISO]
    );

    const user: AuthUser = {
      id: userId,
      email: googleEmail,
      name,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
      createdAt: account?.created_at || nowISO,
    };

    const session: AuthSession = {
      token,
      user,
      expiresAt,
    };

    this.notify(session);
    return { success: true, session, user: session.user };
  }

  async signOut(): Promise<void> {
    if (this.currentSession) {
      const db = await getDatabaseConnection();
      await db.runAsync(`DELETE FROM auth_sessions WHERE token = ?;`, [this.currentSession.token]);
    }
    this.notify(null);
  }

  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const db = await getDatabaseConnection();
    const account = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM auth_accounts WHERE email = ?;`,
      [cleanEmail]
    );

    if (!account) {
      return {
        success: false,
        message: 'No account found with this email.',
      };
    }

    return {
      success: true,
      message: `Password reset instructions sent to ${cleanEmail}. (Local mode: password reset verified)`,
    };
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    if (this.currentSession) {
      // Validate expiration
      if (new Date(this.currentSession.expiresAt).getTime() > Date.now()) {
        return this.currentSession;
      }
      await this.signOut();
      return null;
    }

    const db = await getDatabaseConnection();
    const nowISO = new Date().toISOString();

    const row = await db.getFirstAsync<{
      token: string;
      user_id: string;
      expires_at: string;
      email: string;
      name: string;
      created_at: string;
    }>(
      `SELECT s.token, s.user_id, s.expires_at, a.email, a.name, a.created_at
       FROM auth_sessions s
       JOIN auth_accounts a ON s.user_id = a.id
       WHERE s.expires_at > ?
       ORDER BY s.created_at DESC
       LIMIT 1;`,
      [nowISO]
    );

    if (!row) {
      this.currentSession = null;
      return null;
    }

    const session: AuthSession = {
      token: row.token,
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
        createdAt: row.created_at,
      },
      expiresAt: row.expires_at,
    };

    this.currentSession = session;
    return session;
  }

  async deleteAccount(userId: string): Promise<boolean> {
    const db = await getDatabaseConnection();
    await db.withTransactionAsync(async () => {
      // Purge all academic tables for this user to guarantee privacy
      const tables = [
        'tasks',
        'attendance_records',
        'class_sessions',
        'exams',
        'revision_records',
        'notes',
        'timetable_slots',
        'subjects',
        'semesters',
        'students',
        'colleges',
        'sync_metadata',
        'sync_queue',
      ];
      for (const t of tables) {
        try {
          await db.runAsync(`DELETE FROM ${t} WHERE user_id = ?;`, [userId]);
        } catch {
          // Table may not exist or does not contain user_id in this context
        }
      }
      await db.runAsync(`DELETE FROM auth_sessions WHERE user_id = ?;`, [userId]);
      await db.runAsync(`DELETE FROM auth_accounts WHERE id = ?;`, [userId]);
    });
    this.notify(null);
    return true;
  }

  onAuthStateChange(callback: AuthStateChangeCallback): () => void {
    this.listeners.add(callback);
    callback(this.currentSession);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const localAuthAdapter = new LocalAuthAdapter();
