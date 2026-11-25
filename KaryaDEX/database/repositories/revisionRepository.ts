/**
 * KaryaDEX — Topic Revision Repository (Phase 7)
 *
 * Persistent, SQLite-backed repository for topic revision history records.
 * Supports CRUD, topic/subject/semester filtering, date ranges, latest revision,
 * and deterministic statistics calculation.
 */

import { getDatabaseConnection } from '../db';
import type { TopicRevisionHistoryRow, TopicRow, RevisionRecordRow } from '../types';
import type {
  RevisionStatus,
  Topic,
  RevisionRecord,
  RevisionRecordInput,
  RevisionStatistics,
  RevisionConfidence,
  RevisionOutcome,
} from '@/types/academic';
import { formatLocalDate } from '@/lib/timeUtils';

function mapRevisionRecordRow(row: RevisionRecordRow): RevisionRecord {
  return {
    id: row.id,
    topicId: row.topic_id,
    subjectId: row.subject_id,
    semesterId: row.semester_id || undefined,
    reviewedAt: row.reviewed_at,
    durationMinutes: Number(row.duration_minutes) || 0,
    confidence: (row.confidence || 'medium') as RevisionConfidence,
    outcome: (row.outcome || 'okay') as RevisionOutcome,
    notes: row.notes || undefined,
    linkedTaskId: row.linked_task_id || undefined,
    linkedClassSessionId: row.linked_class_session_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RevisionRepository {
  /**
   * Creates and persists a new RevisionRecord in SQLite.
   * Also updates the parent topic's revision_status, last_revised_at, and revision_count.
   */
  async createRecord(input: RevisionRecordInput): Promise<RevisionRecord> {
    const db = await getDatabaseConnection();
    const id = input.id || `rr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const reviewedAt = input.reviewedAt || formatLocalDate();

    const record: RevisionRecord = {
      id,
      topicId: input.topicId,
      subjectId: input.subjectId,
      semesterId: input.semesterId,
      reviewedAt,
      durationMinutes: input.durationMinutes || 0,
      confidence: input.confidence,
      outcome: input.outcome,
      notes: input.notes,
      linkedTaskId: input.linkedTaskId,
      linkedClassSessionId: input.linkedClassSessionId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.withTransactionAsync(async () => {
      // 1. Insert revision_records row
      await db.runAsync(
        `INSERT INTO revision_records (
          id, topic_id, subject_id, semester_id, reviewed_at,
          duration_minutes, confidence, outcome, notes,
          linked_task_id, linked_class_session_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          record.id,
          record.topicId,
          record.subjectId,
          record.semesterId || null,
          record.reviewedAt,
          record.durationMinutes,
          record.confidence,
          record.outcome,
          record.notes || null,
          record.linkedTaskId || null,
          record.linkedClassSessionId || null,
          record.createdAt,
          record.updatedAt,
        ]
      );

      // 2. Also record in legacy topic_revision_history for backward compatibility
      const legacyStatus: RevisionStatus =
        record.outcome === 'confident' || record.outcome === 'okay'
          ? 'revised'
          : 'needs_revision';

      await db.runAsync(
        `INSERT INTO topic_revision_history (id, topic_id, revision_status, revised_at, class_session_id, notes)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          `trh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          record.topicId,
          legacyStatus,
          record.reviewedAt,
          record.linkedClassSessionId || null,
          record.notes || null,
        ]
      );

      // 3. Update parent topic entity
      await db.runAsync(
        `UPDATE topics SET
          revision_status = ?,
          last_revised_at = ?,
          revision_count = revision_count + 1,
          updated_at = ?
         WHERE id = ?;`,
        [legacyStatus, record.reviewedAt, nowIso, record.topicId]
      );
    });

    return record;
  }

  /**
   * Retrieves a RevisionRecord by ID.
   */
  async getRecordById(id: string): Promise<RevisionRecord | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<RevisionRecordRow>(
      `SELECT * FROM revision_records WHERE id = ?;`,
      [id]
    );
    return row ? mapRevisionRecordRow(row) : null;
  }

  /**
   * Updates an existing RevisionRecord.
   */
  async updateRecord(id: string, updates: Partial<RevisionRecordInput>): Promise<void> {
    const db = await getDatabaseConnection();
    const existing = await this.getRecordById(id);
    if (!existing) return;

    const updatedNow = new Date().toISOString();
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.durationMinutes !== undefined) {
      setClauses.push('duration_minutes = ?');
      values.push(updates.durationMinutes);
    }
    if (updates.confidence !== undefined) {
      setClauses.push('confidence = ?');
      values.push(updates.confidence);
    }
    if (updates.outcome !== undefined) {
      setClauses.push('outcome = ?');
      values.push(updates.outcome);
    }
    if (updates.notes !== undefined) {
      setClauses.push('notes = ?');
      values.push(updates.notes || null);
    }
    if (updates.reviewedAt !== undefined) {
      setClauses.push('reviewed_at = ?');
      values.push(updates.reviewedAt);
    }
    if (updates.linkedTaskId !== undefined) {
      setClauses.push('linked_task_id = ?');
      values.push(updates.linkedTaskId || null);
    }
    if (updates.linkedClassSessionId !== undefined) {
      setClauses.push('linked_class_session_id = ?');
      values.push(updates.linkedClassSessionId || null);
    }

    setClauses.push('updated_at = ?');
    values.push(updatedNow);
    values.push(id);

    await db.runAsync(
      `UPDATE revision_records SET ${setClauses.join(', ')} WHERE id = ?;`,
      values
    );
  }

  /**
   * Deletes a RevisionRecord by ID.
   */
  async deleteRecord(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM revision_records WHERE id = ?;`, [id]);
  }

  /**
   * Retrieves all RevisionRecords for a given Topic, newest first.
   */
  async getRecordsByTopic(topicId: string): Promise<RevisionRecord[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<RevisionRecordRow>(
      `SELECT * FROM revision_records WHERE topic_id = ? ORDER BY reviewed_at DESC;`,
      [topicId]
    );
    return rows.map(mapRevisionRecordRow);
  }

  /**
   * Retrieves all RevisionRecords for a Subject, newest first.
   */
  async getRecordsBySubject(subjectId: string): Promise<RevisionRecord[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<RevisionRecordRow>(
      `SELECT * FROM revision_records WHERE subject_id = ? ORDER BY reviewed_at DESC;`,
      [subjectId]
    );
    return rows.map(mapRevisionRecordRow);
  }

  /**
   * Retrieves all RevisionRecords for a Semester, newest first.
   */
  async getRecordsBySemester(semesterId: string): Promise<RevisionRecord[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<RevisionRecordRow>(
      `SELECT * FROM revision_records WHERE semester_id = ? ORDER BY reviewed_at DESC;`,
      [semesterId]
    );
    return rows.map(mapRevisionRecordRow);
  }

  /**
   * Retrieves RevisionRecords within a date range [startDate, endDate], inclusive.
   */
  async getRecordsByDateRange(
    startDate: string,
    endDate: string,
    semesterId?: string
  ): Promise<RevisionRecord[]> {
    const db = await getDatabaseConnection();
    if (semesterId) {
      const rows = await db.getAllAsync<RevisionRecordRow>(
        `SELECT * FROM revision_records WHERE semester_id = ? AND reviewed_at >= ? AND reviewed_at <= ? ORDER BY reviewed_at DESC;`,
        [semesterId, startDate, endDate]
      );
      return rows.map(mapRevisionRecordRow);
    }
    const rows = await db.getAllAsync<RevisionRecordRow>(
      `SELECT * FROM revision_records WHERE reviewed_at >= ? AND reviewed_at <= ? ORDER BY reviewed_at DESC;`,
      [startDate, endDate]
    );
    return rows.map(mapRevisionRecordRow);
  }

  /**
   * Retrieves the most recent RevisionRecord for a specific topic.
   */
  async getLatestRecord(topicId: string): Promise<RevisionRecord | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<RevisionRecordRow>(
      `SELECT * FROM revision_records WHERE topic_id = ? ORDER BY reviewed_at DESC LIMIT 1;`,
      [topicId]
    );
    return row ? mapRevisionRecordRow(row) : null;
  }

  /**
   * Retrieves all RevisionRecords, optionally filtered by semester.
   */
  async getAllRecords(semesterId?: string): Promise<RevisionRecord[]> {
    const db = await getDatabaseConnection();
    if (semesterId) {
      return this.getRecordsBySemester(semesterId);
    }
    const rows = await db.getAllAsync<RevisionRecordRow>(
      `SELECT * FROM revision_records ORDER BY reviewed_at DESC;`
    );
    return rows.map(mapRevisionRecordRow);
  }

  /**
   * Computes revision statistics for a subject or semester.
   */
  async getRevisionStatistics(
    subjectId?: string,
    semesterId?: string
  ): Promise<RevisionStatistics> {
    const db = await getDatabaseConnection();

    // Query topics
    let topicSql = `SELECT * FROM topics`;
    const topicParams: any[] = [];
    if (subjectId) {
      topicSql += ` WHERE subject_id = ?`;
      topicParams.push(subjectId);
    }
    const topicRows = await db.getAllAsync<TopicRow>(topicSql, topicParams);

    // Query revision records
    let recSql = `SELECT * FROM revision_records`;
    const recParams: any[] = [];
    if (subjectId && semesterId) {
      recSql += ` WHERE subject_id = ? AND semester_id = ?`;
      recParams.push(subjectId, semesterId);
    } else if (subjectId) {
      recSql += ` WHERE subject_id = ?`;
      recParams.push(subjectId);
    } else if (semesterId) {
      recSql += ` WHERE semester_id = ?`;
      recParams.push(semesterId);
    }
    const recRows = await db.getAllAsync<RevisionRecordRow>(recSql, recParams);
    const records = recRows.map(mapRevisionRecordRow);

    // Group latest record by topic
    const latestByTopic = new Map<string, RevisionRecord>();
    let totalDurationMinutes = 0;

    for (const rec of records) {
      totalDurationMinutes += rec.durationMinutes;
      const existing = latestByTopic.get(rec.topicId);
      if (!existing || rec.reviewedAt > existing.reviewedAt) {
        latestByTopic.set(rec.topicId, rec);
      }
    }

    let taughtTopics = 0;
    let reviewedTopics = 0;
    let confidentTopics = 0;
    let needsReviewTopics = 0;
    let notReviewedTopics = 0;

    for (const t of topicRows) {
      const isTaught =
        t.is_completed === 1 ||
        t.revision_status === 'taught' ||
        t.revision_status === 'revised' ||
        t.revision_status === 'needs_revision';

      if (isTaught) taughtTopics++;

      const latest = latestByTopic.get(t.id);
      if (latest) {
        reviewedTopics++;
        if (latest.outcome === 'confident') confidentTopics++;
        else if (latest.outcome === 'needs_review') needsReviewTopics++;
      } else if (isTaught) {
        notReviewedTopics++;
      }
    }

    return {
      totalTopics: topicRows.length,
      taughtTopics,
      reviewedTopics,
      confidentTopics,
      needsReviewTopics,
      notReviewedTopics,
      criticalCount: 0,
      highPriorityCount: 0,
      totalDurationMinutes,
    };
  }

  // ─── Legacy Compatibility Methods ─────────────────────────────

  async recordRevision(
    topicId: string,
    status: RevisionStatus,
    classSessionId?: string,
    notes?: string
  ): Promise<void> {
    const db = await getDatabaseConnection();
    const topic = await db.getFirstAsync<TopicRow>(
      `SELECT * FROM topics WHERE id = ?;`,
      [topicId]
    );

    const subjectId = topic?.subject_id || '';
    const outcome: RevisionOutcome =
      status === 'revised' ? 'okay' : 'needs_review';

    await this.createRecord({
      topicId,
      subjectId,
      reviewedAt: formatLocalDate(),
      durationMinutes: 15,
      confidence: 'medium',
      outcome,
      notes: notes || undefined,
      linkedClassSessionId: classSessionId,
    });
  }

  async getRevisionHistory(topicId?: string): Promise<TopicRevisionHistoryRow[]> {
    const db = await getDatabaseConnection();
    if (topicId) {
      return await db.getAllAsync<TopicRevisionHistoryRow>(
        `SELECT * FROM topic_revision_history WHERE topic_id = ? ORDER BY revised_at DESC;`,
        [topicId]
      );
    }
    return await db.getAllAsync<TopicRevisionHistoryRow>(
      `SELECT * FROM topic_revision_history ORDER BY revised_at DESC;`
    );
  }

  async getTopicsNeedingRevision(subjectId?: string): Promise<Topic[]> {
    const db = await getDatabaseConnection();
    const sql = subjectId
      ? `SELECT * FROM topics WHERE subject_id = ? AND revision_status = 'needs_revision' ORDER BY order_index ASC;`
      : `SELECT * FROM topics WHERE revision_status = 'needs_revision' ORDER BY order_index ASC;`;
    const params = subjectId ? [subjectId] : [];
    const rows = await db.getAllAsync<TopicRow>(sql, params);
    return rows.map(r => ({
      id: r.id,
      unitId: r.unit_id,
      subjectId: r.subject_id,
      name: r.name,
      isCompleted: r.is_completed === 1,
      revisionStatus: r.revision_status as RevisionStatus,
      lastRevisedAt: r.last_revised_at || undefined,
      revisionCount: r.revision_count,
      order: r.order_index,
      classNoteIds: [],
    }));
  }

  async getTopicsTaughtNotRevised(subjectId?: string): Promise<Topic[]> {
    const db = await getDatabaseConnection();
    const sql = subjectId
      ? `SELECT * FROM topics WHERE subject_id = ? AND revision_status = 'taught' ORDER BY order_index ASC;`
      : `SELECT * FROM topics WHERE revision_status = 'taught' ORDER BY order_index ASC;`;
    const params = subjectId ? [subjectId] : [];
    const rows = await db.getAllAsync<TopicRow>(sql, params);
    return rows.map(r => ({
      id: r.id,
      unitId: r.unit_id,
      subjectId: r.subject_id,
      name: r.name,
      isCompleted: r.is_completed === 1,
      revisionStatus: r.revision_status as RevisionStatus,
      lastRevisedAt: r.last_revised_at || undefined,
      revisionCount: r.revision_count,
      order: r.order_index,
      classNoteIds: [],
    }));
  }
}

export const revisionRepository = new RevisionRepository();
