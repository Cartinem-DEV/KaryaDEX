/**
 * KaryaDEX — Onboarding Progress Bar Component
 *
 * Displays current step title, step count (e.g. Step 3 of 9),
 * and a smooth amber-to-cyan gradient progress indicator with
 * luminous glow, specular reflection, and obsidian glass housing.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/constants/ThemeContext';
import { radii } from '@/constants/theme';

interface OnboardingProgressBarProps {
  currentStepIndex: number;
  totalSteps: number;
  stepTitle: string;
  forceDark?: boolean;
}

export function OnboardingProgressBar({
  currentStepIndex,
  totalSteps,
  stepTitle,
  forceDark = true,
}: OnboardingProgressBarProps) {
  const { colors, isDark: themeIsDark } = useTheme();
  const isDark = forceDark || themeIsDark;
  const progressPercent = Math.min(100, Math.max(0, (currentStepIndex / totalSteps) * 100));

  return (
    <View style={styles.container}>
      {/* Frosted Glass Capsule */}
      <View
        style={[
          styles.capsule,
          {
            backgroundColor: isDark ? 'rgba(10, 15, 26, 0.78)' : colors.glassPrimary,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.glassPrimaryBorder,
            ...(Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                } as any)
              : {}),
          },
        ]}
      >
        {/* Specular Highlight Line */}
        <View style={styles.specularLine} pointerEvents="none" />

        <View style={styles.textRow}>
          <Text style={[styles.stepCount, { color: isDark ? '#00E5FF' : colors.textSecondary }]}>
            Step {currentStepIndex} of {totalSteps}
          </Text>
          <Text style={[styles.stepTitle, { color: isDark ? '#FFFFFF' : colors.text }]}>
            {stepTitle}
          </Text>
        </View>

        {/* Track with glow */}
        <View
          style={[
            styles.track,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          <LinearGradient
            colors={['#F59E0B', '#00E5FF']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[
              styles.fill,
              {
                width: `${progressPercent}%`,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  capsule: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.xl,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  specularLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  textRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  stepCount: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  track: {
    height: 6,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.full,
  },
});
