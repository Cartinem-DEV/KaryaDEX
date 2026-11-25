/**
 * KaryaDEX — TaskRescheduleModal Component (Phase 9)
 *
 * Safe date & time selection flow to reschedule canonical tasks.
 * Avoids fragile drag-and-drop on mobile/touch platforms while preserving
 * relational integrity (Task ↔ Subject ↔ Topic ↔ Exam).
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { formatLocalDate, parseLocalDate } from '@/lib/timeUtils';
import { studyPlanningService } from '@/services/studyPlanningService';
import type { Task } from '@/types';

interface TaskRescheduleModalProps {
  visible: boolean;
  onClose: () => void;
  task: Task | null;
  onRescheduled?: (task: Task) => void;
}

export function TaskRescheduleModal({
  visible,
  onClose,
  task,
  onRescheduled,
}: TaskRescheduleModalProps) {
  const { colors, isDark } = useTheme();

  const now = new Date();
  const todayStr = formatLocalDate(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  const in2Days = new Date(now);
  in2Days.setDate(in2Days.getDate() + 2);
  const in2DaysStr = formatLocalDate(in2Days);

  const in3Days = new Date(now);
  in3Days.setDate(in3Days.getDate() + 3);
  const in3DaysStr = formatLocalDate(in3Days);

  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  const in7DaysStr = formatLocalDate(in7Days);

  const [selectedDate, setSelectedDate] = useState<string>(task?.scheduledDate || task?.dueDate || todayStr);
  const [selectedTime, setSelectedTime] = useState<string | undefined>(task?.scheduledStartTime || '17:00');
  const [isSaving, setIsSaving] = useState(false);

  if (!visible || !task) return null;

  const dateOptions = [
    { label: 'Today', value: todayStr },
    { label: 'Tomorrow', value: tomorrowStr },
    { label: 'In 2 Days', value: in2DaysStr },
    { label: 'In 3 Days', value: in3DaysStr },
    { label: 'In 1 Week', value: in7DaysStr },
  ];

  const timeOptions = [
    { label: 'Morning (09:00)', value: '09:00' },
    { label: 'Midday (13:00)', value: '13:00' },
    { label: 'Afternoon (16:30)', value: '16:30' },
    { label: 'Evening (18:00)', value: '18:00' },
    { label: 'Night (20:00)', value: '20:00' },
    { label: 'No Specific Time', value: undefined },
  ];

  const handleSave = async () => {
    if (!task) return;
    setIsSaving(true);
    try {
      let endTime: string | undefined;
      if (selectedTime) {
        const [h, m] = selectedTime.split(':').map(Number);
        const dur = task.estimatedMinutes || 30;
        const totalM = h * 60 + m + dur;
        const endH = Math.floor(totalM / 60) % 24;
        const endM = totalM % 60;
        endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      }

      const updated = await studyPlanningService.rescheduleTask(
        task.id,
        selectedDate,
        selectedTime,
        endTime
      );
      if (updated && onRescheduled) {
        onRescheduled(updated);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Schedule Task</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {task.title}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Date Selection */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Target Date</Text>
            <View style={styles.chipGrid}>
              {dateOptions.map(opt => {
                const isSelected = selectedDate === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setSelectedDate(opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? brand.violet
                          : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                        borderColor: isSelected ? brand.violet : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? '#FFFFFF' : colors.text },
                        isSelected && { fontWeight: '700' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={[
                        styles.chipSubText,
                        { color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textTertiary },
                      ]}
                    >
                      {opt.value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Time Slot Selection */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.md }]}>
              Suggested Time Window
            </Text>
            <View style={styles.chipGrid}>
              {timeOptions.map((opt, idx) => {
                const isSelected = selectedTime === opt.value;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => setSelectedTime(opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? brand.violet
                          : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                        borderColor: isSelected ? brand.violet : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? '#FFFFFF' : colors.text },
                        isSelected && { fontWeight: '700' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Info note */}
            <View
              style={[
                styles.noteBox,
                { backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)' },
              ]}
            >
              <Text style={[styles.noteText, { color: brand.violet }]}>
                Fixed ClassSessions and Exams act as protected academic commitments and will not be
                overridden by this task block.
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={[
                styles.cancelBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.saveBtn, { backgroundColor: brand.violet }, isSaving && { opacity: 0.6 }]}
            >
              <Text style={styles.saveBtnText}>{isSaving ? 'Updating...' : 'Save Schedule'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },
  body: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: '47%',
  },
  chipText: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
  },
  chipSubText: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  noteBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  noteText: {
    fontSize: typography.sizes.xs,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
});
