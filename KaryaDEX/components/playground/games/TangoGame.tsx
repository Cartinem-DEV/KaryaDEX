/**
 * KaryaDEX — Tango Logic Game
 *
 * Rules:
 * 1. Each row and column must contain an equal number of Suns (☀️) and Moons (🌙).
 * 2. No more than two identical symbols may be adjacent (NO 3 in a row/column).
 * 3. Equal '=' constraint: connected cells must be the SAME symbol.
 * 4. Opposite '×' constraint: connected cells must be OPPOSITE symbols.
 *
 * Controls:
 * - Tap an un-locked cell to cycle: Empty -> ☀️ -> 🌙 -> Empty.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { typography, radii } from '@/constants/theme';
import { usePlaygroundStore } from '@/store/usePlaygroundStore';
import { usePlaygroundGuideStore } from '@/store/usePlaygroundGuideStore';
import type { TangoPuzzle } from '@/types/playground';
import {
  findTangoViolations,
  checkTangoWin,
  type TangoSymbol,
} from '@/lib/playground/tangoLogic';
import { TANGO_CURATED_PUZZLES } from '@/lib/playground/generators/tangoGenerator';
import {
  GameIntroModal,
  GameGuideModal,
  InteractiveTutorialView,
  PracticeModeBanner,
} from '@/components/playground/guide';

interface TangoGameProps {
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

// Curated 6x6 Tango Puzzles with authentic verified constraints
const PLAYABLE_TANGO_PUZZLES: TangoPuzzle[] = [
  ...TANGO_CURATED_PUZZLES.easy,
  ...TANGO_CURATED_PUZZLES.medium,
  ...TANGO_CURATED_PUZZLES.hard,
];

export function TangoGame({ onFinish, onQuit, onExit, isPractice }: TangoGameProps) {
  const handleExit = onExit || onQuit || (() => {});
  const hapticsEnabled = usePlaygroundStore((s) => s.hapticsEnabled);
  const { width, height } = useWindowDimensions();

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
    if (!isTutorialCompleted('tango') && !isTutorialDismissed('tango')) {
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

  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const puzzle = PLAYABLE_TANGO_PUZZLES[puzzleIndex % PLAYABLE_TANGO_PUZZLES.length];
  const size = puzzle.size;
  const targetPerSymbol = size / 2;

  // Board state: Array of size x size
  const [board, setBoard] = useState<TangoSymbol[][]>(() => {
    const b: TangoSymbol[][] = Array.from({ length: size }, () =>
      Array(size).fill(null)
    );
    for (const g of puzzle.givens) {
      b[g.row][g.col] = g.value;
    }
    return b;
  });

  const startTimeRef = useRef<number>(Date.now());
  const finishedRef = useRef<boolean>(false);
  const [elapsedDisplay, setElapsedDisplay] = useState(0);

  // Reset board when puzzle changes
  useEffect(() => {
    const b: TangoSymbol[][] = Array.from({ length: size }, () =>
      Array(size).fill(null)
    );
    for (const g of puzzle.givens) {
      b[g.row][g.col] = g.value;
    }
    setBoard(b);
    startTimeRef.current = Date.now();
    finishedRef.current = false;
  }, [puzzle, size]);

  // Timer
  useEffect(() => {
    startTimeRef.current = Date.now();
    finishedRef.current = false;
    const t = setInterval(() => {
      setElapsedDisplay(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const triggerHaptic = useCallback(
    (type: 'light' | 'medium' | 'success') => {
      if (!hapticsEnabled || Platform.OS === 'web') return;
      try {
        if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    },
    [hapticsEnabled]
  );

  // Is cell given
  const isGiven = useCallback(
    (r: number, c: number) => {
      return puzzle.givens.some((g) => g.row === r && g.col === c);
    },
    [puzzle]
  );

  // Detect violations via pure logic engine
  const violations = useMemo(() => {
    return findTangoViolations(board, puzzle.constraints, size);
  }, [board, puzzle.constraints, size]);

  // Check win condition
  useEffect(() => {
    if (finishedRef.current) return;

    const isWon = checkTangoWin(board, puzzle.constraints, size);
    if (isWon) {
      finishedRef.current = true;
      triggerHaptic('success');
      const durationSeconds = Math.max(
        1,
        Math.floor((Date.now() - startTimeRef.current) / 1000)
      );
      const score = Math.max(50, 200 - durationSeconds * 2);

      setTimeout(() => {
        onFinish({
          score,
          durationSeconds,
          isWin: true,
          isPractice: isPracticeMode,
        });
      }, 500);
    }
  }, [board, puzzle.constraints, size, triggerHaptic, onFinish, isPracticeMode]);

  // Cell tap handler (Empty -> Sun -> Moon -> Empty)
  const handleCellPress = (r: number, c: number) => {
    if (isGiven(r, c) || finishedRef.current) return;

    triggerHaptic('light');

    setBoard((prev) => {
      const copy = prev.map((row) => [...row]);
      const current = copy[r][c];
      if (current === null) copy[r][c] = 'sun';
      else if (current === 'sun') copy[r][c] = 'moon';
      else copy[r][c] = null;
      return copy;
    });
  };

  // Reset board
  const handleReset = () => {
    triggerHaptic('medium');
    const b: TangoSymbol[][] = Array.from({ length: size }, () =>
      Array(size).fill(null)
    );
    for (const g of puzzle.givens) {
      b[g.row][g.col] = g.value;
    }
    setBoard(b);
  };

  // Find constraint between two cells
  const getConstraint = (r1: number, c1: number, r2: number, c2: number) => {
    return puzzle.constraints.find(
      (ct) =>
        (ct.row1 === r1 && ct.col1 === c1 && ct.row2 === r2 && ct.col2 === c2) ||
        (ct.row1 === r2 && ct.col1 === c2 && ct.row2 === r1 && ct.col2 === c1)
    );
  };

  // Responsive board sizing preventing overflow
  const maxBoardWidth = Math.min(width - 32, 380);
  const maxBoardHeight = Math.max(260, height * 0.5);
  const cellSize = Math.floor(Math.min(maxBoardWidth, maxBoardHeight) / size);

  if (isTutorialOpen) {
    return (
      <InteractiveTutorialView
        gameType="tango"
        onComplete={() => setIsTutorialOpen(false)}
        onExit={() => setIsTutorialOpen(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleExit}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Quit Game"
        >
          <Feather name="x" size={20} color="#94A3B8" />
        </Pressable>

        <Pressable
          onPress={() => setPuzzleIndex((p) => (p + 1) % PLAYABLE_TANGO_PUZZLES.length)}
          style={styles.headerCenter}
          accessibilityRole="button"
          accessibilityLabel="Switch Level"
        >
          <Text style={styles.gameTitle}>TANGO</Text>
          <Text style={styles.gameSub}>
            Level {puzzleIndex + 1} ({puzzle.id.includes('hard') ? 'Hard' : puzzle.id.includes('med') ? 'Medium' : 'Easy'}) • Tap
          </Text>
        </Pressable>

        <View style={styles.headerRightActions}>
          <Pressable
            onPress={() => setIsGuideOpen(true)}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Tango Guide"
          >
            <Feather name="help-circle" size={18} color="#94A3B8" />
          </Pressable>

          <Pressable
            onPress={handleReset}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Reset Board"
          >
            <Ionicons name="refresh" size={18} color="#94A3B8" />
          </Pressable>
        </View>
      </View>

      {/* Practice Mode Banner */}
      {isPracticeMode && (
        <PracticeModeBanner onExitPractice={handleExit} />
      )}

      {/* Rules Pill & Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statPill} accessibilityLabel={`Elapsed time: ${elapsedDisplay} seconds`}>
          <Ionicons name="time-outline" size={14} color="#00D9FF" />
          <Text style={styles.statText}>
            {Math.floor(elapsedDisplay / 60)}:
            {elapsedDisplay % 60 < 10 ? `0${elapsedDisplay % 60}` : elapsedDisplay % 60}
          </Text>
        </View>

        <View style={styles.statPill}>
          <Text style={styles.symbolRule}>☀️ {targetPerSymbol} / 🌙 {targetPerSymbol}</Text>
        </View>
      </View>

      {/* Tango 6x6 Grid Stage with Edge Clues */}
      <View style={styles.boardWrapper}>
        <View style={[styles.grid, { width: cellSize * size, height: cellSize * size }]}>
          {board.map((row, rIdx) => (
            <View key={rIdx} style={styles.row}>
              {row.map((cellValue, cIdx) => {
                const locked = isGiven(rIdx, cIdx);
                const hasError = violations.has(`${rIdx}-${cIdx}`);

                // Check horizontal constraint to right
                const hConstraint = cIdx < size - 1 ? getConstraint(rIdx, cIdx, rIdx, cIdx + 1) : null;
                // Check vertical constraint below
                const vConstraint = rIdx < size - 1 ? getConstraint(rIdx, cIdx, rIdx + 1, cIdx) : null;

                const labelDesc = locked
                  ? `Locked ${cellValue || 'empty'}`
                  : cellValue
                  ? `${cellValue}`
                  : 'Empty';

                return (
                  <View key={cIdx} style={{ position: 'relative' }}>
                    <Pressable
                      disabled={locked}
                      onPress={() => handleCellPress(rIdx, cIdx)}
                      accessibilityRole="button"
                      accessibilityLabel={`Row ${rIdx + 1}, Column ${cIdx + 1}: ${labelDesc}${
                        hasError ? ', Conflict' : ''
                      }`}
                      style={[
                        styles.cell,
                        { width: cellSize, height: cellSize },
                        locked && styles.cellGiven,
                        hasError && styles.cellViolation,
                      ]}
                    >
                      {cellValue === 'sun' && <Text style={styles.sunEmoji}>☀️</Text>}
                      {cellValue === 'moon' && <Text style={styles.moonEmoji}>🌙</Text>}
                    </Pressable>

                    {/* Edge Clue: Horizontal Right */}
                    {hConstraint && (
                      <View
                        style={[
                          styles.hClueBadge,
                          { top: cellSize / 2 - 10, left: cellSize - 10 },
                        ]}
                      >
                        <Text style={styles.clueText}>
                          {hConstraint.type === 'equal' ? '=' : '×'}
                        </Text>
                      </View>
                    )}

                    {/* Edge Clue: Vertical Down */}
                    {vConstraint && (
                      <View
                        style={[
                          styles.vClueBadge,
                          { top: cellSize - 10, left: cellSize / 2 - 10 },
                        ]}
                      >
                        <Text style={styles.clueText}>
                          {vConstraint.type === 'equal' ? '=' : '×'}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Guide / Instructions Footer */}
      <View style={styles.footerNote}>
        <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
        <Text style={styles.guideText}>
          Equal ☀️ & 🌙 per row/col. Max 2 adjacent. [=] must match, [×] must oppose.
        </Text>
      </View>

      {/* First-Time Game Intro Modal */}
      <GameIntroModal
        visible={isIntroOpen}
        gameType="tango"
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
          dismissTutorial('tango');
        }}
      />

      {/* In-Game Help Guide Modal */}
      <GameGuideModal
        visible={isGuideOpen}
        gameType="tango"
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
    color: '#F59E0B',
    fontSize: 18,
    fontWeight: typography.weights.heavy,
    letterSpacing: 2,
  },
  gameSub: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statText: {
    color: '#FFFFFF',
    fontWeight: typography.weights.bold,
    fontSize: 13,
  },
  symbolRule: {
    color: '#CBD5E1',
    fontWeight: typography.weights.bold,
    fontSize: 12,
  },
  boardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  grid: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cellGiven: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  cellViolation: {
    backgroundColor: 'rgba(244, 63, 94, 0.3)',
    borderColor: '#F43F5E',
  },
  sunEmoji: {
    fontSize: 20,
  },
  moonEmoji: {
    fontSize: 20,
  },
  hClueBadge: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  vClueBadge: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  clueText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: typography.weights.heavy,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  guideText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    flex: 1,
  },
});
