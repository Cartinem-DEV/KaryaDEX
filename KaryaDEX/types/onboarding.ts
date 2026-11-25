/**
 * KaryaDEX — Onboarding Domain Types & Interfaces
 */

export type OnboardingStep =
  | 'welcome'
  | 'showcase_attendance'
  | 'showcase_ai'
  | 'auth'
  | 'profile'
  | 'college'
  | 'academic'
  | 'subjects'
  | 'syllabus'
  | 'timetable'
  | 'attendance'
  | 'storage'
  | 'notifications'
  | 'completion';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'showcase_attendance',
  'showcase_ai',
  'auth',
  'profile',
  'college',
  'academic',
  'subjects',
  'syllabus',
  'timetable',
  'attendance',
  'storage',
  'notifications',
  'completion',
];

export const ONBOARDING_STEP_TITLES: Record<OnboardingStep, string> = {
  welcome: 'Welcome',
  showcase_attendance: 'Attendance Mastery',
  showcase_ai: 'Dual AI Engine',
  auth: 'Account Setup',
  profile: 'Profile',
  college: 'Institution',
  academic: 'Academic Structure',
  subjects: 'Subjects',
  syllabus: 'Syllabus',
  timetable: 'Timetable',
  attendance: 'Attendance Policy',
  storage: 'Storage Strategy',
  notifications: 'Notification Engine',
  completion: 'Ready to Launch',
};

export interface SubjectDraft {
  id: string;
  name: string;
  shortName: string;
  code: string;
  color: string;
  credits: number;
  facultyName?: string;
  room?: string;
  subjectType?: 'lecture' | 'lab' | 'tutorial' | 'mixed';
  targetAttendance?: number;
}

export interface SyllabusUnitDraft {
  id: string;
  subjectId: string;
  name: string;
  order: number;
  topics: Array<{
    id: string;
    name: string;
    order: number;
  }>;
}

export interface TimetableSlotDraft {
  id: string;
  subjectId: string;
  dayOfWeek: string;
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
  room?: string;
  type?: 'lecture' | 'lab' | 'tutorial' | 'seminar';
  teacher?: string;
}

export interface TimetableConflict {
  existingSlotId: string;
  existingSubjectName: string;
  existingTime: string;
  newSubjectName: string;
  newTime: string;
  dayOfWeek: string;
  message: string;
}

export interface OnboardingDraftData {
  profile?: {
    name: string;
    email?: string;
    avatarUrl?: string;
    academicYear?: string;
    goals?: string[];
  };
  goals?: string[];
  college?: {
    name: string;
    shortName?: string;
    universityBoard?: string;
    campus?: string;
    city?: string;
    state?: string;
    category?: string;
  };
  academic?: {
    program: string;
    branch: string;
    year: number;
    semesterNumber: number;
    semesterName: string;
    section?: string;
    academicYear?: string;
    startDate?: string;
    endDate?: string;
    attendanceTarget?: number;
    attendancePolicy?: string;
  };
  subjects?: SubjectDraft[];
  syllabusUnits?: SyllabusUnitDraft[];
  timetableSlots?: TimetableSlotDraft[];
  attendance?: {
    target: number;
    startingTotals?: Record<string, { attended: number; total: number }>;
  };
  storage?: {
    storageType: 'app_storage' | 'custom_folder';
    folderUri?: string;
    folderName?: string;
  };
  notifications?: {
    enabled: boolean;
    classReminders10: boolean;
    classReminders30: boolean;
    taskDueToday: boolean;
    taskOverdue: boolean;
    examReminders1Day: boolean;
    examReminders3Days: boolean;
    revisionReminders: boolean;
    attendanceAlerts: boolean;
    postClassJournal: boolean;
  };
}

export interface OnboardingProgress {
  id: string;
  status: OnboardingStatus;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  draftData: OnboardingDraftData;
  updatedAt: string;
}

export interface StartupState {
  status: OnboardingStatus;
  isDemo: boolean;
  canResume: boolean;
  lastStep: OnboardingStep;
  studentName?: string;
}
