/**
 * KaryaDEX — SectionHeader Component
 * 
 * Clean section title with subtitle and optional action button.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, subtitle, actionLabel, onAction }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
        )}
      </View>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && { opacity: 0.75 },
          ]}
        >
          <Text style={[styles.action, { color: brand.violet }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs + 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  actionBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  action: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.semibold,
  },
});
