/**
 * KaryaDEX — Global State Store (Zustand)
 * 
 * Single source of truth for app state.
 * Structured to be easily swapped from mock data to Supabase.
 */

import { create } from 'zustand';
import type {
  User, Subject, ClassSession, Task, TaskStatus, Exam, Mark, Lab,
  AttendanceRecord, Semester, Faculty, College,
  SubjectAttendance, AttentionItem, QuickAddType,
} from '@/types';
import {
  mockUser, mockCollege, mockSemester, mockSubjects,
  mockFaculty, mockClassSessions, mockAttendanceData,
  mockTasks, mockExams, mockMarks, mockLabs,
} from '@/lib/mockData';
import {
  calculatePercentage, getAttendanceStatus,
  calculateSafeBunks, calculateRecoveryClasses,
} from '@/lib/attendance';
import { formatLocalDate, parseLocalDate } from '@/lib/timeUtils';
import type { ClassAttendanceStatus, NotificationSettings } from '@/types/academic';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/types/academic';
import { attendanceRepository } from '@/database/repositories/attendanceRepository';
import { taskRepository } from '@/database/repositories/taskRepository';
import { subjectRepository } from '@/database/repositories/subjectRepository';
import { settingsRepository } from '@/database/repositories/settingsRepository';
import type { OnboardingStep } from '@/types/onboarding';

interface AppState {
  // Auth
  isAuthenticated: boolean;
  isDemoMode: boolean;
  user: User | null;

  // College data
  college: College | null;
  semester: Semester | null;
  subjects: Subject[];
  faculty: Faculty[];
  classSessions: ClassSession[];

  // Attendance
  attendanceData: Record<string, { attended: number; total: number }>;

  // Tasks
  tasks: Task[];

  // Exams & Marks
  exams: Exam[];
  marks: Mark[];

  // Labs
  labs: Lab[];

  // UI State
  quickAddVisible: boolean;
  selectedSubjectId: string | null;
  attendanceTarget: number;
  requestedOnboardingStep: OnboardingStep | null;

  // Actions
  initDemoMode: () => void;
  logout: () => void;
  refreshFromDatabase: () => Promise<void>;
  requestOnboardingStep: (step: OnboardingStep | null) => void;

  // Attendance actions
  markAttendance: (subjectId: string, status: 'present' | 'absent') => void;
  recordAttendanceTransition: (
    subjectId: string,
    prevStatus?: ClassAttendanceStatus,
    newStatus?: ClassAttendanceStatus
  ) => void;
  getSubjectAttendance: () => SubjectAttendance[];
  getOverallAttendance: () => { attended: number; total: number; percentage: number };
  setAttendanceTarget: (target: number) => void;

  // Task actions
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  toggleTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  reopenTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;

  // Needs Attention
  getAttentionItems: () => AttentionItem[];

  // Notification Settings
  notificationSettings: NotificationSettings;
  loadNotificationSettings: () => Promise<void>;
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => Promise<void>;

  // Semester management
  switchActiveSemester: (semesterId: string) => Promise<void>;

  // UI actions
  setQuickAddVisible: (visible: boolean) => void;
  setSelectedSubjectId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  isDemoMode: false,
  user: null,
  college: null,
  semester: null,
  subjects: [],
  faculty: [],
  classSessions: [],
  attendanceData: {},
  tasks: [],
  exams: [],
  marks: [],
  labs: [],
  quickAddVisible: false,
  selectedSubjectId: null,
  attendanceTarget: 75,
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  requestedOnboardingStep: null,
  requestOnboardingStep: (step) => set({ requestedOnboardingStep: step }),

  // ─── Init Demo Mode ────────────────────────────────────────
  initDemoMode: () => {
    set({
      isAuthenticated: true,
      isDemoMode: true,
      user: mockUser,
      college: mockCollege,
      semester: mockSemester,
      subjects: mockSubjects,
      faculty: mockFaculty,
      classSessions: mockClassSessions,
      attendanceData: { ...mockAttendanceData },
      tasks: [...mockTasks],
      exams: [...mockExams],
      marks: [...mockMarks],
      labs: [...mockLabs],
      attendanceTarget: mockUser.attendanceTarget,
    });
  },

  logout: () => {
    set({
      isAuthenticated: false,
      isDemoMode: false,
      user: null,
      college: null,
      semester: null,
      subjects: [],
      faculty: [],
      classSessions: [],
      attendanceData: {},
      tasks: [],
      exams: [],
      marks: [],
      labs: [],
      requestedOnboardingStep: 'auth',
    });
  },

  refreshFromDatabase: async () => {
    const { hydrateStoresFromDatabase } = await import('@/database');
    await hydrateStoresFromDatabase();
  },

  // ─── Attendance ────────────────────────────────────────────
  markAttendance: (subjectId, status) => {
    set((state) => {
      const current = state.attendanceData[subjectId] || { attended: 0, total: 0 };
      const newAttended = status === 'present' ? current.attended + 1 : current.attended;
      const newTotal = current.total + 1;

      // Asynchronously persist aggregate to SQLite
      attendanceRepository.setAggregate(subjectId, newAttended, newTotal).catch(err => {
        console.warn('[useAppStore] Failed to persist attendance aggregate:', err);
      });

      return {
        attendanceData: {
          ...state.attendanceData,
          [subjectId]: {
            attended: newAttended,
            total: newTotal,
          },
        },
      };
    });
  },

  /**
   * Transition-aware attendance updater for individual class occurrences.
   * Accurately updates counters without double-counting on multiple saves or edits.
   * Handles present, late (attended), absent (unattended), cancelled, and not_recorded.
   */
  recordAttendanceTransition: (subjectId, prevStatus, newStatus) => {
    // If status hasn't changed, zero delta — no double-counting
    if (prevStatus === newStatus) return;

    set((state) => {
      const current = state.attendanceData[subjectId] || { attended: 0, total: 0 };

      const getContribution = (status?: ClassAttendanceStatus): { attended: number; total: number } => {
        if (status === 'present' || status === 'late') return { attended: 1, total: 1 };
        if (status === 'absent') return { attended: 0, total: 1 };
        // 'cancelled', 'not_recorded', undefined
        return { attended: 0, total: 0 };
      };

      const prevContrib = getContribution(prevStatus);
      const newContrib = getContribution(newStatus);

      const deltaAttended = newContrib.attended - prevContrib.attended;
      const deltaTotal = newContrib.total - prevContrib.total;

      const newAttended = Math.max(0, current.attended + deltaAttended);
      const newTotal = Math.max(newAttended, current.total + deltaTotal);

      // Asynchronously persist aggregate to SQLite
      attendanceRepository.setAggregate(subjectId, newAttended, newTotal).catch(err => {
        console.warn('[useAppStore] Failed to persist attendance transition aggregate:', err);
      });

      return {
        attendanceData: {
          ...state.attendanceData,
          [subjectId]: {
            attended: newAttended,
            total: newTotal,
          },
        },
      };
    });
  },

  getSubjectAttendance: () => {
    const { subjects, attendanceData, attendanceTarget } = get();
    return subjects.map((subject) => {
      const data = attendanceData[subject.id] || { attended: 0, total: 0 };
      const percentage = calculatePercentage(data.attended, data.total);
      const status = getAttendanceStatus(percentage, attendanceTarget);
      const safeBunks = calculateSafeBunks(data.attended, data.total, attendanceTarget);
      const classesNeededToRecover = calculateRecoveryClasses(data.attended, data.total, attendanceTarget);

      return {
        subjectId: subject.id,
        subject,
        attended: data.attended,
        total: data.total,
        percentage,
        status,
        safeBunks,
        classesNeededToRecover,
      };
    });
  },

  getOverallAttendance: () => {
    const { attendanceData } = get();
    let totalAttended = 0;
    let totalClasses = 0;
    Object.values(attendanceData).forEach(({ attended, total }) => {
      totalAttended += attended;
      totalClasses += total;
    });
    return {
      attended: totalAttended,
      total: totalClasses,
      percentage: calculatePercentage(totalAttended, totalClasses),
    };
  },

  setAttendanceTarget: (target) => {
    set({ attendanceTarget: target });
    subjectRepository.getStudent().then(student => {
      if (student) {
        return subjectRepository.saveStudent({ ...student, attendanceTarget: target });
      }
    }).catch(err => console.warn('[useAppStore] Failed to persist attendance target:', err));
  },

  // ─── Tasks ─────────────────────────────────────────────────
  addTask: (taskData) => {
    const now = formatLocalDate(new Date());
    const isCompleted = Boolean(taskData.isCompleted || taskData.status === 'completed');
    const taskStatus: TaskStatus = taskData.status || (isCompleted ? 'completed' : 'planned');

    const newTask: Task = {
      ...taskData,
      id: (taskData as any).id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: taskStatus,
      isCompleted,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ tasks: [newTask, ...state.tasks] }));
    taskRepository.createTask(newTask).catch(err => {
      console.warn('[useAppStore] Failed to persist new task:', err);
    });
  },

  updateTask: (id, updates) => {
    const now = formatLocalDate(new Date());
    set((state) => {
      const updatedTasks = state.tasks.map((t) => {
        if (t.id !== id) return t;
        const merged = { ...t, ...updates, updatedAt: now };
        if (updates.isCompleted !== undefined && !updates.status) {
          merged.status = updates.isCompleted ? 'completed' : 'planned';
        } else if (updates.status && updates.isCompleted === undefined) {
          merged.isCompleted = updates.status === 'completed';
        }
        return merged;
      });
      taskRepository.updateTask(id, updates).catch(err => {
        console.warn('[useAppStore] Failed to update task in SQLite:', err);
      });
      return { tasks: updatedTasks };
    });
  },

  completeTask: (taskId) => {
    const now = formatLocalDate(new Date());
    set((state) => {
      const target = state.tasks.find(t => t.id === taskId);
      const updatedTasks = state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, isCompleted: true, status: 'completed' as const, completedAt: now, updatedAt: now }
          : t
      );
      taskRepository.completeTask(taskId).then(async () => {
        if (target?.isRecurring && target?.recurrenceRule) {
          const fresh = await taskRepository.getTasks();
          set({ tasks: fresh });
        }
      }).catch(err => {
        console.warn('[useAppStore] Failed to complete task in SQLite:', err);
      });
      return { tasks: updatedTasks };
    });
  },

  reopenTask: (taskId) => {
    const now = formatLocalDate(new Date());
    set((state) => {
      const updatedTasks = state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, isCompleted: false, status: 'planned' as const, completedAt: undefined, updatedAt: now }
          : t
      );
      taskRepository.reopenTask(taskId).catch(err => {
        console.warn('[useAppStore] Failed to reopen task in SQLite:', err);
      });
      return { tasks: updatedTasks };
    });
  },

  toggleTask: (taskId) => {
    const current = get().tasks.find((t) => t.id === taskId);
    if (!current) return;
    if (current.isCompleted || current.status === 'completed') {
      get().reopenTask(taskId);
    } else {
      get().completeTask(taskId);
    }
  },

  deleteTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    }));
    taskRepository.deleteTask(taskId).catch(err => {
      console.warn('[useAppStore] Failed to delete task in SQLite:', err);
    });
  },

  // ─── Attention Items ───────────────────────────────────────
  getAttentionItems: () => {
    const { subjects, attendanceData, attendanceTarget, tasks, exams } = get();
    const items: AttentionItem[] = [];
    const today = formatLocalDate(new Date());

    // Attendance warnings
    subjects.forEach((subject) => {
      const data = attendanceData[subject.id];
      if (!data) return;
      const percentage = calculatePercentage(data.attended, data.total);
      if (percentage < attendanceTarget) {
        const recovery = calculateRecoveryClasses(data.attended, data.total, attendanceTarget);
        items.push({
          id: `attn-att-${subject.id}`,
          type: 'attendance_warning',
          title: `${subject.shortName} attendance is low`,
          subtitle: `${percentage.toFixed(1)}% — need ${recovery} classes to recover`,
          severity: percentage < attendanceTarget - 5 ? 'danger' : 'warning',
          subjectId: subject.id,
        });
      }
    });

    // Overdue tasks
    tasks.filter(t => !t.isCompleted && t.dueDate && t.dueDate < today).forEach((task) => {
      items.push({
        id: `attn-overdue-${task.id}`,
        type: 'overdue_task',
        title: task.title,
        subtitle: 'Overdue',
        severity: 'danger',
        subjectId: task.subjectId,
      });
    });

    // Due soon (today or tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);

    tasks.filter(t => !t.isCompleted && t.dueDate && (t.dueDate === today || t.dueDate === tomorrowStr)).forEach((task) => {
      items.push({
        id: `attn-due-${task.id}`,
        type: 'due_soon',
        title: task.title,
        subtitle: task.dueDate === today ? 'Due today' : 'Due tomorrow',
        severity: 'warning',
        subjectId: task.subjectId,
      });
    });

    // Upcoming exams (within 7 days)
    exams.forEach((exam) => {
      const examDate = parseLocalDate(exam.date);
      const todayDate = parseLocalDate(today);
      const daysUntil = Math.ceil(
        (examDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil >= 0 && daysUntil <= 7) {
        const subject = subjects.find(s => s.id === exam.subjectId);
        items.push({
          id: `attn-exam-${exam.id}`,
          type: 'upcoming_exam',
          title: `${subject?.shortName || ''} ${exam.name}`,
          subtitle: daysUntil === 0 ? 'Today!' : `In ${daysUntil} days`,
          severity: daysUntil <= 2 ? 'danger' : 'warning',
          subjectId: exam.subjectId,
        });
      }
    });

    // Sort by severity
    const severityOrder = { danger: 0, warning: 1, info: 2 };
    return items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 4);
  },

  // ─── Notification Settings ─────────────────────────────────
  loadNotificationSettings: async () => {
    const settings = await settingsRepository.getNotificationSettings();
    set({ notificationSettings: settings });
  },
  updateNotificationSettings: async (updates) => {
    const current = get().notificationSettings;
    const merged: NotificationSettings = {
      ...current,
      ...updates,
      classReminders: { ...current.classReminders, ...(updates.classReminders || {}) },
      taskReminders: { ...current.taskReminders, ...(updates.taskReminders || {}) },
      examReminders: { ...current.examReminders, ...(updates.examReminders || {}) },
      revisionReminders: { ...current.revisionReminders, ...(updates.revisionReminders || {}) },
      attendanceAlerts: { ...current.attendanceAlerts, ...(updates.attendanceAlerts || {}) },
      postClassJournal: { ...current.postClassJournal, ...(updates.postClassJournal || {}) },
      quietHours: { ...current.quietHours, ...(updates.quietHours || {}) },
    };
    set({ notificationSettings: merged });
    await settingsRepository.setNotificationSettings(merged);
  },

  // ─── Semester Management ────────────────────────────────────
  switchActiveSemester: async (semesterId) => {
    await subjectRepository.setCurrentSemester(semesterId);
    const semester = await subjectRepository.getSemesterById(semesterId);
    const subjects = await subjectRepository.getSubjectsForSemester(semesterId);
    const attendanceData = await import('@/database/repositories/attendanceRepository').then(m => m.attendanceRepository.getAllAggregates());
    const { deriveClassSessionsFromSlots } = await import('@/database/DatabaseProvider');
    const { timetableRepository } = await import('@/database/repositories/timetableRepository');
    const { useAcademicStore } = await import('@/store/useAcademicStore');
    let timetableSlots = await timetableRepository.getTimetableSlots(true).catch(() => []);
    if (timetableSlots.length === 0) {
      timetableSlots = useAcademicStore.getState().timetableSlots;
    } else {
      useAcademicStore.setState({ timetableSlots });
    }
    const derivedSessions = deriveClassSessionsFromSlots(
      timetableSlots,
      new Set(subjects.map(s => s.id))
    );

    set({
      semester,
      subjects,
      attendanceData,
      classSessions: derivedSessions,
    });
  },

  // ─── UI ────────────────────────────────────────────────────
  setQuickAddVisible: (visible) => set({ quickAddVisible: visible }),
  setSelectedSubjectId: (id) => set({ selectedSubjectId: id }),
}));
