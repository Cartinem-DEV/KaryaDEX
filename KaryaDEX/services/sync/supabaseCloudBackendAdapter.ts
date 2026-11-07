// services/sync/supabaseCloudBackendAdapter.ts
/**
 * SupabaseCloudBackendAdapter (Phase 10.5)
 * Real Supabase implementation of ICloudBackendAdapter.
 * Bridges BunkMatKar's Sync Engine with Supabase PostgreSQL and Row-Level Security.
 */

import { getSupabaseClient } from '../supabase/supabaseClient';
import { isSupabaseConfigured } from '../supabase/supabaseConfig';
import type { ICloudBackendAdapter } from './cloudBackendAdapter';
import type {
  CloudRecord,
  SyncEntityType,
  SyncOperation,
  SyncTombstone,
} from './syncTypes';

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

export class SupabaseCloudBackendAdapter implements ICloudBackendAdapter {
  private static instance: SupabaseCloudBackendAdapter;

  public static getInstance(): SupabaseCloudBackendAdapter {
    if (!SupabaseCloudBackendAdapter.instance) {
      SupabaseCloudBackendAdapter.instance = new SupabaseCloudBackendAdapter();
    }
    return SupabaseCloudBackendAdapter.instance;
  }

  public async isOnline(): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return false;
    }
    try {
      // Lightweight connectivity check
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      return Boolean(data);
    } catch {
      return false;
    }
  }

  public async pushRecord(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
    payload?: any
  ): Promise<{ success: boolean; remoteVersion: number; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, remoteVersion: 0, error: 'Supabase is not configured' };
    }

    const table = ENTITY_TABLE_MAP[entityType];
    if (!table) {
      return { success: false, remoteVersion: 0, error: `Unknown entity type: ${entityType}` };
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    try {
      if (operation === 'DELETE') {
        // 1. Delete entity from PostgreSQL table
        const { error: delError } = await supabase
          .from(table)
          .delete()
          .eq('id', entityId)
          .eq('user_id', userId);

        if (delError) {
          return { success: false, remoteVersion: 0, error: delError.message };
        }

        // 2. Record tombstone in sync_tombstones table
        const { error: tombError } = await supabase
          .from('sync_tombstones')
          .upsert(
            {
              entity_type: entityType,
              entity_id: entityId,
              user_id: userId,
              deleted_at: now,
            },
            { onConflict: 'entity_type,entity_id,user_id' }
          );

        if (tombError) {
          console.warn('[SupabaseCloudBackendAdapter] Failed to record remote tombstone:', tombError);
        }

        return { success: true, remoteVersion: 1 };
      }

      // CREATE or UPDATE: prepare sanitized row
      const row = {
        ...(payload || {}),
        id: entityId,
        user_id: userId,
        updated_at: payload?.updated_at || now,
      };

      const { error: upsertError } = await supabase
        .from(table)
        .upsert(row, { onConflict: 'id' });

      if (upsertError) {
        return { success: false, remoteVersion: 0, error: upsertError.message };
      }

      // Remove any prior remote tombstone if recreated
      await supabase
        .from('sync_tombstones')
        .delete()
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('user_id', userId);

      return { success: true, remoteVersion: 1 };
    } catch (err: any) {
      return {
        success: false,
        remoteVersion: 0,
        error: err.message || 'Network error pushing record to Supabase',
      };
    }
  }

  public async pullChanges(
    userId: string,
    sinceTimestamp?: string
  ): Promise<{
    records: CloudRecord[];
    tombstones: SyncTombstone[];
    serverTimestamp: string;
  }> {
    const serverTimestamp = new Date().toISOString();
    if (!isSupabaseConfigured()) {
      return { records: [], tombstones: [], serverTimestamp };
    }

    const supabase = getSupabaseClient();
    const records: CloudRecord[] = [];
    const tombstones: SyncTombstone[] = [];

    try {
      // 1. Pull remote tombstones
      let tombQuery = supabase
        .from('sync_tombstones')
        .select('*')
        .eq('user_id', userId);

      if (sinceTimestamp) {
        tombQuery = tombQuery.gt('deleted_at', sinceTimestamp);
      }

      const { data: tombData, error: tombError } = await tombQuery;
      if (!tombError && tombData) {
        for (const t of tombData) {
          tombstones.push({
            entityType: t.entity_type as SyncEntityType,
            entityId: t.entity_id,
            userId: t.user_id,
            deletedAt: t.deleted_at,
          });
        }
      }

      // 2. Pull incremental updates for each canonical entity table
      const entityTypes = Object.keys(ENTITY_TABLE_MAP) as SyncEntityType[];
      for (const entityType of entityTypes) {
        const table = ENTITY_TABLE_MAP[entityType];
        let query = supabase.from(table).select('*').eq('user_id', userId);

        if (sinceTimestamp) {
          query = query.gt('updated_at', sinceTimestamp);
        }

        const { data: rows, error: rowError } = await query;
        if (!rowError && rows) {
          for (const row of rows) {
            records.push({
              id: row.id,
              userId: row.user_id,
              entityType,
              payload: row,
              version: 1,
              updatedAt: row.updated_at || serverTimestamp,
            });
          }
        }
      }

      return {
        records,
        tombstones,
        serverTimestamp,
      };
    } catch (err: any) {
      console.warn('[SupabaseCloudBackendAdapter] Pull changes warning:', err);
      return { records, tombstones, serverTimestamp };
    }
  }
}

export const supabaseCloudBackendAdapter = SupabaseCloudBackendAdapter.getInstance();
