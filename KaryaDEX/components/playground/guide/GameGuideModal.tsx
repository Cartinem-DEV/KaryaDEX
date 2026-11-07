/**
 * KaryaDEX — Universal Game Guide Modal
 *
 * Full, replayable interactive documentation for all 4 Playground games.
 * Accessible from the in-game header '?' button or the lobby card info button.
 * Pauses game timers safely and allows launching the interactive tutorial at any time.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { typography, radii, spacing } from '@/constants/theme';
import type { PlaygroundGameType } from '@/types/playground';
import { GAME_GUIDES } from '@/lib/playground/tutorials/guideContent';

interface GameGuideModalProps {
  visible: boolean;
  gameType: PlaygroundGameType;
  onClose: () => void;
  onLaunchTutorial?: () => void;
  onLaunchPractice?: () => void;
}

type GuideTab = 'rules' | 'controls' | 'tips';

export function GameGuideModal({
  visible,
  gameType,
  onClose,
  onLaunchTutorial,
  onLaunchPractice,
}: GameGuideModalProps) {
  const [activeTab, setActiveTab] = useState<GuideTab>('rules');
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
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconBox, { backgroundColor: `${guide.accentColor}20` }]}>
                <Ionicons name="help-circle" size={20} color={guide.accentColor} />
              </View>
              <View>
                <Text style={styles.headerTitle}>{guide.title} Guide</Text>
                <Text style={styles.headerSubtitle}>{guide.category}</Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close Guide"
            >
              <Feather name="x" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('rules');
              }}
              style={[styles.tabItem, activeTab === 'rules' && styles.tabItemActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'rules' }}
            >
              <Ionicons
                name="book-outline"
                size={14}
                color={activeTab === 'rules' ? guide.accentColor : '#64748B'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'rules' && { color: guide.accentColor, fontWeight: typography.weights.bold },
                ]}
              >
                Rules
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('controls');
              }}
              style={[styles.tabItem, activeTab === 'controls' && styles.tabItemActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'controls' }}
            >
              <Ionicons
                name="game-controller-outline"
                size={14}
                color={activeTab === 'controls' ? guide.accentColor : '#64748B'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'controls' && { color: guide.accentColor, fontWeight: typography.weights.bold },
                ]}
              >
                Controls
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('tips');
              }}
              style={[styles.tabItem, activeTab === 'tips' && styles.tabItemActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'tips' }}
            >
              <Ionicons
                name="bulb-outline"
                size={14}
                color={activeTab === 'tips' ? guide.accentColor : '#64748B'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'tips' && { color: guide.accentColor, fontWeight: typography.weights.bold },
                ]}
              >
                Pro Tips
              </Text>
            </Pressable>
          </View>

          {/* Tab Content */}
          <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
            {activeTab === 'rules' && (
              <View style={styles.sectionBlock}>
                <Text style={styles.overviewParagraph}>{guide.overview}</Text>
                <Text style={styles.sectionHeading}>CORE RULES</Text>
                {guide.rules.map((rule, idx) => (
                  <View key={`rule-${idx}`} style={styles.ruleCard}>
                    <View style={[styles.ruleBullet, { backgroundColor: guide.accentColor }]}>
                      <Text style={styles.bulletNumber}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.ruleText}>{rule}</Text>
                  </View>
                ))}
              </View>
            )}

            {activeTab === 'controls' && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>TOUCH & GESTURE CONTROLS</Text>
                {guide.controls.map((ctrl, idx) => (
                  <View key={`ctrl-${idx}`} style={styles.controlCard}>
                    <View style={styles.actionPill}>
                      <Text style={styles.actionPillText}>{ctrl.action}</Text>
                    </View>
                    <Text style={styles.controlDesc}>{ctrl.description}</Text>
                  </View>
                ))}
              </View>
            )}

            {activeTab === 'tips' && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>TACTICAL PRO-TIPS</Text>
                {guide.proTips.map((tip, idx) => (
                  <View key={`tip-${idx}`} style={styles.tipCard}>
                    <Ionicons name="sparkles" size={16} color="#F59E0B" style={{ marginTop: 2 }} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer CTAs */}
          <View style={styles.footer}>
            {onLaunchTutorial && (
              <Pressable
                onPress={() => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                  onClose();
                  onLaunchTutorial();
                }}
                style={styles.tutorialButton}
                accessibilityRole="button"
                accessibilityLabel="Launch Interactive Tutorial"
              >
                <Ionicons name="school" size={16} color="#00D9FF" />
                <Text style={styles.tutorialButtonText}>Replay Tutorial</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              style={[styles.resumeButton, { backgroundColor: guide.accentColor }]}
              accessibilityRole="button"
              accessibilityLabel="Resume Game"
            >
              <Text style={styles.resumeButtonText}>Resume Game</Text>
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
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: typography.weights.bold,
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#00D9FF',
  },
  tabText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: typography.weights.medium,
  },
  contentScroll: {
    maxHeight: 380,
  },
  contentContainer: {
    padding: 20,
  },
  sectionBlock: {
    gap: 12,
  },
  overviewParagraph: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  sectionHeading: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  ruleBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  bulletNumber: {
    color: '#000000',
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  ruleText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  controlCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  actionPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    borderColor: 'rgba(0, 217, 255, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  actionPillText: {
    color: '#00D9FF',
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  controlDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
    borderColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  tipText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  tutorialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
    borderColor: 'rgba(0, 217, 255, 0.25)',
    borderWidth: 1,
  },
  tutorialButtonText: {
    color: '#00D9FF',
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  resumeButton: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  resumeButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: typography.weights.bold,
  },
});
