/**
 * KaryaDEX — Assessments & Grades SQLite Repository
 */

import { getDatabaseConnection } from '../db';
import type { AssessmentRow } from '../types';
import type { Assessment } from '@/types/academic';

export class AssessmentRepository {
  async getAssessmentsForSubject(subjectId: string): Promise<Assessment[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<AssessmentRow>(
      `SELECT * FROM assessments WHERE subject_id = ? ORDER BY date DESC, created_at DESC;`,
      [subjectId]
    );
    return rows.map(r => this.mapRow(r));
  }

  async getAllAssessments(): Promise<Assessment[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<AssessmentRow>(
      `SELECT * FROM assessments ORDER BY date DESC, created_at DESC;`
    );
    return rows.map(r => this.mapRow(r));
  }

  async createAssessment(a: Assessment): Promise<Assessment> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `INSERT INTO assessments (id, subject_id, semester_id, name, type, marks_obtained, marks_max, weightage, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
      [
        a.id,
        a.subjectId,
        a.semesterId || 'sem-3',
        a.name,
        a.type,
        a.marksObtained,
        a.marksMax,
        a.weightage || null,
        a.date,
      ]
    );
    return a;
  }

  async updateAssessment(id: string, updates: Partial<Omit<Assessment, 'id'>>): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `UPDATE assessments SET
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        marks_obtained = COALESCE(?, marks_obtained),
        marks_max = COALESCE(?, marks_max),
        weightage = COALESCE(?, weightage),
        date = COALESCE(?, date)
       WHERE id = ?;`,
      [
        updates.name || null,
        updates.type || null,
        updates.marksObtained !== undefined ? updates.marksObtained : null,
        updates.marksMax !== undefined ? updates.marksMax : null,
        updates.weightage !== undefined ? updates.weightage : null,
        updates.date || null,
        id,
      ]
    );
  }

  async deleteAssessment(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM assessments WHERE id = ?;`, [id]);
  }

  private mapRow(r: AssessmentRow): Assessment {
    return {
      id: r.id,
      subjectId: r.subject_id,
      semesterId: r.semester_id,
      name: r.name,
      type: r.type as any,
      marksObtained: r.marks_obtained,
      marksMax: r.marks_max,
      weightage: r.weightage || undefined,
      date: r.date,
    };
  }
}

export const assessmentRepository = new AssessmentRepository();
