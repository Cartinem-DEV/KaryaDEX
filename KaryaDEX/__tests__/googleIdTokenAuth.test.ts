/**
 * KaryaDEX — Google Identity Services & ID Token Authentication Tests
 *
 * Comprehensive verification of:
 * 1. Cryptographic raw nonce generation & SHA-256 hashing.
 * 2. Deterministic nonce pair generation matching SHA-256 hex digest.
 * 3. Client ID environment resolution (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).
 * 4. Missing Client ID handling and developer warning.
 * 5. SupabaseAuthAdapter.signInWithIdToken calling Supabase with provider='google', token, and rawNonce.
 * 6. Error handling when ID token validation fails.
 * 7. AuthService integration and session propagation.
 */

import {
  generateRawNonce,
  hashNonceSHA256,
  generateNoncePair,
  getGoogleWebClientId,
} from '@/services/auth/googleAuthHelper';
import { SupabaseAuthAdapter } from '@/services/auth/supabaseAuthAdapter';
import { AuthService } from '@/services/auth/authService';

// Mock React Native Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Mock Supabase Client
const mockSignInWithIdToken = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/services/supabase/supabaseConfig', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  getSupabaseConfig: jest.fn(() => ({
    url: 'https://qimdcbseltdvxdzmdzwb.supabase.co',
    publishableKey: 'sb_test_publishable_key',
  })),
}));

jest.mock('@/services/supabase/supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  getSupabaseClient: jest.fn(() => ({
    auth: {
      signInWithIdToken: mockSignInWithIdToken,
      signInWithOAuth: mockSignInWithOAuth,
      getSession: mockGetSession,
    },
  })),
}));

describe('Google Identity Services (Option 2) — ID Token & Cryptographic Nonce Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. Cryptographic Nonce Generation', () => {
    it('generates a 32-character raw nonce string by default', () => {
      const rawNonce = generateRawNonce();
      expect(typeof rawNonce).toBe('string');
      expect(rawNonce.length).toBe(32);
    });

    it('generates nonces with high entropy (unique on each call)', () => {
      const n1 = generateRawNonce();
      const n2 = generateRawNonce();
      expect(n1).not.toBe(n2);
    });

    it('computes a 64-character hexadecimal SHA-256 digest', async () => {
      const rawNonce = 'test-nonce-12345';
      const hash = await hashNonceSHA256(rawNonce);
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    it('produces known SHA-256 hash for fixed input', async () => {
      // Echoes: sha256("test-nonce-123") = 7a9c2b4a6171f03ed9f403889969421080fe4cc08f1b774eed9ee58e6a5b572b
      const hash = await hashNonceSHA256('test-nonce-123');
      expect(hash).toBe('7a9c2b4a6171f03ed9f403889969421080fe4cc08f1b774eed9ee58e6a5b572b');
    });

    it('generates a valid matching raw/hashed pair via generateNoncePair', async () => {
      const pair = await generateNoncePair();
      expect(pair.rawNonce).toBeDefined();
      expect(pair.hashedNonce).toBeDefined();
      const verifyHash = await hashNonceSHA256(pair.rawNonce);
      expect(pair.hashedNonce).toBe(verifyHash);
    });
  });

  describe('2. Google Web Client ID Configuration', () => {
    it('reads EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID from environment', () => {
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '240868567707-mock.apps.googleusercontent.com';
      expect(getGoogleWebClientId()).toBe('240868567707-mock.apps.googleusercontent.com');
    });

    it('falls back to EXPO_PUBLIC_GOOGLE_CLIENT_ID if web client id is absent', () => {
      delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'fallback-client-id.apps.googleusercontent.com';
      expect(getGoogleWebClientId()).toBe('fallback-client-id.apps.googleusercontent.com');
    });

    it('returns empty string if neither environment variable is configured', () => {
      delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      expect(getGoogleWebClientId()).toBe('');
    });
  });

  describe('3. SupabaseAuthAdapter.signInWithIdToken Flow', () => {
    it('calls supabase.auth.signInWithIdToken with provider=google, idToken, and rawNonce', async () => {
      const mockUser = {
        id: 'usr_g_456',
        email: 'rahul.sharma@college.edu',
        user_metadata: { name: 'Rahul Sharma' },
        created_at: new Date().toISOString(),
      };
      const mockSession = {
        access_token: 'valid_jwt_idtoken_token',
        user: mockUser,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockSignInWithIdToken.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const adapter = SupabaseAuthAdapter.getInstance();
      const rawNonce = 'raw_random_nonce_abc123';
      const fakeGoogleIdToken = 'eyJhbGciOiJSUzI1NiJ9.payload.sig';

      const res = await adapter.signInWithIdToken(fakeGoogleIdToken, rawNonce, 'google');

      expect(mockSignInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: fakeGoogleIdToken,
        nonce: rawNonce,
      });

      expect(res.success).toBe(true);
      expect(res.user?.email).toBe('rahul.sharma@college.edu');
      expect(res.session?.token).toBe('valid_jwt_idtoken_token');
    });

    it('returns error when Supabase rejects the ID token', async () => {
      mockSignInWithIdToken.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'ID token has expired or is invalid' },
      });

      const adapter = SupabaseAuthAdapter.getInstance();
      const res = await adapter.signInWithIdToken('expired_token', 'nonce_123');

      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('ID token has expired');
    });

    it('logs developer warning and gracefully falls back to OAuth when web client id is not configured and called without token', async () => {
      delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { provider: 'google', url: 'https://qimdcbseltdvxdzmdzwb.supabase.co/auth/v1/authorize?provider=google' },
        error: null,
      });
      mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const adapter = SupabaseAuthAdapter.getInstance();
      const res = await adapter.signInWithGoogle();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not configured in .env')
      );
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google' }));
      expect(res.success).toBe(true);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('4. AuthService.signInWithGoogleIdToken Integration', () => {
    it('authenticates user and propagates session through AuthService', async () => {
      const mockUser = {
        id: 'usr_g_789',
        email: 'ananya.roy@college.edu',
        user_metadata: { name: 'Ananya Roy' },
        created_at: new Date().toISOString(),
      };
      const mockSession = {
        access_token: 'auth_service_id_tok_token',
        user: mockUser,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockSignInWithIdToken.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Point AuthService to SupabaseAuthAdapter
      AuthService.resetInstance();
      const auth = AuthService.getInstance(SupabaseAuthAdapter.getInstance());

      const res = await auth.signInWithGoogleIdToken('sample_token', 'sample_nonce');

      expect(res.success).toBe(true);
      expect(res.user?.email).toBe('ananya.roy@college.edu');
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.getCurrentUser()?.email).toBe('ananya.roy@college.edu');
    });
  });
});
