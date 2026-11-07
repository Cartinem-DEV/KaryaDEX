/**
 * KaryaDEX — Interactive Tutorial View
 *
 * Provides a hands-on, action-based training sandbox for all 4 games.
 * Players perform actual game actions with immediate visual, auditory and haptic feedback.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { typography, radii, spacing } from '@/constants/theme';
import type { PlaygroundGameType } from '@/types/playground';
import { TUTORIAL_LESSONS } from '@/lib/playground/tutorials/tutorialLessons';
import { GAME_GUIDES } from '@/lib/playground/tutorials/guideContent';
import { usePlaygroundGuideStore } from '@/store/usePlaygroundGuideStore';

interface InteractiveTutorialViewProps {
  gameType: PlaygroundGameType;
  onComplete: () => void;
  onExit: () => void;
}

export function InteractiveTutorialView({
  gameType,
  onComplete,
  onExit,
}: InteractiveTutorialViewProps) {
  const lesson = TUTORIAL_LESSONS[gameType];
  const guide = GAME_GUIDES[gameType];
  const markCompleted = usePlaygroundGuideStore((s) => s.markTutorialCompleted);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Sprint Duel state
  const [sdInput, setSdInput] = useState('');

  // Queens 4x4 tutorial board: 4 colored regions
  // Region 0: (0,0), (0,1), (1,1)
  // Region 1: (0,2), (0,3), (1,2), (1,3)
  // Region 2: (1,0), (2,0), (2,1), (3,0), (3,1)
  // Region 3: (2,2), (2,3), (3,2), (3,3)
  const [queensBoard, setQueensBoard] = useState<('empty' | 'dot' | 'queen')[][]>([
    ['empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty'],
  ]);
  const queensRegions = [
    [0, 0, 1, 1],
    [2, 0, 1, 1],
    [2, 2, 3, 3],
    [2, 2, 3, 3],
  ];
  const queensColors = ['#0AB963', '#38BDF8', '#A855F7', '#FF761A'];

  // Tango 4x4 tutorial board
  const [tangoBoard, setTangoBoard] = useState<('empty' | 'sun' | 'moon')[][]>([
    ['sun', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'moon', 'empty'],
    ['empty', 'sun', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty'],
  ]);

  // MindSnap 3x3 tutorial state
  const [msActivePad, setMsActivePad] = useState<number | null>(null);
  const [msPhase, setMsPhase] = useState<'watch' | 'input'>('watch');
  const [msUserTaps, setMsUserTaps] = useState<number[]>([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // MindSnap preview flash sequence on step change
  useEffect(() => {
    if (gameType !== 'mind_snap') return;
    setMsPhase('watch');
    setMsUserTaps([]);
    const step = lesson.steps[currentStepIndex];

    if (currentStepIndex === 0) {
      // Step 1: Flash pad 4
      const t1 = setTimeout(() => setMsActivePad(4), 500);
      const t2 = setTimeout(() => {
        setMsActivePad(null);
        setMsPhase('input');
      }, 1300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else if (currentStepIndex === 1) {
      // Step 2: Flash pad 0 then pad 2
      const t1 = setTimeout(() => setMsActivePad(0), 400);
      const t2 = setTimeout(() => setMsActivePad(null), 900);
      const t3 = setTimeout(() => setMsActivePad(2), 1100);
      const t4 = setTimeout(() => {
        setMsActivePad(null);
        setMsPhase('input');
      }, 1600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    } else if (currentStepIndex === 2) {
      // Step 3: Flash pads 4 -> 7 -> 8
      const t1 = setTimeout(() => setMsActivePad(4), 400);
      const t2 = setTimeout(() => setMsActivePad(null), 800);
      const t3 = setTimeout(() => setMsActivePad(7), 1000);
      const t4 = setTimeout(() => setMsActivePad(null), 1400);
      const t5 = setTimeout(() => setMsActivePad(8), 1600);
      const t6 = setTimeout(() => {
        setMsActivePad(null);
        setMsPhase('input');
      }, 2000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
        clearTimeout(t6);
      };
    }
  }, [gameType, currentStepIndex, lesson.steps]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style).catch(() => {});
    }
  };

  const advanceStep = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setFeedbackMessage('Awesome! Step complete.');
    setTimeout(() => {
      setFeedbackMessage(null);
      if (currentStepIndex + 1 < lesson.steps.length) {
        setCurrentStepIndex((prev) => prev + 1);
        setSdInput('');
      } else {
        setIsCompleted(true);
      }
    }, 600);
  };

  // SPRINT DUEL INTERACTION HANDLER
  const handleSdNumpad = (digit: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const next = sdInput + digit;
    setSdInput(next);
    const step = lesson.steps[currentStepIndex];
    if (next === step.expectedPayload) {
      advanceStep();
    }
  };

  const handleSdBackspace = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSdInput((prev) => prev.slice(0, -1));
  };

  const handleSdClear = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setSdInput('');
  };

  // QUEENS INTERACTION HANDLER
  const handleQueensCellPress = (r: number, c: number) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const copy = queensBoard.map((row) => [...row]);
    const cur = copy[r][c];
    const nextState = cur === 'empty' ? 'dot' : cur === 'dot' ? 'queen' : 'empty';
    copy[r][c] = nextState;
    setQueensBoard(copy);

    const step = lesson.steps[currentStepIndex];
    if (step.id === 'q-step-1' && r === 0 && c === 1 && nextState === 'queen') {
      advanceStep();
    } else if (step.id === 'q-step-2' && r === 1 && c === 0 && nextState === 'dot') {
      advanceStep();
    } else if (step.id === 'q-step-3' && r === 1 && c === 3 && nextState === 'queen') {
      advanceStep();
    } else if (step.id === 'q-step-4') {
      // Check if (2,0) and (3,2) have queens
      if (copy[2][0] === 'queen' && copy[3][2] === 'queen') {
        advanceStep();
      }
    }
  };

  // TANGO INTERACTION HANDLER
  const handleTangoCellPress = (r: number, c: number) => {
    // Locked cells
    if ((r === 0 && c === 0) || (r === 1 && c === 2) || (r === 2 && c === 1)) return;

    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const copy = tangoBoard.map((row) => [...row]);
    const cur = copy[r][c];
    const nextVal = cur === 'empty' ? 'sun' : cur === 'sun' ? 'moon' : 'empty';
    copy[r][c] = nextVal;
    setTangoBoard(copy);

    const step = lesson.steps[currentStepIndex];
    if (step.id === 't-step-1' && r === 0 && c === 1 && nextVal === 'sun') {
      advanceStep();
    } else if (step.id === 't-step-2' && r === 0 && c === 2 && nextVal === 'moon') {
      advanceStep();
    } else if (step.id === 't-step-3' && r === 1 && c === 3 && nextVal === 'sun') {
      advanceStep();
    } else if (step.id === 't-step-4' && r === 0 && c === 3 && nextVal === 'moon') {
      advanceStep();
    }
  };

  // MINDSNAP INTERACTION HANDLER
  const handleMsPadPress = (padIdx: number) => {
    if (msPhase !== 'input') return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    const step = lesson.steps[currentStepIndex];
    if (step.id === 'ms-step-1') {
      if (padIdx === 4) {
        advanceStep();
      }
    } else if (step.id === 'ms-step-2') {
      const nextTaps = [...msUserTaps, padIdx];
      setMsUserTaps(nextTaps);
      if (nextTaps.length === 2) {
        if (nextTaps[0] === 0 && nextTaps[1] === 2) {
          advanceStep();
        } else {
          setMsUserTaps([]);
          setFeedbackMessage('Sequence mismatch. Watch again!');
          setTimeout(() => setFeedbackMessage(null), 1000);
        }
      }
    } else if (step.id === 'ms-step-3') {
      const nextTaps = [...msUserTaps, padIdx];
      setMsUserTaps(nextTaps);
      if (nextTaps.length === 3) {
        if (nextTaps[0] === 4 && nextTaps[1] === 7 && nextTaps[2] === 8) {
          advanceStep();
        } else {
          setMsUserTaps([]);
          setFeedbackMessage('Sequence mismatch. Try again!');
          setTimeout(() => setFeedbackMessage(null), 1000);
        }
      }
    }
  };

  const handleFinishTutorial = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    markCompleted(gameType);
    onComplete();
  };

  if (isCompleted) {
    return (
      <View style={styles.container}>
        <View style={styles.completedCard}>
          <View style={[styles.trophyCircle, { backgroundColor: `${guide.accentColor}20` }]}>
            <Ionicons name="trophy" size={48} color={guide.accentColor} />
          </View>
          <Text style={styles.completedTitle}>{lesson.completionTitle}</Text>
          <Text style={styles.completedBody}>{lesson.completionBody}</Text>

          <Pressable
            onPress={handleFinishTutorial}
            style={[styles.finishButton, { backgroundColor: guide.accentColor }]}
            accessibilityRole="button"
            accessibilityLabel="Complete Tutorial and Play"
          >
            <Text style={styles.finishButtonText}>Complete Tutorial & Play</Text>
            <Feather name="arrow-right" size={16} color="#000000" />
          </Pressable>
        </View>
      </View>
    );
  }

  const currentStep = lesson.steps[currentStepIndex];

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          onPress={onExit}
          style={styles.exitButton}
          accessibilityRole="button"
          accessibilityLabel="Exit Tutorial"
        >
          <Feather name="x" size={20} color="#94A3B8" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{lesson.title}</Text>
          <Text style={styles.stepCounter}>
            Step {currentStepIndex + 1} of {lesson.steps.length}
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* Instruction Card */}
      <Animated.View style={[styles.instructionCard, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.stepTitleRow}>
          <Ionicons name="school" size={16} color={guide.accentColor} />
          <Text style={[styles.stepTitle, { color: guide.accentColor }]}>
            {currentStep.title}
          </Text>
        </View>
        <Text style={styles.instructionText}>{currentStep.instruction}</Text>
        {currentStep.hint && (
          <Text style={styles.hintText}>💡 {currentStep.hint}</Text>
        )}
        {feedbackMessage && (
          <Text style={styles.feedbackSuccess}>{feedbackMessage}</Text>
        )}
      </Animated.View>

      {/* GAME SPECIFIC INTERACTIVE SANDBOX */}
      <View style={styles.sandboxArea}>
        {/* SPRINT DUEL SANDBOX */}
        {gameType === 'sprint_duel' && (
          <View style={styles.sdContainer}>
            <View style={styles.sdEquationCard}>
              <Text style={styles.sdEquationText}>
                {currentStepIndex === 0
                  ? '8 + 6 = ?'
                  : currentStepIndex === 1
                  ? '15 - 8 = ?'
                  : '6 × 7 = ?'}
              </Text>
              <View style={styles.sdInputBox}>
                <Text style={styles.sdInputVal}>{sdInput || '_'}</Text>
              </View>
            </View>

            {/* Numpad */}
            <View style={styles.sdNumpadGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <Pressable
                  key={`num-${n}`}
                  onPress={() => handleSdNumpad(String(n))}
                  style={styles.numpadKey}
                  accessibilityRole="button"
                  accessibilityLabel={`Key ${n}`}
                >
                  <Text style={styles.numpadText}>{n}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={handleSdClear}
                style={[styles.numpadKey, styles.actionKey]}
                accessibilityRole="button"
                accessibilityLabel="Clear input"
              >
                <Text style={styles.actionKeyText}>C</Text>
              </Pressable>
              <Pressable
                onPress={() => handleSdNumpad('0')}
                style={styles.numpadKey}
                accessibilityRole="button"
                accessibilityLabel="Key 0"
              >
                <Text style={styles.numpadText}>0</Text>
              </Pressable>
              <Pressable
                onPress={handleSdBackspace}
                style={[styles.numpadKey, styles.actionKey]}
                accessibilityRole="button"
                accessibilityLabel="Backspace"
              >
                <Feather name="delete" size={18} color="#94A3B8" />
              </Pressable>
            </View>
          </View>
        )}

        {/* QUEENS SANDBOX (4x4) */}
        {gameType === 'queens' && (
          <View style={styles.queensContainer}>
            <View style={styles.queensGrid4x4}>
              {queensBoard.map((row, r) => (
                <View key={`qr-${r}`} style={styles.gridRow}>
                  {row.map((cellState, c) => {
                    const regId = queensRegions[r][c];
                    const bg = queensColors[regId];
                    const isTarget =
                      (currentStep.id === 'q-step-1' && r === 0 && c === 1) ||
                      (currentStep.id === 'q-step-2' && r === 1 && c === 0) ||
                      (currentStep.id === 'q-step-3' && r === 1 && c === 3);

                    return (
                      <Pressable
                        key={`qc-${r}-${c}`}
                        onPress={() => handleQueensCellPress(r, c)}
                        style={[
                          styles.queensCell,
                          { backgroundColor: `${bg}33`, borderColor: bg },
                          isTarget && styles.targetHighlight,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Row ${r + 1}, Column ${c + 1}`}
                      >
                        {cellState === 'queen' && (
                          <MaterialCommunityIcons name="crown" size={26} color="#FFD700" />
                        )}
                        {cellState === 'dot' && (
                          <View style={styles.cellDot} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            <Text style={styles.sandboxHelper}>
              Tap once for Dot (•), twice for Queen (👑)
            </Text>
          </View>
        )}

        {/* TANGO SANDBOX (4x4) */}
        {gameType === 'tango' && (
          <View style={styles.tangoContainer}>
            <View style={styles.tangoGrid4x4}>
              {tangoBoard.map((row, r) => (
                <View key={`tr-${r}`} style={styles.gridRow}>
                  {row.map((val, c) => {
                    const isLocked =
                      (r === 0 && c === 0) || (r === 1 && c === 2) || (r === 2 && c === 1);
                    const isTarget =
                      (currentStep.id === 't-step-1' && r === 0 && c === 1) ||
                      (currentStep.id === 't-step-2' && r === 0 && c === 2) ||
                      (currentStep.id === 't-step-3' && r === 1 && c === 3) ||
                      (currentStep.id === 't-step-4' && r === 0 && c === 3);

                    return (
                      <Pressable
                        key={`tc-${r}-${c}`}
                        onPress={() => handleTangoCellPress(r, c)}
                        style={[
                          styles.tangoCell,
                          isLocked && styles.tangoCellLocked,
                          isTarget && styles.targetHighlight,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Row ${r + 1}, Column ${c + 1}`}
                      >
                        {val === 'sun' && <Text style={styles.symbolIcon}>☀️</Text>}
                        {val === 'moon' && <Text style={styles.symbolIcon}>🌙</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            <Text style={styles.sandboxHelper}>
              Tap cell to cycle: Empty → ☀️ → 🌙
            </Text>
          </View>
        )}

        {/* MINDSNAP SANDBOX (3x3) */}
        {gameType === 'mind_snap' && (
          <View style={styles.msContainer}>
            <View style={styles.msStatusBadge}>
              <Text style={styles.msStatusText}>
                {msPhase === 'watch' ? '👀 WATCH THE PATTERN' : '🎯 YOUR TURN: TAP THE TILES'}
              </Text>
            </View>

            <View style={styles.msGrid3x3}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((padIdx) => {
                const isLit = msActivePad === padIdx;
                return (
                  <Pressable
                    key={`msp-${padIdx}`}
                    onPress={() => handleMsPadPress(padIdx)}
                    style={[
                      styles.msPad,
                      isLit && styles.msPadLit,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Pad ${padIdx + 1}`}
                  >
                    <Text style={styles.msPadNumber}>{padIdx + 1}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  exitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: typography.weights.bold,
  },
  stepCounter: {
    color: '#00D9FF',
    fontSize: 12,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  instructionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(0, 217, 255, 0.25)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginVertical: 12,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: typography.weights.medium,
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
  },
  feedbackSuccess: {
    color: '#B1FA63',
    fontSize: 12,
    fontWeight: typography.weights.bold,
    marginTop: 8,
  },
  sandboxArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sdContainer: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  sdEquationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  sdEquationText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: typography.weights.bold,
  },
  sdInputBox: {
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    borderColor: '#00D9FF',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  sdInputVal: {
    color: '#00D9FF',
    fontSize: 22,
    fontWeight: typography.weights.bold,
  },
  sdNumpadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 250,
    gap: 10,
    justifyContent: 'center',
  },
  numpadKey: {
    width: 70,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: typography.weights.bold,
  },
  actionKey: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  actionKeyText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: typography.weights.bold,
  },
  queensContainer: {
    alignItems: 'center',
  },
  queensGrid4x4: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  gridRow: {
    flexDirection: 'row',
  },
  queensCell: {
    width: 64,
    height: 64,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    opacity: 0.8,
  },
  targetHighlight: {
    borderColor: '#00D9FF',
    borderWidth: 3,
  },
  sandboxHelper: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 16,
  },
  tangoContainer: {
    alignItems: 'center',
  },
  tangoGrid4x4: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tangoCell: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tangoCellLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  symbolIcon: {
    fontSize: 28,
  },
  msContainer: {
    alignItems: 'center',
  },
  msStatusBadge: {
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    borderColor: 'rgba(0, 217, 255, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radii.full,
    marginBottom: 24,
  },
  msStatusText: {
    color: '#00D9FF',
    fontSize: 12,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  msGrid3x3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 250,
    gap: 12,
    justifyContent: 'center',
  },
  msPad: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msPadLit: {
    backgroundColor: '#00D9FF',
    borderColor: '#FFFFFF',
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 8,
  },
  msPadNumber: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: typography.weights.bold,
  },
  completedCard: {
    alignItems: 'center',
    padding: 24,
    marginTop: 60,
  },
  trophyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  completedTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: typography.weights.bold,
    marginBottom: 8,
    textAlign: 'center',
  },
  completedBody: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 320,
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
  },
  finishButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: typography.weights.bold,
  },
});
