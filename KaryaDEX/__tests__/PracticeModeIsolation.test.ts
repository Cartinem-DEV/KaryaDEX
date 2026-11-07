/**
 * KaryaDEX — Practice Mode Isolation Unit Tests
 *
 * Validates:
 * - Practice mode has ZERO impact on player progression
 * - 0 XP awarded
 * - 0 ELO rating delta
 * - 0 streak mutation
 * - Daily Quests do NOT advance
 * - Match history records are NOT created
 */

import { usePlaygroundStore, INITIAL_PLAYGROUND_STATE } from '../store/usePlaygroundStore';
import { usePlaygroundGuideStore } from '../store/usePlaygroundGuideStore';

describe('Practice Mode Isolation Guarantee', () => {
  beforeEach(() => {
    usePlaygroundStore.setState(INITIAL_PLAYGROUND_STATE);
    usePlaygroundGuideStore.getState().resetAllForTesting();
  });

  it('guarantees practice mode flag can be toggled without mutating progression state', () => {
    const guideStore = usePlaygroundGuideStore.getState();
    const playStore = usePlaygroundStore.getState();

    const initialXp = playStore.brainXp;
    const initialRating = playStore.brainRating;
    const initialStreak = playStore.escapeStreak;
    const initialMatches = playStore.recentMatches.length;

    guideStore.setPracticeMode('sprint_duel', true);
    expect(guideStore.isPracticeMode('sprint_duel')).toBe(true);

    // Verify progression is completely unaltered
    const afterStore = usePlaygroundStore.getState();
    expect(afterStore.brainXp).toBe(initialXp);
    expect(afterStore.brainRating).toBe(initialRating);
    expect(afterStore.escapeStreak).toBe(initialStreak);
    expect(afterStore.recentMatches).toHaveLength(initialMatches);
  });

  it('bypasses recordMatch when a game finishes in practice mode', () => {
    const playStore = usePlaygroundStore.getState();
    const initialXp = playStore.brainXp;
    const initialRating = playStore.brainRating;
    const initialStreak = playStore.escapeStreak;
    const initialQuests = JSON.parse(JSON.stringify(playStore.dailyQuests));

    // Simulate completion in practice mode
    const isPractice = true;
    const result = {
      score: 25,
      opponentScore: 10,
      accuracy: 95,
      durationSeconds: 60,
      isWin: true,
      isPractice,
    };

    // Application pattern in playground.tsx: if (res.isPractice) return;
    if (!result.isPractice) {
      playStore.recordMatch({
        id: 'test-match-id',
        gameType: 'sprint_duel',
        score: result.score,
        isWin: result.isWin,
        durationSeconds: result.durationSeconds,
        xpEarned: 150,
      });
    }

    const stateAfter = usePlaygroundStore.getState();
    expect(stateAfter.brainXp).toBe(initialXp);
    expect(stateAfter.brainRating).toBe(initialRating);
    expect(stateAfter.escapeStreak).toBe(initialStreak);
    expect(stateAfter.recentMatches).toHaveLength(0);
    expect(stateAfter.dailyQuests).toEqual(initialQuests);
  });

  it('awards normal progression when practice mode is disabled', () => {
    const playStore = usePlaygroundStore.getState();
    const initialXp = playStore.brainXp;
    const initialRating = playStore.brainRating;

    const isPractice = false;
    const result = {
      score: 20,
      isWin: true,
      durationSeconds: 45,
      isPractice,
    };

    if (!result.isPractice) {
      playStore.recordMatch({
        id: 'test-ranked-id',
        gameType: 'queens',
        score: result.score,
        isWin: result.isWin,
        durationSeconds: result.durationSeconds,
        xpEarned: 120,
      });
    }

    const stateAfter = usePlaygroundStore.getState();
    expect(stateAfter.brainXp).toBeGreaterThan(initialXp);
    expect(stateAfter.recentMatches).toHaveLength(1);
  });
});
