/**
 * KaryaDEX — Game Intro Modal
 *
 * Presented automatically when a user opens a game for the first time.
 * Offers an interactive tutorial, practice sandbox, or quick skip.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { typography, radii, spacing } from '@/constants/theme';
import type { PlaygroundGameType } from '@/types/playground';
import { GAME_GUIDES } from '@/lib/playground/tutorials/guideContent';

interface GameIntroModalProps {
  visible: boolean;
  gameType: PlaygroundGameType;
  onStartTutorial: () => void;
  onStartPractice: () => void;
  onSkipAndPlay: () => void;
}

export function GameIntroModal({
  visible,
  gameType,
  onStartTutorial,
  onStartPractice,
  onSkipAndPlay,
}: GameIntroModalProps) {
  const guide = GAME_GUIDES[gameType];
  if (!guide) return null;

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style).catch(() => {});
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkipAndPlay}
    >
      <View style={styles.overlay}>
        <View style={styles.dialogCard}>
          {/* Header Icon & Category */}
          <View style={styles.badgeRow}>
            <View style={[styles.categoryBadge, { borderColor: `${guide.accentColor}40` }]}>
              <Text style={[styles.categoryText, { color: guide.accentColor }]}>
                {guide.category}
              </Text>
            </View>
            <View style={styles.taglinePill}>
              <Ionicons name="sparkles" size={12} color="#00D9FF" />
              <Text style={styles.taglinePillText}>First Time Intro</Text>
            </View>
          </View>

          {/* Title & Tagline */}
          <Text style={styles.gameTitle}>{guide.title}</Text>
          <Text style={styles.gameTagline}>{guide.tagline}</Text>

          {/* Overview */}
          <Text style={styles.overviewText}>{guide.overview}</Text>

          {/* Quick Highlights */}
          <View style={styles.highlightsContainer}>
            <View style={styles.highlightRow}>
              <Ionicons name="checkmark-circle" size={16} color={guide.accentColor} />
              <Text style={styles.highlightText}>
                Interactive 3-step action tutorial
              </Text>
            </View>
            <View style={styles.highlightRow}>
              <Ionicons name="checkmark-circle" size={16} color={guide.accentColor} />
              <Text style={styles.highlightText}>
                Safe practice mode with 0 score pressure
              </Text>
            </View>
          </View>

          {/* Action CTAs */}
          <View style={styles.actionColumn}>
            {/* Primary Action: Start Tutorial */}
            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                onStartTutorial();
              }}
              style={[styles.primaryButton, { backgroundColor: guide.accentColor }]}
              accessibilityRole="button"
              accessibilityLabel="Start Interactive Tutorial"
            >
              <Ionicons name="school" size={18} color="#000000" />
              <Text style={styles.primaryButtonText}>Start Interactive Tutorial</Text>
            </Pressable>

            {/* Secondary Action: Practice Mode */}
            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                onStartPractice();
              }}
              style={styles.secondaryButton}
              accessibilityRole="button"
              accessibilityLabel="Enter Practice Mode"
            >
              <Ionicons name="flask-outline" size={16} color="#00D9FF" />
              <Text style={styles.secondaryButtonText}>Practice Mode (Sandbox)</Text>
            </Pressable>

            {/* Skip & Play */}
            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                onSkipAndPlay();
              }}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel="Skip intro and play directly"
            >
              <Text style={styles.skipButtonText}>Skip & Play Directly</Text>
              <Feather name="arrow-right" size={14} color="#64748B" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F172A',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  categoryText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  taglinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  taglinePillText: {
    color: '#00D9FF',
    fontSize: 10,
    fontWeight: typography.weights.semibold,
  },
  gameTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.5,
  },
  gameTagline: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
  },
  overviewText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  highlightsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: 20,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  highlightText: {
    color: '#E2E8F0',
    fontSize: 12,
  },
  actionColumn: {
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: typography.weights.bold,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
    borderColor: 'rgba(0, 217, 255, 0.25)',
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: '#00D9FF',
    fontSize: 13,
    fontWeight: typography.weights.semibold,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  skipButtonText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: typography.weights.medium,
  },
});
