/**
 * BunkMatKar — TypeScript Types & Data Models
 * 
 * Core entities and their relationships for the college-life OS.
 */

// ─── Enums ──────────────────────────────────────────────────────

export type AttendanceStatus = 'safe' | 'watch' | 'danger';
export type TaskCategory = 'assignment' | 'lab' | 'study' | 'personal' | 'reminder';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'inbox' | 'planned' | 'in_progress' | 'completed';
export type ClassType = 'lecture' | 'lab' | 'tutorial' | 'seminar';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// ─── Core Entities ──────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  collegeId: string;
  semesterId: string;
  attendanceTarget: number; // e.g., 75
  program?: string;
  branch?: string;
  year?: number;
  section?: string;
  academicYear?: string;
  createdAt: string;
}

export interface College {
  id: string;
  name: string;
  shortName: string;
  universityBoard?: string;
  campus?: string;
  city?: string;
  state?: string;
  category?: string;
}

export interface Semester {
  id: string;
  name: string;
  number: number;
  startDate: string;
  endDate: string;
  collegeId: string;
  academicYear?: string;
  isCurrent?: boolean;
  status?: 'current' | 'completed' | 'archived';
}

export interface Subject {
  id: string;
  name: string;
  shortName: string;
  code: string;
  color: string;
  semesterId: string;
  facultyId: string;
  facultyName?: string;
  room?: string;
  credits: number;
  isArchived?: boolean;
  subjectType?: 'lecture' | 'lab' | 'tutorial' | 'mixed';
  targetAttendance?: number;
}

export interface Faculty {
  id: string;
  name: string;
  shortName: string;
  department: string;
  email?: string;
}

// ─── Schedule & Classes ─────────────────────────────────────────

export interface ClassSession {
  id: string;
  subjectId: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
  room: string;
  type: ClassType;
  semesterId: string;
}

export interface ClassInstance {
  id: string;
  classSessionId: string;
  date: string; // "2026-09-12"
  subject: Subject;
  startTime: string;
  endTime: string;
  room: string;
  type: ClassType;
  attendance?: 'present' | 'absent';
  isCancelled?: boolean;
}

// ─── Attendance ─────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  classSessionId: string;
  subjectId: string;
  date: string;
  status: 'present' | 'absent';
  markedAt: string;
}

export interface SubjectAttendance {
  subjectId: string;
  subject: Subject;
  attended: number;
  total: number;
  percentage: number;
  status: AttendanceStatus;
  safeBunks: number;
  classesNeededToRecover: number;
}

// ─── Tasks ──────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  status?: TaskStatus;
  isCompleted: boolean;
  subjectId?: string;
  subject?: Subject;
  classSessionId?: string;
  classDate?: string;
  topicId?: string;
  examId?: string;
  resourceId?: string;
  dueDate?: string;
  dueTime?: string;
  estimatedMinutes?: number;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;

  // Subtasks & Dependencies
  parentTaskId?: string;
  sortOrder?: number;
  dependsOnTaskId?: string;

  // Recurrence & Scheduling
  isRecurring?: boolean;
  recurrenceRule?: string; // 'daily' | 'weekly' | 'biweekly' | 'monthly'
  recurrenceEndDate?: string;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
}

// ─── Exams & Marks ──────────────────────────────────────────────

export interface Exam {
  id: string;
  subjectId: string;
  subject?: Subject;
  name: string;
  type: 'internal' | 'external' | 'quiz' | 'viva' | 'practical';
  date: string;
  time?: string;
  room?: string;
  maxMarks: number;
  weightage?: number;
  semesterId: string;
}

export interface Mark {
  id: string;
  examId: string;
  subjectId: string;
  obtained: number;
  maxMarks: number;
  weightage?: number;
}

// ─── Labs ───────────────────────────────────────────────────────

export interface Lab {
  id: string;
  title: string;
  subjectId: string;
  subject?: Subject;
  dueDate?: string;
  isCompleted: boolean;
  description?: string;
  labNumber: number;
}

// ─── Materials ──────────────────────────────────────────────────

export interface Material {
  id: string;
  title: string;
  subjectId: string;
  type: 'notes' | 'slides' | 'reference' | 'link';
  url?: string;
  createdAt: string;
}

// ─── Leave Planner ──────────────────────────────────────────────

export interface LeavePlan {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string;
  classesMissed: number;
  attendanceImpact: {
    subjectId: string;
    currentPercentage: number;
    projectedPercentage: number;
    classesMissed: number;
  }[];
}

// ─── Timeline ───────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  classSessionId?: string;
  date?: string;
  type: 'class' | 'task' | 'exam' | 'event' | 'break';
  title: string;
  subtitle?: string;
  startTime: string;
  endTime?: string;
  room?: string;
  subjectId?: string;
  color?: string;
  attendance?: 'present' | 'absent';
  isPast: boolean;
  isCurrent: boolean;
  isNext: boolean;
}

// ─── Quick Add ──────────────────────────────────────────────────

export type QuickAddType = 'assignment' | 'lab' | 'study' | 'event' | 'exam' | 'personal';

// ─── Lockin ──────────────────────────────────────────────────────

export {
  type LockinSession,
  type LockinSessionRow,
  type LockinSessionStatus,
  type LockinSessionType,
  type LockinStreak,
  type LockinStreakRow,
  type LockinStreakType,
  type LockinExamPreset,
  type LockinExamPresetRow,
  type ExamPresetType,
  DEFAULT_EXAM_PRESETS,
  mapLockinSessionRow,
  mapLockinStreakRow,
  mapLockinExamPresetRow,
} from './lockin';

// ─── Needs Attention Item ───────────────────────────────────────

export interface AttentionItem {
  id: string;
  type: 'attendance_warning' | 'overdue_task' | 'due_soon' | 'upcoming_exam';
  title: string;
  subtitle: string;
  severity: 'warning' | 'danger' | 'info';
  subjectId?: string;
  actionLabel?: string;
}
