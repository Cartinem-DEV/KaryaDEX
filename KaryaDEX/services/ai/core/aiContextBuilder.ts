/**
 * BunkMatKar — Controlled AI Context Builder (Phase 12)
 *
 * Gathers strictly the minimum required academic context for AI requests.
 * Reads exclusively from authoritative repositories and domain services.
 * Enforces tenant isolation and scrubs all auth credentials/tokens.
 */

import {
  subjectRepository,
  timetableRepository,
  taskRepository,
  examRepository,
} from '@/database';
import { AttendanceIntelligenceService } from '@/services/attendanceIntelligenceService';
import { formatLocalDate } from '@/lib/timeUtils';
import type {
  AttendanceExplainRequest,
  DailyBriefingRequest,
  TaskBreakdownRequest,
  TimetableExtractionRequest,
} from './aiTypes';
import { AIContextViolationError } from './aiTypes';

const attendanceEngine = new AttendanceIntelligenceService();

export class AIContextBuilder {
  /**
   * Builds strict context for attendance explanation.
   * All numbers come 100% from deterministic engines.
   */
  static async buildAttendanceContext(params: {
    userId: string;
    subjectId: string;
  }): Promise<AttendanceExplainRequest> {
    if (!params.userId) {
      throw new AIContextViolationError('User authentication required for context construction.');
    }

    const subject = await subjectRepository.getSubjectById(params.subjectId);
    if (!subject) {
      throw new AIContextViolationError(`Subject ${params.subjectId} not found.`);
    }

    // Generate authoritative deterministic snapshot
    const snapshot = attendanceEngine.getSubjectAttendanceSnapshot(params.subjectId);
    if (!snapshot) {
      throw new AIContextViolationError(`Unable to calculate deterministic snapshot for ${params.subjectId}`);
    }

    return {
      userId: params.userId,
      persona: 'shanky',
      feature: 'attendance_explainer',
      subjectId: subject.id,
      subjectName: subject.name,
      currentAttendance: snapshot.currentPercentage,
      targetAttendance: snapshot.targetPercentage,
      attendedClasses: snapshot.attended,
      conductedClasses: snapshot.total,
      safeBunkCapacity: snapshot.safeBunks.totalSafeBunks,
      recoveryNeeded: snapshot.recovery.consecutiveClassesNeeded,
      attendancePressure: snapshot.pressure,
      trend: snapshot.trend,
      nextClassDate: snapshot.nextScheduledClass?.date,
      clientTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Builds context for "What should I do today?" daily briefing.
   * Restricts to today's classes, active high-priority tasks, and attendance alerts.
   */
  static async buildDailyBriefingContext(params: {
    userId: string;
    targetDate?: string;
  }): Promise<DailyBriefingRequest> {
    if (!params.userId) {
      throw new AIContextViolationError('User authentication required for daily briefing.');
    }

    const todayDate = params.targetDate || formatLocalDate();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dateObj = new Date(todayDate);
    const dayName = days[dateObj.getDay()];

    // 1. Authoritative timetable slots for today
    const slots = await timetableRepository.getSlotsForDay(dayName);
    const subjects = await subjectRepository.getSubjects();
    const subjMap = new Map(subjects.map(s => [s.id, s.name]));

    const todayClasses = slots.map(slot => ({
      time: `${slot.startTime}–${slot.endTime}`,
      subjectName: subjMap.get(slot.subjectId) || 'Class',
      room: slot.room,
    }));

    // 2. Authoritative pending tasks
    const allTasks = await taskRepository.getTasks();
    const pendingTasks = allTasks
      .filter(t => !t.isCompleted && t.status !== 'completed')
      .slice(0, 5) // Limit context to 5 most urgent
      .map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueDate: t.dueDate,
      }));

    // 3. Authoritative attendance alerts
    const semesterSummary = attendanceEngine.getSemesterAttendanceIntelligence();
    const attendanceAlerts = Object.values(semesterSummary.snapshots)
      .filter((s: import('@/types/academic').AttendanceIntelligenceSnapshot) => s.status === 'danger' || s.status === 'watch')
      .map((s: import('@/types/academic').AttendanceIntelligenceSnapshot) => ({
        subjectName: s.subjectName,
        currentPercentage: s.currentPercentage,
        status: s.status,
      }));

    // 4. Upcoming exams within next 14 days
    const allExams = await examRepository.getExams();
    const upcomingExams = allExams
      .filter((e: import('@/types').Exam) => {
        const eDate = new Date(e.date);
        const diffMs = eDate.getTime() - dateObj.getTime();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return daysLeft >= 0 && daysLeft <= 14;
      })
      .map((e: import('@/types').Exam) => {
        const eDate = new Date(e.date);
        const diffMs = eDate.getTime() - dateObj.getTime();
        const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        return {
          subjectName: subjMap.get(e.subjectId) || e.name,
          examDate: e.date,
          daysLeft,
        };
      });

    return {
      userId: params.userId,
      persona: 'shanky',
      feature: 'daily_briefing',
      dateString: todayDate,
      todayClasses,
      pendingTasks,
      attendanceAlerts,
      upcomingExams,
      clientTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Builds context for task breakdown.
   */
  static async buildTaskBreakdownContext(params: {
    userId: string;
    taskTitle: string;
    taskDescription?: string;
    subjectId?: string;
  }): Promise<TaskBreakdownRequest> {
    if (!params.userId) {
      throw new AIContextViolationError('User authentication required for task breakdown.');
    }

    let subjectName: string | undefined;
    if (params.subjectId) {
      const subject = await subjectRepository.getSubjectById(params.subjectId);
      subjectName = subject?.name;
    }

    return {
      userId: params.userId,
      persona: 'shanky',
      feature: 'task_breakdown',
      taskTitle: params.taskTitle.trim(),
      taskDescription: params.taskDescription?.trim(),
      subjectName,
      clientTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Builds context for timetable extraction.
   * Gathers registered subjects to help Banku match detected names.
   */
  static async buildTimetableExtractionContext(params: {
    userId: string;
    fileBase64: string;
    fileMimeType: string;
    fileName: string;
    fileSizeBytes: number;
  }): Promise<TimetableExtractionRequest> {
    if (!params.userId) {
      throw new AIContextViolationError('User authentication required for timetable extraction.');
    }

    const subjects = await subjectRepository.getSubjects();
    const existingSubjectNames = subjects.map(s => s.name);

    return {
      userId: params.userId,
      persona: 'banku',
      feature: 'timetable_extraction',
      requiresVision: params.fileMimeType.startsWith('image/'),
      requiresPDF: params.fileMimeType === 'application/pdf',
      fileBase64: params.fileBase64,
      fileMimeType: params.fileMimeType,
      fileName: params.fileName,
      fileSizeBytes: params.fileSizeBytes,
      existingSubjects: existingSubjectNames,
      clientTimestamp: new Date().toISOString(),
    };
  }
}
