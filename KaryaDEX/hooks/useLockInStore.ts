/**
 * KaryaDEX — Lockin Zustand Store
 *
 * Global state management for LOCKIN focus timer feature.
 * Manages sessions, streaks, presets, and timer state with persistence.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lockinStorage } from '@/services/lockin/lockinStorage';
import { lockinTimerService, TimerState } from '@/services/lockin/lockinTimerService';
import type { LockinSession, LockinStreak, LockinExamPreset, LockinSessionStatus, LockinBlockedApp, LockinYtChannel, LockinBreakSession, LockinBreakType } from '@/types/lockin';
import { AuthService } from '@/services/auth/authService';
import { LockinModule } from 'expo-module-lockin';

interface LockinState {
  // Current session state (synced with timer service)
  currentSession: LockinSession | null;
  timerState: TimerState;

  // Session history
  sessions: LockinSession[];
  sessionsLoading: boolean;

  // Streaks
  streaks: Record<string, LockinStreak>; // key: streakType
  streaksLoading: boolean;

  // Exam presets
  presets: LockinExamPreset[];
  presetsLoading: boolean;
  defaultPreset: LockinExamPreset | null;

  // Blocked apps & whitelisted channels
  blockedApps: LockinBlockedApp[];
  blockedAppsLoading: boolean;
  whitelistedChannels: LockinYtChannel[];
  whitelistedChannelsLoading: boolean;

  // Statistics
  statistics: {
    totalSessions: number;
    totalFocusMinutes: number;
    averageFocusScore: number;
    completedSessions: number;
    abandonedSessions: number;
    sessionsByType: Record<string, number>;
    currentDailyStreak: number;
    longestDailyStreak: number;
  } | null;

  // UI state
  selectedPresetId: string | null;
  isConfigModalOpen: boolean;
  isGuidanceModalOpen: boolean;
  dndEnabled: boolean;

  // Phase 3 UI state
  isFocusPlannerOpen: boolean;
  isAppQuotaOpen: boolean;
  isRealityCheckOpen: boolean;
  isEmergencyPassOpen: boolean;


  // Actions - Session Management
  startSession: (sessionData: Omit<LockinSession, 'id' | 'createdAt' | 'updatedAt'>) => Promise<LockinSession>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  completeSession: (focusScore?: number) => Promise<LockinSession | null>;
  abandonSession: () => Promise<void>;
  loadActiveSession: () => Promise<LockinSession | null>;
  loadSessions: (userId: string, limit?: number) => Promise<void>;
  refreshCurrentSession: () => Promise<void>;

  // Actions - Streaks
  loadStreaks: (userId: string) => Promise<void>;
  updateStreakFromSession: (session: LockinSession) => Promise<void>;
  getStreak: (streakType: LockinStreak['streakType']) => LockinStreak | null;

  // Actions - Presets
  loadPresets: (userId: string) => Promise<void>;
  createPreset: (preset: Omit<LockinExamPreset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<LockinExamPreset>;
  updatePreset: (id: string, updates: Partial<LockinExamPreset>) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  setDefaultPreset: (id: string) => Promise<void>;
  initializeDefaultPresets: (userId: string) => Promise<LockinExamPreset[]>;

  // Actions - Statistics
  loadStatistics: (userId: string) => Promise<void>;

  // Actions - Blocked Apps & Whitelisted Channels
  loadBlockedApps: (userId: string) => Promise<void>;
  loadWhitelistedChannels: (userId: string) => Promise<void>;
  addBlockedApp: (packageName: string, appName: string) => Promise<void>;
  removeBlockedApp: (id: string) => Promise<void>;
  toggleBlockedApp: (id: string, isBlocked: boolean) => Promise<void>;

  // Actions - UI
  setSelectedPresetId: (id: string | null) => void;
  setConfigModalOpen: (open: boolean) => void;
  setGuidanceModalOpen: (open: boolean) => void;
  setDndEnabled: (enabled: boolean) => void;

  // Phase 3 UI actions
  setFocusPlannerOpen: (open: boolean) => void;
  setAppQuotaOpen: (open: boolean) => void;
  setRealityCheckOpen: (open: boolean) => void;
  setEmergencyPassOpen: (open: boolean) => void;

  // Authoritative LockIn Break Session (Single Source of Truth)
  activeBreak: LockinBreakSession | null;
  startBreak: (params: {
    durationSeconds: number;
    breakType?: LockinBreakType;
    sessionId?: string;
    startedAt?: number;
    metadata?: Record<string, any>;
  }) => LockinBreakSession;
  endBreak: () => void;



  // Actions - Timer Callbacks
  setupTimerCallbacks: () => void;

  // Actions - Cleanup
  reset: () => void;
  clearCurrentSession: () => void;
}

const DEFAULT_STATISTICS = {
  totalSessions: 0,
  totalFocusMinutes: 0,
  averageFocusScore: 0,
  completedSessions: 0,
  abandonedSessions: 0,
  sessionsByType: {},
  currentDailyStreak: 0,
  longestDailyStreak: 0,
};

const DEFAULT_TIMER_STATE: TimerState = {
  sessionId: null,
  status: 'abandoned',
  remainingSeconds: 0,
  plannedDurationSeconds: 0,
  elapsedSeconds: 0,
  startedAt: null,
  pausedAt: null,
  totalPausedDuration: 0,
};

export const useLockInStore = create<LockinState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSession: null,
      timerState: DEFAULT_TIMER_STATE,
      sessions: [],
      sessionsLoading: false,
      streaks: {},
      streaksLoading: false,
      presets: [],
      presetsLoading: false,
      defaultPreset: null,
      blockedApps: [],
      blockedAppsLoading: false,
      whitelistedChannels: [],
      whitelistedChannelsLoading: false,
      statistics: null,
      selectedPresetId: null,
      isConfigModalOpen: false,
      isGuidanceModalOpen: false,
      dndEnabled: false,
      isFocusPlannerOpen: false,
      isAppQuotaOpen: false,
      isRealityCheckOpen: false,
      isEmergencyPassOpen: false,
      activeBreak: null,

      // ─── Session Management ──────────────────────────────────────────

      startSession: async (sessionData) => {
        const user = AuthService.getInstance().getCurrentUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        const session = await lockinStorage.createSession({
          ...sessionData,
          userId: user.id,
        });

        set({ currentSession: session });

        // Load blocked apps and whitelisted channels for native module
        await Promise.all([
          get().loadBlockedApps(user.id),
          get().loadWhitelistedChannels(user.id),
        ]);

        // Sync blocked packages and whitelisted channels to timer service
        lockinTimerService.setBlockedPackages(get().blockedApps.filter(a => a.isBlocked).map(a => a.packageName));
        lockinTimerService.setWhitelistedYtChannels(get().whitelistedChannels.filter(c => c.isWhitelisted).map(c => c.channelId));

        // Start the timer service
        await lockinTimerService.startSession(session, {
          onTick: (remaining) => {
            set((state) => ({
              timerState: { ...state.timerState, remainingSeconds: remaining },
            }));
          },
          onComplete: (completedSession) => {
            set({
              currentSession: completedSession,
              timerState: { ...DEFAULT_TIMER_STATE, sessionId: completedSession.id, status: 'completed' },
            });
            get().loadSessions(user.id);
            get().loadStreaks(user.id);
            get().loadStatistics(user.id);
          },
          onPause: () => {
            set((state) => ({
              timerState: { ...state.timerState, status: 'paused' },
            }));
          },
          onResume: () => {
            set((state) => ({
              timerState: { ...state.timerState, status: 'active' },
            }));
          },
          onAbandon: () => {
            set({
              currentSession: null,
              timerState: DEFAULT_TIMER_STATE,
            });
            get().loadSessions(user.id);
            get().loadStatistics(user.id);
          },
        });

        return session;
      },

      pauseSession: async () => {
        await lockinTimerService.pauseSession();
        set((state) => ({
          timerState: { ...state.timerState, status: 'paused' },
        }));

        const session = get().currentSession;
        if (session) {
          const updated = await lockinStorage.getSessionById(session.id);
          if (updated) {
            set({ currentSession: updated });
          }
        }
      },

      resumeSession: async () => {
        await lockinTimerService.resumeSession();
        set((state) => ({
          timerState: { ...state.timerState, status: 'active' },
        }));

        const session = get().currentSession;
        if (session) {
          const updated = await lockinStorage.getSessionById(session.id);
          if (updated) {
            set({ currentSession: updated });
          }
        }
      },

      completeSession: async (focusScore = 100) => {
        const completed = await lockinTimerService.completeSession(focusScore);

        const user = AuthService.getInstance().getCurrentUser();
        if (user && completed) {
          await get().loadSessions(user.id);
          await get().loadStreaks(user.id);
          await get().loadStatistics(user.id);
        }

        set({
          currentSession: completed,
          timerState: { ...DEFAULT_TIMER_STATE, sessionId: completed?.id || null, status: 'completed' },
        });

        return completed;
      },

      startBreak: (params) => {
        const startedAt = params.startedAt ?? Date.now();
        const durationSeconds = Math.max(1, Math.floor(params.durationSeconds));
        const breakDeadlineTimestamp = startedAt + durationSeconds * 1000;
        const sessionId = params.sessionId ?? get().currentSession?.id ?? `break-${Date.now()}`;

        const breakSession: LockinBreakSession = {
          sessionId,
          breakType: params.breakType ?? 'short_break',
          startedAt,
          breakDurationSeconds: durationSeconds,
          breakDeadlineTimestamp,
          isBreakActive: true,
          metadata: params.metadata,
        };

        set({ activeBreak: breakSession });
        return breakSession;
      },

      endBreak: () => {
        set({ activeBreak: null });
      },

      abandonSession: async () => {
        await lockinTimerService.abandonSession();

        const user = AuthService.getInstance().getCurrentUser();
        if (user) {
          await get().loadSessions(user.id);
          await get().loadStatistics(user.id);
        }

        set({
          currentSession: null,
          timerState: DEFAULT_TIMER_STATE,
          activeBreak: null,
        });
      },

      loadActiveSession: async () => {
        const user = AuthService.getInstance().getCurrentUser();
        if (!user) return null;

        const activeSessions = await lockinStorage.getActiveSessions(user.id);
        if (activeSessions.length > 0) {
          const session = activeSessions[0];
          set({ currentSession: session });

          // Restore timer state
          await lockinTimerService.restoreSession(session);
          const timerState = await lockinTimerService.getState();
          set({ timerState });

          // Load blocked apps and whitelisted channels for native module
          await Promise.all([
            get().loadBlockedApps(user.id),
            get().loadWhitelistedChannels(user.id),
          ]);

          // Setup callbacks if timer is active
          if (timerState.status === 'active') {
            get().setupTimerCallbacks();
          }

          return session;
        }

        // Still load blocked apps and channels even if no active session
        await Promise.all([
          get().loadBlockedApps(user.id),
          get().loadWhitelistedChannels(user.id),
        ]);

        return null;
      },

      loadSessions: async (userId: string, limit = 50) => {
        set({ sessionsLoading: true });
        try {
          const sessions = await lockinStorage.getSessionsByUser(userId, limit);
          set({ sessions, sessionsLoading: false });
        } catch (error) {
          console.warn('[useLockInStore] Failed to load sessions:', error);
          set({ sessionsLoading: false });
        }
      },

      refreshCurrentSession: async () => {
        const session = get().currentSession;
        if (!session) return;

        const updated = await lockinStorage.getSessionById(session.id);
        if (updated) {
          set({ currentSession: updated });
        }
      },

      // ─── Streak Management ──────────────────────────────────────────

      loadStreaks: async (userId: string) => {
        set({ streaksLoading: true });
        try {
          const streaks = await lockinStorage.getAllStreaks(userId);
          const streaksMap: Record<string, LockinStreak> = {};
          for (const streak of streaks) {
            streaksMap[streak.streakType] = streak;
          }
          set({ streaks: streaksMap, streaksLoading: false });
        } catch (error) {
          console.warn('[useLockInStore] Failed to load streaks:', error);
          set({ streaksLoading: false });
        }
      },

      updateStreakFromSession: async (session: LockinSession) => {
        const user = AuthService.getInstance().getCurrentUser();
        if (!user) return;

        try {
          // Update daily streak
          const dailyStreak = await lockinStorage.updateStreakFromSession(user.id, session, 'daily');
          // Update weekly streak
          const weeklyStreak = await lockinStorage.updateStreakFromSession(user.id, session, 'weekly');
          // Update monthly streak
          const monthlyStreak = await lockinStorage.updateStreakFromSession(user.id, session, 'monthly');

          set((state) => ({
            streaks: {
              ...state.streaks,
              daily: dailyStreak,
              weekly: weeklyStreak,
              monthly: monthlyStreak,
            },
          }));
        } catch (error) {
          console.warn('[useLockInStore] Failed to update streaks:', error);
        }
      },

      getStreak: (streakType) => {
        return get().streaks[streakType] || null;
      },

      // ─── Preset Management ──────────────────────────────────────────

      loadPresets: async (userId: string) => {
        set({ presetsLoading: true });
        try {
          const presets = await lockinStorage.getExamPresetsByUser(userId);
          const defaultPreset = await lockinStorage.getDefaultExamPreset(userId);
          set({ presets, defaultPreset, presetsLoading: false });

          if (defaultPreset && !get().selectedPresetId) {
            set({ selectedPresetId: defaultPreset.id });
          }

          // Load blocked apps and whitelisted channels
          await Promise.all([
            get().loadBlockedApps(userId),
            get().loadWhitelistedChannels(userId),
          ]);
        } catch (error) {
          console.warn('[useLockInStore] Failed to load presets:', error);
          set({ presetsLoading: false });
        }
      },

      createPreset: async (presetData) => {
        const user = AuthService.getInstance().getCurrentUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        const preset = await lockinStorage.createExamPreset({
          ...presetData,
          userId: user.id,
        });

        set((state) => ({
          presets: [preset, ...state.presets],
          defaultPreset: preset.isDefault ? preset : state.defaultPreset,
        }));

        return preset;
      },

      updatePreset: async (id: string, updates: Partial<LockinExamPreset>) => {
        await lockinStorage.updateExamPreset(id, updates);

        set((state) => ({
          presets: state.presets.map((p) => (p.id === id ? { ...p, ...updates } : p)),
          defaultPreset: state.defaultPreset?.id === id ? { ...state.defaultPreset, ...updates } : state.defaultPreset,
        }));
      },

      deletePreset: async (id: string) => {
        await lockinStorage.deleteExamPreset(id);

        set((state) => ({
          presets: state.presets.filter((p) => p.id !== id),
          defaultPreset: state.defaultPreset?.id === id ? null : state.defaultPreset,
          selectedPresetId: state.selectedPresetId === id ? null : state.selectedPresetId,
        }));
      },

      setDefaultPreset: async (id: string) => {
        await lockinStorage.updateExamPreset(id, { isDefault: true });

        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === id ? { ...p, isDefault: true } : { ...p, isDefault: false }
          ),
          defaultPreset: state.presets.find((p) => p.id === id) || null,
          selectedPresetId: id,
        }));
      },

      initializeDefaultPresets: async (userId: string) => {
        const presets = await lockinStorage.initializeDefaultPresets(userId);
        const defaultPreset = presets.find((p) => p.isDefault) || presets[0] || null;

        set({ presets, defaultPreset });

        if (defaultPreset) {
          set({ selectedPresetId: defaultPreset.id });
        }

        return presets;
      },

      // ─── Statistics ──────────────────────────────────────────────────

      loadStatistics: async (userId: string) => {
        try {
          const stats = await lockinStorage.getUserStatistics(userId);
          set({ statistics: stats });
        } catch (error) {
          console.warn('[useLockInStore] Failed to load statistics:', error);
          set({ statistics: DEFAULT_STATISTICS });
        }
      },

      // ─── Blocked Apps & Whitelisted Channels ───────────────────────────

      loadBlockedApps: async (userId: string) => {
        set({ blockedAppsLoading: true });
        try {
          const apps = await lockinStorage.getBlockedApps(userId);
          set({ blockedApps: apps, blockedAppsLoading: false });
        } catch (error) {
          console.warn('[useLockInStore] Failed to load blocked apps:', error);
          set({ blockedAppsLoading: false });
        }
      },

      loadWhitelistedChannels: async (userId: string) => {
        set({ whitelistedChannelsLoading: true });
        try {
          const channels = await lockinStorage.getYtChannels(userId);
          set({ whitelistedChannels: channels, whitelistedChannelsLoading: false });
        } catch (error) {
          console.warn('[useLockInStore] Failed to load whitelisted channels:', error);
          set({ whitelistedChannelsLoading: false });
        }
      },

      // ─── Blocked Apps CRUD ────────────────────────────────────────────

      addBlockedApp: async (packageName: string, appName: string) => {
        const user = AuthService.getInstance().getCurrentUser();
        if (!user) throw new Error('User not authenticated');

        const app = await lockinStorage.createBlockedApp({
          userId: user.id,
          packageName,
          appName,
          isBlocked: true,
        });

        set((state) => ({
          blockedApps: [app, ...state.blockedApps],
        }));

        // Sync to native module after state update
        if (typeof LockinModule?.addBlockedPackages === 'function') {
          const blockedApps = get().blockedApps.filter((a) => a.isBlocked);
          try {
            const res = LockinModule.addBlockedPackages(blockedApps.map((a) => a.packageName));
            if (res && typeof (res as any).catch === 'function') {
              (res as any).catch((err: any) => console.warn('[useLockInStore] Failed to sync blocked packages:', err));
            }
          } catch (err) {
            console.warn('[useLockInStore] Failed to sync blocked packages:', err);
          }
        }
      },

      removeBlockedApp: async (id: string) => {
        await lockinStorage.deleteBlockedApp(id);

        set((state) => ({
          blockedApps: state.blockedApps.filter((a) => a.id !== id),
        }));

        // Sync to native module after state update
        if (typeof LockinModule?.addBlockedPackages === 'function') {
          const blockedApps = get().blockedApps.filter((a) => a.isBlocked);
          try {
            const res = LockinModule.addBlockedPackages(blockedApps.map((a) => a.packageName));
            if (res && typeof (res as any).catch === 'function') {
              (res as any).catch((err: any) => console.warn('[useLockInStore] Failed to sync blocked packages:', err));
            }
          } catch (err) {
            console.warn('[useLockInStore] Failed to sync blocked packages:', err);
          }
        }
      },

      toggleBlockedApp: async (id: string, isBlocked: boolean) => {
        await lockinStorage.updateBlockedApp(id, { isBlocked });

        set((state) => ({
          blockedApps: state.blockedApps.map((a) =>
            a.id === id ? { ...a, isBlocked } : a
          ),
        }));

        // Sync to native module
        if (typeof LockinModule?.addBlockedPackages === 'function') {
          const packageNames = get().blockedApps.filter((a) => a.isBlocked).map((a) => a.packageName);
          try {
            const res = LockinModule.addBlockedPackages(packageNames);
            if (res && typeof (res as any).catch === 'function') {
              (res as any).catch((err: any) => console.warn('[useLockInStore] Failed to sync blocked packages:', err));
            }
          } catch (err) {
            console.warn('[useLockInStore] Failed to sync blocked packages:', err);
          }
        }
      },

      // ─── UI Actions ──────────────────────────────────────────────────

      setSelectedPresetId: (id) => set({ selectedPresetId: id }),
      setConfigModalOpen: (open) => set({ isConfigModalOpen: open }),
      setGuidanceModalOpen: (open) => set({ isGuidanceModalOpen: open }),
      setDndEnabled: (enabled) => set({ dndEnabled: enabled }),

      // Phase 3 UI actions
      setFocusPlannerOpen: (open) => set({ isFocusPlannerOpen: open }),
      setAppQuotaOpen: (open) => set({ isAppQuotaOpen: open }),
      setRealityCheckOpen: (open) => set({ isRealityCheckOpen: open }),
      setEmergencyPassOpen: (open) => set({ isEmergencyPassOpen: open }),

      // ─── Timer Callbacks Setup ──────────────────────────────────────

      setupTimerCallbacks: () => {
        lockinTimerService.setCallbacks({
          onTick: (remaining) => {
            set((state) => ({
              timerState: { ...state.timerState, remainingSeconds: remaining },
            }));
          },
          onComplete: async (completedSession) => {
            set({
              currentSession: completedSession,
              timerState: { ...DEFAULT_TIMER_STATE, sessionId: completedSession.id, status: 'completed' },
            });

            const user = AuthService.getInstance().getCurrentUser();
            if (user) {
              await get().loadSessions(user.id);
              await get().loadStreaks(user.id);
              await get().loadStatistics(user.id);
            }
          },
          onPause: () => {
            set((state) => ({
              timerState: { ...state.timerState, status: 'paused' },
            }));
          },
          onResume: () => {
            set((state) => ({
              timerState: { ...state.timerState, status: 'active' },
            }));
          },
          onAbandon: async () => {
            set({
              currentSession: null,
              timerState: DEFAULT_TIMER_STATE,
            });

            const user = AuthService.getInstance().getCurrentUser();
            if (user) {
              await get().loadSessions(user.id);
              await get().loadStatistics(user.id);
            }
          },
        });
      },

      // ─── Cleanup ─────────────────────────────────────────────────────

      reset: () => {
        lockinTimerService.cleanup();
        set({
          currentSession: null,
          timerState: DEFAULT_TIMER_STATE,
          activeBreak: null,
          sessions: [],
          sessionsLoading: false,
          streaks: {},
          streaksLoading: false,
          presets: [],
          presetsLoading: false,
          defaultPreset: null,
          statistics: null,
          selectedPresetId: null,
          isConfigModalOpen: false,
          isGuidanceModalOpen: false,
        });
      },

      clearCurrentSession: () => {
        set({ currentSession: null, timerState: DEFAULT_TIMER_STATE });
      },
    }),
    {
      name: 'lockin-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist UI state, not session data
      partialize: (state) => ({
        selectedPresetId: state.selectedPresetId,
        isConfigModalOpen: state.isConfigModalOpen,
        isGuidanceModalOpen: state.isGuidanceModalOpen,
        dndEnabled: state.dndEnabled,
      }),
    }
  )
);