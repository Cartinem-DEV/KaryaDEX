/**
 * KaryaDEX — Sprint Duel Game
 *
 * Real-time 60-second speed arithmetic duel against Sero (AI Rival).
 * Features:
 * - Vertical arithmetic layout
 * - Reliable timestamp-based countdown with AppState foreground/background synchronization
 * - Tactile numeric keypad with single-character backspace and clear
 * - Combo multiplier & accuracy calculation
 * - Safe integer division and positive arithmetic
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { typography, radii } from '@/constants/theme';
import { usePlaygroundStore } from '@/store/usePlaygroundStore';
import { usePlaygroundGuideStore } from '@/store/usePlaygroundGuideStore';
import type { MathQuestion } from '@/types/playground';
import {
  generateQuestion,
  handleNumpadInput,
  validateAnswer,
  calculateComboMultiplier,
} from '@/lib/playground/sprintDuelLogic';
import {
  GameIntroModal,
  GameGuideModal,
  InteractiveTutorialView,
  PracticeModeBanner,
} from '@/components/playground/guide';

interface SprintDuelGameProps {
  onFinish: (result: {
    score: number;
    opponentScore: number;
    accuracy: number;
    durationSeconds: number;
    isWin: boolean;
    isPractice?: boolean;
  }) => void;
  onQuit?: () => void;
  onExit?: () => void;
  isPractice?: boolean;
}

const MATCH_DURATION_SECONDS = 60;

export function SprintDuelGame({ onFinish, onQuit, onExit, isPractice }: SprintDuelGameProps) {
  const handleExit = onExit || onQuit || (() => {});
  const hapticsEnabled = usePlaygroundStore((s) => s.hapticsEnabled);

  // Guide and Tutorial Store
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
    if (!isTutorialCompleted('sprint_duel') && !isTutorialDismissed('sprint_duel')) {
      setIsIntroOpen(true);
    }
  }, [isTutorialCompleted, isTutorialDismissed]);

  // Pause duration tracking to prevent timer decrement while in guide/tutorial
  useEffect(() => {
    if (isPaused) {
      pauseStartRef.current = Date.now();
    } else if (pauseStartRef.current) {
      const pauseDuration = Date.now() - pauseStartRef.current;
      startTimeRef.current += pauseDuration;
      pauseStartRef.current = null;
    }
  }, [isPaused]);

  const [timeLeft, setTimeLeft] = useState(MATCH_DURATION_SECONDS);
  const [userScore, setUserScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [currentQ, setCurrentQ] = useState<MathQuestion>(generateQuestion);
  const [combo, setCombo] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [correctAttempts, setCorrectAttempts] = useState(0);
  const [isWrong, setIsWrong] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // References for reliable state access inside interval callbacks and event listeners
  const startTimeRef = useRef<number>(Date.now());
  const finishedRef = useRef<boolean>(false);
  const userScoreRef = useRef(userScore);
  const oppScoreRef = useRef(opponentScore);
  const totalAttemptsRef = useRef(totalAttempts);
  const correctAttemptsRef = useRef(correctAttempts);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    userScoreRef.current = userScore;
    oppScoreRef.current = opponentScore;
    totalAttemptsRef.current = totalAttempts;
    correctAttemptsRef.current = correctAttempts;
    onFinishRef.current = onFinish;
  }, [userScore, opponentScore, totalAttempts, correctAttempts, onFinish]);

  // Animations
  const tickScaleAnim = useRef(new Animated.Value(0)).current;
  const tickOpacityAnim = useRef(new Animated.Value(0)).current;
  const scoreBumpAnim = useRef(new Animated.Value(1)).current;
  const oppScoreBumpAnim = useRef(new Animated.Value(1)).current;

  // Sound/Haptic feedback helper
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

  const handleFinishMatch = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const finalUserScore = userScoreRef.current;
    const finalOppScore = oppScoreRef.current;
    const finalTotal = totalAttemptsRef.current;
    const finalCorrect = correctAttemptsRef.current;

    const isWin = finalUserScore >= finalOppScore;
    const accuracy =
      finalTotal > 0 ? Math.round((finalCorrect / finalTotal) * 100) : 0;

    onFinishRef.current({
      score: finalUserScore,
      opponentScore: finalOppScore,
      accuracy,
      durationSeconds: MATCH_DURATION_SECONDS,
      isWin,
      isPractice: isPracticeMode,
    });
  }, [isPracticeMode]);

  // Reliable Timestamp-based countdown timer
  useEffect(() => {
    startTimeRef.current = Date.now();
    finishedRef.current = false;

    const updateTimer = () => {
      if (finishedRef.current || isPausedRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, MATCH_DURATION_SECONDS - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        handleFinishMatch();
      }
    };

    // Run interval frequently to eliminate visual lag while remaining grounded in real time
    const timerInterval = setInterval(updateTimer, 250);

    // Synchronize timer on AppState changes (e.g. background to foreground)
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          updateTimer();
        }
      }
    );

    return () => {
      clearInterval(timerInterval);
      subscription.remove();
    };
  }, [handleFinishMatch]);

  // Opponent AI Simulation (Sero scores every 3.4 - 5.4s)
  useEffect(() => {
    if (timeLeft <= 0 || finishedRef.current || isPaused) return;

    const delay = Math.random() * 2000 + 3400;
    const oppTimer = setTimeout(() => {
      if (finishedRef.current || isPausedRef.current) return;
      setOpponentScore((s) => s + 1);
      Animated.sequence([
        Animated.timing(oppScoreBumpAnim, { toValue: 1.25, duration: 150, useNativeDriver: true }),
        Animated.timing(oppScoreBumpAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }, delay);

    return () => clearTimeout(oppTimer);
  }, [opponentScore, timeLeft, oppScoreBumpAnim]);

  // Handle keypad input
  const handleKeyPress = useCallback(
    (key: string) => {
      if (finishedRef.current || timeLeft <= 0) return;

      triggerHaptic('light');

      // Process input via pure logic handler (supports ⌫ backspace, C clear, 0-9 digits)
      const nextVal = handleNumpadInput(inputVal, key);
      setInputVal(nextVal);

      // Validate against current question
      const result = validateAnswer(currentQ, nextVal);

      if (result.isCorrect) {
        triggerHaptic('success');
        setIsCorrect(true);
        setTotalAttempts((a) => a + 1);
        setCorrectAttempts((c) => c + 1);
        setUserScore((s) => s + 1);
        setCombo((c) => c + 1);

        // Score bump animation
        Animated.sequence([
          Animated.timing(scoreBumpAnim, { toValue: 1.3, duration: 120, useNativeDriver: true }),
          Animated.timing(scoreBumpAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();

        // Tick popup animation
        tickScaleAnim.setValue(0.5);
        tickOpacityAnim.setValue(1);
        Animated.parallel([
          Animated.spring(tickScaleAnim, { toValue: 1.2, friction: 4, useNativeDriver: true }),
          Animated.timing(tickOpacityAnim, { toValue: 0, duration: 400, delay: 200, useNativeDriver: true }),
        ]).start();

        setTimeout(() => {
          setIsCorrect(false);
          setInputVal('');
          setCurrentQ(generateQuestion());
        }, 220);
      } else if (result.isWrong) {
        triggerHaptic('error');
        setIsWrong(true);
        setCombo(0);
        setTotalAttempts((a) => a + 1);

        setTimeout(() => {
          setIsWrong(false);
          setInputVal('');
        }, 350);
      }
    },
    [inputVal, currentQ, triggerHaptic, scoreBumpAnim, tickScaleAnim, tickOpacityAnim, timeLeft]
  );

  const comboInfo = calculateComboMultiplier(combo);

  if (isTutorialOpen) {
    return (
      <InteractiveTutorialView
        gameType="sprint_duel"
        onComplete={() => setIsTutorialOpen(false)}
        onExit={() => setIsTutorialOpen(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header: Player vs Opponent & 60s Timer & Help */}
      <View style={styles.header}>
        <Pressable
          onPress={handleExit}
          style={styles.quitButton}
          accessibilityRole="button"
          accessibilityLabel="Quit Duel"
        >
          <Feather name="x" size={20} color="#94A3B8" />
        </Pressable>

        {/* Player Left */}
        <View style={styles.playerColumn}>
          <View style={[styles.avatar, styles.youAvatar]}>
            <Text style={styles.avatarInitial}>YOU</Text>
          </View>
          <Animated.Text
            style={[styles.scoreText, { transform: [{ scale: scoreBumpAnim }] }]}
          >
            {userScore}
          </Animated.Text>
        </View>

        {/* Center Timer Pill */}
        <View style={styles.timerPill} accessibilityLabel={`Time left: ${timeLeft} seconds`}>
          <Ionicons name="timer-outline" size={14} color="#00D9FF" />
          <Text style={styles.timerText}>
            00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
          </Text>
        </View>

        {/* Opponent Right */}
        <View style={[styles.playerColumn, { alignItems: 'flex-end' }]}>
          <View style={[styles.avatar, styles.rivalAvatar]}>
            <Text style={styles.avatarInitial}>SERO</Text>
          </View>
          <Animated.Text
            style={[styles.scoreText, styles.oppScoreText, { transform: [{ scale: oppScoreBumpAnim }] }]}
          >
            {opponentScore}
          </Animated.Text>
        </View>

        {/* Header Help '?' Button */}
        <Pressable
          onPress={() => setIsGuideOpen(true)}
          style={styles.helpButton}
          accessibilityRole="button"
          accessibilityLabel="Open Sprint Duel Guide"
        >
          <Feather name="help-circle" size={20} color="#94A3B8" />
        </Pressable>
      </View>

      {/* Practice Mode Banner */}
      {isPracticeMode && (
        <PracticeModeBanner onExitPractice={handleExit} />
      )}

      {/* Combo Banner */}
      <View style={styles.comboRow}>
        {combo >= 2 ? (
          <View style={styles.comboBadge}>
            <Ionicons name="flame" size={14} color="#F59E0B" />
            <Text style={styles.comboText}>{comboInfo.label}</Text>
          </View>
        ) : (
          <Text style={styles.subHint}>Type rapidly to score against Sero</Text>
        )}
      </View>

      {/* Question Presentation Stage */}
      <View style={styles.stage}>
        {/* Animated Tick floating badge */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tickBadge,
            {
              transform: [{ scale: tickScaleAnim }],
              opacity: tickOpacityAnim,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={48} color="#B1FA63" />
        </Animated.View>

        {/* Vertical Stack: Arithmetic Expression */}
        <View style={styles.qStack}>
          <View style={styles.qRow}>
            <Text style={styles.opSlot}></Text>
            <Text style={styles.qNum}>{currentQ.top}</Text>
          </View>
          <View style={styles.qRow}>
            <Text style={styles.opSlot}>{currentQ.operator}</Text>
            <Text style={styles.qNum}>{currentQ.bottom}</Text>
          </View>
          <View style={styles.dividerLine} />
        </View>

        {/* Answer Display Box */}
        <View
          style={[
            styles.inputBox,
            isCorrect && styles.inputBoxCorrect,
            isWrong && styles.inputBoxWrong,
          ]}
          accessibilityLabel={`Current entered answer: ${inputVal || 'empty'}`}
        >
          <Text style={styles.inputValue}>
            {inputVal || <Text style={styles.placeholderText}>?</Text>}
          </Text>
          <View style={styles.blinkingCaret} />
        </View>
      </View>

      {/* Numeric Keypad with Clear and Backspace */}
      <View style={styles.keypad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['C', '0', '⌫'],
        ].map((row, rIdx) => (
          <View key={rIdx} style={styles.keypadRow}>
            {row.map((k) => (
              <Pressable
                key={k}
                onPress={() => handleKeyPress(k)}
                accessibilityRole="button"
                accessibilityLabel={
                  k === '⌫' ? 'Backspace' : k === 'C' ? 'Clear answer' : `Digit ${k}`
                }
                style={({ pressed }) => [
                  styles.keyButton,
                  pressed && styles.keyPressed,
                  k === '⌫' && styles.backKey,
                  k === 'C' && styles.clearKey,
                ]}
              >
                {k === '⌫' ? (
                  <Feather name="delete" size={20} color="#CBD5E1" />
                ) : k === 'C' ? (
                  <Text style={styles.clearKeyText}>C</Text>
                ) : (
                  <Text style={styles.keyText}>{k}</Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {/* First-Time Game Intro Modal */}
      <GameIntroModal
        visible={isIntroOpen}
        gameType="sprint_duel"
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
          dismissTutorial('sprint_duel');
        }}
      />

      {/* In-Game Help Guide Modal */}
      <GameGuideModal
        visible={isGuideOpen}
        gameType="sprint_duel"
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
  quitButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerColumn: {
    alignItems: 'flex-start',
    gap: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youAvatar: {
    backgroundColor: '#FF7A3D',
  },
  rivalAvatar: {
    backgroundColor: '#8B5CF6',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontWeight: typography.weights.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: typography.weights.heavy,
    color: '#B1FA63',
    minWidth: 32,
  },
  oppScoreText: {
    color: '#F43F5E',
    textAlign: 'right',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.25)',
  },
  timerText: {
    color: '#00D9FF',
    fontWeight: typography.weights.bold,
    fontSize: 15,
  },
  comboRow: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  comboText: {
    color: '#F59E0B',
    fontWeight: typography.weights.heavy,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  subHint: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 12,
  },
  tickBadge: {
    position: 'absolute',
    top: -20,
    zIndex: 10,
  },
  qStack: {
    alignItems: 'flex-end',
    width: 140,
  },
  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    marginVertical: 2,
  },
  opSlot: {
    fontSize: 32,
    color: '#94A3B8',
    fontWeight: typography.weights.bold,
    width: 32,
    textAlign: 'center',
    marginRight: 8,
  },
  qNum: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: typography.weights.heavy,
    letterSpacing: 2,
    minWidth: 80,
    textAlign: 'right',
  },
  dividerLine: {
    width: '100%',
    height: 3,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  inputBoxCorrect: {
    borderColor: '#B1FA63',
    backgroundColor: 'rgba(177, 250, 99, 0.1)',
  },
  inputBoxWrong: {
    borderColor: '#F43F5E',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  inputValue: {
    fontSize: 32,
    color: '#00D9FF',
    fontWeight: typography.weights.heavy,
    letterSpacing: 2,
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
  blinkingCaret: {
    width: 2,
    height: 24,
    backgroundColor: '#00D9FF',
    marginLeft: 4,
  },
  keypad: {
    paddingHorizontal: 12,
    gap: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  keyButton: {
    flex: 1,
    height: 54,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  keyPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ scale: 0.98 }],
  },
  backKey: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  clearKey: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  clearKeyText: {
    fontSize: 18,
    fontWeight: typography.weights.heavy,
    color: '#F59E0B',
  },
  keyText: {
    fontSize: 22,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
});
