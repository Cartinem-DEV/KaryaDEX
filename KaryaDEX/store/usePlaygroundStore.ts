/**
 * KaryaDEX — Playground Store
 *
 * Dedicated global state store for the Playground feature.
 * Tracks Streak, Brain ELO rating, XP, Match History, and Daily Quests.
 * Features account-scoped persistence (guest vs user:<id>), race-condition-safe
 * hydration, and explicit guest progress claiming (Phase PG-3A).
 */

import { create } from 'zustand';
import type {
  PlaygroundGameType,
  MatchRecord,
  DailyQuest,
  BrainRank,
  PlayerScope,
  PlaygroundProfileData,
  ConflictResolutionOption,
  GuestClaimPromptData,
  ClaimResult,
} from '@/types/playground';
import {
  createDefaultProfileData,
  readProfileFromStorage,
  writeProfileToStorage,
  sanitizeProfileData,
} from '@/lib/playground/identity/playgroundStorage';
import { executeGuestClaim } from '@/lib/playground/identity/playgroundClaimManager';
import { lockinPlaygroundBridge } from '@/lib/lockin/lockinPlaygroundBridge';

export const BRAIN_RANKS: BrainRank[] = [
  { title: 'Neuron Initiate', tier: 'Bronze', minRating: 0, badgeColor: '#CD7F32' },
  { title: 'Synaptic Walker', tier: 'Silver', minRating: 1100, badgeColor: '#C0C0C0' },
  { title: 'Dopamine Master', tier: 'Gold', minRating: 1300, badgeColor: '#F59E0B' },
  { title: 'Logic Overlord', tier: 'Diamond', minRating: 1550, badgeColor: '#00D9FF' },
  { title: 'Quantum Mind', tier: 'Master', minRating: 1800, badgeColor: '#A855F7' },
  { title: 'Matrix Liberator', tier: 'Matrix Liberator', minRating: 2100, badgeColor: '#B1FA63' },
];

export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

import { generateDefaultQuests } from '@/lib/playground/identity/playgroundDefaults';
export { generateDefaultQuests };

export interface RecordMatchResult {
  xpEarned: number;
  questXpEarned: number;
  totalXpEarned: number;
  newRating: number;
  ratingDelta: number;
  streakUpdated: boolean;
  completedQuests: DailyQuest[];
  rejectedReason?: 'BREAK_DEADLINE_EXCEEDED' | 'STALE_BREAK_SESSION';
}

export interface PlaygroundState {
  // Identity & Hydration
  activeScope: PlayerScope;
  isHydrating: boolean;
  isHydrated: boolean;
  hydrationError: string | null;
  pendingGuestClaim: GuestClaimPromptData | null;

  // Progression Data
  brainXp: number;
  brainRating: number;
  escapeStreak: number;
  lastPlayedDate: string | null;
  totalTimeMinutes: number;
  totalMatches: number;
  highScores: Record<PlaygroundGameType, number>;
  recentMatches: MatchRecord[];
  dailyQuests: DailyQuest[];
  soundEnabled: boolean;
  hapticsEnabled: boolean;

  // Active Game Full-Screen Runtime State (Transient)
  activeGame: PlaygroundGameType | null;
  setActiveGame: (game: PlaygroundGameType | null) => void;

  // Actions
  switchScope: (scope: PlayerScope) => Promise<void>;
  setPendingGuestClaim: (data: GuestClaimPromptData | null) => void;
  resolveGuestClaim: (resolution: ConflictResolutionOption) => Promise<ClaimResult>;
  dismissGuestClaimPrompt: () => void;
  recordMatch: (match: Omit<MatchRecord, 'id' | 'date' | 'ratingDelta'> & { id?: string }) => RecordMatchResult;
  toggleSound: () => void;
  toggleHaptics: () => void;
  refreshDailyQuests: () => void;
  getRank: () => BrainRank;
  getEstimatedDoomscrollSavedMinutes: () => number;
  getTotalChallengeTimeMinutes: () => number;
  resetAllForTesting: () => void;
}

export const INITIAL_PLAYGROUND_STATE = {
  brainXp: 0,
  brainRating: 1200,
  escapeStreak: 0,
  lastPlayedDate: null as string | null,
  totalTimeMinutes: 0,
  totalMatches: 0,
  highScores: {
    sprint_duel: 0,
    queens: 0,
    tango: 0,
    mind_snap: 0,
  },
  recentMatches: [] as MatchRecord[],
  dailyQuests: generateDefaultQuests(),
  soundEnabled: true,
  hapticsEnabled: true,
};

let currentHydrationCounter = 0;

/**
 * Extracts a serializable PlaygroundProfileData snapshot from store state.
 */
function extractProfileSnapshot(state: PlaygroundState): PlaygroundProfileData {
  return {
    version: 2,
    brainXp: state.brainXp,
    brainRating: state.brainRating,
    escapeStreak: state.escapeStreak,
    lastPlayedDate: state.lastPlayedDate,
    totalTimeMinutes: state.totalTimeMinutes,
    totalMatches: state.totalMatches,
    highScores: { ...state.highScores },
    recentMatches: [...state.recentMatches],
    dailyQuests: [...state.dailyQuests],
    soundEnabled: state.soundEnabled,
    hapticsEnabled: state.hapticsEnabled,
    updatedAt: new Date().toISOString(),
  };
}

export const usePlaygroundStore = create<PlaygroundState>()((set, get) => ({
  activeScope: { type: 'guest' },
  isHydrating: false,
  isHydrated: false,
  hydrationError: null,
  pendingGuestClaim: null,
  activeGame: null,
  setActiveGame: (activeGame: PlaygroundGameType | null) => set({ activeGame }),

  ...INITIAL_PLAYGROUND_STATE,

  switchScope: async (newScope: PlayerScope) => {
    const token = ++currentHydrationCounter;

    // Immediately clear in-memory view to defaults and enter hydrating state
    // This prevents stale/previous user data from being visible during the async transition
    set({
      isHydrating: true,
      activeScope: newScope,
      hydrationError: null,
      ...INITIAL_PLAYGROUND_STATE,
      dailyQuests: generateDefaultQuests(),
    });

    try {
      const stored = await readProfileFromStorage(newScope);

      // Race-condition check: if another switch happened while reading, discard this result
      if (token !== currentHydrationCounter) {
        return;
      }

      const profile = stored ? sanitizeProfileData(stored) : createDefaultProfileData();

      set({
        brainXp: profile.brainXp,
        brainRating: profile.brainRating,
        escapeStreak: profile.escapeStreak,
        lastPlayedDate: profile.lastPlayedDate,
        totalTimeMinutes: profile.totalTimeMinutes,
        totalMatches: profile.totalMatches,
        highScores: { ...profile.highScores },
        recentMatches: [...profile.recentMatches],
        dailyQuests: profile.dailyQuests && profile.dailyQuests.length > 0 ? profile.dailyQuests : generateDefaultQuests(),
        soundEnabled: profile.soundEnabled,
        hapticsEnabled: profile.hapticsEnabled,
        isHydrating: false,
        isHydrated: true,
        hydrationError: null,
      });
    } catch (err: any) {
      if (token !== currentHydrationCounter) return;

      console.warn('[usePlaygroundStore] Failed to hydrate scope:', err);
      set({
        isHydrating: false,
        isHydrated: true,
        hydrationError: err?.message || 'Failed to load profile',
      });
    }
  },

  setPendingGuestClaim: (data) => {
    set({ pendingGuestClaim: data });
  },

  dismissGuestClaimPrompt: () => {
    set({ pendingGuestClaim: null });
  },

  resolveGuestClaim: async (resolution) => {
    const { pendingGuestClaim, activeScope } = get();
    if (!pendingGuestClaim) {
      return { success: false, resolution, error: 'no_pending_claim' };
    }

    const result = await executeGuestClaim(pendingGuestClaim.destinationUserId, resolution);
    if (result.success) {
      set({ pendingGuestClaim: null });

      // If claimed or replaced, rehydrate current scope to reflect newly claimed progress
      if (resolution === 'claim' || resolution === 'replace_account') {
        await get().switchScope(activeScope);
      }
    }
    return result;
  },

  toggleSound: () => {
    set((state) => {
      const updated = !state.soundEnabled;
      const nextState = { ...state, soundEnabled: updated };
      writeProfileToStorage(state.activeScope, extractProfileSnapshot(nextState)).catch(() => {});
      return { soundEnabled: updated };
    });
  },

  toggleHaptics: () => {
    set((state) => {
      const updated = !state.hapticsEnabled;
      const nextState = { ...state, hapticsEnabled: updated };
      writeProfileToStorage(state.activeScope, extractProfileSnapshot(nextState)).catch(() => {});
      return { hapticsEnabled: updated };
    });
  },

  refreshDailyQuests: () => {
    const today = getTodayString();
    const { lastPlayedDate, activeScope } = get();
    if (lastPlayedDate !== today) {
      const newQuests = generateDefaultQuests();
      set((state) => {
        const nextState = { ...state, dailyQuests: newQuests };
        writeProfileToStorage(activeScope, extractProfileSnapshot(nextState)).catch(() => {});
        return { dailyQuests: newQuests };
      });
    }
  },

  getRank: () => {
    const rating = get().brainRating;
    let rank = BRAIN_RANKS[0];
    for (const r of BRAIN_RANKS) {
      if (rating >= r.minRating) {
        rank = r;
      }
    }
    return rank;
  },

  getTotalChallengeTimeMinutes: () => {
    return get().totalTimeMinutes;
  },

  getEstimatedDoomscrollSavedMinutes: () => {
    return get().totalTimeMinutes;
  },

  recordMatch: (matchData) => {
    const today = getTodayString();
    const state = get();

    // Prevent duplicate match recording if a match with identical ID was already recorded
    if (matchData.id && state.recentMatches.some((m) => m.id === matchData.id)) {
      const existing = state.recentMatches.find((m) => m.id === matchData.id)!;
      return {
        xpEarned: existing.xpEarned,
        questXpEarned: 0,
        totalXpEarned: existing.xpEarned,
        newRating: state.brainRating,
        ratingDelta: existing.ratingDelta,
        streakUpdated: false,
        completedQuests: [],
      };
    }

    const isWin = typeof matchData.isWin === 'boolean' ? matchData.isWin : matchData.result === 'won';

    // 0. LockIn Break Expiry & Reward Integrity Gate
    const completionTimestamp = matchData.timestamp ?? Date.now();
    const bridgeEval = lockinPlaygroundBridge.evaluateGameCompletion(
      completionTimestamp,
      {
        xpEarned: matchData.xpEarned || (isWin ? 100 : 40),
        ratingDelta: 0,
      },
      matchData.lockinSessionId ? { sessionId: matchData.lockinSessionId } : undefined
    );

    if (!bridgeEval.valid) {
      // Break deadline was reached or exceeded, or session was stale — reject all progression rewards
      const recordId = matchData.id || `match-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const rejectedRecord: MatchRecord = {
        id: recordId,
        date: new Date(completionTimestamp).toISOString(),
        ratingDelta: 0,
        gameType: matchData.gameType,
        score: matchData.score,
        opponentScore: matchData.opponentScore,
        accuracy: matchData.accuracy,
        isWin: matchData.isWin,
        durationSeconds: matchData.durationSeconds,
        xpEarned: 0,
        isPractice: false,
        lockinSessionId: matchData.lockinSessionId,
      };

      const durationMin = Math.ceil(matchData.durationSeconds / 60);
      const nextStateFields = {
        brainXp: state.brainXp,
        brainRating: state.brainRating,
        escapeStreak: state.escapeStreak,
        totalTimeMinutes: state.totalTimeMinutes + durationMin,
        totalMatches: state.totalMatches + 1,
        highScores: { ...state.highScores },
        recentMatches: [rejectedRecord, ...state.recentMatches.slice(0, 19)],
        dailyQuests: state.dailyQuests,
      };

      set(nextStateFields);
      writeProfileToStorage(state.activeScope, extractProfileSnapshot({ ...state, ...nextStateFields })).catch(() => {});

      return {
        xpEarned: 0,
        questXpEarned: 0,
        totalXpEarned: 0,
        newRating: state.brainRating,
        ratingDelta: 0,
        streakUpdated: false,
        completedQuests: [],
        rejectedReason: bridgeEval.reason === 'STALE_BREAK_SESSION' ? 'STALE_BREAK_SESSION' : 'BREAK_DEADLINE_EXCEEDED',
      };
    }

    // 1. Calculate Rating Delta (ELO style)
    let ratingDelta = 0;
    if (matchData.gameType === 'sprint_duel') {
      ratingDelta = isWin
        ? Math.floor(15 + Math.min(15, (matchData.score || 0) / 2))
        : -Math.max(5, Math.floor(10 - (matchData.score || 0) / 3));
    } else {
      // Puzzle solves
      ratingDelta = isWin ? 20 : 0;
    }

    const newRating = Math.max(800, state.brainRating + ratingDelta);
    const matchXp = matchData.xpEarned || (isWin ? 100 : 40);

    // 2. Check Streak
    let newStreak = state.escapeStreak;
    let streakUpdated = false;
    if (state.lastPlayedDate !== today) {
      if (!state.lastPlayedDate) {
        newStreak = 1;
        streakUpdated = true;
      } else {
        const lastDate = new Date(state.lastPlayedDate);
        const currDate = new Date(today);
        const diffDays = Math.round(
          (currDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24)
        );
        if (diffDays === 1) {
          newStreak += 1;
          streakUpdated = true;
        } else if (diffDays > 1) {
          newStreak = 1;
          streakUpdated = true;
        }
      }
    }

    // 3. Update Daily Quests & Calculate Quest XP Rewards
    let newlyEarnedQuestXp = 0;
    const newlyCompletedQuests: DailyQuest[] = [];

    const updatedQuests = state.dailyQuests.map((quest) => {
      // If quest is already completed, it cannot award rewards again
      if (quest.completed) {
        return quest;
      }

      if (quest.gameType === matchData.gameType) {
        let increment = 0;
        if (quest.gameType === 'sprint_duel' && (matchData.score || 0) >= 10) increment = 1;
        else if (quest.gameType !== 'sprint_duel' && isWin) increment = 1;

        const newCount = quest.currentCount + increment;
        const isNowCompleted = newCount >= quest.targetCount;

        if (isNowCompleted) {
          newlyEarnedQuestXp += quest.xpReward;
          const completedQuest: DailyQuest = {
            ...quest,
            currentCount: newCount,
            completed: true,
          };
          newlyCompletedQuests.push(completedQuest);
          return completedQuest;
        }

        return {
          ...quest,
          currentCount: newCount,
          completed: false,
        };
      }

      return quest;
    });

    // 4. Update High Score
    const currentHigh = state.highScores[matchData.gameType] || 0;
    const newHighScore = Math.max(currentHigh, matchData.score);

    // 5. Build Record
    const recordId = matchData.id || `match-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const record: MatchRecord = {
      id: recordId,
      date: new Date().toISOString(),
      ratingDelta,
      gameType: matchData.gameType,
      score: matchData.score,
      opponentScore: matchData.opponentScore,
      accuracy: matchData.accuracy,
      isWin: matchData.isWin,
      durationSeconds: matchData.durationSeconds,
      xpEarned: matchXp,
    };

    const durationMin = Math.ceil(matchData.durationSeconds / 60);
    const totalXpToAdd = matchXp + newlyEarnedQuestXp;

    const nextStateFields = {
      brainXp: state.brainXp + totalXpToAdd,
      brainRating: newRating,
      escapeStreak: newStreak,
      lastPlayedDate: today,
      totalTimeMinutes: state.totalTimeMinutes + durationMin,
      totalMatches: state.totalMatches + 1,
      highScores: {
        ...state.highScores,
        [matchData.gameType]: newHighScore,
      },
      recentMatches: [record, ...state.recentMatches.slice(0, 19)],
      dailyQuests: updatedQuests,
    };

    set(nextStateFields);

    // Persist asynchronously to active scope storage
    const stateToPersist = {
      ...state,
      ...nextStateFields,
    };
    writeProfileToStorage(state.activeScope, extractProfileSnapshot(stateToPersist)).catch((err) => {
      console.warn('[usePlaygroundStore] Failed to persist match to storage:', err);
    });

    return {
      xpEarned: matchXp,
      questXpEarned: newlyEarnedQuestXp,
      totalXpEarned: totalXpToAdd,
      newRating,
      ratingDelta,
      streakUpdated,
      completedQuests: newlyCompletedQuests,
    };
  },

  resetAllForTesting: () => {
    set({
      activeScope: { type: 'guest' },
      isHydrating: false,
      isHydrated: false,
      hydrationError: null,
      pendingGuestClaim: null,
      activeGame: null,
      ...INITIAL_PLAYGROUND_STATE,
      dailyQuests: generateDefaultQuests(),
    });
  },
}));
