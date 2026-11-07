/**
 * BunkMatKar — AI Response Cache Service (Phase 12)
 *
 * Scopes cached responses strictly by (userId + feature + versionKey).
 * Guarantees zero cross-tenant cache leakage and invalidation on data changes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AICacheRecord<T = any> {
  userId: string;
  feature: string;
  versionKey: string;
  data: T;
  cachedAt: string;
  expiresAt: string;
}

const CACHE_PREFIX = 'bunkmatkar_ai_cache_';

export class AICacheService {
  private inMemoryMap: Map<string, AICacheRecord> = new Map();

  private buildKey(userId: string, feature: string, versionKey: string): string {
    return `${CACHE_PREFIX}${userId}__${feature}__${versionKey}`;
  }

  /**
   * Retrieves cached response. Returns null if expired or not found.
   */
  async get<T>(userId: string, feature: string, versionKey: string): Promise<T | null> {
    if (!userId) return null;
    const fullKey = this.buildKey(userId, feature, versionKey);

    // 1. Check in-memory map
    const memoryRecord = this.inMemoryMap.get(fullKey);
    if (memoryRecord) {
      if (new Date(memoryRecord.expiresAt).getTime() < Date.now()) {
        this.inMemoryMap.delete(fullKey);
        return null;
      }
      return memoryRecord.data as T;
    }

    // 2. Check AsyncStorage
    try {
      const serialized = await AsyncStorage.getItem(fullKey);
      if (!serialized) return null;

      const record = JSON.parse(serialized) as AICacheRecord<T>;
      // Strict tenant check
      if (record.userId !== userId) {
        await AsyncStorage.removeItem(fullKey);
        return null;
      }

      if (new Date(record.expiresAt).getTime() < Date.now()) {
        await AsyncStorage.removeItem(fullKey);
        return null;
      }

      this.inMemoryMap.set(fullKey, record);
      return record.data;
    } catch {
      return null;
    }
  }

  /**
   * Stores response in cache with TTL (in seconds).
   */
  async set<T>(
    userId: string,
    feature: string,
    versionKey: string,
    data: T,
    ttlSeconds = 3600 // 1 hour default
  ): Promise<void> {
    if (!userId) return;
    const fullKey = this.buildKey(userId, feature, versionKey);
    const now = new Date();
    const expires = new Date(now.getTime() + ttlSeconds * 1000);

    const record: AICacheRecord<T> = {
      userId,
      feature,
      versionKey,
      data,
      cachedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };

    this.inMemoryMap.set(fullKey, record);

    try {
      await AsyncStorage.setItem(fullKey, JSON.stringify(record));
    } catch {
      // Graceful degraded persistence
    }
  }

  /**
   * Invalidates cache for a user feature.
   */
  async invalidateFeature(userId: string, feature: string): Promise<void> {
    const prefix = `${CACHE_PREFIX}${userId}__${feature}__`;
    
    // Clear in memory
    for (const key of this.inMemoryMap.keys()) {
      if (key.startsWith(prefix)) {
        this.inMemoryMap.delete(key);
      }
    }

    // Clear in persistent store
    try {
      const keys = await AsyncStorage.getAllKeys();
      const matchingKeys = keys.filter(k => k.startsWith(prefix));
      for (const k of matchingKeys) {
        await AsyncStorage.removeItem(k);
      }
    } catch {}
  }

  /**
   * Reset cache for testing.
   */
  async clearAllForTesting(): Promise<void> {
    this.inMemoryMap.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const aiKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      for (const k of aiKeys) {
        await AsyncStorage.removeItem(k);
      }
    } catch {}
  }
}

export const aiCacheService = new AICacheService();
