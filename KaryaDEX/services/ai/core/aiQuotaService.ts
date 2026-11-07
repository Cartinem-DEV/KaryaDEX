/**
 * BunkMatKar — AI Quota & Abuse Control Service (Phase 12)
 *
 * Implements configurable per-user rate limits and daily caps.
 * Protects against runaway costs (denial-of-wallet) while remaining
 * easily upgradeable to Pro or BYOK tiers.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatLocalDate } from '@/lib/timeUtils';
import type { AIQuotaTier, AIQuotaUsage } from './aiTypes';
import { AIQuotaExceededError } from './aiTypes';

const QUOTA_STORAGE_PREFIX = 'bunkmatkar_ai_quota_';

export const DEFAULT_FREE_TIER: AIQuotaTier = {
  name: 'free',
  maxDailyRequests: 50,
  maxTokensPerRequest: 4096,
  allowsMultimodal: true,
};

export class AIQuotaService {
  private tier: AIQuotaTier = DEFAULT_FREE_TIER;
  private inMemoryCache: Map<string, AIQuotaUsage> = new Map();

  constructor(tier?: AIQuotaTier) {
    if (tier) this.tier = tier;
  }

  setTier(tier: AIQuotaTier): void {
    this.tier = tier;
  }

  getTier(): AIQuotaTier {
    return { ...this.tier };
  }

  private getKey(userId: string, date: string): string {
    return `${QUOTA_STORAGE_PREFIX}${userId}_${date}`;
  }

  /**
   * Retrieves usage for a given user on today's local date.
   */
  async getDailyUsage(userId: string, date = formatLocalDate()): Promise<AIQuotaUsage> {
    const memoryKey = `${userId}_${date}`;
    const cached = this.inMemoryCache.get(memoryKey);
    if (cached) return cached;

    try {
      const stored = await AsyncStorage.getItem(this.getKey(userId, date));
      if (stored) {
        const parsed = JSON.parse(stored) as AIQuotaUsage;
        this.inMemoryCache.set(memoryKey, parsed);
        return parsed;
      }
    } catch {
      // In-memory fallback
    }

    const defaultUsage: AIQuotaUsage = {
      userId,
      date,
      requestCount: 0,
      estimatedTokens: 0,
      lastRequestTime: new Date().toISOString(),
    };
    this.inMemoryCache.set(memoryKey, defaultUsage);
    return defaultUsage;
  }

  /**
   * Checks if user has exceeded their daily limit before making a request.
   * Throws AIQuotaExceededError if limit reached.
   */
  async checkQuota(userId: string, requiresMultimodal = false): Promise<void> {
    if (this.tier.name === 'byok') {
      // BYOK users bypass application quota since they pay directly
      return;
    }

    if (requiresMultimodal && !this.tier.allowsMultimodal) {
      throw new AIQuotaExceededError('Multimodal document analysis is not permitted on this tier.');
    }

    const usage = await this.getDailyUsage(userId);
    if (usage.requestCount >= this.tier.maxDailyRequests) {
      throw new AIQuotaExceededError(
        `Daily AI limit of ${this.tier.maxDailyRequests} requests reached for today. Resets tomorrow.`
      );
    }
  }

  /**
   * Records usage after a completed AI request.
   */
  async recordUsage(userId: string, estimatedTokens = 500): Promise<AIQuotaUsage> {
    const today = formatLocalDate();
    const current = await this.getDailyUsage(userId, today);

    const updated: AIQuotaUsage = {
      ...current,
      requestCount: current.requestCount + 1,
      estimatedTokens: current.estimatedTokens + estimatedTokens,
      lastRequestTime: new Date().toISOString(),
    };

    const memoryKey = `${userId}_${today}`;
    this.inMemoryCache.set(memoryKey, updated);

    try {
      await AsyncStorage.setItem(this.getKey(userId, today), JSON.stringify(updated));
    } catch {
      // Graceful degraded persistence
    }

    return updated;
  }

  /**
   * Clears quota for testing.
   */
  async resetForTesting(userId: string, date = formatLocalDate()): Promise<void> {
    const memoryKey = `${userId}_${date}`;
    this.inMemoryCache.delete(memoryKey);
    try {
      await AsyncStorage.removeItem(this.getKey(userId, date));
    } catch {}
  }
}

export const aiQuotaService = new AIQuotaService();
