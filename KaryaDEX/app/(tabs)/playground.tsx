/**
 * BunkMatKar — Brain Playground Tab Screen
 *
 * An independent, immersive neuro-training environment designed to break
 * free from mindless social media doomscrolling and rewire focus with
 * high-intensity brain games.
 *
 * Tailored for ambitious college students to develop cognitive focus.
 * Features:
 * - Sprint Duel (1v1 Live Speed Math against Sero AI)
 * - Queens (Territory Crown Logic)
 * - Tango (Sun vs Moon Binary Grid Logic)
 * - MindSnap (Matrix Sequence Memory Blitz)
 * - ELO Rating, Brain XP, Matrix Escape Streak, and Anti-Doomscroll Metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { usePlaygroundStore } from '@/store/usePlaygroundStore';
import { useLockInStore } from '@/hooks/useLockInStore';
import { typography, radii, spacing } from '@/constants/theme';
import type { PlaygroundGameType, MatchRecord } from '@/types/playground';
import { lockinPlaygroundBridge } from '@/lib/lockin/lockinPlaygroundBridge';

// Games
import { SprintDuelGame } from '@/components/playground/games/SprintDuelGame';
import { QueensGame } from '@/components/playground/games/QueensGame';
import { TangoGame } from '@/components/playground/games/TangoGame';
import { MindSnapGame } from '@/components/playground/games/MindSnapGame';
import { MatchSummaryModal } from '@/components/playground/MatchSummaryModal';
import { GameGuideModal } from '@/components/playground/guide';
import { GuestClaimModal } from '@/components/playground/GuestClaimModal';
import { initPlaygroundAuthObserver } from '@/lib/playground/identity/playgroundAuthObserver';

interface GameCardDef {
  id: PlaygroundGameType;
  title: string;
  tagline: string;
  category: string;
  duration: string;
  accentColor: string;
  secondaryColor: string;
  iconName: string;
  description: string;
}

const GAME_CARDS: GameCardDef[] = [
  {
    id: 'sprint_duel',
    title: 'Sprint Duel',
    tagline: '1v1 Rapid Arithmetic Blitz',
    category: 'SPEED MATH',
    duration: '60s Duel',
    accentColor: '#B1FA63',
    secondaryColor: '#00D9FF',
    iconName: 'lightning-bolt',
    description: 'Battle Sero AI in a 60-second math sprint. Rapid equations, fire combos, and live leaderboard.',
  },
  {
    id: 'queens',
    title: 'Queens',
    tagline: 'Territory Crown Deduction',
    category: 'GRID LOGIC',
    duration: 'Untimed',
    accentColor: '#A855F7',
    secondaryColor: '#F59E0B',
    iconName: 'crown',
    description: 'Place 1 Crown in each row, column, and colored sector. No adjacent touches, even diagonally.',
  },
  {
    id: 'tango',
    title: 'Tango',
    tagline: 'Sun ☀️ vs Moon 🌙 Harmony',
    category: 'BINARY CONSTRAINTS',
    duration: 'Pure Logic',
    accentColor: '#00D9FF',
    secondaryColor: '#EC4899',
    iconName: 'yin-yang',
    description: 'Fill the 6×6 grid with equal Suns and Moons. Obey = (equal) and × (opposite) constraint gates.',
  },
  {
    id: 'mind_snap',
    title: 'MindSnap',
    tagline: 'Matrix Pattern Sequence Blitz',
    category: 'WORKING MEMORY',
    duration: 'Fast Blitz',
    accentColor: '#F59E0B',
    secondaryColor: '#B1FA63',
    iconName: 'brain',
    description: 'Flash-memorize the cyber matrix tile sequence and replay it before the countdown expires.',
  },
];

export default function PlaygroundScreen() {
  const router = useRouter();
  const activeGame = usePlaygroundStore((s) => s.activeGame);
  const setActiveGame = usePlaygroundStore((s) => s.setActiveGame);

  // Authoritative LockIn Focus State: Locked if active/paused focus session & no valid break
  const isPlaygroundLocked = useLockInStore((s) => {
    const status = s.timerState?.status;
    const isFocus = (status === 'active' || status === 'paused') && s.currentSession !== null;
    if (!isFocus) return false;
    const activeBreak = s.activeBreak;
    const isBreakActive = activeBreak !== null && activeBreak.isBreakActive && Date.now() < activeBreak.breakDeadlineTimestamp;
    return !isBreakActive;
  });

  // Direct Route Access & Deep Link Guard
  useEffect(() => {
    if (isPlaygroundLocked) {
      const message = lockinPlaygroundBridge.getLockedExplanation();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(message);
      } else {
        Alert.alert('Playground Locked', message);
      }
      router.replace('/(tabs)/lockin');
    }
  }, [isPlaygroundLocked, router]);
  const [lastRecord, setLastRecord] = useState<MatchRecord | null>(null);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const [previewGuideGame, setPreviewGuideGame] = useState<PlaygroundGameType | null>(null);
  const [breakSession, setBreakSession] = useState(lockinPlaygroundBridge.getActiveBreak());
  const [remainingBreakSec, setRemainingBreakSec] = useState(lockinPlaygroundBridge.getRemainingBreakSeconds());
  const [wasDeadlineRejected, setWasDeadlineRejected] = useState(false);

  // Store bindings
  const isHydrating = usePlaygroundStore((s) => s.isHydrating);
  const pendingGuestClaim = usePlaygroundStore((s) => s.pendingGuestClaim);
  const resolveGuestClaim = usePlaygroundStore((s) => s.resolveGuestClaim);
  const dismissGuestClaimPrompt = usePlaygroundStore((s) => s.dismissGuestClaimPrompt);

  const brainXp = usePlaygroundStore((s) => s.brainXp);
  const brainRating = usePlaygroundStore((s) => s.brainRating);
  const escapeStreak = usePlaygroundStore((s) => s.escapeStreak);
  const highScores = usePlaygroundStore((s) => s.highScores);
  const dailyQuests = usePlaygroundStore((s) => s.dailyQuests);
  const recentMatches = usePlaygroundStore((s) => s.recentMatches);
  const getRank = usePlaygroundStore((s) => s.getRank);
  const totalTimeMinutes = usePlaygroundStore((s) => s.totalTimeMinutes);
  const recordMatch = usePlaygroundStore((s) => s.recordMatch);
  const refreshDailyQuests = usePlaygroundStore((s) => s.refreshDailyQuests);

  useEffect(() => {
    initPlaygroundAuthObserver().catch((err) => {
      console.warn('[Playground] Auth observer init failed:', err);
    });
    refreshDailyQuests();

    // Check if launched via bridge context
    const bridgeCtx = lockinPlaygroundBridge.getActiveBridgeContext();
    if (bridgeCtx && bridgeCtx.gameType) {
      setActiveGame(bridgeCtx.gameType);
    }

    const unsub = lockinPlaygroundBridge.subscribe(() => {
      setBreakSession(lockinPlaygroundBridge.getActiveBreak());
      setRemainingBreakSec(lockinPlaygroundBridge.getRemainingBreakSeconds());
    });

    const interval = setInterval(() => {
      if (lockinPlaygroundBridge.isBreakActive()) {
        setRemainingBreakSec(lockinPlaygroundBridge.getRemainingBreakSeconds());
      }
    }, 1000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [refreshDailyQuests]);

  const handleReturnToLockin = () => {
    lockinPlaygroundBridge.clearActiveBridgeGame();
    setActiveGame(null);
    setIsSummaryVisible(false);
    router.push('/(tabs)/lockin');
  };

  const currentRank = getRank();

  const handleLaunchGame = (gameType: PlaygroundGameType) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setActiveGame(gameType);
  };

  const handleExitActiveGame = useCallback(() => {
    setActiveGame(null);
  }, [setActiveGame]);

  // Hardware Back (Android) and Web Back Handler for Active Gameplay
  useEffect(() => {
    if (!activeGame) return;

    const onHardwareBack = () => {
      handleExitActiveGame();
      return true;
    };

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBack
    );

    let popHandler: (() => void) | null = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.pushState({ inPlaygroundGame: true }, '');
      popHandler = () => {
        handleExitActiveGame();
      };
      window.addEventListener('popstate', popHandler);
    }

    return () => {
      backSubscription.remove();
      if (popHandler && typeof window !== 'undefined') {
        window.removeEventListener('popstate', popHandler);
      }
    };
  }, [activeGame, handleExitActiveGame]);

  const handleSprintDuelFinish = (res: {
    score: number;
    opponentScore: number;
    accuracy: number;
    durationSeconds: number;
    isWin: boolean;
    isPractice?: boolean;
  }) => {
    // Practice mode isolation: ZERO progression impact
    if (res.isPractice) {
      setActiveGame(null);
      return;
    }

    const xpEarned = res.isWin ? 100 + Math.min(50, res.score * 2) : 40;
    const matchId = `match-${Date.now()}`;
    const update = recordMatch({
      id: matchId,
      gameType: 'sprint_duel',
      score: res.score,
      opponentScore: res.opponentScore,
      accuracy: res.accuracy,
      isWin: res.isWin,
      durationSeconds: res.durationSeconds,
      xpEarned,
      lockinSessionId: breakSession?.sessionId,
    });

    const newRecord: MatchRecord = {
      id: matchId,
      gameType: 'sprint_duel',
      score: res.score,
      opponentScore: res.opponentScore,
      accuracy: res.accuracy,
      isWin: res.isWin,
      durationSeconds: res.durationSeconds,
      xpEarned: update.totalXpEarned,
      ratingDelta: update.ratingDelta,
      date: new Date().toISOString(),
      lockinSessionId: breakSession?.sessionId,
    };

    setLastRecord(newRecord);
    setWasDeadlineRejected(
      update.rejectedReason === 'BREAK_DEADLINE_EXCEEDED' ||
        update.rejectedReason === 'STALE_BREAK_SESSION'
    );
    setActiveGame(null);
    setIsSummaryVisible(true);
  };

  const handlePuzzleFinish = (
    gameType: PlaygroundGameType,
    res: {
      score: number;
      isWin: boolean;
      durationSeconds: number;
      isPractice?: boolean;
    }
  ) => {
    // Practice mode isolation: ZERO progression impact
    if (res.isPractice) {
      setActiveGame(null);
      return;
    }

    const xpEarned = res.isWin ? 120 : 40;
    const matchId = `match-${Date.now()}`;
    const update = recordMatch({
      id: matchId,
      gameType,
      score: res.score,
      isWin: res.isWin,
      durationSeconds: res.durationSeconds,
      xpEarned,
      lockinSessionId: breakSession?.sessionId,
    });

    const newRecord: MatchRecord = {
      id: matchId,
      gameType,
      score: res.score,
      isWin: res.isWin,
      durationSeconds: res.durationSeconds,
      xpEarned: update.totalXpEarned,
      ratingDelta: update.ratingDelta,
      date: new Date().toISOString(),
      lockinSessionId: breakSession?.sessionId,
    };

    setLastRecord(newRecord);
    setWasDeadlineRejected(
      update.rejectedReason === 'BREAK_DEADLINE_EXCEEDED' ||
        update.rejectedReason === 'STALE_BREAK_SESSION'
    );
    setActiveGame(null);
    setIsSummaryVisible(true);
  };

  const handlePlayAgain = () => {
    setIsSummaryVisible(false);
    if (lastRecord) {
      setActiveGame(lastRecord.gameType);
    }
  };

  const handleCloseSummary = () => {
    setIsSummaryVisible(false);
  };

  // Route Guard: If Playground is locked during focus session, block rendering
  if (isPlaygroundLocked) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <View style={styles.lockedContainer}>
          <Feather name="lock" size={48} color="#EF4444" />
          <Text style={styles.lockedTitle}>Playground Locked</Text>
          <Text style={styles.lockedText}>
            {lockinPlaygroundBridge.getLockedExplanation()}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // If a game is active, render full-screen game session
  if (activeGame === 'sprint_duel') {
    return (
      <SprintDuelGame
        onExit={handleExitActiveGame}
        onFinish={handleSprintDuelFinish}
      />
    );
  }

  if (activeGame === 'queens') {
    return (
      <QueensGame
        onExit={handleExitActiveGame}
        onFinish={(res) => handlePuzzleFinish('queens', res)}
      />
    );
  }

  if (activeGame === 'tango') {
    return (
      <TangoGame
        onExit={handleExitActiveGame}
        onFinish={(res) => handlePuzzleFinish('tango', res)}
      />
    );
  }

  if (activeGame === 'mind_snap') {
    return (
      <MindSnapGame
        onExit={handleExitActiveGame}
        onFinish={(res) => handlePuzzleFinish('mind_snap', res)}
      />
    );
  }

  if (isHydrating && !activeGame) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <View style={styles.hydratingContainer}>
          <ActivityIndicator size="large" color="#00D9FF" />
          <Text style={styles.hydratingText}>Loading Playground profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* LockIn Break Active Banner */}
        {breakSession?.isBreakActive && (
          <View style={styles.breakBanner} testID="playground-break-banner">
            <View style={styles.breakBannerLeft}>
              <Ionicons name="timer-outline" size={20} color="#00D9FF" />
              <View>
                <Text style={styles.breakBannerTitle}>LOCKIN BREAK ACTIVE</Text>
                <Text style={styles.breakBannerTime}>
                  {Math.floor(remainingBreakSec / 60)}m {String(remainingBreakSec % 60).padStart(2, '0')}s remaining
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleReturnToLockin}
              style={styles.breakReturnButton}
              accessibilityRole="button"
              testID="playground-return-to-lockin"
            >
              <Text style={styles.breakReturnButtonText}>Back to LockIn</Text>
            </Pressable>
          </View>
        )}

        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.matrixPill}>
              <View style={styles.matrixPillDot} />
              <Text style={styles.matrixPillText}>COGNITIVE ARENA</Text>
            </View>
            <Text style={styles.headerTitle}>Playground</Text>
            <Text style={styles.headerSubtitle}>
              Cognitive Mini-Games & Brain Training
            </Text>
          </View>

          {/* User Rank Tag */}
          <View
            style={[
              styles.rankBadge,
              { borderColor: `${currentRank.badgeColor}40` },
            ]}
          >
            <MaterialCommunityIcons
              name="shield-crown"
              size={18}
              color={currentRank.badgeColor}
            />
            <Text
              style={[styles.rankText, { color: currentRank.badgeColor }]}
            >
              {currentRank.title}
            </Text>
          </View>
        </View>

        {/* Quick Neuro Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statGlassCard}>
            <Text style={styles.statLabel}>ACTIVE STREAK</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statFlame}>🔥</Text>
              <Text style={styles.statValue}>{escapeStreak}</Text>
              <Text style={styles.statUnit}>DAYS</Text>
            </View>
          </View>

          <View style={styles.statGlassCard}>
            <Text style={styles.statLabel}>BRAIN ELO</Text>
            <View style={styles.statValueRow}>
              <Feather name="zap" size={16} color="#00D9FF" />
              <Text style={[styles.statValue, { color: '#00D9FF' }]}>
                {brainRating}
              </Text>
            </View>
          </View>

          <View style={styles.statGlassCard}>
            <Text style={styles.statLabel}>NEURO XP</Text>
            <View style={styles.statValueRow}>
              <MaterialCommunityIcons name="brain" size={16} color="#B1FA63" />
              <Text style={[styles.statValue, { color: '#B1FA63' }]}>
                {brainXp}
              </Text>
            </View>
          </View>
        </View>

        {/* Hero Anti-Doomscroll Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroGlowLine} />
          <View style={styles.heroContent}>
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroTag}>
                <Ionicons name="sparkles" size={12} color="#00D9FF" />
                <Text style={styles.heroTagText}>FOCUSED PROGRESS</Text>
              </View>
              <Text style={styles.heroSavedBadge}>
                {totalTimeMinutes}m Challenge Time
              </Text>
            </View>
            <Text style={styles.heroHeadline}>
              Sharpen your mind with daily cognitive challenges.
            </Text>
            <Text style={styles.heroBody}>
              Engage in quick, focused problem-solving sessions: speed arithmetic,
              spatial deduction, and working-memory patterns.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.heroActionButton,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => handleLaunchGame('sprint_duel')}
            >
              <Feather name="play" size={16} color="#05070B" />
              <Text style={styles.heroActionButtonText}>Quick Sprint Duel</Text>
            </Pressable>
          </View>
        </View>

        {/* Game Mode Cards Stack */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Select Brain Game</Text>
          <Text style={styles.sectionCaption}>Cognitive Focus Suite</Text>
        </View>

        <View style={styles.gameCardsGrid}>
          {GAME_CARDS.map((game) => {
            const highScore = highScores[game.id] || 0;
            return (
              <Pressable
                key={game.id}
                style={({ pressed }) => [
                  styles.gameCard,
                  pressed && {
                    opacity: 0.9,
                    transform: [{ scale: 0.99 }],
                  },
                ]}
                onPress={() => handleLaunchGame(game.id)}
              >
                <View
                  style={[
                    styles.cardHeaderAccent,
                    { backgroundColor: game.accentColor },
                  ]}
                />
                <View style={styles.gameCardInner}>
                  {/* Category & Duration */}
                  <View style={styles.gameCardMetaRow}>
                    <View
                      style={[
                        styles.gameCategoryBadge,
                        { borderColor: `${game.accentColor}50` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.gameCategoryText,
                          { color: game.accentColor },
                        ]}
                      >
                        {game.category}
                      </Text>
                    </View>
                    <View style={styles.gameDurationBadge}>
                      <Feather name="clock" size={11} color="#94A3B8" />
                      <Text style={styles.gameDurationText}>{game.duration}</Text>
                    </View>
                  </View>

                  {/* Title & Tagline */}
                  <View style={styles.gameTitleRow}>
                    <View style={styles.gameTitleWrap}>
                      <Text style={styles.gameCardTitle}>{game.title}</Text>
                      <Text style={styles.gameCardTagline}>
                        {game.tagline}
                      </Text>
                    </View>
                    <View style={styles.cardActionGroup}>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setPreviewGuideGame(game.id);
                        }}
                        style={styles.cardHelpButton}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${game.title} Guide`}
                      >
                        <Feather name="help-circle" size={18} color="#94A3B8" />
                      </Pressable>
                      <View
                        style={[
                          styles.gameIconBox,
                          {
                            backgroundColor: `${game.accentColor}15`,
                            borderColor: `${game.accentColor}35`,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={game.iconName as any}
                          size={24}
                          color={game.accentColor}
                        />
                      </View>
                    </View>
                  </View>

                  <Text style={styles.gameCardDesc}>{game.description}</Text>

                  {/* Bottom Action & Highscore */}
                  <View style={styles.gameCardFooter}>
                    <View style={styles.highScoreBox}>
                      <Text style={styles.highScoreLabel}>BEST RECORD</Text>
                      <Text
                        style={[
                          styles.highScoreValue,
                          { color: game.accentColor },
                        ]}
                      >
                        {game.id === 'queens' || game.id === 'tango'
                          ? highScore > 0
                            ? 'SOLVED'
                            : 'NEW'
                          : `${highScore} PTS`}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.playPill,
                        { backgroundColor: game.accentColor },
                      ]}
                    >
                      <Text style={styles.playPillText}>PLAY NOW</Text>
                      <Feather name="arrow-right" size={14} color="#05070B" />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Daily Escape Quests */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daily Mind Quests</Text>
          <Text style={styles.sectionCaption}>Resets at Midnight</Text>
        </View>

        <View style={styles.questsList}>
          {dailyQuests.map((quest) => {
            const progressPct = Math.min(
              100,
              Math.round((quest.currentCount / quest.targetCount) * 100)
            );
            return (
              <View key={quest.id} style={styles.questCard}>
                <View style={styles.questHeader}>
                  <View style={styles.questInfo}>
                    <Text style={styles.questTitle}>{quest.title}</Text>
                    <Text style={styles.questDesc}>{quest.description}</Text>
                  </View>
                  <View
                    style={[
                      styles.questXpBadge,
                      quest.completed && styles.questXpBadgeDone,
                    ]}
                  >
                    {quest.completed ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={15}
                        color="#B1FA63"
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="brain"
                        size={14}
                        color="#00D9FF"
                      />
                    )}
                    <Text
                      style={[
                        styles.questXpText,
                        quest.completed && { color: '#B1FA63' },
                      ]}
                    >
                      +{quest.xpReward} XP
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.questProgressTrack}>
                  <View
                    style={[
                      styles.questProgressFill,
                      {
                        width: `${progressPct}%`,
                        backgroundColor: quest.completed
                          ? '#B1FA63'
                          : '#00D9FF',
                      },
                    ]}
                  />
                </View>
                <View style={styles.questFooter}>
                  <Text style={styles.questProgressText}>
                    {quest.currentCount} / {quest.targetCount}
                  </Text>
                  <Text
                    style={[
                      styles.questStatusText,
                      quest.completed && { color: '#B1FA63' },
                    ]}
                  >
                    {quest.completed ? 'COMPLETED' : 'IN PROGRESS'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Recent Matches Feed */}
        {recentMatches.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Escape Battles</Text>
              <Text style={styles.sectionCaption}>Last 10 Matches</Text>
            </View>

            <View style={styles.historyList}>
              {recentMatches.slice(0, 5).map((match) => (
                <View key={match.id} style={styles.historyItem}>
                  <View style={styles.historyGameIconBox}>
                    <MaterialCommunityIcons
                      name={
                        match.gameType === 'sprint_duel'
                          ? 'lightning-bolt'
                          : match.gameType === 'queens'
                          ? 'crown'
                          : match.gameType === 'tango'
                          ? 'yin-yang'
                          : 'brain'
                      }
                      size={18}
                      color={match.isWin ? '#B1FA63' : '#F59E0B'}
                    />
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyGameTitle}>
                      {match.gameType === 'sprint_duel'
                        ? 'Sprint Duel (vs Sero AI)'
                        : match.gameType === 'queens'
                        ? 'Queens Logic Puzzle'
                        : match.gameType === 'tango'
                        ? 'Tango Binary Puzzle'
                        : 'MindSnap Blitz'}
                    </Text>
                    <Text style={styles.historySubtitle}>
                      Score: {match.score} • {match.durationSeconds}s
                    </Text>
                  </View>
                  <View style={styles.historyResultBox}>
                    <Text
                      style={[
                        styles.historyResultText,
                        { color: match.isWin ? '#B1FA63' : '#EF4444' },
                      ]}
                    >
                      {match.isWin ? 'VICTORY' : 'DEFEAT'}
                    </Text>
                    <Text style={styles.historyRatingDelta}>
                      {match.ratingDelta >= 0
                        ? `+${match.ratingDelta}`
                        : match.ratingDelta}{' '}
                      ELO
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Match Summary Modal */}
      <MatchSummaryModal
        visible={isSummaryVisible}
        record={lastRecord}
        isBreakSession={Boolean(breakSession?.isBreakActive)}
        remainingBreakSeconds={remainingBreakSec}
        isRejectedDueToDeadline={wasDeadlineRejected}
        onReturnToLockin={breakSession?.isBreakActive ? handleReturnToLockin : undefined}
        onPlayAgain={handlePlayAgain}
        onClose={handleCloseSummary}
      />

      {/* Lobby Preview Game Guide Modal */}
      {previewGuideGame && (
        <GameGuideModal
          visible={!!previewGuideGame}
          gameType={previewGuideGame}
          onClose={() => setPreviewGuideGame(null)}
          onLaunchTutorial={() => {
            const g = previewGuideGame;
            setPreviewGuideGame(null);
            setActiveGame(g);
          }}
        />
      )}

      {/* Guest Claim & Conflict Modal */}
      <GuestClaimModal
        visible={pendingGuestClaim !== null}
        promptData={pendingGuestClaim}
        onResolve={async (resolution) => {
          await resolveGuestClaim(resolution);
        }}
        onDismiss={dismissGuestClaimPrompt}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070B',
  },
  hydratingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  hydratingText: {
    fontSize: 14,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.regular,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110, // Avoid bottom tab bar collision
  },
  breakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    borderColor: 'rgba(0, 217, 255, 0.35)',
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 16,
  },
  breakBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakBannerTitle: {
    color: '#00D9FF',
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  breakBannerTime: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: typography.weights.heavy,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  breakReturnButton: {
    backgroundColor: '#00D9FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  breakReturnButtonText: {
    color: '#05070B',
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  matrixPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(177, 250, 99, 0.08)',
    borderColor: 'rgba(177, 250, 99, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  matrixPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B1FA63',
  },
  matrixPillText: {
    color: '#B1FA63',
    fontSize: 9.5,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: typography.weights.medium,
    marginTop: 2,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    marginTop: 4,
  },
  rankText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statGlassCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statFlame: {
    fontSize: 14,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: typography.weights.bold,
  },
  statUnit: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: typography.weights.semibold,
  },
  heroBanner: {
    backgroundColor: '#0A0F1A',
    borderColor: 'rgba(0, 217, 255, 0.25)',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 24,
  },
  heroGlowLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: '#00D9FF',
    opacity: 0.7,
  },
  heroContent: {
    padding: 18,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroTagText: {
    color: '#00D9FF',
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  heroSavedBadge: {
    color: '#B1FA63',
    fontSize: 11,
    fontWeight: typography.weights.bold,
    backgroundColor: 'rgba(177, 250, 99, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  heroHeadline: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: typography.weights.bold,
    lineHeight: 22,
    marginBottom: 6,
  },
  heroBody: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  heroActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00D9FF',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  heroActionButtonText: {
    color: '#05070B',
    fontSize: 13,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  sectionCaption: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: typography.weights.medium,
  },
  gameCardsGrid: {
    gap: 14,
    marginBottom: 24,
  },
  gameCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardHeaderAccent: {
    height: 3,
    width: '100%',
    opacity: 0.8,
  },
  gameCardInner: {
    padding: 16,
  },
  gameCardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  gameCategoryBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gameCategoryText: {
    fontSize: 9.5,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  gameDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gameDurationText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: typography.weights.medium,
  },
  gameTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  gameTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  gameCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: typography.weights.bold,
    marginBottom: 2,
  },
  gameCardTagline: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: typography.weights.medium,
  },
  gameIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHelpButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameCardDesc: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  gameCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  highScoreBox: {
    gap: 2,
  },
  highScoreLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
  },
  highScoreValue: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  playPillText: {
    color: '#05070B',
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  questsList: {
    gap: 10,
    marginBottom: 24,
  },
  questCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  questHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  questInfo: {
    flex: 1,
    paddingRight: 10,
  },
  questTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: typography.weights.bold,
    marginBottom: 2,
  },
  questDesc: {
    color: '#64748B',
    fontSize: 11,
  },
  questXpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
    borderColor: 'rgba(0, 217, 255, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  questXpBadgeDone: {
    backgroundColor: 'rgba(177, 250, 99, 0.08)',
    borderColor: 'rgba(177, 250, 99, 0.25)',
  },
  questXpText: {
    color: '#00D9FF',
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  questProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  questProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  questFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questProgressText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: typography.weights.medium,
  },
  questStatusText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  historyList: {
    gap: 8,
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  historyGameIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyGameTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: typography.weights.semibold,
  },
  historySubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  historyResultBox: {
    alignItems: 'flex-end',
  },
  historyResultText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  historyRatingDelta: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 1,
  },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  lockedTitle: {
    fontSize: 22,
    fontWeight: typography.weights.bold,
    color: '#F8FAFC',
    marginTop: spacing.sm,
  },
  lockedText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
});
