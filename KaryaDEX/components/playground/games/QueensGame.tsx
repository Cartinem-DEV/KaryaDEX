/**
 * KaryaDEX — Queens Logic Game
 *
 * Rules:
 * 1. Place exactly ONE Queen in each row.
 * 2. Place exactly ONE Queen in each column.
 * 3. Place exactly ONE Queen in each colored territory.
 * 4. No two Queens may touch — not even diagonally!
 *
 * Accessibility & Design:
 * - High-contrast territory borders & unique letter identifiers (A-H)
 * - Screen reader friendly cell descriptions
 * - Responsive sizing preventing overflow on compact devices
 * - Timestamp-based duration calculation
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
import type { QueensPuzzle } from '@/types/playground';
import {
  findQueensConflicts,
  checkQueensWin,
  getTerritoryBorderOffsets,
  getTerritoryIdentifier,
  type QueensCellState,
} from '@/lib/playground/queensLogic';
import { QUEENS_CURATED_PUZZLES } from '@/lib/playground/generators/queensGenerator';
import {
  GameIntroModal,
  GameGuideModal,
  InteractiveTutorialView,
  PracticeModeBanner,
} from '@/components/playground/guide';

interface QueensGameProps {
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

// Accessible high-contrast territory colors
const REGION_COLORS = [
  '#0AB963', // emerald
  '#38BDF8', // sky
  '#FF761A', // orange
  '#A855F7', // purple
  '#EAB308', // gold
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F43F5E', // rose
];

// Verified uniquely solvable curated puzzles across sizes 5, 6, 7, 8
const QUEENS_PUZZLES: QueensPuzzle[] = [
  ...QUEENS_CURATED_PUZZLES[5],
  ...QUEENS_CURATED_PUZZLES[6],
  ...QUEENS_CURATED_PUZZLES[7],
  ...QUEENS_CURATED_PUZZLES[8],
];

export function QueensGame({ onFinish, onQuit, onExit, isPractice }: QueensGameProps) {
  const handleExit = onExit || onQuit || (() => {});
  const hapticsEnabled = usePlaygroundStore((s) => s.hapticsEnabled);

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
    if (!isTutorialCompleted('queens') && !isTutorialDismissed('queens')) {
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

  const { width, height } = useWindowDimensions();

  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const puzzle = QUEENS_PUZZLES[puzzleIndex % QUEENS_PUZZLES.length];
  const size = puzzle.size;

  // Board cell states: 'empty' | 'dot' | 'queen'
  const [board, setBoard] = useState<QueensCellState[][]>(() =>
    Array.from({ length: size }, () => Array(size).fill('empty'))
  );

  const startTimeRef = useRef<number>(Date.now());
  const finishedRef = useRef<boolean>(false);
  const [elapsedDisplay, setElapsedDisplay] = useState(0);

  // Reset board when puzzle changes
  useEffect(() => {
    setBoard(Array.from({ length: size }, () => Array(size).fill('empty')));
    startTimeRef.current = Date.now();
    finishedRef.current = false;
  }, [size, puzzleIndex]);

  // Display timer
  useEffect(() => {
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

  // Check conflicts via pure logic engine
  const conflicts = useMemo(() => {
    return findQueensConflicts(board, puzzle.regions, size);
  }, [board, puzzle.regions, size]);

  // Total queens placed
  const queenCount = useMemo(() => {
    let count = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] === 'queen') count++;
      }
    }
    return count;
  }, [board, size]);

  // Check win condition
  useEffect(() => {
    if (finishedRef.current) return;

    const isWon = checkQueensWin(board, puzzle.regions, size);
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
  }, [board, puzzle.regions, size, triggerHaptic, onFinish, isPracticeMode]);

  // Cell tap handler (empty -> dot -> queen -> empty)
  const handleCellPress = (r: number, c: number) => {
    if (finishedRef.current) return;
    triggerHaptic('light');

    setBoard((prev) => {
      const copy = prev.map((row) => [...row]);
      const cur = copy[r][c];
      if (cur === 'empty') copy[r][c] = 'dot';
      else if (cur === 'dot') copy[r][c] = 'queen';
      else copy[r][c] = 'empty';
      return copy;
    });
  };

  // Reset board
  const handleReset = () => {
    triggerHaptic('medium');
    setBoard(Array.from({ length: size }, () => Array(size).fill('empty')));
  };

  // Switch level
  const handleToggleLevel = () => {
    triggerHaptic('medium');
    setPuzzleIndex((prev) => (prev + 1) % QUEENS_PUZZLES.length);
  };

  // Responsive cell sizing calculation preventing overflow on compact displays
  const maxBoardWidth = Math.min(width - 32, 380);
  const maxBoardHeight = Math.max(260, height * 0.5);
  const cellSize = Math.floor(Math.min(maxBoardWidth, maxBoardHeight) / size);

  if (isTutorialOpen) {
    return (
      <InteractiveTutorialView
        gameType="queens"
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
          onPress={handleToggleLevel}
          style={styles.headerCenter}
          accessibilityRole="button"
          accessibilityLabel={`Level ${puzzleIndex + 1}. Tap to change level`}
        >
          <Text style={styles.gameTitle}>QUEENS</Text>
          <View style={styles.levelTag}>
            <Text style={styles.gameSub}>
              Level {puzzleIndex + 1} ({size}×{size}) • Tap to switch
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerRightActions}>
          <Pressable
            onPress={() => setIsGuideOpen(true)}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Game Guide"
          >
            <Feather name="help-circle" size={18} color="#94A3B8" />
          </Pressable>

          <Pressable
            onPress={handleReset}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Reset Puzzle"
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

        <View style={styles.statPill} accessibilityLabel={`Queens placed: ${queenCount} of ${size}`}>
          <Text style={styles.queenEmoji}>👑</Text>
          <Text style={styles.statText}>
            {queenCount} / {size} Placed
          </Text>
        </View>
      </View>

      {/* Queens Grid Stage */}
      <View style={styles.boardWrapper}>
        <View style={[styles.grid, { width: cellSize * size, height: cellSize * size }]}>
          {board.map((row, rIdx) => (
            <View key={rIdx} style={styles.row}>
              {row.map((cellState, cIdx) => {
                const regionId = puzzle.regions[rIdx][cIdx];
                const regionColor = REGION_COLORS[regionId % REGION_COLORS.length];
                const territoryLetter = getTerritoryIdentifier(regionId);
                const isConflict = conflicts.has(`${rIdx}-${cIdx}`);
                const borders = getTerritoryBorderOffsets(puzzle.regions, rIdx, cIdx, size);

                const stateDesc =
                  cellState === 'queen'
                    ? 'Queen placed'
                    : cellState === 'dot'
                    ? 'Marked empty'
                    : 'Empty';

                return (
                  <Pressable
                    key={cIdx}
                    onPress={() => handleCellPress(rIdx, cIdx)}
                    accessibilityRole="button"
                    accessibilityLabel={`Row ${rIdx + 1}, Column ${cIdx + 1}, Territory ${territoryLetter}, ${stateDesc}${
                      isConflict ? ', Conflict detected' : ''
                    }`}
                    style={[
                      styles.cell,
                      {
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: regionColor + '28',
                        borderColor: regionColor,
                        borderTopWidth: borders.borderTopWidth,
                        borderBottomWidth: borders.borderBottomWidth,
                        borderLeftWidth: borders.borderLeftWidth,
                        borderRightWidth: borders.borderRightWidth,
                      },
                      isConflict && styles.cellConflict,
                    ]}
                  >
                    {/* Subtle Territory Identifier Letter in Corner */}
                    <Text
                      style={[styles.territoryBadge, { color: regionColor }]}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    >
                      {territoryLetter}
                    </Text>

                    {cellState === 'queen' && (
                      <Text style={[styles.queenIcon, isConflict && styles.queenIconConflict]}>
                        👑
                      </Text>
                    )}
                    {cellState === 'dot' && <View style={styles.dotMarker} />}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Guide / Instructions Footer */}
      <View style={styles.footerNote}>
        <Ionicons name="information-circle-outline" size={16} color="#0AB963" />
        <Text style={styles.guideText}>
          1 Queen per row, column & territory (letters A–{getTerritoryIdentifier(size - 1)}). No Queens can touch, even diagonally!
        </Text>
      </View>

      {/* First-Time Game Intro Modal */}
      <GameIntroModal
        visible={isIntroOpen}
        gameType="queens"
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
          dismissTutorial('queens');
        }}
      />

      {/* In-Game Help Guide Modal */}
      <GameGuideModal
        visible={isGuideOpen}
        gameType="queens"
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
    color: '#B1FA63',
    fontSize: 18,
    fontWeight: typography.weights.heavy,
    letterSpacing: 2,
  },
  levelTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 2,
  },
  gameSub: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
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
  queenEmoji: {
    fontSize: 14,
  },
  boardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  grid: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cellConflict: {
    backgroundColor: 'rgba(244, 63, 94, 0.35)',
    borderColor: '#F43F5E',
  },
  territoryBadge: {
    position: 'absolute',
    top: 2,
    left: 4,
    fontSize: 9,
    fontWeight: typography.weights.bold,
    opacity: 0.65,
  },
  queenIcon: {
    fontSize: 22,
  },
  queenIconConflict: {
    opacity: 0.8,
  },
  dotMarker: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 185, 99, 0.08)',
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(10, 185, 99, 0.2)',
  },
  guideText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    flex: 1,
  },
});
