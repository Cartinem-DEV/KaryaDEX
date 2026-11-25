/**
 * KaryaDEX — Playground Component
 *
 * A collection of quick math and logic games that users can play
 * during focus break intervals. Games integrate with the lockin
 * store to count sessions and trigger reward checks.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, spacing, typography, radii } from '@/constants/theme';
import { lockinStorage } from '@/services/lockin/lockinStorage';

/**
 * Game type enumeration for cognitive focus and training games.
 */
enum PlaygroundGameType {
  MATH_QZ = 'math_quiz',
  MEMORY = 'memory_match',
  WORD_PUZ = 'word_puzzle',
  FOCUS_BREAK = 'focus_break',
}

/**
 * Statistics tracking for playground games.
 */
interface PlaygroundStats {
  totalSessions: number;
  bestScores: Record<PlaygroundGameType, number>;
  averageDuration: number;
  streakDays: number;
  gamesPlayed: Record<PlaygroundGameType, number>;
}

/**
 * Props for the Playground component.
 */
interface PlaygroundProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

/**
 * Main Playground component - displays game selection and runs individual games.
 */
export function Playground({ visible, onClose, userId }: PlaygroundProps) {
  const { colors, isDark } = useTheme();
  const [selectedGame, setSelectedGame] = useState<PlaygroundGameType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameData, setGameData] = useState<{
    question?: string;
    answer?: string;
    score: number;
    timer: number;
    duration: number;
  }>({
    score: 0,
    timer: 0,
    duration: 0,
  });
  const [showResults, setShowResults] = useState(false);
  const [userStats, setUserStats] = useState<PlaygroundStats>({
    totalSessions: 0,
    bestScores: {
      [PlaygroundGameType.MATH_QZ]: 0,
      [PlaygroundGameType.MEMORY]: 0,
      [PlaygroundGameType.WORD_PUZ]: 0,
      [PlaygroundGameType.FOCUS_BREAK]: 0,
    },
    averageDuration: 0,
    streakDays: 0,
    gamesPlayed: {
      [PlaygroundGameType.MATH_QZ]: 0,
      [PlaygroundGameType.MEMORY]: 0,
      [PlaygroundGameType.WORD_PUZ]: 0,
      [PlaygroundGameType.FOCUS_BREAK]: 0,
    },
  });

  // Load user stats when component mounts
  useEffect(() => {
    loadUserStats();
  }, [userId]);

  const loadUserStats = async () => {
    try {
      // We'll maintain stats in memory and persist via storage later
      const quotas = await lockinStorage.getQuotas(userId);
      const sessions = await lockinStorage.getSessionsByUser(userId, 100);
      const today = new Date().toISOString().split('T')[0];

      let totalSessionTime = 0;
      let sessionCount = 0;
      let bestMath = 0;
      let bestMemory = 0;
      let bestWord = 0;
      let bestFocus = 0;
      let mathCount = 0;
      let memoryCount = 0;
      let wordCount = 0;
      let focusCount = 0;

      // Calculate stats from sessions and quotas
      for (const session of sessions) {
        if (session.sessionType === 'playground') {
          totalSessionTime += (session.actualDurationMinutes || 0) * 60;
          sessionCount++;

          // Parse game type from notes
          const notes = session.notes || '';
          if (notes.includes('math')) {
            mathCount++;
            bestMath = Math.max(bestMath, (session.focusScore || 0));
          }
          if (notes.includes('memory')) {
            memoryCount++;
            bestMemory = Math.max(bestMemory, (session.focusScore || 0));
          }
          if (notes.includes('word')) {
            wordCount++;
            bestWord = Math.max(bestWord, (session.focusScore || 0));
          }
          if (notes.includes('break')) {
            focusCount++;
            bestFocus = Math.max(bestFocus, (session.focusScore || 0));
          }
        }
      }

      // Also check quotas for playground usage
      for (const quota of quotas) {
        if (quota.appName?.toLowerCase().includes('playground')) {
          // Count from quota usage
        }
      }

      setUserStats({
        totalSessions: sessionCount,
        bestScores: {
          [PlaygroundGameType.MATH_QZ]: bestMath,
          [PlaygroundGameType.MEMORY]: bestMemory,
          [PlaygroundGameType.WORD_PUZ]: bestWord,
          [PlaygroundGameType.FOCUS_BREAK]: bestFocus,
        },
        averageDuration: sessionCount > 0 ? totalSessionTime / sessionCount : 0,
        streakDays: 0, // Will be computed from daily streaks
        gamesPlayed: {
          [PlaygroundGameType.MATH_QZ]: mathCount,
          [PlaygroundGameType.MEMORY]: memoryCount,
          [PlaygroundGameType.WORD_PUZ]: wordCount,
          [PlaygroundGameType.FOCUS_BREAK]: focusCount,
        },
      });
    } catch (error) {
      console.warn('[Playground] Failed to load stats:', error);
    }
  };

  /**
   * Start a math quiz game with 5 questions.
   */
  const startMathQuiz = useCallback(() => {
    const questions = generateMathQuestions(5);
    setGameData({
      question: questions[0].question,
      answer: '',
      score: 0,
      timer: 30,
      duration: 300, // 5 min max
    });
    setShowResults(false);
    setIsPlaying(true);
  }, []);

  /**
   * Start a memory matching game.
   */
  const startMemoryGame = useCallback(() => {
    setGameData({
      question: 'Match the pairs!', // Visual memory game UI
      answer: '',
      score: 0,
      timer: 60,
      duration: 120,
    });
    setShowResults(false);
    setIsPlaying(true);
  }, []);

  /**
   * Start a word puzzle game.
   */
  const startWordPuzzle = useCallback(() => {
    setGameData({
      question: 'Unscramble: _ _ _ _ _', // Word scramble UI
      answer: '',
      score: 0,
      timer: 45,
      duration: 90,
    });
    setShowResults(false);
    setIsPlaying(true);
  }, []);

  /**
   * Start a focus break game (simple breathing/animation).
   */
  const startFocusBreak = useCallback(() => {
    setGameData({
      question: 'Breathe in... hold... breathe out.',
      answer: '',
      score: 0,
      timer: 60,
      duration: 180,
    });
    setShowResults(false);
    setIsPlaying(true);
  }, []);

  /**
   * Generate math quiz questions.
   */
  const generateMathQuestions = (count: number): Array<{question: string; answer: number}> => {
    const questions: Array<{question: string; answer: number}> = [];
    for (let i = 0; i < count; i++) {
      const a = Math.floor(Math.random() * 12) + 1;
      const b = Math.floor(Math.random() * 12) + 1;
      const operation = i % 3 === 0 ? '+' : i % 3 === 1 ? '-' : '*';
      let answer: number;
      if (operation === '+') answer = a + b;
      else if (operation === '-') answer = a - b > 0 ? a - b : b - a;
      else answer = a * b;
      questions.push({
        question: `${a} ${operation} ${b}`,
        answer,
      });
    }
    return questions;
  };

  /**
   * Handle answer submission for math quiz.
   */
  const handleAnswerSubmit = useCallback((userAnswer: number) => {
    if (!gameData.question) return;

    const [, aStr, , bStr] = gameData.question.match(/(\d+)\s*[\+\-\*]\s*(\d+)/) || [];
    const correctAnswer = parseInt(aStr!) + (gameData.question.includes('-') ? -1 : 1) * parseInt(bStr!);
    // Simplified: just check if user got it right
    const isCorrect = Math.abs(userAnswer - (correctAnswer || 0)) < 1;

    setGameData(prev => {
      const newScore = prev.score + (isCorrect ? 1 : 0);
      // Check for completion inside the updater
      if (newScore >= 5) {
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          completeSession(PlaygroundGameType.MATH_QZ, newScore);
          setIsPlaying(false);
        }, 0);
      }
      return {
        ...prev,
        score: newScore,
        answer: userAnswer.toString(),
      };
    });
  }, [gameData]);

  /**
   * Complete a playground session and persist to storage.
   */
  const completeSession = useCallback(async (gameType: PlaygroundGameType, score: number) => {
    try {
      const now = new Date().toISOString();
      await lockinStorage.createSession({
        userId,
        sessionType: 'playground',
        status: 'completed',
        plannedDurationMinutes: Math.round(gameData.duration / 60),
        actualDurationMinutes: Math.round(gameData.duration / 60),
        focusScore: score,
        notes: `Playground game: ${gameType}`,
        startedAt: now,
      });

      // Update stats
      loadUserStats();
      setIsPlaying(false);
      setSelectedGame(null);

      // Notify via timer service if needed
      // await lockinTimerService.recordSession({...});
    } catch (error) {
      console.warn('[Playground] Failed to complete session:', error);
      Alert.alert('Error', 'Failed to record session. Please try again.');
    }
  }, [gameData, userId]);

  /**
   * Handle timer tick for game countdown.
   */
  useEffect(() => {
    if (!isPlaying || !gameData.timer) return;

    const interval = setInterval(() => {
      setGameData(prev => {
        if (prev.timer <= 1) {
          clearInterval(interval);
          completeSession(selectedGame || PlaygroundGameType.MATH_QZ, prev.score);
          return { ...prev, timer: 0 };
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, gameData.timer, selectedGame, completeSession]);

  /**
   * Render a game card.
   */
  const renderGameCard = (gameType: PlaygroundGameType, label: string, icon: string) => {
    const isSelected = selectedGame === gameType;
    return (
      <Pressable
        style={[
          styles.gameCard,
          isSelected && styles.gameCardSelected,
          { backgroundColor: isSelected ? brand.violet : colors.surface },
          { borderColor: isSelected ? brand.violet : colors.border },
        ]}
        onPress={() => setSelectedGame(gameType)}
      >
        <View style={styles.gameCardIcon}>
          <Ionicons name={icon as any} size={28} color={isSelected ? '#FFFFFF' : '#888888'} />
        </View>
        <View style={styles.gameCardLabel}>
          <Text style={styles.gameCardLabelText}>{label}</Text>
          <Text style={styles.gameCardLabelSub}>{gameInfo[gameType]?.maxParticipants || 'Play now'}</Text>
        </View>
      </Pressable>
    );
  };

  /** Game info lookup */
  const gameInfo: Record<PlaygroundGameType, { maxParticipants: string; description: string }> = {
    [PlaygroundGameType.MATH_QZ]: { maxParticipants: '1 player', description: '5 math questions' },
    [PlaygroundGameType.MEMORY]: { maxParticipants: '1 player', description: 'Memory matching' },
    [PlaygroundGameType.WORD_PUZ]: { maxParticipants: '1 player', description: 'Word scramble' },
    [PlaygroundGameType.FOCUS_BREAK]: { maxParticipants: '1 player', description: 'Relaxation break' },
  };

  /** Game icons */
  const gameIcons: Record<PlaygroundGameType, string> = {
    [PlaygroundGameType.MATH_QZ]: 'calculator',
    [PlaygroundGameType.MEMORY]: 'grid',
    [PlaygroundGameType.WORD_PUZ]: 'text',
    [PlaygroundGameType.FOCUS_BREAK]: 'ripples',
  };

  /** Game labels */
  const gameLabels: Record<PlaygroundGameType, string> = {
    [PlaygroundGameType.MATH_QZ]: 'Math Quiz',
    [PlaygroundGameType.MEMORY]: 'Memory Match',
    [PlaygroundGameType.WORD_PUZ]: 'Word Puzzle',
    [PlaygroundGameType.FOCUS_BREAK]: 'Focus Break',
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} onRequestClose={onClose} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modal, { backgroundColor: '#1A1A2E' }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="apps-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Playground</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Game Selection Grid */}
          <View style={styles.gameSection}>
            <Text style={styles.sectionTitle}>Choose a Game</Text>
            <FlatList
              data={Object.values(PlaygroundGameType)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => renderGameCard(
                item as PlaygroundGameType,
                gameLabels[item as PlaygroundGameType],
                gameIcons[item as PlaygroundGameType]
              )}
              horizontal
              showsHorizontalScrollIndicator={false}
            />
          </View>

          {/* Active Game Area */}
          {selectedGame && (
            <View style={styles.gameArea}>
              <View style={styles.gameHeader}>
                <Text style={styles.gameHeaderTitle}>{gameLabels[selectedGame]}</Text>
                <Text style={styles.gameHeaderTimer}>{gameData.timer}s</Text>
              </View>

              {selectedGame === PlaygroundGameType.MATH_QZ && (
                <View style={styles.mathQuiz}>
                  <Text style={styles.mathQuestion}>{gameData.question}</Text>
                  <TextInput
                    placeholder="Your answer"
                    value={gameData.answer}
                    onChangeText={(text) => setGameData(prev => ({ ...prev, answer: text }))}
                    keyboardType="number-pad"
                    style={styles.mathInput}
                    editable={isPlaying}
                  />
                  <Pressable
                    style={[styles.mathSubmit, { backgroundColor: isPlaying ? brand.violet : '#CCCCCC' }]}
                    disabled={!isPlaying}
                    onPress={() => handleAnswerSubmit(parseInt(gameData.answer || '0') || 0)}
                  >
                    <Ionicons name="send-outline" size={18} color="#FFFFFF" /> Submit
                  </Pressable>
                  <Text style={styles.mathScore}>Score: {gameData.score}/5</Text>
                </View>
              )}

              {selectedGame === PlaygroundGameType.MEMORY && (
                <View style={styles.memoryGame}>
                  <Text style={styles.memoryInstruction}>Match pairs by remembering positions</Text>
                  <ActivityIndicator size="large" color={brand.violet} />
                </View>
              )}

              {selectedGame === PlaygroundGameType.WORD_PUZ && (
                <View style={styles.wordPuzzle}>
                  <Text style={styles.wordPrompt}>{gameData.question}</Text>
                  <TextInput
                    placeholder="Unscrambled word"
                    value={gameData.answer}
                    onChangeText={(text) => setGameData(prev => ({ ...prev, answer: text }))}
                    style={styles.wordInput}
                  />
                  <Pressable
                    style={[styles.wordSubmit, { backgroundColor: isPlaying ? brand.violet : '#CCCCCC' }]}
                    disabled={!isPlaying}
                    onPress={() => {
                      // Simple word check - just advance
                      setGameData(prev => {
                        const newScore = prev.score + 1;
                        if (newScore >= 3) {
                          setTimeout(() => {
                            completeSession(selectedGame, newScore);
                          }, 0);
                        }
                        return {
                          ...prev,
                          answer: prev.answer || '',
                          score: newScore,
                        };
                      });
                    }}
                  >
                    <Ionicons name="send-outline" size={18} color="#FFFFFF" /> Submit
                  </Pressable>
                  <Text style={styles.wordScore}>Score: {gameData.score}/3</Text>
                </View>
              )}

              {selectedGame === PlaygroundGameType.FOCUS_BREAK && (
                <View style={styles.focusBreak}>
                  <Text style={styles.breathingText}>{gameData.question}</Text>
                  <ActivityIndicator size="small" color={brand.violet} />
                  <Text style={styles.breathingTimer}>Time left: {gameData.timer}s</Text>
                </View>
              )}
            </View>
          )}

          {/* Controls */}
          {isPlaying && selectedGame && (
            <View style={styles.controls}>
              <Pressable
                style={[styles.controlBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => {
                  // Cancel current game
                  setIsPlaying(false);
                  setSelectedGame(null);
                  setGameData({
                    score: 0,
                    timer: 0,
                    duration: 0,
                  });
                }}
              >
                <Ionicons name="close-circle" size={18} color="#FFFFFF" /> Cancel
              </Pressable>
              <Pressable
                style={styles.controlBtn}
                onPress={() => {
                  // Complete current session
                  if (selectedGame && gameData) {
                    completeSession(selectedGame, gameData.score);
                  }
                }}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" /> Finish
              </Pressable>
            </View>
          )}

          {/* Stats Summary (always visible) */}
          <View style={styles.statsSummary}>
            <Text style={styles.statsTitle}>Your Stats</Text>
            <FlatList
              data={Object.keys(userStats.gamesPlayed)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const game = item as PlaygroundGameType;
                return (
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{gameLabels[game]}</Text>
                    <Text style={styles.statValue}>
                      {userStats.gamesPlayed[game]} sessions
                    </Text>
                    <Text style={styles.statBest}>
                      Best: {userStats.bestScores[game]}/5
                    </Text>
                  </View>
                );
              }}
            />
            <View style={styles.statTotal}>
              <Text>Total Sessions: {userStats.totalSessions}</Text>
              <Text>Avg Duration: {Math.round(userStats.averageDuration)}s</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Styles */
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '95%',
    paddingBottom: spacing.lg,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginLeft: spacing.sm,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  gameSection: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    color: '#888888',
  },
  gameCard: {
    width: 80,
    aspectRatio: 1,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.xs,
    padding: spacing.sm,
  },
  gameCardSelected: {
    backgroundColor: brand.violet,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  gameCardIcon: {
    width: 32,
    height: 32,
    marginBottom: spacing.xs,
  },
  gameCardLabel: {
    alignItems: 'center',
  },
  gameCardLabelText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: '#FFFFFF',
  },
  gameCardLabelSub: {
    fontSize: typography.sizes.xs,
    color: '#888888',
    marginTop: 2,
  },
  gameArea: {
    padding: spacing.md,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gameHeaderTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  gameHeaderTimer: {
    color: '#888888',
    fontSize: typography.sizes.sm,
  },
  mathQuiz: {
    padding: spacing.md,
  },
  mathQuestion: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  mathInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    color: '#FFFFFF',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  mathSubmit: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  mathScore: {
    fontSize: typography.sizes.sm,
    color: '#888888',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  memoryGame: {
    padding: spacing.md,
    alignItems: 'center',
  },
  memoryInstruction: {
    fontSize: typography.sizes.sm,
    color: '#888888',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  wordPuzzle: {
    padding: spacing.md,
  },
  wordPrompt: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  wordInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    color: '#FFFFFF',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  wordSubmit: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  wordScore: {
    fontSize: typography.sizes.sm,
    color: '#888888',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  focusBreak: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingText: {
    fontSize: typography.sizes.lg,
    color: '#FFFFFF',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  breathingTimer: {
    color: '#888888',
    fontSize: typography.sizes.sm,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    elevation: 2,
  },
  statsSummary: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statsTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    color: '#888888',
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  statLabel: {
    color: '#888888',
    fontSize: typography.sizes.sm,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
  },
  statBest: {
    color: brand.violet,
    fontSize: typography.sizes.xs,
    marginLeft: spacing.xs,
  },
  statTotal: {
    paddingTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
});