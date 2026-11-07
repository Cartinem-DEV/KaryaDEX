/**
 * KaryaDEX — Playground Authentication & Identity Observer
 *
 * Synchronizes Supabase authentication state changes with Playground player identity.
 * Handles app boot, login, logout, and multi-user switching without leaking state
 * or exposing previous user data across scopes.
 */

import { authService } from '@/services/auth/authService';
import { usePlaygroundStore } from '@/store/usePlaygroundStore';
import { usePlaygroundGuideStore } from '@/store/usePlaygroundGuideStore';
import { checkGuestClaimEligibility, recoverInterruptedClaimTransaction } from './playgroundClaimManager';
import { migrateLegacyToGuestIfAppropriate } from './playgroundStorage';
import type { PlayerScope } from '@/types/playground';

let isObserverInitialized = false;
let unsubscribeAuth: (() => void) | null = null;
let lastKnownUserId: string | null = null;

export async function initPlaygroundAuthObserver(): Promise<void> {
  if (isObserverInitialized) {
    return;
  }
  isObserverInitialized = true;

  // 0. Recover any interrupted claim transaction from previous crash/restart
  try {
    await recoverInterruptedClaimTransaction();
  } catch (recErr) {
    console.warn('[PlaygroundAuthObserver] Claim recovery warning:', recErr);
  }

  // 1. One-time check for legacy data migration into guest scope
  try {
    await migrateLegacyToGuestIfAppropriate();
  } catch (err) {
    console.warn('[PlaygroundAuthObserver] Legacy check error:', err);
  }

  // 2. Initial resolution based on current auth state
  const currentUser = authService.getCurrentUser();
  lastKnownUserId = currentUser ? currentUser.id : null;

  const initialScope: PlayerScope = currentUser
    ? { type: 'authenticated', userId: currentUser.id }
    : { type: 'guest' };

  // Set initial guide store user ID
  usePlaygroundGuideStore.getState().setUserId(currentUser ? currentUser.id : 'guest');

  // Hydrate initial scope into playground store
  await usePlaygroundStore.getState().switchScope(initialScope);

  // Check for pending guest claim if user is logged in
  if (currentUser) {
    const claimData = await checkGuestClaimEligibility(currentUser.id);
    if (claimData) {
      usePlaygroundStore.getState().setPendingGuestClaim(claimData);
    }
  }

  // 3. Subscribe to future authentication changes
  unsubscribeAuth = authService.subscribe(async (user) => {
    const newUserId = user ? user.id : null;
    if (newUserId === lastKnownUserId) {
      return; // No change in user identity
    }
    lastKnownUserId = newUserId;

    if (user) {
      // User logged in or switched account:
      // 1. Synchronize guide store user
      usePlaygroundGuideStore.getState().setUserId(user.id);

      // 2. Switch playground store scope to authenticated user
      await usePlaygroundStore.getState().switchScope({
        type: 'authenticated',
        userId: user.id,
      });

      // 3. Check if there is unclaimed guest progress to prompt
      const claimData = await checkGuestClaimEligibility(user.id);
      if (claimData) {
        usePlaygroundStore.getState().setPendingGuestClaim(claimData);
      } else {
        usePlaygroundStore.getState().setPendingGuestClaim(null);
      }
    } else {
      // User logged out:
      // 1. Synchronize guide store user to guest
      usePlaygroundGuideStore.getState().setUserId('guest');

      // 2. Clear pending claim prompt
      usePlaygroundStore.getState().setPendingGuestClaim(null);

      // 3. Switch playground store scope to guest
      await usePlaygroundStore.getState().switchScope({ type: 'guest' });
    }
  });
}

export function teardownPlaygroundAuthObserverForTesting(): void {
  if (unsubscribeAuth) {
    unsubscribeAuth();
    unsubscribeAuth = null;
  }
  isObserverInitialized = false;
  lastKnownUserId = null;
}
