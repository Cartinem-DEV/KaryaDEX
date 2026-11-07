/**
 * BunkMatKar — Attendance SQLite Repository
 *
 * Persists granular attendance records and authoritative aggregate counters.
 */

import { getDatabaseConnection } from '../db';
import type { AttendanceRecordRow, AttendanceAggregateRow } from '../types';
import type { ClassAttendanceStatus } from '@/types/academic';
import { formatLocalDate } from '@/lib/timeUtils';

export class AttendanceRepository {
  async getAllAggregates(): Promise<Record<string, { attended: number; total: number }>> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<AttendanceAggregateRow>(
      `SELECT * FROM attendance_aggregates;`
    );

    const result: Record<string, { attended: number; total: number }> = {};
    for (const r of rows) {
      result[r.subject_id] = {
        attended: r.attended,
        total: r.total,
      };
    }
    return result;
  }

  async getAggregate(subjectId: string): Promise<{ attended: number; total: number } | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<AttendanceAggregateRow>(
      `SELECT * FROM attendance_aggregates WHERE subject_id = ?;`,
      [subjectId]
    );
    if (!row) return null;
    return { attended: row.attended, total: row.total };
  }

  async setAggregate(subjectId: string, attended: number, total: number): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `INSERT INTO attendance_aggregates (subject_id, attended, total, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(subject_id) DO UPDATE SET
         attended = excluded.attended,
         total = excluded.total,
         updated_at = excluded.updated_at;`,
      [subjectId, attended, total]
    );
  }

  /**
   * Transition-aware persistence that updates both the attendance log and cached counters.
   */
  async recordAttendanceTransition(
    subjectId: string,
    prevStatus?: ClassAttendanceStatus,
    newStatus?: ClassAttendanceStatus,
    date?: string,
    classSessionId?: string
  ): Promise<{ attended: number; total: number }> {
    if (prevStatus === newStatus) {
      const current = await this.getAggregate(subjectId);
      return current || { attended: 0, total: 0 };
    }

    const db = await getDatabaseConnection();
    const getContribution = (status?: ClassAttendanceStatus): { attended: number; total: number } => {
      if (status === 'present' || status === 'late') return { attended: 1, total: 1 };
      if (status === 'absent') return { attended: 0, total: 1 };
      return { attended: 0, total: 0 };
    };

    const prevContrib = getContribution(prevStatus);
    const newContrib = getContribution(newStatus);
    const deltaAttended = newContrib.attended - prevContrib.attended;
    const deltaTotal = newContrib.total - prevContrib.total;

    return await db.withTransactionAsync(async () => {
      const current = await this.getAggregate(subjectId) || { attended: 0, total: 0 };
      const newAttended = Math.max(0, current.attended + deltaAttended);
      const newTotal = Math.max(newAttended, current.total + deltaTotal);

      await this.setAggregate(subjectId, newAttended, newTotal);

      // Record occurrence log if date is provided
      if (date && newStatus) {
        const now = new Date().toISOString();
        await db.runAsync(
          `INSERT INTO attendance_records (id, subject_id, class_session_id, date, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(subject_id, date, class_session_id) DO UPDATE SET
             status = excluded.status,
             updated_at = excluded.updated_at;`,
          [
            `att-${subjectId}-${date}-${classSessionId || 'general'}`,
            subjectId,
            classSessionId || null,
            date,
            newStatus,
            now,
            now,
          ]
        );
      }

      return { attended: newAttended, total: newTotal };
    });
  }

  async getAttendanceRecordsForSubject(subjectId: string): Promise<AttendanceRecordRow[]> {
    const db = await getDatabaseConnection();
    return await db.getAllAsync<AttendanceRecordRow>(
      `SELECT * FROM attendance_records WHERE subject_id = ? ORDER BY date DESC;`,
      [subjectId]
    );
  }
}

export const attendanceRepository = new AttendanceRepository();
