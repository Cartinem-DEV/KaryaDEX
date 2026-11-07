/**
 * BunkMatKar — Phase 2 Persistence & Database Integration Tests
 *
 * Verifies:
 *   1. Database initialization & schema migrations
 *   2. Idempotent mock data seeding
 *   3. Hydration into useAppStore and useAcademicStore
 *   4. State mutation persistence to SQLite
 *   5. Persistence survival across simulated app restart / rehydration
 */

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  seedMockDataIfNeeded,
  timetableRepository,
  classSessionRepository,
  attendanceRepository,
  taskRepository,
  syllabusRepository,
  examRepository,
  assessmentRepository,
  resourceRepository,
  subjectRepository,
  settingsRepository,
} from '../database';
import { useAppStore } from '../store/useAppStore';
import { useAcademicStore } from '../store/useAcademicStore';

describe('Phase 2: Database Persistence & Integration', () => {
  beforeAll(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();
  });

  describe('1. Database Initialization & Schema', () => {
    it('initializes database and creates tables without error', async () => {
      const db = await initDatabase();
      expect(db).toBeDefined();
    });

    it('creates schema version setting', async () => {
      const version = await settingsRepository.getSetting('schema_version');
      expect(Number(version)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. Seeding Integrity & Idempotency', () => {
    it('seeds mock data on first launch', async () => {
      const result = await seedMockDataIfNeeded();
      expect(result.seeded).toBe(true);

      const flag = await settingsRepository.getSetting('data_seeded');
      expect(flag).toBe('1');
    });

    it('is idempotent — second call does not re-seed or duplicate', async () => {
      const result = await seedMockDataIfNeeded();
      expect(result.seeded).toBe(false);

      const subjects = await subjectRepository.getSubjects();
      expect(subjects.length).toBeGreaterThan(0);
    });
  });

  describe('3. Repository Queries & Relations', () => {
    it('retrieves student, college, and semester', async () => {
      const student = await subjectRepository.getStudent();
      const college = await subjectRepository.getCollege();
      const semester = await subjectRepository.getSemester();

      expect(student).not.toBeNull();
      expect(student?.name).toBe('Saikat');
      expect(college?.shortName).toBe('EIT');
      expect(semester?.name).toBe('Semester 3');
    });

    it('retrieves timetable slots and filters by day and subject', async () => {
      const slots = await timetableRepository.getTimetableSlots();
      expect(slots.length).toBeGreaterThan(0);

      const mondaySlots = await timetableRepository.getSlotsForDay('monday');
      expect(mondaySlots.every(s => s.dayOfWeek === 'monday')).toBe(true);
    });

    it('retrieves syllabus units and topics', async () => {
      const units = await syllabusRepository.getAllUnits();
      const topics = await syllabusRepository.getAllTopics();

      expect(units.length).toBeGreaterThan(0);
      expect(topics.length).toBeGreaterThan(0);
    });

    it('retrieves attendance aggregates', async () => {
      const aggregates = await attendanceRepository.getAllAggregates();
      expect(Object.keys(aggregates).length).toBeGreaterThan(0);
      expect(aggregates['sub-1']).toBeDefined();
    });
  });

  describe('4. Store Persistence on Mutation', () => {
    it('persists newly added task to SQLite repository', async () => {
      const initialTasks = await taskRepository.getTasks();
      const initialCount = initialTasks.length;

      useAppStore.getState().addTask({
        title: 'Complete Graph Algorithm Assignment',
        subjectId: 'sub-1',
        category: 'assignment',
        priority: 'high',
        dueDate: '2026-10-15',
        estimatedMinutes: 120,
        isCompleted: false,
      });

      // Wait brief tick for async repository save
      await new Promise(r => setTimeout(r, 50));

      const updatedTasks = await taskRepository.getTasks();
      expect(updatedTasks.length).toBe(initialCount + 1);
      expect(updatedTasks.some(t => t.title === 'Complete Graph Algorithm Assignment')).toBe(true);
    });

    it('persists newly added timetable slot to SQLite repository', async () => {
      const initialSlots = await timetableRepository.getTimetableSlots(false);
      const initialCount = initialSlots.length;

      const created = useAcademicStore.getState().addTimetableSlot({
        subjectId: 'sub-1',
        semesterId: 'sem-3',
        dayOfWeek: 'friday',
        startTime: '14:00',
        endTime: '15:00',
        room: 'Lab 4',
        type: 'lab',
        isRecurring: true,
      });

      await new Promise(r => setTimeout(r, 50));

      const persisted = await timetableRepository.getTimetableSlotById(created.id);
      expect(persisted).not.toBeNull();
      expect(persisted?.room).toBe('Lab 4');
    });

    it('persists class note upsert to SQLite repository', async () => {
      const note = useAcademicStore.getState().upsertClassNote({
        classSessionId: 'ts-test-session',
        date: '2026-10-04',
        subjectId: 'sub-1',
        myNotes: 'Graph BFS and DFS implementation discussed in class.',
        attendanceStatus: 'present',
      });

      await new Promise(r => setTimeout(r, 50));

      const fetched = await classSessionRepository.getClassNote('ts-test-session', '2026-10-04');
      expect(fetched).not.toBeNull();
      expect(fetched?.myNotes).toBe('Graph BFS and DFS implementation discussed in class.');
    });

    it('persists assessment creation to SQLite repository', async () => {
      const initial = await assessmentRepository.getAllAssessments();
      const initialCount = initial.length;

      useAcademicStore.getState().addAssessment({
        subjectId: 'sub-1',
        semesterId: 'sem-3',
        name: 'Midsem Quiz 1',
        type: 'quiz',
        marksObtained: 28,
        marksMax: 30,
        weightage: 10,
        date: '2026-10-10',
      });

      await new Promise(r => setTimeout(r, 50));

      const updated = await assessmentRepository.getAllAssessments();
      expect(updated.length).toBe(initialCount + 1);
    });
  });

  describe('5. App Restart & Rehydration Simulation', () => {
    it('re-hydrates both stores from SQLite preserving persisted data', async () => {
      // 1. Wipe stores in memory to simulate app being killed
      useAppStore.setState({
        isAuthenticated: false,
        user: null,
        subjects: [],
        tasks: [],
        attendanceData: {},
      });

      useAcademicStore.setState({
        timetableSlots: [],
        classNotes: [],
        topics: [],
        syllabusUnits: [],
        assessments: [],
      });

      expect(useAppStore.getState().subjects.length).toBe(0);
      expect(useAcademicStore.getState().timetableSlots.length).toBe(0);

      // 2. Simulate startup hydration flow from DatabaseProvider
      const [college, semester, user, subjects, attendanceData, tasks, exams] =
        await Promise.all([
          subjectRepository.getCollege(),
          subjectRepository.getSemester(),
          subjectRepository.getStudent(),
          subjectRepository.getSubjects(),
          attendanceRepository.getAllAggregates(),
          taskRepository.getTasks(),
          examRepository.getExams(),
        ]);

      if (user) {
        useAppStore.setState({
          isAuthenticated: true,
          isDemoMode: true,
          user,
          college,
          semester,
          subjects,
          attendanceData,
          tasks,
          exams,
          attendanceTarget: user.attendanceTarget,
        });
      }

      const [
        timetableSlots,
        classNotes,
        topics,
        syllabusUnits,
        examTopics,
        resources,
        assessments,
        taskRelations,
      ] = await Promise.all([
        timetableRepository.getTimetableSlots(false),
        classSessionRepository.getAllClassNotes(),
        syllabusRepository.getAllTopics(),
        syllabusRepository.getAllUnits(),
        examRepository.getAllExamTopics(),
        resourceRepository.getAllResources(),
        assessmentRepository.getAllAssessments(),
        taskRepository.getAllTaskRelations(),
      ]);

      useAcademicStore.setState({
        timetableSlots,
        classNotes,
        topics,
        syllabusUnits,
        examTopics,
        resources,
        assessments,
        taskRelations,
      });

      // 3. Verify stores are fully restored
      expect(useAppStore.getState().isAuthenticated).toBe(true);
      expect(useAppStore.getState().user?.name).toBe('Saikat');
      expect(useAppStore.getState().subjects.length).toBeGreaterThan(0);
      expect(useAppStore.getState().tasks.some(t => t.title === 'Complete Graph Algorithm Assignment')).toBe(true);

      expect(useAcademicStore.getState().timetableSlots.length).toBeGreaterThan(0);
      expect(useAcademicStore.getState().classNotes.some(n => n.classSessionId === 'ts-test-session')).toBe(true);
      expect(useAcademicStore.getState().assessments.some(a => a.name === 'Midsem Quiz 1')).toBe(true);
    });
  });
});
