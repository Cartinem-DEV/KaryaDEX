/**
 * KaryaDEX — Exams & Exam Topics Repository
 */

import { getDatabaseConnection } from '../db';
import type { ExamRow, ExamTopicRow } from '../types';
import type { Exam } from '@/types';
import type { ExamTopic, ExamWithTopics } from '@/types/academic';

export class ExamRepository {
  async getExams(): Promise<Exam[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<ExamRow>(
      `SELECT * FROM exams ORDER BY date ASC, time ASC;`
    );
    return rows.map(r => this.mapExamRow(r));
  }

  async getExamById(id: string): Promise<Exam | null> {
    const db = await getDatabaseConnection();
    const r = await db.getFirstAsync<ExamRow>(
      `SELECT * FROM exams WHERE id = ?;`,
      [id]
    );
    return r ? this.mapExamRow(r) : null;
  }

  async createExam(exam: Exam): Promise<Exam> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `INSERT INTO exams (
        id, subject_id, semester_id, name, type, date, time, room, max_marks,
        weightage, syllabus_notes, revision_progress, venue, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
      [
        exam.id,
        exam.subjectId,
        exam.semesterId || null,
        exam.name,
        exam.type,
        exam.date,
        exam.time,
        exam.room || null,
        exam.maxMarks,
        exam.weightage || null,
        null, // syllabus_notes
        0,    // revision_progress
        exam.room || null,
      ]
    );
    return exam;
  }

  async updateExam(id: string, updates: Partial<Exam & { syllabusNotes?: string; revisionProgress?: number; venue?: string }>): Promise<void> {
    const db = await getDatabaseConnection();
    const current = await this.getExamById(id);
    if (!current) return;

    await db.runAsync(
      `UPDATE exams SET
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        date = COALESCE(?, date),
        time = COALESCE(?, time),
        room = COALESCE(?, room),
        max_marks = COALESCE(?, max_marks),
        weightage = COALESCE(?, weightage),
        syllabus_notes = COALESCE(?, syllabus_notes),
        revision_progress = COALESCE(?, revision_progress),
        venue = COALESCE(?, venue)
       WHERE id = ?;`,
      [
        updates.name || null,
        updates.type || null,
        updates.date || null,
        updates.time || null,
        updates.room || null,
        updates.maxMarks !== undefined ? updates.maxMarks : null,
        updates.weightage !== undefined ? updates.weightage : null,
        updates.syllabusNotes || null,
        updates.revisionProgress !== undefined ? updates.revisionProgress : null,
        updates.venue || null,
        id,
      ]
    );
  }

  async deleteExam(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM exam_topics WHERE exam_id = ?;`, [id]);
      await db.runAsync(`DELETE FROM exams WHERE id = ?;`, [id]);
    });
  }

  async getTopicsForExam(examId: string): Promise<ExamTopic[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<ExamTopicRow>(
      `SELECT * FROM exam_topics WHERE exam_id = ?;`,
      [examId]
    );
    return rows.map(r => ({
      id: r.id,
      examId: r.exam_id,
      topicId: r.topic_id,
      weightHint: (r.weight_hint as any) || undefined,
    }));
  }

  async getAllExamTopics(): Promise<ExamTopic[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<ExamTopicRow>(`SELECT * FROM exam_topics;`);
    return rows.map(r => ({
      id: r.id,
      examId: r.exam_id,
      topicId: r.topic_id,
      weightHint: (r.weight_hint as any) || undefined,
    }));
  }

  async addExamTopic(examId: string, topicId: string, weightHint?: ExamTopic['weightHint']): Promise<ExamTopic> {
    const db = await getDatabaseConnection();
    const id = `et-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await db.runAsync(
      `INSERT INTO exam_topics (id, exam_id, topic_id, weight_hint, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(exam_id, topic_id) DO UPDATE SET weight_hint = excluded.weight_hint;`,
      [id, examId, topicId, weightHint || null]
    );
    return { id, examId, topicId, weightHint };
  }

  async removeExamTopic(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM exam_topics WHERE id = ?;`, [id]);
  }

  private mapExamRow(r: ExamRow): Exam {
    return {
      id: r.id,
      subjectId: r.subject_id,
      semesterId: r.semester_id || 'sem-3',
      name: r.name,
      type: r.type as Exam['type'],
      date: r.date,
      time: r.time,
      room: r.room || undefined,
      maxMarks: r.max_marks,
      weightage: r.weightage || undefined,
    };
  }
}

export const examRepository = new ExamRepository();
