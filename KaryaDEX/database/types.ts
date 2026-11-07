/**
 * BunkMatKar — Database Types & Interfaces
 */

export interface DatabaseConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>;
  withTransactionAsync<T>(action: () => Promise<T>): Promise<T>;
}

export interface SchemaMigration {
  version: number;
  name: string;
  applied_at: string;
}

export interface CollegeRow {
  id: string;
  name: string;
  short_name: string;
  university_board?: string | null;
  campus?: string | null;
  created_at?: string;
}

export interface SemesterRow {
  id: string;
  name: string;
  number: number;
  start_date: string;
  end_date: string;
  college_id: string;
  academic_year?: string | null;
  is_current?: number;
  status?: string | null;
  created_at?: string;
}

export interface StudentRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  college_id: string;
  semester_id: string;
  attendance_target: number;
  program?: string | null;
  branch?: string | null;
  year?: number | null;
  section?: string | null;
  academic_year?: string | null;
  created_at: string;
}

export interface SubjectRow {
  id: string;
  name: string;
  short_name: string;
  code: string;
  color: string;
  semester_id: string | null;
  faculty_id: string | null;
  faculty_name: string | null;
  room: string | null;
  credits: number;
  is_archived: number;
  subject_type?: string | null;
  target_attendance?: number | null;
  created_at: string;
  updated_at: string;
}

export interface TimetableSlotRow {
  id: string;
  subject_id: string;
  semester_id: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string | null;
  type: string;
  is_active: number;
  is_recurring: number;
  effective_from: string | null;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassSessionRow {
  id: string;
  timetable_slot_id: string;
  subject_id: string;
  date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  type: string;
  attendance_status: string;
  created_at: string;
  updated_at: string;
}

export interface ClassNoteRow {
  id: string;
  class_session_id: string;
  date: string;
  subject_id: string;
  attendance_status: string;
  my_notes: string;
  teacher_notes: string;
  revision_status: string;
  last_revised_at: string | null;
  ai_summary: string | null;
  ai_summary_status: string | null;
  ai_summary_updated_at: string | null;
  ai_source_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecordRow {
  id: string;
  subject_id: string;
  class_session_id: string | null;
  date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceAggregateRow {
  subject_id: string;
  attended: number;
  total: number;
  updated_at: string;
}

export interface SyllabusUnitRow {
  id: string;
  subject_id: string;
  semester_id: string | null;
  name: string;
  order_index: number;
  created_at: string;
}

export interface TopicRow {
  id: string;
  unit_id: string;
  subject_id: string;
  name: string;
  is_completed: number;
  revision_status: string;
  last_revised_at: string | null;
  revision_count: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface TopicRevisionHistoryRow {
  id: string;
  topic_id: string;
  revision_status: string;
  revised_at: string;
  class_session_id: string | null;
  notes: string | null;
}

export interface RevisionRecordRow {
  id: string;
  topic_id: string;
  subject_id: string;
  semester_id: string | null;
  reviewed_at: string;
  duration_minutes: number;
  confidence: string;
  outcome: string;
  notes: string | null;
  linked_task_id: string | null;
  linked_class_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceRow {
  id: string;
  class_note_id: string | null;
  class_session_id: string | null;
  subject_id: string | null;
  topic_id: string | null;
  exam_id: string | null;
  title: string;
  type: string;
  uri: string | null;
  url: string | null;
  mime_type: string | null;
  file_size: number;
  source: string;
  is_local: number;
  is_recommended: number;
  created_at: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  class_session_id: string | null;
  class_date: string | null;
  topic_id?: string | null;
  exam_id: string | null;
  resource_id?: string | null;
  due_date: string | null;
  due_time: string | null;
  category: string;
  priority: string;
  status?: string | null;
  estimated_minutes: number;
  is_completed: number;
  completed_at: string | null;
  notes: string | null;
  parent_task_id?: string | null;
  sort_order?: number | null;
  depends_on_task_id?: string | null;
  recurrence_rule?: string | null;
  recurrence_end_date?: string | null;
  scheduled_date?: string | null;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRelationRow {
  id: string;
  task_id: string;
  class_session_id: string | null;
  class_date: string | null;
  class_note_id: string | null;
  created_at: string;
}

export interface ExamRow {
  id: string;
  subject_id: string;
  semester_id: string | null;
  name: string;
  type: string;
  date: string;
  time: string;
  room: string | null;
  max_marks: number;
  weightage: number | null;
  syllabus_notes: string | null;
  revision_progress: number;
  venue: string | null;
  created_at: string;
}

export interface ExamTopicRow {
  id: string;
  exam_id: string;
  topic_id: string;
  weight_hint: string | null;
  created_at: string;
}

export interface AssessmentRow {
  id: string;
  subject_id: string;
  semester_id: string;
  name: string;
  type: string;
  marks_obtained: number;
  marks_max: number;
  weightage: number | null;
  date: string;
  created_at: string;
}

export interface AppSettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export interface StorageSettingRow {
  id: string;
  storage_type: string;
  folder_uri: string | null;
  folder_name: string | null;
  last_migrated_at: string | null;
  updated_at: string;
}

export interface NotificationRecordRow {
  id: string;
  type: string;
  entity_id: string;
  scheduled_for: string;
  expo_notification_id: string | null;
  title: string;
  body: string;
  payload: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingProgressRow {
  id: string;
  status: string;
  current_step: string;
  completed_steps: string;
  draft_data: string;
  updated_at: string;
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

export interface LockinBlockedAppRow {
  id: string;
  user_id: string;
  package_name: string;
  app_name: string;
  is_blocked: number;
  created_at: string;
  updated_at: string;
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
