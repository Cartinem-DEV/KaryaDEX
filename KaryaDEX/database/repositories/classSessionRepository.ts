/**
 * KaryaDEX — Class Session & Journal Repository
 *
 * Provides transactional persistence for individual Class Session occurrences and journals.
 */

import { getDatabaseConnection } from '../db';
import type { ClassSessionRow, ClassNoteRow } from '../types';
import type {
  ClassNote,
  ClassAttendanceStatus,
  RevisionStatus,
  Resource,
} from '@/types/academic';
import { formatLocalDate } from '@/lib/timeUtils';

export interface ClassSessionEntity {
  id: string;
  timetableSlotId: string;
  subjectId: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string;
  type?: string;
  attendanceStatus: ClassAttendanceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AtomicClassSessionPayload {
  slotId: string;
  date: string; // YYYY-MM-DD
  subjectId: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  type?: string;
  attendanceStatus: ClassAttendanceStatus;
  selectedTopicIds: string[];
  myNotes: string;
  teacherNotes: string;
  revisionStatus: RevisionStatus;
  resources: Resource[];
  linkedTaskIds: string[];
  aiSummaryStatus?: string;
  aiSourceHash?: string;
}

export class ClassSessionRepository {
  /**
   * Simple upsert for a ClassNote row + topic links.
   * Used by the seeder and for direct note persistence (not the full atomic save).
   */
  async upsertClassNote(note: ClassNote): Promise<ClassNote> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO class_notes (
        id, class_session_id, date, subject_id, attendance_status,
        my_notes, teacher_notes, revision_status, last_revised_at,
        ai_summary, ai_summary_status, ai_summary_updated_at, ai_source_hash,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(class_session_id, date) DO UPDATE SET
        attendance_status = excluded.attendance_status,
        my_notes = excluded.my_notes,
        teacher_notes = excluded.teacher_notes,
        revision_status = excluded.revision_status,
        last_revised_at = excluded.last_revised_at,
        updated_at = excluded.updated_at;`,
      [
        note.id,
        note.classSessionId,
        note.date,
        note.subjectId,
        note.attendanceStatus || 'not_recorded',
        note.myNotes || '',
        note.teacherNotes || '',
        note.revisionStatus || 'not_started',
        note.lastRevisedAt || null,
        note.aiSummary || null,
        note.aiSummaryStatus || null,
        note.aiSummaryUpdatedAt || null,
        note.aiSourceHash || null,
        note.createdAt || now,
        note.updatedAt || now,
      ]
    );

    // Insert topic links
    if (note.topicIds && note.topicIds.length > 0) {
      for (const topicId of note.topicIds) {
        await db.runAsync(
          `INSERT OR IGNORE INTO class_session_topics (id, class_session_id, date, topic_id, created_at)
           VALUES (?, ?, ?, ?, ?);`,
          [`cst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, note.classSessionId, note.date, topicId, now]
        );
      }
    }

    return note;
  }

  async getClassSession(timetableSlotId: string, date: string): Promise<ClassSessionEntity | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<ClassSessionRow>(
      `SELECT * FROM class_sessions WHERE timetable_slot_id = ? AND date = ?;`,
      [timetableSlotId, date]
    );
    if (!row) return null;
    return this.mapSessionRow(row);
  }

  async getAllClassSessions(): Promise<ClassSessionEntity[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<ClassSessionRow>(
      `SELECT * FROM class_sessions ORDER BY date DESC, start_time ASC;`
    );
    return rows.map(r => this.mapSessionRow(r));
  }

  async getClassNote(classSessionId: string, date: string): Promise<ClassNote | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<ClassNoteRow>(
      `SELECT * FROM class_notes WHERE class_session_id = ? AND date = ?;`,
      [classSessionId, date]
    );
    if (!row) return null;

    // Fetch linked topics
    const topicRows = await db.getAllAsync<{ topic_id: string }>(
      `SELECT topic_id FROM class_session_topics WHERE class_session_id = ? AND date = ?;`,
      [classSessionId, date]
    );

    // Fetch linked tasks
    const taskRows = await db.getAllAsync<{ task_id: string }>(
      `SELECT task_id FROM task_relations WHERE class_session_id = ? AND (class_date = ? OR class_date IS NULL);`,
      [classSessionId, date]
    );

    // Fetch linked resources
    const resRows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM resources WHERE class_note_id = ? OR class_session_id = ?;`,
      [row.id, classSessionId]
    );

    return {
      id: row.id,
      classSessionId: row.class_session_id,
      date: row.date,
      subjectId: row.subject_id,
      attendanceStatus: row.attendance_status as ClassAttendanceStatus,
      topicIds: topicRows.map(t => t.topic_id),
      myNotes: row.my_notes,
      teacherNotes: row.teacher_notes,
      revisionStatus: row.revision_status as RevisionStatus,
      lastRevisedAt: row.last_revised_at || undefined,
      resourceIds: resRows.map(r => r.id),
      linkedTaskIds: taskRows.map(t => t.task_id),
      linkedExamTopicIds: [],
      aiSummary: row.ai_summary || undefined,
      aiSummaryStatus: (row.ai_summary_status as any) || undefined,
      aiSummaryUpdatedAt: row.ai_summary_updated_at || undefined,
      aiSourceHash: row.ai_source_hash || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAllClassNotes(): Promise<ClassNote[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<ClassNoteRow>(
      `SELECT * FROM class_notes ORDER BY date DESC;`
    );

    const notes: ClassNote[] = [];
    for (const row of rows) {
      const topicRows = await db.getAllAsync<{ topic_id: string }>(
        `SELECT topic_id FROM class_session_topics WHERE class_session_id = ? AND date = ?;`,
        [row.class_session_id, row.date]
      );
      notes.push({
        id: row.id,
        classSessionId: row.class_session_id,
        date: row.date,
        subjectId: row.subject_id,
        attendanceStatus: row.attendance_status as ClassAttendanceStatus,
        topicIds: topicRows.map(t => t.topic_id),
        myNotes: row.my_notes,
        teacherNotes: row.teacher_notes,
        revisionStatus: row.revision_status as RevisionStatus,
        lastRevisedAt: row.last_revised_at || undefined,
        resourceIds: [],
        linkedTaskIds: [],
        linkedExamTopicIds: [],
        aiSummary: row.ai_summary || undefined,
        aiSummaryStatus: (row.ai_summary_status as any) || undefined,
        aiSummaryUpdatedAt: row.ai_summary_updated_at || undefined,
        aiSourceHash: row.ai_source_hash || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
    return notes;
  }

  /**
   * Atomically saves a ClassSession and all its associated academic entities.
   * If any step fails, the entire transaction is rolled back.
   */
  async atomicSaveSession(payload: AtomicClassSessionPayload): Promise<ClassNote> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();
    const localDateStr = payload.date;

    return await db.withTransactionAsync(async () => {
      // 1. Upsert class_sessions
      const sessionId = `cs-${payload.slotId}-${localDateStr}`;
      await db.runAsync(
        `INSERT INTO class_sessions (
          id, timetable_slot_id, subject_id, date, start_time, end_time, room, type, attendance_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(timetable_slot_id, date) DO UPDATE SET
          attendance_status = excluded.attendance_status,
          updated_at = excluded.updated_at;`,
        [
          sessionId,
          payload.slotId,
          payload.subjectId,
          localDateStr,
          payload.startTime || '09:00',
          payload.endTime || '10:00',
          payload.room || null,
          payload.type || 'lecture',
          payload.attendanceStatus,
          now,
          now,
        ]
      );

      // 2. Upsert class_notes
      const existingNote = await db.getFirstAsync<ClassNoteRow>(
        `SELECT id, created_at FROM class_notes WHERE class_session_id = ? AND date = ?;`,
        [payload.slotId, localDateStr]
      );

      const noteId = existingNote ? existingNote.id : `cn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const createdAt = existingNote ? existingNote.created_at : now;

      await db.runAsync(
        `INSERT INTO class_notes (
          id, class_session_id, date, subject_id, attendance_status, my_notes, teacher_notes, revision_status,
          last_revised_at, ai_summary, ai_summary_status, ai_summary_updated_at, ai_source_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(class_session_id, date) DO UPDATE SET
          attendance_status = excluded.attendance_status,
          my_notes = excluded.my_notes,
          teacher_notes = excluded.teacher_notes,
          revision_status = excluded.revision_status,
          last_revised_at = excluded.last_revised_at,
          ai_summary_status = excluded.ai_summary_status,
          ai_source_hash = excluded.ai_source_hash,
          updated_at = excluded.updated_at;`,
        [
          noteId,
          payload.slotId,
          localDateStr,
          payload.subjectId,
          payload.attendanceStatus,
          payload.myNotes,
          payload.teacherNotes,
          payload.revisionStatus,
          payload.revisionStatus === 'revised' ? now : null,
          null, // ai_summary
          payload.aiSummaryStatus || (payload.myNotes.trim() || payload.teacherNotes.trim() ? 'pending' : 'unavailable'),
          null, // ai_summary_updated_at
          payload.aiSourceHash || null,
          createdAt,
          now,
        ]
      );

      // 3. Sync topic associations
      await db.runAsync(
        `DELETE FROM class_session_topics WHERE class_session_id = ? AND date = ?;`,
        [payload.slotId, localDateStr]
      );

      for (const topicId of payload.selectedTopicIds) {
        await db.runAsync(
          `INSERT INTO class_session_topics (id, class_session_id, date, topic_id, created_at)
           VALUES (?, ?, ?, ?, ?);`,
          [`cst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, payload.slotId, localDateStr, topicId, now]
        );

        // Update topic taught status if not revised
        await db.runAsync(
          `UPDATE topics SET
            revision_status = CASE WHEN revision_status = 'not_started' THEN 'taught' ELSE revision_status END,
            is_completed = 1,
            updated_at = datetime('now')
           WHERE id = ?;`,
          [topicId]
        );
      }

      // 4. Save resources
      for (const res of payload.resources) {
        await db.runAsync(
          `INSERT INTO resources (
            id, class_note_id, class_session_id, subject_id, topic_id, title, type, uri, url, mime_type, file_size, source, is_local, is_recommended, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title = excluded.title, uri = excluded.uri, url = excluded.url;`,
          [
            res.id,
            noteId,
            payload.slotId,
            payload.subjectId,
            res.topicId || null,
            res.title,
            res.type,
            res.uri || null,
            res.url || null,
            res.mimeType || null,
            res.fileSize || 0,
            res.source || 'file',
            res.isLocal ? 1 : 0,
            res.isRecommended ? 1 : 0,
            res.createdAt || now,
          ]
        );
      }

      // 5. Update task relations
      for (const taskId of payload.linkedTaskIds) {
        await db.runAsync(
          `INSERT INTO task_relations (id, task_id, class_session_id, class_date, class_note_id, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(task_id, class_session_id) DO NOTHING;`,
          [`tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, taskId, payload.slotId, localDateStr, noteId]
        );
      }

      // 6. Record attendance log
      await db.runAsync(
        `INSERT INTO attendance_records (id, subject_id, class_session_id, date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(subject_id, date, class_session_id) DO UPDATE SET
           status = excluded.status,
           updated_at = excluded.updated_at;`,
        [
          `att-${payload.subjectId}-${localDateStr}-${payload.slotId}`,
          payload.subjectId,
          payload.slotId,
          localDateStr,
          payload.attendanceStatus,
          now,
          now,
        ]
      );

      const savedNote: ClassNote = {
        id: noteId,
        classSessionId: payload.slotId,
        date: localDateStr,
        subjectId: payload.subjectId,
        attendanceStatus: payload.attendanceStatus,
        topicIds: payload.selectedTopicIds,
        myNotes: payload.myNotes,
        teacherNotes: payload.teacherNotes,
        revisionStatus: payload.revisionStatus,
        lastRevisedAt: payload.revisionStatus === 'revised' ? now : undefined,
        resourceIds: payload.resources.map(r => r.id),
        linkedTaskIds: payload.linkedTaskIds,
        linkedExamTopicIds: [],
        aiSummaryStatus: (payload.aiSummaryStatus as any) || 'unavailable',
        aiSourceHash: payload.aiSourceHash,
        createdAt,
        updatedAt: now,
      };

      return savedNote;
    });
  }

  private mapSessionRow(r: ClassSessionRow): ClassSessionEntity {
    return {
      id: r.id,
      timetableSlotId: r.timetable_slot_id,
      subjectId: r.subject_id,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      room: r.room || undefined,
      type: r.type,
      attendanceStatus: r.attendance_status as ClassAttendanceStatus,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

export const classSessionRepository = new ClassSessionRepository();
