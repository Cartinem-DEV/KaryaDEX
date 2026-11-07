/**
 * BunkMatKar — Local Notification Engine (Phase 4)
 *
 * Implements:
 * - Local-only scheduled notifications via NotificationPlatformAdapter
 * - Category-based notification configuration & quiet-hours management
 * - Duplicate prevention via SQLite notification_records
 * - Automatic rescheduling on schedule, task, or exam change
 * - Automatic cancellation on task completion or deletion
 * - Startup reconciliation & stale notification cleanup
 * - Structured deep-link payload routing
 */

import { Platform } from 'react-native';
import { settingsRepository } from '@/database/repositories/settingsRepository';
import { notificationRecordRepository } from '@/database/repositories/notificationRecordRepository';
import {
  createDefaultNotificationAdapter,
  NotificationPlatformAdapter,
  NotificationRequest,
} from './notificationAdapter';
import { formatLocalDate, timeToMinutes, parseLocalDate } from '@/lib/timeUtils';
import { isTaskOverdue } from '@/lib/taskUtils';
import type { Task, Subject, Exam } from '@/types';
import type {
  ClassOccurrence,
  NotificationCategory,
  NotificationPayload,
  NotificationSettings,
} from '@/types/academic';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/types/academic';
import { useAcademicStore } from '@/store/useAcademicStore';
import { useAppStore } from '@/store/useAppStore';

export class NotificationService {
  private adapter: NotificationPlatformAdapter;
  private isInitialized = false;
  private cachedSettings: NotificationSettings | null = null;
  private navigationHandler: ((payload: NotificationPayload) => void) | null = null;

  constructor(adapter?: NotificationPlatformAdapter) {
    this.adapter = adapter || createDefaultNotificationAdapter();
  }

  /**
   * Allows injecting a custom adapter (for unit testing).
   */
  setAdapter(adapter: NotificationPlatformAdapter): void {
    this.adapter = adapter;
  }

  getAdapter(): NotificationPlatformAdapter {
    return this.adapter;
  }

  /**
   * Initializes notification channels and listeners.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Load settings from persistent SQLite store
    this.cachedSettings = await settingsRepository.getNotificationSettings();

    // Configure Android channels
    if (Platform.OS === 'android') {
      await this.adapter.setNotificationChannelAsync('classes', {
        name: 'Class Reminders',
        importance: 4, // High
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C3AED',
      });
      await this.adapter.setNotificationChannelAsync('tasks', {
        name: 'Task Reminders',
        importance: 3, // Default
        lightColor: '#7C3AED',
      });
      await this.adapter.setNotificationChannelAsync('exams', {
        name: 'Exam Reminders',
        importance: 4, // High
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#EF4444',
      });
      await this.adapter.setNotificationChannelAsync('revision', {
        name: 'Revision Reminders',
        importance: 3, // Default
        lightColor: '#3B82F6',
      });
      await this.adapter.setNotificationChannelAsync('attendance', {
        name: 'Attendance Alerts',
        importance: 4, // High
        lightColor: '#EF4444',
      });
      await this.adapter.setNotificationChannelAsync('journal', {
        name: 'Post-Class Journal',
        importance: 3, // Default
        lightColor: '#10B981',
      });
    }

    // Attach response listener for deep linking
    this.adapter.addNotificationResponseReceivedListener(response => {
      const data = response?.notification?.request?.content?.data;
      if (data && this.navigationHandler) {
        this.navigationHandler(data as NotificationPayload);
      }
    });

    this.isInitialized = true;
  }

  async requestPermissions(): Promise<boolean> {
    const res = await this.adapter.requestPermissionsAsync();
    return res.status === 'granted';
  }

  setNavigationHandler(handler: (payload: NotificationPayload) => void): void {
    this.navigationHandler = handler;
  }

  // ─── Settings ──────────────────────────────────────────────────

  async getSettings(): Promise<NotificationSettings> {
    if (!this.cachedSettings) {
      this.cachedSettings = await settingsRepository.getNotificationSettings();
    }
    return this.cachedSettings;
  }

  async updateSettings(updates: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const current = await this.getSettings();
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

    await settingsRepository.setNotificationSettings(merged);
    this.cachedSettings = merged;

    // If master switch turned off, cancel all future notifications
    if (!merged.masterEnabled) {
      await this.cancelAllScheduledNotifications();
    } else {
      // Cancel disabled categories
      if (!merged.classReminders.enabled) await this.cancelCategoryNotifications('class_reminder');
      if (!merged.taskReminders.enabled) await this.cancelCategoryNotifications('task_reminder');
      if (!merged.examReminders.enabled) await this.cancelCategoryNotifications('exam_reminder');
      if (!merged.revisionReminders.enabled) await this.cancelCategoryNotifications('revision_reminder');
      if (!merged.attendanceAlerts.enabled) await this.cancelCategoryNotifications('attendance_alert');
      if (!merged.postClassJournal.enabled) await this.cancelCategoryNotifications('post_class_journal');
    }

    return merged;
  }

  // ─── Quiet Hours Check ─────────────────────────────────────────

  isQuietHour(date: Date, isCritical = false): boolean {
    const settings = this.cachedSettings || DEFAULT_NOTIFICATION_SETTINGS;
    if (!settings.quietHours.enabled) return false;
    if (isCritical && settings.quietHours.suppressNonCritical) return false;

    const hour = date.getHours();
    const min = date.getMinutes();
    const timeMinutes = hour * 60 + min;

    const startMinutes = settings.quietHours.startHour * 60 + settings.quietHours.startMinute;
    const endMinutes = settings.quietHours.endHour * 60 + settings.quietHours.endMinute;

    if (startMinutes > endMinutes) {
      // Overnight (e.g. 23:00 to 07:00)
      return timeMinutes >= startMinutes || timeMinutes < endMinutes;
    } else {
      // Same day (e.g. 13:00 to 15:00)
      return timeMinutes >= startMinutes && timeMinutes < endMinutes;
    }
  }

  // ─── Class Reminders ───────────────────────────────────────────

  async scheduleClassReminder(
    session: ClassOccurrence,
    minutesBefore: number,
    now: Date = new Date(),
    subjectName?: string
  ): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.masterEnabled || !settings.classReminders.enabled) return null;
    if (!session.startTime) return null;

    // Compute trigger time
    const [y, m, d] = session.date.split('-').map(Number);
    const [hours, minutes] = session.startTime.split(':').map(Number);
    const triggerDate = new Date(y, m - 1, d, hours, minutes, 0);
    triggerDate.setMinutes(triggerDate.getMinutes() - minutesBefore);

    if (triggerDate.getTime() <= now.getTime()) {
      return null; // Already passed
    }

    if (this.isQuietHour(triggerDate, false)) {
      return null; // Suppressed by quiet hours
    }

    const scheduledForISO = triggerDate.toISOString();
    const existing = await notificationRecordRepository.findExisting(
      'class_reminder',
      session.slotId,
      scheduledForISO
    );
    if (existing) {
      return existing.id; // Prevent duplicate
    }

    const title = settings.privacyMode ? 'Upcoming Class' : 'Next Class';
    const name = subjectName || 'Class';
    const body = settings.privacyMode
      ? `You have a class starting in ${minutesBefore} min.`
      : `${name} starts in ${minutesBefore} min${session.room ? ` · Room ${session.room}` : ''}`;
    const payload: NotificationPayload = {
      type: 'class_reminder',
      entityId: session.slotId,
      subjectId: session.subjectId,
      classSessionId: session.slotId,
      deepLinkTarget: `/schedule?session=${session.slotId}`,
    };

    const notifId = await this.adapter.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: payload,
        sound: true,
      },
      trigger: {
        date: triggerDate,
        channelId: 'classes',
      },
    });

    const record = await notificationRecordRepository.create({
      id: `notif-class-${session.slotId}-${minutesBefore}m-${session.date}`,
      type: 'class_reminder',
      entityId: session.slotId,
      scheduledFor: scheduledForISO,
      expoNotificationId: notifId,
      title,
      body,
      payload,
    });

    return record.id;
  }

  // ─── Task Reminders ────────────────────────────────────────────

  async scheduleTaskReminder(
    task: Task,
    now: Date = new Date(),
    subjectName?: string
  ): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.masterEnabled || !settings.taskReminders.enabled) return null;

    // Cancel pending reminders if completed
    if (task.isCompleted || task.status === 'completed') {
      await this.cancelNotificationsForEntity(task.id);
      return null;
    }

    if (!task.dueDate) return null;

    const [y, m, d] = task.dueDate.split('-').map(Number);
    let triggerDate: Date;

    if (task.dueTime) {
      const [hours, minutes] = task.dueTime.split(':').map(Number);
      triggerDate = new Date(y, m - 1, d, hours || 0, minutes || 0, 0);
      // Remind 1 hour before due time if possible
      triggerDate.setHours(triggerDate.getHours() - 1);
    } else {
      // Default to 09:00 AM on due date
      triggerDate = new Date(y, m - 1, d, 9, 0, 0);
    }

    if (triggerDate.getTime() <= now.getTime()) {
      return null; // Passed
    }

    if (this.isQuietHour(triggerDate, task.priority === 'urgent')) {
      return null;
    }

    const scheduledForISO = triggerDate.toISOString();
    const existing = await notificationRecordRepository.findExisting('task_reminder', task.id, scheduledForISO);
    if (existing) return existing.id;

    const isToday = task.dueDate === formatLocalDate(now);
    const title = settings.privacyMode
      ? 'Task Due Soon'
      : task.priority === 'urgent'
        ? 'Urgent Task Due'
        : isToday
          ? 'Task Due Today'
          : 'Task Due Soon';
    const body = settings.privacyMode
      ? 'You have an academic task due soon.'
      : `${task.title}${task.dueTime ? ` due at ${task.dueTime}` : ' is due today'}`;
    const payload: NotificationPayload = {
      type: 'task_reminder',
      entityId: task.id,
      subjectId: task.subjectId,
      taskId: task.id,
      deepLinkTarget: '/tasks',
      isCritical: task.priority === 'urgent',
    };

    const notifId = await this.adapter.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: payload,
        sound: true,
      },
      trigger: {
        date: triggerDate,
        channelId: 'tasks',
      },
    });

    const record = await notificationRecordRepository.create({
      id: `notif-task-${task.id}-${task.dueDate}`,
      type: 'task_reminder',
      entityId: task.id,
      scheduledFor: scheduledForISO,
      expoNotificationId: notifId,
      title,
      body,
      payload,
    });

    return record.id;
  }

  // ─── Exam Reminders ────────────────────────────────────────────

  async scheduleExamReminder(
    exam: Exam,
    daysBefore: number,
    now: Date = new Date(),
    subjectName?: string,
    unrevisedTopicsCountOverride?: number
  ): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.masterEnabled || !settings.examReminders.enabled) return null;
    if (!exam.date) return null;

    const [y, m, d] = exam.date.split('-').map(Number);
    const triggerDate = new Date(y, m - 1, d, 9, 0, 0);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);

    if (triggerDate.getTime() <= now.getTime()) {
      return null;
    }

    if (this.isQuietHour(triggerDate, true)) {
      return null;
    }

    const scheduledForISO = triggerDate.toISOString();
    const existing = await notificationRecordRepository.findExisting(
      'exam_reminder',
      exam.id,
      scheduledForISO
    );
    if (existing) return existing.id;

    // Dynamically query unrevised topic count
    const academicState = useAcademicStore.getState();
    const examTopics = academicState.examTopics.filter(et => et.examId === exam.id);
    const unrevisedCount = unrevisedTopicsCountOverride !== undefined
      ? unrevisedTopicsCountOverride
      : examTopics.filter(et => {
          const topic = academicState.topics.find(t => t.id === et.topicId);
          return topic && topic.revisionStatus !== 'revised';
        }).length;

    const title = settings.privacyMode
      ? 'Exam Reminder'
      : daysBefore === 0
        ? `Exam Today: ${exam.name}`
        : `${exam.name} in ${daysBefore} day${daysBefore > 1 ? 's' : ''}`;
    let body = settings.privacyMode
      ? 'You have an exam scheduled.'
      : `${exam.name} on ${exam.date}${exam.time ? ` at ${exam.time}` : ''}`;
    if (!settings.privacyMode && unrevisedCount > 0) {
      body += ` · ${unrevisedCount} topic${unrevisedCount > 1 ? 's' : ''} remain unrevised`;
    }

    const payload: NotificationPayload = {
      type: 'exam_reminder',
      entityId: exam.id,
      subjectId: exam.subjectId,
      examId: exam.id,
      deepLinkTarget: `/subject/${exam.subjectId}`,
      isCritical: true,
    };

    const notifId = await this.adapter.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: payload,
        sound: true,
      },
      trigger: {
        date: triggerDate,
        channelId: 'exams',
      },
    });

    const record = await notificationRecordRepository.create({
      id: `notif-exam-${exam.id}-${daysBefore}d`,
      type: 'exam_reminder',
      entityId: exam.id,
      scheduledFor: scheduledForISO,
      expoNotificationId: notifId,
      title,
      body,
      payload,
    });

    return record.id;
  }

  // ─── Revision Reminders (Throttled) ───────────────────────────

  async scheduleRevisionReminder(
    subject: Subject,
    topicCount: number,
    now: Date = new Date()
  ): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.masterEnabled || !settings.revisionReminders.enabled) return null;

    // Throttling: Check if a revision reminder was already scheduled for this subject today
    const todayStr = formatLocalDate(now);
    const existingSubjectReminders = await notificationRecordRepository.getByEntityId(subject.id);
    const existingToday = existingSubjectReminders.find(
      r => r.type === 'revision_reminder' && r.scheduledFor.startsWith(todayStr)
    );
    if (existingToday) {
      return existingToday.id; // Cooldown enforced: return existing scheduled ID
    }

    // Schedule for 18:00 (evening revision)
    const [y, m, d] = todayStr.split('-').map(Number);
    const triggerDate = new Date(y, m - 1, d, 18, 0, 0);
    if (triggerDate.getTime() <= now.getTime()) {
      return null;
    }

    const scheduledForISO = triggerDate.toISOString();
    const title = settings.privacyMode ? 'Revision Reminder' : 'Revision Reminder';
    const body = settings.privacyMode
      ? 'You have topics scheduled for revision.'
      : `${topicCount} ${subject.shortName} topic${topicCount > 1 ? 's' : ''} still need revision. Take 15 mins to review.`;
    const payload: NotificationPayload = {
      type: 'revision_reminder',
      entityId: subject.id,
      subjectId: subject.id,
      deepLinkTarget: `/subject/${subject.id}`,
    };

    const notifId = await this.adapter.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: payload,
        sound: true,
      },
      trigger: {
        date: triggerDate,
        channelId: 'revision',
      },
    });

    const record = await notificationRecordRepository.create({
      id: `notif-rev-${subject.id}-${todayStr}`,
      type: 'revision_reminder',
      entityId: subject.id,
      scheduledFor: scheduledForISO,
      expoNotificationId: notifId,
      title,
      body,
      payload,
    });

    return record.id;
  }

  // ─── Attendance Alert ──────────────────────────────────────────

  async scheduleAttendanceAlert(
    subject: Subject,
    percentage: number,
    target: number,
    now: Date = new Date()
  ): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.masterEnabled || !settings.attendanceAlerts.enabled) return null;

    // Only alert if below target or entered danger zone
    if (percentage >= target) {
      return null;
    }

    const todayStr = formatLocalDate(now);
    const triggerDate = new Date(now.getTime() + 1000); // 1 sec delay or immediate
    const scheduledForISO = triggerDate.toISOString();

    // Prevent duplicate alert on same date
    const existing = await notificationRecordRepository.getByEntityId(subject.id);
    if (existing.some(r => r.type === 'attendance_alert' && r.scheduledFor.startsWith(todayStr))) {
      return null;
    }

    const title = settings.privacyMode ? 'Attendance Notice' : 'Attendance Alert';
    const body = settings.privacyMode
      ? 'An attendance target threshold alert has been recorded.'
      : `${subject.shortName} is at ${percentage.toFixed(0)}%. You are below your ${target}% target.`;
    const payload: NotificationPayload = {
      type: 'attendance_alert',
      entityId: subject.id,
      subjectId: subject.id,
      deepLinkTarget: `/subject/${subject.id}`,
      isCritical: true,
    };

    const notifId = await this.adapter.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: payload,
        sound: true,
      },
      trigger: {
        date: triggerDate,
        channelId: 'attendance',
      },
    });

    const record = await notificationRecordRepository.create({
      id: `notif-att-${subject.id}-${todayStr}`,
      type: 'attendance_alert',
      entityId: subject.id,
      scheduledFor: scheduledForISO,
      expoNotificationId: notifId,
      title,
      body,
      payload,
    });

    return record.id;
  }

  // ─── High Pressure Attendance Alert (Phase 8) ──────────────────

  async scheduleHighPressureAttendanceAlert(
    subject: Subject,
    snapshot: { pressure: string; recommendation: string },
    now: Date = new Date()
  ): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.masterEnabled || !settings.attendanceAlerts.enabled) return null;
    if (snapshot.pressure !== 'high' && snapshot.pressure !== 'critical') return null;

    const todayStr = formatLocalDate(now);
    const triggerDate = new Date(now.getTime() + 1000);
    const scheduledForISO = triggerDate.toISOString();

    const existing = await notificationRecordRepository.getByEntityId(subject.id);
    if (existing.some(r => r.type === 'attendance_alert' && r.scheduledFor.startsWith(todayStr))) {
      return null;
    }

    const title = snapshot.pressure === 'critical' ? 'Critical Attendance Warning' : 'Attendance Pressure Alert';
    const body = `${subject.shortName}: ${snapshot.recommendation}`;
    const payload: NotificationPayload = {
      type: 'attendance_alert',
      entityId: subject.id,
      subjectId: subject.id,
      deepLinkTarget: `/subject/${subject.id}`,
      isCritical: snapshot.pressure === 'critical',
    };

    const notifId = await this.adapter.scheduleNotificationAsync({
      content: { title, body, data: payload, sound: true },
      trigger: { date: triggerDate, channelId: 'attendance' },
    });

    const record = await notificationRecordRepository.create({
      id: `notif-att-pressure-${subject.id}-${todayStr}`,
      type: 'attendance_alert',
      entityId: subject.id,
      scheduledFor: scheduledForISO,
      expoNotificationId: notifId,
      title,
      body,
      payload,
    });

    return record.id;
  }

  // ─── Post-Class Journal ────────────────────────────────────────

  async schedulePostClassJournalReminder(
    occurrence: ClassOccurrence,
    now: Date = new Date(),
    subjectName?: string
  ): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.masterEnabled || !settings.postClassJournal.enabled) return null;
    if (occurrence.attendanceStatus === 'cancelled') return null;
    if (!occurrence.endTime) return null;

    const [y, m, d] = occurrence.date.split('-').map(Number);
    const [hours, minutes] = occurrence.endTime.split(':').map(Number);
    const triggerDate = new Date(y, m - 1, d, hours, minutes, 0);
    triggerDate.setMinutes(triggerDate.getMinutes() + settings.postClassJournal.delayMinutesAfterEnd);

    if (triggerDate.getTime() <= now.getTime()) {
      return null;
    }

    if (this.isQuietHour(triggerDate, false)) {
      return null;
    }

    const scheduledForISO = triggerDate.toISOString();
    const existing = await notificationRecordRepository.findExisting(
      'post_class_journal',
      occurrence.slotId,
      scheduledForISO
    );
    if (existing) return existing.id;

    const name = subjectName || 'Class';
    const title = `Record Today's ${name} Class`;
    const body = "Add the topics you covered while they're still fresh.";
    const payload: NotificationPayload = {
      type: 'post_class_journal',
      entityId: occurrence.slotId,
      subjectId: occurrence.subjectId,
      classSessionId: occurrence.slotId,
      deepLinkTarget: `/schedule?session=${occurrence.slotId}`,
    };

    const notifId = await this.adapter.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: payload,
        sound: true,
      },
      trigger: {
        date: triggerDate,
        channelId: 'journal',
      },
    });

    const record = await notificationRecordRepository.create({
      id: `notif-journal-${occurrence.slotId}-${occurrence.date}`,
      type: 'post_class_journal',
      entityId: occurrence.slotId,
      scheduledFor: scheduledForISO,
      expoNotificationId: notifId,
      title,
      body,
      payload,
    });

    return record.id;
  }

  // ─── Cancellation & Cleanup ────────────────────────────────────

  async cancelNotificationsForEntity(entityId: string): Promise<void> {
    const records = await notificationRecordRepository.getByEntityId(entityId);
    for (const r of records) {
      if (r.expoNotificationId) {
        await this.adapter.cancelScheduledNotificationAsync(r.expoNotificationId);
      }
    }
    await notificationRecordRepository.deleteByEntityId(entityId);
  }

  async cancelCategoryNotifications(type: NotificationCategory): Promise<void> {
    const records = await notificationRecordRepository.getByType(type);
    for (const r of records) {
      if (r.expoNotificationId) {
        await this.adapter.cancelScheduledNotificationAsync(r.expoNotificationId);
      }
    }
    await notificationRecordRepository.deleteByType(type);
  }

  async cancelAllScheduledNotifications(): Promise<void> {
    await this.adapter.cancelAllScheduledNotificationsAsync();
    await notificationRecordRepository.clearAll();
  }

  // ─── App Startup Reconciliation ───────────────────────────────

  async reconcileNotifications(now: Date = new Date()): Promise<{
    cleanedStaleCount: number;
    scheduledCount: number;
  }> {
    const settings = await this.getSettings();
    if (!settings.masterEnabled) {
      return { cleanedStaleCount: 0, scheduledCount: 0 };
    }

    // 1. Clean up stale/passed notification records
    const nowISO = now.toISOString();
    await notificationRecordRepository.deletePassedRecords(nowISO);

    let scheduledCount = 0;
    const academicState = useAcademicStore.getState();
    const appState = useAppStore.getState();

    // 2. Classes for today and tomorrow
    const todayStr = formatLocalDate(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);

    const targetDates = [todayStr, tomorrowStr];
    if (settings.classReminders.enabled) {
      for (const date of targetDates) {
        const classes = academicState.getClassOccurrencesForDate(date);
        for (const c of classes) {
          const sub = appState.subjects.find(s => s.id === c.subjectId);
          for (const mins of settings.classReminders.minutesBefore) {
            const res = await this.scheduleClassReminder(c, mins, now, sub?.shortName || sub?.name);
            if (res) scheduledCount++;
          }
        }
      }
    }

    // 3. Post-class journal for today's ended classes
    if (settings.postClassJournal.enabled) {
      const todayClasses = academicState.getClassOccurrencesForDate(todayStr);
      for (const c of todayClasses) {
        const sub = appState.subjects.find(s => s.id === c.subjectId);
        const res = await this.schedulePostClassJournalReminder(c, now, sub?.shortName || sub?.name);
        if (res) scheduledCount++;
      }
    }

    // 4. Tasks due today or soon
    if (settings.taskReminders.enabled) {
      const pendingTasks = appState.tasks.filter(t => !t.isCompleted && t.status !== 'completed');
      for (const t of pendingTasks) {
        const res = await this.scheduleTaskReminder(t, now);
        if (res) scheduledCount++;
      }
    }

    // 5. Exams
    if (settings.examReminders.enabled) {
      for (const exam of appState.exams) {
        for (const days of settings.examReminders.daysBefore) {
          const res = await this.scheduleExamReminder(exam, days, now);
          if (res) scheduledCount++;
        }
      }
    }

    return { cleanedStaleCount: 0, scheduledCount };
  }

  // ─── Phase 9: Study Planning & Calendar Reminders ───────────────

  async scheduleStudyBlockReminder(
    item: { id: string; title: string; date: string; suggestedStartTime?: string; durationMinutes?: number },
    now: Date = new Date()
  ): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.masterEnabled || !settings.taskReminders.enabled) return null;
    if (!item.suggestedStartTime) return null;

    const [y, m, d] = item.date.split('-').map(Number);
    const [h, min] = item.suggestedStartTime.split(':').map(Number);
    const triggerDate = new Date(y, m - 1, d, h, min, 0);
    // Remind 10 minutes prior
    triggerDate.setMinutes(triggerDate.getMinutes() - 10);

    if (triggerDate.getTime() <= now.getTime()) {
      return null;
    }

    if (this.isQuietHour(triggerDate, false)) {
      return null;
    }

    const scheduledForISO = triggerDate.toISOString();
    const existing = await notificationRecordRepository.findExisting(
      'task_reminder',
      item.id,
      scheduledForISO
    );
    if (existing) return existing.id;

    const title = `Study Time: ${item.title}`;
    const body = `Planned study block begins at ${item.suggestedStartTime} (${item.durationMinutes || 30} mins).`;
    const payload = {
      type: 'study_block',
      itemId: item.id,
      date: item.date,
      startTime: item.suggestedStartTime,
    };

    const notifId = await this.adapter.scheduleNotificationAsync({
      content: { title, body, data: payload, sound: true },
      trigger: { date: triggerDate, channelId: 'tasks' },
    });

    const record = await notificationRecordRepository.create({
      id: `notif-study-${item.id}-${item.date}`,
      type: 'task_reminder',
      entityId: item.id,
      scheduledFor: scheduledForISO,
      expoNotificationId: notifId,
      title,
      body,
      payload,
    });

    return record.id;
  }

  async scheduleOverloadDayAlert(
    dateStr: string,
    workload: { totalMinutes: number; explanation: string },
    now: Date = new Date()
  ): Promise<string | null> {
    const settings = await this.getSettings();
    if (!settings.masterEnabled) return null;

    const todayStr = formatLocalDate(now);
    const [y, m, d] = dateStr.split('-').map(Number);
    // Morning alert at 08:00 AM on the day
    const triggerDate = new Date(y, m - 1, d, 8, 0, 0);

    if (triggerDate.getTime() <= now.getTime()) {
      // If already past 8 AM today, allow immediate 1-minute alert if today
      if (dateStr === todayStr) {
        triggerDate.setTime(now.getTime() + 60 * 1000);
      } else {
        return null;
      }
    }

    if (this.isQuietHour(triggerDate, false)) {
      return null;
    }

    const scheduledForISO = triggerDate.toISOString();
    const existing = await notificationRecordRepository.findExisting(
      'schedule_alert',
      `overload-${dateStr}`,
      scheduledForISO
    );
    if (existing) return existing.id;

    const title = 'Heavy Academic Load Today';
    const body = workload.explanation;
    const payload = {
      type: 'workload_overload',
      date: dateStr,
      totalMinutes: workload.totalMinutes,
    };

    const notifId = await this.adapter.scheduleNotificationAsync({
      content: { title, body, data: payload, sound: true },
      trigger: { date: triggerDate, channelId: 'general' },
    });

    const record = await notificationRecordRepository.create({
      id: `notif-overload-${dateStr}`,
      type: 'schedule_alert',
      entityId: `overload-${dateStr}`,
      scheduledFor: scheduledForISO,
      expoNotificationId: notifId,
      title,
      body,
      payload,
    });

    return record.id;
  }
}

export const notificationService = new NotificationService();
