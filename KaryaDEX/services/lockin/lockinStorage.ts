/**
 * KaryaDEX — Lockin Storage Service
 *
 * SQLite-backed repository for Lockin sessions, streaks, and exam presets.
 * Provides CRUD operations, queries, and streak computation logic.
 */

import { getDatabaseConnection } from '../../database/db';
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
  LockinSessionRow,
  LockinStreakRow,
  LockinExamPresetRow,
  LockinBlockedAppRow,
  LockinYtChannelRow,
  LockinScheduleRow,
  LockinAppQuotaRow,
  LockinRealityCheckRow,
  LockinEmergencyPassRow,
} from '@/types/lockin';
import {
  mapLockinSessionRow,
  mapLockinStreakRow,
  mapLockinExamPresetRow,
  mapLockinBlockedAppRow,
  mapLockinYtChannelRow,
  mapLockinScheduleRow,
  mapLockinAppQuotaRow,
  mapLockinRealityCheckRow,
  mapLockinEmergencyPassRow,
} from '@/types/lockin';
import { DEFAULT_EXAM_PRESETS } from '@/types/lockin';
import { formatLocalDate } from '@/lib/timeUtils';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class LockinStorage {
  // ─── Lockin Sessions ──────────────────────────────────────────────

  /**
   * Creates a new Lockin session record.
   */
  async createSession(input: Omit<LockinSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<LockinSession> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();
    const id = generateId('ls');

    const session: LockinSession = {
      id,
      ...input,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.runAsync(
      `INSERT INTO lockin_sessions (
        id, user_id, subject_id, session_type, preset_id, status,
        planned_duration_minutes, actual_duration_minutes, focus_score,
        started_at, paused_at, resumed_at, completed_at, abandoned_at,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        session.id,
        session.userId,
        session.subjectId || null,
        session.sessionType,
        session.presetId || null,
        session.status,
        session.plannedDurationMinutes,
        session.actualDurationMinutes,
        session.focusScore,
        session.startedAt,
        session.pausedAt || null,
        session.resumedAt || null,
        session.completedAt || null,
        session.abandonedAt || null,
        session.notes || null,
        session.createdAt,
        session.updatedAt,
      ]
    );

    return session;
  }

  /**
   * Retrieves a Lockin session by ID.
   */
  async getSessionById(id: string): Promise<LockinSession | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<LockinSessionRow>(
      `SELECT * FROM lockin_sessions WHERE id = ?;`,
      [id]
    );
    return row ? mapLockinSessionRow(row) : null;
  }

  /**
   * Updates an existing Lockin session.
   */
  async updateSession(id: string, updates: Partial<LockinSession>): Promise<void> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();

    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.subjectId !== undefined) {
      setClauses.push('subject_id = ?');
      values.push(updates.subjectId || null);
    }
    if (updates.sessionType !== undefined) {
      setClauses.push('session_type = ?');
      values.push(updates.sessionType);
    }
    if (updates.presetId !== undefined) {
      setClauses.push('preset_id = ?');
      values.push(updates.presetId || null);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.plannedDurationMinutes !== undefined) {
      setClauses.push('planned_duration_minutes = ?');
      values.push(updates.plannedDurationMinutes);
    }
    if (updates.actualDurationMinutes !== undefined) {
      setClauses.push('actual_duration_minutes = ?');
      values.push(updates.actualDurationMinutes);
    }
    if (updates.focusScore !== undefined) {
      setClauses.push('focus_score = ?');
      values.push(updates.focusScore);
    }
    if (updates.startedAt !== undefined) {
      setClauses.push('started_at = ?');
      values.push(updates.startedAt);
    }
    if (updates.pausedAt !== undefined) {
      setClauses.push('paused_at = ?');
      values.push(updates.pausedAt || null);
    }
    if (updates.resumedAt !== undefined) {
      setClauses.push('resumed_at = ?');
      values.push(updates.resumedAt || null);
    }
    if (updates.completedAt !== undefined) {
      setClauses.push('completed_at = ?');
      values.push(updates.completedAt || null);
    }
    if (updates.abandonedAt !== undefined) {
      setClauses.push('abandoned_at = ?');
      values.push(updates.abandonedAt || null);
    }
    if (updates.notes !== undefined) {
      setClauses.push('notes = ?');
      values.push(updates.notes || null);
    }

    setClauses.push('updated_at = ?');
    values.push(nowIso);
    values.push(id);

    if (setClauses.length > 1) {
      await db.runAsync(
        `UPDATE lockin_sessions SET ${setClauses.join(', ')} WHERE id = ?;`,
        values
      );
    }
  }

  /**
   * Deletes a Lockin session by ID.
   */
  async deleteSession(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM lockin_sessions WHERE id = ?;`, [id]);
  }

  /**
   * Retrieves all Lockin sessions for a user, newest first.
   */
  async getSessionsByUser(userId: string, limit?: number): Promise<LockinSession[]> {
    const db = await getDatabaseConnection();
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const rows = await db.getAllAsync<LockinSessionRow>(
      `SELECT * FROM lockin_sessions WHERE user_id = ? ORDER BY started_at DESC ${limitClause};`,
      [userId]
    );
    return rows.map(mapLockinSessionRow);
  }

  /**
   * Retrieves sessions for a specific subject.
   */
  async getSessionsBySubject(userId: string, subjectId: string): Promise<LockinSession[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<LockinSessionRow>(
      `SELECT * FROM lockin_sessions WHERE user_id = ? AND subject_id = ? ORDER BY started_at DESC;`,
      [userId, subjectId]
    );
    return rows.map(mapLockinSessionRow);
  }

  /**
   * Retrieves sessions within a date range.
   */
  async getSessionsByDateRange(userId: string, startDate: string, endDate: string): Promise<LockinSession[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<LockinSessionRow>(
      `SELECT * FROM lockin_sessions WHERE user_id = ? AND date(started_at) BETWEEN date(?) AND date(?) ORDER BY started_at DESC;`,
      [userId, startDate, endDate]
    );
    return rows.map(mapLockinSessionRow);
  }

  /**
   * Retrieves the most recent session for a user.
   */
  async getLatestSession(userId: string): Promise<LockinSession | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<LockinSessionRow>(
      `SELECT * FROM lockin_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 1;`,
      [userId]
    );
    return row ? mapLockinSessionRow(row) : null;
  }

  /**
   * Retrieves active/paused sessions for a user.
   */
  async getActiveSessions(userId: string): Promise<LockinSession[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<LockinSessionRow>(
      `SELECT * FROM lockin_sessions WHERE user_id = ? AND status IN ('active', 'paused') ORDER BY started_at DESC;`,
      [userId]
    );
    return rows.map(mapLockinSessionRow);
  }

  // ─── Lockin Streaks ───────────────────────────────────────────────

  /**
   * Creates or updates a streak record for a user and streak type.
   */
  async upsertStreak(input: Omit<LockinStreak, 'id' | 'createdAt' | 'updatedAt'>): Promise<LockinStreak> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();

    // Check if streak exists
    const existing = await db.getFirstAsync<LockinStreakRow>(
      `SELECT * FROM lockin_streaks WHERE user_id = ? AND streak_type = ?;`,
      [input.userId, input.streakType]
    );

    const id = existing?.id || generateId('lst');
    const createdAt = existing?.created_at || nowIso;

    const streak: LockinStreak = {
      id,
      ...input,
      createdAt,
      updatedAt: nowIso,
    };

    await db.runAsync(
      `INSERT INTO lockin_streaks (
        id, user_id, streak_type, current_streak, longest_streak,
        last_session_date, streak_start_date, streak_end_date,
        total_sessions, total_focus_minutes, average_focus_score,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, streak_type) DO UPDATE SET
        current_streak = excluded.current_streak,
        longest_streak = excluded.longest_streak,
        last_session_date = excluded.last_session_date,
        streak_end_date = excluded.streak_end_date,
        total_sessions = excluded.total_sessions,
        total_focus_minutes = excluded.total_focus_minutes,
        average_focus_score = excluded.average_focus_score,
        updated_at = excluded.updated_at;`,
      [
        streak.id,
        streak.userId,
        streak.streakType,
        streak.currentStreak,
        streak.longestStreak,
        streak.lastSessionDate,
        streak.streakStartDate,
        streak.streakEndDate || null,
        streak.totalSessions,
        streak.totalFocusMinutes,
        streak.averageFocusScore,
        streak.createdAt,
        streak.updatedAt,
      ]
    );

    return streak;
  }

  /**
   * Retrieves a streak by user and type.
   */
  async getStreak(userId: string, streakType: LockinStreak['streakType']): Promise<LockinStreak | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<LockinStreakRow>(
      `SELECT * FROM lockin_streaks WHERE user_id = ? AND streak_type = ?;`,
      [userId, streakType]
    );
    return row ? mapLockinStreakRow(row) : null;
  }

  /**
   * Retrieves all streaks for a user.
   */
  async getAllStreaks(userId: string): Promise<LockinStreak[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<LockinStreakRow>(
      `SELECT * FROM lockin_streaks WHERE user_id = ? ORDER BY streak_type;`,
      [userId]
    );
    return rows.map(mapLockinStreakRow);
  }

  /**
   * Computes and updates streak based on a completed session.
   * Returns the updated streak.
   */
  async updateStreakFromSession(
    userId: string,
    session: LockinSession,
    streakType: LockinStreak['streakType']
  ): Promise<LockinStreak> {
    const existingStreak = await this.getStreak(userId, streakType);
    const sessionDate = formatLocalDate(new Date(session.completedAt || session.startedAt));

    let currentStreak = 0;
    let longestStreak = 0;
    let streakStartDate = sessionDate;
    let streakEndDate: string | undefined;
    let totalSessions = 1;
    let totalFocusMinutes = session.actualDurationMinutes;
    let averageFocusScore = session.focusScore;

    if (existingStreak) {
      totalSessions = existingStreak.totalSessions + 1;
      totalFocusMinutes = existingStreak.totalFocusMinutes + session.actualDurationMinutes;
      averageFocusScore = Math.round(
        (existingStreak.averageFocusScore * existingStreak.totalSessions + session.focusScore) / totalSessions
      );
      longestStreak = existingStreak.longestStreak;
      streakStartDate = existingStreak.streakStartDate;

      // Check if session continues the streak
      const lastSessionDate = existingStreak.lastSessionDate;
      const daysDiff = this.daysBetween(lastSessionDate, sessionDate);

      if (streakType === 'daily') {
        if (daysDiff === 1) {
          // Continued daily streak
          currentStreak = existingStreak.currentStreak + 1;
        } else if (daysDiff === 0) {
          // Same day, don't increment
          currentStreak = existingStreak.currentStreak;
        } else {
          // Streak broken
          currentStreak = 1;
          streakStartDate = sessionDate;
        }
      } else if (streakType === 'weekly') {
        if (daysDiff <= 7) {
          currentStreak = existingStreak.currentStreak + 1;
        } else {
          currentStreak = 1;
          streakStartDate = sessionDate;
        }
      } else if (streakType === 'monthly') {
        if (daysDiff <= 31) {
          currentStreak = existingStreak.currentStreak + 1;
        } else {
          currentStreak = 1;
          streakStartDate = sessionDate;
        }
      }

      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
    } else {
      currentStreak = 1;
      longestStreak = 1;
    }

    // If streak is broken (not continued), set end date
    if (existingStreak && currentStreak === 1 && existingStreak.currentStreak > 0) {
      streakEndDate = existingStreak.lastSessionDate;
    }

    return this.upsertStreak({
      userId,
      streakType,
      currentStreak,
      longestStreak,
      lastSessionDate: sessionDate,
      streakStartDate,
      streakEndDate,
      totalSessions,
      totalFocusMinutes,
      averageFocusScore,
    });
  }

  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // ─── Lockin Exam Presets ──────────────────────────────────────────

  /**
   * Creates a new exam preset.
   */
  async createExamPreset(input: Omit<LockinExamPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<LockinExamPreset> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();
    const id = generateId('lep');

    const preset: LockinExamPreset = {
      id,
      ...input,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // If this is default, unset other defaults for this user
    if (preset.isDefault) {
      await db.runAsync(
        `UPDATE lockin_exam_presets SET is_default = 0 WHERE user_id = ?;`,
        [preset.userId]
      );
    }

    await db.runAsync(
      `INSERT INTO lockin_exam_presets (
        id, user_id, name, type, subject_id,
        work_duration_minutes, short_break_minutes, long_break_minutes,
        sessions_until_long_break, target_focus_minutes, target_sessions,
        is_default, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        preset.id,
        preset.userId,
        preset.name,
        preset.type,
        preset.subjectId || null,
        preset.workDurationMinutes,
        preset.shortBreakMinutes,
        preset.longBreakMinutes,
        preset.sessionsUntilLongBreak,
        preset.targetFocusMinutes || null,
        preset.targetSessions || null,
        preset.isDefault ? 1 : 0,
        preset.isActive ? 1 : 0,
        preset.createdAt,
        preset.updatedAt,
      ]
    );

    return preset;
  }

  /**
   * Retrieves an exam preset by ID.
   */
  async getExamPresetById(id: string): Promise<LockinExamPreset | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<LockinExamPresetRow>(
      `SELECT * FROM lockin_exam_presets WHERE id = ?;`,
      [id]
    );
    return row ? mapLockinExamPresetRow(row) : null;
  }

  /**
   * Updates an exam preset.
   */
  async updateExamPreset(id: string, updates: Partial<LockinExamPreset>): Promise<void> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();

    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.type !== undefined) {
      setClauses.push('type = ?');
      values.push(updates.type);
    }
    if (updates.subjectId !== undefined) {
      setClauses.push('subject_id = ?');
      values.push(updates.subjectId || null);
    }
    if (updates.workDurationMinutes !== undefined) {
      setClauses.push('work_duration_minutes = ?');
      values.push(updates.workDurationMinutes);
    }
    if (updates.shortBreakMinutes !== undefined) {
      setClauses.push('short_break_minutes = ?');
      values.push(updates.shortBreakMinutes);
    }
    if (updates.longBreakMinutes !== undefined) {
      setClauses.push('long_break_minutes = ?');
      values.push(updates.longBreakMinutes);
    }
    if (updates.sessionsUntilLongBreak !== undefined) {
      setClauses.push('sessions_until_long_break = ?');
      values.push(updates.sessionsUntilLongBreak);
    }
    if (updates.targetFocusMinutes !== undefined) {
      setClauses.push('target_focus_minutes = ?');
      values.push(updates.targetFocusMinutes || null);
    }
    if (updates.targetSessions !== undefined) {
      setClauses.push('target_sessions = ?');
      values.push(updates.targetSessions || null);
    }
    if (updates.isDefault !== undefined) {
      setClauses.push('is_default = ?');
      values.push(updates.isDefault ? 1 : 0);
      // If setting as default, unset others
      if (updates.isDefault) {
        const preset = await this.getExamPresetById(id);
        if (preset) {
          await db.runAsync(
            `UPDATE lockin_exam_presets SET is_default = 0 WHERE user_id = ? AND id != ?;`,
            [preset.userId, id]
          );
        }
      }
    }
    if (updates.isActive !== undefined) {
      setClauses.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }

    setClauses.push('updated_at = ?');
    values.push(nowIso);
    values.push(id);

    if (setClauses.length > 1) {
      await db.runAsync(
        `UPDATE lockin_exam_presets SET ${setClauses.join(', ')} WHERE id = ?;`,
        values
      );
    }
  }

  /**
   * Deletes an exam preset.
   */
  async deleteExamPreset(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM lockin_exam_presets WHERE id = ?;`, [id]);
  }

  /**
   * Retrieves all exam presets for a user.
   */
  async getExamPresetsByUser(userId: string, activeOnly = false): Promise<LockinExamPreset[]> {
    const db = await getDatabaseConnection();
    const activeClause = activeOnly ? 'AND is_active = 1' : '';
    const rows = await db.getAllAsync<LockinExamPresetRow>(
      `SELECT * FROM lockin_exam_presets WHERE user_id = ? ${activeClause} ORDER BY is_default DESC, created_at DESC;`,
      [userId]
    );
    return rows.map(mapLockinExamPresetRow);
  }

  /**
   * Retrieves the default exam preset for a user.
   */
  async getDefaultExamPreset(userId: string): Promise<LockinExamPreset | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<LockinExamPresetRow>(
      `SELECT * FROM lockin_exam_presets WHERE user_id = ? AND is_default = 1 AND is_active = 1 LIMIT 1;`,
      [userId]
    );
    return row ? mapLockinExamPresetRow(row) : null;
  }

  /**
   * Initializes default exam presets for a new user.
   */
  async initializeDefaultPresets(userId: string): Promise<LockinExamPreset[]> {
    const db = await getDatabaseConnection();
    const existing = await this.getExamPresetsByUser(userId);
    if (existing.length > 0) {
      return existing;
    }

    const created: LockinExamPreset[] = [];
    for (const preset of DEFAULT_EXAM_PRESETS) {
      const createdPreset = await this.createExamPreset({ ...preset, userId });
      created.push(createdPreset);
    }
    return created;
  }

  // ─── Lockin Blocked Apps ────────────────────────────────────────────

  /**
   * Creates a new blocked app record.
   */
  async createBlockedApp(input: Omit<LockinBlockedApp, 'id' | 'createdAt' | 'updatedAt'>): Promise<LockinBlockedApp> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();
    const id = generateId('lba');

    const blockedApp: LockinBlockedApp = {
      id,
      ...input,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.runAsync(
      `INSERT INTO lockin_blocked_apps (
        id, user_id, package_name, app_name, is_blocked, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        blockedApp.id,
        blockedApp.userId,
        blockedApp.packageName,
        blockedApp.appName,
        blockedApp.isBlocked ? 1 : 0,
        blockedApp.createdAt,
        blockedApp.updatedAt,
      ]
    );

    return blockedApp;
  }

  /**
   * Retrieves a blocked app by ID.
   */
  async getBlockedAppById(id: string): Promise<LockinBlockedApp | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<LockinBlockedAppRow>(
      `SELECT * FROM lockin_blocked_apps WHERE id = ?;`,
      [id]
    );
    return row ? mapLockinBlockedAppRow(row) : null;
  }

  /**
   * Retrieves a blocked app by package name and user.
   */
  async getBlockedAppByPackage(userId: string, packageName: string): Promise<LockinBlockedApp | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<LockinBlockedAppRow>(
      `SELECT * FROM lockin_blocked_apps WHERE user_id = ? AND package_name = ?;`,
      [userId, packageName]
    );
    return row ? mapLockinBlockedAppRow(row) : null;
  }

  /**
   * Retrieves all blocked apps for a user.
   */
  async getBlockedApps(userId: string): Promise<LockinBlockedApp[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<LockinBlockedAppRow>(
      `SELECT * FROM lockin_blocked_apps WHERE user_id = ? ORDER BY created_at DESC;`,
      [userId]
    );
    return rows.map(mapLockinBlockedAppRow);
  }

  /**
   * Updates a blocked app record.
   */
  async updateBlockedApp(id: string, updates: Partial<LockinBlockedApp>): Promise<void> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();

    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.packageName !== undefined) {
      setClauses.push('package_name = ?');
      values.push(updates.packageName);
    }
    if (updates.appName !== undefined) {
      setClauses.push('app_name = ?');
      values.push(updates.appName);
    }
    if (updates.isBlocked !== undefined) {
      setClauses.push('is_blocked = ?');
      values.push(updates.isBlocked ? 1 : 0);
    }

    setClauses.push('updated_at = ?');
    values.push(nowIso);
    values.push(id);

    if (setClauses.length > 1) {
      await db.runAsync(
        `UPDATE lockin_blocked_apps SET ${setClauses.join(', ')} WHERE id = ?;`,
        values
      );
    }
  }

  /**
   * Deletes a blocked app by ID.
   */
  async deleteBlockedApp(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM lockin_blocked_apps WHERE id = ?;`, [id]);
  }

  // ─── Lockin YouTube Channels ──────────────────────────────────────────

  /**
   * Creates a new YouTube channel record.
   */
  async createYtChannel(input: Omit<LockinYtChannel, 'id' | 'createdAt' | 'updatedAt'>): Promise<LockinYtChannel> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();
    const id = generateId('lyc');

    const ytChannel: LockinYtChannel = {
      id,
      ...input,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.runAsync(
      `INSERT INTO lockin_yt_channels (
        id, user_id, channel_id, channel_name, channel_url, is_whitelisted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        ytChannel.id,
        ytChannel.userId,
        ytChannel.channelId,
        ytChannel.channelName,
        ytChannel.channelUrl,
        ytChannel.isWhitelisted ? 1 : 0,
        ytChannel.createdAt,
        ytChannel.updatedAt,
      ]
    );

    return ytChannel;
  }

  /**
   * Retrieves a YouTube channel by ID.
   */
  async getYtChannelById(id: string): Promise<LockinYtChannel | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<LockinYtChannelRow>(
      `SELECT * FROM lockin_yt_channels WHERE id = ?;`,
      [id]
    );
    return row ? mapLockinYtChannelRow(row) : null;
  }

  /**
   * Retrieves a YouTube channel by channel ID and user.
   */
  async getYtChannelByChannelId(userId: string, channelId: string): Promise<LockinYtChannel | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<LockinYtChannelRow>(
      `SELECT * FROM lockin_yt_channels WHERE user_id = ? AND channel_id = ?;`,
      [userId, channelId]
    );
    return row ? mapLockinYtChannelRow(row) : null;
  }

  /**
   * Retrieves all YouTube channels for a user.
   */
  async getYtChannels(userId: string): Promise<LockinYtChannel[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<LockinYtChannelRow>(
      `SELECT * FROM lockin_yt_channels WHERE user_id = ? ORDER BY created_at DESC;`,
      [userId]
    );
    return rows.map(mapLockinYtChannelRow);
  }

  /**
   * Updates a YouTube channel record.
   */
  async updateYtChannel(id: string, updates: Partial<LockinYtChannel>): Promise<void> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();

    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.channelId !== undefined) {
      setClauses.push('channel_id = ?');
      values.push(updates.channelId);
    }
    if (updates.channelName !== undefined) {
      setClauses.push('channel_name = ?');
      values.push(updates.channelName);
    }
    if (updates.channelUrl !== undefined) {
      setClauses.push('channel_url = ?');
      values.push(updates.channelUrl);
    }
    if (updates.isWhitelisted !== undefined) {
      setClauses.push('is_whitelisted = ?');
      values.push(updates.isWhitelisted ? 1 : 0);
    }

    setClauses.push('updated_at = ?');
    values.push(nowIso);
    values.push(id);

    if (setClauses.length > 1) {
      await db.runAsync(
        `UPDATE lockin_yt_channels SET ${setClauses.join(', ')} WHERE id = ?;`,
        values
      );
    }
  }

  /**
   * Deletes a YouTube channel by ID.
   */
  async deleteYtChannel(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM lockin_yt_channels WHERE id = ?;`, [id]);
  }

  // ─── Lockin Schedules ─────────────────────────────────────────────

  async createSchedule(input: Omit<LockinSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<LockinSchedule> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();
    const id = generateId('lsch');

    const schedule: LockinSchedule = {
      id,
      ...input,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.runAsync(
      `INSERT INTO lockin_schedules (
        id, user_id, name, days_of_week, start_time, end_time,
        exam_id, strict_mode, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        schedule.id,
        schedule.userId,
        schedule.name,
        JSON.stringify(schedule.daysOfWeek),
        schedule.startTime,
        schedule.endTime,
        schedule.examId || null,
        schedule.strictMode,
        schedule.isActive ? 1 : 0,
        schedule.createdAt,
        schedule.updatedAt,
      ]
    );

    return schedule;
  }

  async getSchedules(userId: string): Promise<LockinSchedule[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<LockinScheduleRow>(
      `SELECT * FROM lockin_schedules WHERE user_id = ? ORDER BY start_time ASC;`,
      [userId]
    );
    return rows.map(mapLockinScheduleRow);
  }

  async updateSchedule(id: string, updates: Partial<LockinSchedule>): Promise<void> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { setClauses.push('name = ?'); values.push(updates.name); }
    if (updates.daysOfWeek !== undefined) { setClauses.push('days_of_week = ?'); values.push(JSON.stringify(updates.daysOfWeek)); }
    if (updates.startTime !== undefined) { setClauses.push('start_time = ?'); values.push(updates.startTime); }
    if (updates.endTime !== undefined) { setClauses.push('end_time = ?'); values.push(updates.endTime); }
    if (updates.examId !== undefined) { setClauses.push('exam_id = ?'); values.push(updates.examId || null); }
    if (updates.strictMode !== undefined) { setClauses.push('strict_mode = ?'); values.push(updates.strictMode); }
    if (updates.isActive !== undefined) { setClauses.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }

    setClauses.push('updated_at = ?');
    values.push(nowIso);
    values.push(id);

    if (setClauses.length > 1) {
      await db.runAsync(`UPDATE lockin_schedules SET ${setClauses.join(', ')} WHERE id = ?;`, values);
    }
  }

  async deleteSchedule(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM lockin_schedules WHERE id = ?;`, [id]);
  }

  // ─── Scheduled Sessions ─────────────────────────────────────────────

  async createScheduledSession(scheduleId: string, userId: string): Promise<LockinSession> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();
    const plannedMinutes = 60; // default, or compute from schedule
    const id = generateId('lss');

    const session: LockinSession = {
      id,
      userId,
      sessionType: 'exam_prep',
      status: 'active',
      plannedDurationMinutes: plannedMinutes,
      actualDurationMinutes: 0,
      focusScore: 100,
      startedAt: nowIso,
      notes: `Scheduled session from schedule ${scheduleId}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.runAsync(
      `INSERT INTO lockin_sessions (
        id, user_id, session_type, status, planned_duration_minutes,
        actual_duration_minutes, focus_score, started_at, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        session.id,
        session.userId,
        session.sessionType,
        session.status,
        session.plannedDurationMinutes,
        session.actualDurationMinutes,
        session.focusScore,
        session.startedAt,
        session.notes,
        session.createdAt,
        session.updatedAt,
      ]
    );

    return session;
  }

  async completeScheduledSession(sessionId: string, actualMinutes: number): Promise<LockinSession | null> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();

    await db.runAsync(
      `UPDATE lockin_sessions SET status = 'completed', actual_duration_minutes = ?, completed_at = ?, updated_at = ? WHERE id = ?;`,
      [actualMinutes, nowIso, sessionId, sessionId]
    );

    // Return the updated session
    const row = await db.getFirstAsync<LockinSessionRow>(
      `SELECT * FROM lockin_sessions WHERE id = ?;`,
      [sessionId]
    );
    return row ? mapLockinSessionRow(row) : null;
  }

  // ─── Lockin App Quotas ─────────────────────────────────────────────

  async createQuota(input: Omit<LockinAppQuota, 'id' | 'createdAt' | 'updatedAt'>): Promise<LockinAppQuota> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();
    const id = generateId('laq');

    const quota: LockinAppQuota = {
      id,
      ...input,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.runAsync(
      `INSERT INTO lockin_app_quotas (
        id, user_id, package_name, app_name, daily_limit_minutes,
        used_minutes_today, last_reset_date, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        quota.id,
        quota.userId,
        quota.packageName,
        quota.appName,
        quota.dailyLimitMinutes,
        quota.usedMinutesToday,
        quota.lastResetDate,
        quota.isActive ? 1 : 0,
        quota.createdAt,
        quota.updatedAt,
      ]
    );

    return quota;
  }

  async getQuotas(userId: string): Promise<LockinAppQuota[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<LockinAppQuotaRow>(
      `SELECT * FROM lockin_app_quotas WHERE user_id = ?;`,
      [userId]
    );
    return rows.map(mapLockinAppQuotaRow);
  }

  async updateQuota(id: string, updates: Partial<LockinAppQuota>): Promise<void> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.dailyLimitMinutes !== undefined) { setClauses.push('daily_limit_minutes = ?'); values.push(updates.dailyLimitMinutes); }
    if (updates.usedMinutesToday !== undefined) { setClauses.push('used_minutes_today = ?'); values.push(updates.usedMinutesToday); }
    if (updates.lastResetDate !== undefined) { setClauses.push('last_reset_date = ?'); values.push(updates.lastResetDate); }
    if (updates.isActive !== undefined) { setClauses.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }

    setClauses.push('updated_at = ?');
    values.push(nowIso);
    values.push(id);

    if (setClauses.length > 1) {
      await db.runAsync(`UPDATE lockin_app_quotas SET ${setClauses.join(', ')} WHERE id = ?;`, values);
    }
  }

  async resetDailyQuotas(userId: string): Promise<void> {
    const db = await getDatabaseConnection();
    const today = formatLocalDate(new Date());
    await db.runAsync(
      `UPDATE lockin_app_quotas SET used_minutes_today = 0, last_reset_date = ? WHERE user_id = ? AND last_reset_date != ?;`,
      [today, userId, today]
    );
  }

  async deleteQuota(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM lockin_app_quotas WHERE id = ?;`, [id]);
  }

  /**
   * Increments the used_minutes_today for a quota by the given amount.
   * Used by native workers to persist quota usage.
   */
  async incrementQuotaUsedMinutes(id: string, minutesToAdd: number): Promise<void> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();

    await db.runAsync(
      `UPDATE lockin_app_quotas SET used_minutes_today = used_minutes_today + ?, updated_at = ? WHERE id = ?;`,
      [minutesToAdd, nowIso, id]
    );
  }

  /**
   * Sets the used_minutes_today for a quota to a specific value.
   * Used by native workers to set exact usage from UsageStatsManager.
   */
  async setQuotaUsedMinutes(id: string, usedMinutes: number): Promise<void> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();

    await db.runAsync(
      `UPDATE lockin_app_quotas SET used_minutes_today = ?, updated_at = ? WHERE id = ?;`,
      [usedMinutes, nowIso, id]
    );
  }

  // ─── Lockin Reality Checks ─────────────────────────────────────────

  async getRealityCheck(userId: string): Promise<LockinRealityCheck | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<LockinRealityCheckRow>(
      `SELECT * FROM lockin_reality_checks WHERE user_id = ?;`,
      [userId]
    );
    return row ? mapLockinRealityCheckRow(row) : null;
  }

  async upsertRealityCheck(input: Omit<LockinRealityCheck, 'id' | 'createdAt' | 'updatedAt'>): Promise<LockinRealityCheck> {
    const db = await getDatabaseConnection();
    const nowIso = new Date().toISOString();
    const existing = await this.getRealityCheck(input.userId);

    const id = existing?.id || generateId('lrc');
    const createdAt = existing?.createdAt || nowIso;

    const rc: LockinRealityCheck = {
      id,
      ...input,
      createdAt,
      updatedAt: nowIso,
    };

    await db.runAsync(
      `INSERT INTO lockin_reality_checks (
        id, user_id, delay_seconds, prompt_question, is_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        delay_seconds = excluded.delay_seconds,
        prompt_question = excluded.prompt_question,
        is_enabled = excluded.is_enabled,
        updated_at = excluded.updated_at;`,
      [rc.id, rc.userId, rc.delaySeconds, rc.promptQuestion, rc.isEnabled ? 1 : 0, rc.createdAt, rc.updatedAt]
    );

    return rc;
  }

  // ─── Lockin Emergency Passes ───────────────────────────────────────

  async getEmergencyPassStatus(userId: string): Promise<LockinEmergencyPass | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<LockinEmergencyPassRow>(
      `SELECT * FROM lockin_emergency_passes WHERE user_id = ?;`,
      [userId]
    );
    return row ? mapLockinEmergencyPassRow(row) : null;
  }

  async useEmergencyPass(userId: string): Promise<boolean> {
    const status = await this.getEmergencyPassStatus(userId);
    if (!status || status.usedThisWeek >= status.weeklyAllowance) return false;

    const db = await getDatabaseConnection();
    await db.runAsync(
      `UPDATE lockin_emergency_passes SET used_this_week = used_this_week + 1, updated_at = ? WHERE user_id = ?;`,
      [new Date().toISOString(), userId]
    );
    return true;
  }

  // ─── Statistics ───────────────────────────────────────────────────

  /**
   * Gets aggregate statistics for a user's lockin sessions.
   */
  async getUserStatistics(userId: string): Promise<{
    totalSessions: number;
    totalFocusMinutes: number;
    averageFocusScore: number;
    completedSessions: number;
    abandonedSessions: number;
    sessionsByType: Record<string, number>;
    currentDailyStreak: number;
    longestDailyStreak: number;
  }> {
    const db = await getDatabaseConnection();

    // Session counts
    const sessionStats = await db.getFirstAsync<{
      total: number;
      completed: number;
      abandoned: number;
      total_minutes: number;
      avg_focus: number;
    }>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) as abandoned,
        SUM(actual_duration_minutes) as total_minutes,
        AVG(focus_score) as avg_focus
       FROM lockin_sessions WHERE user_id = ?;`,
      [userId]
    );

    // Sessions by type
    const typeRows = await db.getAllAsync<{ session_type: string; count: number }>(
      `SELECT session_type, COUNT(*) as count FROM lockin_sessions WHERE user_id = ? GROUP BY session_type;`,
      [userId]
    );
    const sessionsByType: Record<string, number> = {};
    for (const r of typeRows) {
      sessionsByType[r.session_type] = r.count;
    }

    // Streaks
    const dailyStreak = await this.getStreak(userId, 'daily');

    return {
      totalSessions: sessionStats?.total || 0,
      totalFocusMinutes: sessionStats?.total_minutes || 0,
      averageFocusScore: Math.round(sessionStats?.avg_focus || 0),
      completedSessions: sessionStats?.completed || 0,
      abandonedSessions: sessionStats?.abandoned || 0,
      sessionsByType,
      currentDailyStreak: dailyStreak?.currentStreak || 0,
      longestDailyStreak: dailyStreak?.longestStreak || 0,
    };
  }
}

export const lockinStorage = new LockinStorage();