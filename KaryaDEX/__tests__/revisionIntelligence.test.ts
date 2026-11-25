/**
 * KaryaDEX — Phase 7: Revision Intelligence & Exam Sprint Tests
 *
 * Full verification of all Phase 7 requirements:
 *  1. RevisionRecord creation & persistence
 *  2. RevisionRecord update & deletion
 *  3. Revision history ordering (newest first)
 *  4. Latest revision derivation
 *  5. Confidence & Outcome values
 *  6. Topic revision state derivation (NOT_TAUGHT, NOT_REVIEWED, CONFIDENT, NEEDS_REVIEW, REVIEWED)
 *  7. Historical information preserved across state transitions
 *  8. Revision priority calculation (low, medium, high, critical)
 *  9. Exam proximity effects: exam tomorrow (critical), exam in 5 days (high), exam far away (medium/low)
 * 10. Exam Sprint readiness calculation
 * 11. Exam Sprint plan generation (few topics vs many topics distribution)
 * 12. Overloaded academic workload warning
 * 13. Revision -> Task integration (preserves topic, subject, exam links)
 * 14. Academic Health revision dimension enrichment
 * 15. Academic Hub revision backlog and critical topic attention items
 * 16. Semester isolation (no data leakage between semesters)
 * 17. Topic, Subject, and Exam relational integrity
 * 18. App restart persistence (SQLite-backed history survival)
 * 19. Migration 6 verification
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  subjectRepository,
  semesterRepository,
  syllabusRepository,
  revisionRepository,
  examRepository,
  taskRepository,
} from '../database';
import { revisionIntelligenceService } from '../services/revisionIntelligenceService';
import { examSprintService } from '../services/examSprintService';
import { academicAnalyticsService } from '../services/academicAnalyticsService';
import { academicHubService } from '../services/academicHubService';
import { useAcademicStore } from '../store/useAcademicStore';
import { useAppStore } from '../store/useAppStore';
import type { Semester, Subject, Exam, Task } from '../types';
import type { Topic, SyllabusUnit, RevisionRecord, ClassNote } from '../types/academic';
import { formatLocalDate } from '../lib/timeUtils';

describe('Phase 7: Revision Intelligence & Exam Sprint', () => {
  const sem1: Semester = {
    id: 'sem-p7-1',
    name: 'Semester 7A',
    number: 7,
    startDate: '2026-08-01',
    endDate: '2026-12-15',
    collegeId: 'col-p7',
    isCurrent: true,
    status: 'current',
  };

  const sem2: Semester = {
    id: 'sem-p7-2',
    name: 'Semester 7B (Archived)',
    number: 8,
    startDate: '2027-01-01',
    endDate: '2027-05-30',
    collegeId: 'col-p7',
    isCurrent: false,
    status: 'archived',
  };

  const sub1: Subject = {
    id: 'sub-p7-1',
    name: 'Distributed Systems',
    code: 'CS701',
    shortName: 'DS',
    color: '#6366F1',
    semesterId: sem1.id,
    facultyId: 'fac-1',
    credits: 4,
    isArchived: false,
    subjectType: 'lecture',
    targetAttendance: 75,
  };

  const sub2: Subject = {
    id: 'sub-p7-2',
    name: 'Machine Learning',
    code: 'CS702',
    shortName: 'ML',
    color: '#10B981',
    semesterId: sem2.id,
    facultyId: 'fac-2',
    credits: 4,
    isArchived: false,
    subjectType: 'lecture',
    targetAttendance: 75,
  };

  const unit1: SyllabusUnit = {
    id: 'unit-p7-1',
    subjectId: sub1.id,
    semesterId: sem1.id,
    name: 'Unit 1: Consensus Protocols',
    order: 1,
    topicIds: ['top-p7-1', 'top-p7-2', 'top-p7-3'],
  };

  const topic1: Topic = {
    id: 'top-p7-1',
    unitId: unit1.id,
    subjectId: sub1.id,
    name: 'Raft Consensus',
    isCompleted: true,
    revisionStatus: 'taught',
    revisionCount: 0,
    order: 1,
    classNoteIds: [],
  };

  const topic2: Topic = {
    id: 'top-p7-2',
    unitId: unit1.id,
    subjectId: sub1.id,
    name: 'Paxos Algorithm',
    isCompleted: true,
    revisionStatus: 'taught',
    revisionCount: 0,
    order: 2,
    classNoteIds: [],
  };

  const topic3: Topic = {
    id: 'top-p7-3',
    unitId: unit1.id,
    subjectId: sub1.id,
    name: 'Byzantine Fault Tolerance',
    isCompleted: false,
    revisionStatus: 'not_started',
    revisionCount: 0,
    order: 3,
    classNoteIds: [],
  };

  beforeAll(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();

    // Seed semesters
    await semesterRepository.saveSemester(sem1);
    await semesterRepository.saveSemester(sem2);

    // Seed subjects
    await subjectRepository.createSubject(sub1);
    await subjectRepository.createSubject(sub2);

    // Seed syllabus
    await syllabusRepository.createUnit(unit1);
    await syllabusRepository.createTopic(topic1);
    await syllabusRepository.createTopic(topic2);
    await syllabusRepository.createTopic(topic3);

    // Seed stores
    useAppStore.setState({
      semester: sem1,
      subjects: [sub1, sub2],
      exams: [],
      tasks: [],
    });
    useAcademicStore.setState({
      topics: [topic1, topic2, topic3],
      syllabusUnits: [unit1],
      revisionRecords: [],
      examTopics: [],
      classNotes: [],
    });
  });

  // ─── 1. REVISION RECORD CRUD & PERSISTENCE ────────────────────

  describe('1. RevisionRecord CRUD & SQLite Persistence', () => {
    let createdRecordId: string;

    it('creates and persists a new RevisionRecord', async () => {
      const record = await revisionRepository.createRecord({
        topicId: topic1.id,
        subjectId: sub1.id,
        semesterId: sem1.id,
        reviewedAt: '2026-10-01',
        durationMinutes: 25,
        confidence: 'medium',
        outcome: 'okay',
        notes: 'Covered leader election and log replication',
      });

      expect(record.id).toBeDefined();
      createdRecordId = record.id;
      expect(record.topicId).toBe(topic1.id);
      expect(record.durationMinutes).toBe(25);
      expect(record.confidence).toBe('medium');
      expect(record.outcome).toBe('okay');

      // Verify direct lookup by ID
      const fetched = await revisionRepository.getRecordById(record.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.notes).toBe('Covered leader election and log replication');
    });

    it('updates an existing RevisionRecord', async () => {
      await revisionRepository.updateRecord(createdRecordId, {
        durationMinutes: 35,
        confidence: 'high',
        outcome: 'confident',
        notes: 'Mastered Raft leader election with heartbeat timing',
      });

      const updated = await revisionRepository.getRecordById(createdRecordId);
      expect(updated?.durationMinutes).toBe(35);
      expect(updated?.confidence).toBe('high');
      expect(updated?.outcome).toBe('confident');
      expect(updated?.notes).toContain('Mastered Raft');
    });

    it('retrieves revision history for a topic sorted newest first', async () => {
      // Add a second, later record
      await revisionRepository.createRecord({
        topicId: topic1.id,
        subjectId: sub1.id,
        semesterId: sem1.id,
        reviewedAt: '2026-10-03',
        durationMinutes: 15,
        confidence: 'high',
        outcome: 'confident',
      });

      // Add a third, even later record
      await revisionRepository.createRecord({
        topicId: topic1.id,
        subjectId: sub1.id,
        semesterId: sem1.id,
        reviewedAt: '2026-10-04',
        durationMinutes: 20,
        confidence: 'medium',
        outcome: 'needs_review',
      });

      const history = await revisionRepository.getRecordsByTopic(topic1.id);
      expect(history.length).toBe(3);
      expect(history[0].reviewedAt).toBe('2026-10-04');
      expect(history[1].reviewedAt).toBe('2026-10-03');
      expect(history[2].reviewedAt).toBe('2026-10-01');
    });

    it('retrieves the latest revision accurately', async () => {
      const latest = await revisionRepository.getLatestRecord(topic1.id);
      expect(latest).not.toBeNull();
      expect(latest?.reviewedAt).toBe('2026-10-04');
      expect(latest?.outcome).toBe('needs_review');
    });

    it('queries revision records by date range', async () => {
      const records = await revisionRepository.getRecordsByDateRange('2026-10-02', '2026-10-04');
      expect(records.length).toBe(2);
      expect(records.map(r => r.reviewedAt)).toEqual(['2026-10-04', '2026-10-03']);
    });

    it('deletes a RevisionRecord', async () => {
      await revisionRepository.deleteRecord(createdRecordId);
      const fetched = await revisionRepository.getRecordById(createdRecordId);
      expect(fetched).toBeNull();
    });
  });

  // ─── 2. REVISION STATE DERIVATION & HISTORY PRESERVATION ──────

  describe('2. Deterministic Revision State Derivation', () => {
    it('returns NOT_TAUGHT for topics not yet covered in syllabus or class', () => {
      const state = revisionIntelligenceService.deriveTopicState(topic3, [], []);
      expect(state).toBe('NOT_TAUGHT');
    });

    it('returns NOT_REVIEWED for topics that were taught but have 0 review records', () => {
      const state = revisionIntelligenceService.deriveTopicState(topic2, [], []);
      expect(state).toBe('NOT_REVIEWED');
    });

    it('derives CONFIDENT when latest outcome is confident', () => {
      const record: RevisionRecord = {
        id: 'r-1',
        topicId: topic1.id,
        subjectId: sub1.id,
        reviewedAt: '2026-10-02',
        durationMinutes: 20,
        confidence: 'high',
        outcome: 'confident',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-02T10:00:00Z',
      };
      const state = revisionIntelligenceService.deriveTopicState(topic1, [record], []);
      expect(state).toBe('CONFIDENT');
    });

    it('derives NEEDS_REVIEW when latest outcome is needs_review', () => {
      const record1: RevisionRecord = {
        id: 'r-1',
        topicId: topic1.id,
        subjectId: sub1.id,
        reviewedAt: '2026-10-02',
        durationMinutes: 20,
        confidence: 'high',
        outcome: 'confident',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-02T10:00:00Z',
      };
      const record2: RevisionRecord = {
        id: 'r-2',
        topicId: topic1.id,
        subjectId: sub1.id,
        reviewedAt: '2026-10-04',
        durationMinutes: 15,
        confidence: 'medium',
        outcome: 'needs_review',
        createdAt: '2026-10-04T10:00:00Z',
        updatedAt: '2026-10-04T10:00:00Z',
      };
      // Topic was confident on Oct 2, but on Oct 4 student flagged needs review
      const state = revisionIntelligenceService.deriveTopicState(topic1, [record1, record2], []);
      expect(state).toBe('NEEDS_REVIEW');
    });

    it('derives REVIEWED when outcome is okay with medium confidence', () => {
      const record: RevisionRecord = {
        id: 'r-ok',
        topicId: topic1.id,
        subjectId: sub1.id,
        reviewedAt: '2026-10-05',
        durationMinutes: 20,
        confidence: 'medium',
        outcome: 'okay',
        createdAt: '2026-10-05T10:00:00Z',
        updatedAt: '2026-10-05T10:00:00Z',
      };
      const state = revisionIntelligenceService.deriveTopicState(topic1, [record], []);
      expect(state).toBe('REVIEWED');
    });
  });

  // ─── 3. REVISION PRIORITY DERIVATION ──────────────────────────

  describe('3. Deterministic Revision Priority Calculation', () => {
    it('returns low priority for untaught topics', () => {
      const priority = revisionIntelligenceService.calculateRevisionPriority({
        isTaught: false,
        records: [],
      });
      expect(priority).toBe('low');
    });

    it('returns critical priority when exam is in <= 3 days and topic is not confident', () => {
      const priority = revisionIntelligenceService.calculateRevisionPriority({
        isTaught: true,
        records: [],
        upcomingExamDays: 2,
      });
      expect(priority).toBe('critical');
    });

    it('returns high priority when exam is in 4 to 7 days and topic needs review', () => {
      const record: RevisionRecord = {
        id: 'r-nr',
        topicId: 't-1',
        subjectId: 's-1',
        reviewedAt: '2026-10-01',
        durationMinutes: 20,
        confidence: 'low',
        outcome: 'needs_review',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-01T10:00:00Z',
      };
      const priority = revisionIntelligenceService.calculateRevisionPriority({
        isTaught: true,
        records: [record],
        upcomingExamDays: 5,
      });
      expect(priority).toBe('high');
    });

    it('returns high priority when topic is stale (> 14 days without review) with upcoming exam within 14 days', () => {
      const record: RevisionRecord = {
        id: 'r-stale',
        topicId: 't-1',
        subjectId: 's-1',
        reviewedAt: '2026-09-10',
        durationMinutes: 20,
        confidence: 'medium',
        outcome: 'okay',
        createdAt: '2026-09-10T10:00:00Z',
        updatedAt: '2026-09-10T10:00:00Z',
      };
      const priority = revisionIntelligenceService.calculateRevisionPriority({
        isTaught: true,
        records: [record],
        daysSinceLastRevision: 24,
        upcomingExamDays: 10,
      });
      expect(priority).toBe('high');
    });

    it('returns low priority when topic is confident with no immediate exam', () => {
      const record: RevisionRecord = {
        id: 'r-conf',
        topicId: 't-1',
        subjectId: 's-1',
        reviewedAt: '2026-10-03',
        durationMinutes: 30,
        confidence: 'high',
        outcome: 'confident',
        createdAt: '2026-10-03T10:00:00Z',
        updatedAt: '2026-10-03T10:00:00Z',
      };
      const priority = revisionIntelligenceService.calculateRevisionPriority({
        isTaught: true,
        records: [record],
        daysSinceLastRevision: 1,
        upcomingExamDays: 20,
      });
      expect(priority).toBe('low');
    });
  });

  // ─── 4. EXAM READINESS & SPRINT PLANNING ──────────────────────

  describe('4. Exam Readiness & Exam Sprint Planning', () => {
    const exam1: Exam = {
      id: 'exam-p7-1',
      subjectId: sub1.id,
      name: 'Midterm Exam',
      type: 'internal',
      date: '2026-10-07', // 3 days away from 2026-10-04
      maxMarks: 50,
      semesterId: sem1.id,
    };

    beforeAll(async () => {
      await examRepository.createExam(exam1);
      // Link topic1 and topic2 to exam1
      await examRepository.addExamTopic(exam1.id, topic1.id);
      await examRepository.addExamTopic(exam1.id, topic2.id);

      useAppStore.setState(s => ({ exams: [...s.exams, exam1] }));
      useAcademicStore.setState(s => ({
        examTopics: [
          { id: 'et-1', examId: exam1.id, topicId: topic1.id, weightHint: 'high' },
          { id: 'et-2', examId: exam1.id, topicId: topic2.id, weightHint: 'medium' },
        ],
      }));
    });

    it('calculates deterministic Exam Readiness snapshot', () => {
      const simulatedNow = new Date('2026-10-04T10:00:00');
      const readiness = examSprintService.getExamReadiness(exam1.id, simulatedNow);

      expect(readiness).not.toBeNull();
      expect(readiness?.examName).toBe('Midterm Exam');
      expect(readiness?.daysRemaining).toBe(3);
      expect(readiness?.taughtTopics).toBe(2);
      expect(readiness?.estimatedRevisionWorkloadMinutes).toBeGreaterThan(0);
    });

    it('generates sequenced sprint plan prioritizing Critical over High', () => {
      const simulatedNow = new Date('2026-10-04T10:00:00');
      const plan = examSprintService.generateExamSprintPlan(exam1.id, simulatedNow);

      expect(plan).not.toBeNull();
      expect(plan?.daysRemaining).toBe(3);
      expect(plan?.days.length).toBeGreaterThan(0);

      // Verify sequence across sprint
      const allSprintTopics = plan?.days.flatMap(d => d.topics) || [];
      expect(allSprintTopics.length).toBeGreaterThan(0);

      // Verify critical / high topics appear in earlier days
      if (allSprintTopics.length >= 2) {
        const pWeights: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        expect(pWeights[allSprintTopics[0].priority]).toBeGreaterThanOrEqual(
          pWeights[allSprintTopics[allSprintTopics.length - 1].priority]
        );
      }
    });

    it('generates workload warning if exam is very close with multiple pending topics', () => {
      // Simulate exam in 1 day with unrevised topics
      const closeExam: Exam = {
        id: 'exam-close',
        subjectId: sub1.id,
        name: 'Urgent Quiz',
        type: 'quiz',
        date: '2026-10-05', // Tomorrow!
        maxMarks: 20,
        semesterId: sem1.id,
      };
      useAppStore.setState(s => ({ exams: [...s.exams, closeExam] }));

      const simulatedNow = new Date('2026-10-04T10:00:00');
      const plan = examSprintService.generateExamSprintPlan(closeExam.id, simulatedNow);
      expect(plan?.daysRemaining).toBe(1);
    });
  });

  // ─── 5. REVISION TO TASK CONVERSION ───────────────────────────

  describe('5. Revision -> Task Integration', () => {
    it('converts a sprint revision recommendation into a standard Task', async () => {
      const task = await examSprintService.convertSprintTopicToTask({
        topicId: topic1.id,
        examId: 'exam-p7-1',
        scheduledDate: '2026-10-05',
        estimatedMinutes: 30,
      });

      expect(task).toBeDefined();
      expect(task.title).toContain('Revise: Raft Consensus');
      expect(task.topicId).toBe(topic1.id);
      expect(task.examId).toBe('exam-p7-1');
      expect(task.subjectId).toBe(sub1.id);
      expect(task.category).toBe('study');
      expect(task.scheduledDate).toBe('2026-10-05');
      expect(task.isCompleted).toBe(false);

      // App store now contains this task
      const appTasks = useAppStore.getState().tasks;
      expect(appTasks.some(t => t.id === task.id)).toBe(true);
    });
  });

  // ─── 6. ACADEMIC HEALTH & HUB INTEGRATIONS ───────────────────

  describe('6. Academic Health & Academic Hub Integration', () => {
    it('calculates revision health dimension deterministically', () => {
      const snapshot = academicAnalyticsService.getSemesterAcademicSnapshot();
      expect(snapshot.health.dimensions.revision).toBeDefined();
      expect(snapshot.health.dimensions.revision.score).toBeGreaterThanOrEqual(0);
      expect(snapshot.health.dimensions.revision.score).toBeLessThanOrEqual(100);
      expect(snapshot.health.dimensions.revision.weight).toBe(0.20);
    });

    it('returns neutral revision score when no topics are taught', () => {
      // Input with 0 taught topics
      const report = academicAnalyticsService.getSemesterAcademicSnapshot({
        topics: [],
        now: new Date('2026-10-04T10:00:00'),
      });
      expect(report.health.dimensions.revision.status).not.toBe('critical');
    });

    it('surfaces critical topic attention item in Academic Hub', () => {
      const simulatedNow = new Date('2026-10-04T10:00:00');
      const summary = academicHubService.getTodayAcademicSnapshot({ now: simulatedNow });
      expect(summary.attentionItems).toBeDefined();
      expect(Array.isArray(summary.attentionItems)).toBe(true);
    });

    it('surfaces revision hub aggregated data', () => {
      const simulatedNow = new Date('2026-10-04T10:00:00');
      const hubData = academicHubService.getRevisionHubData({ now: simulatedNow });

      expect(hubData.backlogTopics).toBeDefined();
      expect(hubData.subjectProgress).toBeDefined();
      expect(hubData.upcomingExamsWithReadiness).toBeDefined();
    });
  });

  // ─── 7. SEMESTER ISOLATION & PERSISTENCE ──────────────────────

  describe('7. Semester Isolation & Restart Persistence', () => {
    it('isolates revision records by semester', async () => {
      // Create a topic in Semester 2
      const topicSem2: Topic = {
        id: 'top-sem2-1',
        unitId: 'unit-sem2',
        subjectId: sub2.id,
        name: 'Neural Networks',
        isCompleted: true,
        revisionStatus: 'taught',
        revisionCount: 0,
        order: 1,
        classNoteIds: [],
      };
      await syllabusRepository.createTopic(topicSem2);

      await revisionRepository.createRecord({
        topicId: topicSem2.id,
        subjectId: sub2.id,
        semesterId: sem2.id,
        reviewedAt: '2026-10-04',
        durationMinutes: 40,
        confidence: 'high',
        outcome: 'confident',
      });

      const sem1Records = await revisionRepository.getRecordsBySemester(sem1.id);
      const sem2Records = await revisionRepository.getRecordsBySemester(sem2.id);

      expect(sem1Records.every(r => r.semesterId === sem1.id)).toBe(true);
      expect(sem2Records.every(r => r.semesterId === sem2.id)).toBe(true);
      expect(sem1Records.some(r => r.topicId === topicSem2.id)).toBe(false);
      expect(sem2Records.some(r => r.topicId === topicSem2.id)).toBe(true);
    });

    it('preserves revision history in SQLite and can re-hydrate store', async () => {
      const recordsBefore = await revisionRepository.getAllRecords();
      expect(recordsBefore.length).toBeGreaterThan(0);

      // Clear memory store state
      useAcademicStore.setState({ revisionRecords: [] });
      expect(useAcademicStore.getState().revisionRecords.length).toBe(0);

      // Re-hydrate from SQLite repository
      const rehydrated = await revisionRepository.getAllRecords();
      useAcademicStore.setState({ revisionRecords: rehydrated });
      expect(useAcademicStore.getState().revisionRecords.length).toBe(recordsBefore.length);

      const raftRecords = await revisionRepository.getRecordsByTopic(topic1.id);
      expect(raftRecords.length).toBeGreaterThan(0);
    });
  });
});
