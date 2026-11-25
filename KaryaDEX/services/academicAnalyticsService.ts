/**
 * KaryaDEX — Academic Analytics Service (Phase 6)
 *
 * Core intelligence engine providing:
 * - Attendance forecasting (miss N, attend N, mixed scenarios)
 * - Safe bunk recommendations per subject
 * - Semester-wide attendance forecast
 * - Deterministic Academic Health Index (6 dimensions, weighted)
 * - Canonical topic state derivation
 * - Full Semester Academic Snapshot
 *
 * All functions are pure and deterministic — no randomness, no AI.
 * They consume data from Zustand stores or explicit overrides for testing.
 */

import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';
import {
  calculatePercentage,
  getAttendanceStatus,
  calculateSafeBunks,
  calculateRecoveryClasses,
  projectAfterAbsence,
  projectAfterPresent,
} from '@/lib/attendance';
import { isTaskOverdue } from '@/lib/taskUtils';
import { daysUntil } from '@/lib/timeUtils';
import type { Subject, Exam, Task, Semester, AttendanceStatus } from '@/types';
import type {
  Topic,
  CanonicalTopicState,
  AttendanceForecast,
  AttendanceForecastScenario,
  BunkRecommendationItem,
  SemesterAttendanceForecast,
  SemesterHealthDimension,
  SemesterHealthReport,
  SemesterAcademicSnapshot,
  ClassOccurrence,
  RevisionStatus,
} from '@/types/academic';

// ─── Health Index Weights ────────────────────────────────────────
const HEALTH_WEIGHTS = {
  attendance: 0.20,
  tasks: 0.20,
  syllabus: 0.20,
  revision: 0.20,
  exams: 0.10,
  marks: 0.10,
} as const;

// ─── Data Input Interface (for testing / overrides) ──────────────
export interface AnalyticsDataInput {
  subjects?: Subject[];
  attendanceData?: Record<string, { attended: number; total: number }>;
  attendanceTarget?: number;
  tasks?: Task[];
  topics?: Topic[];
  exams?: Exam[];
  semester?: Semester;
  classOccurrences?: ClassOccurrence[];
  marks?: Array<{ subjectId: string; obtained: number; maxMarks: number }>;
  now?: Date;
}

export class AcademicAnalyticsService {
  // ─── Topic State Derivation ──────────────────────────────────
  /**
   * Derive canonical topic state from a topic's revision status.
   */
  deriveTopicState(topic: Topic): CanonicalTopicState {
    const status = topic.revisionStatus || 'not_started';
    if (status === 'revised') return 'revised';
    if (status === 'needs_revision') return 'needs_revision';
    if (status === 'taught') return 'taught';
    if (topic.isCompleted) return 'taught';
    return 'not_started';
  }

  // ─── Attendance Forecast (Single Subject) ────────────────────
  /**
   * Generate attendance forecast scenarios for a single subject.
   */
  getAttendanceForecast(
    attended: number,
    total: number,
    target: number,
    maxScenarios: number = 5
  ): AttendanceForecast {
    const currentPercentage = calculatePercentage(attended, total);
    const currentStatus = getAttendanceStatus(currentPercentage, target);
    const safeBunks = calculateSafeBunks(attended, total, target);
    const recoveryClasses = calculateRecoveryClasses(attended, total, target);
    const safetyMargin = currentPercentage - target;

    // Miss scenarios: what if I miss 1, 2, 3, ... N classes?
    const missScenarios: AttendanceForecastScenario[] = [];
    for (let n = 1; n <= maxScenarios; n++) {
      const projected = projectAfterAbsence(attended, total, n);
      const status = getAttendanceStatus(projected, target);
      missScenarios.push({
        missedCount: n,
        projectedPercentage: projected,
        status,
        delta: projected - currentPercentage,
      });
    }

    // Attend scenarios: what if I attend the next 1, 2, 3, ... N classes?
    const attendScenarios: Array<{
      attendCount: number;
      projectedPercentage: number;
      status: AttendanceStatus;
      delta: number;
    }> = [];
    for (let n = 1; n <= maxScenarios; n++) {
      const projected = projectAfterPresent(attended, total, n);
      const status = getAttendanceStatus(projected, target);
      attendScenarios.push({
        attendCount: n,
        projectedPercentage: projected,
        status,
        delta: projected - currentPercentage,
      });
    }

    return {
      currentPercentage,
      currentStatus,
      targetPercentage: target,
      safeBunks,
      recoveryClasses,
      safetyMargin,
      missScenarios,
      attendScenarios,
    };
  }

  // ─── Safe Bunk Recommendations ───────────────────────────────
  /**
   * For each subject, generate a bunk recommendation with context.
   */
  getBunkRecommendations(input?: AnalyticsDataInput): BunkRecommendationItem[] {
    const appState = useAppStore.getState();
    const subjects = input?.subjects || appState.subjects;
    const attData = input?.attendanceData || appState.attendanceData;
    const target = input?.attendanceTarget ?? appState.attendanceTarget;

    return subjects
      .filter(s => !s.isArchived)
      .map(subject => {
        const att = attData[subject.id] || { attended: 0, total: 0 };
        const currentAttendance = calculatePercentage(att.attended, att.total);
        const safeBunks = calculateSafeBunks(att.attended, att.total, target);
        const recoveryClasses = calculateRecoveryClasses(att.attended, att.total, target);
        const riskLevel = getAttendanceStatus(currentAttendance, target);

        let recommendation: string;
        if (att.total === 0) {
          recommendation = 'No classes recorded yet';
        } else if (safeBunks >= 5) {
          recommendation = `Safe to bunk. ${safeBunks} bunks available.`;
        } else if (safeBunks >= 1) {
          recommendation = `${safeBunks} bunk${safeBunks === 1 ? '' : 's'} left. Use wisely.`;
        } else if (recoveryClasses === 0) {
          recommendation = 'Exactly at target. Do not bunk.';
        } else {
          recommendation = `Below target. Need ${recoveryClasses} class${recoveryClasses === 1 ? '' : 'es'} to recover.`;
        }

        return {
          subject,
          attended: att.attended,
          total: att.total,
          currentAttendance,
          target,
          safeBunks,
          recoveryClasses,
          riskLevel,
          recommendation,
        };
      })
      .sort((a, b) => a.safeBunks - b.safeBunks); // Most at-risk first
  }

  // ─── Semester Attendance Forecast ────────────────────────────
  /**
   * Aggregate attendance forecast across all active subjects in a semester.
   */
  getSemesterAttendanceForecast(input?: AnalyticsDataInput): SemesterAttendanceForecast {
    const appState = useAppStore.getState();
    const subjects = (input?.subjects || appState.subjects).filter(s => !s.isArchived);
    const attData = input?.attendanceData || appState.attendanceData;
    const target = input?.attendanceTarget ?? appState.attendanceTarget;

    let totalAttended = 0;
    let totalClasses = 0;
    let plannedMissesTotal = 0;

    const breakdown = subjects.map(subject => {
      const att = attData[subject.id] || { attended: 0, total: 0 };
      totalAttended += att.attended;
      totalClasses += att.total;

      const currentPercentage = calculatePercentage(att.attended, att.total);
      const safeBunks = calculateSafeBunks(att.attended, att.total, target);
      const status = getAttendanceStatus(currentPercentage, target);
      plannedMissesTotal += safeBunks;

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        currentAttended: att.attended,
        currentTotal: att.total,
        plannedMisses: safeBunks,
        projectedPercentage: currentPercentage,
        status,
      };
    });

    const currentOverallPercentage = calculatePercentage(totalAttended, totalClasses);
    const overallStatus = getAttendanceStatus(currentOverallPercentage, target);

    return {
      currentOverallPercentage,
      projectedOverallPercentage: currentOverallPercentage, // No future projection without schedule data
      totalAttended,
      totalClasses,
      projectedTotalClasses: totalClasses,
      targetPercentage: target,
      status: overallStatus,
      plannedMissesTotal,
      breakdown,
    };
  }

  // ─── Academic Health Index ───────────────────────────────────
  /**
   * Deterministic Academic Health Report with 6 weighted dimensions:
   * Attendance 20%, Tasks 20%, Syllabus 20%, Revision 20%, Exams 10%, Marks 10%
   */
  getAcademicHealth(input?: AnalyticsDataInput): SemesterHealthReport {
    const appState = useAppStore.getState();
    const academicState = useAcademicStore.getState();
    const now = input?.now || new Date();

    const subjects = (input?.subjects || appState.subjects).filter(s => !s.isArchived);
    const attData = input?.attendanceData || appState.attendanceData;
    const target = input?.attendanceTarget ?? appState.attendanceTarget;
    const tasks = input?.tasks || appState.tasks;
    const topics = input?.topics || academicState.topics;
    const exams = input?.exams || appState.exams;
    const marksList = input?.marks || appState.marks;

    // ── 1. Attendance Dimension ──────────────────────────────
    let totalAttended = 0;
    let totalClasses = 0;
    for (const s of subjects) {
      const att = attData[s.id] || { attended: 0, total: 0 };
      totalAttended += att.attended;
      totalClasses += att.total;
    }
    const overallAttPct = calculatePercentage(totalAttended, totalClasses);
    const attendanceScore = totalClasses === 0
      ? 50 // Neutral when no classes yet
      : Math.min(100, (overallAttPct / target) * 100);
    const attendanceStatus = totalClasses === 0
      ? 'neutral'
      : this.scoreToDimensionStatus(attendanceScore);

    const attendance: SemesterHealthDimension = {
      name: 'attendance',
      label: 'Attendance',
      score: Math.round(attendanceScore),
      weight: HEALTH_WEIGHTS.attendance,
      detail: totalClasses === 0
        ? 'No classes recorded yet'
        : `${overallAttPct.toFixed(1)}% overall (target: ${target}%)`,
      status: attendanceStatus,
    };

    // ── 2. Tasks Dimension ───────────────────────────────────
    const activeTasks = tasks.filter(t => t.subjectId ? subjects.some(s => s.id === t.subjectId) : false);
    const totalTasks = activeTasks.length;
    const completedTasks = activeTasks.filter(t => t.isCompleted || t.status === 'completed').length;
    const overdueTasks = activeTasks.filter(t => !t.isCompleted && t.status !== 'completed' && isTaskOverdue(t, now)).length;

    let taskScore: number;
    if (totalTasks === 0) {
      taskScore = 50; // Neutral
    } else {
      const completionRate = (completedTasks / totalTasks) * 100;
      const overduePenalty = Math.min(30, overdueTasks * 10);
      taskScore = Math.max(0, Math.min(100, completionRate - overduePenalty));
    }

    const tasksHealth: SemesterHealthDimension = {
      name: 'tasks',
      label: 'Tasks',
      score: Math.round(taskScore),
      weight: HEALTH_WEIGHTS.tasks,
      detail: totalTasks === 0
        ? 'No tasks created yet'
        : `${completedTasks}/${totalTasks} completed, ${overdueTasks} overdue`,
      status: totalTasks === 0 ? 'neutral' : this.scoreToDimensionStatus(taskScore),
    };

    // ── 3. Syllabus Dimension ────────────────────────────────
    const subjectIds = new Set(subjects.map(s => s.id));
    const semesterTopics = topics.filter(t => subjectIds.has(t.subjectId));
    const totalTopics = semesterTopics.length;
    const coveredTopics = semesterTopics.filter(t =>
      t.isCompleted ||
      t.revisionStatus === 'taught' ||
      t.revisionStatus === 'revised' ||
      t.revisionStatus === 'needs_revision'
    ).length;

    const syllabusScore = totalTopics === 0
      ? 50 // Neutral
      : (coveredTopics / totalTopics) * 100;

    const syllabusHealth: SemesterHealthDimension = {
      name: 'syllabus',
      label: 'Syllabus',
      score: Math.round(syllabusScore),
      weight: HEALTH_WEIGHTS.syllabus,
      detail: totalTopics === 0
        ? 'No syllabus topics added yet'
        : `${coveredTopics}/${totalTopics} topics covered`,
      status: totalTopics === 0 ? 'neutral' : this.scoreToDimensionStatus(syllabusScore),
    };

    // ── 4. Revision Dimension ────────────────────────────────
    const taughtTopics = semesterTopics.filter(t =>
      t.isCompleted ||
      t.revisionStatus === 'taught' ||
      t.revisionStatus === 'revised' ||
      t.revisionStatus === 'needs_revision'
    );

    let revisionScore: number;
    let revisionDetail: string;

    if (taughtTopics.length === 0) {
      revisionScore = 50; // Neutral
      revisionDetail = 'No topics taught yet';
    } else {
      const records = academicState.revisionRecords || [];
      const latestByTopic = new Map<string, { outcome: string; confidence: string; reviewedAt: string }>();
      for (const rec of records) {
        const prev = latestByTopic.get(rec.topicId);
        if (!prev || rec.reviewedAt > prev.reviewedAt) {
          latestByTopic.set(rec.topicId, rec);
        }
      }

      let confidentCount = 0;
      let okayCount = 0;
      let needsReviewCount = 0;

      for (const t of taughtTopics) {
        const latest = latestByTopic.get(t.id);
        if (latest) {
          if (latest.outcome === 'confident') confidentCount++;
          else if (latest.outcome === 'needs_review') needsReviewCount++;
          else okayCount++;
        } else {
          if (t.revisionStatus === 'revised') confidentCount++;
          else if (t.revisionStatus === 'needs_revision') needsReviewCount++;
        }
      }

      const totalTaught = taughtTopics.length;
      const scoreRaw = ((confidentCount * 100) + (okayCount * 70) + (needsReviewCount * 20)) / totalTaught;
      revisionScore = Math.max(0, Math.min(100, Math.round(scoreRaw)));
      revisionDetail = `${confidentCount + okayCount}/${totalTaught} revised (${confidentCount} confident), ${needsReviewCount} need revision`;
    }

    const revisionHealth: SemesterHealthDimension = {
      name: 'revision',
      label: 'Revision',
      score: revisionScore,
      weight: HEALTH_WEIGHTS.revision,
      detail: revisionDetail,
      status: taughtTopics.length === 0 ? 'neutral' : this.scoreToDimensionStatus(revisionScore),
    };

    // ── 5. Exams Dimension ───────────────────────────────────
    const semesterExams = exams.filter(e => subjectIds.has(e.subjectId));
    const upcomingExams = semesterExams.filter(e => e.date && daysUntil(e.date, now) >= 0);
    const pastExams = semesterExams.filter(e => e.date && daysUntil(e.date, now) < 0);
    const urgentExams = upcomingExams.filter(e => daysUntil(e.date, now) <= 3);

    let examScore: number;
    if (semesterExams.length === 0) {
      examScore = 50; // Neutral
    } else {
      // Base: high score if no urgent unplanned exams
      examScore = urgentExams.length === 0 ? 80 : Math.max(30, 80 - urgentExams.length * 15);
      // Bonus for having past exams completed
      if (pastExams.length > 0) {
        examScore = Math.min(100, examScore + 10);
      }
    }

    const examsHealth: SemesterHealthDimension = {
      name: 'exams',
      label: 'Exams',
      score: Math.round(examScore),
      weight: HEALTH_WEIGHTS.exams,
      detail: semesterExams.length === 0
        ? 'No exams scheduled'
        : `${upcomingExams.length} upcoming, ${urgentExams.length} within 3 days`,
      status: semesterExams.length === 0 ? 'neutral' : this.scoreToDimensionStatus(examScore),
    };

    // ── 6. Marks Dimension ───────────────────────────────────
    const semesterMarks = marksList.filter(m => subjectIds.has(m.subjectId));
    let marksScore: number;
    let marksDetail: string;
    if (semesterMarks.length === 0) {
      marksScore = 50; // Neutral
      marksDetail = 'No marks recorded yet';
    } else {
      const totalObtained = semesterMarks.reduce((acc, m) => acc + m.obtained, 0);
      const totalMax = semesterMarks.reduce((acc, m) => acc + m.maxMarks, 0);
      const overallPct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
      marksScore = overallPct;
      marksDetail = `${totalObtained}/${totalMax} (${overallPct.toFixed(1)}%)`;
    }

    const marksHealth: SemesterHealthDimension = {
      name: 'marks',
      label: 'Marks',
      score: Math.round(marksScore),
      weight: HEALTH_WEIGHTS.marks,
      detail: marksDetail,
      status: semesterMarks.length === 0 ? 'neutral' : this.scoreToDimensionStatus(marksScore),
    };

    // ── Overall Score ────────────────────────────────────────
    const overallScore = Math.round(
      attendance.score * HEALTH_WEIGHTS.attendance +
      tasksHealth.score * HEALTH_WEIGHTS.tasks +
      syllabusHealth.score * HEALTH_WEIGHTS.syllabus +
      revisionHealth.score * HEALTH_WEIGHTS.revision +
      examsHealth.score * HEALTH_WEIGHTS.exams +
      marksHealth.score * HEALTH_WEIGHTS.marks
    );

    // ── Main Attention Area ──────────────────────────────────
    const dimensions = { attendance, tasks: tasksHealth, syllabus: syllabusHealth, revision: revisionHealth, exams: examsHealth, marks: marksHealth };
    const mainAttentionArea = this.findWeakestArea(dimensions);

    return {
      overallScore,
      dimensions,
      mainAttentionArea,
    };
  }

  // ─── Semester Academic Snapshot ───────────────────────────────
  /**
   * Comprehensive snapshot of an entire semester's academic state.
   */
  getSemesterAcademicSnapshot(input?: AnalyticsDataInput): SemesterAcademicSnapshot {
    const appState = useAppStore.getState();
    const academicState = useAcademicStore.getState();
    const now = input?.now || new Date();

    const semester = input?.semester || appState.semester;
    if (!semester) {
      // Return a minimal empty snapshot
      return this.emptySnapshot();
    }

    const allSubjects = input?.subjects || appState.subjects;
    const activeSubjects = allSubjects.filter(s => !s.isArchived);
    const archivedSubjects = allSubjects.filter(s => s.isArchived);

    const attData = input?.attendanceData || appState.attendanceData;
    const target = input?.attendanceTarget ?? appState.attendanceTarget;
    const tasks = input?.tasks || appState.tasks;
    const topics = input?.topics || academicState.topics;
    const exams = input?.exams || appState.exams;
    const marksList = input?.marks || appState.marks;

    // Attendance
    let totalAttended = 0;
    let totalClasses = 0;
    for (const s of activeSubjects) {
      const att = attData[s.id] || { attended: 0, total: 0 };
      totalAttended += att.attended;
      totalClasses += att.total;
    }
    const overallPercentage = calculatePercentage(totalAttended, totalClasses);
    const safeBunks = calculateSafeBunks(totalAttended, totalClasses, target);
    const recoveryClasses = calculateRecoveryClasses(totalAttended, totalClasses, target);

    // Tasks
    const subjectIds = new Set(activeSubjects.map(s => s.id));
    const semTasks = tasks.filter(t => t.subjectId ? subjectIds.has(t.subjectId) : false);
    const pendingTasks = semTasks.filter(t => !t.isCompleted && t.status !== 'completed');
    const overdueTasks = pendingTasks.filter(t => isTaskOverdue(t, now));
    const completedTasks = semTasks.filter(t => t.isCompleted || t.status === 'completed');
    const workloadMinutes = pendingTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);

    // Syllabus
    const semTopics = topics.filter(t => subjectIds.has(t.subjectId));
    const totalTopics = semTopics.length;
    const taughtTopics = semTopics.filter(t =>
      t.isCompleted ||
      t.revisionStatus === 'taught' ||
      t.revisionStatus === 'revised' ||
      t.revisionStatus === 'needs_revision'
    ).length;
    const revisedTopics = semTopics.filter(t => t.revisionStatus === 'revised').length;
    const backlogTopics = semTopics.filter(t => t.revisionStatus === 'needs_revision' || t.revisionStatus === 'taught').length;
    const coveragePercentage = totalTopics > 0 ? (taughtTopics / totalTopics) * 100 : 0;
    const revisionPercentage = taughtTopics > 0 ? (revisedTopics / taughtTopics) * 100 : 0;

    // Exams
    const semExams = exams.filter(e => subjectIds.has(e.subjectId));
    const upcomingExamsList = semExams.filter(e => e.date && daysUntil(e.date, now) >= 0).sort((a, b) => a.date.localeCompare(b.date));
    const upcomingExam = upcomingExamsList.length > 0 ? upcomingExamsList[0] : null;
    const daysUntilExam = upcomingExam ? daysUntil(upcomingExam.date, now) : undefined;

    // Marks
    const semMarks = marksList.filter(m => subjectIds.has(m.subjectId));
    const totalObtained = semMarks.reduce((acc, m) => acc + m.obtained, 0);
    const totalMax = semMarks.reduce((acc, m) => acc + m.maxMarks, 0);
    const marksPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : null;

    // Health
    const health = this.getAcademicHealth(input);

    // Bunk Recommendations
    const bunkRecommendations = this.getBunkRecommendations(input);

    return {
      semester,
      subjectCount: activeSubjects.length,
      activeSubjects,
      archivedSubjects,
      classCount: totalClasses,
      attendanceSummary: {
        overallPercentage,
        totalAttended,
        totalClasses,
        safeBunks,
        recoveryClasses,
      },
      taskSummary: {
        pending: pendingTasks.length,
        overdue: overdueTasks.length,
        completed: completedTasks.length,
        workloadMinutes,
      },
      syllabusSummary: {
        totalTopics,
        taughtTopics,
        revisedTopics,
        backlogTopics,
        coveragePercentage,
        revisionPercentage,
      },
      examSummary: {
        totalExams: semExams.length,
        upcomingExam,
        daysUntilExam,
      },
      marksSummary: {
        totalObtained,
        totalMax,
        overallPercentage: marksPercentage,
      },
      health,
      bunkRecommendations,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private scoreToDimensionStatus(score: number): 'healthy' | 'warning' | 'critical' | 'neutral' {
    if (score >= 70) return 'healthy';
    if (score >= 50) return 'warning';
    return 'critical';
  }

  private findWeakestArea(dimensions: SemesterHealthReport['dimensions']): SemesterHealthReport['mainAttentionArea'] {
    const entries = Object.entries(dimensions) as [string, SemesterHealthDimension][];

    // Filter out neutral dimensions (empty data)
    const meaningful = entries.filter(([, d]) => d.status !== 'neutral');
    if (meaningful.length === 0) return null;

    // Find the lowest scoring dimension
    meaningful.sort((a, b) => a[1].score - b[1].score);
    const [name, dim] = meaningful[0];

    if (dim.status === 'healthy') return null; // Everything is fine

    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (dim.score < 30) severity = 'critical';
    else if (dim.score < 50) severity = 'high';
    else if (dim.score < 70) severity = 'medium';
    else severity = 'low';

    const titleMap: Record<string, string> = {
      attendance: 'Attendance Needs Attention',
      tasks: 'Task Backlog Growing',
      syllabus: 'Syllabus Progress Behind',
      revision: 'Revision Backlog Building',
      exams: 'Exam Preparation Needed',
      marks: 'Marks Need Improvement',
    };

    return {
      dimension: name,
      title: titleMap[name] || `${dim.label} Needs Attention`,
      subtitle: dim.detail,
      severity,
    };
  }

  private emptySnapshot(): SemesterAcademicSnapshot {
    return {
      semester: { id: '', name: '', number: 0, startDate: '', endDate: '', collegeId: '' },
      subjectCount: 0,
      activeSubjects: [],
      archivedSubjects: [],
      classCount: 0,
      attendanceSummary: {
        overallPercentage: 0,
        totalAttended: 0,
        totalClasses: 0,
        safeBunks: 0,
        recoveryClasses: 0,
      },
      taskSummary: { pending: 0, overdue: 0, completed: 0, workloadMinutes: 0 },
      syllabusSummary: {
        totalTopics: 0,
        taughtTopics: 0,
        revisedTopics: 0,
        backlogTopics: 0,
        coveragePercentage: 0,
        revisionPercentage: 0,
      },
      examSummary: { totalExams: 0, upcomingExam: null },
      marksSummary: { totalObtained: 0, totalMax: 0, overallPercentage: null },
      health: {
        overallScore: 50,
        dimensions: {
          attendance: { name: 'attendance', label: 'Attendance', score: 50, weight: 0.20, detail: 'No data', status: 'neutral' },
          tasks: { name: 'tasks', label: 'Tasks', score: 50, weight: 0.20, detail: 'No data', status: 'neutral' },
          syllabus: { name: 'syllabus', label: 'Syllabus', score: 50, weight: 0.20, detail: 'No data', status: 'neutral' },
          revision: { name: 'revision', label: 'Revision', score: 50, weight: 0.20, detail: 'No data', status: 'neutral' },
          exams: { name: 'exams', label: 'Exams', score: 50, weight: 0.10, detail: 'No data', status: 'neutral' },
          marks: { name: 'marks', label: 'Marks', score: 50, weight: 0.10, detail: 'No data', status: 'neutral' },
        },
        mainAttentionArea: null,
      },
      bunkRecommendations: [],
    };
  }
}

export const academicAnalyticsService = new AcademicAnalyticsService();
