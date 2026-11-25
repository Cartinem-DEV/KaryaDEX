/**
 * KaryaDEX — StreakCard
 *
 * Liquid Glass streak visualization showing current daily streak,
 * longest streak, total sessions, and total focus minutes.
 * Includes animated flame icon when streak is active.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ReactElement } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing, brand, status } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { useLockInStore } from '@/hooks/useLockInStore';
import type { LockinStreak } from '@/types/lockin';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface StreakCardProps {
  streakType?: LockinStreak['streakType'];
}

function getStreakIcon(hasStreak: boolean): ReactElement {
  return (
    <Svg width={28} height={32} viewBox="0 0 24 28" fill="none">
      {/* Flame path */}
      <Path
        d="M12 26C12 26 7 18 7 12C7 7.58 10.58 4 15 4C17.7 4 19.5 5.5 19.5 7.5C21 7.5 21 10 21 10C21 10 23 12 19 14C15 16 12 26 12 26Z"
        fill="#F59E0B"
        opacity={hasStreak ? 1 : 0.25}
      />
      {/* Inner flame */}
      <Path
        d="M12 24C12 24 8.5 17 8.5 12C8.5 8.5 11 6 14.5 6C16.2 6 17.5 7.2 17.5 8.5C18.2 8.5 18.5 9.5 18.5 9.5C18.5 9.5 19.5 11 16.5 12C13.5 13 12 24 12 24Z"
        fill="#FBBF24"
        opacity={hasStreak ? 1 : 0.2}
      />
    </Svg>
  );
}

export function StreakCard({ streakType = 'daily' }: StreakCardProps) {
  const { colors, isDark } = useTheme();
  const reducedMotion = useReducedMotion();

  const streaks = useLockInStore((s) => s.streaks);
  const streak = streaks[streakType] || null;

  // Animated flame pulse when streak > 0
  const pulse = useSharedValue(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (streak && streak.currentStreak > 0 && !reducedMotion) {
      if (!isAnimating) {
        setIsAnimating(true);
        pulse.value = withTiming(1, { duration: 1200, easing: (t) => t }, () => {
          pulse.value = withTiming(0, { duration: 1200, easing: (t) => t }, () => {
            // Restart loop
            pulse.value = withTiming(1, { duration: 1200, easing: (t) => t });
          });
        });
      }
    } else {
      pulse.value = 0;
      setIsAnimating(false);
    }
  }, [streak, reducedMotion, pulse, isAnimating]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + 0.4 * pulse.value,
    transform: [{ scale: 1 + 0.06 * pulse.value }],
  }));

  if (!streak) {
    return (
      <GlassCard level="secondary" style={styles.card}>
        <View style={styles.emptyWrap}>
          <View style={styles.flameWrap}>
            <Svg width={40} height={46} viewBox="0 0 24 28" fill="none">
              <Path
                d="M12 26C12 26 7 18 7 12C7 7.58 10.58 4 15 4C17.7 4 19.5 5.5 19.5 7.5C21 7.5 21 10 21 10C21 10 23 12 19 14C15 16 12 26 12 26Z"
                fill="rgba(245, 158, 11, 0.15)"
              />
            </Svg>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No streak yet</Text>
          <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
            Complete a focus session to start your {streakType} streak
          </Text>
        </View>
      </GlassCard>
    );
  }

  const { currentStreak, longestStreak, totalSessions, totalFocusMinutes, averageFocusScore } = streak;
  const hasStreak = currentStreak > 0;

  // Format minutes as hours/minutes
  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <GlassCard level="secondary" style={styles.card}>
      <View style={styles.header}>
        <Animated.View style={[styles.flameWrap, pulseStyle]}>
          {getStreakIcon(hasStreak)}
        </Animated.View>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.text }]}>
            {streakType.charAt(0).toUpperCase() + streakType.slice(1)} Streak
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {hasStreak ? `${currentStreak} day${currentStreak !== 1 ? 's' : ''} strong` : 'Start your first session'}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={[styles.statValue, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
            {currentStreak}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Current</Text>
        </View>
        <View style={[styles.statCol, styles.statDivider]}>
          <Text style={[styles.statValue, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
            {longestStreak}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Best</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={[styles.statValue, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
            {totalSessions}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Sessions</Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <View style={styles.detailItem}>
          <Feather
            name="clock"
            size={14}
            color={isDark ? '#00E5FF' : brand.violet}
          />
          <Text style={[styles.detailText, { color: colors.text }]}>
            {formatMinutes(totalFocusMinutes)} total focus
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Feather
            name="target"
            size={14}
            color={isDark ? '#00E5FF' : brand.violet}
          />
          <Text style={[styles.detailText, { color: colors.text }]}>
            Avg focus {Math.round(averageFocusScore)}%
          </Text>
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
  },
  flameWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.md,
  },
  emptySub: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(255,255,255,0.10)',
  },
  statValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.tight,
    fontFamily: typography.fontFamilyMono,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});