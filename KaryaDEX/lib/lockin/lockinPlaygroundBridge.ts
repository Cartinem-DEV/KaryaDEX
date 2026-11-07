/**
 * KaryaDEX — LockIn Playground Bridge Engine (Hardened PG-3B.1)
 *
 * Bridges active LockIn focus breaks with the Brain Playground games.
 *
 * Architecture & Source of Truth:
 * - Single Source of Truth: All authoritative break timers, states, and sessions
 *   live exclusively in `useLockInStore` (and its persistence layer).
 * - Read-Only Adapter: This bridge acts as a typed adapter and validation layer.
 *   It does NOT maintain a duplicate authoritative timer or independent storage key.
 * - Initial Launch Rule: A game can be launched whenever an authoritative break is active
 *   and has remaining time (>0s).
 * - Replay Restriction Rule: Replay is strictly disabled when <90s remain on the break timer.
 * - Timer Independence: Game timers (moves, math questions) are strictly separated from
 *   the LockIn wall-clock break deadline. Opening guides/tutorials never pauses the break timer.
 * - Stale Session Protection: Game submissions tied to an old/replaced session are rejected.
 */

import { useLockInStore } from '@/hooks/useLockInStore';
import type {
  PlaygroundGameType,
  LockinBreakType,
  LockinBreakSession,
  BridgeLaunchValidation,
  BridgeReplayValidation,
  BridgeGameCompletionValidation,
  LockinPlaygroundBridgeContext,
} from '@/types/playground';

export const MIN_REPLAY_SECONDS = 90;

class LockinPlaygroundBridgeService {
  private activeBridgeContext: LockinPlaygroundBridgeContext | null = null;
  private subscribers: Set<() => void> = new Set();
  private storeUnsubscribe: (() => void) | null = null;

  constructor() {
    this.setupStoreListener();
  }

  private setupStoreListener(): void {
    if (typeof useLockInStore?.subscribe === 'function') {
      this.storeUnsubscribe = useLockInStore.subscribe(() => {
        this.notifySubscribers();
      });
    }
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      try {
        sub();
      } catch (err) {
        console.warn('[LockinPlaygroundBridge] Subscriber error:', err);
      }
    }
  }

  public subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /**
   * Retrieves the currently active break session from the single source of truth (useLockInStore).
   * Validates whether the session is still active and whether the deadline has expired in real time.
   */
  public getActiveBreak(now?: number): LockinBreakSession | null {
    const storeBreak = useLockInStore.getState().activeBreak;
    if (!storeBreak || !storeBreak.isBreakActive) {
      return null;
    }

    const currentNow = now ?? Date.now();
    if (currentNow >= storeBreak.breakDeadlineTimestamp) {
      return null;
    }

    return { ...storeBreak };
  }

  /**
   * Checks whether an authoritative LockIn break session is currently active.
   */
  public isBreakActive(now?: number): boolean {
    return this.getActiveBreak(now) !== null;
  }

  /**
   * Evaluates whether the Playground is currently locked according to authoritative LockIn focus rules.
   * Locked if: an authoritative focus session is active (status 'active' or 'paused')
   * AND no legitimate active break is in progress.
   */
  public isPlaygroundLocked(now?: number): boolean {
    const { timerState, currentSession } = useLockInStore.getState();
    const isFocusActive =
      (timerState?.status === 'active' || timerState?.status === 'paused') &&
      currentSession !== null;

    if (!isFocusActive) {
      return false;
    }

    const breakActive = this.isBreakActive(now);
    return !breakActive;
  }

  /**
   * Authoritative user-facing explanation message when Playground is locked during a focus session.
   */
  public getLockedExplanation(): string {
    return 'Playground is unavailable during an active focus session. Complete your focus session or take a break to access brain games.';
  }

  /**
   * Returns remaining break duration in whole seconds derived from the authoritative deadline.
   */
  public getRemainingBreakSeconds(now?: number): number {
    const storeBreak = useLockInStore.getState().activeBreak;
    if (!storeBreak || !storeBreak.isBreakActive) {
      return 0;
    }

    const currentNow = now ?? Date.now();
    const remainingMs = storeBreak.breakDeadlineTimestamp - currentNow;
    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  /**
   * Starts an authoritative break session by delegating directly to the LockIn store.
   */
  public startBreak(params: {
    sessionId?: string;
    durationSeconds: number;
    breakType?: LockinBreakType;
    startedAt?: number;
    metadata?: Record<string, any>;
  }): LockinBreakSession {
    const breakSession = useLockInStore.getState().startBreak(params);
    this.activeBridgeContext = null;
    this.notifySubscribers();
    return breakSession;
  }

  /**
   * Validates whether a Playground game may be launched from the active LockIn break.
   * Product Rule: Permitted during any active LockIn break with remaining time (>0s).
   */
  public validateLaunch(now?: number): BridgeLaunchValidation {
    const activeBreak = this.getActiveBreak(now);
    if (!activeBreak) {
      return {
        allowed: false,
        remainingSeconds: 0,
        reason: 'NO_ACTIVE_BREAK',
        message: 'Playground breaks are only available during an active LockIn break.',
      };
    }

    const remaining = this.getRemainingBreakSeconds(now);
    if (remaining <= 0) {
      return {
        allowed: false,
        remainingSeconds: 0,
        reason: 'NO_ACTIVE_BREAK',
        message: 'The active LockIn break has concluded.',
      };
    }

    return {
      allowed: true,
      remainingSeconds: remaining,
    };
  }

  /**
   * Launches a Playground game within the active break context.
   */
  public launchGame(
    gameType: PlaygroundGameType,
    now?: number
  ): {
    success: boolean;
    context?: LockinPlaygroundBridgeContext;
    error?: string;
  } {
    const validation = this.validateLaunch(now);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.message || validation.reason,
      };
    }

    const currentNow = now ?? Date.now();
    const activeBreak = this.getActiveBreak(currentNow)!;

    this.activeBridgeContext = {
      breakSession: activeBreak,
      gameType,
      launchTimestamp: currentNow,
    };

    this.notifySubscribers();
    return {
      success: true,
      context: this.activeBridgeContext,
    };
  }

  /**
   * Retrieves the current derived navigation bridge context.
   */
  public getActiveBridgeContext(): LockinPlaygroundBridgeContext | null {
    return this.activeBridgeContext ? { ...this.activeBridgeContext } : null;
  }

  /**
   * Checks whether the player may replay a game during the active break.
   * Product Rule: Strictly disabled when <90s remain on the authoritative break timer.
   */
  public validateReplay(now?: number): BridgeReplayValidation {
    const activeBreak = this.getActiveBreak(now);
    if (!activeBreak) {
      // Outside a LockIn break (standalone Playground), replay is unrestricted
      return { allowed: true, remainingSeconds: Infinity };
    }

    const remaining = this.getRemainingBreakSeconds(now);
    if (remaining < MIN_REPLAY_SECONDS) {
      return {
        allowed: false,
        remainingSeconds: remaining,
        message: `Less than 90 seconds remaining (${remaining}s). Replay unavailable. Return to LockIn to resume focus.`,
      };
    }

    return {
      allowed: true,
      remainingSeconds: remaining,
    };
  }

  /**
   * Evaluates completion of a game played during a break against the authoritative LockIn state.
   * Enforces:
   * 1. Session Liveness: If the LockIn session was ended or replaced, result is rejected ('STALE_BREAK_SESSION').
   * 2. Deadline Expiry: If finished at or after the deadline, result is rejected ('BREAK_DEADLINE_EXCEEDED').
   * 3. Legitimate Completion: If finished in time in the active session, awards normal rewards.
   */
  public evaluateGameCompletion(
    completionTimestamp?: number,
    baseRewards?: { xpEarned: number; ratingDelta: number },
    sessionContext?: { sessionId?: string; breakDeadlineTimestamp?: number }
  ): BridgeGameCompletionValidation {
    const currentNow = completionTimestamp ?? Date.now();
    const rawBreak = useLockInStore.getState().activeBreak;

    // Context from navigation or caller
    const targetSessionId = sessionContext?.sessionId ?? this.activeBridgeContext?.breakSession.sessionId;
    const targetDeadline = sessionContext?.breakDeadlineTimestamp ?? this.activeBridgeContext?.breakSession.breakDeadlineTimestamp;

    // Check if this game was started in a LockIn break session
    if (targetSessionId) {
      // Verify that the LockIn session is still the active session
      if (!rawBreak || !rawBreak.isBreakActive || rawBreak.sessionId !== targetSessionId) {
        return {
          valid: false,
          reason: 'STALE_BREAK_SESSION',
          message: 'The LockIn session for this break was ended or replaced. Rewards were not awarded.',
          xpAwarded: 0,
          ratingDelta: 0,
          streakIncremented: false,
        };
      }

      const effectiveDeadline = targetDeadline ?? rawBreak.breakDeadlineTimestamp;
      if (currentNow >= effectiveDeadline) {
        return {
          valid: false,
          reason: 'BREAK_DEADLINE_EXCEEDED',
          message: 'Game concluded after your break ended. Progression rewards were not awarded.',
          xpAwarded: 0,
          ratingDelta: 0,
          streakIncremented: false,
        };
      }

      return {
        valid: true,
        reason: 'COMPLETED_IN_TIME',
        xpAwarded: baseRewards?.xpEarned ?? 0,
        ratingDelta: baseRewards?.ratingDelta ?? 0,
        streakIncremented: true,
      };
    }

    // If no sessionContext was specified, check if an un-contextualized break is active
    if (rawBreak && rawBreak.isBreakActive) {
      if (currentNow >= rawBreak.breakDeadlineTimestamp) {
        return {
          valid: false,
          reason: 'BREAK_DEADLINE_EXCEEDED',
          message: 'Game concluded after your break ended. Progression rewards were not awarded.',
          xpAwarded: 0,
          ratingDelta: 0,
          streakIncremented: false,
        };
      }
    }

    // Standalone Playground match outside any LockIn break
    return {
      valid: true,
      reason: 'COMPLETED_IN_TIME',
      xpAwarded: baseRewards?.xpEarned ?? 0,
      ratingDelta: baseRewards?.ratingDelta ?? 0,
      streakIncremented: true,
    };
  }

  /**
   * Clears the active bridge game context while keeping the LockIn break timer intact.
   */
  public clearActiveBridgeGame(): void {
    this.activeBridgeContext = null;
    this.notifySubscribers();
  }

  /**
   * Ends the break session in the authoritative LockIn store.
   */
  public endBreak(): void {
    this.activeBridgeContext = null;
    useLockInStore.getState().endBreak();
    this.notifySubscribers();
  }

  /**
   * Resets the bridge and LockIn break state (used for testing and teardown).
   */
  public resetBridge(): void {
    this.activeBridgeContext = null;
    this.subscribers.clear();
    useLockInStore.getState().endBreak();
  }
}

export const lockinPlaygroundBridge = new LockinPlaygroundBridgeService();
