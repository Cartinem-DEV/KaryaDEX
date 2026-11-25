/**
 * KaryaDEX — AttendanceForecastCard Component (Phase 6)
 *
 * Interactive What-If Attendance Simulator:
 * - Pure deterministic simulation based on canonical attendance formulas
 * - Miss N classes scenario (0..5)
 * - Attend N classes scenario (0..5)
 * - Projected percentage, status badge, safety margin
 * - Clear explanation of assumptions
 * - Fully accessible with stepper controls
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard, StatusBadge } from '@/components/ui';
import {
  calculatePercentage,
  getAttendanceStatus,
  projectAfterAbsence,
  projectAfterPresent,
  calculateSafeBunks,
  calculateRecoveryClasses,
} from '@/lib/attendance';

interface AttendanceForecastCardProps {
  subjectName?: string;
  subjectId?: string;
  attended: number;
  total: number;
  target?: number;
  onOpenIntelligence?: () => void;
}

export function AttendanceForecastCard({
  subjectName,
  subjectId,
  attended,
  total,
  target = 75,
  onOpenIntelligence,
}: AttendanceForecastCardProps) {
  const { colors, isDark } = useTheme();

  // Simulation mode: 'miss' or 'attend'
  const [mode, setMode] = useState<'miss' | 'attend'>('miss');
  const [simCount, setSimCount] = useState<number>(1);

  const currentPercentage = calculatePercentage(attended, total);
  const currentStatus = getAttendanceStatus(currentPercentage, target);
  const safeBunks = calculateSafeBunks(attended, total, target);
  const recoveryNeeded = calculateRecoveryClasses(attended, total, target);

  // Compute projected percentage based on simulated classes
  const projectedPercentage =
    total === 0
      ? 0
      : mode === 'miss'
      ? projectAfterAbsence(attended, total, simCount)
      : projectAfterPresent(attended, total, simCount);

  const projectedStatus = getAttendanceStatus(projectedPercentage, target);
  const projectedMargin = projectedPercentage - target;
  const delta = projectedPercentage - currentPercentage;

  return (
    <GlassCard level="secondary" style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>
            {subjectName ? `${subjectName} Simulator` : 'Attendance What-If'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Current: {currentPercentage.toFixed(1)}% (Target: {target}%)
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <StatusBadge variant={projectedStatus} size="md" />
          {onOpenIntelligence && (
            <Pressable
              onPress={onOpenIntelligence}
              style={{
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: radii.sm,
                backgroundColor: brand.violet + '20',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: brand.violet }}>
                Intelligence →
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Mode Selector (Miss vs Attend) */}
      <View style={styles.modeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Simulate missing classes"
          onPress={() => setMode('miss')}
          style={[
            styles.modeBtn,
            mode === 'miss' && {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)',
              borderColor: statusColors.danger,
            },
          ]}
        >
          <Text
            style={[
              styles.modeBtnText,
              { color: mode === 'miss' ? statusColors.danger : colors.textSecondary },
            ]}
          >
            If I miss classes
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Simulate attending classes"
          onPress={() => setMode('attend')}
          style={[
            styles.modeBtn,
            mode === 'attend' && {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)',
              borderColor: statusColors.safe,
            },
          ]}
        >
          <Text
            style={[
              styles.modeBtnText,
              { color: mode === 'attend' ? statusColors.safe : colors.textSecondary },
            ]}
          >
            If I attend classes
          </Text>
        </Pressable>
      </View>

      {/* Stepper Controls */}
      <View style={styles.stepperRow}>
        <Text style={[styles.stepperLabel, { color: colors.textSecondary }]}>
          Classes to {mode === 'miss' ? 'miss' : 'attend'}:
        </Text>
        <View style={styles.stepperControls}>
          {[1, 2, 3, 4, 5].map((n) => {
            const isSelected = simCount === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={`Simulate ${n} classes`}
                onPress={() => setSimCount(n)}
                style={[
                  styles.countBtn,
                  {
                    backgroundColor: isSelected
                      ? brand.violet
                      : isDark
                      ? 'rgba(255, 255, 255, 0.06)'
                      : 'rgba(0, 0, 0, 0.04)',
                    borderColor: isSelected
                      ? brand.violet
                      : isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.06)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countBtnText,
                    { color: isSelected ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Projection Display */}
      <View style={styles.resultBox}>
        <View style={styles.resultMain}>
          <Text style={[styles.projectedValue, { color: colors.text }]}>
            {projectedPercentage.toFixed(1)}%
          </Text>
          <Text
            style={[
              styles.deltaText,
              {
                color:
                  delta > 0
                    ? statusColors.safe
                    : delta < 0
                    ? statusColors.danger
                    : colors.textSecondary,
              },
            ]}
          >
            {delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
          </Text>
        </View>

        <Text style={[styles.marginNote, { color: colors.textSecondary }]}>
          {projectedMargin >= 0
            ? `✓ ${projectedMargin.toFixed(1)}% above target`
            : `⚠️ ${Math.abs(projectedMargin).toFixed(1)}% below target`}
        </Text>
      </View>

      {/* Safe Bunks / Recovery Summary */}
      <View style={styles.footerRow}>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          {safeBunks > 0
            ? `Safe bunks available: ${safeBunks}`
            : recoveryNeeded > 0
            ? `Classes needed to recover: ${recoveryNeeded}`
            : 'At target threshold'}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  modeBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stepperLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
  stepperControls: {
    flexDirection: 'row',
    gap: 6,
  },
  countBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  countBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  resultBox: {
    padding: spacing.sm,
    backgroundColor: 'rgba(124, 77, 255, 0.06)',
    borderRadius: radii.md,
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  resultMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  projectedValue: {
    fontSize: 26,
    fontWeight: '800',
  },
  deltaText: {
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
  marginNote: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  footerRow: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
  },
});
