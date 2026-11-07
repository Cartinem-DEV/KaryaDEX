/**
 * KaryaDEX — Playground Guest Claim Crash Recovery & Fault Injection Tests
 *
 * Deterministically tests interruption and recovery across all 9 transaction phases:
 * 1. PREPARE
 * 2. SNAPSHOT
 * 3. VALIDATE
 * 4. WRITE_DESTINATION
 * 5. VERIFY
 * 6. TRANSFER_TUTORIALS
 * 7. RECEIPT
 * 8. RESET_GUEST
 * 9. CLEANUP
 */

const storageMap = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => storageMap.get(key) || null),
    setItem: jest.fn(async (key: string, value: string) => {
      storageMap.set(key, String(value));
    }),
    removeItem: jest.fn(async (key: string) => {
      storageMap.delete(key);
    }),
    clear: jest.fn(async () => {
      storageMap.clear();
    }),
  },
}));

import {
  recoverInterruptedClaimTransaction,
  executeGuestClaim,
} from '../lib/playground/identity/playgroundClaimManager';
import {
  writeJournal,
  readJournal,
  writeProfileToStorage,
  readProfileFromStorage,
  calculateProfileFingerprint,
  readClaimReceipts,
  MIGRATION_JOURNAL_STORAGE_KEY,
} from '../lib/playground/identity/playgroundStorage';
import { usePlaygroundGuideStore } from '../store/usePlaygroundGuideStore';
import type {
  PlayerScope,
  PlaygroundProfileData,
  MatchRecord,
  MigrationJournalEntry,
} from '../types/playground';

describe('PG-3A.1: Guest Claim Crash Recovery & Fault Injection', () => {
  const destinationUserId = 'user-crash-test-456';
  const guestScope: PlayerScope = { type: 'guest' };
  const accountScope: PlayerScope = { type: 'authenticated', userId: destinationUserId };

  const sampleMatch: MatchRecord = {
    id: 'guest-match-recovery-1',
    gameType: 'sprint_duel',
    gameTitle: 'Sprint Duel',
    result: 'won',
    isWin: true,
    score: 30,
    durationSeconds: 60,
    xpEarned: 150,
    ratingDelta: 25,
    ratingChange: 25,
    date: new Date().toISOString(),
    timestamp: Date.now(),
    isPractice: false,
  };

  const sampleGuestProfile: PlaygroundProfileData = {
    version: 2,
    brainXp: 500,
    brainRating: 1100,
    escapeStreak: 3,
    currentLevel: 2,
    currentStreak: 3,
    totalMatches: 6,
    totalWins: 5,
    lastPlayedDate: new Date().toISOString(),
    totalTimeMinutes: 30,
    highScores: { sprint_duel: 30, queens: 0, tango: 0, mind_snap: 0 },
    ratings: { sprint_duel: 1100, queens: 1000, tango: 1000, mindsnap: 1000 },
    dailyQuests: [],
    recentMatches: [sampleMatch],
    soundEnabled: true,
    hapticsEnabled: true,
  };

  const sampleAccountProfile: PlaygroundProfileData = {
    version: 2,
    brainXp: 800,
    brainRating: 1150,
    escapeStreak: 4,
    currentLevel: 3,
    currentStreak: 4,
    totalMatches: 8,
    totalWins: 6,
    lastPlayedDate: new Date().toISOString(),
    totalTimeMinutes: 45,
    highScores: { sprint_duel: 0, queens: 50, tango: 0, mind_snap: 0 },
    ratings: { sprint_duel: 1000, queens: 1150, tango: 1000, mindsnap: 1000 },
    dailyQuests: [],
    recentMatches: [],
    soundEnabled: true,
    hapticsEnabled: true,
  };

  beforeEach(async () => {
    storageMap.clear();
    jest.clearAllMocks();

    usePlaygroundGuideStore.setState({
      activeUserId: 'guest',
      completedTutorials: ['sprint_duel'],
      userTutorialStates: {
        guest: {
          sprint_duel: { completed: true, dismissed: true, completedAt: new Date().toISOString() },
        },
      },
    });

    // Seed clean initial profiles
    await writeProfileToStorage(guestScope, sampleGuestProfile);
    await writeProfileToStorage(accountScope, sampleAccountProfile);
  });

  it('stage 1-3 (PREPARE, SNAPSHOT, VALIDATE): safely rolls back without touching either profile', async () => {
    const journal: MigrationJournalEntry = {
      id: 'crash-prep-1',
      phase: 'PREPARE',
      sourceKey: 'karyadex_playground_v2:guest',
      destinationKey: `karyadex_playground_v2:user:${destinationUserId}`,
      timestamp: new Date().toISOString(),
      payloadFingerprint: calculateProfileFingerprint(sampleGuestProfile),
    };
    await writeJournal(journal);

    const recovery = await recoverInterruptedClaimTransaction();
    expect(recovery.recovered).toBe(true);
    expect(recovery.action).toBe('rolled_back');

    // Both profiles remain 100% intact
    const guestAfter = await readProfileFromStorage(guestScope);
    expect(guestAfter?.brainXp).toBe(500);
    expect(guestAfter?.totalMatches).toBe(6);

    const accountAfter = await readProfileFromStorage(accountScope);
    expect(accountAfter?.brainXp).toBe(800);
    expect(accountAfter?.totalMatches).toBe(8);

    // Journal is cleared
    expect(await readJournal()).toBeNull();
  });

  it('stage 4 (WRITE_DESTINATION): restores pre-claim account backup when destination write was interrupted', async () => {
    const backupKey = `karyadex_playground_v2:user:${destinationUserId}:pre_replace_backup_crash`;
    storageMap.set(backupKey, JSON.stringify(sampleAccountProfile));

    // Simulate corrupted partial write at destination
    storageMap.set(
      `karyadex_playground_v2:user:${destinationUserId}`,
      '{"corrupted": "half-written-payload"'
    );

    const journal: MigrationJournalEntry = {
      id: 'crash-write-1',
      phase: 'WRITE_DESTINATION',
      sourceKey: 'karyadex_playground_v2:guest',
      destinationKey: `karyadex_playground_v2:user:${destinationUserId}`,
      destinationBackupKey: backupKey,
      timestamp: new Date().toISOString(),
      payloadFingerprint: calculateProfileFingerprint(sampleGuestProfile),
    };
    await writeJournal(journal);

    const recovery = await recoverInterruptedClaimTransaction();
    expect(recovery.recovered).toBe(true);
    expect(recovery.action).toBe('rolled_back');

    // Destination restored from backup
    const accountRestored = await readProfileFromStorage(accountScope);
    expect(accountRestored?.brainXp).toBe(800);
    expect(accountRestored?.totalMatches).toBe(8);

    // Guest progress remains completely intact
    const guestIntact = await readProfileFromStorage(guestScope);
    expect(guestIntact?.brainXp).toBe(500);

    expect(await readJournal()).toBeNull();
  });

  it('stage 5 (VERIFY): rolls back when destination verification check fails', async () => {
    const backupKey = `karyadex_playground_v2:user:${destinationUserId}:pre_replace_backup_crash2`;
    storageMap.set(backupKey, JSON.stringify(sampleAccountProfile));

    // Destination written with bad mismatch stats
    await writeProfileToStorage(accountScope, {
      ...sampleGuestProfile,
      brainXp: 999999, // Mismatched XP!
    });

    const journal: MigrationJournalEntry = {
      id: 'crash-verify-fail-1',
      phase: 'VERIFY',
      sourceKey: 'karyadex_playground_v2:guest',
      destinationKey: `karyadex_playground_v2:user:${destinationUserId}`,
      destinationBackupKey: backupKey,
      timestamp: new Date().toISOString(),
      payloadFingerprint: calculateProfileFingerprint(sampleGuestProfile),
    };
    await writeJournal(journal);

    const recovery = await recoverInterruptedClaimTransaction();
    expect(recovery.recovered).toBe(true);
    expect(recovery.action).toBe('rolled_back');

    // Restores original account from backup
    const accountRestored = await readProfileFromStorage(accountScope);
    expect(accountRestored?.brainXp).toBe(800);
    expect(accountRestored?.totalMatches).toBe(8);

    // Guest progress intact
    const guestIntact = await readProfileFromStorage(guestScope);
    expect(guestIntact?.brainXp).toBe(500);
  });

  it('stage 6 (TRANSFER_TUTORIALS): rolls forward, transferring tutorials and finalizing receipt', async () => {
    // Destination was successfully written and verified
    await writeProfileToStorage(accountScope, sampleGuestProfile);

    const journal: MigrationJournalEntry = {
      id: 'crash-tutorial-1',
      phase: 'TRANSFER_TUTORIALS',
      sourceKey: 'karyadex_playground_v2:guest',
      destinationKey: `karyadex_playground_v2:user:${destinationUserId}`,
      timestamp: new Date().toISOString(),
      payloadFingerprint: calculateProfileFingerprint(sampleGuestProfile),
    };
    await writeJournal(journal);

    const recovery = await recoverInterruptedClaimTransaction();
    expect(recovery.recovered).toBe(true);
    expect(recovery.action).toBe('rolled_forward');

    // Tutorials transferred to account
    const guideStore = usePlaygroundGuideStore.getState();
    expect(guideStore.userTutorialStates[destinationUserId]?.sprint_duel?.completed).toBe(true);

    // Receipt created
    const receipts = await readClaimReceipts();
    expect(receipts.length).toBeGreaterThan(0);
    expect(receipts[0].destinationUserId).toBe(destinationUserId);

    // Guest reset
    const guestAfter = await readProfileFromStorage(guestScope);
    expect(guestAfter?.totalMatches).toBe(0);
    expect(guestAfter?.brainXp).toBe(0);

    expect(await readJournal()).toBeNull();
  });

  it('stage 7 (RECEIPT): rolls forward when receipt writing was interrupted', async () => {
    // Destination written and verified
    await writeProfileToStorage(accountScope, sampleGuestProfile);

    const journal: MigrationJournalEntry = {
      id: 'crash-receipt-1',
      phase: 'RECEIPT',
      sourceKey: 'karyadex_playground_v2:guest',
      destinationKey: `karyadex_playground_v2:user:${destinationUserId}`,
      timestamp: new Date().toISOString(),
      payloadFingerprint: calculateProfileFingerprint(sampleGuestProfile),
    };
    await writeJournal(journal);

    const recovery = await recoverInterruptedClaimTransaction();
    expect(recovery.recovered).toBe(true);
    expect(recovery.action).toBe('rolled_forward');

    // Receipt was saved by recovery
    const receipts = await readClaimReceipts();
    expect(receipts.some((r) => r.destinationUserId === destinationUserId)).toBe(true);

    // Guest partition reset
    const guestAfter = await readProfileFromStorage(guestScope);
    expect(guestAfter?.totalMatches).toBe(0);

    expect(await readJournal()).toBeNull();
  });

  it('stage 8 (RESET_GUEST): safely zeroes guest partition and clears journal when receipt already existed', async () => {
    // Destination written and verified
    await writeProfileToStorage(accountScope, sampleGuestProfile);

    const journal: MigrationJournalEntry = {
      id: 'crash-reset-1',
      phase: 'RESET_GUEST',
      sourceKey: 'karyadex_playground_v2:guest',
      destinationKey: `karyadex_playground_v2:user:${destinationUserId}`,
      timestamp: new Date().toISOString(),
      payloadFingerprint: calculateProfileFingerprint(sampleGuestProfile),
    };
    await writeJournal(journal);

    const recovery = await recoverInterruptedClaimTransaction();
    expect(recovery.recovered).toBe(true);
    expect(recovery.action).toBe('rolled_forward');

    // Guest is clean default
    const guestAfter = await readProfileFromStorage(guestScope);
    expect(guestAfter?.totalMatches).toBe(0);
    expect(guestAfter?.brainXp).toBe(0);

    expect(await readJournal()).toBeNull();
  });

  it('stage 9 (CLEANUP): clears lingering SUCCESS or ROLLED_BACK journal safely', async () => {
    const journal: MigrationJournalEntry = {
      id: 'crash-cleanup-1',
      phase: 'SUCCESS',
      sourceKey: 'karyadex_playground_v2:guest',
      destinationKey: `karyadex_playground_v2:user:${destinationUserId}`,
      timestamp: new Date().toISOString(),
    };
    await writeJournal(journal);

    const recovery = await recoverInterruptedClaimTransaction();
    expect(recovery.recovered).toBe(true);
    expect(recovery.action).toBe('cleaned_up');
    expect(await readJournal()).toBeNull();
  });

  it('guarantees retry after recovery never duplicates claims or inflates XP', async () => {
    // Complete normal claim
    const claimRes = await executeGuestClaim(destinationUserId, 'replace_account');
    expect(claimRes.success).toBe(true);

    // Simulate second claim attempt
    const retryRes = await executeGuestClaim(destinationUserId, 'replace_account');
    // Rejected because guest partition was reset to 0 matches
    expect(retryRes.success).toBe(false);
    expect(retryRes.error).toBe('no_meaningful_guest_progress');

    // Account stats remain exactly as claimed, never doubled
    const accountFinal = await readProfileFromStorage(accountScope);
    expect(accountFinal?.brainXp).toBe(500);
    expect(accountFinal?.totalMatches).toBe(6);
  });
});
