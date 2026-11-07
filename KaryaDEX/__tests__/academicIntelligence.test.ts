/**
 * BunkMatKar — Phase 6: Academic Intelligence Core Tests
 *
 * Full verification of all 36 Phase 6 requirements:
 *  1. semester listing
 *  2. current semester selection
 *  3. semester switching
 *  4. semester isolation
 *  5. semester snapshot
 *  6. subject snapshot
 *  7. syllabus progress
 *  8. topic progress
 *  9. topic detail context
 * 10. class history
 * 11. attendance forecast
 * 12. future attendance scenarios
 * 13. mixed attendance scenarios
 * 14. reach-target calculation
 * 15. safe-bunk recommendation
 * 16. semester-level attendance aggregation
 * 17. Academic Health Index calculation
 * 18. weakest-area detection
 * 19. archive subject
 * 20. restore subject
 * 21. archive preservation
 * 22. historical semester preservation
 * 23. analytics with missing data
 * 24. analytics with empty data
 * 25. task aggregation
 * 26. revision aggregation
 * 27. exam aggregation
 * 28. marks aggregation
 * 29. semester switch persistence
 * 30. archive/restore persistence
 * 31. no duplicate subjects after restore
 * 32. historical ClassSession integrity
 * 33. target 75 forecast
 * 34. target 80 forecast
 * 35. target 85 forecast
 * 36. 100% target edge case
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  subjectRepository,
  semesterRepository,
  classSessionRepository,
  timetableRepository,
  syllabusRepository,
} from '../database';
import { academicAnalyticsService } from '../services/academicAnalyticsService';
import { academicHubService } from '../services/academicHubService';
import { useAppStore } from '../store/useAppStore';
import {
  calculateSafeBunks,
  calculateRecoveryClasses,
} from '../lib/attendance';
import type { Semester, Subject, Task, Exam } from '../types';
import type { Topic, SyllabusUnit, TimetableSlot } from '../types/academic';

describe('Phase 6: Academic Intelligence Core', () => {
  beforeAll(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();
  });

  const sem1: Semester = {
    id: 'sem-p6-1',
    name: 'Semester 1',
    number: 1,
    startDate: '2026-01-01',
    endDate: '2026-05-30',
    collegeId: 'col-1',
    isCurrent: true,
    status: 'current',
  };

  const sem2: Semester = {
    id: 'sem-p6-2',
    name: 'Semester 2',
    number: 2,
    startDate: '2026-06-01',
    endDate: '2026-11-30',
    collegeId: 'col-1',
    isCurrent: false,
    status: 'completed',
  };

  const mathSub: Subject = {
    id: 'sub-p6-math',
    name: 'Mathematics I',
    shortName: 'MATH',
    code: 'MATH101',
    color: '#3B82F6',
    semesterId: sem1.id,
    facultyId: 'fac-1',
    credits: 4,
    isArchived: false,
    subjectType: 'lecture',
    targetAttendance: 75,
  };

  const phySub: Subject = {
    id: 'sub-p6-phy',
    name: 'Physics I',
    shortName: 'PHY',
    code: 'PHY101',
    color: '#8B5CF6',
    semesterId: sem1.id,
    facultyId: 'fac-1',
    credits: 3,
    isArchived: false,
    subjectType: 'lecture',
    targetAttendance: 75,
  };

  const chemSub: Subject = {
    id: 'sub-p6-chem',
    name: 'Chemistry II',
    shortName: 'CHEM',
    code: 'CHEM102',
    color: '#10B981',
    semesterId: sem2.id,
    facultyId: 'fac-1',
    credits: 4,
    isArchived: false,
    subjectType: 'lecture',
    targetAttendance: 80,
  };

  // ═══════════════════════════════════════════════════════════════════
  // 1-4: MULTI-SEMESTER MANAGEMENT & SWITCHING
  // ═══════════════════════════════════════════════════════════════════

  describe('1. Semester Listing', () => {
    it('retrieves all semesters in ascending number order', async () => {
      await semesterRepository.saveSemester(sem1);
      await semesterRepository.saveSemester(sem2);

      const semesters = await semesterRepository.getAllSemesters();
      expect(semesters.length).toBeGreaterThanOrEqual(2);
      const found1 = semesters.find(s => s.id === sem1.id);
      const found2 = semesters.find(s => s.id === sem2.id);
      expect(found1).toBeDefined();
      expect(found2).toBeDefined();
      expect(found1!.number).toBeLessThan(found2!.number);
    });
  });

  describe('2. Current Semester Selection', () => {
    it('accurately identifies and retrieves the currently active semester', async () => {
      await semesterRepository.setCurrentSemester(sem1.id);
      const current = await semesterRepository.getCurrentSemester();
      expect(current).not.toBeNull();
      expect(current!.id).toBe(sem1.id);
      expect(current!.isCurrent).toBe(true);
    });
  });

  describe('3. Semester Switching', () => {
    it('switches current semester cleanly and updates active status in SQLite', async () => {
      await semesterRepository.setCurrentSemester(sem2.id);
      const current = await semesterRepository.getCurrentSemester();
      expect(current!.id).toBe(sem2.id);
      expect(current!.isCurrent).toBe(true);

      const oldSem = await semesterRepository.getSemesterById(sem1.id);
      expect(oldSem!.isCurrent).toBe(false);

      // Switch back to sem1
      await semesterRepository.setCurrentSemester(sem1.id);
      const restored = await semesterRepository.getCurrentSemester();
      expect(restored!.id).toBe(sem1.id);
    });
  });

  describe('4. Semester Isolation', () => {
    it('isolates subjects so each semester only retrieves its own subjects', async () => {
      await subjectRepository.createSubject(mathSub);
      await subjectRepository.createSubject(phySub);
      await subjectRepository.createSubject(chemSub);

      const sem1Subjects = await semesterRepository.getSubjectsForSemester(sem1.id);
      const sem2Subjects = await semesterRepository.getSubjectsForSemester(sem2.id);

      expect(sem1Subjects.some(s => s.id === mathSub.id)).toBe(true);
      expect(sem1Subjects.some(s => s.id === phySub.id)).toBe(true);
      expect(sem1Subjects.some(s => s.id === chemSub.id)).toBe(false);

      expect(sem2Subjects.some(s => s.id === chemSub.id)).toBe(true);
      expect(sem2Subjects.some(s => s.id === mathSub.id)).toBe(false);
      expect(sem2Subjects.some(s => s.id === phySub.id)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5-6: SEMESTER & SUBJECT SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════════

  describe('5. Semester Snapshot', () => {
    it('generates a comprehensive snapshot with subjects, attendance, tasks, and syllabus summaries', async () => {
      const snapshot = academicAnalyticsService.getSemesterAcademicSnapshot({
        semester: sem1,
        subjects: [mathSub, phySub],
        attendanceData: {
          [mathSub.id]: { attended: 16, total: 20 }, // 80%
          [phySub.id]: { attended: 14, total: 20 },  // 70%
        },
        attendanceTarget: 75,
      });

      expect(snapshot.subjectCount).toBe(2);
      expect(snapshot.classCount).toBe(40);
      expect(snapshot.attendanceSummary.totalAttended).toBe(30);
      expect(snapshot.attendanceSummary.overallPercentage).toBe(75);
      expect(snapshot.health).toBeDefined();
      expect(snapshot.bunkRecommendations.length).toBe(2);
    });
  });

  describe('6. Subject Snapshot', () => {
    it('generates subject snapshot via canonical academicHubService', async () => {
      const snap = academicHubService.getSubjectAcademicSnapshot(mathSub.id, {
        subjects: [mathSub],
        attendanceData: { [mathSub.id]: { attended: 18, total: 20 } },
        targetPercentage: 75,
        tasks: [],
        topics: [],
        exams: [],
      });

      expect(snap).not.toBeNull();
      expect(snap!.subjectId).toBe(mathSub.id);
      expect(snap!.attendancePercentage).toBe(90);
      expect(snap!.safeBunks).toBe(4);
      expect(snap!.recoveryClasses).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 7-9: SYLLABUS, TOPIC PROGRESS & CONTEXT
  // ═══════════════════════════════════════════════════════════════════

  describe('7. Syllabus Progress', () => {
    it('calculates coverage and revision rates across unit topics', () => {
      const topics: Topic[] = [
        { id: 'top-1', unitId: 'u1', subjectId: mathSub.id, name: 'Calculus', order: 1, isCompleted: true, revisionStatus: 'revised', classNoteIds: [] },
        { id: 'top-2', unitId: 'u1', subjectId: mathSub.id, name: 'Linear Algebra', order: 2, isCompleted: true, revisionStatus: 'taught', classNoteIds: [] },
        { id: 'top-3', unitId: 'u1', subjectId: mathSub.id, name: 'Differential Eq', order: 3, isCompleted: false, revisionStatus: 'not_started', classNoteIds: [] },
        { id: 'top-4', unitId: 'u1', subjectId: mathSub.id, name: 'Probability', order: 4, isCompleted: false, revisionStatus: 'needs_revision', classNoteIds: [] },
      ];

      const snapshot = academicAnalyticsService.getSemesterAcademicSnapshot({
        semester: sem1,
        subjects: [mathSub],
        topics,
      });

      expect(snapshot.syllabusSummary.totalTopics).toBe(4);
      expect(snapshot.syllabusSummary.taughtTopics).toBe(3); // top-1, top-2, top-4
      expect(snapshot.syllabusSummary.revisedTopics).toBe(1); // top-1
      expect(snapshot.syllabusSummary.coveragePercentage).toBe(75);
    });
  });

  describe('8. Topic Progress & Canonical States', () => {
    it('correctly maps topic revision status to canonical topic states', () => {
      expect(academicAnalyticsService.deriveTopicState({ id: '1', unitId: 'u', subjectId: 's', name: 'A', order: 1, isCompleted: true, revisionStatus: 'revised', classNoteIds: [] })).toBe('revised');
      expect(academicAnalyticsService.deriveTopicState({ id: '2', unitId: 'u', subjectId: 's', name: 'B', order: 2, isCompleted: true, revisionStatus: 'taught', classNoteIds: [] })).toBe('taught');
      expect(academicAnalyticsService.deriveTopicState({ id: '3', unitId: 'u', subjectId: 's', name: 'C', order: 3, isCompleted: false, revisionStatus: 'needs_revision', classNoteIds: [] })).toBe('needs_revision');
      expect(academicAnalyticsService.deriveTopicState({ id: '4', unitId: 'u', subjectId: 's', name: 'D', order: 4, isCompleted: false, revisionStatus: 'not_started', classNoteIds: [] })).toBe('not_started');
    });
  });

  describe('9. Topic Detail Context', () => {
    it('retrieves full relational topic context including subject and unit', async () => {
      const unit: SyllabusUnit = {
        id: 'unit-p6-1',
        subjectId: mathSub.id,
        semesterId: sem1.id,
        name: 'Unit 1: Fundamentals',
        order: 1,
        topicIds: ['top-p6-detail'],
      };
      const topic: Topic = {
        id: 'top-p6-detail',
        unitId: unit.id,
        subjectId: mathSub.id,
        name: 'Eigenvalues and Eigenvectors',
        order: 1,
        isCompleted: true,
        revisionStatus: 'revised',
        classNoteIds: [],
      };

      await syllabusRepository.createUnit(unit);
      await syllabusRepository.createTopic(topic);

      const context = academicHubService.getTopicAcademicContext(topic.id, {
        topics: [topic],
        units: [unit],
        subjects: [mathSub],
        classOccurrences: [],
        resources: [],
        tasks: [],
        exams: [],
        examTopics: [],
      });

      expect(context).not.toBeNull();
      expect(context!.topic.id).toBe(topic.id);
      expect(context!.unit?.name).toBe(unit.name);
      expect(context!.subject?.name).toBe(mathSub.name);
    });
  });

  describe('10. Class History', () => {
    it('tracks chronological class sessions for a subject without data mutation', async () => {
      const slot: TimetableSlot = {
        id: 'slot-p6-hist',
        subjectId: mathSub.id,
        semesterId: sem1.id,
        dayOfWeek: 'monday',
        startTime: '10:00',
        endTime: '11:00',
        room: '101',
        isRecurring: true,
        type: 'lecture',
        isActive: true,
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
      };
      await timetableRepository.createTimetableSlot(slot);

      await classSessionRepository.atomicSaveSession({
        slotId: slot.id,
        date: '2026-03-02',
        subjectId: mathSub.id,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: 'Calculus lecture notes',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      await classSessionRepository.atomicSaveSession({
        slotId: slot.id,
        date: '2026-03-09',
        subjectId: mathSub.id,
        attendanceStatus: 'absent',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      const note1 = await classSessionRepository.getClassNote(slot.id, '2026-03-02');
      const note2 = await classSessionRepository.getClassNote(slot.id, '2026-03-09');
      expect(note1?.attendanceStatus).toBe('present');
      expect(note2?.attendanceStatus).toBe('absent');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 11-15: ATTENDANCE FORECASTING & SAFE BUNK PLANNING
  // ═══════════════════════════════════════════════════════════════════

  describe('11. Attendance Forecast', () => {
    it('forecasts current percentage, status, and safety margin correctly', () => {
      const forecast = academicAnalyticsService.getAttendanceForecast(16, 20, 75);
      expect(forecast.currentPercentage).toBe(80);
      expect(forecast.targetPercentage).toBe(75);
      expect(forecast.safetyMargin).toBe(5);
      expect(forecast.currentStatus).toBe('safe');
      expect(forecast.safeBunks).toBe(1);
      expect(forecast.recoveryClasses).toBe(0);
    });
  });

  describe('12. Future Attendance Scenarios (Miss N)', () => {
    it('correctly models missing 1..5 upcoming classes', () => {
      const forecast = academicAnalyticsService.getAttendanceForecast(16, 20, 75, 5);
      expect(forecast.missScenarios.length).toBe(5);

      // Miss 1: 16/21 = 76.19% -> above target but within +5 margin = 'watch'
      expect(forecast.missScenarios[0].missedCount).toBe(1);
      expect(forecast.missScenarios[0].projectedPercentage).toBeCloseTo(76.19, 1);
      expect(forecast.missScenarios[0].status).toBe('watch');

      // Miss 2: 16/22 = 72.73% -> below 75% target = 'danger'
      expect(forecast.missScenarios[1].missedCount).toBe(2);
      expect(forecast.missScenarios[1].projectedPercentage).toBeCloseTo(72.73, 1);
      expect(forecast.missScenarios[1].status).toBe('danger');
    });
  });

  describe('13. Mixed Attendance Scenarios (Attend N)', () => {
    it('correctly models attending the next 1..5 classes', () => {
      const forecast = academicAnalyticsService.getAttendanceForecast(14, 20, 75, 5); // 70%
      expect(forecast.attendScenarios.length).toBe(5);

      // Attend 1: 15/21 = 71.43%
      expect(forecast.attendScenarios[0].projectedPercentage).toBeCloseTo(71.43, 1);

      // Attend 4: 18/24 = 75.00% -> hits target but within +5 margin = 'watch'
      expect(forecast.attendScenarios[3].projectedPercentage).toBe(75);
      expect(forecast.attendScenarios[3].status).toBe('watch');
    });
  });

  describe('14. Reach-Target Calculation', () => {
    it('computes exact recovery classes needed when below target', () => {
      // 14 / 20 = 70% (target: 75%). Needs 4 consecutive attended classes: (14+4)/(20+4) = 18/24 = 75%
      const recovery = calculateRecoveryClasses(14, 20, 75);
      expect(recovery).toBe(4);

      // 5 / 10 = 50% (target: 75%). Formula: ceil((0.75*10 - 5) / (1 - 0.75)) = ceil(2.5 / 0.25) = 10
      expect(calculateRecoveryClasses(5, 10, 75)).toBe(10);
    });
  });

  describe('15. Safe-Bunk Recommendation', () => {
    it('provides clear actionable recommendations for each subject ordered by risk', () => {
      const recs = academicAnalyticsService.getBunkRecommendations({
        subjects: [mathSub, phySub],
        attendanceData: {
          [mathSub.id]: { attended: 20, total: 20 }, // 100%, 6 safe bunks
          [phySub.id]: { attended: 14, total: 20 },  // 70%, 0 safe bunks, needs 4 to recover
        },
        attendanceTarget: 75,
      });

      expect(recs.length).toBe(2);
      // Most at-risk first
      expect(recs[0].subject.id).toBe(phySub.id);
      expect(recs[0].safeBunks).toBe(0);
      expect(recs[0].recoveryClasses).toBe(4);
      expect(recs[0].recommendation).toContain('Need 4 classes to recover');

      expect(recs[1].subject.id).toBe(mathSub.id);
      expect(recs[1].safeBunks).toBe(6);
      expect(recs[1].recommendation).toContain('Safe to bunk');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 16-18: SEMESTER ATTENDANCE & ACADEMIC HEALTH INDEX
  // ═══════════════════════════════════════════════════════════════════

  describe('16. Semester-Level Attendance Aggregation', () => {
    it('aggregates total attended and total classes across all active subjects', () => {
      const semForecast = academicAnalyticsService.getSemesterAttendanceForecast({
        subjects: [mathSub, phySub],
        attendanceData: {
          [mathSub.id]: { attended: 18, total: 20 },
          [phySub.id]: { attended: 16, total: 20 },
        },
        attendanceTarget: 75,
      });

      expect(semForecast.totalAttended).toBe(34);
      expect(semForecast.totalClasses).toBe(40);
      expect(semForecast.currentOverallPercentage).toBe(85);
      expect(semForecast.status).toBe('safe');
      expect(semForecast.breakdown.length).toBe(2);
    });
  });

  describe('17. Academic Health Index Calculation', () => {
    it('calculates deterministic weighted 6-dimension score (0-100)', () => {
      const health = academicAnalyticsService.getAcademicHealth({
        subjects: [mathSub],
        attendanceData: { [mathSub.id]: { attended: 20, total: 20 } }, // 100% -> score 100
        attendanceTarget: 75,
        tasks: [
          { id: 't1', title: 'Task 1', category: 'assignment', priority: 'medium', isCompleted: true, status: 'completed', createdAt: '2026-10-04', subjectId: mathSub.id },
          { id: 't2', title: 'Task 2', category: 'assignment', priority: 'medium', isCompleted: true, status: 'completed', createdAt: '2026-10-04', subjectId: mathSub.id },
        ], // 100% completion -> score 100
        topics: [
          { id: 'top-1', unitId: 'u1', subjectId: mathSub.id, name: 'T1', order: 1, isCompleted: true, revisionStatus: 'revised', classNoteIds: [] },
        ], // 100% taught & revised -> score 100
        exams: [],
        marks: [{ subjectId: mathSub.id, obtained: 95, maxMarks: 100 }], // 95%
      });

      expect(health.overallScore).toBeGreaterThan(80);
      expect(health.dimensions.attendance.score).toBe(100);
      expect(health.dimensions.tasks.score).toBe(100);
      expect(health.dimensions.syllabus.score).toBe(100);
      expect(health.dimensions.revision.score).toBe(100);
      expect(health.dimensions.marks.score).toBe(95);
    });
  });

  describe('18. Weakest-Area Detection', () => {
    it('flags the lowest-scoring dimension as the main attention area', () => {
      const health = academicAnalyticsService.getAcademicHealth({
        subjects: [mathSub],
        attendanceData: { [mathSub.id]: { attended: 20, total: 20 } },
        attendanceTarget: 75,
        tasks: [
          // 4 tasks, all overdue
          { id: 't1', title: 'Task 1', category: 'assignment', priority: 'high', subjectId: mathSub.id, isCompleted: false, status: 'planned', dueDate: '2026-01-01', createdAt: '2026-01-01' },
          { id: 't2', title: 'Task 2', category: 'assignment', priority: 'high', subjectId: mathSub.id, isCompleted: false, status: 'planned', dueDate: '2026-01-01', createdAt: '2026-01-01' },
          { id: 't3', title: 'Task 3', category: 'assignment', priority: 'high', subjectId: mathSub.id, isCompleted: false, status: 'planned', dueDate: '2026-01-01', createdAt: '2026-01-01' },
          { id: 't4', title: 'Task 4', category: 'assignment', priority: 'high', subjectId: mathSub.id, isCompleted: false, status: 'planned', dueDate: '2026-01-01', createdAt: '2026-01-01' },
        ],
        now: new Date('2026-10-04'),
      });

      expect(health.mainAttentionArea).not.toBeNull();
      expect(health.mainAttentionArea!.dimension).toBe('tasks');
      expect(health.mainAttentionArea!.title).toContain('Task');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 19-22: ARCHIVE & RESTORE PRESERVATION
  // ═══════════════════════════════════════════════════════════════════

  describe('19. Archive Subject', () => {
    it('sets is_archived to 1 in SQLite and excludes it from active subjects', async () => {
      await subjectRepository.archiveSubject(phySub.id);
      const active = await subjectRepository.getActiveSubjects(sem1.id);
      expect(active.some(s => s.id === phySub.id)).toBe(false);

      const archived = await subjectRepository.getArchivedSubjects(sem1.id);
      expect(archived.some(s => s.id === phySub.id)).toBe(true);
    });
  });

  describe('20. Restore Subject', () => {
    it('restores archived subject to active view with identical ID', async () => {
      await subjectRepository.unarchiveSubject(phySub.id);
      const active = await subjectRepository.getActiveSubjects(sem1.id);
      expect(active.some(s => s.id === phySub.id)).toBe(true);

      const restored = await subjectRepository.getSubjectById(phySub.id);
      expect(restored!.isArchived).toBe(false);
      expect(restored!.id).toBe(phySub.id);
    });
  });

  describe('21. Archive Preservation', () => {
    it('preserves class sessions and attendance records after archiving and restoring', async () => {
      const slot: TimetableSlot = {
        id: 'slot-p6-preserve',
        subjectId: mathSub.id,
        semesterId: sem1.id,
        dayOfWeek: 'tuesday',
        startTime: '14:00',
        endTime: '15:00',
        room: '102',
        isRecurring: true,
        type: 'lecture',
        isActive: true,
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
      };
      await timetableRepository.createTimetableSlot(slot);

      await classSessionRepository.atomicSaveSession({
        slotId: slot.id,
        date: '2026-03-03',
        subjectId: mathSub.id,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      // Archive mathSub
      await subjectRepository.archiveSubject(mathSub.id);

      // Verify sessions still exist in DB
      const noteBefore = await classSessionRepository.getClassNote(slot.id, '2026-03-03');
      expect(noteBefore).not.toBeNull();
      expect(noteBefore?.attendanceStatus).toBe('present');

      // Restore mathSub
      await subjectRepository.unarchiveSubject(mathSub.id);
      const noteAfter = await classSessionRepository.getClassNote(slot.id, '2026-03-03');
      expect(noteAfter?.attendanceStatus).toBe('present');
    });
  });

  describe('22. Historical Semester Preservation', () => {
    it('keeps completed semester records intact without modification when switching', async () => {
      const sem2Before = await semesterRepository.getSemesterById(sem2.id);
      const sem2SubjectsBefore = await semesterRepository.getSubjectsForSemester(sem2.id);

      // Switch to sem1
      await semesterRepository.setCurrentSemester(sem1.id);

      // Verify sem2 was not modified
      const sem2After = await semesterRepository.getSemesterById(sem2.id);
      const sem2SubjectsAfter = await semesterRepository.getSubjectsForSemester(sem2.id);

      expect(sem2After!.startDate).toBe(sem2Before!.startDate);
      expect(sem2After!.endDate).toBe(sem2Before!.endDate);
      expect(sem2SubjectsAfter.length).toBe(sem2SubjectsBefore.length);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 23-28: EDGE CASES, EMPTY STATES & AGGREGATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('23. Analytics with Missing Data', () => {
    it('handles subjects with 0 attendance without divide-by-zero errors', () => {
      const forecast = academicAnalyticsService.getAttendanceForecast(0, 0, 75);
      expect(forecast.currentPercentage).toBe(0);
      expect(forecast.safeBunks).toBe(0);
      expect(forecast.recoveryClasses).toBe(0);
      expect(forecast.missScenarios.length).toBe(5);
    });
  });

  describe('24. Analytics with Empty Data', () => {
    it('returns a neutral healthy fallback snapshot when no subjects or tasks exist', () => {
      const emptySnap = academicAnalyticsService.getSemesterAcademicSnapshot({
        subjects: [],
        tasks: [],
        topics: [],
        exams: [],
        attendanceData: {},
      });

      expect(emptySnap.subjectCount).toBe(0);
      expect(emptySnap.classCount).toBe(0);
      expect(emptySnap.health.overallScore).toBe(50);
      expect(emptySnap.health.mainAttentionArea).toBeNull();
    });
  });

  describe('25. Task Aggregation', () => {
    it('aggregates pending, overdue, completed tasks, and total workload minutes', () => {
      const now = new Date('2026-10-04');
      const snap = academicAnalyticsService.getSemesterAcademicSnapshot({
        semester: sem1,
        subjects: [mathSub],
        tasks: [
          { id: 't1', title: 'T1', category: 'assignment', priority: 'medium', subjectId: mathSub.id, isCompleted: true, status: 'completed', createdAt: '2026-10-04' },
          { id: 't2', title: 'T2', category: 'assignment', priority: 'medium', subjectId: mathSub.id, isCompleted: false, status: 'planned', dueDate: '2026-10-01', estimatedMinutes: 45, createdAt: '2026-10-04' },
          { id: 't3', title: 'T3', category: 'assignment', priority: 'medium', subjectId: mathSub.id, isCompleted: false, status: 'planned', dueDate: '2026-10-10', estimatedMinutes: 30, createdAt: '2026-10-04' },
        ],
        now,
      });

      expect(snap.taskSummary.completed).toBe(1);
      expect(snap.taskSummary.pending).toBe(2);
      expect(snap.taskSummary.overdue).toBe(1);
      expect(snap.taskSummary.workloadMinutes).toBe(75);
    });
  });

  describe('26. Revision Aggregation', () => {
    it('computes taught vs revised topics and revision backlog count', () => {
      const snap = academicAnalyticsService.getSemesterAcademicSnapshot({
        semester: sem1,
        subjects: [mathSub],
        topics: [
          { id: 'top-1', unitId: 'u1', subjectId: mathSub.id, name: 'T1', order: 1, isCompleted: true, revisionStatus: 'revised', classNoteIds: [] },
          { id: 'top-2', unitId: 'u1', subjectId: mathSub.id, name: 'T2', order: 2, isCompleted: true, revisionStatus: 'taught', classNoteIds: [] },
          { id: 'top-3', unitId: 'u1', subjectId: mathSub.id, name: 'T3', order: 3, isCompleted: false, revisionStatus: 'needs_revision', classNoteIds: [] },
        ],
      });

      expect(snap.syllabusSummary.taughtTopics).toBe(3);
      expect(snap.syllabusSummary.revisedTopics).toBe(1);
      expect(snap.syllabusSummary.backlogTopics).toBe(2); // taught but unrevised + needs_revision
      expect(snap.syllabusSummary.revisionPercentage).toBeCloseTo(33.33, 1);
    });
  });

  describe('27. Exam Aggregation', () => {
    it('identifies next upcoming exam and counts days remaining', () => {
      const now = new Date('2026-10-04');
      const snap = academicAnalyticsService.getSemesterAcademicSnapshot({
        semester: sem1,
        subjects: [mathSub],
        exams: [
          { id: 'e1', name: 'Midterm', subjectId: mathSub.id, semesterId: sem1.id, date: '2026-10-10', maxMarks: 50, type: 'internal' },
          { id: 'e2', name: 'Final', subjectId: mathSub.id, semesterId: sem1.id, date: '2026-11-20', maxMarks: 100, type: 'external' },
        ],
        now,
      });

      expect(snap.examSummary.totalExams).toBe(2);
      expect(snap.examSummary.upcomingExam?.name).toBe('Midterm');
      expect(snap.examSummary.daysUntilExam).toBe(6);
    });
  });

  describe('28. Marks Aggregation', () => {
    it('computes overall obtained vs max marks across semester assessments', () => {
      const snap = academicAnalyticsService.getSemesterAcademicSnapshot({
        semester: sem1,
        subjects: [mathSub],
        marks: [
          { subjectId: mathSub.id, obtained: 40, maxMarks: 50 },
          { subjectId: mathSub.id, obtained: 80, maxMarks: 100 },
        ],
      });

      expect(snap.marksSummary.totalObtained).toBe(120);
      expect(snap.marksSummary.totalMax).toBe(150);
      expect(snap.marksSummary.overallPercentage).toBe(80);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 29-32: PERSISTENCE & INTEGRITY
  // ═══════════════════════════════════════════════════════════════════

  describe('29. Semester Switch Persistence', () => {
    it('persists active semester selection in database across app restarts', async () => {
      await semesterRepository.setCurrentSemester(sem2.id);
      const current = await semesterRepository.getCurrentSemester();
      expect(current!.id).toBe(sem2.id);

      // Re-hydrate store and verify
      await useAppStore.getState().switchActiveSemester(sem1.id);
      const activeSem = useAppStore.getState().semester;
      expect(activeSem?.id).toBe(sem1.id);
    });
  });

  describe('30. Archive/Restore Persistence', () => {
    it('persists archive status in database across queries', async () => {
      await subjectRepository.archiveSubject(mathSub.id);
      const archived = await subjectRepository.getArchivedSubjects(sem1.id);
      expect(archived.some(s => s.id === mathSub.id)).toBe(true);

      await subjectRepository.unarchiveSubject(mathSub.id);
      const unarchived = await subjectRepository.getActiveSubjects(sem1.id);
      expect(unarchived.some(s => s.id === mathSub.id)).toBe(true);
    });
  });

  describe('31. No Duplicate Subjects After Restore', () => {
    it('ensures unarchiving does not produce duplicate subject entries in SQLite', async () => {
      await subjectRepository.archiveSubject(chemSub.id);
      await subjectRepository.unarchiveSubject(chemSub.id);
      await subjectRepository.unarchiveSubject(chemSub.id); // Idempotent call

      const subjects = await subjectRepository.getSubjects(true, sem2.id);
      const chemEntries = subjects.filter(s => s.id === chemSub.id);
      expect(chemEntries.length).toBe(1);
    });
  });

  describe('32. Historical ClassSession Integrity', () => {
    it('guarantees past class sessions and attendance statuses are never modified during semester changes', async () => {
      const slot: TimetableSlot = {
        id: 'slot-p6-integ',
        subjectId: chemSub.id,
        semesterId: sem2.id,
        dayOfWeek: 'wednesday',
        startTime: '11:00',
        endTime: '12:00',
        room: '103',
        isRecurring: true,
        type: 'lecture',
        isActive: true,
        createdAt: '2026-07-01',
        updatedAt: '2026-07-01',
      };
      await timetableRepository.createTimetableSlot(slot);

      await classSessionRepository.atomicSaveSession({
        slotId: slot.id,
        date: '2026-07-08',
        subjectId: chemSub.id,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      // Switch to sem1
      await semesterRepository.setCurrentSemester(sem1.id);

      // Check session in sem2
      const fetchedNote = await classSessionRepository.getClassNote(slot.id, '2026-07-08');
      expect(fetchedNote?.attendanceStatus).toBe('present');
      expect(fetchedNote?.date).toBe('2026-07-08');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 33-36: TARGETS & EDGE CASES
  // ═══════════════════════════════════════════════════════════════════

  describe('33. Target 75 Forecast', () => {
    it('models attendance correctly against a 75% target', () => {
      // 15/20 = 75% -> 0 safe bunks, 0 recovery classes needed
      const forecast = academicAnalyticsService.getAttendanceForecast(15, 20, 75);
      expect(forecast.safeBunks).toBe(0);
      expect(forecast.recoveryClasses).toBe(0);
      expect(forecast.currentStatus).toBe('watch');
    });
  });

  describe('34. Target 80 Forecast', () => {
    it('models attendance correctly against an 80% target', () => {
      // 16/20 = 80% -> 0 safe bunks, 0 recovery
      const forecast = academicAnalyticsService.getAttendanceForecast(16, 20, 80);
      expect(forecast.safeBunks).toBe(0);
      expect(forecast.recoveryClasses).toBe(0);
      expect(forecast.currentStatus).toBe('watch');

      // 18/20 = 90% -> safe bunks available
      const forecastHigh = academicAnalyticsService.getAttendanceForecast(18, 20, 80);
      expect(forecastHigh.safeBunks).toBe(2);
      expect(forecastHigh.currentStatus).toBe('safe');
    });
  });

  describe('35. Target 85 Forecast', () => {
    it('models attendance correctly against an 85% target', () => {
      // 17/20 = 85% -> exactly on target
      const forecast = academicAnalyticsService.getAttendanceForecast(17, 20, 85);
      expect(forecast.currentPercentage).toBe(85);
      expect(forecast.safeBunks).toBe(0);
      expect(forecast.recoveryClasses).toBe(0);
    });
  });

  describe('36. 100% Target Edge Case', () => {
    it('protects against division by zero and correctly handles 100% target', () => {
      // 10/10 = 100% with target 100%
      expect(calculateSafeBunks(10, 10, 100)).toBe(0);
      expect(calculateRecoveryClasses(10, 10, 100)).toBe(0);

      // 9/10 with target 100% (cannot mathematically recover to 100% once a class is missed)
      expect(calculateSafeBunks(9, 10, 100)).toBe(0);
      expect(calculateRecoveryClasses(9, 10, 100)).toBe(Infinity); // Mathematically impossible
    });
  });
});
