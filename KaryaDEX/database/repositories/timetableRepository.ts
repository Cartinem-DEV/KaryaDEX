/**
 * BunkMatKar — Timetable Slot Repository
 */

import { getDatabaseConnection } from '../db';
import type { TimetableSlotRow } from '../types';
import type { TimetableSlot, TimetableSlotInput } from '@/types/academic';
import { formatLocalDate } from '@/lib/timeUtils';

export class TimetableRepository {
  async getTimetableSlots(activeOnly = true): Promise<TimetableSlot[]> {
    const db = await getDatabaseConnection();
    const sql = activeOnly
      ? `SELECT * FROM timetable_slots WHERE is_active = 1 ORDER BY start_time ASC;`
      : `SELECT * FROM timetable_slots ORDER BY start_time ASC;`;

    const rows = await db.getAllAsync<TimetableSlotRow>(sql);
    return rows.map(r => this.mapRow(r));
  }

  async getTimetableSlotById(id: string): Promise<TimetableSlot | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<TimetableSlotRow>(
      `SELECT * FROM timetable_slots WHERE id = ?;`,
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async getSlotsForDay(dayOfWeek: string): Promise<TimetableSlot[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TimetableSlotRow>(
      `SELECT * FROM timetable_slots WHERE day_of_week = ? AND is_active = 1 ORDER BY start_time ASC;`,
      [dayOfWeek.toLowerCase()]
    );
    return rows.map(r => this.mapRow(r));
  }

  async getSlotsForSubject(subjectId: string): Promise<TimetableSlot[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TimetableSlotRow>(
      `SELECT * FROM timetable_slots WHERE subject_id = ? AND is_active = 1 ORDER BY start_time ASC;`,
      [subjectId]
    );
    return rows.map(r => this.mapRow(r));
  }

  async getSlotsForSemester(semesterId: string, activeOnly = true): Promise<TimetableSlot[]> {
    const db = await getDatabaseConnection();
    const sql = activeOnly
      ? `SELECT * FROM timetable_slots WHERE semester_id = ? AND is_active = 1 ORDER BY start_time ASC;`
      : `SELECT * FROM timetable_slots WHERE semester_id = ? ORDER BY start_time ASC;`;
    const rows = await db.getAllAsync<TimetableSlotRow>(sql, [semesterId]);
    return rows.map(r => this.mapRow(r));
  }

  async createTimetableSlot(slot: TimetableSlot): Promise<TimetableSlot> {
    const db = await getDatabaseConnection();
    const now = formatLocalDate();
    await db.runAsync(
      `INSERT INTO timetable_slots (id, subject_id, semester_id, day_of_week, start_time, end_time, room, type, is_active, is_recurring, effective_from, effective_until, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        slot.id,
        slot.subjectId,
        slot.semesterId || 'sem-3',
        slot.dayOfWeek,
        slot.startTime,
        slot.endTime,
        slot.room || '',
        slot.type || 'lecture',
        slot.isActive ? 1 : 0,
        slot.isRecurring ? 1 : 0,
        null,
        null,
        slot.createdAt || now,
        slot.updatedAt || now,
      ]
    );
    return slot;
  }

  async updateTimetableSlot(id: string, updates: Partial<TimetableSlotInput>): Promise<void> {
    const db = await getDatabaseConnection();
    const current = await this.getTimetableSlotById(id);
    if (!current) return;

    const merged = { ...current, ...updates, updatedAt: formatLocalDate() };
    await db.runAsync(
      `UPDATE timetable_slots SET
        subject_id = ?,
        day_of_week = ?,
        start_time = ?,
        end_time = ?,
        room = ?,
        type = ?,
        is_recurring = ?,
        effective_from = ?,
        effective_until = ?,
        updated_at = ?
       WHERE id = ?;`,
      [
        merged.subjectId,
        merged.dayOfWeek,
        merged.startTime,
        merged.endTime,
        merged.room || '',
        merged.type || 'lecture',
        merged.isRecurring ? 1 : 0,
        null,
        null,
        merged.updatedAt,
        id,
      ]
    );
  }

  async deleteTimetableSlot(id: string): Promise<void> {
    // Soft delete to preserve historical semester occurrences
    const db = await getDatabaseConnection();
    await db.runAsync(
      `UPDATE timetable_slots SET is_active = 0, updated_at = ? WHERE id = ?;`,
      [formatLocalDate(), id]
    );
  }

  private mapRow(r: TimetableSlotRow): TimetableSlot {
    return {
      id: r.id,
      subjectId: r.subject_id,
      semesterId: r.semester_id || 'sem-3',
      dayOfWeek: r.day_of_week as any,
      startTime: r.start_time,
      endTime: r.end_time,
      room: r.room || '',
      type: r.type as any,
      isActive: r.is_active === 1,
      isRecurring: r.is_recurring === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

export const timetableRepository = new TimetableRepository();
