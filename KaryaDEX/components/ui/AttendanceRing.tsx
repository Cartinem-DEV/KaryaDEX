/**
 * BunkMatKar — AttendanceRing Component
 * 
 * Circular progress indicator for attendance percentage with
 * refined typography, subtle track contrast, and status coloring.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { status, typography } from '@/constants/theme';
import type { AttendanceStatus } from '@/types';

interface AttendanceRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  attendanceStatus?: AttendanceStatus;
  showLabel?: boolean;
  label?: string;
}

export function AttendanceRing({
  percentage,
  size = 64,
  strokeWidth = 5,
  attendanceStatus,
  showLabel = true,
  label,
}: AttendanceRingProps) {
  const { colors, isDark } = useTheme();

  const progress = Math.min(Math.max(percentage, 0), 100);

  const getColor = () => {
    if (attendanceStatus === 'safe') return status.safe;
    if (attendanceStatus === 'watch') return status.watch;
    if (attendanceStatus === 'danger') return status.danger;
    if (percentage >= 80) return status.safe;
    if (percentage >= 75) return status.watch;
    return status.danger;
  };

  const ringColor = getColor();
  const trackColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background track */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: trackColor,
          },
        ]}
      />

      {/* Progress arc */}
      <View
        style={[
          styles.progressRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: ringColor,
            borderRightColor: progress > 25 ? ringColor : 'transparent',
            borderBottomColor: progress > 50 ? ringColor : 'transparent',
            borderLeftColor: progress > 75 ? ringColor : 'transparent',
            transform: [{ rotate: '-90deg' }],
          },
        ]}
      />

      {/* Center content */}
      <View style={styles.centerContent}>
        {showLabel && (
          <View style={styles.percentageRow}>
            <Text
              style={[
                styles.percentage,
                {
                  color: colors.text,
                  fontSize: Math.round(size * 0.24),
                },
              ]}
            >
              {Math.round(percentage)}
            </Text>
            <Text
              style={[
                styles.percentSign,
                {
                  color: colors.textTertiary,
                  fontSize: Math.round(size * 0.12),
                },
              ]}
            >
              %
            </Text>
          </View>
        )}
        {label && (
          <Text
            style={[
              styles.label,
              {
                color: colors.textTertiary,
                fontSize: Math.round(size * 0.1),
              },
            ]}
          >
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  progressRing: {
    position: 'absolute',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
  },
  percentage: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  percentSign: {
    fontWeight: '600',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 1,
    textTransform: 'uppercase',
  },
});
