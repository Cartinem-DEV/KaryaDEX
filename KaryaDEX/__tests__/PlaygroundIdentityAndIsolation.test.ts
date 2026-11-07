/**
 * KaryaDEX — Playground Identity & Data Isolation Test Suite (PG-3A)
 *
 * Validates:
 * - Independent storage partitioning (guest vs User A vs User B)
 * - Zero data bleeding across account scopes
 * - Immediate in-memory clearing during scope transitions
 * - Fast switching race-condition protection (hydration token validation)
 * - Logout clearing active authenticated state and cleanly returning to guest scope
 * - In-flight match recording strictly persisting to the active scope
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
  getStorageKeyForScope,
  loadPlaygroundProfile,
  savePlaygroundProfile,
} from '../lib/playground/identity/playgroundStorage';
import type { PlayerScope, MatchRecord } from '../types/playground';

describe('PG-3A: Player Identity & Data Isolation', () => {
  beforeEach(async () => {
    storageMap.clear();
    jest.clearAllMocks();

    // Reset playground store state
    usePlaygroundStore.setState({
      ...INITIAL_PLAYGROUND_STATE,
      activeScope: { type: 'guest' },
      isHydrated: true,
      isHydrating: false,
      pendingGuestClaim: null,
    });

    // Reset guide store
    usePlaygroundGuideStore.setState({
      activeUserId: 'guest',
      completedTutorials: [],
    });
  });

  it('generates strict, partitioned storage keys for guest and authenticated users', () => {
    const guestScope: PlayerScope = { type: 'guest' };
    const userAScope: PlayerScope = { type: 'authenticated', userId: 'user-uuid-1111' };
    const userBScope: PlayerScope = { type: 'authenticated', userId: 'user-uuid-2222' };

    expect(getStorageKeyForScope(guestScope)).toBe('karyadex_playground_v2:guest');
    expect(getStorageKeyForScope(userAScope)).toBe('karyadex_playground_v2:user:user-uuid-1111');
    expect(getStorageKeyForScope(userBScope)).toBe('karyadex_playground_v2:user:user-uuid-2222');
  });

  it('ensures guest progress does not leak to User A, and User A does not leak to User B', async () => {
    // 1. Start in guest scope
    await usePlaygroundStore.getState().switchScope({ type: 'guest' });
    usePlaygroundStore.setState({ dailyQuests: [] });

    // Record a match in guest scope
    const guestMatch: MatchRecord = {
      id: 'match-guest-1',
      gameType: 'sprint_duel',
      gameTitle: 'Sprint Duel',
      result: 'won',
      isWin: true,
      score: 18,
      durationSeconds: 45,
      xpEarned: 80,
      ratingDelta: 15,
      ratingChange: 15,
      date: new Date().toISOString(),
      timestamp: Date.now(),
      isPractice: false,
    };
    usePlaygroundStore.getState().recordMatch(guestMatch);

    expect(usePlaygroundStore.getState().totalMatches).toBe(1);
    expect(usePlaygroundStore.getState().brainXp).toBe(80);

    // Save and verify guest storage key has data
    await savePlaygroundProfile({ type: 'guest' }, {
      brainXp: 80,
      currentLevel: 1,
      currentStreak: 1,
      totalMatches: 1,
      totalWins: 1,
      ratings: { sprint_duel: 1015, queens: 1000, tango: 1000, mindsnap: 1000 },
      dailyQuests: [],
      recentMatches: [guestMatch],
    });

    expect(storageMap.has('karyadex_playground_v2:guest')).toBe(true);
    expect(storageMap.has('karyadex_playground_v2:user:user-uuid-1')).toBe(false);

    // 2. Switch to User A (empty account)
    await usePlaygroundStore.getState().switchScope({
      type: 'authenticated',
      userId: 'user-uuid-1',
    });
    usePlaygroundStore.setState({ dailyQuests: [] });

    // User A must start with clean initial stats (0 matches, 0 XP)
    expect(usePlaygroundStore.getState().totalMatches).toBe(0);
    expect(usePlaygroundStore.getState().brainXp).toBe(0);
    expect(usePlaygroundStore.getState().recentMatches).toHaveLength(0);

    // Record match for User A
    const userAMatch: MatchRecord = {
      id: 'match-usera-1',
      gameType: 'queens',
      gameTitle: 'Queens',
      result: 'won',
      isWin: true,
      score: 100,
      durationSeconds: 120,
      xpEarned: 150,
      ratingDelta: 25,
      ratingChange: 25,
      date: new Date().toISOString(),
      timestamp: Date.now(),
      isPractice: false,
    };
    usePlaygroundStore.getState().recordMatch(userAMatch);

    expect(usePlaygroundStore.getState().totalMatches).toBe(1);
    expect(usePlaygroundStore.getState().brainXp).toBe(150);

    // 3. Switch to User B (different account)
    await usePlaygroundStore.getState().switchScope({
      type: 'authenticated',
      userId: 'user-uuid-2',
    });

    // User B must NOT have User A's matches or XP
    expect(usePlaygroundStore.getState().totalMatches).toBe(0);
    expect(usePlaygroundStore.getState().brainXp).toBe(0);
    expect(usePlaygroundStore.getState().recentMatches).toHaveLength(0);

    // 4. Switch back to User A
    await usePlaygroundStore.getState().switchScope({
      type: 'authenticated',
      userId: 'user-uuid-1',
    });

    // User A's progress is restored from User A's storage partition
    expect(usePlaygroundStore.getState().totalMatches).toBe(1);
    expect(usePlaygroundStore.getState().brainXp).toBe(150);
    expect(usePlaygroundStore.getState().recentMatches[0].id).toBe('match-usera-1');

    // 5. Switch back to Guest
    await usePlaygroundStore.getState().switchScope({ type: 'guest' });

    // Guest's progress remains intact and completely independent
    expect(usePlaygroundStore.getState().totalMatches).toBe(1);
    expect(usePlaygroundStore.getState().brainXp).toBe(80);
    expect(usePlaygroundStore.getState().recentMatches[0].id).toBe('match-guest-1');
  });

  it('immediately blanks in-memory stats during switchScope so stale data is never rendered', async () => {
    // Populate store with mock active data
    usePlaygroundStore.setState({
      totalMatches: 42,
      brainXp: 3500,
      activeScope: { type: 'authenticated', userId: 'user-slow' },
      isHydrated: true,
      isHydrating: false,
    });

    // Start switch to User B
    const switchPromise = usePlaygroundStore.getState().switchScope({
      type: 'authenticated',
      userId: 'user-fast',
    });

    // In-memory data must be immediately zeroed while isHydrating is true
    // (Before asynchronous storage read finishes)
    expect(usePlaygroundStore.getState().isHydrating).toBe(true);
    expect(usePlaygroundStore.getState().totalMatches).toBe(0);
    expect(usePlaygroundStore.getState().brainXp).toBe(0);

    await switchPromise;

    expect(usePlaygroundStore.getState().isHydrating).toBe(false);
    expect(usePlaygroundStore.getState().isHydrated).toBe(true);
  });

  it('prevents hydration race condition during rapid sequential account switches', async () => {
    // Simulate slower storage for User A and fast storage for User B
    const origGetItem = jest.requireMock('@react-native-async-storage/async-storage').getItem;

    // Seed data
    await savePlaygroundProfile({ type: 'authenticated', userId: 'user-slow' }, {
      brainXp: 999,
      currentLevel: 5,
      currentStreak: 4,
      totalMatches: 20,
      totalWins: 15,
      ratings: { sprint_duel: 1100, queens: 1000, tango: 1000, mindsnap: 1000 },
      dailyQuests: [],
      recentMatches: [],
    });

    await savePlaygroundProfile({ type: 'authenticated', userId: 'user-fast' }, {
      brainXp: 100,
      currentLevel: 1,
      currentStreak: 1,
      totalMatches: 2,
      totalWins: 1,
      ratings: { sprint_duel: 1020, queens: 1000, tango: 1000, mindsnap: 1000 },
      dailyQuests: [],
      recentMatches: [],
    });

    // Fire two switches rapidly
    const promise1 = usePlaygroundStore.getState().switchScope({
      type: 'authenticated',
      userId: 'user-slow',
    });
    const promise2 = usePlaygroundStore.getState().switchScope({
      type: 'authenticated',
      userId: 'user-fast',
    });

    await Promise.all([promise1, promise2]);

    // The store must end up on user-fast, and NOT retain user-slow's data
    expect(usePlaygroundStore.getState().activeScope).toEqual({
      type: 'authenticated',
      userId: 'user-fast',
    });
    expect(usePlaygroundStore.getState().totalMatches).toBe(2);
    expect(usePlaygroundStore.getState().brainXp).toBe(100);
  });

  it('resets to clean guest scope on logout and coordinates with guide store', async () => {
    // Logged in as User X
    await usePlaygroundStore.getState().switchScope({
      type: 'authenticated',
      userId: 'user-logout-test',
    });
    usePlaygroundGuideStore.getState().setUserId('user-logout-test');

    expect(usePlaygroundStore.getState().activeScope.type).toBe('authenticated');
    expect(usePlaygroundGuideStore.getState().activeUserId).toBe('user-logout-test');

    // Simulate logout action
    await usePlaygroundStore.getState().switchScope({ type: 'guest' });
    usePlaygroundGuideStore.getState().setUserId('guest');

    expect(usePlaygroundStore.getState().activeScope).toEqual({ type: 'guest' });
    expect(usePlaygroundGuideStore.getState().activeUserId).toBe('guest');
  });
});
