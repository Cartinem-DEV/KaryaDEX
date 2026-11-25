/**
 * KaryaDEX — Onboarding Progress Repository
 *
 * Persists onboarding state machine progress, current step, and step draft data.
 */

import { getDatabaseConnection } from '../db';
import type { OnboardingProgressRow } from '../types';
import type { OnboardingProgress, OnboardingStep, OnboardingStatus, OnboardingDraftData } from '@/types/onboarding';

export class OnboardingRepository {
  async getProgress(): Promise<OnboardingProgress | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<OnboardingProgressRow>(
      `SELECT * FROM onboarding_progress WHERE id = 'current';`
    );
    if (!row) return null;

    try {
      return {
        id: row.id,
        status: row.status as OnboardingStatus,
        currentStep: row.current_step as OnboardingStep,
        completedSteps: JSON.parse(row.completed_steps || '[]'),
        draftData: JSON.parse(row.draft_data || '{}'),
        updatedAt: row.updated_at,
      };
    } catch {
      return null;
    }
  }

  async saveProgress(progress: OnboardingProgress): Promise<void> {
    const db = await getDatabaseConnection();
    const completedJson = JSON.stringify(progress.completedSteps || []);
    const draftJson = JSON.stringify(progress.draftData || {});

    await db.runAsync(
      `INSERT INTO onboarding_progress (id, status, current_step, completed_steps, draft_data, updated_at)
       VALUES ('current', ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         current_step = excluded.current_step,
         completed_steps = excluded.completed_steps,
         draft_data = excluded.draft_data,
         updated_at = excluded.updated_at;`,
      [progress.status, progress.currentStep, completedJson, draftJson]
    );
  }

  async isCompleted(): Promise<boolean> {
    const progress = await this.getProgress();
    if (progress && progress.status === 'completed') return true;

    // Fallback check in app_settings
    const db = await getDatabaseConnection();
    const setting = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'onboarding_completed';`
    );
    return setting?.value === '1';
  }

  async markCompleted(): Promise<void> {
    const db = await getDatabaseConnection();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('onboarding_completed', '1', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now');`
      );
      await db.runAsync(
        `UPDATE onboarding_progress SET status = 'completed', updated_at = datetime('now') WHERE id = 'current';`
      );
    });
  }

  async resetProgress(): Promise<void> {
    const db = await getDatabaseConnection();
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM onboarding_progress WHERE id = 'current';`);
      await db.runAsync(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('onboarding_completed', '0', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = '0', updated_at = datetime('now');`
      );
    });
  }

  /**
   * Resets all academic workspace data (Option B for clean real onboarding).
   * Ensures demo fixtures never collide or pollute a real student's profile, subjects,
   * timetable, tasks, or attendance.
   */
  async clearAllAcademicData(): Promise<void> {
    const db = await getDatabaseConnection();
    await db.withTransactionAsync(async () => {
      // Clear dependent children first
      await db.runAsync(`DELETE FROM notification_records;`);
      await db.runAsync(`DELETE FROM task_relations;`);
      await db.runAsync(`DELETE FROM tasks;`);
      await db.runAsync(`DELETE FROM resources;`);
      await db.runAsync(`DELETE FROM exam_topics;`);
      await db.runAsync(`DELETE FROM exams;`);
      await db.runAsync(`DELETE FROM assessments;`);
      await db.runAsync(`DELETE FROM class_session_topics;`);
      await db.runAsync(`DELETE FROM class_notes;`);
      await db.runAsync(`DELETE FROM class_sessions;`);
      await db.runAsync(`DELETE FROM attendance_records;`);
      await db.runAsync(`DELETE FROM attendance_aggregates;`);
      await db.runAsync(`DELETE FROM timetable_slots;`);
      await db.runAsync(`DELETE FROM topic_revision_history;`);
      await db.runAsync(`DELETE FROM topics;`);
      await db.runAsync(`DELETE FROM syllabus_units;`);
      await db.runAsync(`DELETE FROM subjects;`);
      await db.runAsync(`DELETE FROM students;`);
      await db.runAsync(`DELETE FROM semesters;`);
      await db.runAsync(`DELETE FROM colleges;`);
      await db.runAsync(`DELETE FROM app_settings WHERE key = 'demo_mode';`);
    });
  }
}

export const onboardingRepository = new OnboardingRepository();
