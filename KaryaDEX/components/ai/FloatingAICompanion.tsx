/**
 * BunkMatKar — Floating AI Companion (Phase 12.2)
 *
 * Universal floating AI button & animated persona selector.
 * Features:
 * - Subtle breathing idle animation (respects accessibility reduced-motion)
 * - Safe touch target (54x54 dp) positioned above liquid glass tab bar
 * - Animated Persona Selector (Banku vs Shanky)
 * - Clean transitions into shared AIAssistantModal
 * - Vector iconography only (monochrome/themed)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  AccessibilityInfo,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { AIAssistantModal } from './AIAssistantModal';
import type { AIPersonaId } from '@/services/ai';

import { MASCOT_ASSETS } from '@/constants/mascots';

interface FloatingAICompanionProps {
  currentScreen?: string;
  defaultSubjectId?: string;
}

export const FloatingAICompanion: React.FC<FloatingAICompanionProps> = ({
  currentScreen,
  defaultSubjectId,
}) => {
  const { colors, isDark } = useTheme();
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<AIPersonaId>('shanky');
  const [reduceMotion, setReduceMotion] = useState(false);

  // Breathing animation value
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      setReduceMotion(enabled);
    });

    if (!reduceMotion) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.06,
              duration: 2200,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.85,
              duration: 2200,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.0,
              duration: 2200,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.4,
              duration: 2200,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [reduceMotion]);

  const handleOpenSelector = () => {
    setSelectorVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 20,
      stiffness: 180,
      useNativeDriver: true,
    }).start();
  };

  const handleCloseSelector = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setSelectorVisible(false);
    });
  };

  const handleSelectPersona = (persona: AIPersonaId) => {
    setSelectedPersona(persona);
    handleCloseSelector();
    setTimeout(() => {
      setAssistantVisible(true);
    }, 220);
  };

  return (
    <>
      {/* ─── Floating Circular AI Button ─────────────────────── */}
      <View
        style={[
          styles.floatingContainer,
          {
            bottom: Platform.OS === 'ios' ? 94 : 80,
          },
        ]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.glowRing,
            {
              transform: [{ scale: pulseAnim }],
              opacity: glowAnim,
              backgroundColor: selectedPersona === 'banku'
                ? 'rgba(245, 158, 11, 0.35)'
                : 'rgba(0, 229, 255, 0.35)',
            },
          ]}
        />
        <TouchableOpacity
          style={[
            styles.fabButton,
            {
              backgroundColor: isDark ? '#0F172A' : '#1E293B',
              borderColor: selectedPersona === 'banku' ? '#F59E0B' : '#00E5FF',
            },
          ]}
          onPress={handleOpenSelector}
          activeOpacity={0.85}
          accessibilityLabel="Open AI Assistant Companion"
          accessibilityRole="button"
        >
          <Image
            source={selectedPersona === 'banku' ? MASCOT_ASSETS.banku.avatar : MASCOT_ASSETS.shanky.avatar}
            style={styles.fabMascotAvatar}
            resizeMode="contain"
          />
          <View
            style={[
              styles.personaIndicatorDot,
              {
                backgroundColor: selectedPersona === 'banku' ? '#F59E0B' : '#00E5FF',
              },
            ]}
          />
        </TouchableOpacity>
      </View>

      {/* ─── Animated Persona Selector Modal ─────────────────── */}
      <Modal
        visible={selectorVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseSelector}
      >
        <Pressable style={styles.backdrop} onPress={handleCloseSelector}>
          <Animated.View
            style={[
              styles.selectorSheet,
              {
                transform: [{ translateY: slideAnim }],
                backgroundColor: isDark ? '#0F172A' : '#1E293B',
              },
            ]}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Choose AI Companion</Text>
                <Text style={styles.sheetSubtitle}>Pick a specialized persona for your task</Text>
              </View>
              <TouchableOpacity onPress={handleCloseSelector} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Persona Choices */}
            <View style={styles.cardsContainer}>
              {/* Choice 1: BANKU */}
              <TouchableOpacity
                style={[
                  styles.personaCard,
                  styles.bankuCard,
                  selectedPersona === 'banku' && styles.selectedBankuCard,
                ]}
                onPress={() => handleSelectPersona('banku')}
                activeOpacity={0.85}
                accessibilityLabel="Select Banku for multimodal document and timetable extraction"
              >
                <View style={styles.cardHeaderRow}>
                  <Image
                    source={MASCOT_ASSETS.banku.avatar}
                    style={styles.cardMascotAvatar}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameBadgeRow}>
                      <Text style={[styles.cardName, { color: '#F59E0B' }]}>BANKU</Text>
                      <View style={styles.modelBadge}>
                        <Text style={styles.modelBadgeText}>Gemini 3.8 Flash</Text>
                      </View>
                    </View>
                    <Text style={styles.cardRole}>Vision & Academic Commander</Text>
                  </View>
                </View>

                <View style={styles.tagsRow}>
                  <View style={styles.tag}><Text style={styles.tagText}>Deep Academic Q&A</Text></View>
                  <View style={styles.tag}><Text style={styles.tagText}>Concepts & Engineering</Text></View>
                  <View style={styles.tag}><Text style={styles.tagText}>Timetable & PDF OCR</Text></View>
                  <View style={styles.tag}><Text style={styles.tagText}>Commands & Proposals</Text></View>
                </View>

                <View style={styles.actionBtnRow}>
                  <Text style={[styles.launchText, { color: '#F59E0B' }]}>Launch Banku</Text>
                  <Ionicons name="arrow-forward" size={14} color="#F59E0B" />
                </View>
              </TouchableOpacity>

              {/* Choice 2: SHANKY */}
              <TouchableOpacity
                style={[
                  styles.personaCard,
                  styles.shankyCard,
                  selectedPersona === 'shanky' && styles.selectedShankyCard,
                ]}
                onPress={() => handleSelectPersona('shanky')}
                activeOpacity={0.85}
                accessibilityLabel="Select Shanky for general academic conversation and study planning"
              >
                <View style={styles.cardHeaderRow}>
                  <Image
                    source={MASCOT_ASSETS.shanky.avatar}
                    style={styles.cardMascotAvatar}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameBadgeRow}>
                      <Text style={[styles.cardName, { color: '#00E5FF' }]}>SHANKY</Text>
                      <View style={[styles.modelBadge, { backgroundColor: 'rgba(0, 229, 255, 0.12)' }]}>
                        <Text style={[styles.modelBadgeText, { color: '#00E5FF' }]}>Mistral 8B</Text>
                      </View>
                    </View>
                    <Text style={styles.cardRole}>Tactical Co-Pilot & Chat AI</Text>
                  </View>
                </View>

                <View style={styles.tagsRow}>
                  <View style={styles.tag}><Text style={styles.tagText}>Fast Conversational Q&A</Text></View>
                  <View style={styles.tag}><Text style={styles.tagText}>Attendance Bunk Margins</Text></View>
                  <View style={styles.tag}><Text style={styles.tagText}>Study Hacks & Strategy</Text></View>
                  <View style={styles.tag}><Text style={styles.tagText}>Daily Briefing</Text></View>
                </View>

                <View style={styles.actionBtnRow}>
                  <Text style={[styles.launchText, { color: '#00E5FF' }]}>Launch Shanky</Text>
                  <Ionicons name="arrow-forward" size={14} color="#00E5FF" />
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ─── Shared AI Assistant Modal ──────────────────────── */}
      <AIAssistantModal
        visible={assistantVisible}
        onClose={() => setAssistantVisible(false)}
        initialPersona={selectedPersona}
        defaultSubjectId={defaultSubjectId}
      />
    </>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    right: 18,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  glowRing: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  fabButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(56, 189, 248, 0.25)',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
          elevation: 8,
        }),
  },
  fabMascotAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  personaIndicatorDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  selectorSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  sheetCloseBtn: {
    padding: 6,
  },
  cardsContainer: {
    gap: 12,
  },
  personaCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  bankuCard: {
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  selectedBankuCard: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  shankyCard: {
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  selectedShankyCard: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  cardMascotAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modelBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  modelBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F59E0B',
  },
  cardRole: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  launchText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
