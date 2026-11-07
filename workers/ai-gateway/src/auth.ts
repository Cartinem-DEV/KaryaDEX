// src/auth.ts — JWT verification using jose + Supabase JWKS

import { jwtVerify, JWTPayload, createRemoteJWKSet } from 'jose';
import type { Env } from './types';

// In-memory JWKS cache with 1-hour TTL
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksCacheTime = 0;
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

function getJWKS(env: Env) {
  const now = Date.now();
  if (!jwksCache || now - jwksCacheTime > JWKS_TTL_MS) {
    jwksCache = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));
    jwksCacheTime = now;
  }
  return jwksCache;
}

export interface VerifiedToken {
  userId: string;
  payload: JWTPayload;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'JWKS_ERROR' = 'INVALID_TOKEN',
    public readonly status: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function verifySupabaseJWT(authHeader: string | null, env: Env): Promise<VerifiedToken> {
  if (!authHeader) {
    throw new AuthError('Missing Authorization header', 'MISSING_TOKEN', 401);
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new AuthError('Invalid Authorization header format. Expected: Bearer <token>', 'INVALID_TOKEN', 401);
  }

  const token = parts[1];

  try {
    const JWKS = getJWKS(env);
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'supabase',
      audience: 'authenticated',
    });

    // Supabase JWT has `sub` as the user ID
    const userId = payload.sub as string;
    if (!userId) {
      throw new AuthError('Token missing subject (user ID)', 'INVALID_TOKEN', 401);
    }

    return { userId, payload };
  } catch (err: any) {
    // Check for specific jose errors
    if (err.code === 'ERR_JWT_EXPIRED') {
      throw new AuthError('Token has expired', 'EXPIRED_TOKEN', 401);
    }
    if (err.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' || err.code === 'ERR_JWT_INVALID') {
      throw new AuthError('Invalid token signature', 'INVALID_TOKEN', 401);
    }
    if (err instanceof AuthError) {
      throw err;
    }
    // JWKS fetch errors or other issues
    console.error('JWT verification error:', err);
    throw new AuthError('Token verification failed', 'JWKS_ERROR', 401);
  }
}

// For email endpoints - verify X-Email-API-Key header
export function verifyEmailApiKey(emailApiKeyHeader: string | null, env: Env): boolean {
  if (!emailApiKeyHeader) {
    return false;
  }
  // Constant-time comparison to prevent timing attacks
  const expected = env.EMAIL_API_KEY;
  if (emailApiKeyHeader.length !== expected.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= emailApiKeyHeader.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}