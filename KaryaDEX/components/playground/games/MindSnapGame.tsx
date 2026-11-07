/**
 * KaryaDEX — MindSnap Game
 *
 * Fast cognitive working-memory sequence recall.
 * A 3x3 cyber matrix lights up in a sequence; the user must repeat it from memory.
 * Features:
 * - Managed timer lifecycle with zero memory leaks on unmount
 * - Consecutive identical pad flash differentiation
 * - Reduced-motion accessibility support
 * - Timestamp-based duration calculation
 * - Progressive difficulty & haptic pulse feedback
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { typography, radii } from '@/constants/theme';
import { usePlaygroundStore } from '@/store/usePlaygroundStore';
import { usePlaygroundGuideStore } from '@/store/usePlaygroundGuideStore';
import {
  generateInitialSequence,
  appendSequenceStep,
  evaluateInput,
  calculateMindSnapScore,
} from '@/lib/playground/mindSnapLogic';
import {
  GameIntroModal,
  GameGuideModal,
  InteractiveTutorialView,
  PracticeModeBanner,
} from '@/components/playground/guide';

interface MindSnapGameProps {
  onFinish: (result: {
    score: number;
    durationSeconds: number;
    isWin: boolean;
    isPractice?: boolean;
  }) => void;
  onQuit?: () => void;
  onExit?: () => void;
  isPractice?: boolean;
}

const PAD_COLORS = [
  '#00D9FF', // Cyan
  '#B1FA63', // Lime
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#38BDF8', // Sky
  '#10B981', // Emerald
  '#F43F5E', // Rose
  '#6366F1', // Indigo
];

export function MindSnapGame({ onFinish, onQuit, onExit, isPractice }: MindSnapGameProps) {
  const handleExit = onExit || onQuit || (() => {});
  const hapticsEnabled = usePlaygroundStore((s) => s.hapticsEnabled);
  const { width } = useWindowDimensions();

  // Guide & Tutorial Store
  const isTutorialCompleted = usePlaygroundGuideStore((s) => s.isTutorialCompleted);
  const isTutorialDismissed = usePlaygroundGuideStore((s) => s.isTutorialDismissed);
  const dismissTutorial = usePlaygroundGuideStore((s) => s.dismissTutorial);

  const [isIntroOpen, setIsIntroOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(isPractice ?? false);

  const isPaused = isIntroOpen || isGuideOpen || isTutorialOpen;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const pauseStartRef = useRef<number | null>(null);

  // First-time intro detection
  useEffect(() => {
    if (!isTutorialCompleted('mind_snap') && !isTutorialDismissed('mind_snap')) {
      setIsIntroOpen(true);
    }
  }, [isTutorialCompleted, isTutorialDismissed]);

  // Pause duration tracking
  useEffect(() => {
    if (isPaused) {
      pauseStartRef.current = Date.now();
    } else if (pauseStartRef.current) {
      const pauseDuration = Date.now() - pauseStartRef.current;
      startTimeRef.current += pauseDuration;
      pauseStartRef.current = null;
    }
  }, [isPaused]);

  const [sequence, setSequence] = useState<number[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [isShowingSequence, setIsShowingSequence] = useState(false);
  const [stage, setStage] = useState(1);
  const [statusText, setStatusText] = useState('Watch closely...');
  const [reduceMotion, setReduceMotion] = useState(false);

  // Managed Timer References
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const isMountedRef = useRef<boolean>(true);
  const isPlayingSeqRef = useRef<boolean>(false);
  const finishedRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(Date.now());
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Reduced motion query
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => setReduceMotion(enabled))
      .catch(() => {});
  }, []);

  // Safe timeout scheduler that tracks every handle and cancels cleanly
  const scheduleTimeout = useCallback(
    (callback: () => void, delayMs: number): ReturnType<typeof setTimeout> => {
      const id = setTimeout(() => {
        timersRef.current.delete(id);
        if (isMountedRef.current) {
          callback();
        }
      }, delayMs);
      timersRef.current.add(id);
      return id;
    },
    []
  );

  const clearAllScheduledTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current.clear();
  }, []);

  // Lifecycle cleanup
  useEffect(() => {
    isMountedRef.current = true;
    startTimeRef.current = Date.now();
    finishedRef.current = false;

    return () => {
      isMountedRef.current = false;
      isPlayingSeqRef.current = false;
      clearAllScheduledTimers();
    };
  }, [clearAllScheduledTimers]);

  const triggerHaptic = useCallback(
    (type: 'light' | 'medium' | 'error' | 'success') => {
      if (!hapticsEnabled || Platform.OS === 'web') return;
      try {
        if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else if (type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    },
    [hapticsEnabled]
  );

  // Sequence playback with distinct consecutive flash intervals
  const playSequence = useCallback(
    (seq: number[]) => {
      if (!isMountedRef.current) return;

      // Cancel any ongoing sequence playback to prevent overlapping flashes
      clearAllScheduledTimers();
      isPlayingSeqRef.current = true;

      setIsShowingSequence(true);
      setStatusText('Watch the pattern...');
      setPlayerIndex(0);
      setActivePad(null);

      const speed = Math.max(300, 520 - seq.length * 25);
      const blankDuration = 100;
      const litDuration = speed - blankDuration;

      seq.forEach((padIndex, idx) => {
        const startTime = idx * speed + 350;

        // Turn ON
        scheduleTimeout(() => {
          setActivePad(padIndex);
          setFlashKey((k) => k + 1);
          triggerHaptic('light');

          // Turn OFF
          scheduleTimeout(() => {
            setActivePad(null);

            // Last element completion
            if (idx === seq.length - 1) {
              scheduleTimeout(() => {
                isPlayingSeqRef.current = false;
                setIsShowingSequence(false);
                setStatusText('Your turn! Tap the sequence');
              }, 150);
            }
          }, litDuration);
        }, startTime);
      });
    },
    [clearAllScheduledTimers, scheduleTimeout, triggerHaptic]
  );

  // Start initial round
  useEffect(() => {
    const initialSeq = generateInitialSequence(3);
    setSequence(initialSeq);
    playSequence(initialSeq);
  }, [playSequence]);

  // Handle player pad tap
  const handlePadPress = (padIndex: number) => {
    if (isShowingSequence || isPlayingSeqRef.current || finishedRef.current) return;

    setActivePad(padIndex);
    setFlashKey((k) => k + 1);
    scheduleTimeout(() => setActivePad(null), 160);

    const evaluation = evaluateInput(sequence, playerIndex, padIndex);

    if (evaluation.isCorrect) {
      triggerHaptic('light');

      if (evaluation.isStageComplete) {
        // Stage completed!
        triggerHaptic('success');
        const nextStage = stage + 1;
        setStage(nextStage);
        setStatusText(`Stage ${stage} cleared! +${stage * 15} XP`);

        const newSeq = appendSequenceStep(sequence);
        setSequence(newSeq);

        scheduleTimeout(() => {
          playSequence(newSeq);
        }, 700);
      } else {
        setPlayerIndex(evaluation.nextIndex);
      }
    } else {
      // Mistake made
      triggerHaptic('error');
      setStatusText('Memory loop broke!');
      finishedRef.current = true;

      const durationSeconds = Math.max(
        1,
        Math.floor((Date.now() - startTimeRef.current) / 1000)
      );
      const { score, isWin } = calculateMindSnapScore(stage, durationSeconds);

      scheduleTimeout(() => {
        onFinishRef.current({
          score,
          durationSeconds,
          isWin,
          isPractice: isPracticeMode,
        });
      }, 600);
    }
  };

  const padSize = Math.min(84, Math.floor((width - 64) / 3));

  if (isTutorialOpen) {
    return (
      <InteractiveTutorialView
        gameType="mind_snap"
        onComplete={() => setIsTutorialOpen(false)}
        onExit={() => setIsTutorialOpen(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleExit}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Quit Game"
        >
          <Feather name="x" size={20} color="#94A3B8" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.gameTitle}>MINDSNAP</Text>
          <Text style={styles.gameSub}>Working Memory Blitz</Text>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable
            onPress={() => setIsGuideOpen(true)}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="MindSnap Guide"
          >
            <Feather name="help-circle" size={18} color="#94A3B8" />
          </Pressable>

          <View style={styles.stagePill} accessibilityLabel={`Stage ${stage}`}>
            <Text style={styles.stageText}>Stage {stage}</Text>
          </View>
        </View>
      </View>

      {/* Practice Mode Banner */}
      {isPracticeMode && (
        <PracticeModeBanner onExitPractice={handleExit} />
      )}

      {/* Status banner */}
      <View style={styles.statusRow}>
        <Text
          style={[styles.statusBanner, isShowingSequence && styles.statusBannerWatch]}
          accessibilityLiveRegion="polite"
        >
          {statusText}
        </Text>
      </View>

      {/* 3x3 Cyber Pad Matrix Stage */}
      <View style={styles.matrixWrapper}>
        <View style={styles.matrixGrid}>
          {Array.from({ length: 9 }).map((_, idx) => {
            const isLit = activePad === idx;
            const padColor = PAD_COLORS[idx];

            return (
              <Pressable
                key={`${idx}-${flashKey}`}
                disabled={isShowingSequence}
                onPress={() => handlePadPress(idx)}
                accessibilityRole="button"
                accessibilityLabel={`Pad ${idx + 1} of 9`}
                accessibilityState={{ disabled: isShowingSequence }}
                style={({ pressed }) => [
                  styles.pad,
                  { width: padSize, height: padSize },
                  isLit && {
                    backgroundColor: padColor,
                    borderColor: '#FFFFFF',
                    shadowColor: padColor,
                    shadowOpacity: 0.9,
                    shadowRadius: 16,
                    elevation: 10,
                    transform: reduceMotion ? [] : [{ scale: 1.05 }],
                  },
                  pressed && !isShowingSequence && styles.padPressed,
                ]}
              >
                <View
                  style={[
                    styles.padCore,
                    { backgroundColor: isLit ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)' },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Instructions footer */}
      <View style={styles.footerNote}>
        <Ionicons name="sparkles-outline" size={16} color="#EC4899" />
        <Text style={styles.guideText}>
          Repeat the flashing sequence to strengthen attention span.
        </Text>
      </View>

      {/* First-Time Game Intro Modal */}
      <GameIntroModal
        visible={isIntroOpen}
        gameType="mind_snap"
        onStartTutorial={() => {
          setIsIntroOpen(false);
          setIsTutorialOpen(true);
        }}
        onStartPractice={() => {
          setIsIntroOpen(false);
          setIsPracticeMode(true);
        }}
        onSkipAndPlay={() => {
          setIsIntroOpen(false);
          dismissTutorial('mind_snap');
        }}
      />

      {/* In-Game Help Guide Modal */}
      <GameGuideModal
        visible={isGuideOpen}
        gameType="mind_snap"
        onClose={() => setIsGuideOpen(false)}
        onLaunchTutorial={() => {
          setIsGuideOpen(false);
          setIsTutorialOpen(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D14',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  gameTitle: {
    color: '#00D9FF',
    fontSize: 18,
    fontWeight: typography.weights.heavy,
    letterSpacing: 2,
  },
  gameSub: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  stagePill: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.3)',
  },
  stageText: {
    color: '#00D9FF',
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  statusRow: {
    alignItems: 'center',
    marginVertical: 12,
  },
  statusBanner: {
    color: '#B1FA63',
    fontSize: 14,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  statusBannerWatch: {
    color: '#F59E0B',
  },
  matrixWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  matrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    gap: 12,
    justifyContent: 'center',
  },
  pad: {
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  padPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ scale: 0.95 }],
  },
  padCore: {
    width: 14,
    height: 14,
    borderRadius: radii.full,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(236, 72, 153, 0.08)',
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.2)',
  },
  guideText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    flex: 1,
  },
});
