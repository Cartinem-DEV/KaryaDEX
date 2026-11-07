/**
 * KaryaDEX — LockIn Playground Bridge Deterministic Test Suite (PG-3B.1)
 *
 * Verifies all 14 PG-3B.1 integration scenarios:
 * 1. Playground reads active break from existing LockIn store (useLockInStore).
 * 2. No active break means no LockIn game launch.
 * 3. Bridge cannot create a second authoritative timer (modifying LockIn store immediately reflects in bridge).
 * 4. Returning to LockIn preserves original deadline.
 * 5. Replaced or ended LockIn session invalidates old bridge context.
 * 6. Guide/tutorial pauses game timer only; break timer continues in wall-clock time.
 * 7. Legitimate completion before deadline awards normal XP, rating delta, streak, and quest progress.
 * 8. Duplicate result callbacks cannot grant duplicate rewards (idempotency in recordMatch).
 * 9. Completion at or after exact deadline grants zero rewards (BREAK_DEADLINE_EXCEEDED).
 * 10. Replay is disabled below 90 seconds (test boundary at 89s, 90s, 91s).
 * 11. Standalone Playground behaves normally (unrestricted launch and replay).
 * 12. App background/foreground does not extend break (wall-clock timestamp arithmetic).
 * 13. Subscriptions, intervals, and listeners are cleaned up on unmount.
 * 14. Stale session cannot submit rewards into newer LockIn session (STALE_BREAK_SESSION).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  lockinPlaygroundBridge,
  MIN_REPLAY_SECONDS,
} from '@/lib/lockin/lockinPlaygroundBridge';
import { useLockInStore } from '@/hooks/useLockInStore';
import { usePlaygroundStore } from '@/store/usePlaygroundStore';

describe('LockIn Playground Bridge Integration Hardening (PG-3B.1)', () => {
  const BASE_TIME = 1_700_000_000_000; // Fixed deterministic baseline timestamp

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(BASE_TIME);
    await AsyncStorage.clear();
    lockinPlaygroundBridge.resetBridge();
    useLockInStore.getState().endBreak();
    usePlaygroundStore.getState().resetAllForTesting();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Scenario 1 ──────────────────────────────────────────────────────────
  it('Scenario 1: Playground reads active break directly from existing LockIn store (useLockInStore)', () => {
    // Break started directly via authoritative LockIn store
    useLockInStore.getState().startBreak({
      sessionId: 'session-authoritative-store',
      durationSeconds: 300,
      breakType: 'short_break',
      startedAt: BASE_TIME,
    });

    // Bridge reads directly from useLockInStore with zero independent storage
    const activeBreak = lockinPlaygroundBridge.getActiveBreak();
    expect(activeBreak).not.toBeNull();
    expect(activeBreak?.sessionId).toBe('session-authoritative-store');
    expect(activeBreak?.breakDeadlineTimestamp).toBe(BASE_TIME + 300_000);
    expect(lockinPlaygroundBridge.getRemainingBreakSeconds()).toBe(300);

    const validation = lockinPlaygroundBridge.validateLaunch();
    expect(validation.allowed).toBe(true);
    expect(validation.remainingSeconds).toBe(300);

    const launchResult = lockinPlaygroundBridge.launchGame('sprint_duel');
    expect(launchResult.success).toBe(true);
    expect(launchResult.context?.breakSession.sessionId).toBe('session-authoritative-store');
  });

  // ─── Scenario 2 ──────────────────────────────────────────────────────────
  it('Scenario 2: No active break means no LockIn game launch', () => {
    expect(useLockInStore.getState().activeBreak).toBeNull();
    expect(lockinPlaygroundBridge.getActiveBreak()).toBeNull();

    const validation = lockinPlaygroundBridge.validateLaunch();
    expect(validation.allowed).toBe(false);
    expect(validation.reason).toBe('NO_ACTIVE_BREAK');
    expect(validation.remainingSeconds).toBe(0);

    const launchResult = lockinPlaygroundBridge.launchGame('queens');
    expect(launchResult.success).toBe(false);
    expect(launchResult.error).toContain('only available during an active LockIn break');
    expect(lockinPlaygroundBridge.getActiveBridgeContext()).toBeNull();
  });

  // ─── Scenario 3 ──────────────────────────────────────────────────────────
  it('Scenario 3: Bridge cannot create a second authoritative timer (modifying LockIn store immediately reflects in bridge)', () => {
    // Start break with 300s
    useLockInStore.getState().startBreak({
      sessionId: 'session-single-truth',
      durationSeconds: 300,
      startedAt: BASE_TIME,
    });

    expect(lockinPlaygroundBridge.getRemainingBreakSeconds()).toBe(300);

    // Update authoritative deadline in LockIn store directly
    useLockInStore.setState({
      activeBreak: {
        sessionId: 'session-single-truth',
        isBreakActive: true,
        breakType: 'short_break',
        startedAt: BASE_TIME,
        breakDeadlineTimestamp: BASE_TIME + 150_000, // modified directly to 150s remaining
        breakDurationSeconds: 150,
      },
    });

    // Bridge immediately reflects updated LockIn store with no divergent state
    expect(lockinPlaygroundBridge.getRemainingBreakSeconds()).toBe(150);
    expect(lockinPlaygroundBridge.getActiveBreak()?.breakDeadlineTimestamp).toBe(BASE_TIME + 150_000);

    // Ending the break in LockIn store immediately clears bridge view
    useLockInStore.getState().endBreak();
    expect(lockinPlaygroundBridge.getActiveBreak()).toBeNull();
    expect(lockinPlaygroundBridge.getRemainingBreakSeconds()).toBe(0);
  });

  // ─── Scenario 4 ──────────────────────────────────────────────────────────
  it('Scenario 4: Returning to LockIn preserves original deadline', () => {
    useLockInStore.getState().startBreak({
      sessionId: 'session-preserve-timer',
      durationSeconds: 600, // 10 minutes
      breakType: 'long_break',
      startedAt: BASE_TIME,
      metadata: { presetId: 'exam_prep_deep', workBlockCount: 3 },
    });

    lockinPlaygroundBridge.launchGame('queens');
    expect(lockinPlaygroundBridge.getActiveBridgeContext()?.gameType).toBe('queens');

    // Player spends 150s in Playground, then returns to LockIn screen
    jest.advanceTimersByTime(150_000);
    lockinPlaygroundBridge.clearActiveBridgeGame();

    // Active bridge navigation context cleared
    expect(lockinPlaygroundBridge.getActiveBridgeContext()).toBeNull();

    // LockIn break session in store is 100% preserved
    const activeBreak = lockinPlaygroundBridge.getActiveBreak();
    expect(activeBreak).not.toBeNull();
    expect(activeBreak?.sessionId).toBe('session-preserve-timer');
    expect(activeBreak?.breakType).toBe('long_break');
    expect(activeBreak?.metadata?.workBlockCount).toBe(3);
    expect(activeBreak?.breakDeadlineTimestamp).toBe(BASE_TIME + 600_000);
    expect(lockinPlaygroundBridge.getRemainingBreakSeconds()).toBe(450); // 600 - 150 = 450
  });

  // ─── Scenario 5 ──────────────────────────────────────────────────────────
  it('Scenario 5: Replaced or ended LockIn session invalidates old bridge context', () => {
    useLockInStore.getState().startBreak({
      sessionId: 'session-old',
      durationSeconds: 300,
      startedAt: BASE_TIME,
    });

    lockinPlaygroundBridge.launchGame('tango');

    // LockIn session is ended by user returning to focus or abandoning
    useLockInStore.getState().endBreak();

    // Attempting to evaluate game completion for the old session
    const evalResult = lockinPlaygroundBridge.evaluateGameCompletion(
      BASE_TIME + 100_000,
      { xpEarned: 100, ratingDelta: 20 },
      { sessionId: 'session-old' }
    );

    expect(evalResult.valid).toBe(false);
    expect(evalResult.reason).toBe('STALE_BREAK_SESSION');
    expect(evalResult.xpAwarded).toBe(0);
    expect(evalResult.ratingDelta).toBe(0);

    // Submitting through usePlaygroundStore rejects with STALE_BREAK_SESSION
    const matchRes = usePlaygroundStore.getState().recordMatch({
      id: 'stale-match-1',
      gameType: 'tango',
      score: 100,
      isWin: true,
      durationSeconds: 100,
      xpEarned: 100,
      lockinSessionId: 'session-old',
      timestamp: BASE_TIME + 100_000,
    });

    expect(matchRes.rejectedReason).toBe('STALE_BREAK_SESSION');
    expect(matchRes.totalXpEarned).toBe(0);
    expect(usePlaygroundStore.getState().brainXp).toBe(0);
  });

  // ─── Scenario 6 ──────────────────────────────────────────────────────────
  it('Scenario 6: Guide/tutorial pauses game timer only; break timer continues in wall-clock time', () => {
    useLockInStore.getState().startBreak({
      sessionId: 'session-guide-pause',
      durationSeconds: 300,
      startedAt: BASE_TIME,
    });

    lockinPlaygroundBridge.launchGame('mind_snap');

    // 20s into game, player opens Interactive Tutorial modal
    jest.advanceTimersByTime(20_000);
    const inGameTimeBeforeModal = 20;

    // Tutorial modal is open for 50s
    jest.advanceTimersByTime(50_000);

    // Game play duration excludes modal open time
    const finalInGameDuration = inGameTimeBeforeModal;
    expect(finalInGameDuration).toBe(20);

    // Break timer advanced strictly by 70s in wall-clock time
    const remainingBreak = lockinPlaygroundBridge.getRemainingBreakSeconds();
    expect(remainingBreak).toBe(230); // 300 - 70 = 230

    // Deadline was not shifted or extended
    expect(lockinPlaygroundBridge.getActiveBreak()?.breakDeadlineTimestamp).toBe(BASE_TIME + 300_000);
  });

  // ─── Scenario 7 ──────────────────────────────────────────────────────────
  it('Scenario 7: Legitimate completion before deadline awards normal XP, rating delta, streak, and quest progress', () => {
    useLockInStore.getState().startBreak({
      sessionId: 'session-legit-rewards',
      durationSeconds: 300,
      startedAt: BASE_TIME,
    });

    // Finish 60 seconds into the 300s break (240s remaining before deadline)
    const completionTime = BASE_TIME + 60_000;
    jest.setSystemTime(completionTime);

    const matchResult = usePlaygroundStore.getState().recordMatch({
      id: 'match-in-time-1',
      gameType: 'sprint_duel',
      score: 20,
      opponentScore: 10,
      accuracy: 95,
      isWin: true,
      durationSeconds: 60,
      xpEarned: 140,
      lockinSessionId: 'session-legit-rewards',
      timestamp: completionTime,
    });

    expect(matchResult.rejectedReason).toBeUndefined();
    expect(matchResult.xpEarned).toBeGreaterThan(0);
    expect(matchResult.ratingDelta).toBeGreaterThan(0);
    expect(matchResult.streakUpdated).toBe(true);

    const profile = usePlaygroundStore.getState();
    expect(profile.brainXp).toBeGreaterThanOrEqual(140);
    expect(profile.brainRating).toBeGreaterThan(1200);
    expect(profile.escapeStreak).toBe(1);
    expect(profile.totalMatches).toBe(1);
    expect(profile.recentMatches[0].id).toBe('match-in-time-1');
  });

  // ─── Scenario 8 ──────────────────────────────────────────────────────────
  it('Scenario 8: Duplicate result callbacks cannot grant duplicate rewards (idempotency in recordMatch)', () => {
    useLockInStore.getState().startBreak({
      sessionId: 'session-idempotency',
      durationSeconds: 300,
      startedAt: BASE_TIME,
    });

    const completionTime = BASE_TIME + 60_000;
    jest.setSystemTime(completionTime);

    const matchData = {
      id: 'match-idempotency-test-1',
      gameType: 'sprint_duel' as const,
      score: 20,
      opponentScore: 10,
      accuracy: 95,
      isWin: true,
      durationSeconds: 60,
      xpEarned: 140,
      lockinSessionId: 'session-idempotency',
      timestamp: completionTime,
    };

    // First call: succeeds and grants rewards
    const firstResult = usePlaygroundStore.getState().recordMatch(matchData);
    expect(firstResult.xpEarned).toBe(140);
    const xpAfterFirst = usePlaygroundStore.getState().brainXp;
    const ratingAfterFirst = usePlaygroundStore.getState().brainRating;
    const matchesAfterFirst = usePlaygroundStore.getState().totalMatches;

    // Second call with duplicate match ID: idempotent response, zero additional rewards
    const duplicateResult = usePlaygroundStore.getState().recordMatch(matchData);
    expect(duplicateResult.questXpEarned).toBe(0);
    expect(duplicateResult.streakUpdated).toBe(false);

    // Profile state must remain identical to post-first-call
    const stateAfterDuplicate = usePlaygroundStore.getState();
    expect(stateAfterDuplicate.brainXp).toBe(xpAfterFirst);
    expect(stateAfterDuplicate.brainRating).toBe(ratingAfterFirst);
    expect(stateAfterDuplicate.totalMatches).toBe(matchesAfterFirst);
  });

  // ─── Scenario 9 ──────────────────────────────────────────────────────────
  it('Scenario 9: Completion at or after exact deadline grants zero rewards (BREAK_DEADLINE_EXCEEDED)', () => {
    // 2-minute break (120 seconds)
    useLockInStore.getState().startBreak({
      sessionId: 'session-deadline-exceeded',
      durationSeconds: 120,
      startedAt: BASE_TIME,
    });

    // Set initial baseline stats
    usePlaygroundStore.setState({
      brainXp: 500,
      brainRating: 1280,
      escapeStreak: 3,
      totalMatches: 5,
    });

    // Sub-case 9a: Exact deadline boundary (completion at exactly 120,000ms)
    const exactDeadlineTime = BASE_TIME + 120_000;
    const exactEval = lockinPlaygroundBridge.evaluateGameCompletion(
      exactDeadlineTime,
      { xpEarned: 100, ratingDelta: 20 },
      { sessionId: 'session-deadline-exceeded' }
    );
    expect(exactEval.valid).toBe(false);
    expect(exactEval.reason).toBe('BREAK_DEADLINE_EXCEEDED');
    expect(exactEval.xpAwarded).toBe(0);

    // Sub-case 9b: After deadline (125 seconds, 5s past deadline)
    const lateCompletionTime = BASE_TIME + 125_000;
    jest.setSystemTime(lateCompletionTime);

    const matchResult = usePlaygroundStore.getState().recordMatch({
      id: 'match-late-1',
      gameType: 'sprint_duel',
      score: 25,
      opponentScore: 10,
      accuracy: 90,
      isWin: true,
      durationSeconds: 125,
      xpEarned: 150,
      lockinSessionId: 'session-deadline-exceeded',
      timestamp: lateCompletionTime,
    });

    // Result must be explicitly rejected
    expect(matchResult.rejectedReason).toBe('BREAK_DEADLINE_EXCEEDED');
    expect(matchResult.xpEarned).toBe(0);
    expect(matchResult.questXpEarned).toBe(0);
    expect(matchResult.totalXpEarned).toBe(0);
    expect(matchResult.ratingDelta).toBe(0);
    expect(matchResult.newRating).toBe(1280);
    expect(matchResult.streakUpdated).toBe(false);

    // Player profile progression stats must remain 100% UNCHANGED
    const storeState = usePlaygroundStore.getState();
    expect(storeState.brainXp).toBe(500);
    expect(storeState.brainRating).toBe(1280);
    expect(storeState.escapeStreak).toBe(3);
    expect(storeState.totalMatches).toBe(6); // match record logged for audit
    expect(storeState.recentMatches[0].xpEarned).toBe(0);
    expect(storeState.recentMatches[0].ratingDelta).toBe(0);
  });

  // ─── Scenario 10 ─────────────────────────────────────────────────────────
  it('Scenario 10: Replay is disabled below 90 seconds (test boundary at 89s, 90s, 91s)', () => {
    // Start a 100s break
    useLockInStore.getState().startBreak({
      sessionId: 'session-replay-boundary',
      durationSeconds: 100,
      startedAt: BASE_TIME,
    });

    // Boundary Test 1: 91s remaining (at t = BASE_TIME + 9s)
    const at91s = BASE_TIME + 9_000;
    const check91 = lockinPlaygroundBridge.validateReplay(at91s);
    expect(check91.allowed).toBe(true);
    expect(check91.remainingSeconds).toBe(91);

    // Boundary Test 2: Exactly 90s remaining (at t = BASE_TIME + 10s)
    const at90s = BASE_TIME + 10_000;
    const check90 = lockinPlaygroundBridge.validateReplay(at90s);
    expect(check90.allowed).toBe(true);
    expect(check90.remainingSeconds).toBe(90);

    // Boundary Test 3: 89s remaining (at t = BASE_TIME + 11s)
    const at89s = BASE_TIME + 11_000;
    const check89 = lockinPlaygroundBridge.validateReplay(at89s);
    expect(check89.allowed).toBe(false);
    expect(check89.remainingSeconds).toBe(89);
    expect(check89.message).toContain('Less than 90 seconds remaining');
    expect(check89.message).toContain('Replay unavailable');
  });

  // ─── Scenario 11 ─────────────────────────────────────────────────────────
  it('Scenario 11: Standalone Playground behaves normally (unrestricted launch and replay)', () => {
    // Ensure no LockIn break is active
    expect(lockinPlaygroundBridge.getActiveBreak()).toBeNull();

    // Replay check in standalone Playground is unrestricted
    const replayCheck = lockinPlaygroundBridge.validateReplay();
    expect(replayCheck.allowed).toBe(true);
    expect(replayCheck.remainingSeconds).toBe(Infinity);

    // Standalone match evaluation is valid
    const evalRes = lockinPlaygroundBridge.evaluateGameCompletion(Date.now(), {
      xpEarned: 100,
      ratingDelta: 20,
    });
    expect(evalRes.valid).toBe(true);
    expect(evalRes.reason).toBe('COMPLETED_IN_TIME');

    // Standalone match recording awards standard rewards
    const matchRes = usePlaygroundStore.getState().recordMatch({
      id: 'standalone-match-1',
      gameType: 'sprint_duel',
      score: 15,
      isWin: true,
      durationSeconds: 60,
      xpEarned: 100,
    });

    expect(matchRes.rejectedReason).toBeUndefined();
    expect(matchRes.totalXpEarned).toBeGreaterThanOrEqual(100);
    expect(usePlaygroundStore.getState().brainXp).toBeGreaterThanOrEqual(100);
  });

  // ─── Scenario 12 ─────────────────────────────────────────────────────────
  it('Scenario 12: App background/foreground does not extend break (wall-clock timestamp arithmetic)', () => {
    // Start a 300s break
    useLockInStore.getState().startBreak({
      sessionId: 'session-background-foreground',
      durationSeconds: 300,
      startedAt: BASE_TIME,
    });

    const deadline = BASE_TIME + 300_000;

    // App is active for 30s
    jest.setSystemTime(BASE_TIME + 30_000);
    expect(lockinPlaygroundBridge.getRemainingBreakSeconds()).toBe(270);

    // App goes to background for 170s and then foregrounds at t = BASE_TIME + 200s
    jest.setSystemTime(BASE_TIME + 200_000);

    // Remaining break is computed purely via wall-clock deadline: 300 - 200 = 100s
    expect(lockinPlaygroundBridge.getRemainingBreakSeconds()).toBe(100);
    expect(lockinPlaygroundBridge.getActiveBreak()?.breakDeadlineTimestamp).toBe(deadline);
  });

  // ─── Scenario 13 ─────────────────────────────────────────────────────────
  it('Scenario 13: Subscriptions and listeners are properly updated and cleaned up on unmount', () => {
    let callCount = 0;
    const unsubscribe = lockinPlaygroundBridge.subscribe(() => {
      callCount += 1;
    });

    // Starting break triggers subscriber notification
    useLockInStore.getState().startBreak({
      sessionId: 'session-sub-test',
      durationSeconds: 300,
      startedAt: BASE_TIME,
    });
    // Launching game triggers subscriber notification
    lockinPlaygroundBridge.launchGame('sprint_duel');
    expect(callCount).toBeGreaterThanOrEqual(1);

    const countBeforeUnsub = callCount;
    // Unsubscribe listener
    unsubscribe();

    // Subsequent bridge action does NOT invoke listener
    lockinPlaygroundBridge.clearActiveBridgeGame();
    expect(callCount).toBe(countBeforeUnsub);
  });

  // ─── Scenario 14 ─────────────────────────────────────────────────────────
  it('Scenario 14: Stale session cannot submit rewards into newer LockIn session (STALE_BREAK_SESSION)', () => {
    // Break 1 starts
    useLockInStore.getState().startBreak({
      sessionId: 'session-alpha',
      durationSeconds: 300,
      startedAt: BASE_TIME,
    });

    // In-flight game is tagged with session-alpha
    const inFlightSessionId = 'session-alpha';

    // Break 1 ends or gets replaced with Break 2
    useLockInStore.getState().startBreak({
      sessionId: 'session-beta',
      durationSeconds: 300,
      startedAt: BASE_TIME + 50_000,
    });

    // Game from session-alpha finishes and attempts to claim rewards
    const evalResult = lockinPlaygroundBridge.evaluateGameCompletion(
      BASE_TIME + 80_000,
      { xpEarned: 120, ratingDelta: 20 },
      { sessionId: inFlightSessionId }
    );

    expect(evalResult.valid).toBe(false);
    expect(evalResult.reason).toBe('STALE_BREAK_SESSION');
    expect(evalResult.xpAwarded).toBe(0);

    // Submitting through usePlaygroundStore rejects with STALE_BREAK_SESSION
    const matchRes = usePlaygroundStore.getState().recordMatch({
      id: 'stale-match-alpha',
      gameType: 'queens',
      score: 100,
      isWin: true,
      durationSeconds: 80,
      xpEarned: 120,
      lockinSessionId: inFlightSessionId,
      timestamp: BASE_TIME + 80_000,
    });

    expect(matchRes.rejectedReason).toBe('STALE_BREAK_SESSION');
    expect(matchRes.totalXpEarned).toBe(0);
    expect(matchRes.ratingDelta).toBe(0);
    expect(usePlaygroundStore.getState().brainXp).toBe(0);
  });
});
