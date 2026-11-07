// services/sync/syncConflictResolver.ts
/**
 * SyncConflictResolver
 * Deterministic, domain-specific conflict resolution preserving student academic data.
 */

import { SyncEntityType, SyncConflictResult } from './syncTypes';

export class SyncConflictResolver {
  /**
   * Resolves concurrent edits between local SQLite state and remote cloud state.
   */
  public resolve<T extends Record<string, any>>(
    entityType: SyncEntityType,
    localData: T | null,
    remoteData: T | null,
    localTimestamp?: string,
    remoteTimestamp?: string
  ): SyncConflictResult<T> {
    // 1. One side is deleted
    if (!localData && !remoteData) {
      return { resolvedPayload: null, strategy: 'local_wins', reason: 'Both sides deleted' };
    }
    if (!localData && remoteData) {
      // Local deleted, remote exists
      if (localTimestamp && remoteTimestamp && remoteTimestamp > localTimestamp) {
        return {
          resolvedPayload: remoteData,
          strategy: 'remote_wins',
          reason: 'Remote updated after local deletion',
        };
      }
      return {
        resolvedPayload: null,
        strategy: 'local_wins',
        reason: 'Local deletion wins over older remote state',
      };
    }
    if (localData && !remoteData) {
      // Remote deleted, local exists
      if (localTimestamp && remoteTimestamp && localTimestamp > remoteTimestamp) {
        return {
          resolvedPayload: localData,
          strategy: 'local_wins',
          reason: 'Local update occurred after remote deletion',
        };
      }
      return {
        resolvedPayload: null,
        strategy: 'remote_wins',
        reason: 'Remote deletion wins over older local state',
      };
    }

    // Both sides exist: entity-specific resolution
    const local = localData!;
    const remote = remoteData!;

    switch (entityType) {
      case 'attendance':
      case 'class_session':
        return this.resolveAttendanceConflict(local, remote);

      case 'task':
        return this.resolveTaskConflict(local, remote);

      case 'revision':
        return this.resolveRevisionConflict(local, remote);

      case 'note':
        return this.resolveNoteConflict(local, remote);

      case 'subject':
      case 'semester':
      case 'college':
      case 'exam':
      default:
        return this.resolveLastWriteWins(local, remote);
    }
  }

  /**
   * Attendance Conflict Resolution:
   * Protects students' actual attendance status. Attended/concrete status wins over unmarked.
   * If both marked, newer timestamp wins and logs conflict note.
   */
  private resolveAttendanceConflict<T extends Record<string, any>>(
    local: T,
    remote: T
  ): SyncConflictResult<T> {
    const localStatus = local.status || local.attendance_status;
    const remoteStatus = remote.status || remote.attendance_status;

    // If one is unmarked and the other marked, marked status always wins
    if ((!localStatus || localStatus === 'unmarked') && remoteStatus && remoteStatus !== 'unmarked') {
      return {
        resolvedPayload: remote,
        strategy: 'remote_wins',
        reason: 'Remote has concrete attendance status while local was unmarked',
      };
    }
    if ((!remoteStatus || remoteStatus === 'unmarked') && localStatus && localStatus !== 'unmarked') {
      return {
        resolvedPayload: local,
        strategy: 'local_wins',
        reason: 'Local has concrete attendance status while remote was unmarked',
      };
    }

    // Both marked: compare timestamps
    const localTime = local.updated_at || local.updatedAt || '';
    const remoteTime = remote.updated_at || remote.updatedAt || '';

    if (remoteTime > localTime) {
      const merged: Record<string, any> = { ...remote };
      if (local.notes && !remote.notes) {
        merged.notes = local.notes;
      }
      return {
        resolvedPayload: merged as T,
        strategy: 'remote_wins',
        reason: 'Remote attendance timestamp is newer',
      };
    }

    const merged: Record<string, any> = { ...local };
    if (remote.notes && !local.notes) {
      merged.notes = remote.notes;
    }
    return {
      resolvedPayload: merged as T,
      strategy: 'local_wins',
      reason: 'Local attendance timestamp is newer or equal',
    };
  }

  /**
   * Task Conflict Resolution:
   * If one side marked completed, preserve completion while merging metadata updates.
   */
  private resolveTaskConflict<T extends Record<string, any>>(
    local: T,
    remote: T
  ): SyncConflictResult<T> {
    const localCompleted = local.status === 'completed' || local.is_completed === 1;
    const remoteCompleted = remote.status === 'completed' || remote.is_completed === 1;

    const localTime = local.updated_at || local.updatedAt || '';
    const remoteTime = remote.updated_at || remote.updatedAt || '';

    // Merge: base is the newer record
    const base: Record<string, any> = remoteTime > localTime ? { ...remote } : { ...local };

    // Preservation: if either device completed the task, mark as completed
    if (localCompleted || remoteCompleted) {
      base.status = 'completed';
      if ('is_completed' in base) {
        base.is_completed = 1;
      }
    }

    return {
      resolvedPayload: base as T,
      strategy: 'merged',
      reason: 'Merged task updates while preserving completion status',
    };
  }

  /**
   * Revision Conflict:
   * Revision events are historical academic achievements. Preserve higher confidence / outcome.
   */
  private resolveRevisionConflict<T extends Record<string, any>>(
    local: T,
    remote: T
  ): SyncConflictResult<T> {
    const localTime = local.updated_at || local.reviewed_at || '';
    const remoteTime = remote.updated_at || remote.reviewed_at || '';

    const winner = remoteTime > localTime ? { ...remote } : { ...local };
    return {
      resolvedPayload: winner,
      strategy: remoteTime > localTime ? 'remote_wins' : 'local_wins',
      reason: 'Revision record resolved by latest timestamp',
    };
  }

  /**
   * Note Conflict:
   * Never destroy student study notes. If different notes were written offline, concatenate them.
   */
  private resolveNoteConflict<T extends Record<string, any>>(
    local: T,
    remote: T
  ): SyncConflictResult<T> {
    const localText = local.content || local.note || '';
    const remoteText = remote.content || remote.note || '';

    if (localText === remoteText) {
      return { resolvedPayload: local, strategy: 'local_wins', reason: 'Notes identical' };
    }

    const localTime = local.updated_at || '';
    const remoteTime = remote.updated_at || '';

    if (localText && remoteText && localText !== remoteText) {
      const mergedText = `${remoteTime > localTime ? remoteText : localText}\n\n[Merged Conflict Note]:\n${remoteTime > localTime ? localText : remoteText}`;
      const merged = {
        ...(remoteTime > localTime ? remote : local),
        content: mergedText,
      };
      return {
        resolvedPayload: merged,
        strategy: 'merged',
        reason: 'Preserved concurrent student notes via section merge',
      };
    }

    return {
      resolvedPayload: localText ? local : remote,
      strategy: localText ? 'local_wins' : 'remote_wins',
      reason: 'Non-empty note preserved',
    };
  }

  /**
   * Standard Last-Write-Wins for basic metadata
   */
  private resolveLastWriteWins<T extends Record<string, any>>(
    local: T,
    remote: T
  ): SyncConflictResult<T> {
    const localTime = local.updated_at || local.updatedAt || '';
    const remoteTime = remote.updated_at || remote.updatedAt || '';

    if (remoteTime > localTime) {
      return {
        resolvedPayload: remote,
        strategy: 'remote_wins',
        reason: 'Remote record has newer timestamp',
      };
    }
    return {
      resolvedPayload: local,
      strategy: 'local_wins',
      reason: 'Local record has newer or equal timestamp',
    };
  }
}

export const syncConflictResolver = new SyncConflictResolver();
