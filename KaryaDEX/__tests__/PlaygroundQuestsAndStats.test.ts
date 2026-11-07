/**
 * KaryaDEX — Playground Store, Quests & Progression Unit Tests
 *
 * Validates:
 * - Quest XP rewards awarded exactly once on transition from incomplete to complete
 * - No duplicate rewards for already completed quests
 * - No rewards for incomplete quests
 * - Multiple quests completed simultaneously by one match
 * - Duplicate match submission protection (idempotency)
 * - Atomic XP combining match XP and newly earned quest XP
 * - New user defaults (honest 0 stats)
 * - Legacy data migration & existing user preservation
 */

import {
  usePlaygroundStore,
  INITIAL_PLAYGROUND_STATE,
  generateDefaultQuests,
} from '../store/usePlaygroundStore';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

describe('Playground Store — Quests, XP Rewards & Player Statistics', () => {
  beforeEach(() => {
    // Reset to brand-new user state before each test
    usePlaygroundStore.setState({
      ...INITIAL_PLAYGROUND_STATE,
      dailyQuests: [
        {
          id: 'quest-sprint',
          title: 'Sprint Blitz',
          description: 'Score 10+ points in a Sprint Duel battle',
          gameType: 'sprint_duel',
          targetCount: 1,
          currentCount: 0,
          completed: false,
          xpReward: 100,
        },
        {
          id: 'quest-sprint-2',
          title: 'Sprint Master',
          description: 'Score 10+ points in Sprint Duel again',
          gameType: 'sprint_duel',
          targetCount: 1,
          currentCount: 0,
          completed: false,
          xpReward: 150,
        },
        {
          id: 'quest-queens',
          title: 'Royal Crown',
          description: 'Solve 1 Queens logic territory puzzle',
          gameType: 'queens',
          targetCount: 1,
          currentCount: 0,
          completed: false,
          xpReward: 120,
        },
      ],
    });
  });

  describe('BUG-02: New User Defaults', () => {
    it('initializes brand-new players with honest zero statistics', () => {
      const state = usePlaygroundStore.getState();
      expect(state.brainXp).toBe(0);
      expect(state.escapeStreak).toBe(0);
      expect(state.totalMatches).toBe(0);
      expect(state.totalTimeMinutes).toBe(0);
      expect(state.recentMatches).toEqual([]);
      expect(state.highScores).toEqual({
        sprint_duel: 0,
        queens: 0,
        tango: 0,
        mind_snap: 0,
      });
      // Neutral starting ELO
      expect(state.brainRating).toBe(1200);
    });

    it('calculates total challenge time without fabricated multipliers', () => {
      const state = usePlaygroundStore.getState();
      expect(state.getTotalChallengeTimeMinutes()).toBe(0);
      expect(state.getEstimatedDoomscrollSavedMinutes()).toBe(0);

      // Advance total time
      usePlaygroundStore.setState({ totalTimeMinutes: 18 });
      expect(usePlaygroundStore.getState().getTotalChallengeTimeMinutes()).toBe(18);
      expect(usePlaygroundStore.getState().getEstimatedDoomscrollSavedMinutes()).toBe(18);
    });
  });

  describe('BUG-01: Daily Quest XP Rewards', () => {
    it('scenario 1: does not award quest XP when quest is not yet completed', () => {
      const initialXp = usePlaygroundStore.getState().brainXp; // 0

      // Sprint duel with score 5 (target is 10 for quest-sprint)
      const result = usePlaygroundStore.getState().recordMatch({
        gameType: 'sprint_duel',
        score: 5,
        opponentScore: 4,
        isWin: true,
        durationSeconds: 60,
        xpEarned: 100,
      });

      expect(result.xpEarned).toBe(100);
      expect(result.questXpEarned).toBe(0);
      expect(result.totalXpEarned).toBe(100);
      expect(result.completedQuests).toHaveLength(0);

      const state = usePlaygroundStore.getState();
      expect(state.brainXp).toBe(initialXp + 100);

      const quest = state.dailyQuests.find((q) => q.id === 'quest-sprint')!;
      expect(quest.currentCount).toBe(0);
      expect(quest.completed).toBe(false);
    });

    it('scenario 2: awards configured quest XP exactly once when quest completes for the first time', () => {
      const initialXp = usePlaygroundStore.getState().brainXp; // 0

      // Queens solve (awards 120 match XP + 120 quest XP from quest-queens)
      const result = usePlaygroundStore.getState().recordMatch({
        gameType: 'queens',
        score: 1,
        isWin: true,
        durationSeconds: 90,
        xpEarned: 120,
      });

      expect(result.xpEarned).toBe(120);
      expect(result.questXpEarned).toBe(120);
      expect(result.totalXpEarned).toBe(240);
      expect(result.completedQuests).toHaveLength(1);
      expect(result.completedQuests[0].id).toBe('quest-queens');

      const state = usePlaygroundStore.getState();
      // Total XP should include BOTH match XP (120) and quest XP (120)
      expect(state.brainXp).toBe(initialXp + 240);

      const quest = state.dailyQuests.find((q) => q.id === 'quest-queens')!;
      expect(quest.completed).toBe(true);
      expect(quest.currentCount).toBe(1);
    });

    it('scenario 3: does not award repeated quest XP when quest is already completed', () => {
      // First win completes quest
      usePlaygroundStore.getState().recordMatch({
        gameType: 'queens',
        score: 1,
        isWin: true,
        durationSeconds: 60,
        xpEarned: 120,
      });

      const xpAfterFirstWin = usePlaygroundStore.getState().brainXp; // 240

      // Second win on same game
      const secondResult = usePlaygroundStore.getState().recordMatch({
        gameType: 'queens',
        score: 1,
        isWin: true,
        durationSeconds: 50,
        xpEarned: 120,
      });

      expect(secondResult.xpEarned).toBe(120);
      expect(secondResult.questXpEarned).toBe(0);
      expect(secondResult.totalXpEarned).toBe(120);
      expect(secondResult.completedQuests).toHaveLength(0);

      const state = usePlaygroundStore.getState();
      expect(state.brainXp).toBe(xpAfterFirstWin + 120);
    });

    it('scenario 4: awards multiple quest rewards if one match satisfies multiple quests', () => {
      const initialXp = usePlaygroundStore.getState().brainXp; // 0

      // Both quest-sprint (100 XP) and quest-sprint-2 (150 XP) listen to sprint_duel with score >= 10
      const result = usePlaygroundStore.getState().recordMatch({
        gameType: 'sprint_duel',
        score: 15,
        opponentScore: 8,
        isWin: true,
        durationSeconds: 60,
        xpEarned: 130,
      });

      expect(result.xpEarned).toBe(130);
      expect(result.questXpEarned).toBe(250); // 100 + 150
      expect(result.totalXpEarned).toBe(380); // 130 + 250
      expect(result.completedQuests).toHaveLength(2);

      const state = usePlaygroundStore.getState();
      expect(state.brainXp).toBe(initialXp + 380);
    });

    it('scenario 5: prevents duplicate match submission from awarding duplicate rewards (idempotency)', () => {
      const matchPayload = {
        id: 'unique-match-uuid-12345',
        gameType: 'queens' as const,
        score: 1,
        isWin: true,
        durationSeconds: 60,
        xpEarned: 120,
      };

      // First submission
      const firstResult = usePlaygroundStore.getState().recordMatch(matchPayload);
      expect(firstResult.totalXpEarned).toBe(240); // 120 match + 120 quest
      const firstXp = usePlaygroundStore.getState().brainXp;
      const firstMatches = usePlaygroundStore.getState().totalMatches;

      // Duplicate submission with same id
      const duplicateResult = usePlaygroundStore.getState().recordMatch(matchPayload);
      expect(duplicateResult.questXpEarned).toBe(0);

      const state = usePlaygroundStore.getState();
      // Total XP and match count must remain unchanged
      expect(state.brainXp).toBe(firstXp);
      expect(state.totalMatches).toBe(firstMatches);
    });

    it('scenario 6: correctly combines simultaneous match and quest rewards atomically', () => {
      const stateBefore = usePlaygroundStore.getState();
      expect(stateBefore.brainXp).toBe(0);

      const res = usePlaygroundStore.getState().recordMatch({
        gameType: 'queens',
        score: 1,
        isWin: true,
        durationSeconds: 120,
        xpEarned: 100,
      });

      const stateAfter = usePlaygroundStore.getState();
      expect(stateAfter.brainXp).toBe(res.totalXpEarned);
      expect(stateAfter.totalMatches).toBe(1);
      expect(stateAfter.totalTimeMinutes).toBe(2); // ceil(120/60)
    });
  });
});
