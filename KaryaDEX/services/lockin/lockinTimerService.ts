/**
 * KaryaDEX — Lockin Timer Service
 *
 * Handles timer notifications, background state management, and platform-specific
 * timer persistence for the LOCKIN focus feature.
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { createDefaultNotificationAdapter, NotificationPlatformAdapter, NotificationRequest } from '../notificationAdapter';
import { lockinStorage } from './lockinStorage';
import type { LockinSession, LockinSessionStatus } from '@/types/lockin';
import { LockinModule, StartSessionParams, BlockingSessionParams } from 'expo-module-lockin';

export interface TimerState {
  sessionId: string | null;
  status: LockinSessionStatus;
  remainingSeconds: number;
  plannedDurationSeconds: number;
  elapsedSeconds: number;
  startedAt: number | null;
  pausedAt: number | null;
  totalPausedDuration: number;
}

export interface TimerCallbacks {
  onTick?: (remainingSeconds: number) => void;
  onComplete?: (session: LockinSession) => void;
  onPause?: () => void;
  onResume?: () => void;
  onAbandon?: () => void;
  onError?: (error: Error) => void;
}

const TIMER_TICK_INTERVAL = 1000; // 1 second

export class LockinTimerService {
  private static instance: LockinTimerService;
  private adapter: NotificationPlatformAdapter;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private state: TimerState = {
    sessionId: null,
    status: 'abandoned',
    remainingSeconds: 0,
    plannedDurationSeconds: 0,
    elapsedSeconds: 0,
    startedAt: null,
    pausedAt: null,
    totalPausedDuration: 0,
  };
  private callbacks: TimerCallbacks = {};
  private appStateListener: { remove: () => void } | null = null;
  private backgroundStartTime: number | null = null;
  private isBackground = false;
  private persistenceKey = 'lockin_timer_state';
  private dndEnabled = false;
  private nativeModule: any = null;
  private blockedPackages: string[] = [];
  private whitelistedYtChannels: string[] = [];

  private constructor(adapter?: NotificationPlatformAdapter) {
    this.adapter = adapter || createDefaultNotificationAdapter();
    this.setupAppStateListener();
    this.loadPersistedState();
    if (Platform.OS === 'android') {
      this.nativeModule = LockinModule;
    }
    this.setupNativeListeners();
  }

  /**
   * Sets up native event listeners for session callbacks.
   */
  private setupNativeListeners(): void {
    if (this.nativeModule && this.nativeModule.addListener) {
      try {
        this.nativeModule.addListener('onSessionComplete', async (sessionId: string) => {
          console.log('[LockinTimerService] Native onSessionComplete fired for:', sessionId);
          if (this.state.sessionId === sessionId || !this.state.sessionId) {
            await this.completeSession(100);
          }
        });
      } catch (e) {
        console.warn('[LockinTimerService] Failed to add native session listeners:', e);
      }
    }
  }

  /**
   * Sets whether DND mode should be enabled during sessions.
   */
  public setDndEnabled(enabled: boolean): void {
    this.dndEnabled = enabled;
  }

  /**
   * Gets the current DND enabled state.
   */
  public getDndEnabled(): boolean {
    return this.dndEnabled;
  }

  /**
   * Enables DND/quiet mode for notifications.
   * Uses expo-notifications to suppress notifications during focus sessions.
   */
  private async enableDnd(): Promise<void> {
    try {
      // Request notification permissions first
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[LockinTimerService] Notification permission not granted, DND cannot be enabled');
        return;
      }

      // Native module integration for strict mode
      if (this.nativeModule) {
        try {
          await this.nativeModule.setStrictMode(this.dndEnabled ? 'soft' : 'none');
        } catch (e) {
          console.warn('[LockinTimerService] Native setStrictMode failed:', e);
        }
      }

      if (Platform.OS === 'ios') {
        // On iOS, use setNotificationHandler to suppress notifications
        // This is a workaround since iOS doesn't have a direct DND API for apps
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          }),
        });
      } else if (Platform.OS === 'android') {
        // On Android, set notification channel importance to min (0)
        await Notifications.setNotificationChannelAsync('lockin', {
          name: 'Lockin Focus Timer',
          importance: Notifications.AndroidImportance.MIN,
          vibrationPattern: [],
          lightColor: '#7C3AED',
          enableVibrate: false,
          showBadge: false,
        });
      }
    } catch (error) {
      console.warn('[LockinTimerService] Failed to enable DND:', error);
    }
  }

  /**
   * Disables DND/quiet mode, restoring normal notification behavior.
   */
  private async disableDnd(): Promise<void> {
    try {
      // Native module integration for strict mode
      if (this.nativeModule) {
        try {
          await this.nativeModule.setStrictMode('none');
        } catch (e) {
          console.warn('[LockinTimerService] Native setStrictMode failed:', e);
        }
      }

      if (Platform.OS === 'ios') {
        // On iOS, reset the notification handler to default behavior
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      } else if (Platform.OS === 'android') {
        // On Android, restore notification channel to high importance
        await Notifications.setNotificationChannelAsync('lockin', {
          name: 'Lockin Focus Timer',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#7C3AED',
          enableVibrate: true,
          showBadge: true,
        });
      }
    } catch (error) {
      console.warn('[LockinTimerService] Failed to disable DND:', error);
    }
  }

  public static getInstance(adapter?: NotificationPlatformAdapter): LockinTimerService {
    if (!LockinTimerService.instance) {
      LockinTimerService.instance = new LockinTimerService(adapter);
    }
    return LockinTimerService.instance;
  }

  public static resetInstance(): void {
    if (LockinTimerService.instance) {
      LockinTimerService.instance.cleanup();
      LockinTimerService.instance = undefined as any;
    }
  }

  /**
   * Sets the callback handlers for timer events.
   */
  public setCallbacks(callbacks: TimerCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Sets blocked packages and whitelisted channels for native blocking.
   */
  public setBlockedPackages(packages: string[]): void {
    this.blockedPackages = packages;
  }

  public setWhitelistedYtChannels(channels: string[]): void {
    this.whitelistedYtChannels = channels;
  }

  /**
   * Starts a new timer session.
   */
  public async startSession(
    session: LockinSession,
    callbacks?: TimerCallbacks
  ): Promise<void> {
    if (callbacks) {
      this.callbacks = callbacks;
    }

    // Enable DND if configured
    if (this.dndEnabled) {
      await this.enableDnd();
    }

    this.cleanupTimer();

    const plannedSeconds = session.plannedDurationMinutes * 60;
    const now = Date.now();

    this.state = {
      sessionId: session.id,
      status: 'active',
      remainingSeconds: plannedSeconds,
      plannedDurationSeconds: plannedSeconds,
      elapsedSeconds: 0,
      startedAt: now,
      pausedAt: null,
      totalPausedDuration: 0,
    };

    // Update session status in storage
    await lockinStorage.updateSession(session.id, {
      status: 'active',
      startedAt: new Date(now).toISOString(),
    });

    // Native module integration
    if (this.nativeModule) {
      const params: StartSessionParams = {
        sessionId: session.id,
        plannedDurationMinutes: session.plannedDurationMinutes,
        blockedPackages: this.blockedPackages,
        whitelistedYtChannels: this.whitelistedYtChannels,
        strictMode: this.dndEnabled ? 'soft' : 'none',
      };
      try {
        await this.nativeModule.startSession(params);
      } catch (e) {
        console.warn('[LockinTimerService] Native startSession failed, falling back to JS:', e);
      }

      // Phase 4: Start iOS Screen Time blocking session
      if (Platform.OS === 'ios' && this.blockedPackages.length > 0) {
        const blockingParams: BlockingSessionParams = {
          sessionId: session.id,
          blockedPackages: this.blockedPackages,
          strictMode: this.dndEnabled ? 'soft' : 'none',
        };
        try {
          await this.nativeModule.startBlockingSession(blockingParams);
        } catch (e) {
          console.warn('[LockinTimerService] Native startBlockingSession failed:', e);
        }
      }
    }

    this.persistState();
    this.startTimer();
  }

  /**
   * Pauses the current timer session.
   */
  public async pauseSession(): Promise<void> {
    // Disable DND on session pause
    await this.disableDnd();

    if (this.state.status !== 'active' || !this.state.sessionId) {
      return;
    }

    const now = Date.now();
    const elapsed = now - (this.state.startedAt || now) - this.state.totalPausedDuration;

    this.state = {
      ...this.state,
      status: 'paused',
      remainingSeconds: this.state.remainingSeconds,
      elapsedSeconds: elapsed,
      pausedAt: now,
    };

    const sessionId = this.state.sessionId!;
    // Update session in storage
    await lockinStorage.updateSession(sessionId, {
      status: 'paused',
      pausedAt: new Date(now).toISOString(),
      actualDurationMinutes: Math.round(elapsed / 60000),
    });

    // Native module integration
    if (this.nativeModule) {
      try {
        await this.nativeModule.pauseSession();
      } catch (e) {
        console.warn('[LockinTimerService] Native pauseSession failed:', e);
      }
    }

    this.cleanupTimer();
    this.persistState();
    this.callbacks.onPause?.();
  }

  /**
   * Resumes a paused timer session.
   */
  public async resumeSession(): Promise<void> {
    if (this.state.status !== 'paused' || !this.state.sessionId) {
      return;
    }

    const now = Date.now();
    const pausedDuration = this.state.pausedAt ? now - this.state.pausedAt : 0;

    this.state = {
      ...this.state,
      status: 'active',
      pausedAt: null,
      totalPausedDuration: this.state.totalPausedDuration + pausedDuration,
    };

    const sessionId = this.state.sessionId!;
    // Update session in storage
    await lockinStorage.updateSession(sessionId, {
      status: 'active',
      resumedAt: new Date(now).toISOString(),
    });

    // Native module integration
    if (this.nativeModule) {
      try {
        await this.nativeModule.resumeSession();
      } catch (e) {
        console.warn('[LockinTimerService] Native resumeSession failed:', e);
      }
    }

    this.persistState();
    this.startTimer();
    this.callbacks.onResume?.();
  }

  /**
   * Completes the current timer session.
   */
  public async completeSession(focusScore = 100): Promise<LockinSession | null> {
    // Disable DND on session completion
    await this.disableDnd();

    if (!this.state.sessionId) {
      return null;
    }

    const now = Date.now();
    const actualDurationMs = now - (this.state.startedAt || now) - this.state.totalPausedDuration;
    const actualDurationMinutes = Math.max(1, Math.round(actualDurationMs / 60000));

    this.cleanupTimer();

    // Native module integration
    if (this.nativeModule) {
      try {
        await this.nativeModule.endSession();
      } catch (e) {
        console.warn('[LockinTimerService] Native endSession failed:', e);
      }

      // Phase 4: End iOS Screen Time blocking session
      if (Platform.OS === 'ios') {
        try {
          await this.nativeModule.endBlockingSession();
        } catch (e) {
          console.warn('[LockinTimerService] Native endBlockingSession failed:', e);
        }
      }
    }

    // Update session in storage
    const updatedSession = await lockinStorage.updateSession(this.state.sessionId, {
      status: 'completed',
      actualDurationMinutes,
      focusScore,
      completedAt: new Date(now).toISOString(),
    }).then(() => lockinStorage.getSessionById(this.state.sessionId!));

    this.state = {
      ...this.state,
      status: 'completed',
      remainingSeconds: 0,
      elapsedSeconds: actualDurationMs,
    };

    this.persistState();
    this.callbacks.onComplete?.(updatedSession!);

    // Schedule completion notification
    const session = await lockinStorage.getSessionById(this.state.sessionId!);
    if (session) {
      await this.scheduleCompletionNotification(session);
    }

    return updatedSession;
  }

  /**
   * Abandons the current timer session.
   */
  public async abandonSession(): Promise<void> {
    // Disable DND on session abandonment
    await this.disableDnd();

    if (!this.state.sessionId) {
      return;
    }

    const now = Date.now();
    const actualDurationMs = now - (this.state.startedAt || now) - this.state.totalPausedDuration;
    const actualDurationMinutes = Math.max(0, Math.round(actualDurationMs / 60000));

    this.cleanupTimer();

    // Native module integration
    if (this.nativeModule) {
      try {
        await this.nativeModule.endSession();
      } catch (e) {
        console.warn('[LockinTimerService] Native endSession failed:', e);
      }

      // Phase 4: End iOS Screen Time blocking session
      if (Platform.OS === 'ios') {
        try {
          await this.nativeModule.endBlockingSession();
        } catch (e) {
          console.warn('[LockinTimerService] Native endBlockingSession failed:', e);
        }
      }
    }

    // Update session in storage
    await lockinStorage.updateSession(this.state.sessionId, {
      status: 'abandoned',
      actualDurationMinutes,
      abandonedAt: new Date(now).toISOString(),
    });

    this.state = {
      ...this.state,
      status: 'abandoned',
      remainingSeconds: 0,
      elapsedSeconds: actualDurationMs,
    };

    this.persistState();
    this.callbacks.onAbandon?.();
  }

  /**
   * Gets the current timer state.
   */
  public async getState(): Promise<Readonly<TimerState>> {
    if (this.nativeModule) {
      try {
        const nativeState = await this.nativeModule.getSessionState();
        if (nativeState && nativeState.isActive) {
          this.state.remainingSeconds = nativeState.remainingSeconds || this.state.remainingSeconds;
          this.state.status = nativeState.isActive ? 'active' : this.state.status;
        }
      } catch (e) {
        console.warn('[LockinTimerService] Native getSessionState failed:', e);
      }
    }
    return { ...this.state };
  }

  /**
   * Checks if a timer is currently running.
   */
  public isRunning(): boolean {
    return this.state.status === 'active' && this.timerInterval !== null;
  }

  /**
   * Gets the current session ID if any.
   */
  public getSessionId(): string | null {
    return this.state.sessionId;
  }

  /**
   * Restores a timer from persisted state (e.g., after app restart).
   */
  public async restoreSession(session: LockinSession): Promise<void> {
    const now = Date.now();
    const startedAt = new Date(session.startedAt).getTime();

    let elapsed = now - startedAt;
    if (session.pausedAt) {
      const pausedAt = new Date(session.pausedAt).getTime();
      if (session.resumedAt) {
        const resumedAt = new Date(session.resumedAt).getTime();
        elapsed -= resumedAt - pausedAt;
      } else {
        elapsed -= now - pausedAt;
      }
    }

    const elapsedSeconds = Math.max(0, Math.floor(elapsed / 1000));
    const plannedSeconds = session.plannedDurationMinutes * 60;
    const remainingSeconds = Math.max(0, plannedSeconds - elapsedSeconds);

    if (session.status === 'active' && remainingSeconds > 0) {
      this.state = {
        sessionId: session.id,
        status: 'active',
        remainingSeconds,
        plannedDurationSeconds: plannedSeconds,
        elapsedSeconds,
        startedAt: startedAt,
        pausedAt: session.pausedAt ? new Date(session.pausedAt).getTime() : null,
        totalPausedDuration: session.pausedAt && session.resumedAt
          ? new Date(session.resumedAt).getTime() - new Date(session.pausedAt).getTime()
          : session.pausedAt
            ? now - new Date(session.pausedAt).getTime()
            : 0,
      };
      this.persistState();
      this.startTimer();
    } else if (session.status === 'paused') {
      this.state = {
        sessionId: session.id,
        status: 'paused',
        remainingSeconds,
        plannedDurationSeconds: plannedSeconds,
        elapsedSeconds,
        startedAt: startedAt,
        pausedAt: session.pausedAt ? new Date(session.pausedAt).getTime() : null,
        totalPausedDuration: session.pausedAt
          ? (session.resumedAt ? new Date(session.resumedAt).getTime() : now) - new Date(session.pausedAt).getTime()
          : 0,
      };
      this.persistState();
    }
  }

  /**
   * Schedules a local notification for session completion.
   */
  private async scheduleCompletionNotification(session: LockinSession): Promise<void> {
    try {
      const hasPermission = await this.adapter.requestPermissionsAsync();
      if (hasPermission.status !== 'granted') {
        return;
      }

      const request: NotificationRequest = {
        content: {
          title: 'Focus Session Complete! 🎉',
          body: `Great job! You completed ${session.plannedDurationMinutes} minutes of focused work.`,
          data: {
            type: 'lockin_complete',
            sessionId: session.id,
          },
          sound: true,
        },
        trigger: {
          seconds: 1,
          channelId: 'lockin',
        },
      };

      // Configure Android channel for lockin notifications
      if (Platform.OS === 'android') {
        await this.adapter.setNotificationChannelAsync('lockin', {
          name: 'Lockin Focus Timer',
          importance: 4, // High
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#7C3AED',
        });
      }

      await this.adapter.scheduleNotificationAsync(request);
    } catch (error) {
      console.warn('[LockinTimerService] Failed to schedule completion notification:', error);
    }
  }

  /**
   * Starts the internal timer interval.
   */
  private startTimer(): void {
    if (this.timerInterval) {
      return;
    }

    this.timerInterval = setInterval(() => {
      this.tick();
    }, TIMER_TICK_INTERVAL);
  }

  /**
   * Cleans up the internal timer interval.
   */
  private cleanupTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Timer tick handler - called every second.
   */
  private tick(): void {
    if (this.state.status !== 'active') {
      this.cleanupTimer();
      return;
    }

    this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - 1);
    this.state.elapsedSeconds = this.state.plannedDurationSeconds - this.state.remainingSeconds;

    this.callbacks.onTick?.(this.state.remainingSeconds);

    if (this.state.remainingSeconds <= 0) {
      // Timer completed
      this.handleTimerComplete();
    }

    // Persist state periodically (every 10 seconds)
    if (this.state.elapsedSeconds % 10 === 0) {
      this.persistState();
    }
  }

  /**
   * Handles timer completion.
   */
  private async handleTimerComplete(): Promise<void> {
    this.cleanupTimer();

    if (!this.state.sessionId) {
      return;
    }

    const now = Date.now();
    const actualDurationMs = now - (this.state.startedAt || now) - this.state.totalPausedDuration;
    const actualDurationMinutes = Math.max(1, Math.round(actualDurationMs / 60000));

    // Update session in storage
    const updatedSession = await lockinStorage.updateSession(this.state.sessionId, {
      status: 'completed',
      actualDurationMinutes,
      focusScore: 100,
      completedAt: new Date(now).toISOString(),
    }).then(() => lockinStorage.getSessionById(this.state.sessionId!));

    this.state = {
      ...this.state,
      status: 'completed',
      remainingSeconds: 0,
      elapsedSeconds: actualDurationMs,
    };

    this.persistState();
    this.callbacks.onComplete?.(updatedSession!);

    // Schedule completion notification
    const session = await lockinStorage.getSessionById(this.state.sessionId!);
    if (session) {
      await this.scheduleCompletionNotification(session);
    }
  }

  /**
   * Sets up app state listener for background/foreground handling.
   */
  private setupAppStateListener(): void {
    this.appStateListener = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  /**
   * Handles app state changes (background/foreground).
   */
  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    if (this.state.status !== 'active' || !this.state.sessionId) {
      return;
    }

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.isBackground = true;
      this.backgroundStartTime = Date.now();
      this.persistState();
    } else if (nextAppState === 'active' && this.isBackground) {
      this.isBackground = false;

      // Calculate time spent in background
      if (this.backgroundStartTime) {
        const backgroundDuration = Date.now() - this.backgroundStartTime;
        this.state.totalPausedDuration += backgroundDuration;
        this.backgroundStartTime = null;
      }

      // Recalculate remaining time
      const now = Date.now();
      const elapsed = now - (this.state.startedAt || now) - this.state.totalPausedDuration;
      this.state.elapsedSeconds = Math.floor(elapsed / 1000);
      this.state.remainingSeconds = Math.max(0, this.state.plannedDurationSeconds - this.state.elapsedSeconds);

      // Update session in storage with actual elapsed time
      await lockinStorage.updateSession(this.state.sessionId, {
        actualDurationMinutes: Math.round(elapsed / 60000),
      });

      this.persistState();
    }
  }

  /**
   * Persists timer state to AsyncStorage for recovery after app restart.
   */
  private async persistState(): Promise<void> {
    try {
      if (Platform.OS === 'web' && typeof window === 'undefined') {
        return;
      }
      // AsyncStorage imported at top
      const persistData = {
        ...this.state,
        // Don't persist the interval reference
        persistedAt: Date.now(),
      };
      await AsyncStorage.setItem(this.persistenceKey, JSON.stringify(persistData));
    } catch (error) {
      console.warn('[LockinTimerService] Failed to persist timer state:', error);
    }
  }

  /**
   * Loads persisted timer state from AsyncStorage.
   */
  private async loadPersistedState(): Promise<void> {
    try {
      if (Platform.OS === 'web' && typeof window === 'undefined') {
        return;
      }
      // AsyncStorage imported at top
      const stored = await AsyncStorage.getItem(this.persistenceKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only restore if it was persisted recently (within 24 hours)
        if (parsed.persistedAt && Date.now() - parsed.persistedAt < 24 * 60 * 60 * 1000) {
          this.state = {
            sessionId: parsed.sessionId,
            status: parsed.status,
            remainingSeconds: parsed.remainingSeconds,
            plannedDurationSeconds: parsed.plannedDurationSeconds,
            elapsedSeconds: parsed.elapsedSeconds,
            startedAt: parsed.startedAt,
            pausedAt: parsed.pausedAt,
            totalPausedDuration: parsed.totalPausedDuration,
          };
        }
      }
    } catch (error) {
      console.warn('[LockinTimerService] Failed to load persisted timer state:', error);
    }
  }

  /**
   * Clears persisted timer state.
   */
  public async clearPersistedState(): Promise<void> {
    try {
      if (Platform.OS === 'web' && typeof window === 'undefined') {
        return;
      }
      // AsyncStorage imported at top
      await AsyncStorage.removeItem(this.persistenceKey);
    } catch (error) {
      console.warn('[LockinTimerService] Failed to clear persisted timer state:', error);
    }
  }

  /**
   * Cleans up all resources.
   */
  public cleanup(): void {
    this.cleanupTimer();
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
    this.clearPersistedState();
    this.state = {
      sessionId: null,
      status: 'abandoned',
      remainingSeconds: 0,
      plannedDurationSeconds: 0,
      elapsedSeconds: 0,
      startedAt: null,
      pausedAt: null,
      totalPausedDuration: 0,
    };
  }

  /**
   * Sets a custom notification adapter (for testing).
   */
  public setAdapter(adapter: NotificationPlatformAdapter): void {
    this.adapter = adapter;
  }
}

export const lockinTimerService = LockinTimerService.getInstance();