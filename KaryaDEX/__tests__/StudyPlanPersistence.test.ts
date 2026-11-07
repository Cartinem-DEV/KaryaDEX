/**
 * KaryaDEX — Study Plan Persistence, Versioning & Scheduling Test Suite
 *
 * Verifies:
 * 1. Plan creation, auto-versioning, and allocation storage in SQLite
 * 2. Active plan and historical versions retrieval
 * 3. Allocation status lifecycle (scheduled -> completed -> missed -> rescheduled)
 * 4. Syllabus topic synchronization on allocation completion
 * 5. Regeneration preserving completed milestones while rebalancing remaining topics
 * 6. Guest and authenticated user scope support
 * 7. Deduplication & UNIQUE(plan_id, topic_id) constraint integrity
 * 8. Cascading deletion of plan and allocations
 */

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  subjectRepository,
  syllabusRepository,
  examRepository,
  studyPlanRepository,
} from '../database';
import type { Subject, Exam } from '../types';
import type { Topic, SyllabusUnit } from '../types/academic';

describe('STUDY-2.2.2: Persistent Study Plans & Versioning', () => {
  const testSubjectId = 'sub-algo-101';
  const testSemesterId = 'sem-4';
  const testExamId = 'exam-midterm-algo';

  const testTopics: Topic[] = [
    {
      id: 'top-dp-01',
      unitId: 'unit-1',
      subjectId: testSubjectId,
      name: 'Dynamic Programming: Memoization vs Tabulation',
      order: 1,
      isCompleted: false,
      revisionStatus: 'not_started',
      classNoteIds: [],
    },
    {
      id: 'top-graph-02',
      unitId: 'unit-1',
      subjectId: testSubjectId,
      name: 'Dijkstra and Bellman-Ford Shortest Path',
      order: 2,
      isCompleted: false,
      revisionStatus: 'not_started',
      classNoteIds: [],
    },
    {
      id: 'top-greedy-03',
      unitId: 'unit-1',
      subjectId: testSubjectId,
      name: 'Huffman Coding and Fractional Knapsack',
      order: 3,
      isCompleted: false,
      revisionStatus: 'not_started',
      classNoteIds: [],
    },
    {
      id: 'top-np-04',
      unitId: 'unit-1',
      subjectId: testSubjectId,
      name: 'NP-Completeness and Reductions',
      order: 4,
      isCompleted: false,
      revisionStatus: 'not_started',
      classNoteIds: [],
    },
  ];

  beforeEach(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();

    // 1. Seed test subject
    const subject: Subject = {
      id: testSubjectId,
      name: 'Design and Analysis of Algorithms',
      shortName: 'DAA',
      code: 'CS401',
      color: '#4F46E5',
      credits: 4,
      facultyId: 'fac-1',
      semesterId: testSemesterId,
    };
    await subjectRepository.createSubject(subject);

    // 2. Seed test syllabus unit & topics
    const unit: SyllabusUnit = {
      id: 'unit-1',
      subjectId: testSubjectId,
      semesterId: testSemesterId,
      name: 'Advanced Algorithms',
      order: 1,
      topicIds: testTopics.map(t => t.id),
    };
    await syllabusRepository.createUnit(unit);
    for (const t of testTopics) {
      await syllabusRepository.createTopic(t);
    }

    // 3. Seed test exam
    const exam: Exam = {
      id: testExamId,
      subjectId: testSubjectId,
      name: 'Algorithms Mid-Term Examination',
      date: '2026-12-15',
      time: '10:00 AM',
      type: 'internal',
      maxMarks: 100,
      weightage: 30,
      semesterId: testSemesterId,
    };
    await examRepository.createExam(exam);
  });

  // =========================================================================
  // 1. CREATE AND RETRIEVE PLAN
  // =========================================================================
  describe('1. Plan Creation, Versioning & Retrieval', () => {
    it('creates a new version 1 study plan with correct metadata and allocations', async () => {
      const plan = await studyPlanRepository.createPlan({
        examId: testExamId,
        semesterId: testSemesterId,
        subjectId: testSubjectId,
        dailyCapacityMinutes: 90,
        targetMasteryGoal: 85,
        allocations: [
          { topicId: testTopics[0].id, subjectId: testSubjectId, allocatedDate: '2026-12-01', allocatedMinutes: 30 },
          { topicId: testTopics[1].id, subjectId: testSubjectId, allocatedDate: '2026-12-01', allocatedMinutes: 45 },
          { topicId: testTopics[2].id, subjectId: testSubjectId, allocatedDate: '2026-12-02', allocatedMinutes: 25 },
        ],
      });

      expect(plan).toBeDefined();
      expect(plan.id).toMatch(/^plan_/);
      expect(plan.version).toBe(1);
      expect(plan.status).toBe('active');
      expect(plan.examId).toBe(testExamId);
      expect(plan.semesterId).toBe(testSemesterId);
      expect(plan.dailyCapacityMinutes).toBe(90);
      expect(plan.targetMasteryGoal).toBe(85);
      expect(plan.totalPlannedMinutes).toBe(100); // 30 + 45 + 25
      expect(plan.allocations).toHaveLength(3);

      const activePlan = await studyPlanRepository.getActivePlanForExam(testExamId);
      expect(activePlan).not.toBeNull();
      expect(activePlan?.id).toBe(plan.id);
      expect(activePlan?.version).toBe(1);
      expect(activePlan?.allocations).toHaveLength(3);
      expect(activePlan?.allocations[0].topicId).toBe(testTopics[0].id);
      expect(activePlan?.allocations[0].status).toBe('scheduled');
    });

    it('retrieves plan versions descending', async () => {
      // Create v1
      const v1 = await studyPlanRepository.createPlan({
        examId: testExamId,
        semesterId: testSemesterId,
        allocations: [
          { topicId: testTopics[0].id, subjectId: testSubjectId, allocatedDate: '2026-12-01' },
        ],
      });

      // Create v2
      const v2 = await studyPlanRepository.createPlan({
        examId: testExamId,
        semesterId: testSemesterId,
        allocations: [
          { topicId: testTopics[0].id, subjectId: testSubjectId, allocatedDate: '2026-12-02' },
          { topicId: testTopics[1].id, subjectId: testSubjectId, allocatedDate: '2026-12-03' },
        ],
      });

      expect(v2.version).toBe(2);

      const versions = await studyPlanRepository.getPlanVersionsForExam(testExamId);
      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(2);
      expect(versions[0].status).toBe('active');
      expect(versions[1].version).toBe(1);
      expect(versions[1].status).toBe('superseded');
    });
  });

  // =========================================================================
  // 2. ALLOCATION STATUS & SYLLABUS SYNC
  // =========================================================================
  describe('2. Allocation Completion & Syllabus Sync', () => {
    it('marks allocation complete and updates syllabus topic revision status', async () => {
      const plan = await studyPlanRepository.createPlan({
        examId: testExamId,
        semesterId: testSemesterId,
        allocations: [
          { topicId: testTopics[0].id, subjectId: testSubjectId, allocatedDate: '2026-12-01' },
          { topicId: testTopics[1].id, subjectId: testSubjectId, allocatedDate: '2026-12-02' },
        ],
      });

      const alloc0 = plan.allocations[0];
      await studyPlanRepository.markAllocationComplete(alloc0.id);

      // Verify allocation state
      const refreshedAllocations = await studyPlanRepository.getAllocationsForPlan(plan.id);
      const updatedAlloc0 = refreshedAllocations.find(a => a.id === alloc0.id);
      expect(updatedAlloc0?.status).toBe('completed');
      expect(updatedAlloc0?.completedAt).toBeDefined();

      // Verify syllabus topic was automatically synced to 'revised'
      const topics = await syllabusRepository.getTopicsForSubject(testSubjectId);
      const targetTopic = topics.find(t => t.id === testTopics[0].id);
      expect(targetTopic?.revisionStatus).toBe('revised');
      expect(targetTopic?.lastRevisedAt).toBeDefined();
    });

    it('marks allocation as missed and toggles back to scheduled', async () => {
      const plan = await studyPlanRepository.createPlan({
        examId: testExamId,
        semesterId: testSemesterId,
        allocations: [
          { topicId: testTopics[2].id, subjectId: testSubjectId, allocatedDate: '2026-12-01' },
        ],
      });

      const alloc = plan.allocations[0];

      // Mark missed
      await studyPlanRepository.markAllocationMissed(alloc.id);
      let allocs = await studyPlanRepository.getAllocationsForPlan(plan.id);
      expect(allocs[0].status).toBe('missed');

      // Revert to scheduled
      await studyPlanRepository.updateAllocationStatus(alloc.id, 'scheduled');
      allocs = await studyPlanRepository.getAllocationsForPlan(plan.id);
      expect(allocs[0].status).toBe('scheduled');
    });
  });

  // =========================================================================
  // 3. SCHEDULE REGENERATION WITH PRESERVATION
  // =========================================================================
  describe('3. Dynamic Schedule Regeneration with Completed Preservation', () => {
    it('preserves completed allocations and redistributes missed/scheduled topics into new version', async () => {
      // 1. Create v1 with 4 topics
      const v1 = await studyPlanRepository.createPlan({
        examId: testExamId,
        semesterId: testSemesterId,
        dailyCapacityMinutes: 60,
        allocations: [
          { topicId: testTopics[0].id, subjectId: testSubjectId, allocatedDate: '2026-12-01', allocatedMinutes: 30 },
          { topicId: testTopics[1].id, subjectId: testSubjectId, allocatedDate: '2026-12-01', allocatedMinutes: 30 },
          { topicId: testTopics[2].id, subjectId: testSubjectId, allocatedDate: '2026-12-02', allocatedMinutes: 25 },
          { topicId: testTopics[3].id, subjectId: testSubjectId, allocatedDate: '2026-12-03', allocatedMinutes: 30 },
        ],
      });

      // 2. Mark Topic 0 as completed and Topic 1 as missed
      await studyPlanRepository.markAllocationComplete(v1.allocations[0].id);
      await studyPlanRepository.markAllocationMissed(v1.allocations[1].id);

      // 3. Regenerate schedule starting from today '2026-12-05' to exam '2026-12-15'
      const v2 = await studyPlanRepository.regenerateRemainingSchedule({
        planId: v1.id,
        examDate: '2026-12-15',
        todayDate: '2026-12-05',
        dailyCapacityMinutes: 60,
      });

      expect(v2.version).toBe(2);
      expect(v2.status).toBe('active');
      expect(v2.allocations).toHaveLength(4);

      // Verify Topic 0 completed allocation is PRESERVED intact
      const preservedComp = v2.allocations.find(a => a.topicId === testTopics[0].id);
      expect(preservedComp).toBeDefined();
      expect(preservedComp?.status).toBe('completed');
      expect(preservedComp?.allocatedDate).toBe('2026-12-01');

      // Verify Topic 1 (previously missed) was rescheduled into window (>= 2026-12-05)
      const rescheduledTopic1 = v2.allocations.find(a => a.topicId === testTopics[1].id);
      expect(rescheduledTopic1).toBeDefined();
      expect(rescheduledTopic1?.status).toBe('scheduled');
      expect(new Date(rescheduledTopic1!.allocatedDate).getTime()).toBeGreaterThanOrEqual(
        new Date('2026-12-05').getTime()
      );

      // Verify previous v1 was superseded
      const oldV1 = (await studyPlanRepository.getPlanVersionsForExam(testExamId)).find(p => p.id === v1.id);
      expect(oldV1?.status).toBe('superseded');
    });
  });

  // =========================================================================
  // 4. MULTI-TENANCY & IDENTITY SCOPE
  // =========================================================================
  describe('4. Scope & Identity (Guest vs Authenticated)', () => {
    it('supports guest mode without user_id and queries without userId filter', async () => {
      const guestPlan = await studyPlanRepository.createPlan({
        examId: testExamId,
        semesterId: testSemesterId,
        userId: undefined,
        allocations: [
          { topicId: testTopics[0].id, subjectId: testSubjectId, allocatedDate: '2026-12-01' },
        ],
      });

      expect(guestPlan.userId).toBeUndefined();

      const retrieved = await studyPlanRepository.getActivePlanForExam(testExamId);
      expect(retrieved?.id).toBe(guestPlan.id);
    });

    it('isolates user-specific plans when querying with authenticated userId', async () => {
      const userPlan = await studyPlanRepository.createPlan({
        examId: testExamId,
        semesterId: testSemesterId,
        userId: 'usr_auth_alice',
        allocations: [
          { topicId: testTopics[0].id, subjectId: testSubjectId, allocatedDate: '2026-12-01' },
        ],
      });

      const retrieved = await studyPlanRepository.getActivePlanForExam(testExamId, 'usr_auth_alice');
      expect(retrieved?.id).toBe(userPlan.id);
      expect(retrieved?.userId).toBe('usr_auth_alice');
    });
  });

  // =========================================================================
  // 5. CONSTRAINTS & DEDUPLICATION
  // =========================================================================
  describe('5. Deduplication & Constraint Integrity', () => {
    it('deduplicates duplicate topicIds provided in the same plan creation payload', async () => {
      const plan = await studyPlanRepository.createPlan({
        examId: testExamId,
        semesterId: testSemesterId,
        allocations: [
          { topicId: testTopics[0].id, subjectId: testSubjectId, allocatedDate: '2026-12-01' },
          { topicId: testTopics[0].id, subjectId: testSubjectId, allocatedDate: '2026-12-02' }, // duplicate
          { topicId: testTopics[1].id, subjectId: testSubjectId, allocatedDate: '2026-12-03' },
        ],
      });

      // Should only contain 2 allocations (one per topic)
      expect(plan.allocations).toHaveLength(2);
      expect(plan.allocations.filter(a => a.topicId === testTopics[0].id)).toHaveLength(1);
    });

    it('deletes plan and cascades allocation removal cleanly', async () => {
      const plan = await studyPlanRepository.createPlan({
        examId: testExamId,
        semesterId: testSemesterId,
        allocations: [
          { topicId: testTopics[0].id, subjectId: testSubjectId, allocatedDate: '2026-12-01' },
        ],
      });

      const deleted = await studyPlanRepository.deletePlan(plan.id);
      expect(deleted).toBe(true);

      const active = await studyPlanRepository.getActivePlanForExam(testExamId);
      expect(active).toBeNull();

      const allocs = await studyPlanRepository.getAllocationsForPlan(plan.id);
      expect(allocs).toHaveLength(0);
    });
  });
});
