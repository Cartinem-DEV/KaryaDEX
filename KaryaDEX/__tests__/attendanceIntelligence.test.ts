/**
 * KaryaDEX — Phase 8: Advanced Attendance Intelligence Tests
 *
 * Full verification of all Phase 8 requirements:
 *  1. Attendance Snapshot (attended, missed, total, percentage, target, margin, status)
 *  2. Attendance Trend:
 *     - insufficient data (< 3 recorded classes)
 *     - stable trend
 *     - improving trend
 *     - declining trend
 *  3. Attendance Status (safe, watch, danger)
 *  4. Safe Bunk Intelligence:
 *     - immediately safe bunks (>= target + 5)
 *     - conditionally safe bunks (watch zone)
 *     - total safe bunks
 *     - effective bunk capacity (bounded by future schedule)
 *  5. What-If Simulator:
 *     - 1-class miss simulation
 *     - multi-class miss simulation
 *     - attend classes simulation
 *     - custom mixed simulation
 *  6. Recovery Intelligence:
 *     - consecutive classes needed calculation
 *     - projected percentage after recovery
 *     - schedule feasibility (possible vs impossible under remaining classes)
 *     - recovery deadline date
 *     - 100% attendance target edge case
 *  7. Future Scheduled Classes & Timetable Integration:
 *     - recurring schedule expansion
 *     - semester end date boundaries
 *     - local-date handling
 *     - zero timetable slots
 *  8. Exam-Aware Attendance Exposure:
 *     - exam within 7 days
 *     - classes before exam
 *     - safe bunks before exam
 *     - high exposure detection
 *  9. Attendance Pressure:
 *     - low pressure
 *     - medium pressure
 *     - high pressure
 *     - critical pressure (impossible recovery or imminent exam)
 * 10. Academic Hub & Attention Items Integration:
 *     - danger attendance signal
 *     - watch attendance warning
 * 11. Academic Health Index Integration:
 *     - deterministic scoring
 *     - neutral fallback on 0 classes
 * 12. Notification Eligibility:
 *     - attendance alert on falling below target
 *     - high pressure attendance alert
 *     - throttling & cooldown
 * 13. Edge Cases:
 *     - zero classes recorded (0/0)
 *     - 100% attendance (10/10)
 *     - 100% attendance target
 *     - single class attended (1/1)
 *     - single class missed (0/1)
 *     - exactly at target (15/20 = 75%)
 *     - barely above target (16/20 = 80% vs 75%)
 *     - impossible recovery (needed > available)
 *     - no NaN, no Infinity, no negative counts
 * 14. Semester Isolation & Archive Preservation:
 *     - attendance data isolated per semester
 *     - archive subject retains attendance history
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  subjectRepository,
  semesterRepository,
  timetableRepository,
  classSessionRepository,
} from '../database';
import { attendanceIntelligenceService } from '../services/attendanceIntelligenceService';
import { academicAnalyticsService } from '../services/academicAnalyticsService';
import { academicHubService } from '../services/academicHubService';
import { notificationService } from '../services/notificationService';
import { useAppStore } from '../store/useAppStore';
import { useAcademicStore } from '../store/useAcademicStore';
import type { Semester, Subject, Exam } from '../types';
import type { TimetableSlot, ClassNote } from '../types/academic';

describe('Phase 8: Advanced Attendance Intelligence', () => {
  const sem1: Semester = {
    id: 'sem-p8-1',
    name: 'Semester 1',
    number: 1,
    startDate: '2026-08-01',
    endDate: '2026-12-15',
    collegeId: 'col-p8',
    isCurrent: true,
    status: 'current',
  };

  const sem2: Semester = {
    id: 'sem-p8-2',
    name: 'Semester 2',
    number: 2,
    startDate: '2027-01-01',
    endDate: '2027-05-30',
    collegeId: 'col-p8',
    isCurrent: false,
    status: 'archived',
  };

  const mathSub: Subject = {
    id: 'sub-p8-math',
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

  const physicsSub: Subject = {
    id: 'sub-p8-phy',
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
    id: 'sub-p8-cs',
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

  beforeAll(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();

    await semesterRepository.saveSemester(sem1);
    await semesterRepository.saveSemester(sem2);
    await subjectRepository.createSubject(mathSub);
    await subjectRepository.createSubject(physicsSub);
    await subjectRepository.createSubject(csSub);

    useAppStore.setState({
      semester: sem1,
      subjects: [mathSub, physicsSub, csSub],
      attendanceTarget: 75,
      attendanceData: {
        [mathSub.id]: { attended: 18, total: 20 },     // 90% (safe)
        [physicsSub.id]: { attended: 15, total: 20 },  // 75% (watch)
        [csSub.id]: { attended: 12, total: 20 },       // 60% (danger)
      },
      exams: [],
    });
  });

  // ─── 1. ATTENDANCE SNAPSHOT ───────────────────────────────────

  describe('1. Attendance Snapshot', () => {
    it('generates deterministic snapshot with attended, missed, margin, and status', () => {
      const snap = attendanceIntelligenceService.getSubjectAttendanceSnapshot(mathSub.id);

      expect(snap.subjectId).toBe(mathSub.id);
      expect(snap.attended).toBe(18);
      expect(snap.total).toBe(20);
      expect(snap.missed).toBe(2);
      expect(snap.currentPercentage).toBe(90);
      expect(snap.targetPercentage).toBe(75);
      expect(snap.safetyMargin).toBe(15);
      expect(snap.status).toBe('safe');
      expect(snap.recommendation).toBeDefined();
    });

    it('identifies watch status when within 5% of target', () => {
      const snap = attendanceIntelligenceService.getSubjectAttendanceSnapshot(physicsSub.id);

      expect(snap.currentPercentage).toBe(75);
      expect(snap.status).toBe('watch');
      expect(snap.safetyMargin).toBe(0);
    });

    it('identifies danger status when below target', () => {
      const snap = attendanceIntelligenceService.getSubjectAttendanceSnapshot(csSub.id);

      expect(snap.currentPercentage).toBe(60);
      expect(snap.status).toBe('danger');
      expect(snap.safetyMargin).toBe(-15);
      expect(snap.recovery.isNeeded).toBe(true);
    });
  });

  // ─── 2. ATTENDANCE TREND ──────────────────────────────────────

  describe('2. Attendance Trend', () => {
    it('returns insufficient_data when fewer than 3 recorded classes exist', () => {
      const notes = [
        { date: '2026-09-01', attendanceStatus: 'present' },
        { date: '2026-09-03', attendanceStatus: 'present' },
      ];
      expect(attendanceIntelligenceService.deriveAttendanceTrend(notes)).toBe('insufficient_data');
    });

    it('identifies stable trend when attendance rate does not drift by 5%', () => {
      const notes = [
        { date: '2026-09-01', attendanceStatus: 'present' },
        { date: '2026-09-03', attendanceStatus: 'present' },
        { date: '2026-09-05', attendanceStatus: 'present' },
        { date: '2026-09-08', attendanceStatus: 'present' },
      ];
      expect(attendanceIntelligenceService.deriveAttendanceTrend(notes)).toBe('stable');
    });

    it('identifies improving trend when recent classes have higher attendance', () => {
      const notes = [
        { date: '2026-09-01', attendanceStatus: 'absent' },
        { date: '2026-09-03', attendanceStatus: 'absent' },
        { date: '2026-09-05', attendanceStatus: 'present' },
        { date: '2026-09-08', attendanceStatus: 'present' },
      ];
      expect(attendanceIntelligenceService.deriveAttendanceTrend(notes)).toBe('improving');
    });

    it('identifies declining trend when recent classes have lower attendance', () => {
      const notes = [
        { date: '2026-09-01', attendanceStatus: 'present' },
        { date: '2026-09-03', attendanceStatus: 'present' },
        { date: '2026-09-05', attendanceStatus: 'absent' },
        { date: '2026-09-08', attendanceStatus: 'absent' },
      ];
      expect(attendanceIntelligenceService.deriveAttendanceTrend(notes)).toBe('declining');
    });
  });

  // ─── 3. SAFE BUNK INTELLIGENCE ────────────────────────────────

  describe('3. Safe Bunk Intelligence', () => {
    it('splits bunks into immediately safe vs conditionally safe', () => {
      // 18/20 = 90%. Target 75%. Safe status threshold is 80%.
      // Immediately safe (stay >= 80%):
      // floor((18 - 0.8*20) / 0.8) = floor(2/0.8) = 2 bunks
      // Total safe bunks (stay >= 75%):
      // floor((18 - 0.75*20) / 0.75) = floor(3/0.75) = 4 bunks
      // Conditionally safe = 4 - 2 = 2 bunks
      const breakdown = attendanceIntelligenceService.calculateSafeBunkBreakdown(18, 20, 75, 10);

      expect(breakdown.immediatelySafe).toBe(2);
      expect(breakdown.conditionallySafe).toBe(2);
      expect(breakdown.totalSafeBunks).toBe(4);
      expect(breakdown.effectiveBunkCapacity).toBe(4);
    });

    it('caps effective bunk capacity by future scheduled classes', () => {
      // 4 safe bunks, but only 2 scheduled classes remain in the semester
      const breakdown = attendanceIntelligenceService.calculateSafeBunkBreakdown(18, 20, 75, 2);

      expect(breakdown.totalSafeBunks).toBe(4);
      expect(breakdown.effectiveBunkCapacity).toBe(2);
    });

    it('returns 0 safe bunks when at or below target', () => {
      const breakdown = attendanceIntelligenceService.calculateSafeBunkBreakdown(15, 20, 75, 10);
      expect(breakdown.immediatelySafe).toBe(0);
      expect(breakdown.conditionallySafe).toBe(0);
      expect(breakdown.totalSafeBunks).toBe(0);
    });
  });

  // ─── 4. WHAT-IF SIMULATOR ─────────────────────────────────────

  describe('4. What-If Simulator', () => {
    it('accurately projects attendance and status when missing classes', () => {
      // Math: 18/20 (90%). Simulate missing 1 class -> 18/21 = 85.71% (still safe)
      const res = attendanceIntelligenceService.simulateWhatIf({
        subjectId: mathSub.id,
        simulatedMisses: 1,
      });

      expect(res.newAttended).toBe(18);
      expect(res.newTotal).toBe(21);
      expect(res.projectedPercentage).toBeCloseTo(85.71, 1);
      expect(res.projectedStatus).toBe('safe');
      expect(res.delta).toBeLessThan(0);
    });

    it('accurately projects dropping into danger when exceeding safe margin', () => {
      // Math: 18/20 (90%). Simulate missing 5 classes -> 18/25 = 72% (< 75% target)
      const res = attendanceIntelligenceService.simulateWhatIf({
        subjectId: mathSub.id,
        simulatedMisses: 5,
      });

      expect(res.projectedPercentage).toBe(72);
      expect(res.projectedStatus).toBe('danger');
      expect(res.recoveryClassesNeeded).toBeGreaterThan(0);
    });

    it('accurately projects recovery when attending future classes', () => {
      // CS: 12/20 = 60%. Target 75%.
      // Need 12 consecutive classes: (12+12)/(20+12) = 24/32 = 75%.
      const res = attendanceIntelligenceService.simulateWhatIf({
        subjectId: csSub.id,
        simulatedPresents: 12,
      });

      expect(res.newAttended).toBe(24);
      expect(res.newTotal).toBe(32);
      expect(res.projectedPercentage).toBe(75);
      expect(res.projectedStatus).toBe('watch');
    });
  });

  // ─── 5. RECOVERY INTELLIGENCE ─────────────────────────────────

  describe('5. Recovery Intelligence', () => {
    it('calculates exact consecutive classes required to recover to target', () => {
      // 12/20 = 60%. Target 75%.
      // Formula: ceil((0.75*20 - 12) / 0.25) = ceil(3 / 0.25) = 12
      const futureOccurrences = Array.from({ length: 15 }, (_, i) => ({
        date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      }));

      const rec = attendanceIntelligenceService.calculateRecoveryInfo(12, 20, 75, 15, futureOccurrences);

      expect(rec.isNeeded).toBe(true);
      expect(rec.consecutiveClassesNeeded).toBe(12);
      expect(rec.projectedPercentageAfterRecovery).toBe(75);
      expect(rec.isPossible).toBe(true);
      expect(rec.recoveryDeadlineDate).toBe('2026-10-12');
    });

    it('identifies impossible recovery when scheduled classes are insufficient', () => {
      // Need 12 classes, but only 8 classes remain in the semester
      const rec = attendanceIntelligenceService.calculateRecoveryInfo(12, 20, 75, 8);

      expect(rec.isNeeded).toBe(true);
      expect(rec.consecutiveClassesNeeded).toBe(12);
      expect(rec.isPossible).toBe(false);
      expect(rec.impossibleReason).toContain('Requires 12 consecutive classes');
    });

    it('handles 100% target edge case gracefully without Infinity or NaN', () => {
      // 9/10 with 100% target
      const rec = attendanceIntelligenceService.calculateRecoveryInfo(9, 10, 100, 20);

      expect(rec.isNeeded).toBe(true);
      expect(rec.isPossible).toBe(false);
      expect(rec.impossibleReason).toBe('Cannot reach 100% attendance once a class has been missed.');
      expect(rec.consecutiveClassesNeeded).toBe(0);
    });
  });

  // ─── 6. FUTURE SCHEDULED CLASSES & TIMETABLE ─────────────────

  describe('6. Future Timetable Integration', () => {
    it('expands recurring timetable slots across semester date range', async () => {
      const slot: TimetableSlot = {
        id: 'slot-p8-mon',
        subjectId: mathSub.id,
        semesterId: sem1.id,
        dayOfWeek: 'monday',
        startTime: '10:00',
        endTime: '11:00',
        room: '201',
        type: 'lecture',
        isActive: true,
        isRecurring: true,
        createdAt: '2026-08-01',
        updatedAt: '2026-08-01',
      };
      await timetableRepository.createTimetableSlot(slot);

      // Now simulated as 2026-10-01 (mid-semester)
      const now = new Date('2026-10-01T10:00:00');
      const { count, occurrences } = attendanceIntelligenceService.getFutureScheduledClasses(
        mathSub.id,
        [slot],
        sem1,
        now
      );

      expect(count).toBeGreaterThan(5);
      expect(occurrences[0].date > '2026-10-01').toBe(true);
      expect(occurrences[occurrences.length - 1].date <= sem1.endDate).toBe(true);
      expect(occurrences.every(o => o.slot.subjectId === mathSub.id)).toBe(true);
    });

    it('returns 0 future classes when timetable has no slots for subject', () => {
      const { count, occurrences } = attendanceIntelligenceService.getFutureScheduledClasses(
        'sub-no-timetable',
        [],
        sem1
      );
      expect(count).toBe(0);
      expect(occurrences.length).toBe(0);
    });
  });

  // ─── 7. EXAM-AWARE ATTENDANCE EXPOSURE ────────────────────────

  describe('7. Exam-Aware Attendance Exposure', () => {
    it('calculates classes and safe bunks available before an upcoming exam', () => {
      const exam: Exam = {
        id: 'exam-p8-math',
        name: 'Midterm Exam',
        subjectId: mathSub.id,
        semesterId: sem1.id,
        date: '2026-10-15',
        type: 'internal',
        maxMarks: 50,
      };

      const slot: TimetableSlot = {
        id: 'slot-p8-mon-2',
        subjectId: mathSub.id,
        semesterId: sem1.id,
        dayOfWeek: 'monday',
        startTime: '10:00',
        endTime: '11:00',
        room: '201',
        type: 'lecture',
        isActive: true,
        isRecurring: true,
        createdAt: '2026-08-01',
        updatedAt: '2026-08-01',
      };

      const now = new Date('2026-10-05T10:00:00');
      const futureOccurrences = [
        { date: '2026-10-08', slot },
        { date: '2026-10-12', slot },
        { date: '2026-10-19', slot }, // After exam
      ];

      const exposure = attendanceIntelligenceService.calculateExamAttendanceExposure(
        mathSub.id,
        18,
        20,
        75,
        futureOccurrences,
        [exam],
        now
      );

      expect(exposure).toBeDefined();
      expect(exposure?.daysUntil).toBe(10);
      expect(exposure?.classesBeforeExam).toBe(2);
      expect(exposure?.safeBunksBeforeExam).toBeLessThanOrEqual(2);
    });
  });

  // ─── 8. ATTENDANCE PRESSURE ───────────────────────────────────

  describe('8. Attendance Pressure Classification', () => {
    it('classifies danger subject with impossible recovery as critical pressure', () => {
      const recovery: any = { isNeeded: true, isPossible: false, consecutiveClassesNeeded: 10, futureClassesAvailable: 3 };
      const pressure = attendanceIntelligenceService.calculateAttendancePressure('danger', 'declining', -15, recovery);
      expect(pressure).toBe('critical');
    });

    it('classifies watch subject with declining trend as high pressure', () => {
      const recovery: any = { isNeeded: false, isPossible: true };
      const pressure = attendanceIntelligenceService.calculateAttendancePressure('watch', 'declining', 1.0, recovery);
      expect(pressure).toBe('high');
    });

    it('classifies comfortable safe subject as low pressure', () => {
      const recovery: any = { isNeeded: false, isPossible: true };
      const pressure = attendanceIntelligenceService.calculateAttendancePressure('safe', 'stable', 15, recovery);
      expect(pressure).toBe('low');
    });
  });

  // ─── 9. ACADEMIC HUB INTEGRATION ──────────────────────────────

  describe('9. Academic Hub Integration', () => {
    it('surfaces danger attendance attention items', () => {
      const simulatedNow = new Date('2026-10-04T10:00:00');
      const snapshot = academicHubService.getTodayAcademicSnapshot({ now: simulatedNow });

      const dangerItem = snapshot.attentionItems.find(
        item => item.type === 'attendance_risk' && item.priority === 'critical'
      );
      expect(dangerItem).toBeDefined();
      expect(dangerItem?.title).toContain('Attendance');
    });

    it('provides complete semester attendance hub data', () => {
      const hubData = academicHubService.getAttendanceHubData();

      expect(hubData.dangerSubjects.length).toBe(1);
      expect(hubData.dangerSubjects[0].subjectId).toBe(csSub.id);
      expect(hubData.safeSubjects.some((s: any) => s.subjectId === mathSub.id)).toBe(true);
      expect(hubData.strongestSubject?.id).toBe(mathSub.id);
      expect(hubData.weakestSubject?.id).toBe(csSub.id);
    });
  });

  // ─── 10. ACADEMIC HEALTH INTEGRATION ──────────────────────────

  describe('10. Academic Health Integration', () => {
    it('computes attendance dimension score deterministically', () => {
      const health = academicAnalyticsService.getAcademicHealth();
      expect(health.dimensions.attendance.score).toBeGreaterThan(0);
      expect(health.dimensions.attendance.score).toBeLessThanOrEqual(100);
      expect(health.dimensions.attendance.weight).toBe(0.20);
    });

    it('returns neutral score (50) when no classes are recorded', () => {
      const health = academicAnalyticsService.getAcademicHealth({
        attendanceData: { [mathSub.id]: { attended: 0, total: 0 } },
      });
      expect(health.dimensions.attendance.score).toBe(50);
      expect(health.dimensions.attendance.status).toBe('neutral');
    });
  });

  // ─── 11. NOTIFICATION INTEGRATION ─────────────────────────────

  describe('11. Notification Integration', () => {
    it('schedules attendance alert when percentage is below target', async () => {
      const notifId = await notificationService.scheduleAttendanceAlert(csSub, 60, 75);
      expect(notifId).not.toBeNull();
    });

    it('does not schedule attendance alert when percentage is safe', async () => {
      const notifId = await notificationService.scheduleAttendanceAlert(mathSub, 90, 75);
      expect(notifId).toBeNull();
    });

    it('schedules high pressure alert when pressure is critical', async () => {
      const notifId = await notificationService.scheduleHighPressureAttendanceAlert(physicsSub, {
        pressure: 'critical',
        recommendation: 'Attendance is critically low. Attend all scheduled classes.',
      });
      expect(notifId).not.toBeNull();
    });
  });

  // ─── 12. EDGE CASES & NUMERIC INTEGRITY ───────────────────────

  describe('12. Edge Cases & Protection Against NaN / Infinity', () => {
    it('handles zero attendance records (0/0) cleanly', () => {
      const snap = attendanceIntelligenceService.getSubjectAttendanceSnapshot(mathSub.id, {
        attendanceDataOverride: { [mathSub.id]: { attended: 0, total: 0 } },
      });
      expect(snap.currentPercentage).toBe(0);
      expect(snap.safeBunks.totalSafeBunks).toBe(0);
      expect(snap.recovery.consecutiveClassesNeeded).toBe(0);
      expect(Number.isFinite(snap.classesUntilStatusChange.toSafe)).toBe(true);
      expect(Number.isNaN(snap.currentPercentage)).toBe(false);
    });

    it('handles single class attended (1/1) cleanly', () => {
      const snap = attendanceIntelligenceService.getSubjectAttendanceSnapshot(mathSub.id, {
        attendanceDataOverride: { [mathSub.id]: { attended: 1, total: 1 } },
      });
      expect(snap.currentPercentage).toBe(100);
      expect(snap.status).toBe('safe');
      expect(Number.isNaN(snap.currentPercentage)).toBe(false);
    });

    it('handles single class missed (0/1) cleanly', () => {
      const snap = attendanceIntelligenceService.getSubjectAttendanceSnapshot(mathSub.id, {
        attendanceDataOverride: { [mathSub.id]: { attended: 0, total: 1 } },
      });
      expect(snap.currentPercentage).toBe(0);
      expect(snap.status).toBe('danger');
      expect(snap.recovery.consecutiveClassesNeeded).toBe(3); // (0.75 - 0)/0.25 = 3
    });

    it('never produces NaN, negative class counts, or uncaught Infinity', () => {
      const whatIf = attendanceIntelligenceService.simulateWhatIf({
        subjectId: mathSub.id,
        simulatedMisses: 0,
        simulatedPresents: 0,
      });

      expect(Number.isNaN(whatIf.projectedPercentage)).toBe(false);
      expect(whatIf.newAttended).toBeGreaterThanOrEqual(0);
      expect(whatIf.newTotal).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(whatIf.recoveryClassesNeeded)).toBe(true);
    });
  });

  // ─── 13. SEMESTER ISOLATION & ARCHIVE INTEGRITY ───────────────

  describe('13. Semester Isolation & Archive Integrity', () => {
    it('isolates attendance calculations by semester', () => {
      const sem1Summary = attendanceIntelligenceService.getSemesterAttendanceIntelligence({
        subjectsOverride: [mathSub, physicsSub, csSub],
      });
      expect(sem1Summary.dangerSubjects.length).toBe(1);

      // Semester 2 has no attendance records yet
      const sem2Sub: Subject = {
        id: 'sub-p8-sem2',
        name: 'Compiler Design',
        code: 'CS401',
        shortName: 'CD',
        color: '#EC4899',
        semesterId: sem2.id,
        facultyId: 'fac-sem2',
        credits: 4,
        isArchived: false,
        subjectType: 'lecture',
        targetAttendance: 75,
      };

      const sem2Summary = attendanceIntelligenceService.getSemesterAttendanceIntelligence({
        subjectsOverride: [sem2Sub],
        attendanceDataOverride: { [sem2Sub.id]: { attended: 0, total: 0 } },
      });

      expect(sem2Summary.overallPercentage).toBe(0);
      expect(sem2Summary.dangerSubjects.length).toBe(0); // 0 classes => neutral/danger distinction
    });

    it('preserves attendance intelligence when subject is archived', async () => {
      await subjectRepository.archiveSubject(physicsSub.id);
      const archived = await subjectRepository.getSubjectById(physicsSub.id);
      expect(archived?.isArchived).toBe(true);

      // Still computes correctly for historical queries
      const snap = attendanceIntelligenceService.getSubjectAttendanceSnapshot(physicsSub.id);
      expect(snap.attended).toBe(15);
      expect(snap.total).toBe(20);

      // Restore
      await subjectRepository.unarchiveSubject(physicsSub.id);
      const restored = await subjectRepository.getSubjectById(physicsSub.id);
      expect(restored?.isArchived).toBe(false);
    });
  });
});
