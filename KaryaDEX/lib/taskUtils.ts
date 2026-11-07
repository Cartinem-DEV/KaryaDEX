/**
 * BunkMatKar — Task Engine 2.0 Utilities
 *
 * Provides:
 * - Smart date & time labels (dynamic, timezone-safe in UTC+5:30)
 * - Deterministic task sorting
 * - Workload aggregations (today, week, total pending)
 * - Task overdue calculations (date + optional time)
 * - Dependency cycle validation
 * - Recurrence next occurrence date calculations
 */

import type { Task, TaskPriority, TaskStatus } from '@/types';
import { formatLocalDate, parseLocalDate, formatTime } from './timeUtils';

export type DerivedStatus = 'COMPLETED' | 'OVERDUE' | 'INBOX' | 'PLANNED' | 'IN_PROGRESS';

/**
 * Checks whether a task is overdue.
 * If dueTime is specified (HH:MM), overdue when now > dueDate + dueTime.
 * If no dueTime is specified, overdue when now > local end-of-day (23:59:59.999).
 */
export function isTaskOverdue(task: { dueDate?: string; dueTime?: string; isCompleted?: boolean; status?: TaskStatus }, now: Date = new Date()): boolean {
  if (task.isCompleted || task.status === 'completed') {
    return false;
  }
  if (!task.dueDate) {
    return false;
  }

  const [y, m, d] = task.dueDate.split('-').map(Number);
  if (!y || !m || !d) return false;

  if (task.dueTime) {
    const [h, min] = task.dueTime.split(':').map(Number);
    const dueDateTime = new Date(y, m - 1, d, h || 0, min || 0, 0, 0);
    return now.getTime() > dueDateTime.getTime();
  }

  // End of local calendar day
  const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
  return now.getTime() > endOfDay.getTime();
}

/**
 * Derives the runtime workflow status for presentation.
 * Returns OVERDUE dynamically without permanently storing it in SQLite.
 */
export function getDerivedTaskStatus(task: Task, now: Date = new Date()): DerivedStatus {
  if (task.isCompleted || task.status === 'completed') {
    return 'COMPLETED';
  }
  if (isTaskOverdue(task, now)) {
    return 'OVERDUE';
  }
  switch (task.status) {
    case 'in_progress':
      return 'IN_PROGRESS';
    case 'inbox':
      return 'INBOX';
    case 'planned':
    default:
      return 'PLANNED';
  }
}

/**
 * Generates dynamic, human-friendly smart date labels.
 * Examples: 'Due today', 'Due tomorrow', 'Overdue', 'In 3 days', 'In 1 week', 'No due date'.
 * Never stores relative strings permanently.
 */
export function getSmartDateLabel(
  taskOrDueDate?: Partial<Task> | string,
  dueTimeOrNow?: string | Date,
  nowArg: Date = new Date()
): string {
  let dueDate: string | undefined;
  let dueTime: string | undefined;
  let now: Date = nowArg;

  if (typeof taskOrDueDate === 'object' && taskOrDueDate !== null) {
    dueDate = taskOrDueDate.dueDate;
    dueTime = taskOrDueDate.dueTime;
    if (dueTimeOrNow instanceof Date) {
      now = dueTimeOrNow;
    }
  } else {
    dueDate = taskOrDueDate;
    if (typeof dueTimeOrNow === 'string') {
      dueTime = dueTimeOrNow;
    } else if (dueTimeOrNow instanceof Date) {
      now = dueTimeOrNow;
    }
  }

  if (!dueDate) {
    return 'No due date';
  }

  const overdue = isTaskOverdue({ dueDate, dueTime, isCompleted: false }, now);
  if (overdue) {
    return 'Overdue';
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = dueDate.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const timeSuffix = dueTime ? ` · ${formatTime(dueTime)}` : '';

  if (diffDays === 0) {
    return `Due today${timeSuffix}`;
  }
  if (diffDays === 1) {
    return `Due tomorrow${timeSuffix}`;
  }
  if (diffDays >= 2 && diffDays <= 6) {
    return `In ${diffDays} days${timeSuffix}`;
  }
  if (diffDays >= 7 && diffDays <= 13) {
    return `In 1 week${timeSuffix}`;
  }
  if (diffDays >= 14 && diffDays <= 27) {
    const weeks = Math.round(diffDays / 7);
    return `In ${weeks} weeks${timeSuffix}`;
  }

  // Fallback to formatted short date
  const dateFormatted = target.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${dateFormatted}${timeSuffix}`;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Deterministic Task Sorting according to Section 28:
 * 1. Overdue first
 * 2. Urgent priority
 * 3. High priority
 * 4. Due today
 * 5. Due tomorrow
 * 6. Earlier due date
 * 7. Lower priority (medium, low)
 * 8. Creation time (newest first)
 */
export function sortTasks(tasks: Task[], now: Date = new Date()): Task[] {
  const todayStr = formatLocalDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  return [...tasks].sort((a, b) => {
    // Completed tasks always at the bottom
    const aComp = a.isCompleted || a.status === 'completed';
    const bComp = b.isCompleted || b.status === 'completed';
    if (aComp !== bComp) {
      return aComp ? 1 : -1;
    }
    if (aComp && bComp) {
      // Sort completed by completion timestamp (newest completed first)
      return (b.completedAt || b.createdAt || '').localeCompare(a.completedAt || a.createdAt || '');
    }

    // 1. Overdue tasks first
    const aOverdue = isTaskOverdue(a, now);
    const bOverdue = isTaskOverdue(b, now);
    if (aOverdue !== bOverdue) {
      return aOverdue ? -1 : 1;
    }

    // 2. Urgent priority
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;

    // 3. High priority
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (b.priority === 'high' && a.priority !== 'high') return 1;

    // 4. Due today
    const aToday = a.dueDate === todayStr;
    const bToday = b.dueDate === todayStr;
    if (aToday !== bToday) return aToday ? -1 : 1;

    // 5. Due tomorrow
    const aTomorrow = a.dueDate === tomorrowStr;
    const bTomorrow = b.dueDate === tomorrowStr;
    if (aTomorrow !== bTomorrow) return aTomorrow ? -1 : 1;

    // 6. Earlier due date
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    // 7. Lower priority
    const aPrio = PRIORITY_ORDER[a.priority] || 2;
    const bPrio = PRIORITY_ORDER[b.priority] || 2;
    if (aPrio !== bPrio) {
      return bPrio - aPrio;
    }

    // 8. Creation time
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

export interface WorkloadSummary {
  totalPendingMinutes: number;
  todayMinutes: number;
  weekMinutes: number;
  pendingCount: number;
  overdueCount: number;
}

/**
 * Calculates academic workload statistics across tasks.
 */
export function calculateWorkload(tasks: Task[], forDate: string = formatLocalDate(new Date())): WorkloadSummary {
  const now = new Date();
  const weekLater = new Date(now);
  weekLater.setDate(weekLater.getDate() + 7);
  const weekLaterStr = formatLocalDate(weekLater);

  let totalPendingMinutes = 0;
  let todayMinutes = 0;
  let weekMinutes = 0;
  let pendingCount = 0;
  let overdueCount = 0;

  for (const t of tasks) {
    const isComp = t.isCompleted || t.status === 'completed';
    if (isComp) continue;

    pendingCount++;
    const mins = t.estimatedMinutes || 30;
    totalPendingMinutes += mins;

    if (isTaskOverdue(t, now)) {
      overdueCount++;
    }

    if (t.dueDate === forDate) {
      todayMinutes += mins;
    }

    if (t.dueDate && t.dueDate >= forDate && t.dueDate <= weekLaterStr) {
      weekMinutes += mins;
    }
  }

  return {
    totalPendingMinutes,
    todayMinutes,
    weekMinutes,
    pendingCount,
    overdueCount,
  };
}

/**
 * Formats minutes into human-readable workload string (e.g. '2h 35m', '45 min').
 */
export function formatWorkload(minutes: number): string {
  if (minutes <= 0) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Validates that adding a dependency does not create a circular dependency cycle.
 * Throws an Error if a cycle is detected.
 */
export function validateNoDependencyCycle(
  taskId: string,
  dependsOnTaskId: string,
  getTaskFn: (id: string) => Task | null | undefined
): void {
  if (!taskId || !dependsOnTaskId) return;

  if (taskId === dependsOnTaskId) {
    throw new Error(`Circular dependency detected: task ${taskId} cannot depend on itself.`);
  }

  const visited = new Set<string>([taskId]);
  let current: string | null = dependsOnTaskId;

  while (current) {
    if (visited.has(current)) {
      throw new Error(`Circular dependency detected: cycle involving task ${taskId} and ${current}.`);
    }
    visited.add(current);
    const parent = getTaskFn(current);
    current = parent?.dependsOnTaskId || null;
  }
}

/**
 * Calculates next recurrence due date based on rule.
 * Supported rules: 'daily', 'weekly', 'biweekly', 'monthly'.
 */
export function calculateNextRecurrenceDate(currentDueDate: string, recurrenceRule: string = 'weekly'): string {
  const current = parseLocalDate(currentDueDate);
  const next = new Date(current);

  const rule = recurrenceRule.toLowerCase();
  if (rule.includes('dai') || rule.includes('day')) {
    next.setDate(next.getDate() + 1);
  } else if (rule.includes('biweek')) {
    next.setDate(next.getDate() + 14);
  } else if (rule.includes('week')) {
    next.setDate(next.getDate() + 7);
  } else if (rule.includes('month')) {
    next.setMonth(next.getMonth() + 1);
  } else {
    // Default weekly
    next.setDate(next.getDate() + 7);
  }

  return formatLocalDate(next);
}
