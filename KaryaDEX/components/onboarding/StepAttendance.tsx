/**
 * KaryaDEX — Onboarding Step 8: Attendance Target & Baseline
 *
 * Configures global target percentage (75%, 80%, 85%, Custom) and
 * optional existing attendance baseline (Attended / Total per subject).
 */

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, radii } from '@/constants/theme';
import { GlassCard, LuminousButton, Block3D } from '@/components/ui';
import { AlertTriangleIcon } from '@/components/ui/AcademicIcons';
import type { SubjectDraft } from '@/types/onboarding';

const PRESET_TARGETS = [75, 80, 85];

interface StepAttendanceProps {
  subjects: SubjectDraft[];
  initialTarget?: number;
  initialStartingTotals?: Record<string, { attended: number; total: number }>;
  onNext: (data: {
    target: number;
    startingTotals?: Record<string, { attended: number; total: number }>;
  }) => void;
  onBack: () => void;
}

export function StepAttendance({
  subjects,
  initialTarget = 75,
  initialStartingTotals = {},
  onNext,
  onBack,
}: StepAttendanceProps) {
  const { colors, isDark } = useTheme();
  const [target, setTarget] = useState<number>(initialTarget);
  const [customTarget, setCustomTarget] = useState<string>(
    PRESET_TARGETS.includes(initialTarget) ? '' : String(initialTarget)
  );
  const [isCustom, setIsCustom] = useState<boolean>(!PRESET_TARGETS.includes(initialTarget));

  const [hasExistingAttendance, setHasExistingAttendance] = useState<boolean>(
    Object.keys(initialStartingTotals).length > 0
  );

  const [totals, setTotals] = useState<Record<string, { attended: string; total: string }>>(() => {
    const init: Record<string, { attended: string; total: string }> = {};
    for (const s of subjects) {
      init[s.id] = {
        attended: String(initialStartingTotals[s.id]?.attended ?? ''),
        total: String(initialStartingTotals[s.id]?.total ?? ''),
      };
    }
    return init;
  });

  const [error, setError] = useState<string | null>(null);

  const handleSelectPreset = (val: number) => {
    setIsCustom(false);
    setTarget(val);
    setCustomTarget('');
    setError(null);
  };

  const handleCustomChange = (val: string) => {
    setCustomTarget(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
      setTarget(parsed);
      setError(null);
    }
  };

  const handleNext = () => {
    const activeTarget = isCustom ? parseInt(customTarget, 10) : target;
    if (isNaN(activeTarget) || activeTarget < 1 || activeTarget > 100) {
      setError('Please select or enter a valid attendance target between 1% and 100%.');
      return;
    }

    let parsedTotals: Record<string, { attended: number; total: number }> | undefined;

    if (hasExistingAttendance) {
      parsedTotals = {};
      for (const s of subjects) {
        const item = totals[s.id];
        const att = parseInt(item?.attended || '0', 10);
        const tot = parseInt(item?.total || '0', 10);

        if (att < 0 || tot < 0) {
          setError(`Attendance numbers for ${s.name} cannot be negative.`);
          return;
        }
        if (att > tot) {
          setError(`For ${s.name}, attended classes (${att}) cannot exceed total classes (${tot}).`);
          return;
        }

        if (tot > 0) {
          parsedTotals[s.id] = { attended: att, total: tot };
        }
      }
    }

    setError(null);
    onNext({
      target: activeTarget,
      startingTotals: parsedTotals,
    });
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Attendance Health Target</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Set a sustainable attendance benchmark to stay consistent and detect risks early.
        </Text>
      </View>

      {/* Target Selector Card */}
      <GlassCard level="primary" style={styles.formCard}>
        <Text style={[styles.cardHeader, { color: brand.violet }]}>
          SUSTAINABLE ATTENDANCE BENCHMARK
        </Text>

        <View style={styles.presetRow}>
          {PRESET_TARGETS.map((t) => {
            const isSelected = !isCustom && target === t;
            return (
              <Pressable
                key={t}
                onPress={() => handleSelectPreset(t)}
                style={[
                  styles.presetButton,
                  {
                    borderColor: isSelected ? '#00E5FF' : colors.border,
                    backgroundColor: isSelected
                      ? '#00E5FF'
                      : 'rgba(255, 255, 255, 0.04)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    {
                      color: isSelected ? '#05070B' : colors.text,
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {t}%
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => setIsCustom(true)}
            style={[
              styles.presetButton,
              {
                borderColor: isCustom ? '#00E5FF' : colors.border,
                backgroundColor: isCustom
                  ? '#00E5FF'
                  : 'rgba(255, 255, 255, 0.04)',
              },
            ]}
          >
            <Text
              style={[
                styles.presetButtonText,
                {
                  color: isCustom ? '#05070B' : colors.text,
                  fontWeight: isCustom ? '800' : '600',
                },
              ]}
            >
              Custom
            </Text>
          </Pressable>
        </View>

        {isCustom && (
          <View style={styles.customInputGroup}>
            <Text style={[styles.label, { color: '#00E5FF' }]}>CUSTOM TARGET %</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(6, 12, 24, 0.75)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                },
              ]}
              placeholder="e.g. 70 or 80"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={customTarget}
              onChangeText={handleCustomChange}
              autoFocus
            />
          </View>
        )}
      </GlassCard>

      {/* Existing Attendance Toggle Card */}
      <GlassCard level="primary" style={styles.formCard}>
        <View style={styles.toggleHeader}>
          <View style={styles.toggleTextContainer}>
            <Text style={[styles.toggleTitle, { color: colors.text }]}>
              Existing Attendance
            </Text>
            <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
              Enter current totals if the semester is already in progress.
            </Text>
          </View>
          <Switch
            value={hasExistingAttendance}
            onValueChange={setHasExistingAttendance}
            trackColor={{ false: 'rgba(255, 255, 255, 0.16)', true: '#00E5FF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {hasExistingAttendance && (
          <View style={styles.subjectsList}>
            {subjects.map((s) => (
              <View key={s.id} style={styles.subjectRow}>
                <View style={styles.subjectNameColumn}>
                  <Text style={[styles.subjectNameText, { color: colors.text }]}>
                    {s.name}
                  </Text>
                  <Text style={[styles.subjectCodeText, { color: colors.textSecondary }]}>
                    {s.code}
                  </Text>
                </View>

                <View style={styles.totalsInputRow}>
                  <View style={styles.totalInputCol}>
                    <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>
                      Attended
                    </Text>
                    <TextInput
                      style={[
                        styles.numberInput,
                        {
                          color: colors.text,
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                          borderColor: colors.border,
                        },
                      ]}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={totals[s.id]?.attended || ''}
                      onChangeText={(val) => {
                        setTotals({
                          ...totals,
                          [s.id]: { ...(totals[s.id] || { total: '0' }), attended: val },
                        });
                        setError(null);
                      }}
                    />
                  </View>

                  <Text style={[styles.slashText, { color: colors.textSecondary }]}>/</Text>

                  <View style={styles.totalInputCol}>
                    <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>
                      Total
                    </Text>
                    <TextInput
                      style={[
                        styles.numberInput,
                        {
                          color: colors.text,
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                          borderColor: colors.border,
                        },
                      ]}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={totals[s.id]?.total || ''}
                      onChangeText={(val) => {
                        setTotals({
                          ...totals,
                          [s.id]: { ...(totals[s.id] || { attended: '0' }), total: val },
                        });
                        setError(null);
                      }}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <AlertTriangleIcon size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </GlassCard>

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
  formCard: { padding: 20, borderRadius: 24, marginBottom: 20, gap: 14 },
  cardHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  presetRow: { flexDirection: 'row', gap: 10 },
  presetButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetButtonText: { fontSize: 16, fontWeight: '700' },
  customInputGroup: { gap: 6, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextContainer: { flex: 1, paddingRight: 16 },
  toggleTitle: { fontSize: 16, fontWeight: '700' },
  toggleSubtitle: { fontSize: 13, marginTop: 2 },
  subjectsList: { gap: 14, marginTop: 8 },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  subjectNameColumn: { flex: 1, paddingRight: 10 },
  subjectNameText: { fontSize: 14, fontWeight: '700' },
  subjectCodeText: { fontSize: 12, marginTop: 1 },
  totalsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalInputCol: {
    alignItems: 'center',
  },
  smallLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  numberInput: {
    width: 60,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  slashText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 12,
  },
  errorText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
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
