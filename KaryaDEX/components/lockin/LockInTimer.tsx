/**
 * KaryaDEX — LockInTimer
 *
 * Liquid Glass focus countdown with a Reanimated 4 progress ring.
 * The ring animates on the UI thread via animated SVG strokeDashoffset.
 * Displays the current session's remaining time and exposes start / pause /
 * resume / abandon controls wired to the LockIn Zustand store.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing, brand, status } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { useLockInStore } from '@/hooks/useLockInStore';
import { AuthService } from '@/services/auth/authService';
import type { LockinExamPreset } from '@/types/lockin';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface LockInTimerProps {
  preset: LockinExamPreset | null;
}

const CIRCLE_SIZE = 252;
const STROKE_WIDTH = 12;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function LockInTimer({ preset }: LockInTimerProps) {
  const { colors, isDark } = useTheme();
  const reducedMotion = useReducedMotion();

  const currentSession = useLockInStore((s) => s.currentSession);
  const timerState = useLockInStore((s) => s.timerState);
  const startSession = useLockInStore((s) => s.startSession);
  const pauseSession = useLockInStore((s) => s.pauseSession);
  const resumeSession = useLockInStore((s) => s.resumeSession);
  const completeSession = useLockInStore((s) => s.completeSession);
  const abandonSession = useLockInStore((s) => s.abandonSession);
  const setConfigModalOpen = useLockInStore((s) => s.setConfigModalOpen);

  const [isBusy, setIsBusy] = useState(false);

  // Progress ring shared value (0..1). 1 = full, 0 = empty.
  const progress = useSharedValue(0);
  const [localRemaining, setLocalRemaining] = useState(0);
  const [label, setLabel] = useState('Focus Session');

  // Derive planned duration for ring / label
  const plannedSeconds = currentSession
    ? currentSession.plannedDurationMinutes * 60
    : preset
    ? preset.workDurationMinutes * 60
    : 25 * 60;

  // Keep a live elapsed clock for the numeric readout while the session is active
  useEffect(() => {
    if (timerState.status === 'active' && timerState.startedAt) {
      const startedAt = timerState.startedAt;
      const pausedDuration = timerState.totalPausedDuration || 0;
      const planned = timerState.plannedDurationSeconds;
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - startedAt) / 1000 - pausedDuration;
        const remaining = planned - elapsed;
        setLocalRemaining(Math.max(0, remaining));
      }, 250);
      return () => clearInterval(interval);
    }
    // Paused / idle: use the store's remaining seconds directly
    setLocalRemaining(timerState.remainingSeconds);
  }, [
    timerState.status,
    timerState.startedAt,
    timerState.plannedDurationSeconds,
    timerState.totalPausedDuration,
    timerState.remainingSeconds,
  ]);

  // Derive the label from session status
  useEffect(() => {
    if (currentSession) {
      switch (timerState.status) {
        case 'active':
          setLabel('Locked in');
          break;
        case 'paused':
          setLabel('Paused');
          break;
        case 'completed':
          setLabel('Session complete');
          break;
        default:
          setLabel('Ready to focus');
      }
    } else {
      setLabel('Ready to focus');
    }
  }, [currentSession, timerState.status]);

  // Map remaining -> progress and animate on the UI thread
  useEffect(() => {
    const next = plannedSeconds > 0 ? localRemaining / plannedSeconds : 0;
    progress.value = withTiming(Math.max(0, Math.min(1, next)), {
      duration: reducedMotion ? 0 : 500,
    });
  }, [localRemaining, plannedSeconds, progress, reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const handleStart = async () => {
    if (!preset) {
      setConfigModalOpen(true);
      return;
    }
    setIsBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const sessionType =
        preset.type === 'exam_prep'
          ? ('exam_prep' as const)
          : preset.type === 'deep_work'
          ? ('deep_work' as const)
          : ('focus' as const);
      const user = AuthService.getInstance().getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      await startSession({
        userId: user.id,
        sessionType,
        presetId: preset.id,
        plannedDurationMinutes: preset.workDurationMinutes,
        actualDurationMinutes: 0,
        focusScore: 100,
        status: 'active',
        startedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('[LockInTimer] Failed to start session:', error);
    } finally {
      setIsBusy(false);
    }
  };

  const handlePause = async () => {
    setIsBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await pauseSession();
    } finally {
      setIsBusy(false);
    }
  };

  const handleResume = async () => {
    setIsBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await resumeSession();
    } finally {
      setIsBusy(false);
    }
  };

  const handleComplete = async () => {
    setIsBusy(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await completeSession(95);
    } finally {
      setIsBusy(false);
    }
  };

  const handleAbandon = async () => {
    setIsBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await abandonSession();
    } finally {
      setIsBusy(false);
    }
  };

  const ringStroke = isDark ? '#00E5FF' : brand.violet;
  const trackStroke = isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(15, 23, 42, 0.06)';

  return (
    <GlassCard level="primary" style={styles.card}>
      {/* Ring */}
      <View style={styles.ringWrap}>
        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={RADIUS}
            stroke={trackStroke}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <AnimatedCircle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={RADIUS}
            stroke={ringStroke}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={0}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
          />
        </Svg>

        {/* Center readout */}
        <View style={styles.center} pointerEvents="none">
          <Text
            style={[
              styles.time,
              {
                color: isDark ? '#FFFFFF' : colors.text,
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {formatTime(localRemaining || timerState.remainingSeconds)}
          </Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {label}
          </Text>
          <Text style={[styles.presetName, { color: colors.textTertiary }]}>
            {preset ? preset.name : 'No preset selected'}
          </Text>
        </View>
      </View>

      {/* Controls */}
      {!currentSession || timerState.status === 'completed' ? (
        <View style={styles.primaryRow}>
          <Pressable
            accessibilityRole="button"
            onPress={handleStart}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: brand.violet,
                borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.9)',
              },
              pressed && { backgroundColor: brand.violetDark, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Feather name="play" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Start Session</Text>
          </Pressable>
        </View>
      ) : timerState.status === 'active' ? (
        <View style={styles.primaryRow}>
          <Pressable
            accessibilityRole="button"
            onPress={handlePause}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: isDark ? 'rgba(0,225,255,0.16)' : brand.violetSoft },
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Feather name="pause" size={18} color={isDark ? '#00E5FF' : brand.violet} />
            <Text style={[styles.primaryBtnText, { color: isDark ? '#00E5FF' : brand.violet }]}>
              Pause
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.primaryRow}>
          <Pressable
            accessibilityRole="button"
            onPress={handleResume}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: brand.violet },
              pressed && { backgroundColor: brand.violetDark, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Feather name="play" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Resume</Text>
          </Pressable>
        </View>
      )}

      {/* Secondary actions */}
      {currentSession && timerState.status !== 'completed' && (
        <View style={styles.secondaryRow}>
          <Pressable
            accessibilityRole="button"
            onPress={handleComplete}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: status.safeBg, borderColor: status.safeBorder },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Feather name="check" size={15} color={status.safe} />
            <Text style={[styles.secondaryText, { color: status.safe }]}>Complete</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handleAbandon}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: status.dangerBg, borderColor: status.dangerBorder },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Feather name="x" size={15} color={status.danger} />
            <Text style={[styles.secondaryText, { color: status.danger }]}>Abandon</Text>
          </Pressable>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.base,
    borderRadius: radii['2xl'],
  },
  ringWrap: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.tight,
    fontFamily: typography.fontFamilyMono,
  },
  label: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
  presetName: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  primaryRow: {
    marginTop: spacing.xl,
    width: '100%',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  secondaryText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});