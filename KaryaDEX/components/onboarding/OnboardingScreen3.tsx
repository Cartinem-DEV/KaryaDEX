/**
 * KaryaDEX — Onboarding Screen 03: Banku & Shanky Dual AI Showcase
 *
 * Implements the official mascot design board:
 * - Banku (Vision & Document Intelligence AI) with armored amber glass,
 *   graduation cap, luminous 'B' core, and document scanner.
 * - Shanky (Conversation & Planning AI) with sleek cyan pulse core,
 *   aerial fins, and holographic task planner.
 * - Interactive 3D Hero Stage with persona switcher pill, dynamic expression bar,
 *   and floating companion preview strip.
 * - Exact Screen 2 framing: Frosted glass top navigation bar, deep obsidian background (#080B11),
 *   dual ambient blooms (amber left / cyan right), 3-dot pagination (dot 3 active: • • ▬),
 *   and luminous "Continue →" CTA.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { OnboardingPaginationDots } from './OnboardingPaginationDots';

/* ═══════════════════════════════════════════════════════════════════════════
   ASSET MAPS (SLICED FROM MASCOT DESIGN BOARD)
   ═══════════════════════════════════════════════════════════════════════════ */

const MASCOT_ASSETS = {
  banku: {
    hero: require('@/assets/images/mascot/banku_hero.png'),
    avatar: require('@/assets/images/mascot/banku_avatar_circle.png'),
    poses: {
      idle: require('@/assets/images/mascot/banku_pose_idle.png'),
      scanning: require('@/assets/images/mascot/banku_pose_scanning.png'),
      analyzing: require('@/assets/images/mascot/banku_pose_analyzing.png'),
      success: require('@/assets/images/mascot/banku_pose_success.png'),
      thinking: require('@/assets/images/mascot/banku_pose_thinking.png'),
    },
    expressions: {
      idle: require('@/assets/images/mascot/banku_exp_idle.png'),
      scanning: require('@/assets/images/mascot/banku_exp_scanning.png'),
      analyzing: require('@/assets/images/mascot/banku_exp_analyzing.png'),
      success: require('@/assets/images/mascot/banku_exp_success.png'),
      thinking: require('@/assets/images/mascot/banku_exp_thinking.png'),
    },
  },
  shanky: {
    hero: require('@/assets/images/mascot/shanky_hero.png'),
    avatar: require('@/assets/images/mascot/shanky_avatar_circle.png'),
    poses: {
      idle: require('@/assets/images/mascot/shanky_pose_idle.png'),
      explaining: require('@/assets/images/mascot/shanky_pose_explaining.png'),
      planning: require('@/assets/images/mascot/shanky_pose_planning.png'),
      celebrating: require('@/assets/images/mascot/shanky_pose_celebrating.png'),
      curious: require('@/assets/images/mascot/shanky_pose_curious.png'),
    },
    expressions: {
      idle: require('@/assets/images/mascot/shanky_exp_idle.png'),
      explaining: require('@/assets/images/mascot/shanky_exp_explaining.png'),
      planning: require('@/assets/images/mascot/shanky_exp_planning.png'),
      celebrating: require('@/assets/images/mascot/shanky_exp_celebrating.png'),
      curious: require('@/assets/images/mascot/shanky_exp_curious.png'),
    },
  },
  dual: {
    illustration: require('@/assets/images/mascot/dual_illustration_card.png'),
  },
};

type PersonaKey = 'banku' | 'shanky' | 'dual';
type BankuState = 'idle' | 'scanning' | 'analyzing' | 'success' | 'thinking';
type ShankyState = 'idle' | 'explaining' | 'planning' | 'celebrating' | 'curious';

const BANKU_STATE_CONFIG: Record<BankuState, { label: string; telemetry: string }> = {
  idle: {
    label: 'Standby',
    telemetry: 'LIVE TELEMETRY • ACADEMIC INTEGRITY SENTINEL',
  },
  scanning: {
    label: 'Scanning',
    telemetry: 'LIVE TELEMETRY • SCANNING TIMETABLE & SYLLABUS',
  },
  analyzing: {
    label: 'Analyzing',
    telemetry: 'LIVE TELEMETRY • CURRICULUM & CREDIT AUDITING',
  },
  success: {
    label: 'Verified',
    telemetry: 'LIVE TELEMETRY • ZERO-DEBAR CREDITS SECURED',
  },
  thinking: {
    label: 'Optimizing',
    telemetry: 'LIVE TELEMETRY • COMPUTING OPTIMAL PATHWAY',
  },
};

const SHANKY_STATE_CONFIG: Record<ShankyState, { label: string; telemetry: string }> = {
  idle: {
    label: 'Standby',
    telemetry: 'LIVE TELEMETRY • ACTIVE CO-PILOT STANDBY',
  },
  explaining: {
    label: 'Insights',
    telemetry: 'LIVE TELEMETRY • ATTENDANCE MARGIN INSIGHTS',
  },
  planning: {
    label: 'Planning',
    telemetry: 'LIVE TELEMETRY • STRATEGIC STUDY PLANNING',
  },
  celebrating: {
    label: 'Milestone',
    telemetry: 'LIVE TELEMETRY • ATTENDANCE MILESTONE SECURED',
  },
  curious: {
    label: 'Inquire',
    telemetry: 'LIVE TELEMETRY • CONTEXTUAL INQUIRY ASSIST',
  },
};

interface OnboardingScreen3Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function OnboardingScreen3({ onNext, onBack, onSkip }: OnboardingScreen3Props) {
  const { width } = useWindowDimensions();
  const [activePersona, setActivePersona] = useState<PersonaKey>('banku');
  const [bankuState, setBankuState] = useState<BankuState>('scanning');
  const [shankyState, setShankyState] = useState<ShankyState>('planning');
  const [companionActive, setCompanionActive] = useState<'banku' | 'shanky'>('banku');

  // Animation values
  const floatAnim = useSharedValue(0);
  const corePulseAnim = useSharedValue(1);
  const cardScaleAnim = useSharedValue(1);
  const companionScaleAnim = useSharedValue(1);

  React.useEffect(() => {
    // Gentle hovering animation for Shanky & ambient breath for Banku
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Luminous core pulsating light
    corePulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [floatAnim, corePulseAnim]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnim.value }],
  }));

  const coreGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: corePulseAnim.value }],
    opacity: interpolate(corePulseAnim.value, [1, 1.12], [0.65, 0.95]),
  }));

  const mascotScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScaleAnim.value }],
  }));

  const handlePersonaSelect = useCallback((persona: PersonaKey) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    cardScaleAnim.value = 0.95;
    cardScaleAnim.value = withSpring(1, { damping: 15, stiffness: 200 });
    setActivePersona(persona);
    if (persona === 'banku') setCompanionActive('banku');
    if (persona === 'shanky') setCompanionActive('shanky');
  }, [cardScaleAnim]);

  const handleBankuStateSelect = (state: BankuState) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setBankuState(state);
    cardScaleAnim.value = 0.96;
    cardScaleAnim.value = withSpring(1, { damping: 14, stiffness: 220 });
  };

  const handleShankyStateSelect = (state: ShankyState) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setShankyState(state);
    cardScaleAnim.value = 0.96;
    cardScaleAnim.value = withSpring(1, { damping: 14, stiffness: 220 });
  };

  const handleCompanionTap = (who: 'banku' | 'shanky') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCompanionActive(who);
    companionScaleAnim.value = 0.92;
    companionScaleAnim.value = withSpring(1, { damping: 16, stiffness: 260 });
  };

  return (
    <View style={styles.container}>
      {/* ─── Ambient Atmospheric Background (Dual Glow Blooms) ─── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Left Amber Bloom */}
        <View style={styles.amberGlowOrb} />
        {/* Right Cyan Bloom */}
        <View style={styles.cyanGlowOrb} />
        {/* Upper Arc Highlight */}
        <View style={styles.orbitalArc} />
        {/* Floor Specular Light */}
        <View style={styles.floorReflection} />
      </View>

      {/* ─── 1. Top Header Bar (Identical to Screen 2) ──────────── */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
          ]}
        >
          <BlurView intensity={40} tint="dark" style={styles.backButtonBlur}>
            <Feather name="chevron-left" size={18} color="#FFFFFF" />
          </BlurView>
        </Pressable>

        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          style={({ pressed }) => [
            styles.skipPill,
            pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
          ]}
        >
          <BlurView intensity={40} tint="dark" style={styles.skipPillBlur}>
            <Text style={styles.skipText}>Skip</Text>
          </BlurView>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 2. Top Persona Switcher Pill ───────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.switcherContainer}>
          <View style={styles.personaSwitcherPill}>
            {/* Banku Segment */}
            <Pressable
              onPress={() => handlePersonaSelect('banku')}
              style={[
                styles.personaSegment,
                activePersona === 'banku' && styles.personaSegmentActiveBanku,
              ]}
            >
              <View style={[styles.personaDot, { backgroundColor: '#F59E0B' }]} />
              <Text
                style={[
                  styles.personaSegmentText,
                  activePersona === 'banku' && styles.personaSegmentTextActiveBanku,
                ]}
              >
                BANKU • Vision
              </Text>
            </Pressable>

            {/* Shanky Segment */}
            <Pressable
              onPress={() => handlePersonaSelect('shanky')}
              style={[
                styles.personaSegment,
                activePersona === 'shanky' && styles.personaSegmentActiveShanky,
              ]}
            >
              <View style={[styles.personaDot, { backgroundColor: '#06B6D4' }]} />
              <Text
                style={[
                  styles.personaSegmentText,
                  activePersona === 'shanky' && styles.personaSegmentTextActiveShanky,
                ]}
              >
                SHANKY • Planning
              </Text>
            </Pressable>

            {/* Dual Core Segment */}
            <Pressable
              onPress={() => handlePersonaSelect('dual')}
              style={[
                styles.personaSegment,
                activePersona === 'dual' && styles.personaSegmentActiveDual,
              ]}
            >
              <Feather
                name="cpu"
                size={12}
                color={activePersona === 'dual' ? '#00E5FF' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.personaSegmentText,
                  activePersona === 'dual' && styles.personaSegmentTextActiveDual,
                ]}
              >
                DUAL
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* ─── 3. Interactive Hero Stage Card ─────────────────────── */}
        <Animated.View entering={FadeIn.delay(200).duration(600)} style={styles.heroStageContainer}>
          {/* ─── MODE A: BANKU (Vision & Document Intelligence) ───── */}
          {activePersona === 'banku' && (
            <View style={styles.mascotCardBanku}>
              {/* Card Specular Top Rim */}
              <View style={[styles.cardSpecularRim, { backgroundColor: 'rgba(245, 158, 11, 0.45)' }]} />

              {/* Title & Tagline */}
              <View style={styles.cardHeaderRow}>
                <View>
                  <View style={styles.badgeRow}>
                    <Text style={styles.bankuTitle}>BANKU</Text>
                    <View style={styles.bankuTagBadge}>
                      <Text style={styles.bankuTagBadgeText}>VISION AI</Text>
                    </View>
                  </View>
                  <Text style={styles.bankuSubtitle}>
                    Your Vision & Document Intelligence AI
                  </Text>
                </View>
              </View>

              {/* Character Visual Showcase */}
              <View style={styles.mascotVisualArea}>
                {/* Luminous Glow Aura */}
                <Animated.View style={[styles.bankuCoreGlow, coreGlowStyle]} />
                <Animated.View style={[styles.mascotImageWrapper, mascotScaleStyle]}>
                  <Image
                    source={MASCOT_ASSETS.banku.poses[bankuState] || MASCOT_ASSETS.banku.hero}
                    style={styles.mascotPoseImage}
                    resizeMode="contain"
                  />
                </Animated.View>

                {/* Active Stance Pill */}
                <View style={styles.stancePillBanku}>
                  <View style={styles.stancePillDotBanku} />
                  <Text style={styles.stancePillTextBanku}>
                    {BANKU_STATE_CONFIG[bankuState].telemetry}
                  </Text>
                </View>
              </View>

              {/* Interactive Expression Bar */}
              <View style={styles.expressionBar}>
                <View style={styles.expressionHeaderRow}>
                  <Feather name="activity" size={11} color="#F59E0B" />
                  <Text style={styles.expressionTitle}>
                    ADAPTIVE COGNITIVE MODES
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.expChipRow}>
                  {(['idle', 'scanning', 'analyzing', 'success', 'thinking'] as BankuState[]).map((state) => {
                    const isSelected = bankuState === state;
                    return (
                      <Pressable
                        key={state}
                        onPress={() => handleBankuStateSelect(state)}
                        style={[
                          styles.expChip,
                          isSelected && styles.expChipSelectedBanku,
                        ]}
                      >
                        <Image
                          source={MASCOT_ASSETS.banku.expressions[state]}
                          style={styles.expThumbnail}
                          resizeMode="contain"
                        />
                        <Text
                          style={[
                            styles.expChipLabel,
                            isSelected && { color: '#F59E0B', fontWeight: '700' },
                          ]}
                        >
                          {BANKU_STATE_CONFIG[state].label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Capability List */}
              <View style={styles.capabilityList}>
                <View style={styles.capItem}>
                  <View style={[styles.capIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
                    <Feather name="file-text" size={14} color="#F59E0B" />
                  </View>
                  <Text style={styles.capText}>
                    Analyzes documents (timetable, syllabus, calendar)
                  </Text>
                </View>

                <View style={styles.capItem}>
                  <View style={[styles.capIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
                    <Feather name="layers" size={14} color="#F59E0B" />
                  </View>
                  <Text style={styles.capText}>
                    Extracts and organizes academic information
                  </Text>
                </View>

                <View style={styles.capItem}>
                  <View style={[styles.capIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
                    <Feather name="compass" size={14} color="#F59E0B" />
                  </View>
                  <Text style={styles.capText}>
                    Finds structure in chaos
                  </Text>
                </View>

                <View style={styles.capItem}>
                  <View style={[styles.capIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
                    <Feather name="shield" size={14} color="#F59E0B" />
                  </View>
                  <Text style={styles.capText}>
                    Reliable, calm and detail-focused academic guardian
                  </Text>
                </View>
              </View>

              {/* Character Details Footer Tags */}
              <View style={styles.characterDetailsRow}>
                <View style={styles.detailTag}>
                  <Text style={styles.detailTagText}>Expressive Digital Face</Text>
                </View>
                <View style={styles.detailTag}>
                  <Text style={styles.detailTagText}>Luminous B Core</Text>
                </View>
                <View style={styles.detailTag}>
                  <Text style={styles.detailTagText}>Document Scanning Mode</Text>
                </View>
                <View style={styles.detailTag}>
                  <Text style={styles.detailTagText}>Detailed Armour Design</Text>
                </View>
              </View>
            </View>
          )}

          {/* ─── MODE B: SHANKY (Conversation & Planning AI) ───────── */}
          {activePersona === 'shanky' && (
            <View style={styles.mascotCardShanky}>
              {/* Card Specular Top Rim */}
              <View style={[styles.cardSpecularRim, { backgroundColor: 'rgba(6, 182, 212, 0.45)' }]} />

              {/* Title & Tagline */}
              <View style={styles.cardHeaderRow}>
                <View>
                  <View style={styles.badgeRow}>
                    <Text style={styles.shankyTitle}>SHANKY</Text>
                    <View style={styles.shankyTagBadge}>
                      <Text style={styles.shankyTagBadgeText}>PLANNING AI</Text>
                    </View>
                  </View>
                  <Text style={styles.shankySubtitle}>
                    Your Conversation & Planning AI
                  </Text>
                </View>
              </View>

              {/* Character Visual Showcase */}
              <View style={styles.mascotVisualArea}>
                {/* Luminous Glow Aura */}
                <Animated.View style={[styles.shankyPulseGlow, coreGlowStyle]} />
                <Animated.View style={[styles.mascotImageWrapper, floatStyle, mascotScaleStyle]}>
                  <Image
                    source={MASCOT_ASSETS.shanky.poses[shankyState] || MASCOT_ASSETS.shanky.hero}
                    style={styles.mascotPoseImage}
                    resizeMode="contain"
                  />
                </Animated.View>

                {/* Active Stance Pill */}
                <View style={styles.stancePillShanky}>
                  <View style={styles.stancePillDotShanky} />
                  <Text style={styles.stancePillTextShanky}>
                    {SHANKY_STATE_CONFIG[shankyState].telemetry}
                  </Text>
                </View>
              </View>

              {/* Interactive Expression Bar */}
              <View style={styles.expressionBar}>
                <View style={styles.expressionHeaderRow}>
                  <Feather name="activity" size={11} color="#06B6D4" />
                  <Text style={[styles.expressionTitle, { color: '#06B6D4' }]}>
                    ADAPTIVE COGNITIVE MODES
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.expChipRow}>
                  {(['idle', 'explaining', 'planning', 'celebrating', 'curious'] as ShankyState[]).map((state) => {
                    const isSelected = shankyState === state;
                    return (
                      <Pressable
                        key={state}
                        onPress={() => handleShankyStateSelect(state)}
                        style={[
                          styles.expChip,
                          isSelected && styles.expChipSelectedShanky,
                        ]}
                      >
                        <Image
                          source={MASCOT_ASSETS.shanky.expressions[state]}
                          style={styles.expThumbnail}
                          resizeMode="contain"
                        />
                        <Text
                          style={[
                            styles.expChipLabel,
                            isSelected && { color: '#06B6D4', fontWeight: '700' },
                          ]}
                        >
                          {SHANKY_STATE_CONFIG[state].label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Capability List */}
              <View style={styles.capabilityList}>
                <View style={styles.capItem}>
                  <View style={[styles.capIconCircle, { backgroundColor: 'rgba(6, 182, 212, 0.18)' }]}>
                    <Feather name="help-circle" size={14} color="#06B6D4" />
                  </View>
                  <Text style={styles.capText}>
                    Answers your questions
                  </Text>
                </View>

                <View style={styles.capItem}>
                  <View style={[styles.capIconCircle, { backgroundColor: 'rgba(6, 182, 212, 0.18)' }]}>
                    <Feather name="check-square" size={14} color="#06B6D4" />
                  </View>
                  <Text style={styles.capText}>
                    Helps with planning and tasks
                  </Text>
                </View>

                <View style={styles.capItem}>
                  <View style={[styles.capIconCircle, { backgroundColor: 'rgba(6, 182, 212, 0.18)' }]}>
                    <Feather name="pie-chart" size={14} color="#06B6D4" />
                  </View>
                  <Text style={styles.capText}>
                    Explains attendance and academics
                  </Text>
                </View>

                <View style={styles.capItem}>
                  <View style={[styles.capIconCircle, { backgroundColor: 'rgba(6, 182, 212, 0.18)' }]}>
                    <Feather name="git-branch" size={14} color="#06B6D4" />
                  </View>
                  <Text style={styles.capText}>
                    Breaks complex problems into steps
                  </Text>
                </View>
              </View>

              {/* Character Details Footer Tags */}
              <View style={styles.characterDetailsRow}>
                <View style={[styles.detailTag, { borderColor: 'rgba(6, 182, 212, 0.3)' }]}>
                  <Text style={[styles.detailTagText, { color: '#BAE6FD' }]}>Expressive Digital Face</Text>
                </View>
                <View style={[styles.detailTag, { borderColor: 'rgba(6, 182, 212, 0.3)' }]}>
                  <Text style={[styles.detailTagText, { color: '#BAE6FD' }]}>Pulse Core</Text>
                </View>
                <View style={[styles.detailTag, { borderColor: 'rgba(6, 182, 212, 0.3)' }]}>
                  <Text style={[styles.detailTagText, { color: '#BAE6FD' }]}>Holographic UI Interaction</Text>
                </View>
                <View style={[styles.detailTag, { borderColor: 'rgba(6, 182, 212, 0.3)' }]}>
                  <Text style={[styles.detailTagText, { color: '#BAE6FD' }]}>Aerial Fins & Sleek Design</Text>
                </View>
              </View>
            </View>
          )}

          {/* ─── MODE C: DUAL ENGINE (Side-by-Side Co-Pilots) ──────── */}
          {activePersona === 'dual' && (
            <View style={styles.dualCardContainer}>
              <View style={[styles.cardSpecularRim, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]} />

              <View style={styles.cardHeaderRow}>
                <View>
                  <View style={styles.badgeRow}>
                    <Text style={styles.dualHeadlineText}>COOPERATIVE DUAL AI</Text>
                    <View style={styles.dualTagBadge}>
                      <Text style={styles.dualTagBadgeText}>CO-PILOTS</Text>
                    </View>
                  </View>
                  <Text style={styles.bankuSubtitle}>
                    Banku models structure · Shanky executes strategy
                  </Text>
                </View>
              </View>

              {/* Visual Showcase: Dual Illustration */}
              <View style={styles.dualIllustrationArea}>
                <Image
                  source={MASCOT_ASSETS.dual.illustration}
                  style={styles.dualIllustrationImage}
                  resizeMode="contain"
                />
              </View>

              {/* Split Cards: Banku vs Shanky Roles */}
              <View style={styles.splitRolesRow}>
                {/* Left Mini: Banku */}
                <View style={styles.miniRoleCardBanku}>
                  <View style={styles.miniRoleHeader}>
                    <Image source={MASCOT_ASSETS.banku.avatar} style={styles.miniAvatar} />
                    <Text style={styles.miniRoleTitleBanku}>BANKU</Text>
                  </View>
                  <Text style={styles.miniRoleDesc}>
                    Vision, OCR, Timetable parsing, and official syllabus structure.
                  </Text>
                </View>

                {/* Right Mini: Shanky */}
                <View style={styles.miniRoleCardShanky}>
                  <View style={styles.miniRoleHeader}>
                    <Image source={MASCOT_ASSETS.shanky.avatar} style={styles.miniAvatar} />
                    <Text style={styles.miniRoleTitleShanky}>SHANKY</Text>
                  </View>
                  <Text style={styles.miniRoleDesc}>
                    Daily planning, deadline alerts, study time-blocking & chat help.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>

        {/* ─── 4. Floating Companion Preview Strip ─────────────────── */}
        <Animated.View entering={FadeInUp.delay(350).duration(500)} style={styles.companionStripContainer}>
          <BlurView intensity={35} tint="dark" style={styles.companionStripBlur}>
            <View style={styles.companionStripContent}>
              <View style={styles.companionAvatarsRow}>
                {/* Banku Avatar */}
                <Pressable
                  onPress={() => handleCompanionTap('banku')}
                  style={[
                    styles.companionAvatarTouch,
                    companionActive === 'banku' && styles.companionAvatarActiveBanku,
                  ]}
                >
                  <Image source={MASCOT_ASSETS.banku.avatar} style={styles.companionAvatarImg} />
                  {companionActive === 'banku' && (
                    <View style={styles.activeCheckDotBanku}>
                      <Feather name="check" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>

                {/* Shanky Avatar */}
                <Pressable
                  onPress={() => handleCompanionTap('shanky')}
                  style={[
                    styles.companionAvatarTouch,
                    companionActive === 'shanky' && styles.companionAvatarActiveShanky,
                  ]}
                >
                  <Image source={MASCOT_ASSETS.shanky.avatar} style={styles.companionAvatarImg} />
                  {companionActive === 'shanky' && (
                    <View style={styles.activeCheckDotShanky}>
                      <Feather name="check" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              </View>

              <View style={styles.companionTextCol}>
                <Text style={styles.companionLabel}>
                  {companionActive === 'banku'
                    ? 'BANKU ACTIVE: Document Scanner & Timetable Vision'
                    : 'SHANKY ACTIVE: Conversational Planning & Study Assistant'}
                </Text>
                <Text style={styles.companionHint}>
                  Tap avatar to switch floating companion in-app
                </Text>
              </View>
            </View>
          </BlurView>
        </Animated.View>

        {/* ─── 5. Value Copy & Headline ───────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(450).duration(600)} style={styles.copySection}>
          <Text style={styles.headline}>
            {'Meet Banku & Shanky.\nYour Dual AI Engine.'}
          </Text>
          <Text style={styles.subtitle}>
            {'Banku extracts structure from routines and syllabi.\nShanky plans your tasks and explains your attendance.'}
          </Text>
        </Animated.View>
      </ScrollView>

      {/* ─── 6. Pagination & Bottom CTA ──────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.bottomSection}>
        {/* Pagination Dots (Screen 3 Active: • • ▬ •) */}
        <OnboardingPaginationDots
          activeIndex={2}
          totalDots={4}
          onPressDot={(index) => {
            if (index === 0 || index === 1) {
              onBack();
            } else if (index === 3) {
              onNext();
            }
          }}
        />

        {/* Primary CTA: Continue → */}
        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          style={({ pressed }) => [
            styles.ctaPillWrapper,
            pressed && styles.ctaPillPressed,
          ]}
        >
          {/* Diffused Left Amber Glow */}
          <View style={styles.ctaOuterAmberGlow} pointerEvents="none" />
          {/* Diffused Right Cyan Glow */}
          <View style={styles.ctaOuterCyanGlow} pointerEvents="none" />

          {/* Amber-to-Cyan Luminous Gradient Border */}
          <LinearGradient
            colors={[
              '#F59E0B',
              'rgba(245, 158, 11, 0.85)',
              'rgba(255, 255, 255, 0.40)',
              'rgba(0, 225, 255, 0.85)',
              '#00E5FF',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.ctaGradientBorder}
          >
            {/* Dark Translucent Glass Interior */}
            <View style={styles.ctaGlassFill}>
              {/* Inner Horizon Highlights */}
              <LinearGradient
                colors={['rgba(245, 158, 11, 0.32)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 0.45, y: 0.5 }}
                style={styles.ctaInnerAmberGaze}
                pointerEvents="none"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0, 225, 255, 0.32)']}
                start={{ x: 0.55, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.ctaInnerCyanGaze}
                pointerEvents="none"
              />

              <View style={styles.ctaSpecularRim} pointerEvents="none" />

              <View style={styles.ctaContentRow}>
                <Text style={styles.ctaLabel}>Continue</Text>
                <Feather name="arrow-right" size={18} color="#FFFFFF" style={styles.ctaArrowIcon} />
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const FONTS = {
  display: Platform.select({ web: "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif", default: 'Montserrat' }),
  condensed: Platform.select({ web: "'Oswald', -apple-system, sans-serif", default: 'Oswald' }),
  mono: Platform.select({ web: "'SpaceMono', monospace", default: 'SpaceMono' }),
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080B11',
  },

  /* Atmospheric Orbs */
  amberGlowOrb: {
    position: 'absolute',
    top: -50,
    left: -70,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  cyanGlowOrb: {
    position: 'absolute',
    bottom: 80,
    right: -60,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(6, 182, 212, 0.14)',
  },
  orbitalArc: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 440,
    height: 200,
    borderRadius: 220,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  floorReflection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },

  /* Header Bar */
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 14 : 20,
    paddingBottom: 8,
    zIndex: 20,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.20)',
  },
  backButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.40)',
  },
  skipPill: {
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.20)',
  },
  skipPillBlur: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.40)',
  },
  skipText: {
    fontFamily: FONTS.display,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  /* Scroll View */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  /* Top Segmented Persona Switcher */
  switcherContainer: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  personaSwitcherPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 99,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  personaSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  personaSegmentActiveBanku: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  personaSegmentActiveShanky: {
    backgroundColor: 'rgba(6, 182, 212, 0.22)',
    borderWidth: 1,
    borderColor: '#06B6D4',
  },
  personaSegmentActiveDual: {
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  personaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  personaSegmentText: {
    fontFamily: FONTS.display,
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  personaSegmentTextActiveBanku: {
    color: '#FDE68A',
    fontWeight: '800',
  },
  personaSegmentTextActiveShanky: {
    color: '#BAE6FD',
    fontWeight: '800',
  },
  personaSegmentTextActiveDual: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* Hero Stage Cards */
  heroStageContainer: {
    marginBottom: 12,
  },
  mascotCardBanku: {
    borderRadius: 22,
    backgroundColor: 'rgba(18, 20, 29, 0.80)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  mascotCardShanky: {
    borderRadius: 22,
    backgroundColor: 'rgba(14, 20, 32, 0.80)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  cardSpecularRim: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    borderRadius: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankuTitle: {
    fontFamily: FONTS.display,
    fontSize: 22,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 1.2,
  },
  bankuTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.50)',
  },
  bankuTagBadgeText: {
    fontFamily: FONTS.condensed,
    fontSize: 10,
    fontWeight: '700',
    color: '#FDE68A',
    letterSpacing: 1.4,
  },
  bankuSubtitle: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  shankyTitle: {
    fontFamily: FONTS.display,
    fontSize: 22,
    fontWeight: '900',
    color: '#06B6D4',
    letterSpacing: 1.2,
  },
  shankyTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(6, 182, 212, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.50)',
  },
  shankyTagBadgeText: {
    fontFamily: FONTS.condensed,
    fontSize: 10,
    fontWeight: '700',
    color: '#BAE6FD',
    letterSpacing: 1.4,
  },
  shankySubtitle: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  /* Mascot Visual Showcase */
  mascotVisualArea: {
    height: 205,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  bankuCoreGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(245, 158, 11, 0.28)',
  },
  shankyPulseGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(6, 182, 212, 0.30)',
  },
  mascotImageWrapper: {
    width: 190,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotPoseImage: {
    width: '100%',
    height: '100%',
  },

  /* Active Stance Badges */
  stancePillBanku: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 99,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    marginTop: 4,
  },
  stancePillDotBanku: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F59E0B',
  },
  stancePillTextBanku: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#FDE68A',
    letterSpacing: 0.8,
  },
  stancePillShanky: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 99,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    marginTop: 4,
  },
  stancePillDotShanky: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#06B6D4',
  },
  stancePillTextShanky: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#BAE6FD',
    letterSpacing: 0.8,
  },

  /* Interactive Expression Bar */
  expressionBar: {
    marginTop: 8,
    marginBottom: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  expressionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  expressionTitle: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 1.6,
  },
  expChipRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  expChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  expChipSelectedBanku: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#F59E0B',
  },
  expChipSelectedShanky: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    borderColor: '#06B6D4',
  },
  expThumbnail: {
    width: 20,
    height: 18,
  },
  expChipLabel: {
    fontFamily: FONTS.display,
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* Capability List */
  capabilityList: {
    gap: 7,
    marginVertical: 6,
  },
  capItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  capIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capText: {
    fontFamily: FONTS.display,
    flex: 1,
    fontSize: 12.5,
    color: '#E2E8F0',
    fontWeight: '500',
    lineHeight: 17,
    letterSpacing: 0.1,
  },

  /* Character Details Tags */
  characterDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  detailTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.30)',
  },
  detailTagText: {
    fontFamily: FONTS.condensed,
    fontSize: 10.5,
    color: '#FDE68A',
    fontWeight: '600',
    letterSpacing: 0.6,
  },

  /* Dual Mode Styles */
  dualCardContainer: {
    borderRadius: 22,
    backgroundColor: 'rgba(16, 20, 32, 0.80)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  dualHeadlineText: {
    fontFamily: FONTS.display,
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.0,
  },
  dualTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.20)',
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  dualTagBadgeText: {
    fontFamily: FONTS.condensed,
    fontSize: 10,
    fontWeight: '700',
    color: '#00E5FF',
    letterSpacing: 1.4,
  },
  dualIllustrationArea: {
    height: 125,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  dualIllustrationImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  splitRolesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  miniRoleCardBanku: {
    flex: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  miniRoleCardShanky: {
    flex: 1,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  miniRoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  miniRoleTitleBanku: {
    fontFamily: FONTS.display,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.8,
  },
  miniRoleTitleShanky: {
    fontFamily: FONTS.display,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#06B6D4',
    letterSpacing: 0.8,
  },
  miniRoleDesc: {
    fontFamily: FONTS.display,
    fontSize: 10.5,
    color: '#CBD5E1',
    lineHeight: 15,
    fontWeight: '400',
  },

  /* Floating Companion Preview Strip */
  companionStripContainer: {
    marginVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  companionStripBlur: {
    padding: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.60)',
  },
  companionStripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  companionAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  companionAvatarTouch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    padding: 2,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  companionAvatarActiveBanku: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  companionAvatarActiveShanky: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
  },
  companionAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  activeCheckDotBanku: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCheckDotShanky: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#06B6D4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  companionTextCol: {
    flex: 1,
  },
  companionLabel: {
    fontFamily: FONTS.display,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  companionHint: {
    fontFamily: FONTS.condensed,
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    letterSpacing: 0.5,
  },

  /* Copy Section */
  copySection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  headline: {
    fontFamily: FONTS.display,
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 33,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '400',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 7,
    letterSpacing: 0.1,
  },

  /* Bottom Section (Pagination & CTA) */
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 18,
    paddingTop: 4,
    alignItems: 'center',
  },
  ctaPillWrapper: {
    width: '100%',
    height: 54,
    borderRadius: 99,
    position: 'relative',
  },
  ctaPillPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.94,
  },
  ctaOuterAmberGlow: {
    position: 'absolute',
    left: 20,
    top: 4,
    width: '45%',
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(245, 158, 11, 0.40)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(16px)' } as any)
      : { opacity: 0.85 }),
  },
  ctaOuterCyanGlow: {
    position: 'absolute',
    right: 20,
    top: 4,
    width: '45%',
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0, 225, 255, 0.40)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(16px)' } as any)
      : { opacity: 0.85 }),
  },
  ctaGradientBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 99,
    padding: 1.2,
  },
  ctaGlassFill: {
    flex: 1,
    borderRadius: 99,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  ctaInnerAmberGaze: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '45%',
  },
  ctaInnerCyanGaze: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '45%',
  },
  ctaSpecularRim: {
    position: 'absolute',
    top: 0,
    left: 30,
    right: 30,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  ctaContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaLabel: {
    fontFamily: FONTS.display,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  ctaArrowIcon: {
    marginTop: 1,
  },
});
