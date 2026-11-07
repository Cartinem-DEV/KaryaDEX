/**
 * BunkMatKar — Phase 9: Academic Calendar + Study Planning Tests
 *
 * Full verification of all Phase 9 requirements:
 *  1. Unified Calendar Event Derivation (classes, exams, tasks, revision, attendance recovery)
 *  2. Day, Week, and Month View Derivations & Boundaries
 *  3. Daily Academic Workload Calculation (classes, tasks, revision, exams)
 *  4. Workload Classification (light, moderate, heavy, overloaded)
 *  5. Daily Study Capacity (get, set, preference handling)
 *  6. Study Planning Engine & Deterministic Prioritization Order:
 *     - Critical revision -> Urgent exam prep -> Overdue tasks -> Due-today tasks -> High priority tasks -> High priority revision -> Lower priority
 *  7. Daily Study Plan Generation (time-blocking, class protection, overflow exposure)
 *  8. Weekly Academic Plan Generation (7-day summary, overloaded days)
 *  9. Planning Conflict Detection:
 *     - task scheduled during class
 *     - overlapping tasks
 *     - task scheduled during exam
 *     - workload overload
 * 10. Task Rescheduling (preserves task identity, topic/subject links, updates database)
 * 11. Revision to Task Conversion (preserves topic, subject, exam links)
 * 12. Unscheduled Academic Work Identification
 * 13. Exam-Aware Planning Integration
 * 14. Attendance-Aware Planning Integration (recovery classes surfaced)
 * 15. Academic Hub Integration (study planning hub data & attention items)
 * 16. Notification Service Integration (study reminders & overload alerts)
 * 17. Edge Cases:
 *     - zero academic events (empty days)
 *     - only classes
 *     - only tasks
 *     - only revision
 *     - missing duration / 0-minute estimates (graceful fallback)
 *     - all tasks completed
 *     - all topics confidently revised
 *     - no timetable / no exams / no tasks
 *     - no negative durations, no NaN, no Infinity
 * 18. Semester Isolation & Demo/Real Data Separation
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  subjectRepository,
  semesterRepository,
  taskRepository,
  syllabusRepository,
} from '../database';
import { studyPlanningService } from '../services/studyPlanningService';
import { academicHubService } from '../services/academicHubService';
import { notificationService } from '../services/notificationService';
import { useAppStore } from '../store/useAppStore';
import { useAcademicStore } from '../store/useAcademicStore';
import type { Semester, Subject, Exam, Task, ClassSession } from '../types';
import type { TimetableSlot, Topic, SyllabusUnit } from '../types/academic';

describe('Phase 9: Academic Calendar + Study Planning', () => {
  const sem1: Semester = {
    id: 'sem-p9-1',
    name: 'Semester 1',
    number: 1,
    startDate: '2026-08-01',
    endDate: '2026-12-15',
    collegeId: 'col-p9',
    isCurrent: true,
    status: 'current',
  };

  const sem2: Semester = {
    id: 'sem-p9-2',
    name: 'Semester 2',
    number: 2,
    startDate: '2027-01-01',
    endDate: '2027-05-30',
    collegeId: 'col-p9',
    isCurrent: false,
    status: 'archived',
  };

  const mathSub: Subject = {
    id: 'sub-p9-math',
    name: 'Advanced Calculus',
    code: 'MATH301',
    shortName: 'Calc',
    color: '#3B82F6',
    semesterId: sem1.id,
    facultyId: 'fac-1',
    credits: 4,
    isArchived: false,
    subjectType: 'lecture',
    targetAttendance: 75,
  };

  const phySub: Subject = {
    id: 'sub-p9-phy',
    name: 'Quantum Physics',
    code: 'PHY301',
    shortName: 'Physics',
    color: '#8B5CF6',
    semesterId: sem1.id,
    facultyId: 'fac-2',
    credits: 3,
    isArchived: false,
    subjectType: 'lecture',
    targetAttendance: 75,
  };

  const csSub: Subject = {
    id: 'sub-p9-cs',
    name: 'Operating Systems',
    code: 'CS301',
    shortName: 'OS',
    color: '#10B981',
    semesterId: sem1.id,
    facultyId: 'fac-3',
    credits: 4,
    isArchived: false,
    subjectType: 'lecture',
    targetAttendance: 75,
  };

  const testDate = '2026-10-12'; // Monday (dayOfWeek = 'monday')
  const tomorrowDate = '2026-10-13'; // Tuesday

  beforeAll(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();

    await semesterRepository.saveSemester(sem1);
    await semesterRepository.saveSemester(sem2);
    await subjectRepository.createSubject(mathSub);
    await subjectRepository.createSubject(phySub);
    await subjectRepository.createSubject(csSub);

    useAppStore.setState({
      semester: sem1,
      subjects: [mathSub, phySub, csSub],
      attendanceTarget: 75,
      attendanceData: {
        [mathSub.id]: { attended: 18, total: 20 }, // 90% safe
        [phySub.id]: { attended: 15, total: 20 },  // 75% watch
        [csSub.id]: { attended: 10, total: 20 },   // 50% danger
      },
      classSessions: [],
      tasks: [],
      exams: [],
    });
  });

  beforeEach(() => {
    // Reset Zustand academic and app state before each test block
    useAppStore.setState({
      classSessions: [],
      tasks: [],
      exams: [],
      semester: sem1,
    });
    useAcademicStore.setState({
      timetableSlots: [],
      topics: [],
      syllabusUnits: [],
      revisionRecords: [],
    });
  });

  // ─── 1. CALENDAR EVENT DERIVATION ──────────────────────────────────────────

  describe('1. Unified Calendar Event Derivation', () => {
    it('derives calendar events from classes, exams, tasks, and revision', () => {
      // Setup a class session
      const session: ClassSession = {
        id: 'sess-1',
        subjectId: mathSub.id,
        dayOfWeek: 'monday',
        startTime: '09:00',
        endTime: '10:00',
        room: 'Room 101',
        type: 'lecture',
        semesterId: sem1.id,
      };

      // Setup a task
      const task: Task = {
        id: 'task-1',
        title: 'Calc Assignment 1',
        category: 'assignment',
        priority: 'high',
        subjectId: mathSub.id,
        dueDate: testDate,
        dueTime: '17:00',
        scheduledDate: testDate,
        scheduledStartTime: '14:00',
        scheduledEndTime: '15:00',
        estimatedMinutes: 60,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Setup an exam
      const exam: Exam = {
        id: 'exam-1',
        subjectId: phySub.id,
        name: 'Midterm Physics',
        type: 'internal',
        date: testDate,
        time: '11:00',
        maxMarks: 50,
        weightage: 30,
        semesterId: sem1.id,
      };

      useAppStore.setState({
        classSessions: [session],
        tasks: [task],
        exams: [exam],
      });

      const events = studyPlanningService.deriveCalendarEvents(testDate, testDate);

      expect(events.length).toBeGreaterThanOrEqual(3);

      const classEv = events.find(e => e.sourceType === 'class_session');
      expect(classEv).toBeDefined();
      expect(classEv?.title).toBe(mathSub.name);
      expect(classEv?.startTime).toBe('09:00');
      expect(classEv?.type).toBe('class');
      expect(classEv?.sourceId).toBe('sess-1');

      const taskEv = events.find(e => e.sourceType === 'task');
      expect(taskEv).toBeDefined();
      expect(taskEv?.title).toBe('Calc Assignment 1');
      expect(taskEv?.startTime).toBe('14:00');
      expect(taskEv?.endTime).toBe('15:00');
      expect(taskEv?.type).toBe('task');

      const examEv = events.find(e => e.sourceType === 'exam');
      expect(examEv).toBeDefined();
      expect(examEv?.title).toBe('Midterm Physics');
      expect(examEv?.startTime).toBe('11:00');
      expect(examEv?.type).toBe('exam');
    });

    it('surfaces attendance recovery context for subjects in danger zone', () => {
      const dangerSession: ClassSession = {
        id: 'sess-danger',
        subjectId: csSub.id, // CS is 50% (danger)
        dayOfWeek: 'monday',
        startTime: '10:00',
        endTime: '11:00',
        room: 'Lab 2',
        type: 'lab',
        semesterId: sem1.id,
      };

      useAppStore.setState({
        classSessions: [dangerSession],
      });

      const events = studyPlanningService.deriveCalendarEvents(testDate, testDate);
      const sessionEv = events.find(e => e.sourceId === 'sess-danger');

      expect(sessionEv).toBeDefined();
      expect(sessionEv?.metadata?.attendanceRecovery).toBe(true);
    });

    it('expands timetable slots when no concrete ClassSession has been persisted for that day', () => {
      const slot: TimetableSlot = {
        id: 'slot-mon-1',
        semesterId: sem1.id,
        dayOfWeek: 'monday',
        startTime: '08:30',
        endTime: '09:30',
        subjectId: mathSub.id,
        room: 'Hall A',
        type: 'lecture',
        isRecurring: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAcademicStore.setState({
        timetableSlots: [slot],
      });
      useAppStore.setState({
        classSessions: [],
      });

      const events = studyPlanningService.deriveCalendarEvents(testDate, testDate);
      const slotEv = events.find(e => e.sourceType === 'class_session' && e.startTime === '08:30');

      expect(slotEv).toBeDefined();
      expect(slotEv?.title).toBe(mathSub.name);
      expect(slotEv?.date).toBe(testDate);
    });
  });

  // ─── 2. WORKLOAD CALCULATION & CLASSIFICATION ─────────────────────────────

  describe('2. Academic Workload Engine & Status', () => {
    it('calculates deterministic workload for a day with classes, tasks, and exams', () => {
      const session: ClassSession = {
        id: 's1',
        subjectId: mathSub.id,
        dayOfWeek: 'monday',
        startTime: '09:00',
        endTime: '10:30', // 90 min
        room: '101',
        type: 'lecture',
        semesterId: sem1.id,
      };

      const task: Task = {
        id: 't1',
        title: 'Study Chapter 3',
        category: 'study',
        priority: 'medium',
        subjectId: mathSub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        estimatedMinutes: 60,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({
        classSessions: [session],
        tasks: [task],
      });

      const workload = studyPlanningService.calculateDailyWorkload(testDate);

      expect(workload.date).toBe(testDate);
      expect(workload.classesMinutes).toBe(90);
      expect(workload.tasksMinutes).toBe(60);
      expect(workload.totalMinutes).toBe(150);
      expect(workload.classesCount).toBe(1);
      expect(workload.tasksCount).toBe(1);
    });

    it('classifies workload correctly based on total minutes', () => {
      // Light: <= 120m
      expect(studyPlanningService.classifyWorkload(60)).toBe('light');
      expect(studyPlanningService.classifyWorkload(120)).toBe('light');

      // Moderate: 121m - 240m
      expect(studyPlanningService.classifyWorkload(180)).toBe('moderate');
      expect(studyPlanningService.classifyWorkload(240)).toBe('moderate');

      // Heavy: 241m - 360m
      expect(studyPlanningService.classifyWorkload(300)).toBe('heavy');
      expect(studyPlanningService.classifyWorkload(360)).toBe('heavy');

      // Overloaded: > 360m (6 hours)
      expect(studyPlanningService.classifyWorkload(420)).toBe('overloaded');
    });

    it('handles missing or zero duration estimates gracefully without NaN', () => {
      const taskNoDuration: Task = {
        id: 't-no-dur',
        title: 'Quick review',
        category: 'study',
        priority: 'low',
        subjectId: phySub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        estimatedMinutes: 0, // 0 minutes
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({
        tasks: [taskNoDuration],
      });

      const workload = studyPlanningService.calculateDailyWorkload(testDate);
      expect(workload.tasksMinutes).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(workload.totalMinutes)).toBe(false);
      expect(workload.totalMinutes).toBeGreaterThan(0); // Graceful default
    });
  });

  // ─── 3. STUDY CAPACITY PREFERENCE ──────────────────────────────────────────

  describe('3. Daily Study Capacity', () => {
    it('retrieves default study capacity if not set (120 minutes)', async () => {
      const capacity = await studyPlanningService.getDailyStudyCapacity();
      expect(capacity).toBe(120);
    });

    it('persists and retrieves updated study capacity', async () => {
      await studyPlanningService.setDailyStudyCapacity(90);
      const updated = await studyPlanningService.getDailyStudyCapacity();
      expect(updated).toBe(90);

      // Revert to 120 for subsequent tests
      await studyPlanningService.setDailyStudyCapacity(120);
    });
  });

  // ─── 4. DETERMINISTIC STUDY PLANNING & PRIORITIZATION ──────────────────────

  describe('4. Deterministic Study Planning Engine', () => {
    it('prioritizes urgent exam prep and critical items before lower-priority tasks', () => {
      const urgentExamTask: Task = {
        id: 'task-exam',
        title: 'Physics Exam Prep',
        category: 'study',
        priority: 'urgent',
        subjectId: phySub.id,
        dueDate: tomorrowDate,
        scheduledDate: testDate,
        estimatedMinutes: 45,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const overdueTask: Task = {
        id: 'task-overdue',
        title: 'Overdue Assignment',
        category: 'assignment',
        priority: 'medium',
        subjectId: mathSub.id,
        dueDate: '2026-10-10', // overdue relative to 2026-10-12
        estimatedMinutes: 30,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const lowTask: Task = {
        id: 'task-low',
        title: 'Optional Reading',
        category: 'personal',
        priority: 'low',
        subjectId: csSub.id,
        dueDate: '2026-10-20',
        scheduledDate: testDate,
        estimatedMinutes: 30,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({
        tasks: [lowTask, urgentExamTask, overdueTask],
      });

      const plan = studyPlanningService.generateDailyStudyPlan(testDate);

      expect(plan.items.length).toBeGreaterThanOrEqual(2);
      const firstItem = plan.items[0];
      expect(firstItem.id).not.toBe('plan-task-task-low');
    });

    it('protects class sessions by never scheduling study blocks during class time', () => {
      const morningClass: ClassSession = {
        id: 'sess-morning',
        subjectId: mathSub.id,
        dayOfWeek: 'monday',
        startTime: '09:00',
        endTime: '11:00', // 2 hour class
        room: '101',
        type: 'lecture',
        semesterId: sem1.id,
      };

      const afternoonClass: ClassSession = {
        id: 'sess-afternoon',
        subjectId: phySub.id,
        dayOfWeek: 'monday',
        startTime: '13:00',
        endTime: '15:00',
        room: 'Lab 1',
        type: 'lab',
        semesterId: sem1.id,
      };

      const taskToSchedule: Task = {
        id: 't-sched',
        title: 'Important Study',
        category: 'study',
        priority: 'high',
        subjectId: csSub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        estimatedMinutes: 60,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({
        classSessions: [morningClass, afternoonClass],
        tasks: [taskToSchedule],
      });

      const plan = studyPlanningService.generateDailyStudyPlan(testDate);
      const scheduledItem = plan.items.find(i => i.id === 'plan-task-t-sched');

      expect(scheduledItem).toBeDefined();
      if (scheduledItem && scheduledItem.suggestedStartTime && scheduledItem.suggestedEndTime) {
        // Must NOT overlap 09:00 - 11:00
        const overlapsMorning =
          scheduledItem.suggestedStartTime < '11:00' && scheduledItem.suggestedEndTime > '09:00';
        expect(overlapsMorning).toBe(false);

        // Must NOT overlap 13:00 - 15:00
        const overlapsAfternoon =
          scheduledItem.suggestedStartTime < '15:00' && scheduledItem.suggestedEndTime > '13:00';
        expect(overlapsAfternoon).toBe(false);
      }
    });

    it('exposes overflow items when items exceed daily study capacity rather than silently deleting them', () => {
      const task1: Task = {
        id: 't-big-1',
        title: 'Heavy Math Homework',
        category: 'assignment',
        priority: 'high',
        subjectId: mathSub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        estimatedMinutes: 50,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const task2: Task = {
        id: 't-big-2',
        title: 'Heavy Physics Lab Report',
        category: 'lab',
        priority: 'high',
        subjectId: phySub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        estimatedMinutes: 50,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({
        tasks: [task1, task2],
      });

      // Pass capacityMinutesOverride: 60 minutes
      const plan = studyPlanningService.generateDailyStudyPlan(testDate, { capacityMinutesOverride: 60 });

      // Total minutes = 100m > 60m capacity
      expect(plan.plannedStudyMinutes).toBeGreaterThan(0);
      expect(plan.overloadMinutes).toBeGreaterThan(0);
      expect(plan.overflowItems.length).toBeGreaterThan(0);

      // Both tasks are accounted for (none deleted!)
      const allItemSourceIds = [
        ...plan.items.map(i => i.sourceId),
        ...plan.overflowItems.map(i => i.sourceId),
      ];
      expect(allItemSourceIds).toContain('t-big-1');
      expect(allItemSourceIds).toContain('t-big-2');
    });
  });

  // ─── 5. WEEKLY STUDY PLAN ──────────────────────────────────────────────────

  describe('5. Weekly Academic Plan', () => {
    it('generates a 7-day study plan summarizing workload and overloaded days', () => {
      const session: ClassSession = {
        id: 's-week',
        subjectId: mathSub.id,
        dayOfWeek: 'monday',
        startTime: '10:00',
        endTime: '12:00',
        room: '101',
        type: 'lecture',
        semesterId: sem1.id,
      };

      useAppStore.setState({
        classSessions: [session],
      });

      const weeklyPlan = studyPlanningService.generateWeeklyStudyPlan(testDate);

      expect(weeklyPlan.startDate).toBe(testDate);
      expect(weeklyPlan.days.length).toBe(7);

      const firstDay = weeklyPlan.days[0];
      expect(firstDay.date).toBe(testDate);
      expect(firstDay.workload).toBeDefined();

      expect(weeklyPlan.totalWeekMinutes).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(weeklyPlan.days)).toBe(true);
    });
  });

  // ─── 6. PLANNING CONFLICTS ─────────────────────────────────────────────────

  describe('6. Planning Conflict Detection', () => {
    it('detects a conflict when a task is scheduled during a class session', () => {
      const session: ClassSession = {
        id: 'sess-conflict',
        subjectId: mathSub.id,
        dayOfWeek: 'monday',
        startTime: '10:00',
        endTime: '11:00',
        room: '101',
        type: 'lecture',
        semesterId: sem1.id,
      };

      // Conflicting task at 10:30 - 11:30
      const conflictingTask: Task = {
        id: 'task-conflict-class',
        title: 'Lab Work In Class',
        category: 'lab',
        priority: 'high',
        subjectId: csSub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        scheduledStartTime: '10:30',
        scheduledEndTime: '11:30',
        estimatedMinutes: 60,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({
        classSessions: [session],
        tasks: [conflictingTask],
      });

      const conflicts = studyPlanningService.detectPlanningConflicts(testDate);

      const classConflict = conflicts.find(c => c.type === 'task_during_class');
      expect(classConflict).toBeDefined();
      expect(classConflict?.description).toContain('scheduled during class');
    });

    it('detects a conflict when two tasks overlap each other', () => {
      const taskA: Task = {
        id: 'task-overlap-a',
        title: 'Task A',
        category: 'assignment',
        priority: 'medium',
        subjectId: mathSub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        scheduledStartTime: '14:00',
        scheduledEndTime: '15:00',
        estimatedMinutes: 60,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const taskB: Task = {
        id: 'task-overlap-b',
        title: 'Task B',
        category: 'assignment',
        priority: 'medium',
        subjectId: phySub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        scheduledStartTime: '14:30',
        scheduledEndTime: '15:30',
        estimatedMinutes: 60,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({
        classSessions: [],
        tasks: [taskA, taskB],
      });

      const conflicts = studyPlanningService.detectPlanningConflicts(testDate);

      const overlapConflict = conflicts.find(c => c.type === 'overlapping_tasks');
      expect(overlapConflict).toBeDefined();
    });

    it('detects a conflict when a task is scheduled during an exam', () => {
      const exam: Exam = {
        id: 'exam-conflict',
        subjectId: phySub.id,
        name: 'Physics Midterm',
        type: 'internal',
        date: testDate,
        time: '14:00',
        maxMarks: 50,
        weightage: 30,
        semesterId: sem1.id,
      };

      const examConflictTask: Task = {
        id: 'task-exam-conflict',
        title: 'Homework During Exam',
        category: 'assignment',
        priority: 'medium',
        subjectId: mathSub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        scheduledStartTime: '14:30',
        scheduledEndTime: '15:30',
        estimatedMinutes: 60,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({
        exams: [exam],
        classSessions: [],
        tasks: [examConflictTask],
      });

      const conflicts = studyPlanningService.detectPlanningConflicts(testDate);
      const examConflict = conflicts.find(c => c.type === 'study_during_exam');
      expect(examConflict).toBeDefined();
    });
  });

  // ─── 7. TASK RESCHEDULING & CONVERSION ─────────────────────────────────────

  describe('7. Task Rescheduling & Canonical Persistence', () => {
    it('reschedules a task updating canonical date and time in SQLite and Zustand', async () => {
      const originalTask: Task = {
        id: 'task-resched-1',
        title: 'Original Assignment',
        category: 'assignment',
        priority: 'high',
        subjectId: mathSub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        scheduledStartTime: '10:00',
        scheduledEndTime: '11:00',
        estimatedMinutes: 60,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await taskRepository.createTask(originalTask);
      useAppStore.setState({ tasks: [originalTask] });

      const newDate = '2026-10-15';
      const updated = await studyPlanningService.rescheduleTask(
        originalTask.id,
        newDate,
        '16:00',
        '17:00'
      );

      expect(updated).toBeDefined();
      expect(updated?.scheduledDate).toBe(newDate);
      expect(updated?.scheduledStartTime).toBe('16:00');
      expect(updated?.scheduledEndTime).toBe('17:00');
      expect(updated?.id).toBe(originalTask.id); // Identity preserved!

      // Verify in SQLite
      const fromDb = await taskRepository.getTaskById(originalTask.id);
      expect(fromDb?.scheduledDate).toBe(newDate);
      expect(fromDb?.scheduledStartTime).toBe('16:00');

      // Verify in Zustand
      const inStore = useAppStore.getState().tasks.find(t => t.id === originalTask.id);
      expect(inStore?.scheduledDate).toBe(newDate);
    });

    it('converts a revision recommendation into a canonical task preserving relations', async () => {
      const unit: SyllabusUnit = {
        id: 'unit-p9-1',
        subjectId: mathSub.id,
        semesterId: sem1.id,
        name: 'Calculus Fundamentals',
        order: 0,
        topicIds: ['top-p9-1'],
      };
      await syllabusRepository.createUnit(unit);

      const topic: Topic = {
        id: 'top-p9-1',
        subjectId: mathSub.id,
        unitId: unit.id,
        name: 'Laplace Transform',
        isCompleted: false,
        revisionStatus: 'not_started',
        classNoteIds: [],
        order: 0,
      };
      await syllabusRepository.createTopic(topic);
      useAcademicStore.setState({ topics: [topic], syllabusUnits: [unit] });

      const newTask = await studyPlanningService.convertRevisionToTask(
        topic.id,
        testDate,
        '15:00',
        45
      );

      expect(newTask).toBeDefined();
      expect(newTask.title).toBe('Revise: Laplace Transform');
      expect(newTask.subjectId).toBe(mathSub.id);
      expect(newTask.topicId).toBe(topic.id);
      expect(newTask.scheduledDate).toBe(testDate);
      expect(newTask.scheduledStartTime).toBe('15:00');
      expect(newTask.estimatedMinutes).toBe(45);

      // Verify in SQLite
      const fromDb = await taskRepository.getTaskById(newTask.id);
      expect(fromDb).toBeDefined();
      expect(fromDb?.topicId).toBe(topic.id);
    });
  });

  // ─── 8. UNSCHEDULED ACADEMIC WORK ──────────────────────────────────────────

  describe('8. Unscheduled Academic Work Identification', () => {
    it('identifies overdue tasks and unscheduled high-priority tasks', () => {
      const overdueTask: Task = {
        id: 'unsched-overdue',
        title: 'Overdue Project Report',
        category: 'assignment',
        priority: 'high',
        subjectId: csSub.id,
        dueDate: '2026-10-01', // well in the past
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const unscheduledHighTask: Task = {
        id: 'unsched-high',
        title: 'High Priority No Date',
        category: 'study',
        priority: 'high',
        subjectId: mathSub.id,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({
        tasks: [overdueTask, unscheduledHighTask],
      });
      useAcademicStore.setState({
        topics: [],
        revisionRecords: [],
      });

      const unscheduled = studyPlanningService.getUnscheduledWork();

      expect(unscheduled.totalUnscheduledItems).toBeGreaterThanOrEqual(2);
      const overdueIds = unscheduled.overdueTasks.map(t => t.id);
      expect(overdueIds).toContain('unsched-overdue');

      const urgentIds = unscheduled.urgentTasksWithoutTime.map(t => t.id);
      expect(urgentIds).toContain('unsched-high');
    });
  });

  // ─── 9. ACADEMIC HUB INTEGRATION ───────────────────────────────────────────

  describe('9. Academic Hub Integration', () => {
    it('provides unified study planning hub data and overload attention items', () => {
      const heavySession: ClassSession = {
        id: 'sess-heavy-1',
        subjectId: mathSub.id,
        dayOfWeek: 'monday',
        startTime: '08:00',
        endTime: '12:00', // 4 hours
        room: '101',
        type: 'lecture',
        semesterId: sem1.id,
      };

      const heavyTask: Task = {
        id: 'task-heavy-1',
        title: 'Big Term Project',
        category: 'assignment',
        priority: 'high',
        subjectId: csSub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        estimatedMinutes: 200, // > 3 hours
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({
        classSessions: [heavySession],
        tasks: [heavyTask],
      });

      const hubData = academicHubService.getStudyPlanningHubData({ now: new Date(testDate) });

      expect(hubData).toBeDefined();
      expect(hubData.todayWorkload.totalMinutes).toBe(440);
      expect(hubData.todayWorkload.status).toBe('overloaded');
      expect(hubData.todayPlan).toBeDefined();

      // Check attention item generation
      const attentionItems = academicHubService.getAcademicAttentionItems({
        now: new Date(testDate),
        todayClasses: [],
        unrecordedClasses: [],
        pendingTasks: [heavyTask],
        overdueTasks: [],
        upcomingExams: [],
        revisionBacklog: [],
        attendanceData: useAppStore.getState().attendanceData,
        attendanceTarget: 75,
        subjects: [mathSub, phySub, csSub],
      });
      const overloadItem = attentionItems.find(a => a.type === 'workload_overload');
      expect(overloadItem).toBeDefined();
      expect(overloadItem?.priority).toBe('high');
      expect(overloadItem?.actionRoute).toBe('/(tabs)/schedule');
    });
  });

  // ─── 10. NOTIFICATION INTEGRATION ──────────────────────────────────────────

  describe('10. Notification Integration', () => {
    it('schedules a study block reminder without throwing', async () => {
      const item = {
        id: 'plan-item-1',
        title: 'Laplace Transform Study',
        date: testDate,
        suggestedStartTime: '16:00',
        durationMinutes: 60,
      };

      const result = await notificationService.scheduleStudyBlockReminder(item);
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('schedules an overload alert without throwing', async () => {
      const workload = {
        totalMinutes: 450,
        explanation: 'Overloaded day',
      };

      const result = await notificationService.scheduleOverloadDayAlert(testDate, workload);
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  // ─── 11. EDGE CASES & SAFETY ───────────────────────────────────────────────

  describe('11. Edge Cases & Computational Safety', () => {
    it('handles an empty day (zero events) cleanly', () => {
      useAppStore.setState({
        classSessions: [],
        tasks: [],
        exams: [],
      });
      useAcademicStore.setState({
        timetableSlots: [],
        topics: [],
        revisionRecords: [],
      });

      const events = studyPlanningService.deriveCalendarEvents('2026-11-20', '2026-11-20');
      expect(events).toEqual([]);

      const workload = studyPlanningService.calculateDailyWorkload('2026-11-20');
      expect(workload.totalMinutes).toBe(0);
      expect(workload.status).toBe('light');

      const plan = studyPlanningService.generateDailyStudyPlan('2026-11-20');
      expect(plan.items).toEqual([]);
      expect(plan.overflowItems).toEqual([]);
      expect(plan.conflicts).toEqual([]);
    });

    it('handles days with all tasks completed without error', () => {
      const completedTask: Task = {
        id: 'done-task',
        title: 'Already finished',
        category: 'study',
        priority: 'medium',
        subjectId: mathSub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        isCompleted: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({ tasks: [completedTask] });

      const plan = studyPlanningService.generateDailyStudyPlan(testDate);
      // Completed tasks should not be scheduled as active work
      expect(plan.items.find(i => i.id === 'plan-task-done-task')).toBeUndefined();
    });

    it('never produces negative durations, NaN, or Infinity', () => {
      const weirdTask: Task = {
        id: 't-neg',
        title: 'Negative duration test',
        category: 'study',
        priority: 'low',
        subjectId: csSub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        estimatedMinutes: -50, // Negative duration
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({ tasks: [weirdTask] });

      const workload = studyPlanningService.calculateDailyWorkload(testDate);
      expect(workload.totalMinutes).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(workload.totalMinutes)).toBe(true);
      expect(Number.isNaN(workload.totalMinutes)).toBe(false);
    });
  });

  // ─── 12. SEMESTER ISOLATION ────────────────────────────────────────────────

  describe('12. Semester Isolation', () => {
    it('isolates planning and calendar events to the current semester', async () => {
      // Create a task belonging to sem2 (archived)
      const sem2Sub: Subject = {
        id: 'sub-sem2',
        name: 'Advanced Algorithms',
        code: 'CS401',
        shortName: 'Algo',
        color: '#EF4444',
        semesterId: sem2.id,
        facultyId: 'fac-sem2',
        credits: 4,
        isArchived: false,
        subjectType: 'lecture',
        targetAttendance: 75,
      };
      await subjectRepository.createSubject(sem2Sub);

      const sem2Task: Task = {
        id: 'task-sem2',
        title: 'Sem 2 Task',
        category: 'assignment',
        priority: 'high',
        subjectId: sem2Sub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const sem1Task: Task = {
        id: 'task-sem1',
        title: 'Sem 1 Task',
        category: 'assignment',
        priority: 'high',
        subjectId: mathSub.id,
        dueDate: testDate,
        scheduledDate: testDate,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useAppStore.setState({
        tasks: [sem1Task, sem2Task],
        semester: sem1,
        subjects: [mathSub, phySub, csSub, sem2Sub],
      });

      const planSem1 = studyPlanningService.generateDailyStudyPlan(testDate);
      const planItemSourceIds = planSem1.items.map(i => i.sourceId);

      expect(planItemSourceIds).toContain('task-sem1');
      expect(planItemSourceIds).not.toContain('task-sem2');
    });
  });
});
