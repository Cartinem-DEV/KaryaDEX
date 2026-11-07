/**
 * BunkMatKar — Extended Academic Type System
 *
 * Phase 1-10 data models for the connected academic OS.
 * All new entities reference the canonical ClassSession -> Subject graph.
 * Existing types in types/index.ts are NOT modified, only extended here.
 */

import type { ClassType, DayOfWeek, Task, Subject, Exam, AttendanceStatus, Semester } from './index';

// ─── Phase 4: Editable Timetable ────────────────────────────────

/**
 * A timetable slot that generates recurring ClassOccurrences.
 * Replaces the assumption that ClassSession rows are read-only.
 */
export interface TimetableSlot {
  id: string;
  subjectId: string;
  semesterId: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  room: string;
  type: ClassType;
  facultyId?: string;
  isRecurring: boolean;
  /** Future: 'A' | 'B' | null for alternating weeks */
  weekPattern?: 'A' | 'B' | null;
  /** If false, this slot was soft-deleted and won't generate occurrences */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating/editing a timetable slot */
export interface TimetableSlotInput {
  subjectId: string;
  semesterId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string;
  type: ClassType;
  facultyId?: string;
  isRecurring?: boolean;
  weekPattern?: 'A' | 'B' | null;
}

// ─── Phase 1: Class Journal / Class Notes ───────────────────────

/**
 * Revision state for a topic or an entire class note.
 */
export type RevisionStatus = 'not_started' | 'not_taught' | 'taught' | 'revised' | 'needs_revision';

/** AI summary readiness status */
export type AISummaryStatus = 'unavailable' | 'pending' | 'ready' | 'error';

/** AI Context structure prepared for future class journal intelligence */
export interface ClassJournalAIContext {
  classSessionId: string;
  subjectId: string;
  date: string;
  selectedTopicIds: string[];
  myNotes: string;
  teacherNotes: string;
  resources: Array<{ title: string; type: string; url?: string }>;
  revisionState: {
    coveredCount: number;
    revisedCount: number;
    pendingCount: number;
  };
}

/**
 * Topic revision record tracking revision count and timestamps per topic/session.
 */
export interface TopicRevision {
  id: string;
  topicId: string;
  subjectId: string;
  classSessionId: string;
  status: RevisionStatus;
  lastTaughtAt?: string;
  lastRevisedAt?: string;
  revisionCount: number;
}

/** Extended attendance status for class journal (more granular than binary) */
export type ClassAttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'cancelled'
  | 'not_recorded';

/**
 * A ClassNote is bound to one specific class occurrence (classSessionId + date).
 * It is NOT a generic note — it always knows its academic context.
 */
export interface ClassNote {
  id: string;
  /** References TimetableSlot.id (the recurring slot) */
  classSessionId: string;
  /** ISO date string "YYYY-MM-DD" for this specific occurrence */
  date: string;
  subjectId: string;
  attendanceStatus: ClassAttendanceStatus;
  /** Topics discussed in this session */
  topicIds: string[];
  /** Free-form student notes */
  myNotes: string;
  /** Notes from the teacher/board */
  teacherNotes: string;
  /** Overall revision status for this session's content */
  revisionStatus: RevisionStatus;
  /** ISO timestamp of last revision */
  lastRevisedAt?: string;
  /** Resource IDs attached to this session */
  resourceIds: string[];
  /** Task IDs linked from this session */
  linkedTaskIds: string[];
  /** Exam topic IDs this session is relevant to */
  linkedExamTopicIds: string[];
  /** AI summary field ready for future integration */
  aiSummary?: string;
  aiSummaryStatus?: AISummaryStatus;
  aiSummaryUpdatedAt?: string;
  aiSourceHash?: string;
  /** Topic-level revision details snapshot */
  topicRevisions?: Record<string, { status: RevisionStatus; lastRevisedAt?: string; revisionCount: number }>;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating/updating a class note */
export interface ClassNoteInput {
  classSessionId: string;
  date: string;
  subjectId: string;
  attendanceStatus?: ClassAttendanceStatus;
  topicIds?: string[];
  myNotes?: string;
  teacherNotes?: string;
  revisionStatus?: RevisionStatus;
  lastRevisedAt?: string;
  resourceIds?: string[];
  linkedTaskIds?: string[];
  linkedExamTopicIds?: string[];
  aiSummary?: string;
  aiSummaryStatus?: AISummaryStatus;
  aiSummaryUpdatedAt?: string;
  aiSourceHash?: string;
  topicRevisions?: Record<string, { status: RevisionStatus; lastRevisedAt?: string; revisionCount: number }>;
}

// ─── Phase 7: Syllabus Tracker ───────────────────────────────────

/**
 * A single topic in the syllabus.
 * Topics are reusable: they appear in syllabus, class notes, exams, and revision.
 */
export interface Topic {
  id: string;
  subjectId: string;
  unitId: string;
  name: string;
  description?: string;
  isCompleted: boolean;
  revisionStatus: RevisionStatus;
  lastRevisedAt?: string;
  lastTaughtAt?: string;
  revisionCount?: number;
  /** Which class notes covered this topic */
  classNoteIds: string[];
  order: number;
}

/**
 * A unit groups related topics within a subject's syllabus.
 */
export interface SyllabusUnit {
  id: string;
  subjectId: string;
  semesterId: string;
  name: string;
  description?: string;
  order: number;
  topicIds: string[];
}

// ─── Phase 6: Exam Topics ────────────────────────────────────────

/**
 * An exam topic links an Exam to specific syllabus Topics.
 */
export interface ExamTopic {
  id: string;
  examId: string;
  topicId: string;
  weightHint?: 'low' | 'medium' | 'high';
}

/**
 * Extended exam with syllabus topics and revision state.
 */
export interface ExamWithTopics {
  examId: string;
  examTopics: ExamTopic[];
  venue?: string;
  revisionProgress: number; // 0-100
  syllabusNotes?: string;
  relatedTaskIds: string[];
  relatedNoteIds: string[];
}

// ─── Phase 5: Enhanced Task Relationships ───────────────────────

/**
 * Extension to the existing Task type — optional relational context.
 * Stored alongside Task in the store; does not break existing task filters.
 */
export interface TaskRelations {
  taskId: string;
  classNoteId?: string;
  classSessionId?: string;
  classDate?: string;
  examId?: string;
  topicIds?: string[];
}

// ─── Phase 9: Resources ──────────────────────────────────────────

export type ResourceType =
  | 'file'
  | 'scanned_pdf'
  | 'url'
  | 'youtube'
  | 'pdf'
  | 'image'
  | 'document'
  | 'video'
  | 'other';

/**
 * A resource (file, link, scanned PDF, study video) that can be attached to:
 * Subject | ClassNote | Topic | Exam | Task
 */
export interface Resource {
  id: string;
  title: string;
  type: ResourceType;
  classSessionId?: string;
  subjectId?: string;
  uri?: string;
  url?: string;
  sizeBytes?: number;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  source?: 'file' | 'scanned_pdf' | 'url' | 'youtube' | 'local_upload';
  topics?: string[];
  isLocal?: boolean;
  isRecommended?: boolean;
  classNoteId?: string;
  topicId?: string;
  examId?: string;
  taskId?: string;
}

/** YouTube Study Recommendation model */
export interface YouTubeRecommendation {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt?: string;
  duration?: string;
  url: string;
  matchedTopics: string[];
  recommendationScore: number;
  reason: string;
}

/** User file storage configuration preference */
export interface UserStoragePreference {
  storageType: 'app_storage' | 'custom_folder';
  folderUri?: string;
  folderName?: string;
  lastMigratedAt?: string;
}

// ─── Phase 8: Grades / Academic Performance ──────────────────────

/**
 * A single assessment entry. Kept separate so Mark in types/index.ts is not broken.
 */
export interface Assessment {
  id: string;
  subjectId: string;
  semesterId: string;
  examId?: string;
  taskId?: string;
  name: string;
  type: 'internal' | 'external' | 'quiz' | 'assignment' | 'practical' | 'viva';
  marksObtained: number;
  marksMax: number;
  weightage?: number;
  date: string;
}

/**
 * Computed academic performance for a subject.
 */
export interface SubjectPerformance {
  subjectId: string;
  assessments: Assessment[];
  overallPercentage: number;
  grade?: string;
  gradePoints?: number;
  credits: number;
}

/**
 * Semester-level GPA computation.
 */
export interface SemesterGPA {
  semesterId: string;
  subjects: SubjectPerformance[];
  sgpa: number;
  cgpa?: number;
}

// ─── Phase 2: Calendar / Academic Timeline ───────────────────────

export type CalendarEventType =
  | 'class'
  | 'exam'
  | 'task'
  | 'revision'
  | 'attendance'
  | 'study_session'
  | 'holiday'
  | 'makeup_class'
  | 'cancelled_class'
  | 'custom';

export type CalendarEventSourceType =
  | 'class_session'
  | 'task'
  | 'exam'
  | 'revision'
  | 'attendance'
  | 'custom';

/**
 * A unified calendar event. Never duplicates date/time/subject from the source entity.
 */
export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  date: string; // "YYYY-MM-DD"
  startTime?: string; // "HH:MM"
  endTime?: string;   // "HH:MM"
  title: string;
  subtitle?: string;
  color?: string;
  subjectId?: string;
  subjectName?: string;
  sourceId?: string;
  sourceType?: CalendarEventSourceType;
  isCustom: boolean;
  isAllDay?: boolean;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  estimatedMinutes?: number;
  metadata?: {
    room?: string;
    classType?: string;
    isOverdue?: boolean;
    isCompleted?: boolean;
    examType?: string;
    topicId?: string;
    attendanceRecovery?: boolean;
    confidence?: string;
  };
}

// ─── Phase 3: Class History helpers ──────────────────────────────

/**
 * A resolved class occurrence for history views.
 */
export interface ClassOccurrence {
  /** Composite ID: "slotId-YYYY-MM-DD" */
  id: string;
  slotId: string;
  date: string;
  subjectId: string;
  startTime: string;
  endTime: string;
  room: string;
  type: ClassType;
  note: ClassNote | null;
  attendanceStatus: ClassAttendanceStatus;
  topicNames: string[];
}

// ─── Store slice interface ────────────────────────────────────────

export interface AcademicStoreSlice {
  // Data
  timetableSlots: TimetableSlot[];
  classNotes: ClassNote[];
  topics: Topic[];
  syllabusUnits: SyllabusUnit[];
  examTopics: ExamTopic[];
  examExtensions: ExamWithTopics[];
  taskRelations: TaskRelations[];
  resources: Resource[];
  assessments: Assessment[];
  calendarEvents: CalendarEvent[];

  // Timetable CRUD
  addTimetableSlot: (input: TimetableSlotInput) => TimetableSlot;
  updateTimetableSlot: (id: string, updates: Partial<TimetableSlotInput>) => void;
  deleteTimetableSlot: (id: string) => void;

  // Class Journal
  upsertClassNote: (input: ClassNoteInput) => ClassNote;
  getClassNote: (classSessionId: string, date: string) => ClassNote | null;
  getClassNotesForSubject: (subjectId: string) => ClassNote[];
  getClassNotesForDate: (date: string) => ClassNote[];

  // Syllabus
  addSyllabusUnit: (unit: Omit<SyllabusUnit, 'id'>) => SyllabusUnit;
  addTopic: (topic: Omit<Topic, 'id'>) => Topic;
  updateTopicRevision: (topicId: string, status: RevisionStatus) => void;
  toggleTopicCompletion: (topicId: string) => void;
  getTopicsForSubject: (subjectId: string) => Topic[];
  getTopicsForUnit: (unitId: string) => Topic[];
  getUnitsForSubject: (subjectId: string) => SyllabusUnit[];

  // Exam topics
  addExamTopic: (examId: string, topicId: string, weightHint?: ExamTopic['weightHint']) => ExamTopic;
  removeExamTopic: (examTopicId: string) => void;
  getTopicsForExam: (examId: string) => ExamTopic[];
  upsertExamExtension: (data: Partial<ExamWithTopics> & { examId: string }) => void;
  getExamExtension: (examId: string) => ExamWithTopics | null;

  // Task relations
  setTaskRelations: (relations: TaskRelations) => void;
  getTaskRelations: (taskId: string) => TaskRelations | null;

  // Resources
  addResource: (resource: Omit<Resource, 'id' | 'createdAt'>) => Resource;
  deleteResource: (resourceId: string) => void;
  getResourcesForClassNote: (classNoteId: string) => Resource[];
  getResourcesForSubject: (subjectId: string) => Resource[];
  getResourcesForTopic: (topicId: string) => Resource[];

  // Assessments & GPA
  addAssessment: (assessment: Omit<Assessment, 'id'>) => Assessment;
  deleteAssessment: (assessmentId: string) => void;
  getSubjectPerformance: (subjectId: string) => SubjectPerformance;
  getSemesterGPA: () => SemesterGPA;

  // Calendar
  getCalendarEventsForDate: (date: string) => CalendarEvent[];
  getCalendarEventsForMonth: (year: number, month: number) => CalendarEvent[];

  // Class history
  getClassOccurrencesForSubject: (subjectId: string, fromDate?: Date | string, toDate?: Date | string) => ClassOccurrence[];
  getClassOccurrencesForDate: (date: string) => ClassOccurrence[];
  getAllClassOccurrences: (fromDate: string, toDate: string) => ClassOccurrence[];
}

// ─── Phase 4: Academic Hub & Notification Engine ────────────────

export type AcademicAttentionType =
  | 'missing_journal'
  | 'revision_backlog'
  | 'overdue_task'
  | 'task_due'
  | 'upcoming_exam'
  | 'attendance_risk'
  | 'upcoming_class'
  | 'workload_overload';

export type AcademicAttentionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface AcademicAttentionItem {
  id: string;
  type: AcademicAttentionType;
  priority: AcademicAttentionPriority;
  title: string;
  subtitle: string;
  subjectId?: string;
  classSessionId?: string;
  taskId?: string;
  topicId?: string;
  examId?: string;
  actionLabel?: string;
  actionRoute?: string;
  metadata?: Record<string, any>;
}

export interface TodayAcademicSnapshot {
  currentClass: ClassOccurrence | null;
  nextClass: ClassOccurrence | null;
  todayClasses: ClassOccurrence[];
  completedClasses: ClassOccurrence[];
  unrecordedClasses: ClassOccurrence[];
  pendingTasks: Task[];
  overdueTasks: Task[];
  todayWorkloadMinutes: number;
  todayWorkloadFormatted: string;
  upcomingExam: Exam | null;
  daysUntilExam?: number;
  revisionBacklogCount: number;
  missingJournalCount: number;
  attentionItems: AcademicAttentionItem[];
}

export interface TopicAcademicContext {
  topic: Topic;
  subject?: Subject;
  unit?: SyllabusUnit;
  classSessions: Array<{
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
  resources: Resource[];
  tasks: {
    all: Task[];
    pending: Task[];
    completed: Task[];
    overdue: Task[];
  };
  pendingTasks?: Task[];
  completedTasks?: Task[];
  exams: Exam[];
  revision: {
    status: RevisionStatus;
    lastRevisedAt?: string;
    revisionCount: number;
  };
}

export interface SubjectAcademicSnapshot {
  subjectId: string;
  subjectName: string;
  attendancePercentage: number;
  attendanceStatus: AttendanceStatus;
  safeBunks: number;
  recoveryClasses: number;
  tasksPending: number;
  tasksOverdue: number;
  workloadMinutes: number;
  topicsTotal: number;
  topicsTaught: number;
  topicsRevised: number;
  topicBacklog: number;
  upcomingExams: Exam[];
  currentMarks: { obtained: number; maxMarks: number; percentage: number } | null;
  recentClassSessions: ClassOccurrence[];
}

export interface WorkloadReport {
  totalMinutes: number;
  formattedTime?: string;
  taskCount: number;
  overdueCount: number;
  highPriorityCount: number;
}

export type NotificationCategory =
  | 'class_reminder'
  | 'task_reminder'
  | 'exam_reminder'
  | 'revision_reminder'
  | 'attendance_alert'
  | 'post_class_journal';

export interface NotificationPayload {
  type: NotificationCategory;
  entityId: string;
  subjectId?: string;
  classSessionId?: string;
  taskId?: string;
  topicId?: string;
  examId?: string;
  deepLinkTarget?: string;
  isCritical?: boolean;
}

export interface NotificationSettings {
  masterEnabled: boolean;
  /** When enabled, notification titles/bodies are masked on lock screen to protect academic privacy */
  privacyMode?: boolean;
  classReminders: {
    enabled: boolean;
    minutesBefore: number[];
  };
  taskReminders: {
    enabled: boolean;
    dueToday: boolean;
    overdue: boolean;
  };
  examReminders: {
    enabled: boolean;
    daysBefore: number[];
  };
  revisionReminders: {
    enabled: boolean;
    dailyLimitPerSubject: number;
  };
  attendanceAlerts: {
    enabled: boolean;
    dangerThreshold: number;
  };
  postClassJournal: {
    enabled: boolean;
    delayMinutesAfterEnd: number;
  };
  quietHours: {
    enabled: boolean;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    suppressNonCritical: boolean;
  };
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  masterEnabled: true,
  privacyMode: false,
  classReminders: {
    enabled: true,
    minutesBefore: [30, 10],
  },
  taskReminders: {
    enabled: true,
    dueToday: true,
    overdue: true,
  },
  examReminders: {
    enabled: true,
    daysBefore: [7, 3, 1, 0],
  },
  revisionReminders: {
    enabled: true,
    dailyLimitPerSubject: 1,
  },
  attendanceAlerts: {
    enabled: true,
    dangerThreshold: 75,
  },
  postClassJournal: {
    enabled: true,
    delayMinutesAfterEnd: 15,
  },
  quietHours: {
    enabled: true,
    startHour: 23,
    startMinute: 0,
    endHour: 7,
    endMinute: 0,
    suppressNonCritical: true,
  },
};

// ─── Phase 6: Academic Intelligence Core ────────────────────────

export type CanonicalTopicState = 'not_started' | 'taught' | 'revised' | 'needs_revision';

export interface AttendanceForecastScenario {
  missedCount: number;
  projectedPercentage: number;
  status: AttendanceStatus;
  delta: number;
}

export interface AttendanceForecast {
  currentPercentage: number;
  currentStatus: AttendanceStatus;
  targetPercentage: number;
  safeBunks: number;
  recoveryClasses: number;
  safetyMargin: number;
  missScenarios: AttendanceForecastScenario[];
  attendScenarios: Array<{
    attendCount: number;
    projectedPercentage: number;
    status: AttendanceStatus;
    delta: number;
  }>;
}

export interface BunkRecommendationItem {
  subject: Subject;
  attended: number;
  total: number;
  currentAttendance: number;
  target: number;
  safeBunks: number;
  recoveryClasses: number;
  riskLevel: AttendanceStatus;
  recommendation: string;
}

export interface SemesterAttendanceForecast {
  currentOverallPercentage: number;
  projectedOverallPercentage: number;
  totalAttended: number;
  totalClasses: number;
  projectedTotalClasses: number;
  targetPercentage: number;
  status: AttendanceStatus;
  plannedMissesTotal: number;
  breakdown: Array<{
    subjectId: string;
    subjectName: string;
    currentAttended: number;
    currentTotal: number;
    plannedMisses: number;
    projectedPercentage: number;
    status: AttendanceStatus;
  }>;
}

export interface SemesterHealthDimension {
  name: string;
  label: string;
  score: number;
  weight: number;
  detail: string;
  status: 'healthy' | 'warning' | 'critical' | 'neutral';
}

export interface SemesterHealthReport {
  overallScore: number;
  dimensions: {
    attendance: SemesterHealthDimension;
    tasks: SemesterHealthDimension;
    syllabus: SemesterHealthDimension;
    revision: SemesterHealthDimension;
    exams: SemesterHealthDimension;
    marks: SemesterHealthDimension;
  };
  mainAttentionArea: {
    dimension: string;
    title: string;
    subtitle: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  } | null;
}

export interface SemesterAcademicSnapshot {
  semester: Semester;
  subjectCount: number;
  activeSubjects: Subject[];
  archivedSubjects: Subject[];
  classCount: number;
  attendanceSummary: {
    overallPercentage: number;
    totalAttended: number;
    totalClasses: number;
    safeBunks: number;
    recoveryClasses: number;
  };
  taskSummary: {
    pending: number;
    overdue: number;
    completed: number;
    workloadMinutes: number;
  };
  syllabusSummary: {
    totalTopics: number;
    taughtTopics: number;
    revisedTopics: number;
    backlogTopics: number;
    coveragePercentage: number;
    revisionPercentage: number;
  };
  examSummary: {
    totalExams: number;
    upcomingExam: Exam | null;
    daysUntilExam?: number;
  };
  marksSummary: {
    totalObtained: number;
    totalMax: number;
    overallPercentage: number | null;
  };
  health: SemesterHealthReport;
  bunkRecommendations: BunkRecommendationItem[];
}

// ─── Phase 7: Revision Intelligence & Exam Sprint ────────────────

export type RevisionConfidence = 'low' | 'medium' | 'high';
export type RevisionOutcome = 'needs_review' | 'okay' | 'confident';

export type RevisionState =
  | 'NOT_TAUGHT'
  | 'TAUGHT'
  | 'NOT_REVIEWED'
  | 'REVIEWED'
  | 'CONFIDENT'
  | 'NEEDS_REVIEW';

export type RevisionPriority = 'low' | 'medium' | 'high' | 'critical';

export interface RevisionRecord {
  id: string;
  topicId: string;
  subjectId: string;
  semesterId?: string;
  reviewedAt: string;
  durationMinutes: number;
  confidence: RevisionConfidence;
  outcome: RevisionOutcome;
  notes?: string;
  linkedTaskId?: string;
  linkedClassSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export type RevisionRecordInput = Omit<RevisionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export interface TopicRevisionIntelligence {
  topicId: string;
  topicName: string;
  subjectId: string;
  isTaught: boolean;
  hasBeenReviewed: boolean;
  reviewCount: number;
  lastReviewedAt?: string;
  firstTaughtAt?: string;
  daysSinceTaught?: number;
  daysSinceLastRevision?: number;
  latestConfidence?: RevisionConfidence;
  latestOutcome?: RevisionOutcome;
  revisionState: RevisionState;
  revisionPriority: RevisionPriority;
  isStale: boolean;
  upcomingExam?: {
    examId: string;
    name: string;
    date: string;
    daysUntil: number;
  };
}

export interface RevisionStatistics {
  totalTopics: number;
  taughtTopics: number;
  reviewedTopics: number;
  confidentTopics: number;
  needsReviewTopics: number;
  notReviewedTopics: number;
  criticalCount: number;
  highPriorityCount: number;
  totalDurationMinutes: number;
}

export interface ExamReadiness {
  examId: string;
  examName: string;
  subjectId: string;
  examDate: string;
  daysRemaining: number;
  totalSyllabusTopics: number;
  taughtTopics: number;
  reviewedTopics: number;
  confidentTopics: number;
  needsReviewTopics: number;
  notReviewedTopics: number;
  criticalTopics: number;
  highPriorityTopics: number;
  estimatedRevisionWorkloadMinutes: number;
  readinessPercentage: number;
}

export interface ExamSprintDayTopicItem {
  topicId: string;
  topicName: string;
  priority: RevisionPriority;
  estimatedMinutes: number;
  outcome?: RevisionOutcome;
  confidence?: RevisionConfidence;
}

export interface ExamSprintDayItem {
  dayIndex: number;
  date: string;
  topics: ExamSprintDayTopicItem[];
  totalEstimatedMinutes: number;
}

export interface ExamSprintPlan {
  examId: string;
  examName: string;
  subjectId: string;
  daysRemaining: number;
  readiness: ExamReadiness;
  days: ExamSprintDayItem[];
  totalSprintTopics: number;
  totalEstimatedMinutes: number;
  workloadWarning?: string;
}

// ─── Phase 8: Advanced Attendance Intelligence ──────────────────

export type AttendanceTrend = 'improving' | 'stable' | 'declining' | 'insufficient_data';
export type AttendancePressure = 'low' | 'medium' | 'high' | 'critical';

export interface SafeBunkBreakdown {
  immediatelySafe: number;       // Bunks while staying in 'safe' (>= target + 5)
  conditionallySafe: number;     // Extra bunks that stay in 'watch' (>= target)
  totalSafeBunks: number;        // Total bunks while staying >= target
  effectiveBunkCapacity: number; // min(totalSafeBunks, futureClassesRemaining)
  statusIfBunkedNext: AttendanceStatus;
  percentageIfBunkedNext: number;
}

export interface AttendanceRecoveryInfo {
  isNeeded: boolean;
  consecutiveClassesNeeded: number;
  projectedPercentageAfterRecovery: number;
  futureClassesAvailable: number;
  isPossible: boolean;
  impossibleReason?: string;
  recoveryDeadlineDate?: string;
}

export interface UpcomingExamAttendanceExposure {
  examId: string;
  examName: string;
  examDate: string;
  daysUntil: number;
  classesBeforeExam: number;
  safeBunksBeforeExam: number;
  statusBeforeExam: AttendanceStatus;
  isHighExposure: boolean;
}

export interface AttendanceIntelligenceSnapshot {
  subjectId: string;
  subjectName: string;
  attended: number;
  total: number;
  missed: number;
  currentPercentage: number;
  targetPercentage: number;
  safetyMargin: number; // percentage - target
  status: AttendanceStatus; // 'safe' | 'watch' | 'danger'
  trend: AttendanceTrend; // 'improving' | 'stable' | 'declining' | 'insufficient_data'
  pressure: AttendancePressure; // 'low' | 'medium' | 'high' | 'critical'
  safeBunks: SafeBunkBreakdown;
  recovery: AttendanceRecoveryInfo;
  futureClassesRemaining: number;
  nextScheduledClass?: {
    date: string;
    startTime: string;
    endTime: string;
    room?: string;
  };
  examExposure?: UpcomingExamAttendanceExposure;
  classesUntilStatusChange: {
    toWatch: number;   // bunks to enter watch (< target + 5)
    toDanger: number;  // bunks to enter danger (< target)
    toSafe: number;    // presents to enter safe (>= target + 5)
  };
  recommendation: string;
}

export interface AttendanceWhatIfInput {
  subjectId: string;
  simulatedMisses?: number;
  simulatedPresents?: number;
}

export interface AttendanceWhatIfResult {
  currentPercentage: number;
  currentStatus: AttendanceStatus;
  projectedPercentage: number;
  projectedStatus: AttendanceStatus;
  projectedMargin: number;
  delta: number;
  newAttended: number;
  newTotal: number;
  newMissed: number;
  safeBunksRemaining: number;
  recoveryClassesNeeded: number;
  isRecoverable: boolean;
  recoveryPossibleInSchedule: boolean;
  recommendation: string;
}

export interface SemesterAttendanceIntelligenceSummary {
  overallPercentage: number;
  overallStatus: AttendanceStatus;
  targetPercentage: number;
  totalAttended: number;
  totalClasses: number;
  totalMissed: number;
  totalSafeBunks: number;
  strongestSubject?: { id: string; name: string; percentage: number };
  weakestSubject?: { id: string; name: string; percentage: number };
  dangerSubjects: AttendanceIntelligenceSnapshot[];
  watchSubjects: AttendanceIntelligenceSnapshot[];
  safeSubjects: AttendanceIntelligenceSnapshot[];
  highPressureSubjects: AttendanceIntelligenceSnapshot[];
  decliningTrendSubjects: AttendanceIntelligenceSnapshot[];
  recoveryRequiredSubjects: AttendanceIntelligenceSnapshot[];
  snapshots: Record<string, AttendanceIntelligenceSnapshot>;
}

// ─── Phase 9: Academic Calendar & Study Planning ──────────────────

export type WorkloadLevel = 'light' | 'moderate' | 'heavy' | 'overloaded';

export interface DailyWorkload {
  date: string; // "YYYY-MM-DD"
  classesMinutes: number;
  classesCount: number;
  tasksMinutes: number;
  tasksCount: number;
  revisionMinutes: number;
  revisionCount: number;
  examsCount: number;
  totalMinutes: number;       // classes + tasks + revision
  studyMinutes: number;       // tasks + revision (independent study)
  capacityMinutes: number;    // student's daily study capacity preference (e.g. 120)
  isOverloaded: boolean;
  status: WorkloadLevel;
  explanation: string;
}

export type StudyPlanItemType =
  | 'critical_revision'
  | 'urgent_exam_prep'
  | 'overdue_task'
  | 'due_task'
  | 'scheduled_task'
  | 'high_priority_task'
  | 'recommended_revision'
  | 'class_session'
  | 'exam';

export interface StudyPlanItem {
  id: string;
  sourceType: 'task' | 'revision' | 'class' | 'exam';
  sourceId: string;
  title: string;
  subtitle?: string;
  subjectId?: string;
  subjectName?: string;
  color?: string;
  date: string; // "YYYY-MM-DD"
  suggestedStartTime?: string; // "HH:MM"
  suggestedEndTime?: string;   // "HH:MM"
  durationMinutes: number;
  priority: 'critical' | 'urgent' | 'high' | 'medium' | 'low';
  planType: StudyPlanItemType;
  isFixedCommitment: boolean; // true for classes and exams
  isCompleted?: boolean;
  isOverdue?: boolean;
  reason: string; // Deterministic explanation
}

export type PlanningConflictType =
  | 'task_during_class'
  | 'overlapping_tasks'
  | 'study_during_exam'
  | 'workload_overload';

export interface PlanningConflict {
  id: string;
  type: PlanningConflictType;
  date: string;
  title: string;
  description: string;
  itemIds: string[];
  suggestedResolution: string;
}

export interface StudyPlan {
  date: string;
  capacityMinutes: number;
  plannedStudyMinutes: number;
  fixedClassesMinutes: number;
  totalAcademicMinutes: number;
  items: StudyPlanItem[];
  overflowItems: StudyPlanItem[];
  isOverloaded: boolean;
  overloadMinutes: number;
  conflicts: PlanningConflict[];
  recommendation: string;
}

export interface WeeklyStudyPlanDay {
  date: string;
  dayOfWeek: string;
  workload: DailyWorkload;
  plan: StudyPlan;
}

export interface WeeklyStudyPlan {
  startDate: string;
  endDate: string;
  days: WeeklyStudyPlanDay[];
  totalWeekMinutes: number;
  averageDailyMinutes: number;
  overloadedDaysCount: number;
  examCount: number;
  urgentTasksCount: number;
  criticalRevisionsCount: number;
  weeklySummary: string;
}

export interface UnscheduledAcademicWork {
  overdueTasks: Task[];
  urgentTasksWithoutTime: Task[];
  criticalRevisionsWithoutTask: TopicRevisionIntelligence[];
  examsWithRevisionBacklog: {
    exam: Exam;
    daysUntil: number;
    backlogTopicsCount: number;
    readinessScore?: number;
  }[];
  totalUnscheduledItems: number;
}

export interface StudyPlanningInputOptions {
  now?: Date;
  capacityMinutesOverride?: number;
  subjectsOverride?: Subject[];
  tasksOverride?: Task[];
  examsOverride?: Exam[];
  timetableSlotsOverride?: TimetableSlot[];
  topicsOverride?: Topic[];
  classNotesOverride?: ClassNote[];
  revisionRecordsOverride?: RevisionRecord[];
  semesterOverride?: Semester | null;
}

// ─── Phase 14: Persistent Versioned Study Plans ──────────────────

export type PersistentStudyPlanStatus = 'active' | 'archived' | 'superseded' | 'completed';
export type AllocationStatus = 'scheduled' | 'completed' | 'missed' | 'rescheduled';

export interface StudyPlanAllocation {
  id: string;
  planId: string;
  topicId: string;
  subjectId: string;
  allocatedDate: string; // YYYY-MM-DD
  allocatedOrder: number;
  allocatedMinutes: number;
  status: AllocationStatus;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Hydrated references
  topicName?: string;
  subjectName?: string;
}

export interface PersistentStudyPlan {
  id: string;
  userId?: string;
  examId: string;
  semesterId: string;
  subjectId?: string;
  version: number;
  dailyCapacityMinutes: number;
  targetMasteryGoal: number;
  totalPlannedMinutes: number;
  status: PersistentStudyPlanStatus;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  allocations: StudyPlanAllocation[];
}

