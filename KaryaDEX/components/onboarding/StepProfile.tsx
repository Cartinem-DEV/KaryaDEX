/**
 * KaryaDEX — Onboarding Step 2: Student Profile
 *
 * Collects student name, academic year, and priority goals.
 * Features:
 * - 3D extruded option blocks (Block3D) with mechanical keycap depression
 * - Strict vector icon system (zero emojis)
 * - Signature LuminousButton CTA
 * - Obsidian dark liquid glass styling with specular rim lighting
 */

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, radii } from '@/constants/theme';
import { GlassCard, LuminousButton, Block3D } from '@/components/ui';
import { AlertTriangleIcon } from '@/components/ui/AcademicIcons';

export interface PriorityGoal {
  id: string;
  label: string;
  iconName: keyof typeof Feather.glyphMap;
}

export const STUDENT_PRIORITY_GOALS: PriorityGoal[] = [
  { id: 'routine', label: 'Keep my college routine organized', iconName: 'calendar' },
  { id: 'attendance', label: 'Improve attendance consistency', iconName: 'target' },
  { id: 'assignments', label: 'Stay on top of assignments & practicals', iconName: 'file-text' },
  { id: 'syllabus', label: 'Track subjects and syllabus completion', iconName: 'book-open' },
  { id: 'study_habit', label: 'Build a sustainable study habit', iconName: 'clock' },
  { id: 'exam_prep', label: 'Prepare for exams without last-minute panic', iconName: 'award' },
  { id: 'deadlines', label: 'Reduce forgotten tasks and deadlines', iconName: 'bell' },
  { id: 'progress', label: 'Understand my academic progress', iconName: 'trending-up' },
];

interface StepProfileProps {
  initialName?: string;
  initialAcademicYear?: string;
  initialGoals?: string[];
  onNext: (data: { name: string; academicYear?: string; goals?: string[] }) => void;
  onBack: () => void;
}

export function StepProfile({
  initialName = '',
  initialAcademicYear = '',
  initialGoals = ['routine', 'attendance'],
  onNext,
  onBack,
}: StepProfileProps) {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState(initialName);
  const [academicYear, setAcademicYear] = useState(initialAcademicYear || '2026-27');
  const [selectedGoals, setSelectedGoals] = useState<string[]>(initialGoals);
  const [error, setError] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setError(null);
    onNext({
      name: name.trim(),
      academicYear: academicYear.trim() || undefined,
      goals: selectedGoals,
    });
  };

  const getInitials = (str: string) => {
    return (
      str
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('') || '?'
    );
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : colors.text }]}>
          What should we call you?
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
          Your academic identity inside KaryaDEX.
        </Text>
      </View>

      {/* ─── Avatar Preview ─── */}
      <View style={styles.avatarContainer}>
        <View
          style={[
            styles.avatarBadge,
            {
              backgroundColor: isDark ? 'rgba(0, 229, 255, 0.12)' : 'rgba(139, 92, 246, 0.12)',
              borderColor: isDark ? '#00E5FF' : brand.violet,
            },
          ]}
        >
          <Text style={[styles.avatarInitials, { color: isDark ? '#00E5FF' : brand.violet }]}>
            {getInitials(name)}
          </Text>
        </View>
      </View>

      {/* ─── Name & Academic Year Form ─── */}
      <GlassCard level="primary" style={styles.formCard}>
        {/* Name input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: isDark ? '#00E5FF' : colors.textSecondary }]}>
            YOUR NAME *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: isDark ? '#FFFFFF' : colors.text,
                backgroundColor: isDark ? 'rgba(6, 12, 24, 0.75)' : 'rgba(0, 0, 0, 0.03)',
                borderColor: error
                  ? '#EF4444'
                  : focusedInput === 'name'
                  ? '#00E5FF'
                  : isDark
                  ? 'rgba(255, 255, 255, 0.12)'
                  : colors.border,
              },
            ]}
            placeholder="e.g. Saikat Roy"
            placeholderTextColor={isDark ? '#64748B' : colors.textTertiary}
            value={name}
            onFocus={() => setFocusedInput('name')}
            onBlur={() => setFocusedInput(null)}
            onChangeText={(val) => {
              setName(val);
              if (error) setError(null);
            }}
            autoFocus
          />
        </View>

        {/* Academic year input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
            ACADEMIC YEAR (OPTIONAL)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: isDark ? '#FFFFFF' : colors.text,
                backgroundColor: isDark ? 'rgba(6, 12, 24, 0.75)' : 'rgba(0, 0, 0, 0.03)',
                borderColor:
                  focusedInput === 'year'
                    ? '#00E5FF'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.12)'
                    : colors.border,
              },
            ]}
            placeholder="e.g. 2026-27"
            placeholderTextColor={isDark ? '#64748B' : colors.textTertiary}
            value={academicYear}
            onFocus={() => setFocusedInput('year')}
            onBlur={() => setFocusedInput(null)}
            onChangeText={setAcademicYear}
          />
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <AlertTriangleIcon size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </GlassCard>

      {/* ─── Goal Priorities: 3D Extruded Blocks ─── */}
      <GlassCard level="primary" style={styles.formCard}>
        <View style={styles.prioritiesHeaderRow}>
          <View style={styles.prioritiesIconPad}>
            <Feather name="compass" size={14} color="#00E5FF" />
          </View>
          <Text style={[styles.cardHeader, { color: isDark ? '#00E5FF' : brand.violet }]}>
            WHAT ARE YOUR PRIORITIES THIS SEMESTER?
          </Text>
        </View>
        <Text style={[styles.priorityHelp, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
          Select one or more goals to personalize your academic dashboard:
        </Text>
        <View style={styles.goalsContainer}>
          {STUDENT_PRIORITY_GOALS.map((goal) => {
            const isSelected = selectedGoals.includes(goal.id);
            return (
              <Block3D
                key={goal.id}
                variant="compact"
                selected={isSelected}
                onPress={() => toggleGoal(goal.id)}
                title={goal.label}
                accentColor="#00E5FF"
                glowColor="rgba(0, 229, 255, 0.3)"
                icon={
                  <Feather
                    name={goal.iconName}
                    size={17}
                    color={isSelected ? '#00E5FF' : isDark ? '#94A3B8' : '#64748B'}
                  />
                }
              />
            );
          })}
        </View>
      </GlassCard>

      {/* ─── Navigation Buttons: Back + LuminousButton ─── */}
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
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  formCard: {
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1.2,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  prioritiesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prioritiesIconPad: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  priorityHelp: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -6,
  },
  goalsContainer: {
    gap: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
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
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  nextButtonWrapper: {
    flex: 1,
  },
});
