/**
 * BunkMatKar — Attendance Intelligence Service (Phase 8)
 *
 * Core engine providing deterministic, explainable attendance intelligence:
 * - Deterministic Attendance Intelligence Snapshot per subject
 * - Empirical attendance trend derivation (improving, stable, declining, insufficient_data)
 * - Safe bunk capacity & classification (immediately safe vs conditionally safe)
 * - Future timetable-driven class awareness (schedule boundaries & counts)
 * - Recovery intelligence with mathematical feasibility checking
 * - Attendance pressure classification (low, medium, high, critical)
 * - Exam-aware attendance exposure calculation
 * - Multi-class / custom What-If Attendance Simulator
 * - Semester-wide multi-subject attendance intelligence aggregation
 *
 * 100% deterministic, offline-first, semester-aware, local-date safe.
 */

import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';
import {
  calculatePercentage,
  getAttendanceStatus,
  calculateSafeBunks,
  calculateImmediatelySafeBunks,
  calculateRecoveryClasses,
  calculateClassesToSafe,
  projectAfterAbsence,
  projectAfterPresent,
} from '@/lib/attendance';
import { formatLocalDate, parseLocalDate, getDayOfWeekFromDate, daysUntil } from '@/lib/timeUtils';
import type { Subject, Exam, Semester, AttendanceStatus } from '@/types';
import type {
  TimetableSlot,
  ClassNote,
  AttendanceTrend,
  AttendancePressure,
  SafeBunkBreakdown,
  AttendanceRecoveryInfo,
  UpcomingExamAttendanceExposure,
  AttendanceIntelligenceSnapshot,
  AttendanceWhatIfInput,
  AttendanceWhatIfResult,
  SemesterAttendanceIntelligenceSummary,
} from '@/types/academic';

export interface AttendanceIntelligenceInput {
  subjectId?: string;
  subjectsOverride?: Subject[];
  attendanceDataOverride?: Record<string, { attended: number; total: number }>;
  attendanceTargetOverride?: number;
  timetableSlotsOverride?: TimetableSlot[];
  classNotesOverride?: ClassNote[];
  examsOverride?: Exam[];
  semesterOverride?: Semester;
  now?: Date;
}

export class AttendanceIntelligenceService {
  /**
   * Deterministically derives the attendance trend for a subject from actual class history.
   * Compares the attendance rate of the recent window against the earlier window.
   *
   * Thresholds:
   * - < 3 recorded sessions => 'insufficient_data'
   * - recent rate - earlier rate >= +5% => 'improving'
   * - recent rate - earlier rate <= -5% => 'declining'
   * - otherwise => 'stable'
   */
  deriveAttendanceTrend(
    notes: Array<{ attendanceStatus?: string; date: string }>
  ): AttendanceTrend {
    // Only consider sessions with actual attendance recorded
    const recorded = notes
      .filter(n => n.attendanceStatus === 'present' || n.attendanceStatus === 'late' || n.attendanceStatus === 'absent')
      .sort((a, b) => a.date.localeCompare(b.date));

    if (recorded.length < 3) {
      return 'insufficient_data';
    }

    const n = recorded.length;
    // Window size: between 2 and 5 classes, at most half the total
    const windowSize = Math.max(2, Math.min(5, Math.floor(n / 2)));
    const earlierNotes = recorded.slice(0, n - windowSize);
    const recentNotes = recorded.slice(n - windowSize);

    const countPresents = (list: typeof recorded) =>
      list.filter(item => item.attendanceStatus === 'present' || item.attendanceStatus === 'late').length;

    const earlierPresents = countPresents(earlierNotes);
    const recentPresents = countPresents(recentNotes);

    const earlierRate = earlierNotes.length > 0 ? (earlierPresents / earlierNotes.length) * 100 : 0;
    const recentRate = recentNotes.length > 0 ? (recentPresents / recentNotes.length) * 100 : 0;

    const diff = recentRate - earlierRate;
    if (diff >= 5) return 'improving';
    if (diff <= -5) return 'declining';
    return 'stable';
  }

  /**
   * Calculates future scheduled classes for a subject based on recurring timetable rules
   * between tomorrow (or now) and the semester end date.
   */
  getFutureScheduledClasses(
    subjectId: string,
    slots: TimetableSlot[],
    semester?: Semester | null,
    now: Date = new Date()
  ): { count: number; occurrences: Array<{ date: string; slot: TimetableSlot }> } {
    const activeSlots = slots.filter(s => s.subjectId === subjectId && s.isActive && s.isRecurring);
    if (activeSlots.length === 0) {
      return { count: 0, occurrences: [] };
    }

    const todayStr = formatLocalDate(now);
    const today = parseLocalDate(todayStr);

    // Tomorrow is the first possible future scheduled date
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // End date defaults to semester.endDate, or 60 days if unspecified
    let endDate: Date;
    if (semester?.endDate) {
      endDate = parseLocalDate(semester.endDate);
    } else {
      endDate = new Date(today);
      endDate.setDate(today.getDate() + 60);
    }

    if (tomorrow > endDate) {
      return { count: 0, occurrences: [] };
    }

    const occurrences: Array<{ date: string; slot: TimetableSlot }> = [];
    const current = new Date(tomorrow);

    while (current <= endDate) {
      const dow = getDayOfWeekFromDate(current);
      const dateStr = formatLocalDate(current);

      for (const slot of activeSlots) {
        if (slot.dayOfWeek.toLowerCase() === dow.toLowerCase()) {
          occurrences.push({ date: dateStr, slot });
        }
      }
      current.setDate(current.getDate() + 1);
    }

    // Sort chronologically
    occurrences.sort((a, b) => a.date.localeCompare(b.date) || a.slot.startTime.localeCompare(b.slot.startTime));

    return {
      count: occurrences.length,
      occurrences,
    };
  }

  /**
   * Computes a safe-bunk breakdown distinguishing immediately safe vs conditionally safe bunks.
   */
  calculateSafeBunkBreakdown(
    attended: number,
    total: number,
    target: number,
    futureClassesRemaining: number
  ): SafeBunkBreakdown {
    const totalSafeBunks = calculateSafeBunks(attended, total, target);
    const immediatelySafe = calculateImmediatelySafeBunks(attended, total, target);
    const conditionallySafe = Math.max(0, totalSafeBunks - immediatelySafe);
    const effectiveBunkCapacity = Math.min(totalSafeBunks, futureClassesRemaining);

    const percentageIfBunkedNext = total === 0 ? 0 : projectAfterAbsence(attended, total, 1);
    const statusIfBunkedNext = getAttendanceStatus(percentageIfBunkedNext, target);

    return {
      immediatelySafe,
      conditionallySafe,
      totalSafeBunks,
      effectiveBunkCapacity,
      statusIfBunkedNext,
      percentageIfBunkedNext,
    };
  }

  /**
   * Computes recovery requirements and evaluates feasibility against remaining scheduled classes.
   */
  calculateRecoveryInfo(
    attended: number,
    total: number,
    target: number,
    futureClassesAvailable: number,
    futureOccurrences: Array<{ date: string }> = []
  ): AttendanceRecoveryInfo {
    const currentPercentage = calculatePercentage(attended, total);
    const isNeeded = total > 0 && currentPercentage < target;

    if (!isNeeded) {
      return {
        isNeeded: false,
        consecutiveClassesNeeded: 0,
        projectedPercentageAfterRecovery: currentPercentage,
        futureClassesAvailable,
        isPossible: true,
      };
    }

    // Handle 100% target edge case
    if (target >= 100) {
      return {
        isNeeded: true,
        consecutiveClassesNeeded: 0,
        projectedPercentageAfterRecovery: currentPercentage,
        futureClassesAvailable,
        isPossible: false,
        impossibleReason: 'Cannot reach 100% attendance once a class has been missed.',
      };
    }

    const consecutiveClassesNeeded = calculateRecoveryClasses(attended, total, target);
    const isPossible = futureClassesAvailable >= consecutiveClassesNeeded;

    let impossibleReason: string | undefined;
    if (!isPossible) {
      impossibleReason = `Requires ${consecutiveClassesNeeded} consecutive classes to recover, but only ${futureClassesAvailable} scheduled classes remain this semester.`;
    }

    const projectedPercentageAfterRecovery = calculatePercentage(
      attended + consecutiveClassesNeeded,
      total + consecutiveClassesNeeded
    );

    let recoveryDeadlineDate: string | undefined;
    if (isPossible && consecutiveClassesNeeded > 0 && futureOccurrences.length >= consecutiveClassesNeeded) {
      recoveryDeadlineDate = futureOccurrences[consecutiveClassesNeeded - 1]?.date;
    }

    return {
      isNeeded: true,
      consecutiveClassesNeeded,
      projectedPercentageAfterRecovery,
      futureClassesAvailable,
      isPossible,
      impossibleReason,
      recoveryDeadlineDate,
    };
  }

  /**
   * Deterministically calculates attendance pressure level based on risk factors.
   */
  calculateAttendancePressure(
    status: AttendanceStatus,
    trend: AttendanceTrend,
    margin: number,
    recovery: AttendanceRecoveryInfo,
    examExposure?: UpcomingExamAttendanceExposure
  ): AttendancePressure {
    if (status === 'danger') {
      if (!recovery.isPossible) {
        return 'critical';
      }
      if (recovery.futureClassesAvailable > 0 && recovery.futureClassesAvailable - recovery.consecutiveClassesNeeded <= 1) {
        return 'critical';
      }
      if (examExposure && examExposure.daysUntil <= 14) {
        return 'critical';
      }
      return 'high';
    }

    if (status === 'watch') {
      if (trend === 'declining' || margin < 1.5 || (examExposure && examExposure.daysUntil <= 7)) {
        return 'high';
      }
      return 'medium';
    }

    // Status is 'safe'
    if (trend === 'declining' && margin < 6) {
      return 'medium';
    }
    if (examExposure && examExposure.daysUntil <= 7 && margin < 7) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Calculates exposure of attendance relative to upcoming exam.
   */
  calculateExamAttendanceExposure(
    subjectId: string,
    attended: number,
    total: number,
    target: number,
    futureOccurrences: Array<{ date: string; slot: TimetableSlot }>,
    exams: Exam[] = [],
    now: Date = new Date()
  ): UpcomingExamAttendanceExposure | undefined {
    const todayStr = formatLocalDate(now);
    const upcomingExams = exams
      .filter(e => e.subjectId === subjectId && e.date && e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (upcomingExams.length === 0) return undefined;

    const nextExam = upcomingExams[0];
    const daysUntilExam = daysUntil(nextExam.date, now);

    // Classes before the exam
    const classesBeforeExam = futureOccurrences.filter(o => o.date <= nextExam.date).length;
    const safeBunks = calculateSafeBunks(attended, total, target);
    const safeBunksBeforeExam = Math.min(safeBunks, classesBeforeExam);

    const currentPercentage = calculatePercentage(attended, total);
    const statusBeforeExam = getAttendanceStatus(currentPercentage, target);
    const isHighExposure = daysUntilExam <= 7 && (safeBunksBeforeExam === 0 || statusBeforeExam === 'danger');

    return {
      examId: nextExam.id,
      examName: nextExam.name,
      examDate: nextExam.date,
      daysUntil: daysUntilExam,
      classesBeforeExam,
      safeBunksBeforeExam,
      statusBeforeExam,
      isHighExposure,
    };
  }

  /**
   * Formulates a deterministic, student-centric attendance recommendation.
   */
  generateRecommendation(
    status: AttendanceStatus,
    percentage: number,
    target: number,
    safeBunks: SafeBunkBreakdown,
    recovery: AttendanceRecoveryInfo,
    trend: AttendanceTrend,
    examExposure?: UpcomingExamAttendanceExposure,
    totalClasses: number = 0
  ): string {
    if (totalClasses === 0) {
      return 'No classes recorded yet for this subject.';
    }

    if (status === 'danger') {
      if (!recovery.isPossible) {
        return recovery.impossibleReason || `Attendance is ${percentage.toFixed(1)}% (target ${target}%). Recovery is mathematically impossible in the remaining schedule.`;
      }
      return `Below target (${percentage.toFixed(1)}% vs ${target}%). Attend the next ${recovery.consecutiveClassesNeeded} consecutive scheduled classes to recover.`;
    }

    if (status === 'watch') {
      if (safeBunks.totalSafeBunks === 0) {
        return `At the margin (${percentage.toFixed(1)}%). Missing the next class will drop you below your ${target}% target. Do not bunk.`;
      }
      return `In the watch zone (${percentage.toFixed(1)}%). You have ${safeBunks.totalSafeBunks} safe bunk remaining, but skipping will move you close to danger.`;
    }

    // Status: safe
    if (safeBunks.totalSafeBunks > 0) {
      if (examExposure && examExposure.daysUntil <= 7) {
        return `Attendance is comfortable (${percentage.toFixed(1)}%), but exam is in ${examExposure.daysUntil} days. Preserve your safe bunks for study prep.`;
      }
      if (trend === 'declining') {
        return `Currently safe (${percentage.toFixed(1)}%), but attendance has been declining recently. You have ${safeBunks.totalSafeBunks} bunks in reserve.`;
      }
      return `Comfortably safe (${percentage.toFixed(1)}%). You have ${safeBunks.totalSafeBunks} safe bunks available without dropping below ${target}%.`;
    }

    return `Maintaining ${percentage.toFixed(1)}% attendance against ${target}% target.`;
  }

  /**
   * Generates a comprehensive Attendance Intelligence Snapshot for a specific subject.
   */
  getSubjectAttendanceSnapshot(
    subjectId: string,
    options?: AttendanceIntelligenceInput
  ): AttendanceIntelligenceSnapshot {
    const appState = useAppStore.getState();
    const academicState = useAcademicStore.getState();

    const subjects = options?.subjectsOverride || appState.subjects;
    const subject = subjects.find(s => s.id === subjectId) || {
      id: subjectId,
      name: 'Subject',
      targetAttendance: 75,
      code: '',
      color: '#3B82F6',
      semesterId: '',
      isArchived: false,
    } as Subject;

    const attDataMap = options?.attendanceDataOverride || appState.attendanceData;
    const att = attDataMap[subjectId] || { attended: 0, total: 0 };
    const target = subject.targetAttendance ?? (options?.attendanceTargetOverride ?? appState.attendanceTarget);
    const now = options?.now || new Date();

    const slots = options?.timetableSlotsOverride || academicState.timetableSlots;
    const semester = options?.semesterOverride || appState.semester;
    const classNotes = options?.classNotesOverride || academicState.classNotes.filter(n => n.subjectId === subjectId);
    const exams = options?.examsOverride || appState.exams;

    const currentPercentage = calculatePercentage(att.attended, att.total);
    const status = att.total === 0 ? 'safe' : getAttendanceStatus(currentPercentage, target);
    const safetyMargin = att.total === 0 ? 0 : currentPercentage - target;
    const missed = Math.max(0, att.total - att.attended);

    // 1. Trend
    const trend = this.deriveAttendanceTrend(classNotes);

    // 2. Future scheduled classes
    const { count: futureClassesRemaining, occurrences: futureOccurrences } =
      this.getFutureScheduledClasses(subjectId, slots, semester, now);

    // 3. Next scheduled class
    const todayStr = formatLocalDate(now);
    const nextSlotOccurrence = futureOccurrences.find(o => o.date >= todayStr);
    const nextScheduledClass = nextSlotOccurrence
      ? {
          date: nextSlotOccurrence.date,
          startTime: nextSlotOccurrence.slot.startTime,
          endTime: nextSlotOccurrence.slot.endTime,
          room: nextSlotOccurrence.slot.room,
        }
      : undefined;

    // 4. Safe bunks
    const safeBunks = this.calculateSafeBunkBreakdown(att.attended, att.total, target, futureClassesRemaining);

    // 5. Recovery
    const recovery = this.calculateRecoveryInfo(
      att.attended,
      att.total,
      target,
      futureClassesRemaining,
      futureOccurrences
    );

    // 6. Exam Exposure
    const examExposure = this.calculateExamAttendanceExposure(
      subjectId,
      att.attended,
      att.total,
      target,
      futureOccurrences,
      exams,
      now
    );

    // 7. Pressure
    const pressure = this.calculateAttendancePressure(status, trend, safetyMargin, recovery, examExposure);

    // 8. Classes until status change
    const toWatch = status === 'safe' ? safeBunks.immediatelySafe + 1 : 0;
    const toDanger = status !== 'danger' ? safeBunks.totalSafeBunks + 1 : 0;
    const toSafe = status !== 'safe' ? calculateClassesToSafe(att.attended, att.total, target) : 0;

    // 9. Recommendation
    const recommendation = this.generateRecommendation(
      status,
      currentPercentage,
      target,
      safeBunks,
      recovery,
      trend,
      examExposure,
      att.total
    );

    return {
      subjectId,
      subjectName: subject.name,
      attended: att.attended,
      total: att.total,
      missed,
      currentPercentage,
      targetPercentage: target,
      safetyMargin,
      status,
      trend,
      pressure,
      safeBunks,
      recovery,
      futureClassesRemaining,
      nextScheduledClass,
      examExposure,
      classesUntilStatusChange: {
        toWatch,
        toDanger,
        toSafe: toSafe === Infinity ? 0 : toSafe,
      },
      recommendation,
    };
  }

  /**
   * Interactive What-If attendance simulator supporting miss and attend simulations.
   */
  simulateWhatIf(
    input: AttendanceWhatIfInput,
    options?: AttendanceIntelligenceInput
  ): AttendanceWhatIfResult {
    const { subjectId, simulatedMisses = 0, simulatedPresents = 0 } = input;
    const baseSnapshot = this.getSubjectAttendanceSnapshot(subjectId, options);

    const newAttended = baseSnapshot.attended + simulatedPresents;
    const newTotal = baseSnapshot.total + simulatedMisses + simulatedPresents;
    const newMissed = Math.max(0, newTotal - newAttended);

    const projectedPercentage = calculatePercentage(newAttended, newTotal);
    const projectedStatus = getAttendanceStatus(projectedPercentage, baseSnapshot.targetPercentage);
    const projectedMargin = projectedPercentage - baseSnapshot.targetPercentage;
    const delta = projectedPercentage - baseSnapshot.currentPercentage;

    const safeBunksRemaining = calculateSafeBunks(newAttended, newTotal, baseSnapshot.targetPercentage);
    const recoveryClassesNeeded = calculateRecoveryClasses(newAttended, newTotal, baseSnapshot.targetPercentage);

    const isRecoverable = baseSnapshot.targetPercentage < 100 || newAttended === newTotal;
    const remainingClassesAfterSimulation = Math.max(0, baseSnapshot.futureClassesRemaining - simulatedMisses - simulatedPresents);
    const recoveryPossibleInSchedule = isRecoverable && recoveryClassesNeeded <= remainingClassesAfterSimulation;

    let recommendation: string;
    if (projectedStatus === 'danger') {
      recommendation = `This scenario drops you to ${projectedPercentage.toFixed(1)}% (below ${baseSnapshot.targetPercentage}% target). You would need ${recoveryClassesNeeded} consecutive classes to recover.`;
    } else if (projectedStatus === 'watch') {
      recommendation = `This scenario results in ${projectedPercentage.toFixed(1)}% attendance with ${safeBunksRemaining} safe bunks remaining. Margin is narrow.`;
    } else {
      recommendation = `Safe outcome. Projected attendance is ${projectedPercentage.toFixed(1)}% with ${safeBunksRemaining} safe bunks in reserve.`;
    }

    return {
      currentPercentage: baseSnapshot.currentPercentage,
      currentStatus: baseSnapshot.status,
      projectedPercentage,
      projectedStatus,
      projectedMargin,
      delta,
      newAttended,
      newTotal,
      newMissed,
      safeBunksRemaining,
      recoveryClassesNeeded: recoveryClassesNeeded === Infinity ? 0 : recoveryClassesNeeded,
      isRecoverable,
      recoveryPossibleInSchedule,
      recommendation,
    };
  }

  /**
   * Generates semester-wide attendance intelligence across all active subjects.
   */
  getSemesterAttendanceIntelligence(
    options?: AttendanceIntelligenceInput
  ): SemesterAttendanceIntelligenceSummary {
    const appState = useAppStore.getState();
    const subjects = (options?.subjectsOverride || appState.subjects).filter(s => !s.isArchived);
    const target = options?.attendanceTargetOverride ?? appState.attendanceTarget;

    const snapshots: Record<string, AttendanceIntelligenceSnapshot> = {};
    const dangerSubjects: AttendanceIntelligenceSnapshot[] = [];
    const watchSubjects: AttendanceIntelligenceSnapshot[] = [];
    const safeSubjects: AttendanceIntelligenceSnapshot[] = [];
    const highPressureSubjects: AttendanceIntelligenceSnapshot[] = [];
    const decliningTrendSubjects: AttendanceIntelligenceSnapshot[] = [];
    const recoveryRequiredSubjects: AttendanceIntelligenceSnapshot[] = [];

    let totalAttended = 0;
    let totalClasses = 0;
    let totalMissed = 0;
    let totalSafeBunks = 0;

    for (const sub of subjects) {
      const snap = this.getSubjectAttendanceSnapshot(sub.id, options);
      snapshots[sub.id] = snap;

      totalAttended += snap.attended;
      totalClasses += snap.total;
      totalMissed += snap.missed;
      totalSafeBunks += snap.safeBunks.totalSafeBunks;

      if (snap.status === 'danger') dangerSubjects.push(snap);
      else if (snap.status === 'watch') watchSubjects.push(snap);
      else safeSubjects.push(snap);

      if (snap.pressure === 'critical' || snap.pressure === 'high') {
        highPressureSubjects.push(snap);
      }

      if (snap.trend === 'declining') {
        decliningTrendSubjects.push(snap);
      }

      if (snap.recovery.isNeeded) {
        recoveryRequiredSubjects.push(snap);
      }
    }

    const overallPercentage = calculatePercentage(totalAttended, totalClasses);
    const overallStatus = getAttendanceStatus(overallPercentage, target);

    const snapshotList = Object.values(snapshots);
    let strongestSubject: { id: string; name: string; percentage: number } | undefined;
    let weakestSubject: { id: string; name: string; percentage: number } | undefined;

    if (snapshotList.length > 0) {
      const sortedByPct = [...snapshotList].sort((a, b) => b.currentPercentage - a.currentPercentage);
      strongestSubject = {
        id: sortedByPct[0].subjectId,
        name: sortedByPct[0].subjectName,
        percentage: sortedByPct[0].currentPercentage,
      };
      weakestSubject = {
        id: sortedByPct[sortedByPct.length - 1].subjectId,
        name: sortedByPct[sortedByPct.length - 1].subjectName,
        percentage: sortedByPct[sortedByPct.length - 1].currentPercentage,
      };
    }

    return {
      overallPercentage,
      overallStatus,
      targetPercentage: target,
      totalAttended,
      totalClasses,
      totalMissed,
      totalSafeBunks,
      strongestSubject,
      weakestSubject,
      dangerSubjects,
      watchSubjects,
      safeSubjects,
      highPressureSubjects,
      decliningTrendSubjects,
      recoveryRequiredSubjects,
      snapshots,
    };
  }
}

export const attendanceIntelligenceService = new AttendanceIntelligenceService();
