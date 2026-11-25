/**
 * KaryaDEX — SessionConfigModal
 *
 * Modal for selecting exam presets and focus configuration.
 * Loads default and custom presets, and supports exam searching/selection.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing, brand } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { FocusGuidanceModal } from '@/components/lockin/FocusGuidanceModal';
import { useLockInStore } from '@/hooks/useLockInStore';
import type { LockinExamPreset } from '@/types/lockin';
import { DEFAULT_EXAM_PRESETS } from '@/types/lockin';
import type { IndianExam } from '@/types/lockin';

interface SessionConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPreset: (preset: LockinExamPreset) => void;
}

export function SessionConfigModal({
  visible,
  onClose,
  onSelectPreset,
}: SessionConfigModalProps) {
  const { colors, isDark } = useTheme();
  const presets = useLockInStore((s) => s.presets);
  const selectedPresetId = useLockInStore((s) => s.selectedPresetId);
  const setSelectedPresetId = useLockInStore((s) => s.setSelectedPresetId);
  const dndEnabled = useLockInStore((s) => s.dndEnabled);
  const setDndEnabled = useLockInStore((s) => s.setDndEnabled);
  const setGuidanceModalOpen = useLockInStore((s) => s.setGuidanceModalOpen);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAllExams, setShowAllExams] = useState(false);
  const [exams, setExams] = useState<IndianExam[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examsError, setExamsError] = useState<string | null>(null);

  // Async load exam_search_in.json off the main thread
  useEffect(() => {
    const loadExams = async () => {
      try {
        const module = await import('@/assets/onboarding/exam_search_in.json');
        const loadedExams: IndianExam[] = module.default || [];
        setExams(loadedExams);
        setExamsLoading(false);
      } catch (error) {
        console.warn('[SessionConfigModal] Failed to load exam_search_in.json:', error);
        setExamsLoading(false);
        setExamsError('Failed to load exam data');
        // Fall back to empty array - keep UI responsive
        setExams([]);
      }
    };

    loadExams();
  }, []);

  // Combine store presets with default presets if store is empty
  const availablePresets: LockinExamPreset[] = presets.length > 0
    ? presets
    : DEFAULT_EXAM_PRESETS.map((p, idx) => ({
        ...p,
        id: `default_${idx}`,
        userId: 'local',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

  const isSearching = searchQuery.trim().length > 0;

  const filteredPresets = availablePresets.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExams = isSearching && exams.length > 0
    ? exams.filter((exam) =>
        exam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exam.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelect = (preset: LockinExamPreset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPresetId(preset.id);
    onSelectPreset(preset);
    onClose();
  };

  const handleSelectExam = (exam: IndianExam) => {
    const presetMap: Record<string, string> = {
      'pomodoro-classic': 'Pomodoro Classic',
      'deep-work-50-10': 'Deep Work 50/10',
      'exam-cram-90-20': 'Exam Cram 90/20',
      'quick-sprint-15-5': 'Quick Sprint 15/5',
      'marathon-120-30': 'Marathon 120/30',
    };
    const mappedPresetName = presetMap[exam.presetId] || 'Custom Preset';
    const presetFromStore = DEFAULT_EXAM_PRESETS.find((p) => p.name === mappedPresetName);

    if (presetFromStore) {
      const completePreset: LockinExamPreset = {
        ...presetFromStore,
        id: `exam-${exam.id}`,
        userId: 'local',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      handleSelect(completePreset);
    } else {
      const examPreset: LockinExamPreset = {
        id: exam.id,
        userId: 'local',
        name: exam.name,
        type: 'exam_prep',
        workDurationMinutes: exam.durationMinutes,
        shortBreakMinutes: 10,
        longBreakMinutes: 30,
        sessionsUntilLongBreak: 1,
        targetFocusMinutes: exam.totalQuestions,
        isDefault: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSelectedPresetId(examPreset.id);
      onSelectPreset(examPreset);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: Platform.OS === 'web'
              ? 'rgba(5, 7, 11, 0.85)'
              : 'rgba(3, 5, 10, 0.90)',
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close focus preset modal"
        />
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#0A0E1A' : colors.surface,
              borderColor: colors.borderStrong,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Focus Preset</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Select an exam or focus timer configuration
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: colors.surfaceSecondary },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather name="x" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Search bar */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Search exams, midterms, or presets..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Feather name="x-circle" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* Do Not Disturb Toggle */}
          <View
            style={[
              styles.dndContainer,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.dndHeader}>
              <View style={styles.dndTextWrapper}>
                <View style={styles.dndLabelRow}>
                  <Feather name="moon" size={16} color={colors.textTertiary} style={{ marginRight: 6 }} />
                  <Text style={[styles.dndLabel, { color: colors.text }]}>
                    Do Not Disturb during sessions
                  </Text>
                </View>
                <Text style={[styles.dndHint, { color: colors.textTertiary }]}>
                  Uses iOS Focus Mode / Android DND
                </Text>
              </View>
              <Switch
                value={dndEnabled}
                onValueChange={setDndEnabled}
                thumbColor={isDark ? '#00E5FF' : brand.violet}
                trackColor={{
                  false: isDark ? 'rgba(0, 225, 255, 0.3)' : brand.violetSoft,
                  true: isDark ? '#00E5FF' : brand.violet,
                }}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setGuidanceModalOpen(true)}
              style={({ pressed }) => [
                styles.infoButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather name="info" size={14} color={isDark ? '#00E5FF' : brand.violet} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Learn how to set up iOS Focus / Android DND
              </Text>
            </Pressable>
          </View>

          {/* Presets & Exams List */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
          >
            {/* Curated Presets */}
            {filteredPresets.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="button"
                  onPress={() => handleSelect(preset)}
                  style={({ pressed }) => [
                    styles.presetCard,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(0, 225, 255, 0.12)'
                          : brand.violetSoft
                        : colors.surfaceSecondary,
                      borderColor: isSelected
                        ? isDark
                          ? '#00E5FF'
                          : brand.violet
                        : colors.border,
                    },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                  ]}
                >
                  <View style={styles.presetInfo}>
                    <Text
                      style={[
                        styles.presetName,
                        {
                          color: isSelected
                            ? isDark
                              ? '#00E5FF'
                              : brand.violet
                            : colors.text,
                        },
                      ]}
                    >
                      {preset.name}
                    </Text>
                    <Text style={[styles.presetMeta, { color: colors.textSecondary }]}>
                      {preset.workDurationMinutes}m work · {preset.shortBreakMinutes}m break
                      {preset.targetFocusMinutes ? ` · Target ${preset.targetFocusMinutes}m` : ''}
                    </Text>
                  </View>
                  {isSelected && (
                    <Feather
                      name="check-circle"
                      size={20}
                      color={isDark ? '#00E5FF' : brand.violet}
                    />
                  )}
                </Pressable>
              );
            })}

            {/* When searching, show filtered exams */}
            {isSearching && filteredExams.length > 0 && (
              <View style={styles.sectionHeaderRow}>
                <Feather name="book-open" size={14} color={colors.textSecondary} />
                <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
                  Exam Presets ({filteredExams.length})
                </Text>
              </View>
            )}

            {isSearching &&
              filteredExams.slice(0, 30).map((exam) => {
                const isSelected = selectedPresetId === exam.id || selectedPresetId === `exam-${exam.id}`;
                return (
                  <Pressable
                    key={exam.id}
                    accessibilityRole="button"
                    onPress={() => handleSelectExam(exam)}
                    style={({ pressed }) => [
                      styles.presetCard,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(0, 225, 255, 0.12)'
                            : brand.violetSoft
                          : colors.surfaceSecondary,
                        borderColor: isSelected
                          ? isDark
                            ? '#00E5FF'
                            : brand.violet
                          : colors.border,
                      },
                      pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                    ]}
                  >
                    <View style={styles.presetInfo}>
                      <Text
                        style={[
                          styles.presetName,
                          {
                            color: isSelected
                              ? isDark
                                ? '#00E5FF'
                                : brand.violet
                              : colors.text,
                          },
                        ]}
                      >
                        {exam.name}
                      </Text>
                      <Text style={[styles.presetMeta, { color: colors.textSecondary }]}>
                        {exam.category} · {exam.durationMinutes}m duration
                      </Text>
                    </View>
                    {isSelected && (
                      <Feather
                        name="check-circle"
                        size={20}
                        color={isDark ? '#00E5FF' : brand.violet}
                      />
                    )}
                  </Pressable>
                );
              })}

            {/* When not searching, provide an expandable browse exams section */}
            {!isSearching && exams.length > 0 && (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllExams(!showAllExams)}
                  style={({ pressed }) => [
                    styles.browseExamsBtn,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.border,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={styles.browseExamsLeft}>
                    <Feather
                      name="book-open"
                      size={15}
                      color={isDark ? '#00E5FF' : brand.violet}
                    />
                    <Text style={[styles.browseExamsTitle, { color: colors.text }]}>
                      Browse Indian Exam Presets ({exams.length})
                    </Text>
                  </View>
                  <Feather
                    name={showAllExams ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>

                {showAllExams &&
                  exams.slice(0, 30).map((exam) => {
                    const isSelected = selectedPresetId === exam.id || selectedPresetId === `exam-${exam.id}`;
                    return (
                      <Pressable
                        key={exam.id}
                        accessibilityRole="button"
                        onPress={() => handleSelectExam(exam)}
                        style={({ pressed }) => [
                          styles.presetCard,
                          {
                            backgroundColor: isSelected
                              ? isDark
                                ? 'rgba(0, 225, 255, 0.12)'
                              : brand.violetSoft
                              : colors.surfaceSecondary,
                            borderColor: isSelected
                              ? isDark
                                ? '#00E5FF'
                                : brand.violet
                              : colors.border,
                          },
                          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                        ]}
                      >
                        <View style={styles.presetInfo}>
                          <Text
                            style={[
                              styles.presetName,
                              {
                                color: isSelected
                                  ? isDark
                                    ? '#00E5FF'
                                    : brand.violet
                                  : colors.text,
                              },
                            ]}
                          >
                            {exam.name}
                          </Text>
                          <Text style={[styles.presetMeta, { color: colors.textSecondary }]}>
                            {exam.category} · {exam.durationMinutes}m duration
                          </Text>
                        </View>
                        {isSelected && (
                          <Feather
                            name="check-circle"
                            size={20}
                            color={isDark ? '#00E5FF' : brand.violet}
                          />
                        )}
                      </Pressable>
                    );
                  })}
              </>
            )}

            {/* Search empty state */}
            {isSearching && filteredPresets.length === 0 && filteredExams.length === 0 && (
              <Text style={[styles.noResults, { color: colors.textSecondary }]}>
                No presets or exams found matching "{searchQuery}"
              </Text>
            )}

            {examsLoading && isSearching && (
              <ActivityIndicator
                size="small"
                color={isDark ? '#00E5FF' : brand.violet}
                style={{ marginVertical: spacing.md }}
              />
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
      },
      default: {},
    }),
  },
  container: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '88%',
    borderRadius: radii['2xl'],
    borderWidth: 1,
    padding: spacing.xl,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      },
      default: {
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    flexShrink: 0,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    height: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.base,
    ...Platform.select({
      web: {
        outlineWidth: 0,
      },
      default: {},
    }),
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  presetInfo: {
    flex: 1,
  },
  presetName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  presetMeta: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  sectionHeaderText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  browseExamsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  browseExamsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  browseExamsTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  noResults: {
    padding: spacing.md,
    textAlign: 'center',
    fontSize: typography.sizes.sm,
  },
  dndContainer: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    flexShrink: 0,
  },
  dndHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dndTextWrapper: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  dndLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dndLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  dndHint: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  infoText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
});