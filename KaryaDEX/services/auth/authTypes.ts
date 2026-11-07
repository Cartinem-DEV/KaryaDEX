/**
 * BunkMatKar — Authentication Types (Phase 10)
 *
 * Interfaces and types for user authentication, sessions, and credentials.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string; // ISO string
}

export interface AuthCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface AuthError {
  code:
    | 'invalid_credentials'
    | 'user_already_exists'
    | 'user_not_found'
    | 'weak_password'
    | 'invalid_email'
    | 'session_expired'
    | 'network_error'
    | 'rate_limited'
    | 'missing_client_id'
    | 'unknown';
  message: string;
}

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  user?: AuthUser;
  error?: AuthError;
}

export type AuthStateChangeCallback = (session: AuthSession | null) => void;
