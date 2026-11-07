// services/sync/syncService.ts
/**
 * SyncService
 * Central synchronization coordinator for BunkMatKar.
 * Manages push, pull, conflict resolution, retry handling, and sync status state.
 * Offline-first: SQLite is the local source of truth; sync runs in the background.
 */

import { getDatabaseConnection } from '../../database/db';
import { hydrateStoresFromDatabase } from '../../database/DatabaseProvider';
import { AuthService } from '../auth/authService';
import {
  SyncEntityType,
  SyncOperation,
  SyncResult,
  SyncState,
  SyncStatus,
  CloudRecord,
} from './syncTypes';
import { syncQueueRepository } from './syncQueueRepository';
import { syncTombstoneRepository } from './syncTombstoneRepository';
import { syncConflictResolver } from './syncConflictResolver';
import { ICloudBackendAdapter, simulatedCloudAdapter } from './cloudBackendAdapter';
import { supabaseCloudBackendAdapter } from './supabaseCloudBackendAdapter';
import { lockinSupabaseSyncAdapter, LockinSyncEntityType } from '../lockin/lockinSync';
import { isSupabaseConfigured } from '../supabase/supabaseConfig';
import { addBreadcrumb, captureException } from '@/services/monitoring/sentryService';

const ENTITY_TABLE_MAP: Record<SyncEntityType, string> = {
  task: 'tasks',
  subject: 'subjects',
  exam: 'exams',
  class_session: 'class_sessions',
  attendance: 'attendance_records',
  revision: 'revision_records',
  note: 'notes',
  semester: 'semesters',
  college: 'colleges',
  student: 'students',
  timetable_slot: 'timetable_slots',
  topic: 'topics',
  // Lockin entities
  lockin_session: 'lockin_sessions',
  lockin_streak: 'lockin_streaks',
  lockin_exam_preset: 'lockin_exam_presets',
  lockin_blocked_app: 'lockin_blocked_apps',
  lockin_yt_channel: 'lockin_yt_channels',
  lockin_schedule: 'lockin_schedules',
  lockin_app_quota: 'lockin_app_quotas',
  lockin_reality_check: 'lockin_reality_checks',
  lockin_emergency_pass: 'lockin_emergency_passes',
};

export class SyncService {
  private static instance: SyncService;
  private cloudAdapter: ICloudBackendAdapter;
  private state: SyncState = {
    status: 'synced',
    lastSyncedAt: null,
    pendingCount: 0,
    error: null,
    isOnline: true,
  };
  private isSyncing = false;
  private syncTimeout: any = null;
  private listeners: ((state: SyncState) => void)[] = [];

  private constructor(adapter?: ICloudBackendAdapter) {
    if (adapter) {
      this.cloudAdapter = adapter;
    } else if (isSupabaseConfigured()) {
      this.cloudAdapter = supabaseCloudBackendAdapter;
    } else {
      this.cloudAdapter = simulatedCloudAdapter;
    }
  }

  public static getInstance(adapter?: ICloudBackendAdapter): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService(adapter);
    }
    return SyncService.instance;
  }

  public static resetInstance(): void {
    if (SyncService.instance) {
      if (SyncService.instance.syncTimeout) {
        clearTimeout(SyncService.instance.syncTimeout);
      }
      SyncService.instance.listeners = [];
      SyncService.instance.isSyncing = false;
    }
    SyncService.instance = undefined as any;
  }

  /**
   * Initializes sync service, hooks to auth changes, and refreshes pending counts.
   */
  public async init(): Promise<void> {
    AuthService.getInstance().subscribe(user => {
      if (user) {
        this.updatePendingCount(user.id);
        // Trigger initial sync on sign-in
        this.scheduleSync(100);
      } else {
        this.state.status = 'synced';
        this.state.pendingCount = 0;
        this.notifyListeners();
      }
    });

    const user = AuthService.getInstance().getCurrentUser();
    if (user) {
      await this.updatePendingCount(user.id);
    }
  }

  public subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener);
    listener({ ...this.state });
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.state });
      } catch (err) {
        console.error('[SyncService] Listener error:', err);
      }
    }
  }

  public getSyncState(): SyncState {
    return { ...this.state };
  }

  public async setOnline(isOnline: boolean): Promise<void> {
    this.state.isOnline = isOnline;
    if (this.cloudAdapter === simulatedCloudAdapter) {
      simulatedCloudAdapter.setOnline(isOnline);
    }
    if (!isOnline) {
      this.state.status = this.state.pendingCount > 0 ? 'pending' : 'offline';
      this.notifyListeners();
    } else {
      // Reconnected: trigger sync if user authenticated
      if (AuthService.getInstance().isAuthenticated()) {
        await this.sync();
      }
    }
  }

  /**
   * Enqueues a local mutation to be synchronized to the cloud.
   */
  public async queueMutation(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
    payload?: any
  ): Promise<void> {
    const user = AuthService.getInstance().getCurrentUser();
    if (!user) {
      // Offline / unauthenticated mode: SQLite is local source of truth; no sync queue
      return;
    }

    if (operation === 'DELETE') {
      await syncTombstoneRepository.addTombstone(user.id, entityType, entityId);
    }

    await syncQueueRepository.enqueue(user.id, entityType, entityId, operation, payload);
    await this.updatePendingCount(user.id);

    // Schedule background sync
    this.scheduleSync(500);
  }

  private scheduleSync(delayMs = 1000): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      this.sync().catch(err => console.warn('[SyncService] Background sync failed:', err));
    }, delayMs);
  }

  private async updatePendingCount(userId: string): Promise<number> {
    const count = await syncQueueRepository.getPendingCount(userId);
    this.state.pendingCount = count;
    if (count > 0 && this.state.status !== 'syncing') {
      this.state.status = 'pending';
    } else if (count === 0 && this.state.status === 'pending') {
      this.state.status = 'synced';
    }
    this.notifyListeners();
    return count;
  }

  /**
   * Performs full bidirectional sync: PUSH local mutations, then PULL remote updates.
   */
  public async sync(): Promise<SyncResult> {
    const user = AuthService.getInstance().getCurrentUser();
    const result: SyncResult = {
      success: true,
      pushedCount: 0,
      pulledCount: 0,
      conflictCount: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    if (!user) {
      // Unauthenticated: nothing to sync
      this.state.status = 'synced';
      this.notifyListeners();
      return result;
    }

    const online = await this.cloudAdapter.isOnline();
    if (!online) {
      this.state.isOnline = false;
      this.state.status = this.state.pendingCount > 0 ? 'pending' : 'offline';
      this.notifyListeners();
      return {
        ...result,
        success: false,
        errors: ['Network is currently offline'],
      };
    }

    if (this.isSyncing) {
      return result;
    }

    this.isSyncing = true;
    this.state.status = 'syncing';
    this.state.error = null;
    this.notifyListeners();

    // Sentry: Add breadcrumb for sync start
    addBreadcrumb({
      category: 'sync',
      message: `Starting sync for user ${user.id}`,
      level: 'info',
      data: { pendingCount: this.state.pendingCount, userId: user.id },
    });

    try {
      const db = await getDatabaseConnection();

      // ─── 1. PUSH STEP ──────────────────────────────────────────────
      const queueItems = await syncQueueRepository.peek(user.id, 100);
      for (const item of queueItems) {
        try {
          const pushRes = await this.cloudAdapter.pushRecord(
            user.id,
            item.entityType,
            item.entityId,
            item.operation,
            item.payload
          );

          if (pushRes.success) {
            await syncQueueRepository.dequeue(item.id);
            result.pushedCount++;
          } else {
            await syncQueueRepository.markFailed(item.id, pushRes.error || 'Push rejected');
            result.errors.push(`Failed to push ${item.entityType}:${item.entityId}: ${pushRes.error}`);
          }
        } catch (pushErr: any) {
          await syncQueueRepository.markFailed(item.id, pushErr.message || 'Push error');
          result.errors.push(pushErr.message);
          break; // Stop further pushing if network dropped mid-push
        }
      }

      // ─── 2. PULL STEP ──────────────────────────────────────────────
      const lastSyncedAt = this.state.lastSyncedAt || undefined;
      const pullRes = await this.cloudAdapter.pullChanges(user.id, lastSyncedAt);

      // Process remote tombstones
      for (const tombstone of pullRes.tombstones) {
        await syncTombstoneRepository.addTombstone(
          user.id,
          tombstone.entityType,
          tombstone.entityId,
          tombstone.deletedAt
        );

        const table = ENTITY_TABLE_MAP[tombstone.entityType];
        if (table) {
          try {
            await db.runAsync(`DELETE FROM ${table} WHERE id = ?;`, [tombstone.entityId]);
            result.pulledCount++;
          } catch {
            // Table might not exist in some partial contexts
          }
        }
      }

      // Process remote records
      for (const remoteRecord of pullRes.records) {
        const isTombstoned = await syncTombstoneRepository.isTombstoned(
          user.id,
          remoteRecord.entityType,
          remoteRecord.id
        );

        if (isTombstoned) {
          // Local record was deleted; check if remote update is newer than local deletion
          const tombstone = await syncTombstoneRepository.getTombstone(
            user.id,
            remoteRecord.entityType,
            remoteRecord.id
          );
          if (tombstone && tombstone.deletedAt >= remoteRecord.updatedAt) {
            // Local deletion wins over older remote update: ignore remote record!
            continue;
          }
        }

        const table = ENTITY_TABLE_MAP[remoteRecord.entityType];
        if (!table) continue;

        // Fetch current local state
        const localRow = await db.getFirstAsync<any>(
          `SELECT * FROM ${table} WHERE id = ?;`,
          [remoteRecord.id]
        );

        let finalPayload = remoteRecord.payload;

        if (localRow) {
          // Potential conflict: run deterministic conflict resolver
          const conflict = syncConflictResolver.resolve(
            remoteRecord.entityType,
            localRow,
            remoteRecord.payload,
            localRow.updated_at,
            remoteRecord.updatedAt
          );

          if (conflict.strategy !== 'remote_wins') {
            result.conflictCount++;
          }

          if (conflict.resolvedPayload === null) {
            // Delete won
            await db.runAsync(`DELETE FROM ${table} WHERE id = ?;`, [remoteRecord.id]);
            continue;
          }

          finalPayload = conflict.resolvedPayload;
        }

        // Apply finalPayload to local SQLite table
        await this.upsertLocalRecord(table, remoteRecord.id, finalPayload, user.id);
        result.pulledCount++;
      }

      // Update sync metadata and state
      this.state.lastSyncedAt = pullRes.serverTimestamp;
      await this.saveSyncMetadata(user.id, pullRes.serverTimestamp);

      // Re-hydrate stores if any changes were pulled
      if (result.pulledCount > 0) {
        try {
          await hydrateStoresFromDatabase();
        } catch {
          // Ignore hydration error during isolated tests
        }
      }

      const remainingPending = await this.updatePendingCount(user.id);
      this.state.status = remainingPending > 0 ? 'pending' : 'synced';

      // Sentry: Record sync completion
      addBreadcrumb({
        category: 'sync',
        message: `Sync completed: ${result.pushedCount} pushed, ${result.pulledCount} pulled`,
        level: 'info',
        data: {
          pushedCount: result.pushedCount,
          pulledCount: result.pulledCount,
          conflictCount: result.conflictCount,
          success: true,
        },
      });
    } catch (syncError: any) {
      result.success = false;
      result.errors.push(syncError.message || 'Sync failed');
      this.state.error = syncError.message;
      this.state.status = 'error';

      // Sentry: Capture sync errors
      addBreadcrumb({
        category: 'sync',
        message: `Sync failed: ${syncError.message}`,
        level: 'error',
        data: {
          pushedCount: result.pushedCount,
          pulledCount: result.pulledCount,
          conflictCount: result.conflictCount,
          error: syncError.message,
        },
      });

      captureException(syncError, {
        userId: user.id,
        pushedCount: result.pushedCount,
        pulledCount: result.pulledCount,
        error: syncError.message,
      });
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }

    return result;
  }

  /**
   * Whitelist of tables permitted for cloud synchronization
   */
  private static readonly ALLOWED_SYNC_TABLES = new Set([
    'semesters',
    'subjects',
    'tasks',
    'class_sessions',
    'exams',
    'revision_records',
    'timetable_slots',
    'attendance_records',
    'students',
    'colleges',
    'notes',
    // Lockin tables
    'lockin_sessions',
    'lockin_streaks',
    'lockin_exam_presets',
    'lockin_blocked_apps',
    'lockin_yt_channels',
  ]);

  private static readonly SAFE_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

  /**
   * Upsert a remote record into local SQLite safely.
   * Enforces strict table whitelisting, column name verification, and parameterized escaping.
   */
  private async upsertLocalRecord(
    table: string,
    id: string,
    payload: Record<string, any>,
    userId: string
  ): Promise<void> {
    if (!SyncService.ALLOWED_SYNC_TABLES.has(table)) {
      console.warn(`[SyncService] Blocked unauthorized sync table: ${table}`);
      return;
    }

    const db = await getDatabaseConnection();
    const data: Record<string, any> = { ...payload, id, user_id: userId };

    // Filter and strictly validate column names against SQL injection
    const keys = Object.keys(data).filter(
      k => k !== 'id' && SyncService.SAFE_IDENTIFIER_REGEX.test(k)
    );

    if (keys.length === 0) {
      return;
    }

    const escapedCols = keys.join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const updateClauses = keys.map(k => `${k} = excluded.${k}`).join(', ');

    const sql = `
      INSERT INTO ${table} (id, ${escapedCols})
      VALUES (?, ${placeholders})
      ON CONFLICT(id) DO UPDATE SET ${updateClauses};
    `;

    const values = [
      id,
      ...keys.map(k => {
        const val = data[k];
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return val ?? null;
      }),
    ];

    try {
      await db.runAsync(sql, values);
    } catch (err) {
      console.warn(`[SyncService] Failed to upsert ${table}:${id}`, err);
    }
  }

  private async saveSyncMetadata(userId: string, timestamp: string): Promise<void> {
    const db = await getDatabaseConnection();
    try {
      await db.runAsync(
        `INSERT INTO sync_metadata (user_id, table_name, last_synced_at, last_server_version)
         VALUES (?, 'ALL', ?, 1)
         ON CONFLICT(user_id, table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at;`,
        [userId, timestamp]
      );
    } catch {
      // Ignore in mock db
    }
  }
}

export const syncService = SyncService.getInstance();
