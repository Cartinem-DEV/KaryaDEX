/**
 * BunkMatKar — Match Summary Modal
 *
 * Celebrates victories & shows detailed feedback after brain sessions:
 * - XP earned
 * - ELO Rating changes
 * - Matrix Escape streak progress
 * - Accuracy & speed
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { typography, radii, brand } from '@/constants/theme';
import type { PlaygroundGameType, MatchRecord } from '@/types/playground';
import { lockinPlaygroundBridge } from '@/lib/lockin/lockinPlaygroundBridge';

export interface MatchSummaryModalProps {
  visible: boolean;
  record?: MatchRecord | null;
  gameType?: PlaygroundGameType;
  isWin?: boolean;
  score?: number;
  opponentScore?: number;
  accuracy?: number;
  durationSeconds?: number;
  xpEarned?: number;
  ratingDelta?: number;
  newRating?: number;
  isBreakSession?: boolean;
  remainingBreakSeconds?: number;
  isRejectedDueToDeadline?: boolean;
  onReturnToLockin?: () => void;
  onPlayAgain: () => void;
  onClose: () => void;
}

const GAME_NAMES: Record<PlaygroundGameType, string> = {
  sprint_duel: 'Sprint Duel',
  queens: 'Queens Logic',
  tango: 'Tango Logic',
  mind_snap: 'MindSnap Blitz',
};

export function MatchSummaryModal({
  visible,
  record,
  gameType,
  isWin,
  score,
  opponentScore,
  durationSeconds,
  xpEarned,
  ratingDelta,
  newRating,
  isBreakSession,
  remainingBreakSeconds,
  isRejectedDueToDeadline,
  onReturnToLockin,
  onPlayAgain,
  onClose,
}: MatchSummaryModalProps) {
  const effectiveGameType: PlaygroundGameType =
    record?.gameType ?? gameType ?? 'sprint_duel';
  const effectiveIsWin = record?.isWin ?? isWin ?? false;
  const effectiveScore = record?.score ?? score ?? 0;
  const effectiveOpponentScore = record?.opponentScore ?? opponentScore;
  const effectiveDuration = record?.durationSeconds ?? durationSeconds ?? 60;
  const effectiveXp = record?.xpEarned ?? xpEarned ?? 50;
  const effectiveDelta = record?.ratingDelta ?? ratingDelta ?? 0;
  const displayRating = newRating ?? 1200 + effectiveDelta;

  // Determine LockIn break status and replay restriction (<90s)
  const isBreakActive = isBreakSession ?? lockinPlaygroundBridge.isBreakActive();
  const effectiveRemainingSeconds =
    remainingBreakSeconds !== undefined
      ? remainingBreakSeconds
      : isBreakActive
      ? lockinPlaygroundBridge.getRemainingBreakSeconds()
      : Infinity;

  const isReplayDisabled = isBreakActive && effectiveRemainingSeconds < 90;
  const replayNoticeMessage = `Less than 90 seconds remaining (${Math.max(
    0,
    effectiveRemainingSeconds
  )}s). Replay unavailable. Return to LockIn to resume focus.`;

  const isRejected = isRejectedDueToDeadline || (record && record.xpEarned === 0 && effectiveXp === 0 && isBreakActive && effectiveDelta === 0 && !effectiveIsWin);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Banner */}
          <View style={[styles.headerBanner, effectiveIsWin ? styles.winBanner : styles.defeatBanner]}>
            <Ionicons
              name={effectiveIsWin ? 'trophy' : 'shield-outline'}
              size={36}
              color={effectiveIsWin ? '#B1FA63' : '#F59E0B'}
            />
            <Text style={styles.bannerTitle}>
              {effectiveIsWin ? 'MATRIX ESCAPE VICTORY!' : 'BRAIN REWIRED'}
            </Text>
            <Text style={styles.bannerSub}>
              {GAME_NAMES[effectiveGameType]} completed
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Score</Text>
              <Text style={styles.statValue}>
                {effectiveScore}
                {effectiveOpponentScore !== undefined && (
                  <Text style={styles.oppSub}> vs {effectiveOpponentScore}</Text>
                )}
              </Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>XP Gained</Text>
              <Text style={[styles.statValue, { color: '#B1FA63' }]}>
                +{effectiveXp} XP
              </Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Rating</Text>
              <Text style={[styles.statValue, { color: effectiveDelta >= 0 ? '#00D9FF' : '#EF4444' }]}>
                {displayRating} ({effectiveDelta >= 0 ? `+${effectiveDelta}` : effectiveDelta})
              </Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Time</Text>
              <Text style={styles.statValue}>
                {Math.floor(effectiveDuration / 60)}m {effectiveDuration % 60}s
              </Text>
            </View>
          </View>

          {/* Matrix Anti-Doomscroll message */}
          <View style={styles.antiDoomscrollCard}>
            <Ionicons name="sparkles" size={16} color="#B1FA63" />
            <Text style={styles.antiDoomscrollText}>
              You just saved ~15 mins from social media doomscrolling and fired up real neuroplasticity!
            </Text>
          </View>

          {/* Deadline Expiry Warning */}
          {isRejected && (
            <View style={styles.deadlineWarningBanner} testID="match-summary-deadline-rejected">
              <Feather name="alert-triangle" size={16} color="#EF4444" />
              <Text style={styles.deadlineWarningText}>
                Break ended before completion. Progression rewards (XP/rating/streak) were not awarded.
              </Text>
            </View>
          )}

          {/* Replay Notice if restricted (<90s remaining) */}
          {isReplayDisabled && (
            <View style={styles.restrictedNotice} testID="match-summary-replay-restricted">
              <Feather name="clock" size={14} color="#F59E0B" />
              <Text style={styles.restrictedNoticeText}>
                {replayNoticeMessage}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionButtons}>
            <Pressable
              onPress={isReplayDisabled ? undefined : onPlayAgain}
              disabled={isReplayDisabled}
              style={[
                styles.button,
                styles.primaryButton,
                isReplayDisabled && styles.disabledButton,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: isReplayDisabled }}
              testID="match-summary-play-again"
            >
              <Ionicons
                name="play"
                size={18}
                color={isReplayDisabled ? 'rgba(255, 255, 255, 0.4)' : '#05070B'}
              />
              <Text
                style={[
                  styles.primaryButtonText,
                  isReplayDisabled && styles.disabledButtonText,
                ]}
              >
                Play Again
              </Text>
            </Pressable>

            {onReturnToLockin ? (
              <Pressable
                onPress={onReturnToLockin}
                style={[styles.button, styles.lockinButton]}
                accessibilityRole="button"
                testID="match-summary-back-to-lockin"
              >
                <Ionicons name="arrow-back" size={18} color="#00D9FF" />
                <Text style={styles.lockinButtonText}>Back to LockIn</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onClose}
                style={[styles.button, styles.secondaryButton]}
                accessibilityRole="button"
                testID="match-summary-back-to-hub"
              >
                <Text style={styles.secondaryButtonText}>Back to Hub</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 11, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#121722',
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },
  headerBanner: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: radii.lg,
    marginBottom: 16,
  },
  winBanner: {
    backgroundColor: 'rgba(177, 250, 99, 0.12)',
    borderColor: 'rgba(177, 250, 99, 0.35)',
    borderWidth: 1,
  },
  defeatBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: typography.weights.heavy,
    letterSpacing: 1.5,
    marginTop: 6,
  },
  bannerSub: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  statsContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#182030',
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: typography.weights.medium,
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: typography.weights.heavy,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  oppSub: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: typography.weights.regular,
  },
  antiDoomscrollCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(177, 250, 99, 0.08)',
    borderColor: 'rgba(177, 250, 99, 0.25)',
    borderWidth: 1,
    padding: 12,
    borderRadius: radii.md,
    marginVertical: 14,
    width: '100%',
  },
  antiDoomscrollText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: typography.weights.medium,
  },
  actionButtons: {
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
  button: {
    height: 48,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#B1FA63',
  },
  primaryButtonText: {
    color: '#05070B',
    fontSize: 15,
    fontWeight: typography.weights.bold,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: typography.weights.medium,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  disabledButtonText: {
    color: 'rgba(255, 255, 255, 0.35)',
  },
  lockinButton: {
    backgroundColor: 'rgba(0, 217, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 217, 255, 0.4)',
  },
  lockinButtonText: {
    color: '#00D9FF',
    fontSize: 15,
    fontWeight: typography.weights.bold,
  },
  restrictedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    padding: 10,
    borderRadius: radii.md,
    marginBottom: 8,
    width: '100%',
  },
  restrictedNoticeText: {
    flex: 1,
    color: '#F59E0B',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: typography.weights.medium,
  },
  deadlineWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    padding: 10,
    borderRadius: radii.md,
    marginBottom: 8,
    width: '100%',
  },
  deadlineWarningText: {
    flex: 1,
    color: '#EF4444',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: typography.weights.medium,
  },
});
