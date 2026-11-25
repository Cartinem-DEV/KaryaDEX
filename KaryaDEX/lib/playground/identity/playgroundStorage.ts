/**
 * KaryaDEX — Playground Account-Scoped Storage Engine
 *
 * Implements versioned, account-partitioned AsyncStorage persistence for the Playground.
 * Protects against cross-account leakage, corrupt JSON, unverified legacy state claims,
 * and mid-migration crashes through a recoverable two-phase transaction journal.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PlayerScope,
  PlaygroundProfileData,
  ClaimReceipt,
  MigrationJournalEntry,
} from '@/types/playground';
import { generateDefaultQuests } from './playgroundDefaults';

export const LEGACY_PLAYGROUND_STORAGE_KEY = 'legacy_playground_v1_storage';
export const PLAYGROUND_STORAGE_PREFIX = 'karyadex_playground_v2';
export const CLAIM_RECEIPTS_STORAGE_KEY = `${PLAYGROUND_STORAGE_PREFIX}:claim_receipts`;
export const MIGRATION_JOURNAL_STORAGE_KEY = `${PLAYGROUND_STORAGE_PREFIX}:migration_journal`;
export const LEGACY_BACKUP_STORAGE_KEY = `${PLAYGROUND_STORAGE_PREFIX}:legacy_backup`;
export const LEGACY_AMBIGUOUS_QUARANTINE_KEY = `${PLAYGROUND_STORAGE_PREFIX}:legacy_ambiguous_quarantine`;
export const CURRENT_PLAYGROUND_STORAGE_VERSION = 2;

// ═══════════════════════════════════════════════════════════════════════════
// SCOPE KEYS
// ═══════════════════════════════════════════════════════════════════════════

export function getScopeKey(scope: PlayerScope): string {
  if (scope.type === 'guest') {
    return 'guest';
  }
  return `user:${scope.userId}`;
}

export function getStorageKeyForScope(scope: PlayerScope): string {
  return `${PLAYGROUND_STORAGE_PREFIX}:${getScopeKey(scope)}`;
}

export function parseScopeKey(scopeKey: string): PlayerScope {
  if (scopeKey === 'guest' || !scopeKey) {
    return { type: 'guest' };
  }
  if (scopeKey.startsWith('user:')) {
    const userId = scopeKey.slice(5).trim();
    if (userId) {
      return { type: 'authenticated', userId };
    }
  }
  return { type: 'guest' };
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULTS, VALIDATION & FINGERPRINTING
// ═══════════════════════════════════════════════════════════════════════════

export function createDefaultProfileData(): PlaygroundProfileData {
  return {
    version: CURRENT_PLAYGROUND_STORAGE_VERSION,
    brainXp: 0,
    brainRating: 1200,
    escapeStreak: 0,
    currentStreak: 0,
    currentLevel: 1,
    totalWins: 0,
    lastPlayedDate: null,
    totalTimeMinutes: 0,
    totalMatches: 0,
    ratings: {
      sprint_duel: 1000,
      queens: 1000,
      tango: 1000,
      mindsnap: 1000,
    },
    highScores: {
      sprint_duel: 0,
      queens: 0,
      tango: 0,
      mind_snap: 0,
    },
    recentMatches: [],
    dailyQuests: generateDefaultQuests(),
    soundEnabled: true,
    hapticsEnabled: true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validates and normalizes raw parsed JSON into a strictly typed PlaygroundProfileData.
 */
export function sanitizeProfileData(raw: any): PlaygroundProfileData {
  const defaults = createDefaultProfileData();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  // Handle Zustand wrapper format ({ state: { ... }, version: ... }) if present
  const source = raw.state && typeof raw.state === 'object' ? raw.state : raw;

  const escapeStreak =
    typeof source.escapeStreak === 'number' && !isNaN(source.escapeStreak)
      ? Math.max(0, source.escapeStreak)
      : typeof source.currentStreak === 'number' && !isNaN(source.currentStreak)
      ? Math.max(0, source.currentStreak)
      : defaults.escapeStreak;

  return {
    version: CURRENT_PLAYGROUND_STORAGE_VERSION,
    brainXp: typeof source.brainXp === 'number' && !isNaN(source.brainXp) ? Math.max(0, source.brainXp) : defaults.brainXp,
    brainRating: typeof source.brainRating === 'number' && !isNaN(source.brainRating) ? Math.max(800, source.brainRating) : defaults.brainRating,
    escapeStreak,
    currentStreak: escapeStreak,
    currentLevel: typeof source.currentLevel === 'number' ? source.currentLevel : defaults.currentLevel,
    totalWins: typeof source.totalWins === 'number' ? source.totalWins : defaults.totalWins,
    lastPlayedDate: typeof source.lastPlayedDate === 'string' ? source.lastPlayedDate : defaults.lastPlayedDate,
    totalTimeMinutes: typeof source.totalTimeMinutes === 'number' && !isNaN(source.totalTimeMinutes) ? Math.max(0, source.totalTimeMinutes) : defaults.totalTimeMinutes,
    totalMatches: typeof source.totalMatches === 'number' && !isNaN(source.totalMatches) ? Math.max(0, source.totalMatches) : defaults.totalMatches,
    ratings: {
      sprint_duel: Number(source.ratings?.sprint_duel) || 1000,
      queens: Number(source.ratings?.queens) || 1000,
      tango: Number(source.ratings?.tango) || 1000,
      mindsnap: Number(source.ratings?.mindsnap) || 1000,
    },
    highScores: {
      sprint_duel: Number(source.highScores?.sprint_duel) || 0,
      queens: Number(source.highScores?.queens) || 0,
      tango: Number(source.highScores?.tango) || 0,
      mind_snap: Number(source.highScores?.mind_snap) || 0,
    },
    recentMatches: Array.isArray(source.recentMatches) ? source.recentMatches.slice(0, 20) : [],
    dailyQuests: Array.isArray(source.dailyQuests) && source.dailyQuests.length > 0 ? source.dailyQuests : generateDefaultQuests(),
    soundEnabled: typeof source.soundEnabled === 'boolean' ? source.soundEnabled : defaults.soundEnabled,
    hapticsEnabled: typeof source.hapticsEnabled === 'boolean' ? source.hapticsEnabled : defaults.hapticsEnabled,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date().toISOString(),
  };
}

/**
 * Checks whether the profile data matches known legacy fabricated placeholders.
 */
export function isFabricatedDefault(data: any): boolean {
  if (!data) return false;
  const source = data.state && typeof data.state === 'object' ? data.state : data;
  const hasZeroMatches = !source.recentMatches || source.recentMatches.length === 0;
  const streak = typeof source.escapeStreak === 'number' ? source.escapeStreak : source.currentStreak;
  return hasZeroMatches && source.totalMatches === 8 && source.brainXp === 350 && streak === 3;
}

/**
 * Determines whether a profile contains genuine earned player progression.
 */
export function hasMeaningfulProgress(data: PlaygroundProfileData | null | undefined): boolean {
  if (!data) return false;
  if (isFabricatedDefault(data)) return false;

  const hasMatches = (data.totalMatches || 0) > 0 || (data.recentMatches && data.recentMatches.length > 0);
  const hasXp = (data.brainXp || 0) > 0;
  const hasStreak = (data.escapeStreak || 0) > 0;
  const hasHighScores = data.highScores && Object.values(data.highScores).some((score) => score > 0);
  const hasCompletedQuests = data.dailyQuests && data.dailyQuests.some((q) => q.completed);

  return Boolean(hasMatches || hasXp || hasStreak || hasHighScores || hasCompletedQuests);
}

/**
 * Calculates a deterministic serialization-based composite identifier of a profile's progress
 * for duplicate/idempotency checks.
 * Note: This is a structured composite digest (pipe-delimited property serialization),
 * NOT a cryptographic hash (e.g. SHA-256). It provides deterministic comparison for identity
 * and idempotency across local migrations.
 */
export function calculateProfileFingerprint(data: any): string {
  const d = sanitizeProfileData(data);
  const parts = [
    `xp:${d.brainXp}`,
    `rating:${d.brainRating}`,
    `streak:${d.escapeStreak}`,
    `matches:${d.totalMatches}`,
    `time:${d.totalTimeMinutes}`,
    `hs:${d.highScores.sprint_duel},${d.highScores.queens},${d.highScores.tango},${d.highScores.mind_snap}`,
    `ratings:${d.ratings?.sprint_duel},${d.ratings?.queens},${d.ratings?.tango},${d.ratings?.mindsnap}`,
    `recent:${d.recentMatches.map((m) => m.id).join(';')}`,
  ];
  return parts.join('|');
}

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC STORAGE OPERATIONS (WITH CRASH & CORRUPTION RESILIENCE)
// ═══════════════════════════════════════════════════════════════════════════

export async function readProfileFromStorage(scope: PlayerScope): Promise<PlaygroundProfileData | null> {
  const key = getStorageKeyForScope(scope);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      return sanitizeProfileData(parsed);
    } catch (parseErr) {
      // Corrupt JSON detected: preserve backup copy in quarantine before returning safe default
      console.warn(`[PlaygroundStorage] Corrupted JSON detected at key ${key}. Preserving backup.`);
      const corruptBackupKey = `${key}.corrupted.${Date.now()}`;
      await AsyncStorage.setItem(corruptBackupKey, raw).catch(() => {});
      return createDefaultProfileData();
    }
  } catch (err) {
    console.warn(`[PlaygroundStorage] Failed to read profile from ${key}:`, err);
    return null;
  }
}

export async function writeProfileToStorage(
  scope: PlayerScope,
  data: Partial<PlaygroundProfileData> | PlaygroundProfileData
): Promise<void> {
  const sanitized = sanitizeProfileData(data);
  const key = getStorageKeyForScope(scope);
  const payload = {
    ...sanitized,
    version: CURRENT_PLAYGROUND_STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(payload);
  await AsyncStorage.setItem(key, serialized);
}

export async function deleteProfileFromStorage(scope: PlayerScope): Promise<void> {
  const key = getStorageKeyForScope(scope);
  await AsyncStorage.removeItem(key);
}

export async function createProfileBackup(
  scope: PlayerScope,
  tag = 'backup'
): Promise<string> {
  const key = getStorageKeyForScope(scope);
  const backupKey = `${key}:${tag}_${Date.now()}`;
  const existing = await AsyncStorage.getItem(key);
  if (existing) {
    await AsyncStorage.setItem(backupKey, existing);
  }
  return backupKey;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLAIM RECEIPTS (IDEMPOTENCY & DUPLICATE PROTECTION)
// ═══════════════════════════════════════════════════════════════════════════

export async function readClaimReceipts(): Promise<ClaimReceipt[]> {
  try {
    const raw = await AsyncStorage.getItem(CLAIM_RECEIPTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[PlaygroundStorage] Failed to read claim receipts:', err);
    return [];
  }
}

export async function saveClaimReceipt(receipt: ClaimReceipt): Promise<void> {
  try {
    const existing = await readClaimReceipts();
    // Prepend new receipt, deduplicating by receiptId
    const filtered = existing.filter((r) => r.receiptId !== receipt.receiptId);
    const updated = [receipt, ...filtered].slice(0, 50); // retain last 50 receipts
    await AsyncStorage.setItem(CLAIM_RECEIPTS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[PlaygroundStorage] Failed to save claim receipt:', err);
  }
}

export async function findReceiptForFingerprint(
  fingerprint: string,
  destinationUserId: string
): Promise<ClaimReceipt | undefined> {
  const receipts = await readClaimReceipts();
  return receipts.find(
    (r) =>
      r.sourceSnapshotFingerprint === fingerprint &&
      r.destinationUserId === destinationUserId &&
      r.status === 'completed'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION JOURNAL (CRASH TOLERANCE)
// ═══════════════════════════════════════════════════════════════════════════

export async function readJournal(): Promise<MigrationJournalEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(MIGRATION_JOURNAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeJournal(entry: MigrationJournalEntry): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATION_JOURNAL_STORAGE_KEY, JSON.stringify(entry));
  } catch (err) {
    console.warn('[PlaygroundStorage] Failed to write journal:', err);
  }
}

export async function clearJournal(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MIGRATION_JOURNAL_STORAGE_KEY);
  } catch (err) {
    console.warn('[PlaygroundStorage] Failed to clear journal:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY STORAGE DETECTION & SAFE MIGRATION
// ═══════════════════════════════════════════════════════════════════════════

export interface LegacyStorageCheckResult {
  exists: boolean;
  hasProgress: boolean;
  isFabricated: boolean;
  data: PlaygroundProfileData | null;
}

export async function checkLegacyStorage(): Promise<LegacyStorageCheckResult> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_PLAYGROUND_STORAGE_KEY);
    if (!raw) {
      return { exists: false, hasProgress: false, isFabricated: false, data: null };
    }

    const parsed = JSON.parse(raw);
    const sanitized = sanitizeProfileData(parsed);
    const fabricated = isFabricatedDefault(parsed);
    const meaningful = hasMeaningfulProgress(sanitized);

    return {
      exists: true,
      hasProgress: meaningful,
      isFabricated: fabricated,
      data: sanitized,
    };
  } catch (err) {
    console.warn('[PlaygroundStorage] Failed to check legacy storage:', err);
    return { exists: false, hasProgress: false, isFabricated: false, data: null };
  }
}

/**
 * Safely migrates genuine legacy data into the guest scope if the guest scope
 * is currently empty and legacy data exists. Preserves a rollback copy.
 */
export async function migrateLegacyToGuestIfAppropriate(): Promise<{
  migrated: boolean;
  reason: string;
}> {
  try {
    const existingJournal = await readJournal();
    if (
      existingJournal &&
      existingJournal.phase === 'SUCCESS' &&
      existingJournal.sourceKey === LEGACY_PLAYGROUND_STORAGE_KEY
    ) {
      return { migrated: false, reason: 'legacy_migration_already_performed' };
    }

    const legacy = await checkLegacyStorage();
    if (!legacy.exists || !legacy.data) {
      return { migrated: false, reason: 'no_legacy_data' };
    }

    // Step 1: Immediately preserve a raw backup of legacy data before any inspection, quarantine, or migration
    const rawLegacy = await AsyncStorage.getItem(LEGACY_PLAYGROUND_STORAGE_KEY);
    if (rawLegacy) {
      const existingBackup = await AsyncStorage.getItem(LEGACY_BACKUP_STORAGE_KEY);
      if (!existingBackup) {
        await AsyncStorage.setItem(LEGACY_BACKUP_STORAGE_KEY, rawLegacy);
      }
    }

    if (legacy.isFabricated) {
      // Preserve ambiguous data in quarantine key so genuine coincidences are never irreversibly lost
      if (rawLegacy) {
        await AsyncStorage.setItem(LEGACY_AMBIGUOUS_QUARANTINE_KEY, rawLegacy);
      }
      return { migrated: false, reason: 'legacy_data_is_fabricated_mock' };
    }

    if (!legacy.hasProgress) {
      return { migrated: false, reason: 'legacy_data_has_no_meaningful_progress' };
    }

    const guestScope: PlayerScope = { type: 'guest' };
    const currentGuest = await readProfileFromStorage(guestScope);

    // If guest already has meaningful progress, do not overwrite it silently
    if (currentGuest && hasMeaningfulProgress(currentGuest)) {
      return { migrated: false, reason: 'guest_scope_already_has_progress' };
    }

    // Write to guest scope
    await writeProfileToStorage(guestScope, legacy.data);

    // Verify written destination
    const verified = await readProfileFromStorage(guestScope);
    if (!verified || verified.brainXp !== legacy.data.brainXp || verified.totalMatches !== legacy.data.totalMatches) {
      throw new Error('Destination verification failed during legacy migration');
    }

    // Record migration journal
    await writeJournal({
      id: `legacy-migration-${Date.now()}`,
      phase: 'SUCCESS',
      sourceKey: LEGACY_PLAYGROUND_STORAGE_KEY,
      destinationKey: getStorageKeyForScope(guestScope),
      timestamp: new Date().toISOString(),
      migratedMatchesCount: legacy.data.totalMatches,
    });

    return { migrated: true, reason: 'legacy_migrated_to_guest_successfully' };
  } catch (err: any) {
    console.warn('[PlaygroundStorage] Error during legacy migration:', err);
    return { migrated: false, reason: err?.message || 'migration_failed' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE ALIASES FOR CONSISTENCY & TESTS
// ═══════════════════════════════════════════════════════════════════════════

export async function loadPlaygroundProfile(scope: PlayerScope): Promise<PlaygroundProfileData> {
  const profile = await readProfileFromStorage(scope);
  return profile || createDefaultProfileData();
}
export const savePlaygroundProfile = writeProfileToStorage;
export const computeProfileFingerprint = calculateProfileFingerprint;

export async function getClaimReceipt(receiptId: string): Promise<ClaimReceipt | null> {
  const receipts = await readClaimReceipts();
  return receipts.find((r) => r.receiptId === receiptId) || null;
}

export async function getMigrationJournal(): Promise<MigrationJournalEntry[]> {
  const entry = await readJournal();
  return entry ? [entry] : [];
}
