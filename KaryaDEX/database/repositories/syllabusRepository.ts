/**
 * BunkMatKar — Syllabus & Topics Repository
 *
 * Manages syllabus units, topics, and cascading integrity rules.
 */

import { getDatabaseConnection } from '../db';
import type { SyllabusUnitRow, TopicRow } from '../types';
import type { SyllabusUnit, Topic, RevisionStatus } from '@/types/academic';

export class SyllabusRepository {
  async getUnitsForSubject(subjectId: string): Promise<SyllabusUnit[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<SyllabusUnitRow>(
      `SELECT * FROM syllabus_units WHERE subject_id = ? ORDER BY order_index ASC;`,
      [subjectId]
    );

    const units: SyllabusUnit[] = [];
    for (const r of rows) {
      const topicRows = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM topics WHERE unit_id = ? ORDER BY order_index ASC;`,
        [r.id]
      );
      units.push({
        id: r.id,
        subjectId: r.subject_id,
        semesterId: r.semester_id || 'sem-3',
        name: r.name,
        order: r.order_index,
        topicIds: topicRows.map(t => t.id),
      });
    }
    return units;
  }

  async getAllUnits(): Promise<SyllabusUnit[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<SyllabusUnitRow>(
      `SELECT * FROM syllabus_units ORDER BY order_index ASC;`
    );

    const units: SyllabusUnit[] = [];
    for (const r of rows) {
      const topicRows = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM topics WHERE unit_id = ? ORDER BY order_index ASC;`,
        [r.id]
      );
      units.push({
        id: r.id,
        subjectId: r.subject_id,
        semesterId: r.semester_id || 'sem-3',
        name: r.name,
        order: r.order_index,
        topicIds: topicRows.map(t => t.id),
      });
    }
    return units;
  }

  async createUnit(unit: SyllabusUnit): Promise<SyllabusUnit> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `INSERT INTO syllabus_units (id, subject_id, semester_id, name, order_index, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'));`,
      [unit.id, unit.subjectId, unit.semesterId || null, unit.name, unit.order]
    );
    return unit;
  }

  async updateUnit(id: string, updates: Partial<Omit<SyllabusUnit, 'id'>>): Promise<void> {
    const db = await getDatabaseConnection();
    if (updates.name !== undefined) {
      await db.runAsync(
        `UPDATE syllabus_units SET name = ? WHERE id = ?;`,
        [updates.name, id]
      );
    }
    if (updates.order !== undefined) {
      await db.runAsync(
        `UPDATE syllabus_units SET order_index = ? WHERE id = ?;`,
        [updates.order, id]
      );
    }
  }

  /**
   * Cascading unit deletion: deletes unit, its child topics, and cleans up
   * foreign references across exam topics, class session topic links, and resources.
   */
  async deleteUnit(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.withTransactionAsync(async () => {
      // Find all child topics
      const childTopics = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM topics WHERE unit_id = ?;`,
        [id]
      );
      const topicIds = childTopics.map(t => t.id);

      for (const tid of topicIds) {
        await db.runAsync(`DELETE FROM exam_topics WHERE topic_id = ?;`, [tid]);
        await db.runAsync(`DELETE FROM class_session_topics WHERE topic_id = ?;`, [tid]);
        await db.runAsync(`DELETE FROM topic_revision_history WHERE topic_id = ?;`, [tid]);
        await db.runAsync(`UPDATE resources SET topic_id = NULL WHERE topic_id = ?;`, [tid]);
      }

      await db.runAsync(`DELETE FROM topics WHERE unit_id = ?;`, [id]);
      await db.runAsync(`DELETE FROM syllabus_units WHERE id = ?;`, [id]);
    });
  }

  async getTopicsForSubject(subjectId: string): Promise<Topic[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TopicRow>(
      `SELECT * FROM topics WHERE subject_id = ? ORDER BY order_index ASC;`,
      [subjectId]
    );
    return rows.map(r => this.mapTopicRow(r));
  }

  async getAllTopics(): Promise<Topic[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TopicRow>(
      `SELECT * FROM topics ORDER BY order_index ASC;`
    );
    return rows.map(r => this.mapTopicRow(r));
  }

  async getTopicsForUnit(unitId: string): Promise<Topic[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TopicRow>(
      `SELECT * FROM topics WHERE unit_id = ? ORDER BY order_index ASC;`,
      [unitId]
    );
    return rows.map(r => this.mapTopicRow(r));
  }

  async getTopicById(id: string): Promise<Topic | null> {
    const db = await getDatabaseConnection();
    const r = await db.getFirstAsync<TopicRow>(
      `SELECT * FROM topics WHERE id = ?;`,
      [id]
    );
    return r ? this.mapTopicRow(r) : null;
  }

  async createTopic(topic: Topic): Promise<Topic> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `INSERT INTO topics (id, unit_id, subject_id, name, is_completed, revision_status, last_revised_at, revision_count, order_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'));`,
      [
        topic.id,
        topic.unitId,
        topic.subjectId,
        topic.name,
        topic.isCompleted ? 1 : 0,
        topic.revisionStatus || 'not_started',
        topic.lastRevisedAt || null,
        topic.revisionCount || 0,
        topic.order || 0,
      ]
    );
    return topic;
  }

  async updateTopic(id: string, updates: Partial<Topic>): Promise<void> {
    const db = await getDatabaseConnection();
    const current = await this.getTopicById(id);
    if (!current) return;

    const merged = { ...current, ...updates };
    await db.runAsync(
      `UPDATE topics SET
        name = ?,
        is_completed = ?,
        revision_status = ?,
        last_revised_at = ?,
        revision_count = ?,
        order_index = ?,
        updated_at = datetime('now')
       WHERE id = ?;`,
      [
        merged.name,
        merged.isCompleted ? 1 : 0,
        merged.revisionStatus,
        merged.lastRevisedAt || null,
        merged.revisionCount || 0,
        merged.order || 0,
        id,
      ]
    );
  }

  async toggleTopicCompletion(id: string): Promise<boolean> {
    const db = await getDatabaseConnection();
    const current = await this.getTopicById(id);
    if (!current) return false;

    const newCompleted = !current.isCompleted;
    await db.runAsync(
      `UPDATE topics SET is_completed = ?, updated_at = datetime('now') WHERE id = ?;`,
      [newCompleted ? 1 : 0, id]
    );
    return newCompleted;
  }

  private mapTopicRow(r: TopicRow): Topic {
    return {
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
    };
  }
}

export const syllabusRepository = new SyllabusRepository();
