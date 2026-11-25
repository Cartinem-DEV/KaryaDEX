/**
 * KaryaDEX — Onboarding Step 11: Completion Screen
 *
 * Confirms setup summary and launches into the student's real workspace.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, radii } from '@/constants/theme';
import { GlassCard, LuminousButton } from '@/components/ui';
import { Feather } from '@expo/vector-icons';
import {
  CheckCircleIcon,
  SchoolIcon,
  PersonIcon,
  TopicBookIcon,
  CalendarIcon,
  StorageHardDriveIcon,
  NotificationBellIcon,
  AlertTriangleIcon,
} from '@/components/ui/AcademicIcons';
import type { OnboardingDraftData } from '@/types/onboarding';

interface StepCompletionProps {
  draftData: OnboardingDraftData;
  onFinish: () => Promise<void>;
  onBack: () => void;
}

export function StepCompletion({
  draftData,
  onFinish,
  onBack,
}: StepCompletionProps) {
  const { colors, isDark } = useTheme();
  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenApp = async () => {
    try {
      setIsFinishing(true);
      setError(null);
      await onFinish();
    } catch (err: any) {
      setIsFinishing(false);
      setError(err?.message || 'Failed to finalize setup. Please try again.');
    }
  };

  const subjectsCount = draftData.subjects?.length || 0;
  const classesCount = draftData.timetableSlots?.length || 0;
  const target = draftData.attendance?.target ?? 75;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.successBadge,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)',
              borderColor: '#10B981',
            },
          ]}
        >
          <CheckCircleIcon size={36} color="#10B981" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Your campus is set up.</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          KaryaDEX is ready for your academic journey.
        </Text>
      </View>

      {/* Summary Card */}
      <GlassCard level="primary" style={styles.summaryCard}>
        <Text style={[styles.cardHeader, { color: '#00E5FF' }]}>ACADEMIC SUMMARY</Text>

        <View style={styles.summaryList}>
          {/* Student */}
          <View style={styles.summaryItem}>
            <PersonIcon size={20} color="#00E5FF" />
            <View style={styles.summaryItemText}>
              <Text style={[styles.summaryLabel, { color: '#00E5FF' }]}>STUDENT</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {draftData.profile?.name || 'Student'} · {draftData.academic?.program || ''}
                {draftData.academic?.branch ? ` (${draftData.academic.branch})` : ''}
              </Text>
            </View>
          </View>

          {/* College */}
          <View style={styles.summaryItem}>
            <SchoolIcon size={20} color="#3B82F6" />
            <View style={styles.summaryItemText}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>INSTITUTION</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {draftData.college?.name || 'College'}
                {draftData.college?.campus ? ` (${draftData.college.campus})` : ''}
              </Text>
            </View>
          </View>

          {/* Semester & Target */}
          <View style={styles.summaryItem}>
            <TopicBookIcon size={20} color="#EC4899" />
            <View style={styles.summaryItemText}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>SEMESTER & TARGET</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {draftData.academic?.semesterName || 'Semester 1'} · Target {target}% Attendance
              </Text>
            </View>
          </View>

          {/* Enrolled Subjects & Classes */}
          <View style={styles.summaryItem}>
            <CalendarIcon size={20} color="#F59E0B" />
            <View style={styles.summaryItemText}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>COURSES & SCHEDULE</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {subjectsCount} Subject{subjectsCount === 1 ? '' : 's'} · {classesCount} Weekly Class{classesCount === 1 ? '' : 'es'}
              </Text>
            </View>
          </View>

          {/* Storage & Notifications */}
          <View style={styles.summaryItem}>
            <StorageHardDriveIcon size={20} color="#06B6D4" />
            <View style={styles.summaryItemText}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>STORAGE & ALERTS</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {draftData.storage?.storageType === 'custom_folder' ? 'Custom Folder' : 'KaryaDEX App Storage'} · Reminders {draftData.notifications?.enabled ? 'Active' : 'Disabled'}
              </Text>
            </View>
          </View>
        </View>
      </GlassCard>

      {error && (
        <View style={styles.errorBanner}>
          <AlertTriangleIcon size={18} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onBack}
          disabled={isFinishing}
          accessibilityRole="button"
          accessibilityLabel="Review"
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
            Review
          </Text>
        </Pressable>

        <View style={styles.nextButtonWrapper}>
          <LuminousButton
            title="Launch KaryaDEX"
            onPress={handleOpenApp}
            loading={isFinishing}
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
    paddingTop: 20,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: { alignItems: 'center', marginBottom: 24 },
  successBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 15, marginTop: 4, textAlign: 'center' },
  summaryCard: { padding: 20, borderRadius: 24, marginBottom: 24, gap: 16 },
  cardHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  summaryList: { gap: 16 },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  summaryItemText: { flex: 1 },
  summaryLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  summaryValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  errorText: { color: '#EF4444', fontSize: 13, fontWeight: '600', flex: 1 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
