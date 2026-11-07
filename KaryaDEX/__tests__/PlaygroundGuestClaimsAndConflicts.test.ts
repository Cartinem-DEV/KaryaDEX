/**
 * KaryaDEX — Guest Progress Claim & Conflict Resolution Test Suite (PG-3A)
 *
 * Validates:
 * - Eligibility detection for fresh accounts (Mode 1) vs existing accounts with conflicts (Mode 2)
 * - Explicit user confirmation requirement (never silent auto-claiming)
 * - Safe two-phase claim execution with destination read-back verification
 * - Non-destructive tutorial completion merge (guest tutorials added to account tutorials)
 * - Conflict resolution: "Keep Account Progress" (preserves account progress untouched)
 * - Conflict resolution: "Replace Account Progress" (creates pre-claim backup, replaces with guest data)
 * - Guest profile reset post-claim and claim receipt recording
 * - Rejection of fabricated/empty guest data from triggering prompts
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

import { usePlaygroundStore, INITIAL_PLAYGROUND_STATE } from '../store/usePlaygroundStore';
import { usePlaygroundGuideStore } from '../store/usePlaygroundGuideStore';
import {
  savePlaygroundProfile,
  loadPlaygroundProfile,
  getClaimReceipt,
} from '../lib/playground/identity/playgroundStorage';
import {
  checkGuestClaimEligibility,
  executeGuestClaim,
} from '../lib/playground/identity/playgroundClaimManager';
import type { PlaygroundProfileData, MatchRecord } from '../types/playground';

describe('PG-3A: Guest Claims & Conflict Resolution', () => {
  const testUserId = 'test-auth-user-1234';

  const sampleGuestMatch: MatchRecord = {
    id: 'guest-match-1',
    gameType: 'sprint_duel',
    gameTitle: 'Sprint Duel',
    result: 'won',
    isWin: true,
    score: 25,
    durationSeconds: 45,
    xpEarned: 100,
    ratingDelta: 20,
    ratingChange: 20,
    date: new Date(Date.now() - 3600000).toISOString(),
    timestamp: Date.now() - 3600000,
    isPractice: false,
  };

  const sampleGuestProfile: PlaygroundProfileData = {
    version: 2,
    brainXp: 450,
    brainRating: 1050,
    escapeStreak: 2,
    currentLevel: 2,
    currentStreak: 2,
    totalMatches: 5,
    totalWins: 4,
    lastPlayedDate: new Date().toISOString(),
    totalTimeMinutes: 25,
    highScores: { sprint_duel: 25, queens: 0, tango: 0, mind_snap: 0 },
    ratings: { sprint_duel: 1050, queens: 1020, tango: 1000, mindsnap: 1000 },
    dailyQuests: [],
    recentMatches: [sampleGuestMatch],
    soundEnabled: true,
    hapticsEnabled: true,
  };

  const sampleAccountMatch: MatchRecord = {
    id: 'account-match-1',
    gameType: 'queens',
    gameTitle: 'Queens',
    result: 'won',
    isWin: true,
    score: 80,
    durationSeconds: 120,
    xpEarned: 120,
    ratingDelta: 15,
    ratingChange: 15,
    date: new Date(Date.now() - 7200000).toISOString(),
    timestamp: Date.now() - 7200000,
    isPractice: false,
  };

  const sampleAccountProfile: PlaygroundProfileData = {
    version: 2,
    brainXp: 1200,
    brainRating: 1120,
    escapeStreak: 5,
    currentLevel: 4,
    currentStreak: 5,
    totalMatches: 12,
    totalWins: 10,
    lastPlayedDate: new Date().toISOString(),
    totalTimeMinutes: 70,
    highScores: { sprint_duel: 0, queens: 80, tango: 0, mind_snap: 0 },
    ratings: { sprint_duel: 1080, queens: 1120, tango: 1040, mindsnap: 1000 },
    dailyQuests: [],
    recentMatches: [sampleAccountMatch],
    soundEnabled: true,
    hapticsEnabled: true,
  };

  beforeEach(async () => {
    storageMap.clear();
    jest.clearAllMocks();

    usePlaygroundStore.setState({
      ...INITIAL_PLAYGROUND_STATE,
      activeScope: { type: 'guest' },
      isHydrated: true,
      isHydrating: false,
      pendingGuestClaim: null,
    });

    usePlaygroundGuideStore.setState({
      activeUserId: 'guest',
      completedTutorials: [],
    });
  });

  describe('Eligibility Detection', () => {
    it('returns null if guest has 0 matches (no eligible progress)', async () => {
      // Empty guest
      const result = await checkGuestClaimEligibility(testUserId);
      expect(result).toBeNull();
    });

    it('returns null if guest profile contains only the fabricated default placeholder', async () => {
      // Save fabricated default
      await savePlaygroundProfile({ type: 'guest' }, {
        brainXp: 350,
        currentLevel: 1,
        currentStreak: 3,
        totalMatches: 8,
        totalWins: 5,
        ratings: { sprint_duel: 1000, queens: 1000, tango: 1000, mindsnap: 1000 },
        dailyQuests: [],
        recentMatches: [], // Empty matches signals fabricated default
      });

      const result = await checkGuestClaimEligibility(testUserId);
      expect(result).toBeNull();
    });

    it('detects Mode 1 (fresh) when guest has genuine progress and account has 0 matches', async () => {
      await savePlaygroundProfile({ type: 'guest' }, sampleGuestProfile);

      const eligibility = await checkGuestClaimEligibility(testUserId);
      expect(eligibility).not.toBeNull();
      expect(eligibility?.mode).toBe('fresh');
      expect(eligibility?.guestSummary.totalMatches).toBe(5);
      expect(eligibility?.guestSummary.brainXp).toBe(450);
      expect(eligibility?.accountSummary.totalMatches).toBe(0);
    });

    it('detects Mode 2 (conflict) when both guest and authenticated account have progress', async () => {
      await savePlaygroundProfile({ type: 'guest' }, sampleGuestProfile);
      await savePlaygroundProfile({ type: 'authenticated', userId: testUserId }, sampleAccountProfile);

      const eligibility = await checkGuestClaimEligibility(testUserId);
      expect(eligibility).not.toBeNull();
      expect(eligibility?.mode).toBe('conflict');
      expect(eligibility?.guestSummary.totalMatches).toBe(5);
      expect(eligibility?.accountSummary.totalMatches).toBe(12);
    });
  });

  describe('Fresh Account Claim (Mode 1)', () => {
    it('successfully transfers guest progress to authenticated account and resets guest', async () => {
      await savePlaygroundProfile({ type: 'guest' }, sampleGuestProfile);

      // Set guest tutorial completions
      usePlaygroundGuideStore.setState({
        activeUserId: 'guest',
        completedTutorials: ['sprint_duel', 'queens'],
      });

      const result = await executeGuestClaim(testUserId, 'claim');
      expect(result.success).toBe(true);
      expect(result.receiptId).toBeDefined();

      // Authenticated account now has guest progress
      const targetProfile = await loadPlaygroundProfile({ type: 'authenticated', userId: testUserId });
      expect(targetProfile.totalMatches).toBe(5);
      expect(targetProfile.brainXp).toBe(450);
      expect(targetProfile.ratings?.sprint_duel).toBe(1050);

      // Tutorials were migrated non-destructively
      const guideTutorials = usePlaygroundGuideStore.getState().completedTutorials;
      expect(guideTutorials).toContain('sprint_duel');
      expect(guideTutorials).toContain('queens');

      // Guest profile is reset to clean default
      const guestProfile = await loadPlaygroundProfile({ type: 'guest' });
      expect(guestProfile.totalMatches).toBe(0);
      expect(guestProfile.brainXp).toBe(0);

      // Claim receipt is recorded in storage
      const receipt = await getClaimReceipt(result.receiptId!);
      expect(receipt).not.toBeNull();
      expect(receipt?.status).toBe('completed');
      expect(receipt?.destinationVerified).toBe(true);
    });

    it('handles decline without altering either profile', async () => {
      await savePlaygroundProfile({ type: 'guest' }, sampleGuestProfile);

      const result = await executeGuestClaim(testUserId, 'decline');
      expect(result.success).toBe(true);

      // Guest profile remains intact
      const guestProfile = await loadPlaygroundProfile({ type: 'guest' });
      expect(guestProfile.totalMatches).toBe(5);
      expect(guestProfile.brainXp).toBe(450);

      // Account profile remains empty
      const accountProfile = await loadPlaygroundProfile({ type: 'authenticated', userId: testUserId });
      expect(accountProfile.totalMatches).toBe(0);

      // Receipt recorded as declined
      const receipt = await getClaimReceipt(result.receiptId!);
      expect(receipt?.status).toBe('declined');
    });
  });

  describe('Conflict Resolution (Mode 2)', () => {
    beforeEach(async () => {
      await savePlaygroundProfile({ type: 'guest' }, sampleGuestProfile);
      await savePlaygroundProfile({ type: 'authenticated', userId: testUserId }, sampleAccountProfile);
    });

    it('option "keep_account" preserves account progress and dismisses guest prompt', async () => {
      const result = await executeGuestClaim(testUserId, 'keep_account');
      expect(result.success).toBe(true);

      // Authenticated account progress is completely preserved
      const accountProfile = await loadPlaygroundProfile({ type: 'authenticated', userId: testUserId });
      expect(accountProfile.totalMatches).toBe(12);
      expect(accountProfile.brainXp).toBe(1200);
      expect(accountProfile.ratings?.queens).toBe(1120);

      // Receipt recorded
      const receipt = await getClaimReceipt(result.receiptId!);
      expect(receipt?.status).toBe('conflict_kept_account');
    });

    it('option "replace_account" replaces account with guest, saving pre-claim backup', async () => {
      const result = await executeGuestClaim(testUserId, 'replace_account');
      expect(result.success).toBe(true);

      // Authenticated account now contains guest progress
      const accountProfile = await loadPlaygroundProfile({ type: 'authenticated', userId: testUserId });
      expect(accountProfile.totalMatches).toBe(5);
      expect(accountProfile.brainXp).toBe(450);
      expect(accountProfile.ratings?.sprint_duel).toBe(1050);

      // Pre-claim backup was created and referenced in receipt
      const receipt = await getClaimReceipt(result.receiptId!);
      expect(receipt?.status).toBe('conflict_replaced_account');
      expect(receipt?.preClaimAccountBackupKey).toBeDefined();

      const backupRaw = storageMap.get(receipt!.preClaimAccountBackupKey!);
      expect(backupRaw).toBeDefined();
      const backupParsed = JSON.parse(backupRaw!);
      expect(backupParsed.totalMatches).toBe(12);
      expect(backupParsed.brainXp).toBe(1200);

      // Guest profile was reset
      const guestProfile = await loadPlaygroundProfile({ type: 'guest' });
      expect(guestProfile.totalMatches).toBe(0);
    });
  });

  describe('Tutorial Completion Merging', () => {
    it('merges guest tutorials with existing account tutorials without duplicates', async () => {
      await savePlaygroundProfile({ type: 'guest' }, sampleGuestProfile);

      // Account already has 'tango' tutorial complete
      usePlaygroundGuideStore.setState({
        activeUserId: testUserId,
        completedTutorials: ['tango'],
      });

      // Execute claim (guest had 'sprint_duel' and 'tango')
      // Let's set guest storage tutorials
      storageMap.set(
        'karyadex_playground_guides:guest',
        JSON.stringify({ completedTutorials: ['sprint_duel', 'tango', 'queens'] })
      );

      await executeGuestClaim(testUserId, 'claim');

      const finalTutorials = usePlaygroundGuideStore.getState().completedTutorials;
      expect(finalTutorials).toContain('tango');
      expect(finalTutorials).toContain('sprint_duel');
      expect(finalTutorials).toContain('queens');
      // No duplicate 'tango'
      expect(finalTutorials.filter((t) => t === 'tango')).toHaveLength(1);
    });
  });
});
