// src/quota.ts — Workers KV-based daily quota tracking

import type { Env } from './types';

export interface QuotaInfo {
  count: number;
  tokens: number;
  date: string; // YYYY-MM-DD
}

const QUOTA_KEY_PREFIX = 'quota:';

function getQuotaKey(userId: string, date: string): string {
  return `${QUOTA_KEY_PREFIX}${userId}:${date}`;
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export async function checkAndIncrementQuota(
  userId: string,
  env: Env,
  maxRequests: number,
  tokensToAdd: number = 0
): Promise<{ allowed: boolean; currentCount: number; remaining: number }> {
  const date = getTodayDate();
  const key = getQuotaKey(userId, date);

  try {
    const existing = await env.QUOTA_KV.get(key, { type: 'json' }) as QuotaInfo | null;
    const currentCount = existing?.count || 0;
    const currentTokens = existing?.tokens || 0;

    if (currentCount >= maxRequests) {
      return {
        allowed: false,
        currentCount,
        remaining: 0,
      };
    }

    const newCount = currentCount + 1;
    const newTokens = currentTokens + tokensToAdd;

    await env.QUOTA_KV.put(key, JSON.stringify({
      count: newCount,
      tokens: newTokens,
      date,
    }), {
      // Expire at end of day (24 hours from now, but we'll use a fixed TTL)
      // KV TTL is in seconds, so 86400 = 24 hours
      expirationTtl: 86400,
    });

    return {
      allowed: true,
      currentCount: newCount,
      remaining: maxRequests - newCount,
    };
  } catch (err) {
    console.error('Quota check/increment error:', err);
    // On KV error, allow request but log error (fail-open for availability)
    return {
      allowed: true,
      currentCount: 0,
      remaining: maxRequests,
    };
  }
}

export async function getQuotaStatus(userId: string, env: Env): Promise<QuotaInfo | null> {
  const date = getTodayDate();
  const key = getQuotaKey(userId, date);

  try {
    return await env.QUOTA_KV.get(key, { type: 'json' }) as QuotaInfo | null;
  } catch (err) {
    console.error('Quota status fetch error:', err);
    return null;
  }
}

export async function resetQuota(userId: string, env: Env): Promise<void> {
  const date = getTodayDate();
  const key = getQuotaKey(userId, date);

  try {
    await env.QUOTA_KV.delete(key);
  } catch (err) {
    console.error('Quota reset error:', err);
  }
}