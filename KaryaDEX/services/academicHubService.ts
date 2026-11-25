/**
 * KaryaDEX — Academic Hub Service (Phase 4)
 *
 * Provides a unified, high-performance academic intelligence layer:
 * - Single TodayAcademicSnapshot derived from canonical data
 * - Real workload calculations (today, tomorrow, week, overdue)
 * - Context-aware attention prioritization (critical, high, medium, low)
 * - Post-class journal signal detection
 * - Topic-centric academic context ("Everything about this topic")
 * - Subject academic summary / snapshot
 */

import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';
import { formatLocalDate, timeToMinutes, daysUntil } from '@/lib/timeUtils';
import { isTaskOverdue, calculateWorkload, formatWorkload } from '@/lib/taskUtils';
import { calculatePercentage, getAttendanceStatus, calculateSafeBunks, calculateRecoveryClasses } from '@/lib/attendance';
import type { Task, Subject, Exam } from '@/types';
import type {
  ClassOccurrence,
  Topic,
  SyllabusUnit,
  Resource,
  RevisionStatus,
  ExamTopic,
  TodayAcademicSnapshot,
  AcademicAttentionItem,
  TopicAcademicContext,
  SubjectAcademicSnapshot,
  WorkloadReport,
} from '@/types/academic';

export class AcademicHubService {
  /**
   * Generates a complete academic snapshot for Today.
   */
  getTodayAcademicSnapshot(options?: {
    now?: Date;
    tasksOverride?: Task[];
    subjectsOverride?: Subject[];
    examsOverride?: Exam[];
    classesOverride?: ClassOccurrence[];
    topicsOverride?: Topic[];
    attendanceDataOverride?: Record<string, { attended: number; total: number }>;
    attendanceTargetOverride?: number;
  }): TodayAcademicSnapshot {
    const now = options?.now || new Date();
    const todayStr = formatLocalDate(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const appState = useAppStore.getState();
    const academicState = useAcademicStore.getState();

    const subjects = options?.subjectsOverride || appState.subjects;
    const tasks = options?.tasksOverride || appState.tasks;
    const exams = options?.examsOverride || appState.exams;

    // 1. Classes for today
    const todayClasses = options?.classesOverride || academicState.getClassOccurrencesForDate(todayStr);

    let currentClass: ClassOccurrence | null = null;
    let nextClass: ClassOccurrence | null = null;
    const completedClasses: ClassOccurrence[] = [];
    const unrecordedClasses: ClassOccurrence[] = [];

    for (const occ of todayClasses) {
      const startMin = occ.startTime ? timeToMinutes(occ.startTime) : 0;
      const endMin = occ.endTime ? timeToMinutes(occ.endTime) : startMin + 60;

      if (nowMinutes >= startMin && nowMinutes < endMin) {
        currentClass = occ;
      } else if (nowMinutes < startMin) {
        if (!nextClass || startMin < (nextClass.startTime ? timeToMinutes(nextClass.startTime) : Infinity)) {
          nextClass = occ;
        }
      } else if (nowMinutes >= endMin) {
        completedClasses.push(occ);
        if (this.isSessionEligibleForJournalReminder(occ, now)) {
          unrecordedClasses.push(occ);
        }
      }
    }

    // 2. Tasks & Workload
    const pendingTasks = tasks.filter(t => !t.isCompleted && t.status !== 'completed');
    const overdueTasks = pendingTasks.filter(t => isTaskOverdue(t, now));

    const todayDueTasks = pendingTasks.filter(t => t.dueDate === todayStr);
    const todayWorkloadMinutes = todayDueTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
    const todayWorkloadFormatted = formatWorkload(todayWorkloadMinutes);

    // 3. Upcoming Exam (nearest future exam)
    const upcomingExams = exams
      .filter(e => e.date && daysUntil(e.date, now) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const upcomingExam = upcomingExams.length > 0 ? upcomingExams[0] : null;
    const daysUntilExam = upcomingExam ? daysUntil(upcomingExam.date, now) : undefined;

    // 4. Revision Backlog
    const revisionBacklog = options?.topicsOverride
      ? options.topicsOverride.filter(t => t.revisionStatus === 'taught' || t.revisionStatus === 'needs_revision')
      : academicState.getTopicsTaughtNotRevised();
    const revisionBacklogCount = revisionBacklog.length;
    const missingJournalCount = unrecordedClasses.length;

    // 5. Context-aware Attention Items
    const attentionItems = this.getAcademicAttentionItems({
      now,
      todayClasses,
      unrecordedClasses,
      pendingTasks,
      overdueTasks,
      upcomingExams,
      revisionBacklog,
      attendanceData: options?.attendanceDataOverride || appState.attendanceData,
      attendanceTarget: options?.attendanceTargetOverride ?? appState.attendanceTarget,
      subjects,
    });

    return {
      currentClass,
      nextClass,
      todayClasses,
      completedClasses,
      unrecordedClasses,
      pendingTasks,
      overdueTasks,
      todayWorkloadMinutes,
      todayWorkloadFormatted,
      upcomingExam,
      daysUntilExam,
      revisionBacklogCount,
      missingJournalCount,
      attentionItems,
    };
  }

  /**
   * Checks whether a class session has ended without meaningful academic records.
   */
  isSessionEligibleForJournalReminder(occurrence: ClassOccurrence, now: Date = new Date()): boolean {
    if (occurrence.attendanceStatus === 'cancelled' || occurrence.attendanceStatus === 'not_recorded') {
      return false;
    }

    // Must be in the past
    const todayStr = formatLocalDate(now);
    if (occurrence.date > todayStr) {
      return false;
    }
    if (occurrence.date === todayStr && occurrence.endTime) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const endMin = timeToMinutes(occurrence.endTime);
      if (nowMin < endMin) {
        return false;
      }
    }

    const note = occurrence.note;
    if (!note) {
      return true;
    }

    const hasTopics = Array.isArray(note.topicIds) && note.topicIds.length > 0;
    const hasMyNotes = Boolean(note.myNotes && note.myNotes.trim().length > 0);
    const hasTeacherNotes = Boolean(note.teacherNotes && note.teacherNotes.trim().length > 0);
    const academicState = useAcademicStore.getState();
    const hasResources = academicState.getResourcesForClassNote(note.id).length > 0;

    return !hasTopics && !hasMyNotes && !hasTeacherNotes && !hasResources;
  }

  /**
   * Generates prioritized context-aware attention events.
   */
  getAcademicAttentionItems(params: {
    now: Date;
    todayClasses: ClassOccurrence[];
    unrecordedClasses: ClassOccurrence[];
    pendingTasks: Task[];
    overdueTasks: Task[];
    upcomingExams: Exam[];
    revisionBacklog: Topic[];
    attendanceData: Record<string, { attended: number; total: number }>;
    attendanceTarget: number;
    subjects: Subject[];
  }): AcademicAttentionItem[] {
    const items: AcademicAttentionItem[] = [];
    const todayStr = formatLocalDate(params.now);

    // 1. Severe Attendance Risk (Critical)
    for (const sub of params.subjects) {
      const att = params.attendanceData[sub.id];
      if (att && att.total > 0) {
        const pct = calculatePercentage(att.attended, att.total);
        if (pct < params.attendanceTarget - 5) {
          items.push({
            id: `att-risk-${sub.id}`,
            type: 'attendance_risk',
            priority: 'critical',
            title: `${sub.shortName} Attendance Critical (${pct.toFixed(0)}%)`,
            subtitle: `Below target of ${params.attendanceTarget}%. Bunks depleted!`,
            subjectId: sub.id,
            actionLabel: 'View Subject',
            actionRoute: `/subject/${sub.id}`,
          });
        } else if (pct < params.attendanceTarget) {
          items.push({
            id: `att-risk-${sub.id}`,
            type: 'attendance_risk',
            priority: 'high',
            title: `${sub.shortName} Attendance Low (${pct.toFixed(0)}%)`,
            subtitle: `Must attend upcoming classes to reach ${params.attendanceTarget}%.`,
            subjectId: sub.id,
            actionLabel: 'View Subject',
            actionRoute: `/subject/${sub.id}`,
          });
        }
      }
    }

    // 2. Overdue Urgent & High Priority Tasks (Critical / High)
    for (const task of params.overdueTasks) {
      const isUrgent = task.priority === 'urgent' || task.priority === 'high';
      items.push({
        id: `overdue-task-${task.id}`,
        type: 'overdue_task',
        priority: isUrgent ? 'critical' : 'high',
        title: `Overdue: ${task.title}`,
        subtitle: `Deadline passed (${task.dueDate || 'earlier'}) · ${task.priority.toUpperCase()}`,
        subjectId: task.subjectId,
        taskId: task.id,
        actionLabel: 'View Tasks',
        actionRoute: '/tasks',
      });
    }

    // 3. Exams Today (Critical) & Exams in <= 3 Days (High)
    for (const exam of params.upcomingExams) {
      const days = daysUntil(exam.date, params.now);
      if (days === 0) {
        items.push({
          id: `exam-today-${exam.id}`,
          type: 'upcoming_exam',
          priority: 'critical',
          title: `Exam Today: ${exam.name}`,
          subtitle: `Time: ${exam.time || 'Check schedule'}${exam.room ? ` · Room ${exam.room}` : ''}`,
          subjectId: exam.subjectId,
          examId: exam.id,
          actionLabel: 'View Exam',
          actionRoute: `/subject/${exam.subjectId}`,
        });
      } else if (days <= 3) {
        items.push({
          id: `exam-soon-${exam.id}`,
          type: 'upcoming_exam',
          priority: 'high',
          title: `Exam in ${days} day${days > 1 ? 's' : ''}: ${exam.name}`,
          subtitle: `Date: ${exam.date} · Review syllabus and revision topics`,
          subjectId: exam.subjectId,
          examId: exam.id,
          actionLabel: 'Prepare',
          actionRoute: `/subject/${exam.subjectId}`,
        });
      }
    }

    // 4. Missing Class Journal (Medium)
    for (const occ of params.unrecordedClasses) {
      const sub = params.subjects.find(s => s.id === occ.subjectId);
      const subName = sub ? sub.shortName : 'Class';
      items.push({
        id: `missing-journal-${occ.slotId}-${occ.date}`,
        type: 'missing_journal',
        priority: 'medium',
        title: `Record Today's ${subName} Class`,
        subtitle: `Class ended at ${occ.endTime || 'earlier'}. Add topics & notes while fresh.`,
        subjectId: occ.subjectId,
        classSessionId: occ.slotId,
        actionLabel: 'Record',
      });
    }

    // 5. Tasks Due Today (Medium)
    const dueTodayTasks = params.pendingTasks.filter(t => t.dueDate === todayStr && !isTaskOverdue(t, params.now));
    for (const task of dueTodayTasks) {
      items.push({
        id: `task-due-${task.id}`,
        type: 'task_due',
        priority: 'medium',
        title: `Due Today: ${task.title}`,
        subtitle: `Priority: ${task.priority.toUpperCase()}${task.dueTime ? ` · ${task.dueTime}` : ''}`,
        subjectId: task.subjectId,
        taskId: task.id,
        actionLabel: 'Complete',
        actionRoute: '/tasks',
      });
    }

    // 6. Revision Backlog (High if >= 3, Medium otherwise)
    if (params.revisionBacklog.length > 0) {
      const count = params.revisionBacklog.length;
      items.push({
        id: 'revision-backlog-summary',
        type: 'revision_backlog',
        priority: count >= 3 ? 'high' : 'medium',
        title: `${count} Topic${count > 1 ? 's' : ''} Need Revision`,
        subtitle: `Covered in class but not yet revised: ${params.revisionBacklog.slice(0, 2).map(t => t.name).join(', ')}${count > 2 ? '...' : ''}`,
        actionLabel: 'Review',
      });
    }

    // 7. Critical Revision Topics for Upcoming Exam
    try {
      const { revisionIntelligenceService } = require('./revisionIntelligenceService');
      const criticalTopics = revisionIntelligenceService.getCriticalAndHighPriorityTopics(2, params.now);
      for (const cTopic of criticalTopics) {
        if (cTopic.revisionPriority === 'critical' && cTopic.upcomingExam) {
          items.push({
            id: `crit-rev-${cTopic.topicId}`,
            type: 'revision_backlog',
            priority: 'critical',
            title: `Critical Revision: ${cTopic.topicName}`,
            subtitle: `Exam "${cTopic.upcomingExam.name}" in ${cTopic.upcomingExam.daysUntil} day(s).`,
            subjectId: cTopic.subjectId,
            topicId: cTopic.topicId,
            actionLabel: 'Revise',
            actionRoute: `/subject/${cTopic.subjectId}`,
          });
        }
      }
    } catch {
      // Safe fallback if revision service not ready
    }

    // 8. Attendance Risk & Danger Items
    try {
      const { attendanceIntelligenceService } = require('./attendanceIntelligenceService');
      const attendanceSummary = attendanceIntelligenceService.getSemesterAttendanceIntelligence({
        subjectsOverride: params.subjects,
        attendanceDataOverride: params.attendanceData,
        attendanceTargetOverride: params.attendanceTarget,
        now: params.now,
      });

      for (const dSub of attendanceSummary.dangerSubjects) {
        items.push({
          id: `att-danger-${dSub.subjectId}`,
          type: 'attendance_risk',
          priority: 'critical',
          title: `Attendance Danger: ${dSub.subjectName}`,
          subtitle: `${dSub.currentPercentage.toFixed(1)}% (below ${dSub.targetPercentage}%). Need ${dSub.recovery.consecutiveClassesNeeded} consecutive classes to recover.`,
          subjectId: dSub.subjectId,
          actionLabel: 'Details',
          actionRoute: `/subject/${dSub.subjectId}`,
        });
      }

      for (const wSub of attendanceSummary.watchSubjects) {
        if (wSub.safeBunks.totalSafeBunks === 0) {
          items.push({
            id: `att-watch-${wSub.subjectId}`,
            type: 'attendance_risk',
            priority: 'high',
            title: `Attendance Warning: ${wSub.subjectName}`,
            subtitle: `${wSub.currentPercentage.toFixed(1)}% (target ${wSub.targetPercentage}%). 0 safe bunks remaining before entering danger.`,
            subjectId: wSub.subjectId,
            actionLabel: 'Details',
            actionRoute: `/subject/${wSub.subjectId}`,
          });
        }
      }
    } catch {
      // Safe fallback if intelligence service not ready
    }

    // 9. Workload Overload Attention
    try {
      const { studyPlanningService } = require('./studyPlanningService');
      const workload = studyPlanningService.calculateDailyWorkload(todayStr, {
        now: params.now,
        tasksOverride: params.pendingTasks,
        subjectsOverride: params.subjects,
      });
      if (workload.isOverloaded) {
        items.push({
          id: `workload-overload-${todayStr}`,
          type: 'workload_overload' as any,
          priority: 'high',
          title: 'Study Capacity Exceeded Today',
          subtitle: workload.explanation,
          actionLabel: 'View Plan',
          actionRoute: '/(tabs)/schedule',
        });
      }
    } catch {
      // Safe fallback if planning service not ready
    }

    // Sort by priority order: critical -> high -> medium -> low
    const priorityWeight: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return items.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
  }

  /**
   * Workload query methods
   */
  getTodayWorkload(tasksOverrideOrNow?: Task[] | Date, now?: Date): WorkloadReport {
    const tasks = Array.isArray(tasksOverrideOrNow) ? tasksOverrideOrNow : useAppStore.getState().tasks;
    const effectiveNow = tasksOverrideOrNow instanceof Date ? tasksOverrideOrNow : (now || new Date());
    const todayStr = formatLocalDate(effectiveNow);
    return this.getWorkloadForDate(todayStr, effectiveNow, tasks);
  }

  getTomorrowWorkload(tasksOverrideOrNow?: Task[] | Date, now?: Date): WorkloadReport {
    const tasks = Array.isArray(tasksOverrideOrNow) ? tasksOverrideOrNow : useAppStore.getState().tasks;
    const effectiveNow = tasksOverrideOrNow instanceof Date ? tasksOverrideOrNow : (now || new Date());
    const tomorrow = new Date(effectiveNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);
    return this.getWorkloadForDate(tomorrowStr, effectiveNow, tasks);
  }

  getWeekWorkload(tasksOverrideOrNow?: Task[] | Date, now?: Date): WorkloadReport {
    const tasks = Array.isArray(tasksOverrideOrNow) ? tasksOverrideOrNow : useAppStore.getState().tasks;
    const effectiveNow = tasksOverrideOrNow instanceof Date ? tasksOverrideOrNow : (now || new Date());
    const todayStr = formatLocalDate(effectiveNow);
    const nextWeek = new Date(effectiveNow);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = formatLocalDate(nextWeek);

    const weekTasks = tasks.filter(
      t => !t.isCompleted && t.status !== 'completed' && t.dueDate && t.dueDate >= todayStr && t.dueDate <= nextWeekStr
    );

    const totalMinutes = weekTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
    const overdueCount = weekTasks.filter(t => isTaskOverdue(t, effectiveNow)).length;
    const highPriorityCount = weekTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;

    return {
      totalMinutes,
      formattedTime: formatWorkload(totalMinutes),
      taskCount: weekTasks.length,
      overdueCount,
      highPriorityCount,
    };
  }

  getOverdueWorkload(tasksOverrideOrNow?: Task[] | Date, now?: Date): WorkloadReport {
    const tasks = Array.isArray(tasksOverrideOrNow) ? tasksOverrideOrNow : useAppStore.getState().tasks;
    const effectiveNow = tasksOverrideOrNow instanceof Date ? tasksOverrideOrNow : (now || new Date());
    const overdueTasks = tasks.filter(t => !t.isCompleted && t.status !== 'completed' && isTaskOverdue(t, effectiveNow));
    const totalMinutes = overdueTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
    const highPriorityCount = overdueTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;

    return {
      totalMinutes,
      formattedTime: formatWorkload(totalMinutes),
      taskCount: overdueTasks.length,
      overdueCount: overdueTasks.length,
      highPriorityCount,
    };
  }

  private getWorkloadForDate(dateStr: string, now: Date, tasksList?: Task[]): WorkloadReport {
    const tasks = tasksList || useAppStore.getState().tasks;
    const dateTasks = tasks.filter(t => !t.isCompleted && t.status !== 'completed' && t.dueDate === dateStr);
    const totalMinutes = dateTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
    const overdueCount = dateTasks.filter(t => isTaskOverdue(t, now)).length;
    const highPriorityCount = dateTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;

    return {
      totalMinutes,
      formattedTime: formatWorkload(totalMinutes),
      taskCount: dateTasks.length,
      overdueCount,
      highPriorityCount,
    };
  }

  /**
   * Topic-Centric Academic Context ("Everything related to this topic")
   */
  getTopicAcademicContext(
    topicId: string,
    options?: {
      topics?: Topic[];
      subjects?: Subject[];
      units?: SyllabusUnit[];
      classOccurrences?: ClassOccurrence[];
      tasks?: Task[];
      exams?: Exam[];
      examTopics?: ExamTopic[];
      resources?: Resource[];
    }
  ): TopicAcademicContext | null {
    const academicState = useAcademicStore.getState();
    const appState = useAppStore.getState();

    const topic = options?.topics
      ? options.topics.find(t => t.id === topicId)
      : academicState.topics.find(t => t.id === topicId);
    if (!topic) {
      return null;
    }

    const subjectsList = options?.subjects || appState.subjects;
    const subject = subjectsList.find(s => s.id === topic.subjectId);
    const unitsList = options?.units || academicState.syllabusUnits;
    const unit = topic.unitId ? unitsList.find(u => u.id === topic.unitId) : undefined;

    // 1. Class sessions covering this topic
    let classSessions: Array<{
      id: string;
      date: string;
      startTime?: string;
      endTime?: string;
      attendance?: string;
      myNotes?: string;
      teacherNotes?: string;
      journal?: string;
      hasNotes: boolean;
      hasResources: boolean;
    }>;

    if (options?.classOccurrences) {
      classSessions = options.classOccurrences
        .filter(c => c.note && Array.isArray(c.note.topicIds) && c.note.topicIds.includes(topicId))
        .map(c => ({
          id: c.slotId,
          date: c.date,
          startTime: c.startTime,
          endTime: c.endTime,
          attendance: c.attendanceStatus,
          myNotes: c.note?.myNotes,
          teacherNotes: c.note?.teacherNotes,
          journal: c.note?.myNotes,
          hasNotes: Boolean(c.note?.myNotes && c.note.myNotes.trim().length > 0),
          hasResources: Boolean(c.note?.resourceIds && c.note.resourceIds.length > 0),
        }));
    } else {
      classSessions = this.getTopicClassSessions(topicId);
    }

    // 2. Resources for this topic
    const resources = options?.resources || this.getTopicResources(topicId);

    // 3. Tasks for this topic
    const tasksList = options?.tasks || appState.tasks;
    const topicTasks = tasksList.filter(t => t.topicId === topicId);
    const pendingTasks = topicTasks.filter(t => !t.isCompleted && t.status !== 'completed');
    const completedTasks = topicTasks.filter(t => t.isCompleted || t.status === 'completed');
    const overdueTasks = pendingTasks.filter(t => isTaskOverdue(t));

    // 4. Exams covering this topic
    let exams: Exam[];
    if (options?.exams && options?.examTopics) {
      const matchExamIds = new Set(options.examTopics.filter(et => et.topicId === topicId).map(et => et.examId));
      exams = options.exams.filter(e => matchExamIds.has(e.id));
    } else {
      exams = this.getTopicExams(topicId);
    }

    // 5. Revision state
    const revision = {
      status: topic.revisionStatus,
      lastRevisedAt: topic.lastRevisedAt,
      revisionCount: topic.revisionCount || 0,
    };

    return {
      topic,
      subject,
      unit,
      classSessions,
      resources,
      tasks: {
        all: topicTasks,
        pending: pendingTasks,
        completed: completedTasks,
        overdue: overdueTasks,
      },
      pendingTasks,
      completedTasks,
      exams,
      revision,
    };
  }

  getTopicClassSessions(topicId: string): Array<{
    id: string;
    date: string;
    startTime?: string;
    endTime?: string;
    attendance?: string;
    myNotes?: string;
    teacherNotes?: string;
    hasNotes: boolean;
    hasResources: boolean;
  }> {
    const academicState = useAcademicStore.getState();
    const notes = academicState.classNotes.filter(
      n => Array.isArray(n.topicIds) && n.topicIds.includes(topicId)
    );

    return notes.map(n => {
      const resources = academicState.getResourcesForClassNote(n.id);
      return {
        id: n.classSessionId,
        date: n.date,
        attendance: n.attendanceStatus,
        myNotes: n.myNotes,
        teacherNotes: n.teacherNotes,
        hasNotes: Boolean(n.myNotes && n.myNotes.trim().length > 0),
        hasResources: resources.length > 0,
      };
    });
  }

  getTopicNotes(topicId: string): Array<{ classSessionId: string; date: string; myNotes: string; teacherNotes: string }> {
    const academicState = useAcademicStore.getState();
    return academicState.classNotes
      .filter(n => Array.isArray(n.topicIds) && n.topicIds.includes(topicId))
      .map(n => ({
        classSessionId: n.classSessionId,
        date: n.date,
        myNotes: n.myNotes,
        teacherNotes: n.teacherNotes,
      }));
  }

  getTopicResources(topicId: string): Resource[] {
    const academicState = useAcademicStore.getState();
    const directResources = academicState.resources.filter(
      r => Array.isArray(r.topics) && r.topics.includes(topicId)
    );

    // Also collect resources from class sessions that covered this topic
    const notesCoveringTopic = academicState.classNotes.filter(
      n => Array.isArray(n.topicIds) && n.topicIds.includes(topicId)
    );
    const sessionNoteIds = new Set(notesCoveringTopic.map(n => n.id));

    const sessionResources = academicState.resources.filter(
      r => r.classNoteId && sessionNoteIds.has(r.classNoteId)
    );

    const resourceMap = new Map<string, Resource>();
    for (const r of directResources) resourceMap.set(r.id, r);
    for (const r of sessionResources) resourceMap.set(r.id, r);

    return Array.from(resourceMap.values());
  }

  getTopicTasks(topicId: string): {
    all: Task[];
    pending: Task[];
    completed: Task[];
    overdue: Task[];
  } {
    const { tasks } = useAppStore.getState();
    const all = tasks.filter(t => t.topicId === topicId);
    const pending = all.filter(t => !t.isCompleted && t.status !== 'completed');
    const completed = all.filter(t => t.isCompleted || t.status === 'completed');
    const overdue = pending.filter(t => isTaskOverdue(t));

    return { all, pending, completed, overdue };
  }

  getTopicExams(topicId: string): Exam[] {
    const academicState = useAcademicStore.getState();
    const { exams } = useAppStore.getState();

    const examTopicMatches = academicState.examTopics.filter(et => et.topicId === topicId);
    const examIds = new Set(examTopicMatches.map(et => et.examId));

    return exams.filter(e => examIds.has(e.id));
  }

  getTopicRevision(topicId: string): {
    status: RevisionStatus;
    lastRevisedAt?: string;
    revisionCount: number;
  } {
    const academicState = useAcademicStore.getState();
    const topic = academicState.topics.find(t => t.id === topicId);

    return {
      status: topic?.revisionStatus || 'not_started',
      lastRevisedAt: topic?.lastRevisedAt,
      revisionCount: topic?.revisionCount || 0,
    };
  }

  /**
   * Subject Academic Snapshot
   */
  getSubjectAcademicSnapshot(
    subjectId: string,
    overrides?: {
      subjects?: Subject[];
      attendanceData?: Record<string, { attended: number; total: number }>;
      targetPercentage?: number;
      tasks?: Task[];
      topics?: Topic[];
      units?: SyllabusUnit[];
      exams?: Exam[];
      classOccurrences?: ClassOccurrence[];
      resources?: Resource[];
      now?: Date;
    }
  ): SubjectAcademicSnapshot | null {
    const appState = useAppStore.getState();
    const academicState = useAcademicStore.getState();
    const now = overrides?.now || new Date();

    const subjectsList = overrides?.subjects || appState.subjects;
    const subject = subjectsList.find(s => s.id === subjectId);
    if (!subject) return null;

    // Attendance
    const attMap = overrides?.attendanceData || appState.attendanceData;
    const att = attMap[subjectId] || { attended: 0, total: 0 };
    const target = overrides?.targetPercentage ?? appState.attendanceTarget;
    const attendancePercentage = calculatePercentage(att.attended, att.total);
    const attendanceStatus = getAttendanceStatus(attendancePercentage, target);
    const safeBunks = calculateSafeBunks(att.attended, att.total, target);
    const recoveryClasses = calculateRecoveryClasses(att.attended, att.total, target);

    // Tasks
    const allTasks = overrides?.tasks || appState.tasks;
    const subjectTasks = allTasks.filter(t => t.subjectId === subjectId);
    const pendingTasks = subjectTasks.filter(t => !t.isCompleted && t.status !== 'completed');
    const tasksPending = pendingTasks.length;
    const tasksOverdue = pendingTasks.filter(t => isTaskOverdue(t, now)).length;
    const workloadMinutes = pendingTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);

    // Syllabus & Revision
    const topics = overrides?.topics
      ? overrides.topics.filter(t => t.subjectId === subjectId)
      : academicState.getTopicsForSubject(subjectId);
    const topicsTotal = topics.length;
    const topicsTaught = topics.filter(t => t.isCompleted || (t.revisionStatus !== 'not_started' && t.revisionStatus !== 'not_taught')).length;
    const topicsRevised = topics.filter(t => t.revisionStatus === 'revised').length;
    const topicBacklog = topics.filter(t => t.revisionStatus === 'taught' || t.revisionStatus === 'needs_revision').length;

    // Exams
    const allExams = overrides?.exams || appState.exams;
    const subjectExams = allExams.filter(e => e.subjectId === subjectId);
    const upcomingExams = subjectExams.filter(e => e.date && daysUntil(e.date, now) >= 0);

    // Marks
    const subjectMarks = appState.marks.filter(m => m.subjectId === subjectId);
    let currentMarks: { obtained: number; maxMarks: number; percentage: number } | null = null;
    if (subjectMarks.length > 0) {
      const totalObtained = subjectMarks.reduce((acc, m) => acc + m.obtained, 0);
      const totalMax = subjectMarks.reduce((acc, m) => acc + m.maxMarks, 0);
      currentMarks = {
        obtained: totalObtained,
        maxMarks: totalMax,
        percentage: totalMax > 0 ? (totalObtained / totalMax) * 100 : 0,
      };
    }

    // Recent Sessions
    const recentClassSessions = overrides?.classOccurrences
      ? overrides.classOccurrences.filter(c => c.subjectId === subjectId).slice(0, 5)
      : academicState.getClassOccurrencesForSubject(subjectId).slice(0, 5);

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      attendancePercentage,
      attendanceStatus,
      safeBunks,
      recoveryClasses,
      tasksPending,
      tasksOverdue,
      workloadMinutes,
      topicsTotal,
      topicsTaught,
      topicsRevised,
      topicBacklog,
      upcomingExams,
      currentMarks,
      recentClassSessions,
    };
  }

  /**
   * Phase 7: Revision Hub aggregated data.
   */
  getRevisionHubData(options?: { semesterId?: string; now?: Date }) {
    const now = options?.now || new Date();
    const appState = useAppStore.getState();
    const academicState = useAcademicStore.getState();

    const activeSemId = options?.semesterId || appState.semester?.id;
    const subjects = activeSemId
      ? appState.subjects.filter(s => s.semesterId === activeSemId && !s.isArchived)
      : appState.subjects.filter(s => !s.isArchived);

    const { revisionIntelligenceService } = require('./revisionIntelligenceService');
    const { examSprintService } = require('./examSprintService');

    const allTopicIntels = revisionIntelligenceService.getSemesterRevisionIntelligence(activeSemId, now);

    const backlogTopics = allTopicIntels.filter(
      (t: any) => t.isTaught && (t.revisionState === 'NEEDS_REVIEW' || t.revisionState === 'NOT_REVIEWED')
    );
    const criticalTopics = allTopicIntels.filter((t: any) => t.revisionPriority === 'critical');
    const highPriorityTopics = allTopicIntels.filter((t: any) => t.revisionPriority === 'high');

    const recentReviews = (academicState.revisionRecords || []).slice(0, 10);

    const subjectProgress = subjects.map(sub => {
      const subTopics = allTopicIntels.filter((t: any) => t.subjectId === sub.id);
      const taught = subTopics.filter((t: any) => t.isTaught).length;
      const reviewed = subTopics.filter((t: any) => t.hasBeenReviewed).length;
      const confident = subTopics.filter((t: any) => t.revisionState === 'CONFIDENT').length;
      const needsReview = subTopics.filter((t: any) => t.revisionState === 'NEEDS_REVIEW').length;
      const criticalCount = subTopics.filter((t: any) => t.revisionPriority === 'critical').length;
      const readinessPct = taught > 0 ? Math.round((confident / taught) * 100) : 0;

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        shortName: sub.shortName,
        color: sub.color,
        totalTopics: subTopics.length,
        taughtTopics: taught,
        reviewedTopics: reviewed,
        confidentTopics: confident,
        needsReviewTopics: needsReview,
        criticalCount,
        readinessPct,
      };
    });

    const upcomingExamsWithReadiness = appState.exams
      .filter(e => e.date && daysUntil(e.date, now) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(exam => ({
        exam,
        readiness: examSprintService.getExamReadiness(exam.id, now),
      }));

    return {
      backlogTopics,
      criticalTopics,
      highPriorityTopics,
      recentReviews,
      subjectProgress,
      upcomingExamsWithReadiness,
    };
  }

  /**
   * Generates Attendance Intelligence Hub data for the semester.
   */
  getAttendanceHubData(options?: { now?: Date }) {
    const { attendanceIntelligenceService } = require('./attendanceIntelligenceService');
    return attendanceIntelligenceService.getSemesterAttendanceIntelligence(options);
  }

  /**
   * Generates Study Planning & Academic Calendar Hub data for the semester.
   */
  getStudyPlanningHubData(options?: { now?: Date }) {
    const { studyPlanningService } = require('./studyPlanningService');
    const now = options?.now || new Date();
    const todayStr = formatLocalDate(now);
    const todayWorkload = studyPlanningService.calculateDailyWorkload(todayStr, options);
    const todayPlan = studyPlanningService.generateDailyStudyPlan(todayStr, options);
    const weeklyPlan = studyPlanningService.generateWeeklyStudyPlan(todayStr, options);
    const unscheduledWork = studyPlanningService.getUnscheduledWork(options);

    return {
      todayWorkload,
      todayPlan,
      weeklyPlan,
      unscheduledWork,
    };
  }
}

export const academicHubService = new AcademicHubService();
