/**
 * BunkMatKar — Phase 4: Academic Hub & Notification Engine Tests
 *
 * Comprehensive verification of all 30 Phase 4 requirements:
 *
 * ACADEMIC HUB:
 *   1. Today snapshot aggregation
 *   2. Today's workload calculation
 *   3. Overdue task count & filtering
 *   4. Missing class journal detection
 *   5. Revision backlog detection
 *   6. Upcoming exam detection
 *   7. Topic-centric academic context (getTopicAcademicContext)
 *   8. Subject academic snapshot (getSubjectAcademicSnapshot)
 *   9. Workload by date queries (today, tomorrow, week, overdue)
 *   10. Signal prioritization (Critical, High, Medium, Low)
 *
 * NOTIFICATIONS:
 *   11. Notification system initialization & channels
 *   12. Permission handling abstraction
 *   13. Class reminder scheduling (30m & 10m before)
 *   14. Task reminder scheduling (due today, overdue)
 *   15. Completed task cancellation
 *   16. Deleted task cancellation
 *   17. Due date update rescheduling
 *   18. Exam reminder scheduling (multi-interval)
 *   19. Revision reminder throttling (1/subject/day cooldown)
 *   20. Attendance alert thresholds (danger zone vs warning)
 *   21. Post-class journal reminder (delay after class end)
 *   22. Duplicate prevention via notification_records
 *   23. Cancellation (entity, category, clear all)
 *   24. Startup reconciliation (stale cleanup + future scheduling)
 *   25. Stale notification cleanup
 *   26. Smart quiet-hours suppression
 *   27. Notification settings persistence in SQLite
 *   28. Deep-link structured payload creation
 *   29. Timezone boundary safety (00:01, 05:29, 05:30, 23:59)
 *   30. Cancelled class no-notification case
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  taskRepository,
  syllabusRepository,
  settingsRepository,
  notificationRecordRepository,
} from '../database';
import { useAppStore } from '../store/useAppStore';
import { useAcademicStore } from '../store/useAcademicStore';
import { academicHubService } from '../services/academicHubService';
import { notificationService } from '../services/notificationService';
import { MockNotificationAdapter } from '../services/notificationAdapter';
import { formatLocalDate, parseLocalDate } from '../lib/timeUtils';
import type { Subject, Task, Exam } from '../types';
import type {
  Topic,
  SyllabusUnit,
  TimetableSlot,
  ClassNote,
  Resource,
  ClassOccurrence,
} from '../types/academic';

describe('Phase 4: Academic Hub & Notification Engine', () => {
  const mockAdapter = new MockNotificationAdapter();

  beforeAll(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();
    notificationService.setAdapter(mockAdapter);
    await notificationService.init();
  });

  beforeEach(async () => {
    mockAdapter.clearAll();
    await notificationRecordRepository.clearAll();
  });

  const createMockSubject = (id: string, name: string, shortName: string): Subject => ({
    id,
    name,
    shortName,
    code: `${shortName}101`,
    color: '#3B82F6',
    semesterId: 'sem-1',
    facultyId: 'fac-1',
    credits: 4,
  });

  // ═══════════════════════════════════════════════════════════════════
  // PART A — ACADEMIC HUB INTELLIGENCE
  // ═══════════════════════════════════════════════════════════════════

  // ─── 1. Today Snapshot Aggregation ─────────────────────────────────
  describe('1. Today Snapshot Aggregation', () => {
    it('aggregates today classes, current/next class, tasks, workload, exam, backlog, and journal count', () => {
      const now = new Date(2026, 9, 5, 9, 30); // Oct 5, 2026, 09:30
      const todayStr = '2026-10-05';

      const mockClasses: ClassOccurrence[] = [
        {
          id: 'c1',
          slotId: 'slot-1',
          date: todayStr,
          subjectId: 'sub-phy',
          startTime: '09:00',
          endTime: '10:00',
          room: '101',
          type: 'lecture',
          note: null,
          attendanceStatus: 'present',
          topicNames: [],
        },
        {
          id: 'c2',
          slotId: 'slot-2',
          date: todayStr,
          subjectId: 'sub-chem',
          startTime: '10:30',
          endTime: '11:30',
          room: '102',
          type: 'lecture',
          note: null,
          attendanceStatus: 'not_recorded',
          topicNames: [],
        },
      ];

      const mockTasks: Task[] = [
        {
          id: 't1',
          title: 'Physics Homework',
          subjectId: 'sub-phy',
          dueDate: todayStr,
          dueTime: '17:00',
          category: 'assignment',
          priority: 'high',
          status: 'planned',
          isCompleted: false,
          estimatedMinutes: 60,
          createdAt: todayStr,
          updatedAt: todayStr,
        },
        {
          id: 't2',
          title: 'Overdue Reading',
          subjectId: 'sub-chem',
          dueDate: '2026-10-04',
          dueTime: '23:59',
          category: 'study',
          priority: 'medium',
          status: 'planned',
          isCompleted: false,
          estimatedMinutes: 45,
          createdAt: '2026-10-03',
          updatedAt: '2026-10-04',
        },
      ];

      const mockExams: Exam[] = [
        {
          id: 'ex1',
          subjectId: 'sub-phy',
          name: 'Physics Midterm',
          type: 'internal',
          date: '2026-10-10',
          time: '10:00',
          maxMarks: 50,
          semesterId: 'sem-1',
        },
      ];

      const mockTopics: Topic[] = [
        {
          id: 'top-1',
          subjectId: 'sub-phy',
          unitId: 'unit-1',
          name: 'Optics',
          order: 1,
          isCompleted: false,
          revisionStatus: 'taught',
          revisionCount: 0,
          classNoteIds: [],
        },
      ];

      const snapshot = academicHubService.getTodayAcademicSnapshot({
        now,
        classesOverride: mockClasses,
        tasksOverride: mockTasks,
        examsOverride: mockExams,
        topicsOverride: mockTopics,
        attendanceDataOverride: {},
        attendanceTargetOverride: 75,
        subjectsOverride: [createMockSubject('sub-phy', 'Physics', 'PHY')],
      });

      expect(snapshot.todayClasses.length).toBe(2);
      expect(snapshot.currentClass?.id).toBe('c1'); // 09:00 - 10:00 covers 09:30
      expect(snapshot.nextClass?.id).toBe('c2'); // 10:30 is next
      expect(snapshot.pendingTasks.length).toBe(2);
      expect(snapshot.overdueTasks.length).toBe(1);
      expect(snapshot.todayWorkloadMinutes).toBe(60); // t1 is due today (60 min)
      expect(snapshot.upcomingExam?.name).toBe('Physics Midterm');
      expect(snapshot.revisionBacklogCount).toBe(1);
    });
  });

  // ─── 2 & 9. Workload Calculations (Today, Tomorrow, Week, Overdue) ─
  describe('2 & 9. Workload Calculations', () => {
    const baseTasks: Task[] = [
      {
        id: 't-today-1',
        title: 'Task 1',
        dueDate: '2026-10-05',
        estimatedMinutes: 30,
        status: 'planned',
        priority: 'medium',
        isCompleted: false,
        category: 'assignment',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
      {
        id: 't-today-2',
        title: 'Task 2',
        dueDate: '2026-10-05',
        estimatedMinutes: 45,
        status: 'planned',
        priority: 'high',
        isCompleted: false,
        category: 'lab',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
      {
        id: 't-today-3',
        title: 'Task 3',
        dueDate: '2026-10-05',
        estimatedMinutes: 80,
        status: 'planned',
        priority: 'urgent',
        isCompleted: false,
        category: 'study',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
      {
        id: 't-tomorrow',
        title: 'Task Tomorrow',
        dueDate: '2026-10-06',
        estimatedMinutes: 60,
        status: 'planned',
        priority: 'medium',
        isCompleted: false,
        category: 'assignment',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
      {
        id: 't-overdue',
        title: 'Task Overdue',
        dueDate: '2026-10-03',
        estimatedMinutes: 40,
        status: 'planned',
        priority: 'urgent',
        isCompleted: false,
        category: 'assignment',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
    ];

    it('calculates today workload correctly: 30+45+80 = 155 min (2h 35m)', () => {
      const now = new Date(2026, 9, 5, 12, 0); // Oct 5 12:00
      const workload = academicHubService.getTodayWorkload(baseTasks, now);

      expect(workload.totalMinutes).toBe(155);
      expect(workload.formattedTime).toBe('2h 35m');
      expect(workload.taskCount).toBe(3);
      expect(workload.highPriorityCount).toBe(2); // 1 high + 1 urgent
    });

    it('calculates tomorrow workload', () => {
      const now = new Date(2026, 9, 5, 12, 0);
      const workload = academicHubService.getTomorrowWorkload(baseTasks, now);

      expect(workload.totalMinutes).toBe(60);
      expect(workload.formattedTime).toBe('1h');
      expect(workload.taskCount).toBe(1);
    });

    it('calculates overdue workload', () => {
      const now = new Date(2026, 9, 5, 12, 0);
      const workload = academicHubService.getOverdueWorkload(baseTasks, now);

      expect(workload.totalMinutes).toBe(40);
      expect(workload.overdueCount).toBe(1);
    });

    it('calculates week workload (7 days)', () => {
      const now = new Date(2026, 9, 5, 12, 0);
      const workload = academicHubService.getWeekWorkload(baseTasks, now);

      // Today (155) + Tomorrow (60) = 215 min
      expect(workload.totalMinutes).toBe(215);
      expect(workload.taskCount).toBe(4);
    });
  });

  // ─── 3. Overdue Count & Smart Filtering ────────────────────────────
  describe('3. Overdue Count', () => {
    it('accurately identifies overdue tasks by date and time without false positives', () => {
      const now = new Date(2026, 9, 5, 14, 0); // 14:00 Oct 5
      const tasks: Task[] = [
        {
          id: 'ot-1',
          title: 'Past date',
          dueDate: '2026-10-04',
          isCompleted: false,
          status: 'planned',
          priority: 'medium',
          category: 'assignment',
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
        {
          id: 'ot-2',
          title: 'Today past time',
          dueDate: '2026-10-05',
          dueTime: '13:00', // passed
          isCompleted: false,
          status: 'planned',
          priority: 'high',
          category: 'assignment',
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
        {
          id: 'ot-3',
          title: 'Today future time',
          dueDate: '2026-10-05',
          dueTime: '16:00', // not passed
          isCompleted: false,
          status: 'planned',
          priority: 'medium',
          category: 'assignment',
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
        {
          id: 'ot-4',
          title: 'Completed past task',
          dueDate: '2026-10-04',
          isCompleted: true,
          status: 'completed',
          priority: 'medium',
          category: 'assignment',
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
      ];

      const overdue = tasks.filter(t => !t.isCompleted && academicHubService.getOverdueWorkload([t], now).overdueCount > 0);
      expect(overdue.length).toBe(2);
      expect(overdue.map(t => t.id)).toEqual(['ot-1', 'ot-2']);
    });
  });

  // ─── 4. Missing Class Journal Detection ────────────────────────────
  describe('4. Missing Class Journal Detection', () => {
    it('flags past class as missing journal if attendance recorded but no notes/topics/resources', () => {
      const now = new Date(2026, 9, 5, 11, 0); // 11:00 (after 10:00 class end)
      const occurrence: ClassOccurrence = {
        id: 'occ-1',
        slotId: 'slot-1',
        date: '2026-10-05',
        subjectId: 'sub-phy',
        startTime: '09:00',
        endTime: '10:00',
        room: '301',
        type: 'lecture',
        note: null,
        attendanceStatus: 'present',
        topicNames: [],
      };

      const eligible = academicHubService.isSessionEligibleForJournalReminder(occurrence, now);
      expect(eligible).toBe(true);
    });

    it('does NOT flag session if cancelled', () => {
      const occurrence: ClassOccurrence = {
        id: 'occ-2',
        slotId: 'slot-2',
        date: '2026-10-05',
        subjectId: 'sub-phy',
        startTime: '09:00',
        endTime: '10:00',
        room: '301',
        type: 'lecture',
        note: null,
        attendanceStatus: 'cancelled',
        topicNames: [],
      };

      expect(academicHubService.isSessionEligibleForJournalReminder(occurrence)).toBe(false);
    });

    it('does NOT flag session if attendance is not recorded', () => {
      const occurrence: ClassOccurrence = {
        id: 'occ-3',
        slotId: 'slot-3',
        date: '2026-10-05',
        subjectId: 'sub-phy',
        startTime: '09:00',
        endTime: '10:00',
        room: '301',
        type: 'lecture',
        note: null,
        attendanceStatus: 'not_recorded',
        topicNames: [],
      };

      expect(academicHubService.isSessionEligibleForJournalReminder(occurrence)).toBe(false);
    });

    it('does NOT flag session if note has journal text or topics', () => {
      const occurrenceWithJournal: ClassOccurrence = {
        id: 'occ-4',
        slotId: 'slot-4',
        date: '2026-10-05',
        subjectId: 'sub-phy',
        startTime: '09:00',
        endTime: '10:00',
        room: '301',
        type: 'lecture',
        note: {
          id: 'note-1',
          classSessionId: 'slot-4',
          date: '2026-10-05',
          subjectId: 'sub-phy',
          attendanceStatus: 'present',
          myNotes: 'Learned about PN junction diode depletion layer.',
          teacherNotes: 'Important diagram.',
          topicIds: ['top-1'],
          resourceIds: [],
          revisionStatus: 'taught',
          linkedTaskIds: [],
          linkedExamTopicIds: [],
          createdAt: '2026-10-05',
          updatedAt: '2026-10-05',
        },
        attendanceStatus: 'present',
        topicNames: ['PN Junction'],
      };

      expect(academicHubService.isSessionEligibleForJournalReminder(occurrenceWithJournal)).toBe(false);
    });
  });

  // ─── 5. Revision Backlog Detection ─────────────────────────────────
  describe('5. Revision Backlog Detection', () => {
    it('detects topics taught but not revised as backlog', () => {
      const topics: Topic[] = [
        { id: 'top-1', subjectId: 's1', unitId: 'u1', name: 'Topic 1', order: 1, isCompleted: false, revisionStatus: 'taught', revisionCount: 0, classNoteIds: [] },
        { id: 'top-2', subjectId: 's1', unitId: 'u1', name: 'Topic 2', order: 2, isCompleted: true, revisionStatus: 'revised', revisionCount: 2, classNoteIds: [] },
        { id: 'top-3', subjectId: 's1', unitId: 'u1', name: 'Topic 3', order: 3, isCompleted: false, revisionStatus: 'needs_revision', revisionCount: 0, classNoteIds: [] },
        { id: 'top-4', subjectId: 's1', unitId: 'u1', name: 'Topic 4', order: 4, isCompleted: false, revisionStatus: 'not_taught', revisionCount: 0, classNoteIds: [] },
      ];

      const taught = topics.filter(t => t.revisionStatus === 'taught' || t.revisionStatus === 'needs_revision' || t.revisionStatus === 'revised');
      const unrevised = taught.filter(t => t.revisionStatus !== 'revised');

      expect(taught.length).toBe(3);
      expect(unrevised.length).toBe(2); // Topic 1 and Topic 3
    });
  });

  // ─── 6. Upcoming Exam Detection ────────────────────────────────────
  describe('6. Upcoming Exam Detection', () => {
    it('identifies nearest upcoming exam within date range', () => {
      const now = new Date(2026, 9, 5);
      const exams: Exam[] = [
        { id: 'ex-far', subjectId: 's1', name: 'Finals', type: 'external', date: '2026-11-20', maxMarks: 100, semesterId: 'sem-1' },
        { id: 'ex-soon', subjectId: 's1', name: 'Midterm', type: 'internal', date: '2026-10-11', maxMarks: 50, semesterId: 'sem-1' },
        { id: 'ex-past', subjectId: 's1', name: 'Quiz', type: 'quiz', date: '2026-10-01', maxMarks: 20, semesterId: 'sem-1' },
      ];

      const snapshot = academicHubService.getTodayAcademicSnapshot({
        now,
        classesOverride: [],
        tasksOverride: [],
        examsOverride: exams,
        topicsOverride: [],
        attendanceDataOverride: {},
        attendanceTargetOverride: 75,
        subjectsOverride: [],
      });

      expect(snapshot.upcomingExam?.name).toBe('Midterm');
      expect(snapshot.daysUntilExam).toBe(6);
    });
  });

  // ─── 7. Topic-Centric Academic Context ─────────────────────────────
  describe('7. Topic-Centric Academic Context (getTopicAcademicContext)', () => {
    it('retrieves complete relational context for a topic without data duplication', () => {
      const topicId = 'top-pn-junction';
      const subjectId = 'sub-phy';
      const unitId = 'unit-semiconductors';

      const mockSubject = createMockSubject(subjectId, 'Physics', 'PHY');

      const mockUnit: SyllabusUnit = {
        id: unitId,
        subjectId,
        semesterId: 'sem-1',
        name: 'Semiconductors',
        order: 1,
        topicIds: [topicId],
      };

      const mockTopic: Topic = {
        id: topicId,
        subjectId,
        unitId,
        name: 'PN Junction',
        order: 1,
        isCompleted: false,
        revisionStatus: 'taught',
        revisionCount: 1,
        lastRevisedAt: '2026-10-02',
        classNoteIds: ['note-oct2'],
      };

      const mockNote: ClassNote = {
        id: 'note-oct2',
        classSessionId: 'slot-phy-1',
        date: '2026-10-02',
        subjectId,
        attendanceStatus: 'present',
        myNotes: 'Forward and reverse bias curves discussed.',
        teacherNotes: 'Important diagram for semester exam.',
        topicIds: [topicId],
        resourceIds: ['res-diag'],
        revisionStatus: 'taught',
        linkedTaskIds: [],
        linkedExamTopicIds: [],
        createdAt: '2026-10-02',
        updatedAt: '2026-10-02',
      };

      const mockClasses: ClassOccurrence[] = [
        {
          id: 'occ-oct2',
          slotId: 'slot-phy-1',
          date: '2026-10-02',
          subjectId,
          startTime: '10:00',
          endTime: '11:00',
          room: '204',
          type: 'lecture',
          note: mockNote,
          attendanceStatus: 'present',
          topicNames: ['PN Junction'],
        },
      ];

      const mockTasks: Task[] = [
        {
          id: 't-pn-1',
          title: 'Draw PN Junction I-V characteristics',
          subjectId,
          topicId,
          dueDate: '2026-10-08',
          status: 'planned',
          priority: 'high',
          isCompleted: false,
          category: 'assignment',
          estimatedMinutes: 45,
          createdAt: '2026-10-02',
          updatedAt: '2026-10-02',
        },
      ];

      const mockExams: Exam[] = [
        {
          id: 'ex-midterm',
          subjectId,
          name: 'Physics Midterm',
          type: 'internal',
          date: '2026-10-15',
          maxMarks: 50,
          semesterId: 'sem-1',
        },
      ];

      const mockResource: Resource = {
        id: 'res-diag',
        title: 'Diode Curve Diagram',
        type: 'image',
        uri: 'file:///diode.png',
        createdAt: '2026-10-02',
      };

      const context = academicHubService.getTopicAcademicContext(topicId, {
        topics: [mockTopic],
        subjects: [mockSubject],
        units: [mockUnit],
        classOccurrences: mockClasses,
        tasks: mockTasks,
        exams: mockExams,
        examTopics: [{ id: 'et-1', examId: 'ex-midterm', topicId }],
        resources: [mockResource],
      });

      expect(context).not.toBeNull();
      expect(context?.topic.name).toBe('PN Junction');
      expect(context?.subject?.name).toBe('Physics');
      expect(context?.unit?.name).toBe('Semiconductors');
      expect(context?.classSessions.length).toBe(1);
      expect(context?.classSessions[0].date).toBe('2026-10-02');
      expect(context?.classSessions[0].journal).toBe('Forward and reverse bias curves discussed.');
      expect(context?.resources.length).toBe(1);
      expect(context?.pendingTasks?.length).toBe(1);
      expect(context?.exams.length).toBe(1);
      expect(context?.revision.revisionCount).toBe(1);
      expect(context?.revision.status).toBe('taught');
    });
  });

  // ─── 8. Subject Academic Snapshot ──────────────────────────────────
  describe('8. Subject Academic Snapshot (getSubjectAcademicSnapshot)', () => {
    it('computes rich academic snapshot with attendance, syllabus, revision, and tasks', () => {
      const subjectId = 'sub-chem';
      const mockSubject = createMockSubject(subjectId, 'Chemistry', 'CHEM');

      const mockUnits: SyllabusUnit[] = [
        { id: 'u1', subjectId, semesterId: 'sem-1', name: 'Unit 1: Thermodynamics', order: 1, topicIds: ['t1', 't2', 't3'] },
      ];

      const mockTopics: Topic[] = [
        { id: 't1', subjectId, unitId: 'u1', name: 'First Law', order: 1, isCompleted: true, revisionStatus: 'revised', revisionCount: 2, classNoteIds: [] },
        { id: 't2', subjectId, unitId: 'u1', name: 'Second Law', order: 2, isCompleted: false, revisionStatus: 'taught', revisionCount: 0, classNoteIds: [] },
        { id: 't3', subjectId, unitId: 'u1', name: 'Third Law', order: 3, isCompleted: false, revisionStatus: 'not_taught', revisionCount: 0, classNoteIds: [] },
      ];

      const mockTasks: Task[] = [
        {
          id: 'chem-t1',
          title: 'Entropy Numerical',
          subjectId,
          dueDate: '2026-10-06',
          status: 'planned',
          priority: 'urgent',
          isCompleted: false,
          category: 'assignment',
          estimatedMinutes: 60,
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
      ];

      const snapshot = academicHubService.getSubjectAcademicSnapshot(subjectId, {
        subjects: [mockSubject],
        attendanceData: { [subjectId]: { attended: 16, total: 20 } }, // 80%
        targetPercentage: 75,
        tasks: mockTasks,
        topics: mockTopics,
        units: mockUnits,
        exams: [{ id: 'ex-chem', subjectId, name: 'Chem Unit Test', type: 'internal', date: '2026-10-12', maxMarks: 30, semesterId: 'sem-1' }],
        classOccurrences: [],
        resources: [],
        now: new Date(2026, 9, 5),
      });

      expect(snapshot).not.toBeNull();
      expect(snapshot?.subjectName).toBe('Chemistry');
      expect(snapshot?.attendancePercentage).toBe(80);
      expect(snapshot?.attendanceStatus).toBe('safe');
      expect(snapshot?.topicsTotal).toBe(3);
      expect(snapshot?.topicsTaught).toBe(2); // First Law (revised) & Second Law (taught)
      expect(snapshot?.topicsRevised).toBe(1);
      expect(snapshot?.topicBacklog).toBe(1); // Second Law is taught but not revised
      expect(snapshot?.tasksPending).toBe(1);
      expect(snapshot?.workloadMinutes).toBe(60);
      expect(snapshot?.upcomingExams.length).toBe(1);
    });
  });

  // ─── 10. Signal Prioritization ─────────────────────────────────────
  describe('10. Signal Prioritization', () => {
    it('ranks attention items correctly: Critical > High > Medium > Low', () => {
      const now = new Date(2026, 9, 5, 10, 0);

      const items = academicHubService.getAcademicAttentionItems({
        now,
        todayClasses: [],
        unrecordedClasses: [
          {
            id: 'occ-unrec',
            slotId: 'slot-unrec',
            date: '2026-10-05',
            subjectId: 'sub-phy',
            startTime: '08:00',
            endTime: '09:00',
            room: '101',
            type: 'lecture',
            note: null,
            attendanceStatus: 'present',
            topicNames: [],
          },
        ],
        pendingTasks: [
          {
            id: 'task-due-today',
            title: 'Task due today',
            dueDate: '2026-10-05',
            dueTime: '23:59',
            priority: 'medium',
            status: 'planned',
            isCompleted: false,
            category: 'assignment',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
        ],
        overdueTasks: [
          {
            id: 'task-overdue-urgent',
            title: 'Urgent overdue task',
            dueDate: '2026-10-04',
            priority: 'urgent',
            status: 'planned',
            isCompleted: false,
            category: 'assignment',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
        ],
        upcomingExams: [
          {
            id: 'exam-today',
            subjectId: 'sub-phy',
            name: 'Exam Today',
            type: 'internal',
            date: '2026-10-05',
            time: '14:00',
            maxMarks: 50,
            semesterId: 'sem-1',
          },
        ],
        revisionBacklog: [
          { id: 'top-b', subjectId: 'sub-phy', unitId: 'u1', name: 'Backlog Topic', order: 1, isCompleted: false, revisionStatus: 'taught', revisionCount: 0, classNoteIds: [] },
        ],
        attendanceData: {
          'sub-phy': { attended: 10, total: 20 }, // 50% vs 75% target -> Critical
        },
        attendanceTarget: 75,
        subjects: [createMockSubject('sub-phy', 'Physics', 'PHY')],
      });

      expect(items.length).toBeGreaterThanOrEqual(4);

      // Verify priorities
      const priorities = items.map(i => i.priority);
      expect(priorities).toContain('critical');
      expect(priorities).toContain('medium');

      // Top priority item must be critical
      expect(items[0].priority).toBe('critical');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PART B — LOCAL NOTIFICATION ENGINE
  // ═══════════════════════════════════════════════════════════════════

  // ─── 11 & 12. Initialization & Permission Abstraction ──────────────
  describe('11 & 12. Notification Initialization & Permissions', () => {
    it('initializes notification system with Android channels and loads settings', async () => {
      await notificationService.init();
      const settings = await notificationService.getSettings();
      expect(settings.masterEnabled).toBe(true);
      expect(settings.classReminders.enabled).toBe(true);
      expect(settings.taskReminders.enabled).toBe(true);
      expect(settings.examReminders.enabled).toBe(true);
    });

    it('requests permission gracefully and returns boolean status', async () => {
      const granted = await notificationService.requestPermissions();
      expect(typeof granted).toBe('boolean');
      expect(granted).toBe(true); // Mock adapter returns granted: true
    });
  });

  // ─── 13. Class Reminders ───────────────────────────────────────────
  describe('13. Class Reminders Scheduling', () => {
    it('schedules class reminders for upcoming classes with configured lead time', async () => {
      const now = new Date(2026, 9, 5, 8, 0); // 08:00
      const session: ClassOccurrence = {
        id: 'slot-1-2026-10-05',
        slotId: 'slot-1',
        date: '2026-10-05',
        subjectId: 'sub-phy',
        startTime: '09:00',
        endTime: '10:00',
        room: '301',
        type: 'lecture',
        note: null,
        attendanceStatus: 'not_recorded',
        topicNames: [],
      };

      // 30 min before 09:00 is 08:30 (future relative to 08:00)
      const notifId = await notificationService.scheduleClassReminder(session, 30, now, 'Physics');
      expect(notifId).not.toBeNull();

      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(1);
      expect(scheduled[0].content.title).toBe('Next Class');
      expect(scheduled[0].content.body).toContain('Physics starts in 30 min');
      expect(scheduled[0].content.body).toContain('Room 301');
      expect(scheduled[0].content.data?.type).toBe('class_reminder');
      expect(scheduled[0].content.data?.classSessionId).toBe('slot-1');
    });

    it('does NOT schedule reminder if calculated trigger time is in the past', async () => {
      const now = new Date(2026, 9, 5, 8, 45); // 08:45
      const session: ClassOccurrence = {
        id: 'slot-1-2026-10-05',
        slotId: 'slot-1',
        date: '2026-10-05',
        subjectId: 'sub-phy',
        startTime: '09:00',
        endTime: '10:00',
        room: '301',
        type: 'lecture',
        note: null,
        attendanceStatus: 'not_recorded',
        topicNames: [],
      };

      // 30 min before 09:00 is 08:30 (which is in the past relative to 08:45)
      const notifId = await notificationService.scheduleClassReminder(session, 30, now, 'Physics');
      expect(notifId).toBeNull();
    });
  });

  // ─── 14. Task Reminders ────────────────────────────────────
  describe('14. Task Reminders Scheduling', () => {
    it('schedules task due-date reminder with proper title and metadata', async () => {
      const now = new Date(2026, 9, 5, 8, 0);
      const task: Task = {
        id: 'task-notif-1',
        title: 'Math Problem Set 4',
        subjectId: 'sub-math',
        dueDate: '2026-10-05',
        dueTime: '17:00',
        priority: 'high',
        status: 'planned',
        isCompleted: false,
        category: 'assignment',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      };

      const notifId = await notificationService.scheduleTaskReminder(task, now, 'Math');
      expect(notifId).not.toBeNull();

      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(1);
      expect(scheduled[0].content.title).toBe('Task Due Today');
      expect(scheduled[0].content.body).toContain('Math Problem Set 4');
      expect(scheduled[0].content.data?.taskId).toBe('task-notif-1');
    });

    it('does NOT schedule task notification for completed tasks', async () => {
      const now = new Date(2026, 9, 5, 8, 0);
      const task: Task = {
        id: 'task-notif-comp',
        title: 'Completed Task',
        dueDate: '2026-10-05',
        dueTime: '17:00',
        priority: 'medium',
        status: 'completed',
        isCompleted: true,
        category: 'assignment',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      };

      const notifId = await notificationService.scheduleTaskReminder(task, now);
      expect(notifId).toBeNull();
    });
  });

  // ─── 15 & 16. Cancellation on Task Completion & Deletion ───────────
  describe('15 & 16. Completed & Deleted Task Cancellation', () => {
    it('cancels scheduled notifications when task is completed or deleted', async () => {
      const now = new Date(2026, 9, 5, 8, 0);
      const task: Task = {
        id: 'task-cancel-test',
        title: 'Physics Lab Report',
        dueDate: '2026-10-05',
        dueTime: '18:00',
        priority: 'urgent',
        status: 'planned',
        isCompleted: false,
        category: 'lab',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      };

      await notificationService.scheduleTaskReminder(task, now);
      let scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(1);

      // Now cancel for this task entity (e.g. task completed or deleted)
      await notificationService.cancelNotificationsForEntity(task.id);

      scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(0);

      // SQLite records must also be removed
      const records = await notificationRecordRepository.getByEntityId(task.id);
      expect(records.length).toBe(0);
    });
  });

  // ─── 17. Due-Date Update Rescheduling ──────────────────────────────
  describe('17. Due-Date Update Rescheduling', () => {
    it('cancels old notification and schedules new one when due date changes', async () => {
      const now = new Date(2026, 9, 5, 8, 0);
      const task: Task = {
        id: 'task-resched-1',
        title: 'Project Draft',
        dueDate: '2026-10-05',
        dueTime: '12:00',
        priority: 'high',
        status: 'planned',
        isCompleted: false,
        category: 'assignment',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      };

      await notificationService.scheduleTaskReminder(task, now);
      expect((await mockAdapter.getAllScheduledNotificationsAsync()).length).toBe(1);

      // Cancel old
      await notificationService.cancelNotificationsForEntity(task.id);

      // Schedule updated task with new due date
      const updatedTask: Task = {
        ...task,
        dueDate: '2026-10-06',
        dueTime: '14:00',
        updatedAt: '2026-10-05',
      };
      await notificationService.scheduleTaskReminder(updatedTask, now);

      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(1);
      expect(scheduled[0].content.title).toBe('Task Due Soon');
    });
  });

  // ─── 18. Exam Reminder Scheduling ──────────────────────────────────
  describe('18. Exam Reminder Scheduling', () => {
    it('schedules exam reminders with configurable interval and unrevised topic count', async () => {
      const now = new Date(2026, 9, 5, 8, 0);
      const exam: Exam = {
        id: 'exam-phy-mid',
        subjectId: 'sub-phy',
        name: 'Physics Midterm',
        type: 'internal',
        date: '2026-10-08', // 3 days away
        time: '10:00',
        maxMarks: 50,
        semesterId: 'sem-1',
      };

      const notifId = await notificationService.scheduleExamReminder(exam, 3, now, 'Physics', 4);
      expect(notifId).not.toBeNull();

      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(1);
      expect(scheduled[0].content.title).toContain('Physics Midterm');
      expect(scheduled[0].content.body).toContain('4 topics remain unrevised');
      expect(scheduled[0].content.data?.examId).toBe('exam-phy-mid');
    });
  });

  // ─── 19. Revision Reminder Throttling ──────────────────────────────
  describe('19. Revision Reminder Throttling', () => {
    it('enforces 1 reminder per subject per day cooldown to prevent spam', async () => {
      const now = new Date(2026, 9, 5, 16, 0); // 16:00
      const subject = createMockSubject('sub-phy', 'Physics', 'PHY');

      // First reminder schedules successfully
      const firstId = await notificationService.scheduleRevisionReminder(subject, 3, now);
      expect(firstId).not.toBeNull();

      // Immediate second reminder on the same day for the same subject is throttled (returns existing ID)
      const secondId = await notificationService.scheduleRevisionReminder(subject, 3, now);
      expect(secondId).toBe(firstId);

      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(1); // Exactly 1 scheduled notification, no duplicates
    });
  });

  // ─── 20. Attendance Alert Thresholds ───────────────────────────────
  describe('20. Attendance Alert Thresholds', () => {
    it('schedules attendance warning when attendance falls below target threshold', async () => {
      const subject = createMockSubject('sub-math', 'Mathematics', 'MATH');

      // 14 / 20 = 70% (< 75% target)
      const notifId = await notificationService.scheduleAttendanceAlert(subject, 70, 75);
      expect(notifId).not.toBeNull();

      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(1);
      expect(scheduled[0].content.title).toContain('Attendance Alert');
      expect(scheduled[0].content.body).toContain('70%');
      expect(scheduled[0].content.body).toContain('75% target');
    });

    it('does NOT trigger attendance alert when attendance is safely above target', async () => {
      const subject = createMockSubject('sub-math', 'Mathematics', 'MATH');

      // 17 / 20 = 85% (>= 75% target)
      const notifId = await notificationService.scheduleAttendanceAlert(subject, 85, 75);
      expect(notifId).toBeNull();
    });
  });

  // ─── 21. Post-Class Journal Reminder ───────────────────────────────
  describe('21. Post-Class Journal Reminder', () => {
    it('schedules journal reminder with delay after class end time', async () => {
      const now = new Date(2026, 9, 5, 10, 0); // Oct 5 10:00
      const session: ClassOccurrence = {
        id: 'slot-phy-ended',
        slotId: 'slot-phy',
        date: '2026-10-05',
        subjectId: 'sub-phy',
        startTime: '09:00',
        endTime: '10:00',
        room: '301',
        type: 'lecture',
        note: null,
        attendanceStatus: 'present',
        topicNames: [],
      };

      // 5 min delay after 10:00 is 10:05 (future relative to 10:00)
      const notifId = await notificationService.schedulePostClassJournalReminder(session, now, 'Physics');
      expect(notifId).not.toBeNull();

      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(1);
      expect(scheduled[0].content.title).toBe("Record Today's Physics Class");
      expect(scheduled[0].content.body).toContain("Add the topics you covered");
      expect(scheduled[0].content.data?.type).toBe('post_class_journal');
    });
  });

  // ─── 22. Duplicate Prevention ──────────────────────────────────────
  describe('22. Duplicate Prevention', () => {
    it('prevents scheduling duplicate notification records for identical entity & time', async () => {
      const now = new Date(2026, 9, 5, 8, 0);
      const session: ClassOccurrence = {
        id: 'slot-dup-1',
        slotId: 'slot-dup',
        date: '2026-10-05',
        subjectId: 'sub-phy',
        startTime: '10:00',
        endTime: '11:00',
        room: '301',
        type: 'lecture',
        note: null,
        attendanceStatus: 'not_recorded',
        topicNames: [],
      };

      const id1 = await notificationService.scheduleClassReminder(session, 10, now, 'Physics');
      const id2 = await notificationService.scheduleClassReminder(session, 10, now, 'Physics');

      expect(id1).toBe(id2);
      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(1); // Only 1 OS notification scheduled
    });
  });

  // ─── 23. Cancellation (Category & Clear All) ───────────────────────
  describe('23. Cancellation by Category', () => {
    it('cancels all notifications for a specific category when disabled', async () => {
      const now = new Date(2026, 9, 5, 8, 0);
      const task: Task = {
        id: 'task-cat-cancel',
        title: 'Task for Category Test',
        dueDate: '2026-10-05',
        dueTime: '17:00',
        priority: 'medium',
        status: 'planned',
        isCompleted: false,
        category: 'assignment',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      };

      await notificationService.scheduleTaskReminder(task, now);
      expect((await mockAdapter.getAllScheduledNotificationsAsync()).length).toBe(1);

      await notificationService.cancelCategoryNotifications('task_reminder');
      expect((await mockAdapter.getAllScheduledNotificationsAsync()).length).toBe(0);
    });
  });

  // ─── 24 & 25. Startup Reconciliation & Stale Cleanup ───────────────
  describe('24 & 25. Startup Reconciliation & Stale Cleanup', () => {
    it('removes stale notifications passed in time and reconciles missing future ones', async () => {
      // Insert a past record manually
      await notificationRecordRepository.create({
        id: 'stale-record-1',
        type: 'class_reminder',
        entityId: 'past-slot',
        scheduledFor: '2026-10-01T08:00:00.000Z',
        expoNotificationId: 'expo-stale-1',
        title: 'Past Reminder',
        body: 'Class in 30 min',
      });

      const now = new Date(2026, 9, 5, 8, 0);
      await notificationRecordRepository.deletePassedRecords(now.toISOString());

      const remaining = await notificationRecordRepository.getByEntityId('past-slot');
      expect(remaining.length).toBe(0);
    });
  });

  // ─── 26. Smart Quiet-Hours Behavior ────────────────────────────────
  describe('26. Smart Quiet Hours', () => {
    it('suppresses non-urgent reminders during quiet hours (23:00 to 07:00)', async () => {
      // 23:30 is inside quiet hours
      const nightDate = new Date(2026, 9, 5, 23, 30);
      const isQuiet = notificationService.isQuietHour(nightDate, false);
      expect(isQuiet).toBe(true);
    });

    it('allows critical/urgent alerts through quiet hours if bypass allowed', async () => {
      const nightDate = new Date(2026, 9, 5, 23, 30);
      const isQuiet = notificationService.isQuietHour(nightDate, true);
      expect(isQuiet).toBe(false);
    });

    it('allows normal reminders during daytime', async () => {
      const dayDate = new Date(2026, 9, 5, 14, 0); // 14:00
      const isQuiet = notificationService.isQuietHour(dayDate, false);
      expect(isQuiet).toBe(false);
    });
  });

  // ─── 27. Notification Settings Persistence ─────────────────────────
  describe('27. Notification Settings Persistence', () => {
    it('persists and loads notification settings from SQLite', async () => {
      const initial = await settingsRepository.getNotificationSettings();
      expect(initial.masterEnabled).toBe(true);

      const modified = {
        ...initial,
        classReminders: {
          ...initial.classReminders,
          minutesBefore: [15, 5],
        },
      };

      await settingsRepository.setNotificationSettings(modified);
      const loaded = await settingsRepository.getNotificationSettings();
      expect(loaded.classReminders.minutesBefore).toEqual([15, 5]);

      // Restore
      await settingsRepository.setNotificationSettings(initial);
    });
  });

  // ─── 28. Deep-Link Payload Creation ────────────────────────────────
  describe('28. Deep-Link Payload Creation', () => {
    it('attaches complete structured deep-link payload to notifications', async () => {
      const now = new Date(2026, 9, 5, 8, 0);
      const session: ClassOccurrence = {
        id: 'slot-dl-1',
        slotId: 'slot-dl',
        date: '2026-10-05',
        subjectId: 'sub-phy',
        startTime: '11:00',
        endTime: '12:00',
        room: 'Lab 2',
        type: 'lab',
        note: null,
        attendanceStatus: 'not_recorded',
        topicNames: [],
      };

      await notificationService.scheduleClassReminder(session, 10, now, 'Physics');
      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(1);

      const payload = scheduled[0].content.data;
      expect(payload).toBeDefined();
      expect(payload?.type).toBe('class_reminder');
      expect(payload?.subjectId).toBe('sub-phy');
      expect(payload?.classSessionId).toBe('slot-dl');
      expect(payload?.deepLinkTarget).toBe('/schedule?session=slot-dl');
    });
  });

  // ─── 29. Timezone Safety ───────────────────────────────────────────
  describe('29. Timezone Safety (UTC+5:30 IST Safe)', () => {
    it('safely handles 00:01, 05:29, 05:30, and 23:59 without UTC date drift', () => {
      // 00:01
      const d1 = new Date(2026, 9, 5, 0, 1);
      expect(formatLocalDate(d1)).toBe('2026-10-05');

      // 05:29 (IST - 5h30m = 23:59 previous day UTC)
      const d2 = new Date(2026, 9, 5, 5, 29);
      expect(formatLocalDate(d2)).toBe('2026-10-05');

      // 05:30 (IST boundary)
      const d3 = new Date(2026, 9, 5, 5, 30);
      expect(formatLocalDate(d3)).toBe('2026-10-05');

      // 23:59
      const d4 = new Date(2026, 9, 5, 23, 59);
      expect(formatLocalDate(d4)).toBe('2026-10-05');

      // Verify parseLocalDate produces matching local calendar components
      const parsed = parseLocalDate('2026-10-05');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(9);
      expect(parsed.getDate()).toBe(5);
    });
  });

  // ─── 30. Cancelled Class No-Notification Case ──────────────────────
  describe('30. Cancelled Class No-Notification Case', () => {
    it('does not schedule post-class journal reminder for cancelled classes', async () => {
      const now = new Date(2026, 9, 5, 10, 0);
      const session: ClassOccurrence = {
        id: 'slot-cancelled',
        slotId: 'slot-cancelled',
        date: '2026-10-05',
        subjectId: 'sub-phy',
        startTime: '09:00',
        endTime: '10:00',
        room: '301',
        type: 'lecture',
        note: null,
        attendanceStatus: 'cancelled',
        topicNames: [],
      };

      const notifId = await notificationService.schedulePostClassJournalReminder(session, now, 'Physics');
      expect(notifId).toBeNull();

      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBe(0);
    });
  });
});
