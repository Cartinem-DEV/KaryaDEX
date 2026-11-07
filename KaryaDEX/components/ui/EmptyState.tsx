/**
 * BunkMatKar — EmptyState Component
 * 
 * Refined empty states with glassmorphism backdrop,
 * embossed luminous vector icon badge, and zero emojis.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { typography, spacing, radii } from '@/constants/theme';
import { GlassCard } from './GlassCard';

interface EmptyStateProps {
  icon?: React.ReactNode;
  emoji?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, emoji, title, subtitle }: EmptyStateProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <GlassCard level="secondary" style={styles.card}>
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: isDark ? 'rgba(0, 229, 255, 0.12)' : 'rgba(124, 58, 237, 0.10)',
              borderColor: isDark ? 'rgba(0, 229, 255, 0.35)' : 'rgba(124, 58, 237, 0.25)',
            },
          ]}
        >
          {icon || (emoji ? <Text style={styles.emoji}>{emoji}</Text> : <Feather name="inbox" size={28} color={isDark ? '#00E5FF' : '#7C3AED'} />)}
        </View>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : colors.textSecondary }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : colors.textTertiary }]}>{subtitle}</Text>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xl,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
    borderRadius: radii['2xl'],
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 28,
  },
  title: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
    lineHeight: 22,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});
