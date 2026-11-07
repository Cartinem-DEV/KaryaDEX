/**
 * KaryaDEX — Persistent Versioned Study Plan Repository
 *
 * Provides database persistence and versioning for Study Plans:
 * - Deterministic plan creation and revision history
 * - Topic allocation tracking (scheduled, completed, missed, rescheduled)
 * - Regeneration of remaining schedules preserving completed milestones
 * - Idempotency and duplicate topic prevention via SQLite UNIQUE constraints
 * - Integration with syllabusRepository for topic revision updates
 */

import { getDatabaseConnection } from '../db';
import type {
  PersistentStudyPlan,
  StudyPlanAllocation,
  PersistentStudyPlanStatus,
  AllocationStatus,
} from '@/types/academic';
import { syllabusRepository } from './syllabusRepository';

export interface CreatePlanInput {
  userId?: string;
  examId: string;
  semesterId: string;
  subjectId?: string;
  dailyCapacityMinutes?: number;
  targetMasteryGoal?: number;
  allocations: Array<{
    topicId: string;
    subjectId: string;
    allocatedDate: string;
    allocatedOrder?: number;
    allocatedMinutes?: number;
    status?: AllocationStatus;
    notes?: string;
  }>;
}

export interface RegeneratePlanOptions {
  planId: string;
  examDate: string;
  dailyCapacityMinutes?: number;
  todayDate?: string;
}

export class StudyPlanRepository {
  /**
   * Creates a new versioned study plan, automatically superseding previous active versions.
   */
  async createPlan(input: CreatePlanInput): Promise<PersistentStudyPlan> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const dailyCapacity = input.dailyCapacityMinutes || 120;
    const targetGoal = input.targetMasteryGoal || 85;

    // 1. Check existing plans for this exam to determine version number
    const existingRows = await db.getAllAsync<{ id: string; version: number; status: string }>(
      `SELECT id, version, status FROM study_plans WHERE exam_id = ? ORDER BY version DESC;`,
      [input.examId]
    );

    const nextVersion = existingRows.length > 0 ? (existingRows[0].version || 1) + 1 : 1;

    // 2. Mark previous active plans as 'superseded'
    for (const prev of existingRows) {
      if (prev.status === 'active') {
        await db.runAsync(
          `UPDATE study_plans SET status = 'superseded', updated_at = ? WHERE id = ?;`,
          [now, prev.id]
        );
      }
    }

    // 3. Compute total planned study minutes
    const totalMinutes = input.allocations.reduce(
      (sum, a) => sum + (a.allocatedMinutes || 25),
      0
    );

    // 4. Insert new persistent study plan
    await db.runAsync(
      `INSERT INTO study_plans (
        id, user_id, exam_id, semester_id, subject_id,
        version, daily_capacity_minutes, target_mastery_goal,
        total_planned_minutes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?);`,
      [
        planId,
        input.userId || null,
        input.examId,
        input.semesterId,
        input.subjectId || null,
        nextVersion,
        dailyCapacity,
        targetGoal,
        totalMinutes,
        now,
        now,
      ]
    );

    // 5. Insert allocations (deduplicating by topicId if duplicates exist in payload)
    const seenTopicIds = new Set<string>();
    const savedAllocations: StudyPlanAllocation[] = [];

    for (let i = 0; i < input.allocations.length; i++) {
      const alloc = input.allocations[i];
      if (seenTopicIds.has(alloc.topicId)) {
        continue; // Prevent duplicate topic allocations in single plan
      }
      seenTopicIds.add(alloc.topicId);

      const allocId = `alloc_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      const allocMinutes = alloc.allocatedMinutes || 25;
      const order = alloc.allocatedOrder || i + 1;
      const allocStatus: AllocationStatus = alloc.status || 'scheduled';

      await db.runAsync(
        `INSERT INTO study_plan_allocations (
          id, plan_id, topic_id, subject_id,
          allocated_date, allocated_order, allocated_minutes,
          status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          allocId,
          planId,
          alloc.topicId,
          alloc.subjectId,
          alloc.allocatedDate,
          order,
          allocMinutes,
          allocStatus,
          alloc.notes || null,
          now,
          now,
        ]
      );

      savedAllocations.push({
        id: allocId,
        planId,
        topicId: alloc.topicId,
        subjectId: alloc.subjectId,
        allocatedDate: alloc.allocatedDate,
        allocatedOrder: order,
        allocatedMinutes: allocMinutes,
        status: allocStatus,
        notes: alloc.notes,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      id: planId,
      userId: input.userId,
      examId: input.examId,
      semesterId: input.semesterId,
      subjectId: input.subjectId,
      version: nextVersion,
      dailyCapacityMinutes: dailyCapacity,
      targetMasteryGoal: targetGoal,
      totalPlannedMinutes: totalMinutes,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      allocations: savedAllocations,
    };
  }

  /**
   * Retrieves the currently active study plan for a given exam.
   */
  async getActivePlanForExam(examId: string, userId?: string): Promise<PersistentStudyPlan | null> {
    const db = await getDatabaseConnection();
    let query = `SELECT * FROM study_plans WHERE exam_id = ? AND status = 'active'`;
    const params: any[] = [examId];

    if (userId) {
      query += ` AND (user_id = ? OR user_id IS NULL)`;
      params.push(userId);
    }
    query += ` ORDER BY version DESC LIMIT 1;`;

    const row = await db.getFirstAsync<any>(query, params);
    if (!row) return null;

    const allocations = await this.getAllocationsForPlan(row.id);

    return {
      id: row.id,
      userId: row.user_id,
      examId: row.exam_id,
      semesterId: row.semester_id,
      subjectId: row.subject_id,
      version: row.version,
      dailyCapacityMinutes: row.daily_capacity_minutes,
      targetMasteryGoal: row.target_mastery_goal,
      totalPlannedMinutes: row.total_planned_minutes,
      status: row.status as PersistentStudyPlanStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      appliedAt: row.applied_at,
      allocations,
    };
  }

  /**
   * Retrieves all historical versions of plans for an exam.
   */
  async getPlanVersionsForExam(examId: string, userId?: string): Promise<PersistentStudyPlan[]> {
    const db = await getDatabaseConnection();
    let query = `SELECT * FROM study_plans WHERE exam_id = ?`;
    const params: any[] = [examId];

    if (userId) {
      query += ` AND (user_id = ? OR user_id IS NULL)`;
      params.push(userId);
    }
    query += ` ORDER BY version DESC;`;

    const rows = await db.getAllAsync<any>(query, params);
    const plans: PersistentStudyPlan[] = [];

    for (const r of rows) {
      const allocations = await this.getAllocationsForPlan(r.id);
      plans.push({
        id: r.id,
        userId: r.user_id,
        examId: r.exam_id,
        semesterId: r.semester_id,
        subjectId: r.subject_id,
        version: r.version,
        dailyCapacityMinutes: r.daily_capacity_minutes,
        targetMasteryGoal: r.target_mastery_goal,
        totalPlannedMinutes: r.total_planned_minutes,
        status: r.status as PersistentStudyPlanStatus,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        appliedAt: r.applied_at,
        allocations,
      });
    }

    return plans;
  }

  /**
   * Retrieves allocations for a plan with hydrated names.
   */
  async getAllocationsForPlan(planId: string): Promise<StudyPlanAllocation[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM study_plan_allocations WHERE plan_id = ? ORDER BY allocated_date ASC, allocated_order ASC;`,
      [planId]
    );

    return rows.map(r => ({
      id: r.id,
      planId: r.plan_id,
      topicId: r.topic_id,
      subjectId: r.subject_id,
      allocatedDate: r.allocated_date,
      allocatedOrder: r.allocated_order,
      allocatedMinutes: r.allocated_minutes,
      status: r.status as AllocationStatus,
      completedAt: r.completed_at,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Marks a specific topic allocation complete and updates syllabus mastery.
   */
  async markAllocationComplete(allocationId: string): Promise<void> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();

    const alloc = await db.getFirstAsync<any>(
      `SELECT * FROM study_plan_allocations WHERE id = ?;`,
      [allocationId]
    );

    if (!alloc) return;

    // 1. Update allocation record
    await db.runAsync(
      `UPDATE study_plan_allocations SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?;`,
      [now, now, allocationId]
    );

    // 2. Sync to syllabus table
    await syllabusRepository.updateTopic(alloc.topic_id, {
      revisionStatus: 'revised',
      lastRevisedAt: now,
    });
  }

  /**
   * Updates an allocation's status (e.g. 'scheduled', 'missed', 'rescheduled').
   */
  async updateAllocationStatus(allocationId: string, status: AllocationStatus): Promise<void> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE study_plan_allocations SET status = ?, updated_at = ? WHERE id = ?;`,
      [status, now, allocationId]
    );
  }

  /**
   * Marks an allocation missed (student fell behind).
   */
  async markAllocationMissed(allocationId: string): Promise<void> {
    return this.updateAllocationStatus(allocationId, 'missed');
  }

  /**
   * Regenerates a plan by preserving all completed allocations and redistributing
   * uncompleted/missed topics across remaining dates until the exam date.
   * Produces a new version (e.g. v2) and marks the current plan as 'superseded'.
   */
  async regenerateRemainingSchedule(options: RegeneratePlanOptions): Promise<PersistentStudyPlan> {
    const { planId, examDate, dailyCapacityMinutes, todayDate } = options;
    const db = await getDatabaseConnection();

    // 1. Load existing plan and allocations
    const currentPlan = await db.getFirstAsync<any>(
      `SELECT * FROM study_plans WHERE id = ?;`,
      [planId]
    );

    if (!currentPlan) {
      throw new Error(`Plan ${planId} not found.`);
    }

    const allocations = await this.getAllocationsForPlan(planId);

    // 2. Partition completed vs uncompleted allocations
    const completedAllocs = allocations.filter(a => a.status === 'completed');
    const uncompletedAllocs = allocations.filter(a => a.status !== 'completed');

    // 3. Determine remaining scheduling window
    const today = todayDate || new Date().toISOString().split('T')[0];
    const targetExam = examDate || '2026-12-31';

    // Generate list of available dates from today to examDate - 1 day
    const availableDates: string[] = [];
    const curDate = new Date(`${today}T00:00:00Z`);
    const endDate = new Date(`${targetExam}T00:00:00Z`);

    while (curDate < endDate) {
      availableDates.push(curDate.toISOString().split('T')[0]);
      curDate.setUTCDate(curDate.getUTCDate() + 1);
    }

    if (availableDates.length === 0) {
      availableDates.push(today);
    }

    const capacity = dailyCapacityMinutes || currentPlan.daily_capacity_minutes || 120;
    const topicsPerDay = Math.max(1, Math.ceil(uncompletedAllocs.length / availableDates.length));

    // 4. Build new allocation list: completed preserved + rescheduled remaining
    const newAllocations: Array<{
      topicId: string;
      subjectId: string;
      allocatedDate: string;
      allocatedOrder: number;
      allocatedMinutes: number;
      status: AllocationStatus;
      notes?: string;
    }> = [];

    // Re-include preserved completed allocations exactly as they were
    for (const comp of completedAllocs) {
      newAllocations.push({
        topicId: comp.topicId,
        subjectId: comp.subjectId,
        allocatedDate: comp.allocatedDate,
        allocatedOrder: comp.allocatedOrder,
        allocatedMinutes: comp.allocatedMinutes,
        status: 'completed',
        notes: comp.notes || 'Completed in prior version',
      });
    }

    // Redistribute uncompleted allocations evenly across remaining dates
    uncompletedAllocs.forEach((u, idx) => {
      const dateIndex = Math.min(Math.floor(idx / topicsPerDay), availableDates.length - 1);
      const allocatedDate = availableDates[dateIndex];
      const order = (idx % topicsPerDay) + 1;

      newAllocations.push({
        topicId: u.topicId,
        subjectId: u.subjectId,
        allocatedDate,
        allocatedOrder: order,
        allocatedMinutes: u.allocatedMinutes || 25,
        status: 'scheduled',
        notes: `Rebalanced from v${currentPlan.version}`,
      });
    });

    // 5. Create new versioned study plan
    return this.createPlan({
      userId: currentPlan.user_id,
      examId: currentPlan.exam_id,
      semesterId: currentPlan.semester_id,
      subjectId: currentPlan.subject_id,
      dailyCapacityMinutes: capacity,
      targetMasteryGoal: currentPlan.target_mastery_goal,
      allocations: newAllocations,
    });
  }

  /**
   * Deletes a plan and its cascaded allocations.
   */
  async deletePlan(planId: string): Promise<boolean> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM study_plan_allocations WHERE plan_id = ?;`, [planId]);
    const res = await db.runAsync(`DELETE FROM study_plans WHERE id = ?;`, [planId]);
    return res.changes > 0;
  }
}

export const studyPlanRepository = new StudyPlanRepository();
