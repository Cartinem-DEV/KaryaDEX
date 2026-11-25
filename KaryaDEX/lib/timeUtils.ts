/**
 * KaryaDEX — Time & Date Utilities
 * 
 * Helpers for time-aware UI, greeting generation, and schedule computation.
 */

import type { DayOfWeek, ClassSession, ClassInstance, Subject, TimelineEvent } from '@/types';

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export function getCurrentDayOfWeek(): DayOfWeek {
  return DAY_MAP[new Date().getDay()];
}

export function getDayOfWeekFromDate(date: Date): DayOfWeek {
  return DAY_MAP[date.getDay()];
}

export function getGreeting(): { greeting: string; emoji: string } {
  const hour = new Date().getHours();

  if (hour < 5) return { greeting: 'Night owl mode', emoji: '🦉' };
  if (hour < 12) return { greeting: 'Good morning', emoji: '👋' };
  if (hour < 17) return { greeting: 'Good afternoon', emoji: '☀️' };
  if (hour < 21) return { greeting: 'Good evening', emoji: '🌙' };
  return { greeting: 'Still going?', emoji: '💤' };
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Formats a Date object to YYYY-MM-DD in the device's local timezone.
 * Avoids UTC shifts that cause off-by-one errors across midnight in UTC+ and UTC- timezones.
 */
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a YYYY-MM-DD string into a Date at local midnight.
 * Calling new Date('YYYY-MM-DD') standardizes to UTC midnight in JS, which causes
 * day shifts in non-UTC timezones.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Get today's classes from weekly recurring sessions.
 */
export function getTodayClasses(
  sessions: ClassSession[],
  subjects: Subject[],
  date: Date = new Date()
): ClassInstance[] {
  const dayOfWeek = getDayOfWeekFromDate(date);
  const dateStr = formatLocalDate(date);
  const subjectMap = new Map(subjects.map(s => [s.id, s]));

  return sessions
    .filter(s => s.dayOfWeek === dayOfWeek)
    .map(session => ({
      id: `${session.id}-${dateStr}`,
      classSessionId: session.id,
      date: dateStr,
      subject: subjectMap.get(session.subjectId)!,
      startTime: session.startTime,
      endTime: session.endTime,
      room: session.room,
      type: session.type,
    }))
    .filter(c => c.subject) // Filter out classes with missing subjects
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/**
 * Get the next upcoming class.
 */
export function getNextClass(classes: ClassInstance[]): ClassInstance | null {
  const currentMinutes = getCurrentTimeMinutes();
  return classes.find(c => timeToMinutes(c.startTime) > currentMinutes) || null;
}

/**
 * Get the current class (if any).
 */
export function getCurrentClass(classes: ClassInstance[]): ClassInstance | null {
  const currentMinutes = getCurrentTimeMinutes();
  return classes.find(
    c => timeToMinutes(c.startTime) <= currentMinutes && timeToMinutes(c.endTime) > currentMinutes
  ) || null;
}

/**
 * Build timeline events from today's classes.
 */
export function buildTimeline(classes: ClassInstance[]): TimelineEvent[] {
  const currentMinutes = getCurrentTimeMinutes();

  return classes.map((cls, index) => {
    const startMin = timeToMinutes(cls.startTime);
    const endMin = timeToMinutes(cls.endTime);
    const isPast = endMin <= currentMinutes;
    const isCurrent = startMin <= currentMinutes && endMin > currentMinutes;

    // Check if this is the next upcoming class
    const isNext = !isPast && !isCurrent && 
      !classes.slice(0, index).some(c => {
        const cEnd = timeToMinutes(c.endTime);
        return cEnd > currentMinutes;
      });

    return {
      id: cls.id,
      classSessionId: cls.classSessionId,
      date: cls.date,
      type: 'class' as const,
      title: cls.subject.shortName,
      subtitle: `${cls.room} · ${cls.type}`,
      startTime: cls.startTime,
      endTime: cls.endTime,
      room: cls.room,
      subjectId: cls.subject.id,
      color: cls.subject.color,
      attendance: cls.attendance,
      isPast,
      isCurrent,
      isNext,
    };
  });
}

/**
 * Get time-aware dynamic message for the hero card.
 */
export function getHeroMessage(
  classes: ClassInstance[]
): { message: string; emoji: string } {
  const currentMinutes = getCurrentTimeMinutes();
  const currentClass = getCurrentClass(classes);
  const nextClass = getNextClass(classes);

  if (currentClass) {
    const endMin = timeToMinutes(currentClass.endTime);
    const remaining = endMin - currentMinutes;
    if (remaining <= 5) {
      return { message: `${currentClass.subject.shortName} — almost done`, emoji: '⏱️' };
    }
    return { message: `${currentClass.subject.shortName} — now`, emoji: '📚' };
  }

  if (nextClass) {
    const startMin = timeToMinutes(nextClass.startTime);
    const diff = startMin - currentMinutes;

    if (diff <= 5) {
      return { message: `${nextClass.subject.shortName} starting now`, emoji: '🏃' };
    }
    if (diff <= 15) {
      return { message: `${nextClass.subject.shortName} in ${diff} min`, emoji: '⏰' };
    }
    if (diff <= 30) {
      return { message: `${nextClass.subject.shortName} in ${diff} min`, emoji: '📋' };
    }
    return { message: `Next: ${nextClass.subject.shortName}`, emoji: '📖' };
  }

  // No more classes
  if (classes.length === 0) {
    return { message: 'No classes today', emoji: '🎉' };
  }

  const hour = new Date().getHours();
  if (hour < 9) {
    return { message: 'Classes start soon', emoji: '☀️' };
  }
  return { message: 'All done for today', emoji: '✅' };
}

/**
 * Get remaining items count for evening summary
 */
export function getRemainingCount(classes: ClassInstance[], tasks: { isCompleted: boolean; dueDate?: string }[]): number {
  const currentMinutes = getCurrentTimeMinutes();
  const today = formatLocalDate(new Date());
  
  const remainingClasses = classes.filter(c => timeToMinutes(c.endTime) > currentMinutes).length;
  const todayTasks = tasks.filter(t => !t.isCompleted && t.dueDate === today).length;
  
  return remainingClasses + todayTasks;
}

/**
 * Days until a date in local calendar days
 */
export function daysUntil(dateStr: string, fromDate?: Date): number {
  const target = parseLocalDate(dateStr);
  const today = fromDate ? new Date(fromDate) : new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Is a date string today in local time?
 */
export function isToday(dateStr: string): boolean {
  return dateStr.split('T')[0] === formatLocalDate(new Date());
}

/**
 * Is a date string tomorrow in local time?
 */
export function isTomorrow(dateStr: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateStr.split('T')[0] === formatLocalDate(tomorrow);
}

/**
 * Format a due date in human-friendly terms
 */
export function formatDueDate(dateStr: string): string {
  if (isToday(dateStr)) return 'Today';
  if (isTomorrow(dateStr)) return 'Tomorrow';
  
  const days = daysUntil(dateStr);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days <= 7) return `In ${days} days`;
  
  return formatDateShort(parseLocalDate(dateStr));
}
