/**
 * KaryaDEX — SubjectGradesView
 *
 * Grades & Academic Performance View for Subject Hub.
 * Shows subject overall percentage, letter grade, grade points,
 * semester SGPA context, and assessment breakdowns.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { useAcademicStore } from '@/store/useAcademicStore';
import { formatLocalDate } from '@/lib/timeUtils';
import type { Assessment } from '@/types/academic';

interface SubjectGradesViewProps {
  subjectId: string;
}

export function SubjectGradesView({ subjectId }: SubjectGradesViewProps) {
  const { colors, isDark } = useTheme();
  const academic = useAcademicStore();

  const perf = academic.getSubjectPerformance(subjectId);
  const semGPA = academic.getSemesterGPA();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [obtained, setObtained] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [weight, setWeight] = useState('');
  const [type, setType] = useState<Assessment['type']>('internal');

  const handleAdd = () => {
    if (!name.trim() || !obtained.trim() || !maxMarks.trim()) return;
    const marksObt = parseFloat(obtained);
    const marksMaxNum = parseFloat(maxMarks);
    if (isNaN(marksObt) || isNaN(marksMaxNum) || marksMaxNum <= 0) return;

    academic.addAssessment({
      subjectId,
      semesterId: 'sem-3',
      name: name.trim(),
      type,
      marksObtained: marksObt,
      marksMax: marksMaxNum,
      weightage: weight ? parseFloat(weight) : undefined,
      date: formatLocalDate(),
    });

    setName('');
    setObtained('');
    setMaxMarks('');
    setWeight('');
    setShowAdd(false);
  };

  return (
    <View style={styles.container}>
      {/* ─── Performance Summary Card ─── */}
      <GlassCard level="primary" style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryStat}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {perf.overallPercentage.toFixed(1)}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              OVERALL SCORE
            </Text>
          </View>

          <View style={styles.summaryStat}>
            <Text style={[styles.statValue, { color: brand.violet }]}>
              {perf.grade || '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              GRADE ({perf.gradePoints ?? 0} pts)
            </Text>
          </View>

          <View style={styles.summaryStat}>
            <Text style={[styles.statValue, { color: statusColors.safe }]}>
              {semGPA.sgpa.toFixed(2)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              SEM SGPA
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* ─── Assessments List ─── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          ASSESSMENTS ({perf.assessments.length})
        </Text>
        <Pressable onPress={() => setShowAdd(prev => !prev)}>
          <Text style={[styles.addLink, { color: brand.violet }]}>
            {showAdd ? 'Cancel' : '+ Add Assessment'}
          </Text>
        </Pressable>
      </View>

      {showAdd && (
        <GlassCard level="secondary" style={styles.addCard}>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
            placeholder="Assessment Name (e.g. Midterm 1)"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
          />

          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.inputHalf,
                {
                  color: colors.text,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
              placeholder="Marks Got"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              value={obtained}
              onChangeText={setObtained}
            />
            <TextInput
              style={[
                styles.inputHalf,
                {
                  color: colors.text,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
              placeholder="Max Marks"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              value={maxMarks}
              onChangeText={setMaxMarks}
            />
          </View>

          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
            placeholder="Weightage % (optional, e.g. 20)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
          />

          <Pressable onPress={handleAdd} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save Assessment</Text>
          </Pressable>
        </GlassCard>
      )}

      {perf.assessments.length === 0 ? (
        <GlassCard level="secondary" style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            No assessments recorded yet for this subject.
          </Text>
        </GlassCard>
      ) : (
        perf.assessments.map(a => {
          const pct = a.marksMax > 0 ? (a.marksObtained / a.marksMax) * 100 : 0;
          return (
            <GlassCard key={a.id} level="secondary" style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>
                    {a.name}
                  </Text>
                  <Text style={[styles.itemMeta, { color: colors.textTertiary }]}>
                    {a.type.toUpperCase()}{a.weightage ? ` · ${a.weightage}% weight` : ''} · {a.date}
                  </Text>
                </View>

                <View style={styles.scoreBox}>
                  <Text style={[styles.itemScore, { color: colors.text }]}>
                    {a.marksObtained}/{a.marksMax}
                  </Text>
                  <Text
                    style={[
                      styles.itemPct,
                      {
                        color:
                          pct >= 80
                            ? statusColors.safe
                            : pct >= 60
                            ? statusColors.watch
                            : statusColors.danger,
                      },
                    ]}
                  >
                    {pct.toFixed(0)}%
                  </Text>
                </View>
              </View>
            </GlassCard>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  summaryCard: {
    padding: spacing.base,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryStat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
  },
  addLink: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  addCard: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  inputHalf: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 12,
  },
  saveBtn: {
    backgroundColor: brand.violet,
    paddingVertical: 8,
    borderRadius: radii.sm,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    fontStyle: 'italic',
  },
  itemCard: {
    padding: spacing.base,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  itemMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  scoreBox: {
    alignItems: 'flex-end',
  },
  itemScore: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  itemPct: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
