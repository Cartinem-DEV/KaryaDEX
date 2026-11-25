/**
 * KaryaDEX — Onboarding Step 5: Subject Setup
 *
 * Rapid, frictionless subject entry with duplicate prevention,
 * type tagging (lecture/lab/tutorial), color picking, and credits.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, radii } from '@/constants/theme';
import { GlassCard, LuminousButton, Block3D } from '@/components/ui';
import { Feather } from '@expo/vector-icons';
import {
  AddIcon,
  TrashIcon,
  AlertTriangleIcon,
  TopicBookIcon,
} from '@/components/ui/AcademicIcons';
import type { SubjectDraft } from '@/types/onboarding';

const COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#6366F1', // Indigo
];

const SUBJECT_TYPES: Array<'lecture' | 'lab' | 'tutorial' | 'mixed'> = ['lecture', 'lab', 'tutorial', 'mixed'];

interface StepSubjectsProps {
  initialSubjects?: SubjectDraft[];
  onNext: (subjects: SubjectDraft[]) => void;
  onBack: () => void;
}

export function StepSubjects({
  initialSubjects = [],
  onNext,
  onBack,
}: StepSubjectsProps) {
  const { colors, isDark } = useTheme();
  const [subjects, setSubjects] = useState<SubjectDraft[]>(initialSubjects);

  // Form fields for adding a subject
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [credits, setCredits] = useState('3');
  const [facultyName, setFacultyName] = useState('');
  const [room, setRoom] = useState('');
  const [subjectType, setSubjectType] = useState<'lecture' | 'lab' | 'tutorial' | 'mixed'>('lecture');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[subjects.length % COLOR_PALETTE.length]);
  const [error, setError] = useState<string | null>(null);

  const handleAddSubject = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Subject name is required.');
      return;
    }

    // Duplicate check: normalized case-insensitive comparison
    const isDuplicate = subjects.some(
      s => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setError(`Subject "${trimmedName}" has already been added.`);
      return;
    }

    setError(null);
    const resolvedCode = code.trim() || trimmedName.slice(0, 4).toUpperCase();
    const resolvedShortName = trimmedName.split(' ')[0] || trimmedName.slice(0, 10);
    const parsedCredits = Number(credits) >= 0 ? Number(credits) : 3;

    const newSubject: SubjectDraft = {
      id: `subj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      shortName: resolvedShortName,
      code: resolvedCode,
      color: selectedColor,
      credits: parsedCredits,
      facultyName: facultyName.trim() || undefined,
      room: room.trim() || undefined,
      subjectType,
    };

    const nextList = [...subjects, newSubject];
    setSubjects(nextList);

    // Reset rapid fields
    setName('');
    setCode('');
    setFacultyName('');
    setRoom('');
    setSelectedColor(COLOR_PALETTE[nextList.length % COLOR_PALETTE.length]);
  };

  const handleRemoveSubject = (id: string) => {
    setSubjects(subjects.filter(s => s.id !== id));
  };

  const handleNext = () => {
    if (subjects.length === 0) {
      setError('Please add at least one subject to proceed.');
      return;
    }
    setError(null);
    onNext(subjects);
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Add Your Subjects</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter the courses enrolled in this semester.
        </Text>
      </View>

      {/* Quick Add Form Card */}
      <GlassCard level="primary" style={styles.formCard}>
        <Text style={[styles.cardHeader, { color: brand.violet }]}>NEW SUBJECT</Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: '#00E5FF' }]}>SUBJECT NAME *</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: '#FFFFFF',
                backgroundColor: 'rgba(6, 12, 24, 0.75)',
                borderColor: error && !name.trim() ? '#EF4444' : 'rgba(255, 255, 255, 0.12)',
              },
            ]}
            placeholder="e.g. Engineering Mathematics"
            placeholderTextColor="#64748B"
            value={name}
            onChangeText={(val) => {
              setName(val);
              if (error) setError(null);
            }}
          />
        </View>

        <View style={styles.inlineRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: '#94A3B8' }]}>CODE (OPTIONAL)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(6, 12, 24, 0.75)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                },
              ]}
              placeholder="e.g. MATH-101"
              placeholderTextColor="#64748B"
              value={code}
              onChangeText={setCode}
            />
          </View>
          <View style={[styles.inputGroup, { width: 90 }]}>
            <Text style={[styles.label, { color: '#94A3B8' }]}>CREDITS</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(6, 12, 24, 0.75)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  textAlign: 'center',
                },
              ]}
              placeholder="3"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={credits}
              onChangeText={setCredits}
            />
          </View>
        </View>

        {/* Subject Type Selector */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: '#00E5FF' }]}>TYPE</Text>
          <View style={styles.typeRow}>
            {SUBJECT_TYPES.map((t) => {
              const isSelected = subjectType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setSubjectType(t)}
                  style={[
                    styles.typeChip,
                    {
                      borderColor: isSelected ? '#00E5FF' : 'rgba(255, 255, 255, 0.12)',
                      backgroundColor: isSelected
                        ? 'rgba(0, 229, 255, 0.18)'
                        : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: isSelected ? '#00E5FF' : '#94A3B8' },
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Color Palette Selector */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: '#94A3B8' }]}>COLOR ACCENT</Text>
          <View style={styles.paletteRow}>
            {COLOR_PALETTE.map((c) => {
              const isSelected = selectedColor === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setSelectedColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    isSelected && styles.colorDotSelected,
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* Optional Teacher / Room */}
        <View style={styles.inlineRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: '#94A3B8' }]}>FACULTY (OPTIONAL)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(6, 12, 24, 0.75)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                },
              ]}
              placeholder="e.g. Dr. Verma"
              placeholderTextColor="#64748B"
              value={facultyName}
              onChangeText={setFacultyName}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: '#94A3B8' }]}>ROOM (OPTIONAL)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(6, 12, 24, 0.75)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                },
              ]}
              placeholder="e.g. Room 204"
              placeholderTextColor="#64748B"
              value={room}
              onChangeText={setRoom}
            />
          </View>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <AlertTriangleIcon size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={handleAddSubject}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: 'rgba(0, 229, 255, 0.16)', borderColor: '#00E5FF', borderWidth: 1 },
            pressed && { opacity: 0.9 },
          ]}
        >
          <AddIcon size={18} color="#00E5FF" />
          <Text style={[styles.addButtonText, { color: '#00E5FF' }]}>Add Subject</Text>
        </Pressable>
      </GlassCard>

      {/* Added Subjects List */}
      <View style={styles.listSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Added Subjects ({subjects.length})
        </Text>

        {subjects.length === 0 ? (
          <View style={[styles.emptyCard, { borderColor: colors.border }]}>
            <TopicBookIcon size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No subjects added yet. Add your first subject above!
            </Text>
          </View>
        ) : (
          subjects.map((s) => (
            <GlassCard key={s.id} level="secondary" style={styles.subjectItem}>
              <View style={styles.subjectItemLeft}>
                <View style={[styles.subjectIndicator, { backgroundColor: s.color }]} />
                <View style={styles.subjectItemInfo}>
                  <Text style={[styles.subjectItemName, { color: colors.text }]}>
                    {s.name}
                  </Text>
                  <Text style={[styles.subjectItemMeta, { color: colors.textSecondary }]}>
                    {s.code} · {s.credits} Credits · {s.subjectType}
                    {s.facultyName ? ` · ${s.facultyName}` : ''}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => handleRemoveSubject(s.id)}
                hitSlop={8}
                style={styles.deleteButton}
              >
                <TrashIcon size={18} color="#EF4444" />
              </Pressable>
            </GlassCard>
          ))
        )}
      </View>

      {/* Navigation Buttons */}
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
  formCard: {
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    gap: 14,
  },
  cardHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  addButton: {
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  listSection: {
    marginBottom: 24,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  subjectItem: {
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  subjectIndicator: {
    width: 10,
    height: 36,
    borderRadius: 5,
  },
  subjectItemInfo: {
    flex: 1,
  },
  subjectItemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  subjectItemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    padding: 6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
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
