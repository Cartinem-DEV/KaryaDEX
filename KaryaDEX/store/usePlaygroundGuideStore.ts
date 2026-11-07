/**
 * KaryaDEX — Playground Guide & Tutorial Store
 *
 * Manages player tutorial progression, first-time guide presentation,
 * dismissal persistence, and practice mode isolation.
 * Scoped safely per account/guest to prevent multi-profile state pollution.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlaygroundGameType } from '@/types/playground';
import type { GameTutorialUserState } from '@/lib/playground/tutorials/guideTypes';

interface PlaygroundGuideStoreState {
  currentUserId: string;
  activeUserId: string;
  completedTutorials: string[];
  // Map of userId -> Record<PlaygroundGameType, GameTutorialUserState>
  userTutorialStates: Record<string, Record<string, GameTutorialUserState>>;
  practiceModes: Record<string, boolean>; // gameType -> isPractice

  // Actions
  setUserId: (userId: string | null) => void;
  isTutorialCompleted: (gameType: PlaygroundGameType) => boolean;
  isTutorialDismissed: (gameType: PlaygroundGameType) => boolean;
  markTutorialCompleted: (gameType: PlaygroundGameType) => void;
  dismissTutorial: (gameType: PlaygroundGameType) => void;
  resetTutorial: (gameType: PlaygroundGameType) => void;
  setPracticeMode: (gameType: PlaygroundGameType, enabled: boolean) => void;
  isPracticeMode: (gameType: PlaygroundGameType) => boolean;
  resetAllForTesting: () => void;
}

const DEFAULT_GUEST_ID = 'guest';

const INITIAL_GAME_STATE: GameTutorialUserState = {
  completed: false,
  dismissed: false,
};

export const usePlaygroundGuideStore = create<PlaygroundGuideStoreState>()(
  persist(
    (set, get) => ({
      currentUserId: DEFAULT_GUEST_ID,
      activeUserId: DEFAULT_GUEST_ID,
      completedTutorials: [],
      userTutorialStates: {},
      practiceModes: {},

      setUserId: (userId) => {
        const id = userId || DEFAULT_GUEST_ID;
        const currentForUser = get().userTutorialStates[id] || {};
        const completed = Object.entries(currentForUser)
          .filter(([_, state]) => state.completed)
          .map(([gameType]) => gameType);

        set({
          currentUserId: id,
          activeUserId: id,
          completedTutorials: completed,
        });
      },

      isTutorialCompleted: (gameType) => {
        const { currentUserId, userTutorialStates, completedTutorials } = get();
        const userState = userTutorialStates[currentUserId];
        if (userState?.[gameType] !== undefined) {
          return userState[gameType].completed;
        }
        return (completedTutorials || []).includes(gameType);
      },

      isTutorialDismissed: (gameType) => {
        const { currentUserId, userTutorialStates } = get();
        const userState = userTutorialStates[currentUserId];
        return userState?.[gameType]?.dismissed ?? false;
      },

      markTutorialCompleted: (gameType) => {
        const { currentUserId, userTutorialStates, completedTutorials } = get();
        const currentForUser = userTutorialStates[currentUserId] || {};
        const updatedGame = {
          ...(currentForUser[gameType] || INITIAL_GAME_STATE),
          completed: true,
          dismissed: true,
          completedAt: new Date().toISOString(),
        };

        const updatedTutorials = Array.from(new Set([...(completedTutorials || []), gameType]));

        set({
          completedTutorials: updatedTutorials,
          userTutorialStates: {
            ...userTutorialStates,
            [currentUserId]: {
              ...currentForUser,
              [gameType]: updatedGame,
            },
          },
        });
      },

      dismissTutorial: (gameType) => {
        const { currentUserId, userTutorialStates } = get();
        const currentForUser = userTutorialStates[currentUserId] || {};
        const updatedGame = {
          ...(currentForUser[gameType] || INITIAL_GAME_STATE),
          dismissed: true,
        };

        set({
          userTutorialStates: {
            ...userTutorialStates,
            [currentUserId]: {
              ...currentForUser,
              [gameType]: updatedGame,
            },
          },
        });
      },

      resetTutorial: (gameType) => {
        const { currentUserId, userTutorialStates, completedTutorials } = get();
        const currentForUser = userTutorialStates[currentUserId] || {};
        const updatedGame = {
          completed: false,
          dismissed: false,
        };

        set({
          completedTutorials: (completedTutorials || []).filter((g) => g !== gameType),
          userTutorialStates: {
            ...userTutorialStates,
            [currentUserId]: {
              ...currentForUser,
              [gameType]: updatedGame,
            },
          },
        });
      },

      setPracticeMode: (gameType, enabled) => {
        set((state) => ({
          practiceModes: {
            ...state.practiceModes,
            [gameType]: enabled,
          },
        }));
      },

      isPracticeMode: (gameType) => {
        return get().practiceModes[gameType] ?? false;
      },

      resetAllForTesting: () => {
        set({
          currentUserId: DEFAULT_GUEST_ID,
          activeUserId: DEFAULT_GUEST_ID,
          completedTutorials: [],
          userTutorialStates: {},
          practiceModes: {},
        });
      },
    }),
    {
      name: 'karyadex_playground_guides',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
