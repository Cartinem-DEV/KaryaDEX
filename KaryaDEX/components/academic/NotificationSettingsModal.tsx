/**
 * BunkMatKar — Notification Settings Modal (Phase 4)
 *
 * Allows configuring:
 * - Master notification switch
 * - Class reminders (30m, 10m)
 * - Task reminders (Due today, Overdue)
 * - Exam reminders (7d, 3d, 1d, Day of)
 * - Revision reminders (throttled)
 * - Attendance safety alerts
 * - Post-class journal reminders
 * - Quiet hours
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Switch,
  Platform,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import {
  CalendarIcon,
  TaskClipboardIcon,
  NotebookIcon,
  CheckmarkIcon,
} from '@/components/ui/AcademicIcons';
import { useAppStore } from '@/store/useAppStore';
import { notificationService } from '@/services/notificationService';

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationSettingsModal({ visible, onClose }: NotificationSettingsModalProps) {
  const { colors, isDark } = useTheme();
  const { notificationSettings, updateNotificationSettings } = useAppStore();

  if (!visible) return null;

  const toggleMaster = (val: boolean) => {
    updateNotificationSettings({ masterEnabled: val });
  };

  const toggleCategory = (
    category:
      | 'classReminders'
      | 'taskReminders'
      | 'examReminders'
      | 'revisionReminders'
      | 'attendanceAlerts'
      | 'postClassJournal'
      | 'quietHours',
    val: boolean
  ) => {
    updateNotificationSettings({
      [category]: {
        ...(notificationSettings[category] as any),
        enabled: val,
      },
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          Platform.OS === 'web' && ({ backdropFilter: 'blur(20px)' } as any),
        ]}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? 'rgba(18, 19, 28, 0.94)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.10)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Calm, local-first academic reminders
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Master Switch */}
            <GlassCard level="secondary" style={styles.masterCard}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, marginRight: spacing.md }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Allow Notifications</Text>
                  <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                    Receive timely alerts for classes, deadlines, and exams
                  </Text>
                </View>
                <Switch
                  value={notificationSettings.masterEnabled}
                  onValueChange={toggleMaster}
                  trackColor={{ false: 'rgba(148, 163, 184, 0.3)', true: brand.violet }}
                  thumbColor="#FFF"
                />
              </View>
            </GlassCard>

            {notificationSettings.masterEnabled && (
              <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                {/* 1. Class Reminders */}
                <GlassCard level="secondary" style={styles.categoryCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Class Reminders</Text>
                      <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                        Alerts 30 and 10 minutes before class starts
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.classReminders.enabled}
                      onValueChange={v => toggleCategory('classReminders', v)}
                      trackColor={{ false: 'rgba(148, 163, 184, 0.3)', true: brand.violet }}
                      thumbColor="#FFF"
                    />
                  </View>
                </GlassCard>

                {/* 2. Task Reminders */}
                <GlassCard level="secondary" style={styles.categoryCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Task Deadlines</Text>
                      <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                        Reminders for tasks due today and overdue alerts
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.taskReminders.enabled}
                      onValueChange={v => toggleCategory('taskReminders', v)}
                      trackColor={{ false: 'rgba(148, 163, 184, 0.3)', true: brand.violet }}
                      thumbColor="#FFF"
                    />
                  </View>
                </GlassCard>

                {/* 3. Exam Reminders */}
                <GlassCard level="secondary" style={styles.categoryCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Exam Alerts</Text>
                      <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                        Countdown reminders 7 days, 3 days, and morning of exam
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.examReminders.enabled}
                      onValueChange={v => toggleCategory('examReminders', v)}
                      trackColor={{ false: 'rgba(148, 163, 184, 0.3)', true: brand.violet }}
                      thumbColor="#FFF"
                    />
                  </View>
                </GlassCard>

                {/* 4. Revision Reminders */}
                <GlassCard level="secondary" style={styles.categoryCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Daily Revision Prompts</Text>
                      <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                        Gentle evening reminder for unrevised topics (max 1/day)
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.revisionReminders.enabled}
                      onValueChange={v => toggleCategory('revisionReminders', v)}
                      trackColor={{ false: 'rgba(148, 163, 184, 0.3)', true: brand.violet }}
                      thumbColor="#FFF"
                    />
                  </View>
                </GlassCard>

                {/* 5. Attendance Alerts */}
                <GlassCard level="secondary" style={styles.categoryCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Attendance Safety Warnings</Text>
                      <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                        Alert when subject attendance falls below target
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.attendanceAlerts.enabled}
                      onValueChange={v => toggleCategory('attendanceAlerts', v)}
                      trackColor={{ false: 'rgba(148, 163, 184, 0.3)', true: brand.violet }}
                      thumbColor="#FFF"
                    />
                  </View>
                </GlassCard>

                {/* 6. Post-Class Journal */}
                <GlassCard level="secondary" style={styles.categoryCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Post-Class Journal Prompts</Text>
                      <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                        Prompt to record takeaways 15 minutes after class ends
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.postClassJournal.enabled}
                      onValueChange={v => toggleCategory('postClassJournal', v)}
                      trackColor={{ false: 'rgba(148, 163, 184, 0.3)', true: brand.violet }}
                      thumbColor="#FFF"
                    />
                  </View>
                </GlassCard>

                {/* 7. Quiet Hours */}
                <GlassCard level="secondary" style={styles.categoryCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>Quiet Hours (11 PM – 7 AM)</Text>
                      <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                        Silence non-critical notifications while sleeping
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.quietHours.enabled}
                      onValueChange={v => toggleCategory('quietHours', v)}
                      trackColor={{ false: 'rgba(148, 163, 184, 0.3)', true: brand.violet }}
                      thumbColor="#FFF"
                    />
                  </View>
                </GlassCard>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '80%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
  },
  body: {
    padding: spacing.base,
    paddingBottom: 40,
  },
  masterCard: {
    padding: spacing.base,
    borderRadius: radii.md,
  },
  categoryCard: {
    padding: spacing.base,
    borderRadius: radii.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
    lineHeight: 16,
  },
});
