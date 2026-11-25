/**
 * KaryaDEX — Lockin Supabase Sync Adapter
 *
 * Real Supabase implementation for syncing Lockin sessions, streaks, and exam presets.
 * Bridges KaryaDEX's Lockin Storage with Supabase PostgreSQL and Row-Level Security.
 */

import { getSupabaseClient } from '../supabase/supabaseClient';
import { isSupabaseConfigured } from '../supabase/supabaseConfig';
import type { ICloudBackendAdapter } from '../sync/cloudBackendAdapter';
import type {
  CloudRecord,
  SyncEntityType,
  SyncOperation,
  SyncTombstone,
} from '../sync/syncTypes';
import type {
  LockinSession,
  LockinStreak,
  LockinExamPreset,
  LockinBlockedApp,
  LockinYtChannel,
  LockinSchedule,
  LockinAppQuota,
  LockinRealityCheck,
  LockinEmergencyPass,
} from '@/types/lockin';

// Extended entity types for lockin
export type LockinSyncEntityType =
  | 'lockin_session'
  | 'lockin_streak'
  | 'lockin_exam_preset'
  | 'lockin_blocked_app'
  | 'lockin_yt_channel'
  | 'lockin_schedule'
  | 'lockin_app_quota'
  | 'lockin_reality_check'
  | 'lockin_emergency_pass';

const LOCKIN_ENTITY_TABLE_MAP: Record<LockinSyncEntityType, string> = {
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

export class LockinSupabaseSyncAdapter implements ICloudBackendAdapter {
  private static instance: LockinSupabaseSyncAdapter;

  public static getInstance(): LockinSupabaseSyncAdapter {
    if (!LockinSupabaseSyncAdapter.instance) {
      LockinSupabaseSyncAdapter.instance = new LockinSupabaseSyncAdapter();
    }
    return LockinSupabaseSyncAdapter.instance;
  }

  public async isOnline(): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return false;
    }
    try {
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
    // Handle lockin-specific entity types
    if (this.isLockinEntityType(entityType)) {
      return this.pushLockinRecord(userId, entityType, entityId, operation, payload);
    }

    // Delegate to default handler for unknown types
    return { success: false, remoteVersion: 0, error: `Unknown entity type: ${entityType}` };
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
      // Pull lockin entities
      const lockinEntityTypes: LockinSyncEntityType[] = [
        'lockin_session',
        'lockin_streak',
        'lockin_exam_preset',
        'lockin_blocked_app',
        'lockin_yt_channel',
        'lockin_schedule',
        'lockin_app_quota',
        'lockin_reality_check',
        'lockin_emergency_pass',
      ];

      for (const entityType of lockinEntityTypes) {
        const table = LOCKIN_ENTITY_TABLE_MAP[entityType];
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
              entityType: entityType as SyncEntityType,
              payload: this.transformRowToPayload(entityType, row),
              version: 1,
              updatedAt: row.updated_at || serverTimestamp,
            });
          }
        }
      }

      // Pull remote tombstones for lockin entities
      let tombQuery = supabase
        .from('sync_tombstones')
        .select('*')
        .eq('user_id', userId)
        .in('entity_type', lockinEntityTypes);

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

      return {
        records,
        tombstones,
        serverTimestamp,
      };
    } catch (err: any) {
      console.warn('[LockinSupabaseSyncAdapter] Pull changes warning:', err);
      return { records, tombstones, serverTimestamp };
    }
  }

  private isLockinEntityType(entityType: SyncEntityType): entityType is LockinSyncEntityType {
    return (
      entityType === 'lockin_session' ||
      entityType === 'lockin_streak' ||
      entityType === 'lockin_exam_preset' ||
      entityType === 'lockin_blocked_app' ||
      entityType === 'lockin_yt_channel' ||
      entityType === 'lockin_schedule' ||
      entityType === 'lockin_app_quota' ||
      entityType === 'lockin_reality_check' ||
      entityType === 'lockin_emergency_pass'
    );
  }

  private async pushLockinRecord(
    userId: string,
    entityType: LockinSyncEntityType,
    entityId: string,
    operation: SyncOperation,
    payload?: any
  ): Promise<{ success: boolean; remoteVersion: number; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, remoteVersion: 0, error: 'Supabase is not configured' };
    }

    const table = LOCKIN_ENTITY_TABLE_MAP[entityType];
    if (!table) {
      return { success: false, remoteVersion: 0, error: `Unknown lockin entity type: ${entityType}` };
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
          console.warn('[LockinSupabaseSyncAdapter] Failed to record remote tombstone:', tombError);
        }

        return { success: true, remoteVersion: 1 };
      }

      // CREATE or UPDATE: prepare sanitized row
      const row = this.transformPayloadToRow(entityType, payload, entityId, userId, now);

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
        error: err.message || 'Network error pushing lockin record to Supabase',
      };
    }
  }

  private transformPayloadToRow(
    entityType: LockinSyncEntityType,
    payload: any,
    entityId: string,
    userId: string,
    now: string
  ): Record<string, any> {
    const base = {
      id: entityId,
      user_id: userId,
      updated_at: payload?.updatedAt || now,
    };

    switch (entityType) {
      case 'lockin_session':
        return {
          ...base,
          subject_id: payload?.subjectId || null,
          session_type: payload?.sessionType,
          preset_id: payload?.presetId || null,
          status: payload?.status || 'active',
          planned_duration_minutes: payload?.plannedDurationMinutes || 0,
          actual_duration_minutes: payload?.actualDurationMinutes || 0,
          focus_score: payload?.focusScore || 0,
          started_at: payload?.startedAt || now,
          paused_at: payload?.pausedAt || null,
          resumed_at: payload?.resumedAt || null,
          completed_at: payload?.completedAt || null,
          abandoned_at: payload?.abandonedAt || null,
          notes: payload?.notes || null,
          created_at: payload?.createdAt || now,
        };
      case 'lockin_streak':
        return {
          ...base,
          streak_type: payload?.streakType,
          current_streak: payload?.currentStreak || 0,
          longest_streak: payload?.longestStreak || 0,
          last_session_date: payload?.lastSessionDate,
          streak_start_date: payload?.streakStartDate,
          streak_end_date: payload?.streakEndDate || null,
          total_sessions: payload?.totalSessions || 0,
          total_focus_minutes: payload?.totalFocusMinutes || 0,
          average_focus_score: payload?.averageFocusScore || 0,
          created_at: payload?.createdAt || now,
        };
      case 'lockin_exam_preset':
        return {
          ...base,
          name: payload?.name,
          type: payload?.type,
          subject_id: payload?.subjectId || null,
          work_duration_minutes: payload?.workDurationMinutes || 25,
          short_break_minutes: payload?.shortBreakMinutes || 5,
          long_break_minutes: payload?.longBreakMinutes || 15,
          sessions_until_long_break: payload?.sessionsUntilLongBreak || 4,
          target_focus_minutes: payload?.targetFocusMinutes || null,
          target_sessions: payload?.targetSessions || null,
          is_default: payload?.isDefault ? 1 : 0,
          is_active: payload?.isActive ? 1 : 0,
          created_at: payload?.createdAt || now,
        };
      case 'lockin_blocked_app':
        return {
          ...base,
          package_name: payload?.packageName,
          app_name: payload?.appName,
          is_blocked: payload?.isBlocked ? 1 : 0,
          created_at: payload?.createdAt || now,
        };
      case 'lockin_yt_channel':
        return {
          ...base,
          channel_id: payload?.channelId,
          channel_name: payload?.channelName,
          channel_url: payload?.channelUrl,
          is_whitelisted: payload?.isWhitelisted ? 1 : 0,
          created_at: payload?.createdAt || now,
        };
      case 'lockin_schedule':
        return {
          ...base,
          name: payload?.name,
          days_of_week: JSON.stringify(payload?.daysOfWeek || []),
          start_time: payload?.startTime,
          end_time: payload?.endTime,
          exam_id: payload?.examId || null,
          strict_mode: payload?.strictMode || 'none',
          is_active: payload?.isActive ? 1 : 0,
          created_at: payload?.createdAt || now,
        };
      case 'lockin_app_quota':
        return {
          ...base,
          package_name: payload?.packageName,
          app_name: payload?.appName,
          daily_limit_minutes: payload?.dailyLimitMinutes || 0,
          used_minutes_today: payload?.usedMinutesToday || 0,
          last_reset_date: payload?.lastResetDate,
          is_active: payload?.isActive ? 1 : 0,
          created_at: payload?.createdAt || now,
        };
      case 'lockin_reality_check':
        return {
          ...base,
          delay_seconds: payload?.delaySeconds || 10,
          prompt_question: payload?.promptQuestion || 'Why are you opening this app?',
          is_enabled: payload?.isEnabled ? 1 : 0,
          created_at: payload?.createdAt || now,
        };
      case 'lockin_emergency_pass':
        return {
          ...base,
          weekly_allowance: payload?.weeklyAllowance || 2,
          used_this_week: payload?.usedThisWeek || 0,
          last_reset_week: payload?.lastResetWeek,
          pass_duration_minutes: payload?.passDurationMinutes || 5,
          created_at: payload?.createdAt || now,
        };
      default:
        return base;
    }
  }

  private transformRowToPayload(
    entityType: LockinSyncEntityType,
    row: any
  ): LockinSession | LockinStreak | LockinExamPreset | LockinBlockedApp | LockinYtChannel | LockinSchedule | LockinAppQuota | LockinRealityCheck | LockinEmergencyPass {
    switch (entityType) {
      case 'lockin_session':
        return {
          id: row.id,
          userId: row.user_id,
          subjectId: row.subject_id ?? undefined,
          sessionType: row.session_type,
          presetId: row.preset_id ?? undefined,
          status: row.status,
          plannedDurationMinutes: row.planned_duration_minutes,
          actualDurationMinutes: row.actual_duration_minutes,
          focusScore: row.focus_score,
          startedAt: row.started_at,
          pausedAt: row.paused_at ?? undefined,
          resumedAt: row.resumed_at ?? undefined,
          completedAt: row.completed_at ?? undefined,
          abandonedAt: row.abandoned_at ?? undefined,
          notes: row.notes ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      case 'lockin_streak':
        return {
          id: row.id,
          userId: row.user_id,
          streakType: row.streak_type,
          currentStreak: row.current_streak,
          longestStreak: row.longest_streak,
          lastSessionDate: row.last_session_date,
          streakStartDate: row.streak_start_date,
          streakEndDate: row.streak_end_date ?? undefined,
          totalSessions: row.total_sessions,
          totalFocusMinutes: row.total_focus_minutes,
          averageFocusScore: row.average_focus_score,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      case 'lockin_exam_preset':
        return {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          type: row.type,
          subjectId: row.subject_id ?? undefined,
          workDurationMinutes: row.work_duration_minutes,
          shortBreakMinutes: row.short_break_minutes,
          longBreakMinutes: row.long_break_minutes,
          sessionsUntilLongBreak: row.sessions_until_long_break,
          targetFocusMinutes: row.target_focus_minutes ?? undefined,
          targetSessions: row.target_sessions ?? undefined,
          isDefault: row.is_default === 1,
          isActive: row.is_active === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      case 'lockin_blocked_app':
        return {
          id: row.id,
          userId: row.user_id,
          packageName: row.package_name,
          appName: row.app_name,
          isBlocked: row.is_blocked === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      case 'lockin_yt_channel':
        return {
          id: row.id,
          userId: row.user_id,
          channelId: row.channel_id,
          channelName: row.channel_name,
          channelUrl: row.channel_url,
          isWhitelisted: row.is_whitelisted === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      case 'lockin_schedule':
        return {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          daysOfWeek: JSON.parse(row.days_of_week || '[]'),
          startTime: row.start_time,
          endTime: row.end_time,
          examId: row.exam_id ?? undefined,
          strictMode: row.strict_mode,
          isActive: row.is_active === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      case 'lockin_app_quota':
        return {
          id: row.id,
          userId: row.user_id,
          packageName: row.package_name,
          appName: row.app_name,
          dailyLimitMinutes: row.daily_limit_minutes,
          usedMinutesToday: row.used_minutes_today,
          lastResetDate: row.last_reset_date,
          isActive: row.is_active === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      case 'lockin_reality_check':
        return {
          id: row.id,
          userId: row.user_id,
          delaySeconds: row.delay_seconds,
          promptQuestion: row.prompt_question,
          isEnabled: row.is_enabled === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      case 'lockin_emergency_pass':
        return {
          id: row.id,
          userId: row.user_id,
          weeklyAllowance: row.weekly_allowance,
          usedThisWeek: row.used_this_week,
          lastResetWeek: row.last_reset_week,
          passDurationMinutes: row.pass_duration_minutes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      default:
        return row;
    }
  }
}

export const lockinSupabaseSyncAdapter = LockinSupabaseSyncAdapter.getInstance();