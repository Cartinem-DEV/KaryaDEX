/**
 * KaryaDEX — StatusBadge Component
 * 
 * Refined translucent glass pill badge for SAFE / WATCH / DANGER states.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { status, radii, typography, spacing } from '@/constants/theme';
import type { AttendanceStatus } from '@/types';

interface StatusBadgeProps {
  variant: AttendanceStatus;
  label?: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG = {
  safe: {
    bg: status.safeGlass,
    border: status.safeBorder,
    color: status.safe,
    label: 'SAFE',
  },
  watch: {
    bg: status.watchGlass,
    border: status.watchBorder,
    color: status.watch,
    label: 'WATCH',
  },
  danger: {
    bg: status.dangerGlass,
    border: status.dangerBorder,
    color: status.danger,
    label: 'DANGER',
  },
};

export function StatusBadge({ variant, label, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[variant];
  const displayLabel = label || config.label;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25)',
              } as any)
            : {}),
        },
        size === 'md' && styles.badgeMd,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text
        style={[
          styles.label,
          { color: config.color },
          size === 'md' && styles.labelMd,
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    gap: 5,
  },
  badgeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.wide,
  },
  labelMd: {
    fontSize: typography.sizes.xs,
  },
});
