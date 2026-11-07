/**
 * BunkMatKar — Study Planning & Academic Calendar Service (Phase 9)
 *
 * Deterministic, offline-first, semester-aware service that unifies academic data
 * across Class Sessions, Tasks, Exams, Revision Intelligence, and Attendance into
 * a cohesive Academic Calendar and Daily/Weekly Study Planning Engine.
 *
 * Planning Chain:
 * Class Schedule -> Tasks -> Revision -> Exams -> Attendance Constraints -> Academic Workload -> Study Planning -> Daily/Weekly Academic Plan
 *
 * Principles:
 * - Deterministic: Same input state produces identical calendar & plan.
 * - Non-destructive: StudyPlan is a planning layer, not a duplicate task database.
 * - Class-Aware: ClassSessions and Exams are fixed commitments; study blocks never overlap them.
 * - Explainable: Workload and study plans provide transparent rationale.
 * - Local-Date Safe: Uses timeUtils local date helpers; avoids UTC drift.
 * - No AI / No LLM APIs / No cloud sync.
 */

import type { Task, Subject, Exam, Semester, DayOfWeek } from '@/types';
import type {
  CalendarEvent,
  CalendarEventType,
  DailyWorkload,
  WorkloadLevel,
  StudyPlanItem,
  StudyPlanItemType,
  StudyPlan,
  WeeklyStudyPlan,
  WeeklyStudyPlanDay,
  PlanningConflict,
  PlanningConflictType,
  UnscheduledAcademicWork,
  StudyPlanningInputOptions,
  TimetableSlot,
  Topic,
  ClassNote,
  RevisionRecord,
  TopicRevisionIntelligence,
} from '@/types/academic';
import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';
import {
  formatLocalDate,
  parseLocalDate,
  daysUntil,
  getDayOfWeekFromDate,
  formatTime,
  timeToMinutes,
} from '@/lib/timeUtils';
import { isTaskOverdue } from '@/lib/taskUtils';
import { revisionIntelligenceService } from './revisionIntelligenceService';
import { attendanceIntelligenceService } from './attendanceIntelligenceService';
import { taskRepository } from '@/database/repositories/taskRepository';
import { settingsRepository } from '@/database/repositories/settingsRepository';

const DEFAULT_DAILY_STUDY_CAPACITY_MINUTES = 120; // 2 hours
const DEFAULT_TASK_MINUTES = 30;
const DEFAULT_REVISION_MINUTES = 30;
const DEFAULT_CLASS_MINUTES = 60;

export class StudyPlanningService {
  /**
   * Retrieves the configured daily study capacity preference (in minutes).
   * Defaults to 120 minutes.
   */
  async getDailyStudyCapacity(): Promise<number> {
    const raw = await settingsRepository.getSetting('study_capacity_minutes');
    if (!raw) return DEFAULT_DAILY_STUDY_CAPACITY_MINUTES;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_STUDY_CAPACITY_MINUTES;
  }

  /**
   * Persists the student's daily study capacity preference (in minutes).
   */
  async setDailyStudyCapacity(capacityMinutes: number): Promise<void> {
    const valid = Math.max(15, Math.min(720, capacityMinutes));
    await settingsRepository.setSetting('study_capacity_minutes', String(valid));
  }

  /**
   * Derives unified CalendarEvents across ClassSessions, Exams, Tasks, Revision, and Attendance
   * for a given date range [startDateStr, endDateStr].
   */
  deriveCalendarEvents(
    startDateStr: string,
    endDateStr: string,
    options?: StudyPlanningInputOptions
  ): CalendarEvent[] {
    const appState = useAppStore.getState();
    const academicState = useAcademicStore.getState();
    const now = options?.now || new Date();

    const activeSemester = options?.semesterOverride !== undefined ? options.semesterOverride : appState.semester;
    const semesterId = activeSemester?.id;

    // Filter subjects by active semester
    const allSubjects = options?.subjectsOverride || appState.subjects;
    const subjects = semesterId
      ? allSubjects.filter(s => s.semesterId === semesterId && !s.isArchived)
      : allSubjects.filter(s => !s.isArchived);
    const subjectMap = new Map<string, Subject>(subjects.map(s => [s.id, s]));

    const events: CalendarEvent[] = [];

    // Parse date bounds
    const startD = parseLocalDate(startDateStr);
    const endD = parseLocalDate(endDateStr);

    // 1. CLASS SESSIONS (derived from recurring TimetableSlots)
    const timetableSlots = options?.timetableSlotsOverride || academicState.timetableSlots;
    const activeSlots = timetableSlots.filter(
      slot => slot.isActive !== false && (!semesterId || slot.semesterId === semesterId) && subjectMap.has(slot.subjectId)
    );

    // Iterate through each day in the date range
    const cur = new Date(startD);
    while (cur.getTime() <= endD.getTime()) {
      const curDateStr = formatLocalDate(cur);
      const dayOfWeek = getDayOfWeekFromDate(cur);

      // Check semester bounds if defined
      const withinSem =
        (!activeSemester?.startDate || curDateStr >= activeSemester.startDate) &&
        (!activeSemester?.endDate || curDateStr <= activeSemester.endDate);

      if (withinSem) {
        const matchingSlots = activeSlots.filter(s => s.dayOfWeek === dayOfWeek);
        for (const slot of matchingSlots) {
          const sub = subjectMap.get(slot.subjectId);
          const duration =
            slot.startTime && slot.endTime
              ? Math.max(0, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime))
              : DEFAULT_CLASS_MINUTES;

          events.push({
            id: `class-${slot.id}-${curDateStr}`,
            type: 'class',
            date: curDateStr,
            startTime: slot.startTime,
            endTime: slot.endTime,
            title: sub ? sub.name : 'Class',
            subtitle: `${slot.room ? slot.room + ' · ' : ''}${slot.type.toUpperCase()}`,
            color: sub?.color || '#3B82F6',
            subjectId: slot.subjectId,
            subjectName: sub?.name,
            sourceId: slot.id,
            sourceType: 'class_session',
            isCustom: false,
            estimatedMinutes: duration,
            metadata: {
              room: slot.room,
              classType: slot.type,
            },
          });
        }

        // Also check appState.classSessions for matching dayOfWeek
        const activeSessions = (appState.classSessions || []).filter(
          cs => cs.dayOfWeek === dayOfWeek && (!semesterId || cs.semesterId === semesterId) && subjectMap.has(cs.subjectId)
        );
        for (const cs of activeSessions) {
          if (matchingSlots.some(s => s.id === cs.id)) continue;
          const sub = subjectMap.get(cs.subjectId);
          const duration =
            cs.startTime && cs.endTime
              ? Math.max(0, timeToMinutes(cs.endTime) - timeToMinutes(cs.startTime))
              : DEFAULT_CLASS_MINUTES;

          events.push({
            id: `class-${cs.id}-${curDateStr}`,
            type: 'class',
            date: curDateStr,
            startTime: cs.startTime,
            endTime: cs.endTime,
            title: sub ? sub.name : 'Class',
            subtitle: `${cs.room ? cs.room + ' · ' : ''}${cs.type.toUpperCase()}`,
            color: sub?.color || '#3B82F6',
            subjectId: cs.subjectId,
            subjectName: sub?.name,
            sourceId: cs.id,
            sourceType: 'class_session',
            isCustom: false,
            estimatedMinutes: duration,
            metadata: {
              room: cs.room,
              classType: cs.type,
            },
          });
        }
      }

      cur.setDate(cur.getDate() + 1);
    }

    // 2. EXAMS
    const allExams = options?.examsOverride || appState.exams;
    const exams = allExams.filter(
      e =>
        (!semesterId || e.semesterId === semesterId) &&
        subjectMap.has(e.subjectId) &&
        e.date >= startDateStr &&
        e.date <= endDateStr
    );

    for (const exam of exams) {
      const sub = subjectMap.get(exam.subjectId);
      const startTime = exam.time || '10:00';
      const startMin = timeToMinutes(startTime);
      const endMin = startMin + 120; // 2 hour default exam duration
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      events.push({
        id: `exam-${exam.id}`,
        type: 'exam',
        date: exam.date,
        startTime,
        endTime,
        title: `${exam.name}`,
        subtitle: `${sub?.shortName || sub?.name || 'Exam'} · Max Marks: ${exam.maxMarks}`,
        color: '#EF4444',
        subjectId: exam.subjectId,
        subjectName: sub?.name,
        sourceId: exam.id,
        sourceType: 'exam',
        isCustom: false,
        priority: 'urgent',
        estimatedMinutes: 120,
        metadata: {
          examType: exam.type,
          room: exam.room,
        },
      });
    }

    // 3. TASKS (scheduled or due within range)
    const allTasks = options?.tasksOverride || appState.tasks;
    const tasks = allTasks.filter(t => {
      if (t.subjectId && !subjectMap.has(t.subjectId)) return false;
      const onDue = t.dueDate && t.dueDate >= startDateStr && t.dueDate <= endDateStr;
      const onSched = t.scheduledDate && t.scheduledDate >= startDateStr && t.scheduledDate <= endDateStr;
      return onDue || onSched;
    });

    for (const task of tasks) {
      const sub = task.subjectId ? subjectMap.get(task.subjectId) : undefined;
      const date = task.scheduledDate || task.dueDate || startDateStr;
      const isOverdue = isTaskOverdue(task, now);

      events.push({
        id: `task-${task.id}`,
        type: 'task',
        date,
        startTime: task.scheduledStartTime || task.dueTime,
        endTime: task.scheduledEndTime,
        title: task.title,
        subtitle: sub ? `${sub.shortName} · ${task.category}` : task.category,
        color: sub?.color || '#8B5CF6',
        subjectId: task.subjectId,
        subjectName: sub?.name,
        sourceId: task.id,
        sourceType: 'task',
        isCustom: false,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes && task.estimatedMinutes > 0 ? task.estimatedMinutes : DEFAULT_TASK_MINUTES,
        metadata: {
          isOverdue,
          isCompleted: task.isCompleted,
          topicId: task.topicId,
        },
      });
    }

    // 4. ATTENDANCE ADVISORIES (surface recovery importance on scheduled classes)
    const attendanceSummary = attendanceIntelligenceService.getSemesterAttendanceIntelligence({
      now,
      subjectsOverride: subjects,
      semesterOverride: activeSemester || undefined,
    });

    const dangerSubjectIds = new Set(attendanceSummary.dangerSubjects.map(s => s.subjectId));
    for (const evt of events) {
      if (evt.type === 'class' && evt.subjectId && dangerSubjectIds.has(evt.subjectId)) {
        if (!evt.metadata) evt.metadata = {};
        evt.metadata.attendanceRecovery = true;
      }
    }

    // Sort chronologically: date ASC, then startTime ASC (all-day/no-time at start of day)
    return events.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const aTime = a.startTime ? timeToMinutes(a.startTime) : -1;
      const bTime = b.startTime ? timeToMinutes(b.startTime) : -1;
      return aTime - bTime;
    });
  }

  /**
   * Calculates the academic workload snapshot for a given date.
   */
  calculateDailyWorkload(dateStr: string, options?: StudyPlanningInputOptions): DailyWorkload {
    const now = options?.now || new Date();
    const capacity = options?.capacityMinutesOverride || DEFAULT_DAILY_STUDY_CAPACITY_MINUTES;

    const events = this.deriveCalendarEvents(dateStr, dateStr, options);

    let classesMinutes = 0;
    let classesCount = 0;
    let tasksMinutes = 0;
    let tasksCount = 0;
    let revisionMinutes = 0;
    let revisionCount = 0;
    let examsCount = 0;

    for (const evt of events) {
      const mins = Math.max(0, evt.estimatedMinutes && evt.estimatedMinutes > 0 ? evt.estimatedMinutes : DEFAULT_TASK_MINUTES);
      if (evt.type === 'class') {
        classesMinutes += mins;
        classesCount++;
      } else if (evt.type === 'task') {
        if (!evt.metadata?.isCompleted) {
          tasksMinutes += mins;
          tasksCount++;
        }
      } else if (evt.type === 'exam') {
        examsCount++;
      } else if (evt.type === 'revision') {
        revisionMinutes += mins;
        revisionCount++;
      }
    }

    // Check revision recommendations from Revision Intelligence if not already in events
    const backlog = revisionIntelligenceService.getRevisionBacklog(undefined, now);
    const criticalRevisions = backlog.filter(
      b => b.revisionPriority === 'critical' || b.revisionPriority === 'high'
    );
    // If date is today, account for top critical revision backlog topics
    const todayStr = formatLocalDate(now);
    if (dateStr === todayStr && revisionCount === 0) {
      const topCount = Math.min(2, criticalRevisions.length);
      revisionMinutes += topCount * DEFAULT_REVISION_MINUTES;
      revisionCount += topCount;
    }

    const studyMinutes = tasksMinutes + revisionMinutes;
    const totalMinutes = classesMinutes + studyMinutes;

    // Overload condition: study minutes exceed capacity by >= 30 mins OR total minutes exceed 360 mins (6h)
    const isOverloaded = studyMinutes > capacity || totalMinutes > 360;

    let status: WorkloadLevel = isOverloaded ? 'overloaded' : this.classifyWorkload(totalMinutes);

    let explanation: string;
    if (isOverloaded) {
      const overBy = Math.max(0, studyMinutes - capacity);
      explanation = `Planned study workload (${Math.round(studyMinutes / 60)}h ${studyMinutes % 60}m) exceeds selected daily capacity (${Math.round(capacity / 60)}h) by ${overBy} mins.`;
    } else if (status === 'heavy') {
      explanation = `Demanding academic day with ${classesCount} classes and ${tasksCount + revisionCount} study commitments (${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m total).`;
    } else if (status === 'moderate') {
      explanation = `Balanced academic day with ${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m of total commitments.`;
    } else {
      explanation = `Manageable academic load (${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m). Good opportunity to review backlog.`;
    }

    return {
      date: dateStr,
      classesMinutes,
      classesCount,
      tasksMinutes,
      tasksCount,
      revisionMinutes,
      revisionCount,
      examsCount,
      totalMinutes,
      studyMinutes,
      capacityMinutes: capacity,
      isOverloaded,
      status,
      explanation,
    };
  }

  /**
   * Deterministic workload classification based on total academic minutes:
   * - Light: <= 120 minutes (2h)
   * - Moderate: 121 - 240 minutes (2h - 4h)
   * - Heavy: 241 - 360 minutes (4h - 6h)
   * - Overloaded: > 360 minutes (> 6h)
   */
  classifyWorkload(totalMinutes: number): WorkloadLevel {
    if (totalMinutes > 360) return 'overloaded';
    if (totalMinutes > 240) return 'heavy';
    if (totalMinutes > 120) return 'moderate';
    return 'light';
  }

  /**
   * Identifies scheduling conflicts on a specific date.
   */
  detectPlanningConflicts(dateStr: string, options?: StudyPlanningInputOptions): PlanningConflict[] {
    const events = this.deriveCalendarEvents(dateStr, dateStr, options);
    const conflicts: PlanningConflict[] = [];

    const fixedEvents = events.filter(e => (e.type === 'class' || e.type === 'exam') && e.startTime && e.endTime);
    const studyTasks = events.filter(e => e.type === 'task' && !e.metadata?.isCompleted && e.startTime);

    // 1. Task scheduled during fixed Class or Exam
    for (const task of studyTasks) {
      if (!task.startTime) continue;
      const tStart = timeToMinutes(task.startTime);
      const tEnd = task.endTime ? timeToMinutes(task.endTime) : tStart + (task.estimatedMinutes || DEFAULT_TASK_MINUTES);

      for (const fixed of fixedEvents) {
        if (!fixed.startTime || !fixed.endTime) continue;
        const fStart = timeToMinutes(fixed.startTime);
        const fEnd = timeToMinutes(fixed.endTime);

        // Check time interval overlap
        if (tStart < fEnd && tEnd > fStart) {
          const isExam = fixed.type === 'exam';
          conflicts.push({
            id: `conflict-${task.id}-${fixed.id}`,
            type: isExam ? 'study_during_exam' : 'task_during_class',
            date: dateStr,
            title: isExam ? 'Task scheduled during Exam' : 'Task scheduled during Class',
            description: `"${task.title}" (${task.startTime}) is scheduled during ${isExam ? 'exam' : 'class'} ${fixed.title} (${fixed.startTime}–${fixed.endTime}).`,
            itemIds: [task.id, fixed.id],
            suggestedResolution: `Reschedule "${task.title}" to a window before or after ${fixed.title}.`,
          });
        }
      }
    }

    // 2. Overlapping tasks
    for (let i = 0; i < studyTasks.length; i++) {
      const t1 = studyTasks[i];
      if (!t1.startTime) continue;
      const start1 = timeToMinutes(t1.startTime);
      const end1 = t1.endTime ? timeToMinutes(t1.endTime) : start1 + (t1.estimatedMinutes || DEFAULT_TASK_MINUTES);

      for (let j = i + 1; j < studyTasks.length; j++) {
        const t2 = studyTasks[j];
        if (!t2.startTime) continue;
        const start2 = timeToMinutes(t2.startTime);
        const end2 = t2.endTime ? timeToMinutes(t2.endTime) : start2 + (t2.estimatedMinutes || DEFAULT_TASK_MINUTES);

        if (start1 < end2 && end1 > start2) {
          conflicts.push({
            id: `conflict-overlap-${t1.id}-${t2.id}`,
            type: 'overlapping_tasks',
            date: dateStr,
            title: 'Overlapping Tasks',
            description: `"${t1.title}" and "${t2.title}" are scheduled at the same time (${t1.startTime}).`,
            itemIds: [t1.id, t2.id],
            suggestedResolution: 'Adjust start time of one task to run sequentially.',
          });
        }
      }
    }

    // 3. Workload overload conflict
    const workload = this.calculateDailyWorkload(dateStr, options);
    if (workload.isOverloaded) {
      conflicts.push({
        id: `conflict-overload-${dateStr}`,
        type: 'workload_overload',
        date: dateStr,
        title: 'Study Capacity Exceeded',
        description: workload.explanation,
        itemIds: events.map(e => e.id),
        suggestedResolution: 'Move lower-priority tasks to upcoming lighter days.',
      });
    }

    return conflicts;
  }

  /**
   * Generates a deterministic daily study plan for a given date.
   *
   * Priority Ordering:
   * 1. Critical revision
   * 2. Urgent exam preparation
   * 3. Overdue tasks
   * 4. Due-today tasks
   * 5. High-priority tasks
   * 6. High-priority revision
   * 7. Lower-priority academic work
   *
   * Time blocking allocates slots in open windows outside fixed class and exam hours.
   * Overflow is preserved transparently when workload exceeds study capacity.
   */
  generateDailyStudyPlan(dateStr: string, options?: StudyPlanningInputOptions): StudyPlan {
    const appState = useAppStore.getState();
    const academicState = useAcademicStore.getState();
    const now = options?.now || (dateStr ? new Date(`${dateStr}T12:00:00`) : new Date());
    const capacity = options?.capacityMinutesOverride || DEFAULT_DAILY_STUDY_CAPACITY_MINUTES;

    const activeSemester = options?.semesterOverride !== undefined ? options.semesterOverride : appState.semester;
    const semesterId = activeSemester?.id;

    const subjects = (options?.subjectsOverride || appState.subjects).filter(
      s => (!semesterId || s.semesterId === semesterId) && !s.isArchived
    );
    const subjectMap = new Map<string, Subject>(subjects.map(s => [s.id, s]));

    // 1. Fixed commitments (Classes and Exams for dateStr)
    const events = this.deriveCalendarEvents(dateStr, dateStr, options);
    const fixedClasses = events.filter(e => e.type === 'class');
    const fixedExams = events.filter(e => e.type === 'exam');

    let fixedClassesMinutes = 0;
    const busyIntervals: Array<{ start: number; end: number; name: string }> = [];

    for (const fc of fixedClasses) {
      const dur = fc.estimatedMinutes || DEFAULT_CLASS_MINUTES;
      fixedClassesMinutes += dur;
      if (fc.startTime && fc.endTime) {
        busyIntervals.push({
          start: timeToMinutes(fc.startTime),
          end: timeToMinutes(fc.endTime),
          name: fc.title,
        });
      }
    }

    for (const fe of fixedExams) {
      if (fe.startTime && fe.endTime) {
        busyIntervals.push({
          start: timeToMinutes(fe.startTime),
          end: timeToMinutes(fe.endTime),
          name: fe.title,
        });
      }
    }

    busyIntervals.sort((a, b) => a.start - b.end);

    // 2. Candidate study items collection
    interface RawCandidate {
      id: string;
      sourceType: 'task' | 'revision' | 'class' | 'exam';
      sourceId: string;
      title: string;
      subtitle?: string;
      subjectId?: string;
      subjectName?: string;
      color?: string;
      durationMinutes: number;
      priority: 'critical' | 'urgent' | 'high' | 'medium' | 'low';
      planType: StudyPlanItemType;
      orderWeight: number; // Lower number = higher priority
      reason: string;
      scheduledStartTime?: string;
      scheduledEndTime?: string;
      isCompleted?: boolean;
      isOverdue?: boolean;
    }

    const candidates: RawCandidate[] = [];

    // Candidate Pool A: Tasks
    const allTasks = options?.tasksOverride || appState.tasks;
    const pendingTasks = allTasks.filter(
      t =>
        !t.isCompleted &&
        t.status !== 'completed' &&
        (!t.subjectId || subjectMap.has(t.subjectId))
    );

    for (const t of pendingTasks) {
      const sub = t.subjectId ? subjectMap.get(t.subjectId) : undefined;
      const isOverdue = isTaskOverdue(t, now);
      const isDueToday = t.dueDate === dateStr;
      const isScheduledToday = t.scheduledDate === dateStr;

      let planType: StudyPlanItemType = 'scheduled_task';
      let orderWeight = 100;
      let reason = 'Scheduled academic task';

      if (isOverdue) {
        planType = 'overdue_task';
        orderWeight = 30; // Overdue tasks rank 3rd
        reason = `Overdue since ${t.dueDate}`;
      } else if (isDueToday) {
        planType = 'due_task';
        orderWeight = 40; // Due today ranks 4th
        reason = 'Due today';
      } else if (t.priority === 'urgent') {
        planType = 'urgent_exam_prep';
        orderWeight = 20; // Urgent exam prep ranks 2nd
        reason = 'Urgent priority commitment';
      } else if (t.priority === 'high') {
        planType = 'high_priority_task';
        orderWeight = 50; // High priority ranks 5th
        reason = 'High priority academic work';
      } else if (isScheduledToday) {
        planType = 'scheduled_task';
        orderWeight = 60;
        reason = 'Scheduled for today';
      } else {
        // Lower priority task
        orderWeight = 70;
        reason = 'Independent study task';
      }

      // Only include if relevant to this planning date
      if (isOverdue || isDueToday || isScheduledToday || t.priority === 'urgent' || t.priority === 'high') {
        candidates.push({
          id: `plan-task-${t.id}`,
          sourceType: 'task',
          sourceId: t.id,
          title: t.title,
          subtitle: sub?.shortName ? `${sub.shortName} · ${t.category}` : t.category,
          subjectId: t.subjectId,
          subjectName: sub?.name,
          color: sub?.color || '#8B5CF6',
          durationMinutes: t.estimatedMinutes || DEFAULT_TASK_MINUTES,
          priority: t.priority === 'urgent' ? 'urgent' : t.priority === 'high' ? 'high' : t.priority === 'medium' ? 'medium' : 'low',
          planType,
          orderWeight,
          reason,
          scheduledStartTime: t.scheduledStartTime,
          scheduledEndTime: t.scheduledEndTime,
          isCompleted: false,
          isOverdue,
        });
      }
    }

    // Candidate Pool B: Revision Intelligence
    const revisionBacklog = revisionIntelligenceService.getRevisionBacklog(undefined, now);
    for (const r of revisionBacklog) {
      const sub = subjectMap.get(r.subjectId);
      if (!sub) continue;

      let planType: StudyPlanItemType = 'recommended_revision';
      let orderWeight = 60;
      let reason = `Recommended revision (${r.reviewCount} previous reviews)`;

      if (r.revisionPriority === 'critical') {
        planType = 'critical_revision';
        orderWeight = 10; // Critical revision ranks 1st
        reason = r.upcomingExam
          ? `Critical: Exam in ${r.upcomingExam.daysUntil} days`
          : 'Critical revision: high staleness & unreviewed';
      } else if (r.upcomingExam && r.upcomingExam.daysUntil <= 7) {
        planType = 'urgent_exam_prep';
        orderWeight = 20; // Urgent exam prep ranks 2nd
        reason = `Exam preparation for ${r.upcomingExam.name} (${r.upcomingExam.daysUntil}d left)`;
      } else if (r.revisionPriority === 'high') {
        planType = 'recommended_revision';
        orderWeight = 55; // High priority revision ranks 6th
        reason = 'High priority revision topic';
      }

      candidates.push({
        id: `plan-rev-${r.topicId}`,
        sourceType: 'revision',
        sourceId: r.topicId,
        title: `Revise: ${r.topicName}`,
        subtitle: sub.shortName || sub.name,
        subjectId: r.subjectId,
        subjectName: sub.name,
        color: sub.color || '#3B82F6',
        durationMinutes: DEFAULT_REVISION_MINUTES,
        priority: r.revisionPriority === 'critical' ? 'critical' : r.revisionPriority === 'high' ? 'high' : 'medium',
        planType,
        orderWeight,
        reason,
      });
    }

    // Sort candidate pool strictly by deterministic priority orderWeight
    candidates.sort((a, b) => a.orderWeight - b.orderWeight);

    // 3. Time Blocking outside of fixed commitments
    // Identify available study windows (between 07:00 and 22:00)
    let pointerMinutes = 7 * 60; // 07:00 AM
    const dayEndMinutes = 22 * 60; // 10:00 PM

    function getNextAvailableWindow(duration: number): { start: number; end: number } | null {
      while (pointerMinutes + duration <= dayEndMinutes) {
        const testEnd = pointerMinutes + duration;
        // Check if [pointerMinutes, testEnd] intersects any busy interval
        const conflict = busyIntervals.find(b => pointerMinutes < b.end && testEnd > b.start);
        if (!conflict) {
          const window = { start: pointerMinutes, end: testEnd };
          pointerMinutes = testEnd + 10; // 10 min breather
          return window;
        } else {
          // Advance pointer to end of conflicting fixed commitment
          pointerMinutes = conflict.end + 15; // 15 min break after class
        }
      }
      return null;
    }

    function formatMinToTime(mins: number): string {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // 4. Distribute candidates into Items (within capacity) and OverflowItems (exceeding capacity)
    const items: StudyPlanItem[] = [];
    const overflowItems: StudyPlanItem[] = [];
    let plannedStudyMinutes = 0;

    for (const c of candidates) {
      let suggestedStartTime: string | undefined = c.scheduledStartTime;
      let suggestedEndTime: string | undefined = c.scheduledEndTime;

      // If no explicit time scheduled, suggest time block outside class
      if (!suggestedStartTime) {
        const window = getNextAvailableWindow(c.durationMinutes);
        if (window) {
          suggestedStartTime = formatMinToTime(window.start);
          suggestedEndTime = formatMinToTime(window.end);
        }
      }

      const planItem: StudyPlanItem = {
        id: c.id,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        title: c.title,
        subtitle: c.subtitle,
        subjectId: c.subjectId,
        subjectName: c.subjectName,
        color: c.color,
        date: dateStr,
        suggestedStartTime,
        suggestedEndTime,
        durationMinutes: c.durationMinutes,
        priority: c.priority,
        planType: c.planType,
        isFixedCommitment: false,
        isCompleted: c.isCompleted,
        isOverdue: c.isOverdue,
        reason: c.reason,
      };

      if (plannedStudyMinutes + c.durationMinutes <= capacity) {
        plannedStudyMinutes += c.durationMinutes;
        items.push(planItem);
      } else {
        overflowItems.push(planItem);
      }
    }

    const totalAcademicMinutes = fixedClassesMinutes + plannedStudyMinutes;
    const isOverloaded = overflowItems.length > 0 || totalAcademicMinutes > 360;
    const overloadMinutes = overflowItems.reduce((sum, item) => sum + item.durationMinutes, 0);

    const conflicts = this.detectPlanningConflicts(dateStr, options);

    let recommendation: string;
    if (overflowItems.length > 0) {
      recommendation = `You have ${items.length} prioritized study items (${Math.round(plannedStudyMinutes / 60)}h ${plannedStudyMinutes % 60}m). ${overflowItems.length} items exceed today's study capacity and can be deferred.`;
    } else if (items.length > 0) {
      recommendation = `Optimal plan generated with ${items.length} academic items fitting comfortably within your ${Math.round(capacity / 60)}h study capacity.`;
    } else {
      recommendation = 'No pending study commitments for today. You are completely caught up!';
    }

    return {
      date: dateStr,
      capacityMinutes: capacity,
      plannedStudyMinutes,
      fixedClassesMinutes,
      totalAcademicMinutes,
      items,
      overflowItems,
      isOverloaded,
      overloadMinutes,
      conflicts,
      recommendation,
    };
  }

  /**
   * Generates a 7-day weekly study plan starting from startDateStr.
   */
  generateWeeklyStudyPlan(startDateStr: string, options?: StudyPlanningInputOptions): WeeklyStudyPlan {
    const startD = parseLocalDate(startDateStr);
    const days: WeeklyStudyPlanDay[] = [];

    let totalWeekMinutes = 0;
    let overloadedDaysCount = 0;
    let examCount = 0;
    let urgentTasksCount = 0;
    let criticalRevisionsCount = 0;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 7; i++) {
      const curDate = new Date(startD);
      curDate.setDate(curDate.getDate() + i);
      const curDateStr = formatLocalDate(curDate);
      const dayOfWeek = dayNames[curDate.getDay()];

      const workload = this.calculateDailyWorkload(curDateStr, options);
      const plan = this.generateDailyStudyPlan(curDateStr, options);

      totalWeekMinutes += workload.totalMinutes;
      if (workload.isOverloaded) overloadedDaysCount++;
      examCount += workload.examsCount;

      for (const item of plan.items) {
        if (item.priority === 'urgent' && item.sourceType === 'task') urgentTasksCount++;
        if (item.priority === 'critical' && item.sourceType === 'revision') criticalRevisionsCount++;
      }

      days.push({
        date: curDateStr,
        dayOfWeek,
        workload,
        plan,
      });
    }

    const endD = new Date(startD);
    endD.setDate(endD.getDate() + 6);
    const endDateStr = formatLocalDate(endD);

    const averageDailyMinutes = Math.round(totalWeekMinutes / 7);

    let weeklySummary: string;
    if (overloadedDaysCount >= 3) {
      weeklySummary = `High academic pressure this week with ${overloadedDaysCount} overloaded days and ${examCount} exams. Early time-blocking recommended.`;
    } else if (overloadedDaysCount > 0) {
      weeklySummary = `Moderate week ahead. ${overloadedDaysCount} heavy day(s) identified. Daily average is ${Math.round(averageDailyMinutes / 60)}h ${averageDailyMinutes % 60}m.`;
    } else {
      weeklySummary = `Smooth academic week. Average daily workload is ${Math.round(averageDailyMinutes / 60)}h ${averageDailyMinutes % 60}m with 0 overloaded days.`;
    }

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      days,
      totalWeekMinutes,
      averageDailyMinutes,
      overloadedDaysCount,
      examCount,
      urgentTasksCount,
      criticalRevisionsCount,
      weeklySummary,
    };
  }

  /**
   * Surfaces unscheduled academic work needing placement (overdue tasks,
   * urgent tasks without a time block, and critical revisions without tasks).
   */
  getUnscheduledWork(options?: StudyPlanningInputOptions): UnscheduledAcademicWork {
    const appState = useAppStore.getState();
    const now = options?.now || new Date();

    const activeSemester = options?.semesterOverride !== undefined ? options.semesterOverride : appState.semester;
    const semesterId = activeSemester?.id;

    const subjects = (options?.subjectsOverride || appState.subjects).filter(
      s => (!semesterId || s.semesterId === semesterId) && !s.isArchived
    );
    const subjectMap = new Map<string, Subject>(subjects.map(s => [s.id, s]));

    const allTasks = (options?.tasksOverride || appState.tasks).filter(
      t => !t.isCompleted && t.status !== 'completed' && (!t.subjectId || subjectMap.has(t.subjectId))
    );

    const overdueTasks = allTasks.filter(t => isTaskOverdue(t, now));
    const urgentTasksWithoutTime = allTasks.filter(
      t => (t.priority === 'urgent' || t.priority === 'high') && !t.scheduledStartTime
    );

    // Critical revisions without an existing task linked
    const revisionBacklog = revisionIntelligenceService.getRevisionBacklog(undefined, now);
    const taskTopicIds = new Set(allTasks.filter(t => t.topicId).map(t => t.topicId!));

    const criticalRevisionsWithoutTask = revisionBacklog.filter(
      r => (r.revisionPriority === 'critical' || r.revisionPriority === 'high') && !taskTopicIds.has(r.topicId)
    );

    // Exams with revision backlog
    const allExams = (options?.examsOverride || appState.exams).filter(
      e => (!semesterId || e.semesterId === semesterId) && subjectMap.has(e.subjectId)
    );
    const examsWithRevisionBacklog: UnscheduledAcademicWork['examsWithRevisionBacklog'] = [];

    for (const exam of allExams) {
      const dUntil = daysUntil(exam.date, now);
      if (dUntil >= 0 && dUntil <= 14) {
        const examRevisions = revisionBacklog.filter(r => r.subjectId === exam.subjectId);
        if (examRevisions.length > 0) {
          examsWithRevisionBacklog.push({
            exam,
            daysUntil: dUntil,
            backlogTopicsCount: examRevisions.length,
          });
        }
      }
    }

    const totalUnscheduledItems =
      overdueTasks.length +
      urgentTasksWithoutTime.length +
      criticalRevisionsWithoutTask.length +
      examsWithRevisionBacklog.length;

    return {
      overdueTasks,
      urgentTasksWithoutTime,
      criticalRevisionsWithoutTask,
      examsWithRevisionBacklog,
      totalUnscheduledItems,
    };
  }

  /**
   * Reschedules an existing canonical task to a new date and optional time.
   * Persists directly to SQLite and updates global state.
   */
  async rescheduleTask(
    taskId: string,
    newDate: string,
    startTime?: string,
    endTime?: string
  ): Promise<Task | null> {
    const updated = await taskRepository.updateTask(taskId, {
      scheduledDate: newDate,
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
    });

    if (updated) {
      useAppStore.getState().updateTask(taskId, {
        scheduledDate: newDate,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
      });
    }

    return updated;
  }

  /**
   * Converts a revision recommendation into a standard canonical Task.
   * Preserves topic, subject, and sets category to 'study'.
   */
  async convertRevisionToTask(
    topicId: string,
    scheduledDate?: string,
    scheduledTime?: string,
    estimatedMinutes: number = DEFAULT_REVISION_MINUTES
  ): Promise<Task> {
    const academicState = useAcademicStore.getState();
    const appState = useAppStore.getState();

    const topic = academicState.topics.find(t => t.id === topicId);
    const subject = topic ? appState.subjects.find(s => s.id === topic.subjectId) : undefined;

    const now = formatLocalDate();
    const newTask: Task = {
      id: `task-rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: topic ? `Revise: ${topic.name}` : 'Topic Revision',
      category: 'study',
      priority: 'high',
      status: 'planned',
      isCompleted: false,
      subjectId: topic?.subjectId,
      topicId,
      dueDate: scheduledDate || now,
      scheduledDate: scheduledDate || now,
      scheduledStartTime: scheduledTime,
      estimatedMinutes,
      notes: subject ? `Revision task for ${subject.name}` : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const created = await taskRepository.createTask(newTask);
    useAppStore.getState().addTask(newTask);
    return created;
  }
}

export const studyPlanningService = new StudyPlanningService();
