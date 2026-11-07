/**
 * KaryaDEX — Guest Progress Claim & Conflict Resolution Manager
 *
 * Implements Phase PG-3A guest-progress claiming into authenticated accounts.
 * Enforces explicit user confirmation (no silent claiming), duplicate protection,
 * destination read-back verification, and preserves conflict snapshots.
 */

import type {
  PlayerScope,
  PlaygroundProfileData,
  ClaimReceipt,
  ClaimResult,
  ClaimRecoveryResult,
  ConflictResolutionOption,
  GuestClaimPromptData,
  MigrationJournalEntry,
} from '@/types/playground';
import {
  readProfileFromStorage,
  writeProfileToStorage,
  createDefaultProfileData,
  createProfileBackup,
  hasMeaningfulProgress,
  calculateProfileFingerprint,
  saveClaimReceipt,
  findReceiptForFingerprint,
  readJournal,
  writeJournal,
  clearJournal,
  CURRENT_PLAYGROUND_STORAGE_VERSION,
} from './playgroundStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlaygroundGuideStore } from '@/store/usePlaygroundGuideStore';

// ═══════════════════════════════════════════════════════════════════════════
// CLAIM ELIGIBILITY & CONFLICT CHECKING
// ═══════════════════════════════════════════════════════════════════════════

export async function checkGuestClaimEligibility(
  destinationUserId: string
): Promise<GuestClaimPromptData | null> {
  if (!destinationUserId) {
    return null;
  }

  const guestScope: PlayerScope = { type: 'guest' };
  const guestProfile = await readProfileFromStorage(guestScope);

  if (!guestProfile || !hasMeaningfulProgress(guestProfile)) {
    return null;
  }

  // Idempotency: verify this exact guest snapshot has not already been claimed by this account
  const fingerprint = calculateProfileFingerprint(guestProfile);
  const existingReceipt = await findReceiptForFingerprint(fingerprint, destinationUserId);
  if (existingReceipt) {
    // Already claimed, do not prompt again
    return null;
  }

  const accountScope: PlayerScope = { type: 'authenticated', userId: destinationUserId };
  const accountProfile = (await readProfileFromStorage(accountScope)) || createDefaultProfileData();

  const hasConflict = hasMeaningfulProgress(accountProfile);
  const mode: 'fresh' | 'conflict' = hasConflict ? 'conflict' : 'fresh';

  return {
    mode,
    guestProfile,
    accountProfile,
    hasConflict,
    destinationUserId,
    guestSummary: {
      totalMatches: guestProfile.totalMatches,
      brainXp: guestProfile.brainXp,
      brainRating: guestProfile.brainRating,
    },
    accountSummary: {
      totalMatches: accountProfile.totalMatches,
      brainXp: accountProfile.brainXp,
      brainRating: accountProfile.brainRating,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TUTORIAL STATE COORDINATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transfers completed or dismissed tutorial lessons from guest to the authenticated user.
 * Preserves any tutorials the user already completed without downgrading.
 */
export function transferGuestTutorialsToAccount(destinationUserId: string): void {
  try {
    const guideStore = usePlaygroundGuideStore.getState();
    const guestTutorials = guideStore.userTutorialStates['guest'] || {};
    const accountTutorials = guideStore.userTutorialStates[destinationUserId] || {};

    const mergedForAccount = { ...accountTutorials };

    for (const [gameKey, guestState] of Object.entries(guestTutorials)) {
      const existingAccountState = accountTutorials[gameKey];

      // If guest completed it and account hasn't, grant completion
      const completed = Boolean(existingAccountState?.completed || guestState.completed);
      const dismissed = Boolean(existingAccountState?.dismissed || guestState.dismissed);

      mergedForAccount[gameKey] = {
        completed,
        dismissed,
        completedAt: existingAccountState?.completedAt || guestState.completedAt || new Date().toISOString(),
      };
    }

    // Also support any tutorials present in completedTutorials list
    if (Array.isArray(guideStore.completedTutorials)) {
      for (const gameKey of guideStore.completedTutorials) {
        if (!mergedForAccount[gameKey]) {
          mergedForAccount[gameKey] = {
            completed: true,
            dismissed: true,
            completedAt: new Date().toISOString(),
          };
        }
      }
    }

    const completedList = Object.entries(mergedForAccount)
      .filter(([_, s]) => s.completed)
      .map(([gameKey]) => gameKey);

    usePlaygroundGuideStore.setState((prev) => ({
      completedTutorials: completedList,
      userTutorialStates: {
        ...prev.userTutorialStates,
        [destinationUserId]: mergedForAccount,
      },
    }));
  } catch (err) {
    console.warn('[PlaygroundClaimManager] Failed to transfer guest tutorials:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPLICIT CLAIM EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Executes a guest progress claim transaction with two-phase verification.
 */
export async function executeGuestClaim(
  destinationUserId: string,
  resolution: ConflictResolutionOption
): Promise<ClaimResult> {
  if (!destinationUserId) {
    return { success: false, resolution, error: 'missing_destination_user_id' };
  }

  // 1. If user chose to decline:
  if (resolution === 'decline') {
    const receiptId = `receipt-decline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const receipt: ClaimReceipt = {
      receiptId,
      sourceScope: 'guest',
      destinationUserId,
      sourceSnapshotFingerprint: 'declined',
      migrationVersion: CURRENT_PLAYGROUND_STORAGE_VERSION,
      status: 'declined',
      createdAt: new Date().toISOString(),
      summary: {
        brainXp: 0,
        brainRating: 1200,
        totalMatches: 0,
        escapeStreak: 0,
        completedQuests: 0,
      },
    };
    await saveClaimReceipt(receipt);
    return { success: true, resolution: 'decline', receiptId, receipt };
  }

  // 2. If user chose to keep their existing account progress:
  if (resolution === 'keep_account') {
    const receiptId = `receipt-keep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const receipt: ClaimReceipt = {
      receiptId,
      sourceScope: 'guest',
      destinationUserId,
      sourceSnapshotFingerprint: 'conflict_kept_account',
      migrationVersion: CURRENT_PLAYGROUND_STORAGE_VERSION,
      status: 'conflict_kept_account',
      createdAt: new Date().toISOString(),
      summary: {
        brainXp: 0,
        brainRating: 1200,
        totalMatches: 0,
        escapeStreak: 0,
        completedQuests: 0,
      },
    };
    await saveClaimReceipt(receipt);
    return { success: true, resolution: 'keep_account', receiptId, receipt };
  }

  // 3. Perform Claim or Replace Account
  const guestScope: PlayerScope = { type: 'guest' };
  const accountScope: PlayerScope = { type: 'authenticated', userId: destinationUserId };

  const guestSnapshot = await readProfileFromStorage(guestScope);
  if (!guestSnapshot || !hasMeaningfulProgress(guestSnapshot)) {
    return { success: false, resolution, error: 'no_meaningful_guest_progress' };
  }

  const fingerprint = calculateProfileFingerprint(guestSnapshot);

  // Idempotency check: prevent duplicate reward claiming
  const priorReceipt = await findReceiptForFingerprint(fingerprint, destinationUserId);
  if (priorReceipt) {
    return {
      success: true,
      resolution,
      receiptId: priorReceipt.receiptId,
      receipt: priorReceipt,
      error: 'already_claimed',
    };
  }

  const journalId = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let destinationBackupKey: string | undefined;

  try {
    // Phase 1: PREPARE & BACKUP
    const prepareJournal: MigrationJournalEntry = {
      id: journalId,
      phase: 'PREPARE',
      sourceKey: 'karyadex_playground_v2:guest',
      destinationKey: `karyadex_playground_v2:user:${destinationUserId}`,
      timestamp: new Date().toISOString(),
      payloadFingerprint: fingerprint,
    };
    await writeJournal(prepareJournal);

    // If replacing an existing account profile, preserve a full backup of it first
    if (resolution === 'replace_account') {
      destinationBackupKey = await createProfileBackup(accountScope, 'pre_replace_backup');
      prepareJournal.destinationBackupKey = destinationBackupKey;
      prepareJournal.phase = 'SNAPSHOT';
      await writeJournal(prepareJournal);
    }

    // Phase 2: VALIDATE SOURCE
    prepareJournal.phase = 'VALIDATE';
    await writeJournal(prepareJournal);

    // Construct destination profile: preserve exact validated guest stats
    const destinationProfile: PlaygroundProfileData = {
      ...guestSnapshot,
      version: CURRENT_PLAYGROUND_STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
    };

    // Phase 3: WRITE DESTINATION
    prepareJournal.phase = 'WRITE_DESTINATION';
    await writeJournal(prepareJournal);
    await writeProfileToStorage(accountScope, destinationProfile);

    // Phase 4: READ-BACK VERIFICATION
    prepareJournal.phase = 'VERIFY';
    await writeJournal(prepareJournal);

    const verified = await readProfileFromStorage(accountScope);
    if (
      !verified ||
      verified.brainXp !== guestSnapshot.brainXp ||
      verified.brainRating !== guestSnapshot.brainRating ||
      verified.totalMatches !== guestSnapshot.totalMatches ||
      verified.escapeStreak !== guestSnapshot.escapeStreak
    ) {
      throw new Error('Destination read-back verification mismatch');
    }

    // Phase 5: TRANSFER TUTORIAL COMPLETION
    prepareJournal.phase = 'TRANSFER_TUTORIALS';
    await writeJournal(prepareJournal);
    transferGuestTutorialsToAccount(destinationUserId);

    // Phase 6: GENERATE & SAVE CLAIM RECEIPT
    prepareJournal.phase = 'RECEIPT';
    await writeJournal(prepareJournal);
    const receiptStatus = resolution === 'replace_account' ? 'conflict_replaced_account' : 'completed';
    const receiptId = `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const receipt: ClaimReceipt = {
      receiptId,
      sourceScope: 'guest',
      destinationUserId,
      sourceSnapshotFingerprint: fingerprint,
      migrationVersion: CURRENT_PLAYGROUND_STORAGE_VERSION,
      status: receiptStatus,
      createdAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      destinationVerified: true,
      preClaimAccountBackupKey: destinationBackupKey,
      summary: {
        brainXp: guestSnapshot.brainXp,
        brainRating: guestSnapshot.brainRating,
        totalMatches: guestSnapshot.totalMatches,
        escapeStreak: guestSnapshot.escapeStreak,
        completedQuests: guestSnapshot.dailyQuests.filter((q) => q.completed).length,
      },
    };
    await saveClaimReceipt(receipt);

    // Phase 7: RESET ACTIVE GUEST SCOPE (Only after destination is fully verified and receipt saved)
    prepareJournal.phase = 'RESET_GUEST';
    await writeJournal(prepareJournal);
    await writeProfileToStorage(guestScope, createDefaultProfileData());

    // Phase 8: SUCCESS & CLEANUP
    prepareJournal.phase = 'SUCCESS';
    await writeJournal(prepareJournal);
    await clearJournal();

    return {
      success: true,
      resolution,
      receiptId,
      receipt,
    };
  } catch (err: any) {
    console.error('[PlaygroundClaimManager] Claim transaction failed:', err);

    // Rollback destination if a backup existed and write failed
    if (destinationBackupKey && resolution === 'replace_account') {
      try {
        const rawBackup = await (await import('@react-native-async-storage/async-storage')).default.getItem(
          destinationBackupKey
        );
        if (rawBackup) {
          await writeProfileToStorage(accountScope, JSON.parse(rawBackup));
        }
      } catch (rbErr) {
        console.error('[PlaygroundClaimManager] Failed to rollback destination:', rbErr);
      }
    }

    // Log journal failure
    await writeJournal({
      id: journalId,
      phase: 'ROLLED_BACK',
      sourceKey: 'karyadex_playground_v2:guest',
      destinationKey: `karyadex_playground_v2:user:${destinationUserId}`,
      timestamp: new Date().toISOString(),
      destinationBackupKey,
    }).catch(() => {});

    return {
      success: false,
      resolution,
      error: err?.message || 'claim_failed_verification',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CRASH RECOVERY (FAUL-TOLERANT RESTART RESOLUTION)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Recovers an interrupted claim transaction after an unexpected crash, power interruption,
 * or process termination. Guarantees:
 * 1. Guest progress is not silently lost.
 * 2. Existing account progress is not destroyed.
 * 3. Partially completed claims are either rolled forward safely or rolled back safely.
 * 4. The migration journal reaches a clean terminal state.
 */
export async function recoverInterruptedClaimTransaction(): Promise<ClaimRecoveryResult> {
  try {
    const journal = await readJournal();
    if (!journal) {
      return { recovered: false, action: 'none' };
    }

    const { phase, sourceKey, destinationKey, destinationBackupKey, payloadFingerprint } = journal;

    // Phases 1..3: PREPARE, SNAPSHOT, VALIDATE -> Destination was never modified yet
    if (phase === 'PREPARE' || phase === 'SNAPSHOT' || phase === 'VALIDATE') {
      await clearJournal();
      return { recovered: true, action: 'rolled_back', journalEntry: journal };
    }

    // Phase 4: WRITE_DESTINATION -> Destination might be half-written or unverified
    if (phase === 'WRITE_DESTINATION') {
      if (destinationBackupKey) {
        const rawBackup = await AsyncStorage.getItem(destinationBackupKey);
        if (rawBackup) {
          await AsyncStorage.setItem(destinationKey, rawBackup);
        }
      } else {
        await AsyncStorage.setItem(destinationKey, JSON.stringify(createDefaultProfileData()));
      }
      await clearJournal();
      return { recovered: true, action: 'rolled_back', journalEntry: journal };
    }

    // Phase 9: SUCCESS or ROLLED_BACK -> Terminal states, just clean up journal
    if (phase === 'SUCCESS' || phase === 'ROLLED_BACK') {
      await clearJournal();
      return { recovered: true, action: 'cleaned_up', journalEntry: journal };
    }

    // Phases 5..8: VERIFY, TRANSFER_TUTORIALS, RECEIPT, RESET_GUEST
    if (
      phase === 'VERIFY' ||
      phase === 'TRANSFER_TUTORIALS' ||
      phase === 'RECEIPT' ||
      phase === 'RESET_GUEST'
    ) {
      const rawDest = await AsyncStorage.getItem(destinationKey);
      const rawSource = await AsyncStorage.getItem(sourceKey);

      if (rawDest && rawSource) {
        let parsedDest: any = null;
        let parsedSource: any = null;
        try {
          parsedDest = JSON.parse(rawDest);
          parsedSource = JSON.parse(rawSource);
        } catch {
          // Corrupt JSON during write
        }

        const destMatchesSource =
          parsedDest &&
          parsedSource &&
          parsedDest.brainXp === parsedSource.brainXp &&
          parsedDest.totalMatches === parsedSource.totalMatches &&
          parsedDest.escapeStreak === parsedSource.escapeStreak;

        if (destMatchesSource) {
          // Destination is fully valid: Roll forward
          const destUserId = destinationKey.replace('karyadex_playground_v2:user:', '');
          const fingerprint = payloadFingerprint || calculateProfileFingerprint(parsedSource);

          // Transfer tutorials if needed
          transferGuestTutorialsToAccount(destUserId);

          // Ensure receipt exists
          const existingReceipt = await findReceiptForFingerprint(fingerprint, destUserId);
          if (!existingReceipt) {
            const receiptId = `receipt-recovered-${Date.now()}`;
            await saveClaimReceipt({
              receiptId,
              sourceScope: 'guest',
              destinationUserId: destUserId,
              sourceSnapshotFingerprint: fingerprint,
              migrationVersion: CURRENT_PLAYGROUND_STORAGE_VERSION,
              status: destinationBackupKey ? 'conflict_replaced_account' : 'completed',
              createdAt: new Date().toISOString(),
              verifiedAt: new Date().toISOString(),
              destinationVerified: true,
              preClaimAccountBackupKey: destinationBackupKey,
              summary: {
                brainXp: parsedSource.brainXp,
                brainRating: parsedSource.brainRating,
                totalMatches: parsedSource.totalMatches,
                escapeStreak: parsedSource.escapeStreak,
                completedQuests: (parsedSource.dailyQuests || []).filter((q: any) => q.completed).length,
              },
            });
          }

          // Reset guest partition
          await AsyncStorage.setItem(sourceKey, JSON.stringify(createDefaultProfileData()));
          await clearJournal();
          return { recovered: true, action: 'rolled_forward', journalEntry: journal };
        }
      }

      // Verification failed or destination mismatch: rollback destination to backup
      if (destinationBackupKey) {
        const rawBackup = await AsyncStorage.getItem(destinationBackupKey);
        if (rawBackup) {
          await AsyncStorage.setItem(destinationKey, rawBackup);
        }
      }
      await clearJournal();
      return { recovered: true, action: 'rolled_back', journalEntry: journal };
    }

    await clearJournal();
    return { recovered: false, action: 'none', journalEntry: journal };
  } catch (err: any) {
    console.error('[PlaygroundClaimManager] Crash recovery error:', err);
    return { recovered: false, action: 'none', error: err?.message };
  }
}
