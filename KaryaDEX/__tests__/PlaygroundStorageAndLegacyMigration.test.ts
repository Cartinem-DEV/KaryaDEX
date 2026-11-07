/**
 * KaryaDEX — Playground Storage & Legacy Migration Test Suite (PG-3A)
 *
 * Validates:
 * - Detection and handling of legacy unpartitioned storage key (`bunkmatkar_playground_storage`)
 * - Identification of fabricated default mock data vs genuine legacy progress
 * - Atomic two-phase migration into guest partition with backup preservation
 * - Migration journal logging and idempotency
 * - Robust recovery and backup quarantine for corrupted JSON data
 * - Storage key safety (no PII, no unpartitioned global keys)
 */

const storageMap = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, value: string) => {
    storageMap.set(key, value);
  }),
  getItem: jest.fn(async (key: string) => {
    return storageMap.has(key) ? storageMap.get(key)! : null;
  }),
  removeItem: jest.fn(async (key: string) => {
    storageMap.delete(key);
  }),
  clear: jest.fn(async () => {
    storageMap.clear();
  }),
  getAllKeys: jest.fn(async () => Array.from(storageMap.keys())),
}));

import {
  getStorageKeyForScope,
  loadPlaygroundProfile,
  savePlaygroundProfile,
  migrateLegacyToGuestIfAppropriate,
  computeProfileFingerprint,
  getMigrationJournal,
} from '../lib/playground/identity/playgroundStorage';
import type { PlayerScope, MatchRecord } from '../types/playground';

describe('PG-3A: Storage Architecture & Legacy Migration', () => {
  beforeEach(() => {
    storageMap.clear();
    jest.clearAllMocks();
  });

  describe('Storage Key Validation', () => {
    it('enforces secure partition keys and prohibits PII in storage paths', () => {
      const guestScope: PlayerScope = { type: 'guest' };
      const authScope: PlayerScope = { type: 'authenticated', userId: 'usr-987-abc' };

      const guestKey = getStorageKeyForScope(guestScope);
      const authKey = getStorageKeyForScope(authScope);

      expect(guestKey).toBe('karyadex_playground_v2:guest');
      expect(authKey).toBe('karyadex_playground_v2:user:usr-987-abc');

      // Assert keys do not contain legacy name 'bunkmatkar'
      expect(guestKey).not.toContain('bunkmatkar');
      expect(authKey).not.toContain('bunkmatkar');
    });
  });

  describe('Legacy Migration & Fabricated Mock Detection', () => {
    it('detects fabricated default mock data and ignores it (does not migrate false progress)', async () => {
      // Simulate Zustand persist wrapper storing the fabricated mock
      const fabricatedMock = {
        state: {
          totalMatches: 8,
          brainXp: 350,
          currentStreak: 3,
          currentLevel: 1,
          totalWins: 5,
          ratings: { sprint_duel: 1000, queens: 1000, tango: 1000, mindsnap: 1000 },
          recentMatches: [], // 0 actual match records proves it was mock
        },
        version: 0,
      };

      storageMap.set('bunkmatkar_playground_storage', JSON.stringify(fabricatedMock));

      const migrationResult = await migrateLegacyToGuestIfAppropriate();

      // Migration must skip fabricated data
      expect(migrationResult.migrated).toBe(false);
      expect(migrationResult.reason.toLowerCase()).toContain('fabricated');

      // Guest profile must NOT have the 8 matches or 350 XP
      const guestProfile = await loadPlaygroundProfile({ type: 'guest' });
      expect(guestProfile.totalMatches).toBe(0);
      expect(guestProfile.brainXp).toBe(0);
    });

    it('migrates genuine legacy progress into guest partition and preserves backup', async () => {
      const realMatch: MatchRecord = {
        id: 'legacy-real-1',
        gameType: 'tango',
        gameTitle: 'Tango',
        result: 'won',
        isWin: true,
        score: 10,
        durationSeconds: 90,
        xpEarned: 120,
        ratingDelta: 15,
        ratingChange: 15,
        date: new Date(1690000000000).toISOString(),
        timestamp: 1690000000000,
        isPractice: false,
      };

      const genuineLegacy = {
        state: {
          totalMatches: 3,
          brainXp: 360,
          currentStreak: 2,
          currentLevel: 1,
          totalWins: 2,
          ratings: { sprint_duel: 1000, queens: 1000, tango: 1045, mindsnap: 1000 },
          recentMatches: [realMatch],
        },
        version: 0,
      };

      storageMap.set('bunkmatkar_playground_storage', JSON.stringify(genuineLegacy));

      const migrationResult = await migrateLegacyToGuestIfAppropriate();
      expect(migrationResult.migrated).toBe(true);

      // Guest profile must now contain genuine progress
      const guestProfile = await loadPlaygroundProfile({ type: 'guest' });
      expect(guestProfile.totalMatches).toBe(3);
      expect(guestProfile.brainXp).toBe(360);
      expect(guestProfile.recentMatches).toHaveLength(1);
      expect(guestProfile.recentMatches[0].id).toBe('legacy-real-1');

      // Backup of legacy data is retained
      expect(storageMap.has('karyadex_playground_v2:legacy_backup')).toBe(true);

      // Migration journal entry is written
      const journal = await getMigrationJournal();
      expect(journal.length).toBeGreaterThan(0);
      expect(journal[0].sourceKey).toBe('bunkmatkar_playground_storage');
      expect(journal[0].migratedMatchesCount).toBe(3);
    });

    it('is idempotent: running migration twice does not re-migrate or corrupt data', async () => {
      const genuineLegacy = {
        state: {
          totalMatches: 1,
          brainXp: 100,
          currentStreak: 1,
          currentLevel: 1,
          totalWins: 1,
          ratings: { sprint_duel: 1010, queens: 1000, tango: 1000, mindsnap: 1000 },
          recentMatches: [{
            id: 'match-1',
            gameType: 'sprint_duel',
            gameTitle: 'Sprint Duel',
            result: 'won',
            score: 10,
            xpEarned: 100,
            timestamp: Date.now(),
            ratingChange: 10,
            isPractice: false,
          }],
        },
      };

      storageMap.set('bunkmatkar_playground_storage', JSON.stringify(genuineLegacy));

      // First run
      const result1 = await migrateLegacyToGuestIfAppropriate();
      expect(result1.migrated).toBe(true);

      // Second run
      const result2 = await migrateLegacyToGuestIfAppropriate();
      expect(result2.migrated).toBe(false);
      expect(result2.reason).toContain('already');

      // Guest profile matches remained 1
      const guestProfile = await loadPlaygroundProfile({ type: 'guest' });
      expect(guestProfile.totalMatches).toBe(1);
    });
  });

  describe('Corrupt JSON Handling & Safety Quarantine', () => {
    it('quarantines corrupt JSON string to backup key and returns safe default profile', async () => {
      const userScope: PlayerScope = { type: 'authenticated', userId: 'user-corrupt' };
      const storageKey = getStorageKeyForScope(userScope);

      // Write corrupt / invalid JSON data
      storageMap.set(storageKey, '{{INVALID_JSON_CORRUPTED_BYTES}}!!');

      const profile = await loadPlaygroundProfile(userScope);

      // Must return a valid default profile with 0 matches instead of throwing
      expect(profile).toBeDefined();
      expect(profile.totalMatches).toBe(0);
      expect(profile.brainXp).toBe(0);
      expect(profile.ratings?.sprint_duel).toBe(1000);

      // Storage map should have preserved the corrupted data in a quarantine key
      const quarantineKey = Array.from(storageMap.keys()).find((k) =>
        k.startsWith(`${storageKey}.corrupted.`)
      );
      expect(quarantineKey).toBeDefined();
      expect(storageMap.get(quarantineKey!)).toBe('{{INVALID_JSON_CORRUPTED_BYTES}}!!');
    });

    it('safely backs up ambiguous legacy profile matching mock heuristic into quarantine without data loss', async () => {
      // Coincidental mock signature: totalMatches=8, brainXp=350, escapeStreak=3, no recentMatches
      const ambiguousProfile = {
        state: {
          totalMatches: 8,
          brainXp: 350,
          currentStreak: 3,
          escapeStreak: 3,
          currentLevel: 1,
          totalWins: 4,
          ratings: { sprint_duel: 1000, queens: 1000, tango: 1000, mindsnap: 1000 },
          recentMatches: [],
        },
        version: 0,
      };

      storageMap.set('bunkmatkar_playground_storage', JSON.stringify(ambiguousProfile));

      const result = await migrateLegacyToGuestIfAppropriate();

      // Skipped from guest partition
      expect(result.migrated).toBe(false);
      expect(result.reason).toBe('legacy_data_is_fabricated_mock');

      // But raw legacy backup MUST be preserved
      expect(storageMap.has('karyadex_playground_v2:legacy_backup')).toBe(true);
      // And ambiguous quarantine must be preserved for manual recovery/review
      expect(storageMap.has('karyadex_playground_v2:legacy_ambiguous_quarantine')).toBe(true);

      // Repeated startup does not destroy the original backup or quarantine
      const result2 = await migrateLegacyToGuestIfAppropriate();
      expect(result2.migrated).toBe(false);
      expect(storageMap.has('karyadex_playground_v2:legacy_backup')).toBe(true);
      expect(storageMap.has('karyadex_playground_v2:legacy_ambiguous_quarantine')).toBe(true);
    });
  });

  describe('Profile Fingerprinting', () => {
    it('generates consistent fingerprints and detects modifications across multiple fields', () => {
      const baseProfile = {
        brainXp: 100,
        brainRating: 1200,
        currentLevel: 1,
        currentStreak: 1,
        escapeStreak: 1,
        totalMatches: 2,
        totalWins: 1,
        totalTimeMinutes: 10,
        highScores: { sprint_duel: 50, queens: 40, tango: 30, mind_snap: 20 },
        ratings: { sprint_duel: 1000, queens: 1000, tango: 1000, mindsnap: 1000 },
        dailyQuests: [],
        recentMatches: [{ id: 'm1' }],
      };

      const fpBase1 = computeProfileFingerprint(baseProfile);
      const fpBase2 = computeProfileFingerprint(baseProfile);
      // Deterministic output
      expect(fpBase1).toBe(fpBase2);

      // Verify each critical field meaningfully changes the fingerprint:
      expect(computeProfileFingerprint({ ...baseProfile, brainXp: 150 })).not.toBe(fpBase1);
      expect(computeProfileFingerprint({ ...baseProfile, brainRating: 1250 })).not.toBe(fpBase1);
      expect(computeProfileFingerprint({ ...baseProfile, escapeStreak: 5 })).not.toBe(fpBase1);
      expect(computeProfileFingerprint({ ...baseProfile, totalMatches: 3 })).not.toBe(fpBase1);
      expect(computeProfileFingerprint({ ...baseProfile, totalTimeMinutes: 15 })).not.toBe(fpBase1);
      expect(computeProfileFingerprint({
        ...baseProfile,
        highScores: { ...baseProfile.highScores, sprint_duel: 99 },
      })).not.toBe(fpBase1);
      expect(computeProfileFingerprint({
        ...baseProfile,
        ratings: { ...baseProfile.ratings, sprint_duel: 1080 },
      })).not.toBe(fpBase1);
      expect(computeProfileFingerprint({
        ...baseProfile,
        recentMatches: [{ id: 'm1' }, { id: 'm2' }],
      })).not.toBe(fpBase1);
    });
  });
});
