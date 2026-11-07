/**
 * BunkMatKar — FocusAnalyticsView
 *
 * Liquid Glass statistics view displaying total focus sessions,
 * cumulative focus minutes, average focus score, and session type breakdown.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing, brand } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { useLockInStore } from '@/hooks/useLockInStore';

export function FocusAnalyticsView() {
  const { colors, isDark } = useTheme();
  const statistics = useLockInStore((s) => s.statistics);

  if (!statistics) {
    return (
      <GlassCard level="secondary" style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>Focus Analytics</Text>
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
          Complete sessions to unlock focus analytics and productivity insights.
        </Text>
      </GlassCard>
    );
  }

  const {
    totalSessions,
    totalFocusMinutes,
    averageFocusScore,
    completedSessions,
  } = statistics;

  const formatHours = (mins: number) => {
    const h = (mins / 60).toFixed(1);
    return `${h}h`;
  };

  return (
    <GlassCard level="secondary" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Feather
            name="bar-chart-2"
            size={18}
            color={isDark ? '#00E5FF' : brand.violet}
          />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Focus Analytics</Text>
      </View>

      <View style={styles.grid}>
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.statValue,
              { color: isDark ? '#00E5FF' : brand.violet, fontVariant: ['tabular-nums'] },
            ]}
          >
            {formatHours(totalFocusMinutes)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Focus</Text>
        </View>

        <View
          style={[
            styles.statCard,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.statValue,
              { color: colors.text, fontVariant: ['tabular-nums'] },
            ]}
          >
            {Math.round(averageFocusScore)}%
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Focus Score</Text>
        </View>

        <View
          style={[
            styles.statCard,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.statValue,
              { color: colors.text, fontVariant: ['tabular-nums'] },
            ]}
          >
            {completedSessions}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed</Text>
        </View>

        <View
          style={[
            styles.statCard,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.statValue,
              { color: colors.text, fontVariant: ['tabular-nums'] },
            ]}
          >
            {totalSessions}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Sessions</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radii.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 225, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.25)',
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.tight,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.base,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.tight,
    fontFamily: typography.fontFamilyMono,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
});