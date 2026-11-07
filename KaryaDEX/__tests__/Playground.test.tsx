/**
 * BunkMatKar — Brain Playground Tests
 *
 * Validates the dedicated Playground feature:
 * - Matrix Escape cognitive store (usePlaygroundStore)
 * - Anti-Doomscroll metrics and dopamine rewiring calculations
 * - ELO Rating progression & Rank tiers
 * - Daily Escape Quests progress and completions
 * - Match recording and streak updates
 */

import { usePlaygroundStore, BRAIN_RANKS } from '../store/usePlaygroundStore';

// Mock AsyncStorage for Zustand persist
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

describe('Brain Playground — Matrix Escape Cognitive Store', () => {
  beforeEach(() => {
    // Reset store to known baseline before each test
    usePlaygroundStore.setState({
      brainXp: 350,
      brainRating: 1200,
      escapeStreak: 3,
      lastPlayedDate: null,
      totalTimeMinutes: 45,
      totalMatches: 8,
      highScores: {
        sprint_duel: 18,
        queens: 1,
        tango: 1,
        mind_snap: 7,
      },
      recentMatches: [],
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
          id: 'quest-queens',
          title: 'Royal Crown',
          description: 'Solve 1 Queens logic territory puzzle',
          gameType: 'queens',
          targetCount: 1,
          currentCount: 0,
          completed: false,
          xpReward: 120,
        },
        {
          id: 'quest-tango',
          title: 'Celestial Harmony',
          description: 'Solve 1 Tango Sun & Moon binary grid',
          gameType: 'tango',
          targetCount: 1,
          currentCount: 0,
          completed: false,
          xpReward: 120,
        },
        {
          id: 'quest-mindsnap',
          title: 'Memory Trigger',
          description: 'Reach stage 5 in MindSnap memory blitz',
          gameType: 'mind_snap',
          targetCount: 1,
          currentCount: 0,
          completed: false,
          xpReward: 80,
        },
      ],
      soundEnabled: true,
      hapticsEnabled: true,
    });
  });

  it('initializes with default cognitive stats and ranks', () => {
    const state = usePlaygroundStore.getState();
    expect(state.brainRating).toBe(1200);
    expect(state.brainXp).toBe(350);
    expect(state.escapeStreak).toBe(3);

    const rank = state.getRank();
    expect(rank.tier).toBe('Silver');
    expect(rank.title).toBe('Synaptic Walker');
  });

  it('correctly maps brain ELO ratings to Brain Ranks', () => {
    // Bronze
    usePlaygroundStore.setState({ brainRating: 900 });
    expect(usePlaygroundStore.getState().getRank().tier).toBe('Bronze');

    // Silver
    usePlaygroundStore.setState({ brainRating: 1150 });
    expect(usePlaygroundStore.getState().getRank().tier).toBe('Silver');

    // Gold
    usePlaygroundStore.setState({ brainRating: 1350 });
    expect(usePlaygroundStore.getState().getRank().tier).toBe('Gold');

    // Diamond
    usePlaygroundStore.setState({ brainRating: 1600 });
    expect(usePlaygroundStore.getState().getRank().tier).toBe('Diamond');

    // Master
    usePlaygroundStore.setState({ brainRating: 1850 });
    expect(usePlaygroundStore.getState().getRank().tier).toBe('Master');

    // Matrix Liberator
    usePlaygroundStore.setState({ brainRating: 2200 });
    expect(usePlaygroundStore.getState().getRank().tier).toBe('Matrix Liberator');
  });

  it('calculates challenge minutes from brain game matches', () => {
    const state = usePlaygroundStore.getState();
    const saved = state.getEstimatedDoomscrollSavedMinutes();
    expect(saved).toBe(45);
  });

  it('records Sprint Duel victory with positive ELO delta and updates quests', () => {
    const initialRating = usePlaygroundStore.getState().brainRating;
    const initialXp = usePlaygroundStore.getState().brainXp;

    const result = usePlaygroundStore.getState().recordMatch({
      gameType: 'sprint_duel',
      score: 24,
      opponentScore: 16,
      isWin: true,
      durationSeconds: 60,
      xpEarned: 150,
    });

    expect(result.ratingDelta).toBeGreaterThan(0);
    expect(result.xpEarned).toBe(150);
    expect(result.questXpEarned).toBe(100);
    expect(result.totalXpEarned).toBe(250);

    const updated = usePlaygroundStore.getState();
    expect(updated.brainRating).toBe(initialRating + result.ratingDelta);
    // Verified BUG-01 fix: brainXp includes BOTH match XP (150) and completed quest XP (100)
    expect(updated.brainXp).toBe(initialXp + 250);
    expect(updated.highScores.sprint_duel).toBe(24);
    expect(updated.totalMatches).toBe(9);

    // Verify Sprint Blitz daily quest progressed & completed
    const sprintQuest = updated.dailyQuests.find((q) => q.id === 'quest-sprint');
    expect(sprintQuest?.completed).toBe(true);
    expect(sprintQuest?.currentCount).toBe(1);
  });

  it('records Sprint Duel defeat with negative ELO delta without breaking floor', () => {
    const initialRating = usePlaygroundStore.getState().brainRating;

    const result = usePlaygroundStore.getState().recordMatch({
      gameType: 'sprint_duel',
      score: 6,
      opponentScore: 15,
      isWin: false,
      durationSeconds: 60,
      xpEarned: 40,
    });

    expect(result.ratingDelta).toBeLessThan(0);
    const updated = usePlaygroundStore.getState();
    expect(updated.brainRating).toBe(initialRating + result.ratingDelta);
    expect(updated.brainRating).toBeGreaterThanOrEqual(800);
  });

  it('records Queens territory logic puzzle solve and updates high score', () => {
    const result = usePlaygroundStore.getState().recordMatch({
      gameType: 'queens',
      score: 1,
      isWin: true,
      durationSeconds: 120,
      xpEarned: 120,
    });

    expect(result.ratingDelta).toBe(20);
    const updated = usePlaygroundStore.getState();
    expect(updated.highScores.queens).toBe(1);

    const queensQuest = updated.dailyQuests.find((q) => q.id === 'quest-queens');
    expect(queensQuest?.completed).toBe(true);
  });

  it('records Tango Sun & Moon binary puzzle solve', () => {
    usePlaygroundStore.getState().recordMatch({
      gameType: 'tango',
      score: 1,
      isWin: true,
      durationSeconds: 95,
      xpEarned: 120,
    });

    const updated = usePlaygroundStore.getState();
    const tangoQuest = updated.dailyQuests.find((q) => q.id === 'quest-tango');
    expect(tangoQuest?.completed).toBe(true);
  });

  it('toggles sound and haptics preferences in store', () => {
    const store = usePlaygroundStore.getState();
    expect(store.soundEnabled).toBe(true);
    expect(store.hapticsEnabled).toBe(true);

    store.toggleSound();
    expect(usePlaygroundStore.getState().soundEnabled).toBe(false);

    store.toggleHaptics();
    expect(usePlaygroundStore.getState().hapticsEnabled).toBe(false);
  });
});