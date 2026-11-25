/**
 * KaryaDEX — Onboarding Step 10: Notification Setup
 *
 * Configures reminder categories with sensible defaults and explains
 * purpose before requesting native OS notification permissions.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, radii } from '@/constants/theme';
import { GlassCard, LuminousButton } from '@/components/ui';
import { Feather } from '@expo/vector-icons';
import {
  NotificationBellIcon,
  CalendarIcon,
  TaskClipboardIcon,
  RevisionCycleIcon,
  NotebookIcon,
  CheckCircleIcon,
} from '@/components/ui/AcademicIcons';
import { notificationService } from '@/services/notificationService';

interface StepNotificationsProps {
  initialNotifications?: {
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
  onNext: (data: {
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
  }) => void;
  onBack: () => void;
}

export function StepNotifications({
  initialNotifications,
  onNext,
  onBack,
}: StepNotificationsProps) {
  const { colors, isDark } = useTheme();

  const [masterEnabled, setMasterEnabled] = useState<boolean>(
    initialNotifications?.enabled ?? true
  );
  const [class10, setClass10] = useState<boolean>(
    initialNotifications?.classReminders10 ?? true
  );
  const [class30, setClass30] = useState<boolean>(
    initialNotifications?.classReminders30 ?? false
  );
  const [taskDue, setTaskDue] = useState<boolean>(
    initialNotifications?.taskDueToday ?? true
  );
  const [taskOverdue, setTaskOverdue] = useState<boolean>(
    initialNotifications?.taskOverdue ?? true
  );
  const [exam1Day, setExam1Day] = useState<boolean>(
    initialNotifications?.examReminders1Day ?? true
  );
  const [exam3Days, setExam3Days] = useState<boolean>(
    initialNotifications?.examReminders3Days ?? true
  );
  const [revision, setRevision] = useState<boolean>(
    initialNotifications?.revisionReminders ?? true
  );
  const [attendance, setAttendance] = useState<boolean>(
    initialNotifications?.attendanceAlerts ?? true
  );
  const [journal, setJournal] = useState<boolean>(
    initialNotifications?.postClassJournal ?? true
  );

  const [permissionRequested, setPermissionRequested] = useState<boolean>(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const handleRequestPermission = async () => {
    try {
      const granted = await notificationService.requestPermissions();
      setPermissionGranted(granted);
      setPermissionRequested(true);
    } catch {
      setPermissionGranted(false);
      setPermissionRequested(true);
    }
  };

  const handleNext = async () => {
    if (masterEnabled && !permissionRequested) {
      await handleRequestPermission();
    }

    onNext({
      enabled: masterEnabled,
      classReminders10: class10,
      classReminders30: class30,
      taskDueToday: taskDue,
      taskOverdue: taskOverdue,
      examReminders1Day: exam1Day,
      examReminders3Days: exam3Days,
      revisionReminders: revision,
      attendanceAlerts: attendance,
      postClassJournal: journal,
    });
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Stay on Track</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Calm, local-only academic reminders. Never noisy.
        </Text>
      </View>

      {/* Master Toggle Card */}
      <GlassCard level="primary" style={styles.masterCard}>
        <View style={styles.masterRow}>
          <View style={styles.masterIconBadge}>
            <NotificationBellIcon size={24} color="#00E5FF" />
          </View>
          <View style={styles.masterText}>
            <Text style={[styles.masterTitle, { color: colors.text }]}>
              Academic Reminders
            </Text>
            <Text style={[styles.masterDesc, { color: colors.textSecondary }]}>
              Scheduled locally on your device with quiet hours respected (11 PM – 7 AM).
            </Text>
          </View>
          <Switch
            value={masterEnabled}
            onValueChange={setMasterEnabled}
            trackColor={{ false: 'rgba(255, 255, 255, 0.16)', true: '#00E5FF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {masterEnabled && !permissionGranted && (
          <Pressable
            onPress={handleRequestPermission}
            style={({ pressed }) => [
              styles.permissionButton,
              { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderColor: '#00E5FF' },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.permissionButtonText, { color: '#00E5FF' }]}>
              {permissionRequested ? 'Permission Checked' : 'Enable Device Notification Permission'}
            </Text>
          </Pressable>
        )}
      </GlassCard>

      {/* Category Toggles */}
      {masterEnabled && (
        <GlassCard level="secondary" style={styles.categoriesCard}>
          <Text style={[styles.cardHeader, { color: '#00E5FF' }]}>
            REMINDER CATEGORIES
          </Text>

          {/* Class Reminders */}
          <View style={styles.categoryItem}>
            <View style={styles.categoryLeft}>
              <CalendarIcon size={18} color="#3B82F6" />
              <View style={styles.categoryInfo}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  Class Reminders (10 min before)
                </Text>
                <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>
                  Alert before upcoming lecture or lab starts.
                </Text>
              </View>
            </View>
            <Switch
              value={class10}
              onValueChange={setClass10}
              trackColor={{ false: 'rgba(255, 255, 255, 0.16)', true: '#00E5FF' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Task Reminders */}
          <View style={styles.categoryItem}>
            <View style={styles.categoryLeft}>
              <TaskClipboardIcon size={18} color="#8B5CF6" />
              <View style={styles.categoryInfo}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  Task Due & Overdue Alerts
                </Text>
                <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>
                  Remind when an assignment deadline is approaching.
                </Text>
              </View>
            </View>
            <Switch
              value={taskDue}
              onValueChange={setTaskDue}
              trackColor={{ false: 'rgba(255, 255, 255, 0.16)', true: '#00E5FF' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Exam Countdown */}
          <View style={styles.categoryItem}>
            <View style={styles.categoryLeft}>
              <NotificationBellIcon size={18} color="#F59E0B" />
              <View style={styles.categoryInfo}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  Exam Sprint Reminders
                </Text>
                <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>
                  Alerts 3 days and 1 day before major exams.
                </Text>
              </View>
            </View>
            <Switch
              value={exam1Day}
              onValueChange={setExam1Day}
              trackColor={{ false: 'rgba(255, 255, 255, 0.16)', true: '#00E5FF' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Revision Backlog */}
          <View style={styles.categoryItem}>
            <View style={styles.categoryLeft}>
              <RevisionCycleIcon size={18} color="#EC4899" />
              <View style={styles.categoryInfo}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  Revision Backlog Alerts
                </Text>
                <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>
                  Max 1 gentle reminder per subject per day.
                </Text>
              </View>
            </View>
            <Switch
              value={revision}
              onValueChange={setRevision}
              trackColor={{ false: 'rgba(255, 255, 255, 0.16)', true: '#00E5FF' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Attendance Risk */}
          <View style={styles.categoryItem}>
            <View style={styles.categoryLeft}>
              <CheckCircleIcon size={18} color="#10B981" />
              <View style={styles.categoryInfo}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  Attendance Risk Alerts
                </Text>
                <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>
                  Meaningful transition alerts when entering the danger zone.
                </Text>
              </View>
            </View>
            <Switch
              value={attendance}
              onValueChange={setAttendance}
              trackColor={{ false: 'rgba(255, 255, 255, 0.16)', true: '#00E5FF' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Post-Class Journal */}
          <View style={styles.categoryItem}>
            <View style={styles.categoryLeft}>
              <NotebookIcon size={18} color="#06B6D4" />
              <View style={styles.categoryInfo}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  Post-Class Journal Prompt
                </Text>
                <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>
                  Reminder after class to log covered topics while fresh.
                </Text>
              </View>
            </View>
            <Switch
              value={journal}
              onValueChange={setJournal}
              trackColor={{ false: 'rgba(255, 255, 255, 0.16)', true: '#00E5FF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </GlassCard>
      )}

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: isDark ? 'rgba(10, 16, 28, 0.85)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : colors.border,
            },
            pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Feather name="chevron-left" size={18} color={isDark ? '#E2E8F0' : colors.text} />
          <Text style={[styles.backButtonText, { color: isDark ? '#E2E8F0' : colors.textSecondary }]}>
            Back
          </Text>
        </Pressable>

        <View style={styles.nextButtonWrapper}>
          <LuminousButton
            title="Continue"
            onPress={handleNext}
            size="medium"
            showArrow
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 4 },
  masterCard: { padding: 18, borderRadius: 22, marginBottom: 18, gap: 14 },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  masterIconBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterText: { flex: 1 },
  masterTitle: { fontSize: 16, fontWeight: '700' },
  masterDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  permissionButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  permissionButtonText: { fontSize: 13, fontWeight: '700' },
  categoriesCard: { padding: 18, borderRadius: 22, marginBottom: 20, gap: 14 },
  cardHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  categoryInfo: { flex: 1 },
  categoryTitle: { fontSize: 14, fontWeight: '700' },
  categoryDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  backButton: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  backButtonText: { fontSize: 15, fontWeight: '600' },
  nextButtonWrapper: {
    flex: 1,
  },
});
