/**
 * BunkMatKar — Lockin Mode Domain Types
 *
 * Types for the Lockin feature: focused study sessions with streak tracking
 * and exam presets for Pomodoro-style deep work.
 */

// ─── Enums ──────────────────────────────────────────────────────

export type LockinSessionStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type LockinSessionType = 'focus' | 'pomodoro' | 'exam_prep' | 'deep_work' | 'playground';
export type LockinStreakType = 'daily' | 'weekly' | 'monthly';
export type ExamPresetType = 'midterm' | 'final' | 'quiz' | 'practical' | 'viva' | 'focus' | 'deep_work' | 'exam_prep' | 'custom';

// ─── Lockin Session ──────────────────────────────────────────────

export interface LockinSession {
  id: string;
  userId: string;
  subjectId?: string;
  sessionType: LockinSessionType;
  presetId?: string;
  status: LockinSessionStatus;
  plannedDurationMinutes: number;
  actualDurationMinutes: number;
  focusScore: number; // 0-100, calculated from interruptions, pauses, etc.
  startedAt: string;
  pausedAt?: string;
  resumedAt?: string;
  completedAt?: string;
  abandonedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LockinSessionRow {
  id: string;
  user_id: string;
  subject_id: string | null;
  session_type: string;
  preset_id: string | null;
  status: string;
  planned_duration_minutes: number;
  actual_duration_minutes: number;
  focus_score: number;
  started_at: string;
  paused_at: string | null;
  resumed_at: string | null;
  completed_at: string | null;
  abandoned_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Lockin Streak ───────────────────────────────────────────────

export interface LockinStreak {
  id: string;
  userId: string;
  streakType: LockinStreakType;
  currentStreak: number;
  longestStreak: number;
  lastSessionDate: string; // ISO date string (YYYY-MM-DD)
  streakStartDate: string;
  streakEndDate?: string;
  totalSessions: number;
  totalFocusMinutes: number;
  averageFocusScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface LockinStreakRow {
  id: string;
  user_id: string;
  streak_type: string;
  current_streak: number;
  longest_streak: number;
  last_session_date: string;
  streak_start_date: string;
  streak_end_date: string | null;
  total_sessions: number;
  total_focus_minutes: number;
  average_focus_score: number;
  created_at: string;
  updated_at: string;
}

// ─── Lockin Exam Preset ──────────────────────────────────────────

export interface LockinExamPreset {
  id: string;
  userId: string;
  name: string;
  type: ExamPresetType;
  subjectId?: string;
  // Pomodoro configuration
  workDurationMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsUntilLongBreak: number;
  // Exam prep configuration
  targetFocusMinutes?: number;
  targetSessions?: number;
  // Metadata
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LockinExamPresetRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  subject_id: string | null;
  work_duration_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  sessions_until_long_break: number;
  target_focus_minutes: number | null;
  target_sessions: number | null;
  is_default: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ─── Lockin Blocked App ────────────────────────────────────────────

export interface LockinBlockedApp {
  id: string;
  userId: string;
  packageName: string;
  appName: string;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LockinBlockedAppRow {
  id: string;
  user_id: string;
  package_name: string;
  app_name: string;
  is_blocked: number;
  created_at: string;
  updated_at: string;
}

// ─── Lockin YouTube Channel ────────────────────────────────────────

export interface LockinYtChannel {
  id: string;
  userId: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  isWhitelisted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LockinYtChannelRow {
  id: string;
  user_id: string;
  channel_id: string;
  channel_name: string;
  channel_url: string;
  is_whitelisted: number;
  created_at: string;
  updated_at: string;
}

export interface IndianExam {
  id: string;
  name: string;
  fullName: string;
  category: string;
  level: string;
  conductingBody: string;
  frequency: string;
  subjects: string[];
  durationMinutes: number;
  totalQuestions: number;
  presetId: string;
}

// ─── Default Presets ─────────────────────────────────────────────

export const DEFAULT_EXAM_PRESETS: Omit<LockinExamPreset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Pomodoro Classic',
    type: 'custom',
    workDurationMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsUntilLongBreak: 4,
    isDefault: true,
    isActive: true,
  },
  {
    name: 'Deep Work 50/10',
    type: 'focus',
    workDurationMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 30,
    sessionsUntilLongBreak: 2,
    isDefault: false,
    isActive: true,
  },
  {
    name: 'Exam Cram 90/20',
    type: 'exam_prep',
    workDurationMinutes: 90,
    shortBreakMinutes: 20,
    longBreakMinutes: 60,
    sessionsUntilLongBreak: 1,
    targetFocusMinutes: 180,
    targetSessions: 2,
    isDefault: false,
    isActive: true,
  },
  {
    name: 'Quick Sprint 15/5',
    type: 'focus',
    workDurationMinutes: 15,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsUntilLongBreak: 3,
    isDefault: false,
    isActive: true,
  },
  {
    name: 'Marathon 120/30',
    type: 'deep_work',
    workDurationMinutes: 120,
    shortBreakMinutes: 30,
    longBreakMinutes: 60,
    sessionsUntilLongBreak: 1,
    targetFocusMinutes: 240,
    targetSessions: 2,
    isDefault: false,
    isActive: true,
  },
];

// ─── Lockin Schedule ───────────────────────────────────────────────

export type LockinStrictMode = 'none' | 'soft' | 'hard';

export interface LockinSchedule {
  id: string;
  userId: string;
  name: string;
  daysOfWeek: number[]; // 1-7 (Mon-Sun)
  startTime: string; // "HH:mm" 24hr
  endTime: string; // "HH:mm" 24hr
  examId?: string;
  strictMode: LockinStrictMode;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LockinScheduleRow {
  id: string;
  user_id: string;
  name: string;
  days_of_week: string; // JSON array string
  start_time: string;
  end_time: string;
  exam_id: string | null;
  strict_mode: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ─── Lockin App Quota ──────────────────────────────────────────────

export interface LockinAppQuota {
  id: string;
  userId: string;
  packageName: string;
  appName: string;
  dailyLimitMinutes: number;
  usedMinutesToday: number;
  lastResetDate: string; // YYYY-MM-DD
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LockinAppQuotaRow {
  id: string;
  user_id: string;
  package_name: string;
  app_name: string;
  daily_limit_minutes: number;
  used_minutes_today: number;
  last_reset_date: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ─── Lockin Reality Check ──────────────────────────────────────────

export interface LockinRealityCheck {
  id: string;
  userId: string;
  delaySeconds: number;
  promptQuestion: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LockinRealityCheckRow {
  id: string;
  user_id: string;
  delay_seconds: number;
  prompt_question: string;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

// ─── Lockin Emergency Pass ─────────────────────────────────────────

export interface LockinEmergencyPass {
  id: string;
  userId: string;
  weeklyAllowance: number;
  usedThisWeek: number;
  lastResetWeek: string; // YYYY-WW
  passDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface LockinEmergencyPassRow {
  id: string;
  user_id: string;
  weekly_allowance: number;
  used_this_week: number;
  last_reset_week: string;
  pass_duration_minutes: number;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

export function mapLockinScheduleRow(row: LockinScheduleRow): LockinSchedule {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    daysOfWeek: JSON.parse(row.days_of_week),
    startTime: row.start_time,
    endTime: row.end_time,
    examId: row.exam_id ?? undefined,
    strictMode: row.strict_mode as LockinStrictMode,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLockinAppQuotaRow(row: LockinAppQuotaRow): LockinAppQuota {
  return {
    id: row.id,
    userId: row.user_id,
    packageName: row.package_name,
    appName: row.app_name,
    dailyLimitMinutes: row.daily_limit_minutes,
    usedMinutesToday: row.used_minutes_today,
    lastResetDate: row.last_reset_date,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLockinRealityCheckRow(row: LockinRealityCheckRow): LockinRealityCheck {
  return {
    id: row.id,
    userId: row.user_id,
    delaySeconds: row.delay_seconds,
    promptQuestion: row.prompt_question,
    isEnabled: row.is_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLockinEmergencyPassRow(row: LockinEmergencyPassRow): LockinEmergencyPass {
  return {
    id: row.id,
    userId: row.user_id,
    weeklyAllowance: row.weekly_allowance,
    usedThisWeek: row.used_this_week,
    lastResetWeek: row.last_reset_week,
    passDurationMinutes: row.pass_duration_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLockinSessionRow(row: LockinSessionRow): LockinSession {
  return {
    id: row.id,
    userId: row.user_id,
    subjectId: row.subject_id ?? undefined,
    sessionType: row.session_type as LockinSessionType,
    presetId: row.preset_id ?? undefined,
    status: row.status as LockinSessionStatus,
    plannedDurationMinutes: row.planned_duration_minutes,
    actualDurationMinutes: row.actual_duration_minutes,
    focusScore: row.focus_score,
    startedAt: row.started_at,
    pausedAt: row.paused_at ?? undefined,
    resumedAt: row.resumed_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    abandonedAt: row.abandoned_at ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLockinStreakRow(row: LockinStreakRow): LockinStreak {
  return {
    id: row.id,
    userId: row.user_id,
    streakType: row.streak_type as LockinStreakType,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastSessionDate: row.last_session_date,
    streakStartDate: row.streak_start_date,
    streakEndDate: row.streak_end_date ?? undefined,
    totalSessions: row.total_sessions,
    totalFocusMinutes: row.total_focus_minutes,
    averageFocusScore: row.average_focus_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLockinExamPresetRow(row: LockinExamPresetRow): LockinExamPreset {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type as ExamPresetType,
    subjectId: row.subject_id ?? undefined,
    workDurationMinutes: row.work_duration_minutes,
    shortBreakMinutes: row.short_break_minutes,
    longBreakMinutes: row.long_break_minutes,
    sessionsUntilLongBreak: row.sessions_until_long_break,
    targetFocusMinutes: row.target_focus_minutes ?? undefined,
    targetSessions: row.target_sessions ?? undefined,
    isDefault: row.is_default === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLockinBlockedAppRow(row: LockinBlockedAppRow): LockinBlockedApp {
  return {
    id: row.id,
    userId: row.user_id,
    packageName: row.package_name,
    appName: row.app_name,
    isBlocked: row.is_blocked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type { LockinBreakSession, LockinBreakType } from './playground';

export function mapLockinYtChannelRow(row: LockinYtChannelRow): LockinYtChannel {
  return {
    id: row.id,
    userId: row.user_id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    channelUrl: row.channel_url,
    isWhitelisted: row.is_whitelisted === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}