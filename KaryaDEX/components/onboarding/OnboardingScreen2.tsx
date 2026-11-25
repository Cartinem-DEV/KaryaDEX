/**
 * KaryaDEX — Onboarding Screen 02: Attendance Mastery Showcase
 *
 * Authoritative Visual Reference Implementation:
 * - Exact atmosphere matching Screen 1: Cinematic obsidian black (#05070B)
 *   with dual ambient lighting (warm amber glow on left, electric cyan glow on right,
 *   upper orbital arc & floor reflection)
 * - Exact CTA button matching Screen 1: Dual-glow luminous pill with amber-to-cyan
 *   gradient border, dark glass fill, inner horizon highlights, specular rim, and "Continue →"
 * - 3D Tilted Interactive Plates: "Zero Debar Risk", "Verified Lab Credits", "Deterministic Tracking"
 *   rendered with 3D isometric tilt angles, tactile feedback, and smooth animated educational briefs on click
 * - Exchanged typography: "Master Your Attendance..." in Honk font, subtitle in Isometra font
 * - Central hero attendance gauge: SVG arc track with emerald→cyan→blue gradient
 * - Stylized mortarboard cap: Enlarged & positioned snugly hanging on the attendance circle with hanging tassel
 * - Pagination dots with electric cyan glowing active dot
 * - Synchronized 60fps GPU-accelerated micro-interactions via react-native-reanimated
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  AccessibilityInfo,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { OnboardingPaginationDots } from './OnboardingPaginationDots';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Path,
  RadialGradient,
  Polygon,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  interpolate,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  runOnJS,
} from 'react-native-reanimated';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES & EDUCATIONAL BRIEF DATA
   ═══════════════════════════════════════════════════════════════════════════ */

interface OnboardingScreen2Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

type BriefId = 'debar' | 'lab' | 'tracking';

interface PlateBriefData {
  id: BriefId;
  title: string;
  tagline: string;
  badge: string;
  accentColor: string;
  accentGlow: string;
  iconName: 'shield' | 'activity' | 'bar-chart-2';
  isFlaskIcon?: boolean;
  description: string;
  highlights: Array<{ icon: 'check-circle' | 'zap' | 'lock'; title: string; desc: string }>;
}

const BRIEFS: Record<BriefId, PlateBriefData> = {
  debar: {
    id: 'debar',
    title: 'Zero Debar Risk',
    tagline: 'EXAM ELIGIBILITY ENGINE',
    badge: '100% Guaranteed',
    accentColor: '#10B981',
    accentGlow: 'rgba(16, 185, 129, 0.35)',
    iconName: 'shield',
    description:
      'Stay comfortably above your attendance target. KaryaDEX continuously models your schedule rules and calculates your safe class margin in real time.',
    highlights: [
      {
        icon: 'check-circle',
        title: 'Safety Cushion Calculation',
        desc: 'Know your exact buffer above the mandatory 75% cutoff at all times.',
      },
      {
        icon: 'zap',
        title: 'Early Warning Alarms',
        desc: 'Instant alerts before an absence that would drop you below your mandated target.',
      },
      {
        icon: 'lock',
        title: 'Exam Hall Ticket Security',
        desc: 'Guarantees your attendance clearance on exam registration day.',
      },
    ],
  },
  lab: {
    id: 'lab',
    title: 'Verified Lab Credits',
    tagline: 'PRACTICAL & LAB SESSIONS',
    badge: 'Weighted Accounting',
    accentColor: '#06B6D4',
    accentGlow: 'rgba(6, 182, 212, 0.35)',
    iconName: 'activity',
    isFlaskIcon: true,
    description:
      'Lab courses carry heavy credit hours and strict attendance thresholds. Missing one 3-hour practical is equivalent to missing 3 lectures. We isolate and protect your lab credits.',
    highlights: [
      {
        icon: 'check-circle',
        title: 'Independent Lab Tracking',
        desc: 'Separate percentages for theory vs practical lab coursework.',
      },
      {
        icon: 'zap',
        title: 'Multi-Hour Slot Weighting',
        desc: 'Correctly accounts for double and triple laboratory periods.',
      },
      {
        icon: 'lock',
        title: 'External Viva Clearance',
        desc: 'Never risk losing practical exam marks due to attendance deficit.',
      },
    ],
  },
  tracking: {
    id: 'tracking',
    title: 'Deterministic Tracking',
    tagline: 'PRECISE MATH, ZERO GUESSWORK',
    badge: 'Slot-by-Slot Engine',
    accentColor: '#818CF8',
    accentGlow: 'rgba(129, 140, 248, 0.35)',
    iconName: 'bar-chart-2',
    description:
      'No approximations or loose estimates. Our engine deterministically calculates your attendance against your actual institutional timetable, official holidays, and proxy adjustments.',
    highlights: [
      {
        icon: 'check-circle',
        title: 'Timetable-Aware Precision',
        desc: 'Every lecture is mapped to its exact day, time, and faculty slot.',
      },
      {
        icon: 'zap',
        title: 'Holiday & Off-Day Intelligence',
        desc: 'Automatic exclusion of college festivals, strikes, and gazetted holidays.',
      },
      {
        icon: 'lock',
        title: 'Future Scenario Simulation',
        desc: '"What if I miss tomorrow?" — simulate your percentage before deciding.',
      },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS & 60FPS PRE-COMPUTED GEOMETRY
   ═══════════════════════════════════════════════════════════════════════════ */

// Exact atmosphere color from Screen 1
const BG_COLOR = '#05070B';
const GAUGE_SIZE = 220;
const GAUGE_STROKE = 10;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CENTER = GAUGE_SIZE / 2;
const ARC_PERCENT = 0.825; // 82.5%
// Arc starts at 135° (bottom-left) and sweeps 270° total
const ARC_START_ANGLE = 135;
const ARC_TOTAL_SWEEP = 270;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

// Pre-computed static geometry for 60fps gauge rendering (zero per-render trigonometric overhead)
const TRACK_PATH = describeArc(
  GAUGE_CENTER,
  GAUGE_CENTER,
  GAUGE_RADIUS,
  ARC_START_ANGLE,
  ARC_START_ANGLE + ARC_TOTAL_SWEEP,
);

const FILLED_SWEEP = ARC_TOTAL_SWEEP * ARC_PERCENT;
const FILLED_PATH = describeArc(
  GAUGE_CENTER,
  GAUGE_CENTER,
  GAUGE_RADIUS,
  ARC_START_ANGLE,
  ARC_START_ANGLE + FILLED_SWEEP,
);

const THUMB_ANGLE = ARC_START_ANGLE + FILLED_SWEEP;
const THUMB_POS = polarToCartesian(GAUGE_CENTER, GAUGE_CENTER, GAUGE_RADIUS, THUMB_ANGLE);

/* ═══════════════════════════════════════════════════════════════════════════
   MEMOIZED SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Mortarboard Cap SVG (Enlarged & Detailed: Hanging on Attendance Circle) ── */
const MortarboardCap = React.memo(function MortarboardCap({
  width = 155,
  height = 125,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 130 105">
      <Defs>
        <SvgLinearGradient id="capGradAmber" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#F59E0B" />
          <Stop offset="50%" stopColor="#D97706" />
          <Stop offset="100%" stopColor="#B45309" />
        </SvgLinearGradient>
        <SvgLinearGradient id="capBoardGrad" x1="0" y1="0" x2="1" y2="0.6">
          <Stop offset="0%" stopColor="#1E293B" />
          <Stop offset="40%" stopColor="#334155" />
          <Stop offset="70%" stopColor="#475569" />
          <Stop offset="100%" stopColor="#1E293B" />
        </SvgLinearGradient>
        <SvgLinearGradient id="capRimGold" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#F59E0B" />
          <Stop offset="50%" stopColor="#FDE68A" />
          <Stop offset="100%" stopColor="#D97706" />
        </SvgLinearGradient>
        <SvgLinearGradient id="capEdgeBevel" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#D97706" />
          <Stop offset="100%" stopColor="#78350F" />
        </SvgLinearGradient>
      </Defs>

      {/* Skull cap crown / base (under-cup that hugs and rests on the gauge circle) */}
      <Path
        d="M 44 48 L 44 66 Q 66 78 88 66 L 88 48 Z"
        fill="url(#capGradAmber)"
        opacity={0.88}
      />
      {/* Crown base inner rim highlight */}
      <Path
        d="M 44 66 Q 66 78 88 66"
        fill="none"
        stroke="url(#capRimGold)"
        strokeWidth={1.5}
        opacity={0.9}
      />

      {/* Board 3D Bevel Edge thickness */}
      <Polygon
        points="14,35 66,51 66,55 14,39"
        fill="url(#capEdgeBevel)"
        opacity={0.9}
      />
      <Polygon
        points="66,51 118,35 118,39 66,55"
        fill="url(#capEdgeBevel)"
        opacity={0.7}
      />

      {/* Board (top diamond surface) */}
      <Polygon
        points="14,35 66,13 118,35 66,51"
        fill="url(#capBoardGrad)"
        stroke="url(#capRimGold)"
        strokeWidth={0.8}
      />

      {/* Gold specular ridge along top two edges */}
      <Path
        d="M 14 35 L 66 13 L 118 35"
        fill="none"
        stroke="url(#capRimGold)"
        strokeWidth={1.8}
        opacity={0.95}
      />

      {/* Glass specular highlight across top diamond surface */}
      <Path
        d="M 30 33 L 66 17 L 102 33"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={0.7}
        opacity={0.4}
      />

      {/* Center button */}
      <Circle cx={66} cy={32} r={3.2} fill="#FDE68A" />
      <Circle cx={66} cy={32} r={1.5} fill="#D97706" />

      {/* Golden braided tassel cord — curves gracefully over the left corner */}
      <Path
        d="M 64 33 Q 36 38 20 54 Q 14 66 14 74"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      {/* Tassel cord highlight */}
      <Path
        d="M 64 32.5 Q 36 37.5 20 53.5 Q 14 65.5 14 73.5"
        fill="none"
        stroke="#FDE68A"
        strokeWidth={0.6}
        strokeLinecap="round"
        opacity={0.8}
      />

      {/* Tassel ring/knot collar */}
      <Circle cx={14} cy={74} r={3.5} fill="#D97706" />
      <Circle cx={14} cy={74} r={2.5} fill="#FDE68A" />

      {/* Tassel fringe hanging down along the perimeter of the circle */}
      <Path
        d="M 11 77 L 8 96 M 12.5 77 L 11 100 M 14 77 L 14 102 M 15.5 77 L 17 99 M 17 77 L 20 95"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {/* Tassel fringe shimmering highlights */}
      <Path
        d="M 13 78 L 12.5 98 M 14.5 78 L 15 101"
        fill="none"
        stroke="#FDE68A"
        strokeWidth={0.8}
        strokeLinecap="round"
        opacity={0.9}
      />
    </Svg>
  );
});

/* ─── Hero Attendance Gauge SVG ────────────────────────────────────────── */
const AttendanceGaugeSVG = React.memo(function AttendanceGaugeSVG() {
  return (
    <Svg width={GAUGE_SIZE} height={GAUGE_SIZE} viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}>
      <Defs>
        {/* Arc gradient: emerald → cyan → blue */}
        <SvgLinearGradient id="arcGrad" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor="#10B981" />
          <Stop offset="50%" stopColor="#06B6D4" />
          <Stop offset="100%" stopColor="#3B82F6" />
        </SvgLinearGradient>

        {/* Outer rim glow */}
        <RadialGradient id="outerRimGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="85%" stopColor="transparent" />
          <Stop offset="95%" stopColor="rgba(6, 182, 212, 0.12)" />
          <Stop offset="100%" stopColor="rgba(6, 182, 212, 0.04)" />
        </RadialGradient>

        {/* Thumb glow */}
        <RadialGradient id="thumbGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
          <Stop offset="40%" stopColor="#10B981" stopOpacity={0.8} />
          <Stop offset="100%" stopColor="#10B981" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Outer concentric glass rim */}
      <Circle
        cx={GAUGE_CENTER}
        cy={GAUGE_CENTER}
        r={GAUGE_RADIUS + 14}
        fill="none"
        stroke="rgba(6, 182, 212, 0.08)"
        strokeWidth={1}
      />
      <Circle
        cx={GAUGE_CENTER}
        cy={GAUGE_CENTER}
        r={GAUGE_RADIUS + 20}
        fill="none"
        stroke="rgba(6, 182, 212, 0.04)"
        strokeWidth={0.5}
      />

      {/* Outer glow fill */}
      <Circle
        cx={GAUGE_CENTER}
        cy={GAUGE_CENTER}
        r={GAUGE_RADIUS + 14}
        fill="url(#outerRimGlow)"
      />

      {/* Background track (dim) */}
      <Path
        d={TRACK_PATH}
        fill="none"
        stroke="rgba(255, 255, 255, 0.06)"
        strokeWidth={GAUGE_STROKE}
        strokeLinecap="round"
      />

      {/* Filled gradient arc */}
      <Path
        d={FILLED_PATH}
        fill="none"
        stroke="url(#arcGrad)"
        strokeWidth={GAUGE_STROKE}
        strokeLinecap="round"
      />

      {/* Arc glow behind the filled arc */}
      <Path
        d={FILLED_PATH}
        fill="none"
        stroke="url(#arcGrad)"
        strokeWidth={GAUGE_STROKE + 8}
        strokeLinecap="round"
        opacity={0.15}
      />

      {/* Glowing spherical thumb */}
      <Circle
        cx={THUMB_POS.x}
        cy={THUMB_POS.y}
        r={12}
        fill="url(#thumbGlow)"
      />
      <Circle
        cx={THUMB_POS.x}
        cy={THUMB_POS.y}
        r={7}
        fill="#10B981"
      />
      {/* Specular highlight on thumb */}
      <Circle
        cx={THUMB_POS.x - 2}
        cy={THUMB_POS.y - 2}
        r={3}
        fill="rgba(255, 255, 255, 0.7)"
      />
    </Svg>
  );
});

/* ─── Flask/Beaker Icon SVG ────────────────────────────────────────────── */
const FlaskIcon = React.memo(function FlaskIcon({ size = 20, color = '#06B6D4' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 3h6M10 3v6.5L4 18.5C3.3 19.6 4.1 21 5.4 21h13.2c1.3 0 2.1-1.4 1.4-2.5L14 9.5V3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.5 15h9"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
});

/* ─── 3D Tilted Interactive Glass Block Component ──────────────────────── */
interface OrbitBlockProps {
  icon: React.ReactNode;
  label: string;
  borderColor: string;
  glowColor: string;
  accentColor: string;
  onPress: () => void;
  style?: any;
}

const OrbitBlock = React.memo(function OrbitBlock({
  icon,
  label,
  borderColor,
  glowColor,
  accentColor,
  onPress,
  style,
}: OrbitBlockProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Explain ${label.replace('\n', ' ')}`}
      style={({ pressed }) => [
        styles.blockContainer,
        style,
        pressed && styles.blockPressed,
      ]}
    >
      {/* 1. Deep Cast Ambient Shadow & Colored Glow */}
      <View
        style={[
          styles.blockCastGlow,
          {
            shadowColor: glowColor,
            ...(Platform.OS === 'web'
              ? ({
                  boxShadow: `0 16px 28px -6px rgba(0, 0, 0, 0.75), 0 8px 18px -4px ${glowColor}`,
                } as any)
              : {}),
          },
        ]}
        pointerEvents="none"
      />

      {/* 2. 3D Extruded Block Thickness (Physical bottom & side shelf) */}
      <View
        style={[
          styles.blockExtrusionShelf,
          {
            borderColor: accentColor,
            backgroundColor: '#070B14',
          },
        ]}
        pointerEvents="none"
      >
        <View style={[styles.blockExtrusionBevel, { backgroundColor: glowColor }]} />
      </View>

      {/* 3. Main 3D Front Face (Raised Glass Slab) */}
      <View style={[styles.blockFrontFace, { borderColor }]}>
        {/* Specular Ridge Lighting across top and left edge */}
        <View style={styles.blockSpecularRidgeTop} pointerEvents="none" />
        <View style={styles.blockSpecularRidgeLeft} pointerEvents="none" />

        <BlurView intensity={65} tint="dark" style={styles.blockBlur}>
          <LinearGradient
            colors={['rgba(30, 42, 64, 0.88)', 'rgba(12, 18, 32, 0.96)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.blockGradientSurface}
          >
            <View style={styles.blockContentRow}>
              {/* Embossed Icon Container with neon halo */}
              <View
                style={[
                  styles.blockIconPad,
                  {
                    backgroundColor: glowColor,
                    borderColor: accentColor,
                  },
                ]}
              >
                {icon}
              </View>

              {/* Bold High-Contrast Text Label */}
              <View style={styles.blockTextWrapper}>
                <Text style={styles.blockLabel}>{label}</Text>
              </View>

              {/* 3D Action Pill Indicator */}
              <View
                style={[
                  styles.blockInfoBadge,
                  {
                    backgroundColor: glowColor,
                    borderColor: accentColor,
                  },
                ]}
              >
                <Feather name="info" size={11} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </BlurView>
      </View>
    </Pressable>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function OnboardingScreen2({ onNext, onBack, onSkip }: OnboardingScreen2Props) {
  const { width } = useWindowDimensions();

  // Load custom fonts with safe fallbacks
  const [fontsLoaded] = useFonts({
    Isometra: require('../../assets/fonts/Isometra-Regular.ttf'),
    Honk: require('../../assets/fonts/Honk-Regular.ttf'),
  });

  // State for interactive explanation modal
  const [activeBrief, setActiveBrief] = useState<BriefId | null>(null);
  const briefProgress = useSharedValue(0);

  const openBrief = (id: BriefId) => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
    setActiveBrief(id);
    briefProgress.value = 0;
    briefProgress.value = withSpring(1, {
      damping: 20,
      stiffness: 220,
      mass: 0.85,
    });
  };

  const closeBrief = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
    briefProgress.value = withTiming(
      0,
      { duration: 240, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setActiveBrief)(null);
        }
      }
    );
  };

  // Responsive gauge scale clamped cleanly
  const gaugeScale = Math.min(width / 400, 1);

  // ─── Reanimated 60fps shared values (GPU / UI thread driven) ─────────
  const floatY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.45);
  const cardFloat1 = useSharedValue(0);
  const cardFloat2 = useSharedValue(0);
  const cardFloat3 = useSharedValue(0);
  const blockTilt1 = useSharedValue(0);
  const blockTilt2 = useSharedValue(0);
  const blockTilt3 = useSharedValue(0);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!isMounted) return;

      if (reduceMotion) {
        floatY.value = 0;
        glowOpacity.value = 0.6;
        cardFloat1.value = 0;
        cardFloat2.value = 0;
        cardFloat3.value = 0;
        blockTilt1.value = 0;
        blockTilt2.value = 0;
        blockTilt3.value = 0;
        return;
      }

      // Gentle floating for the central gauge composite (smooth 60fps sine wave)
      floatY.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
          withTiming(6, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );

      // Smooth CTA glow pulse (direct opacity without per-frame interpolation overhead)
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.45, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );

      // Staggered floating & 3D tilt breathing for orbit blocks — running on UI thread at 60fps
      cardFloat1.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
          withTiming(8, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
      blockTilt1.value = withRepeat(
        withSequence(
          withTiming(-1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );

      cardFloat2.value = withDelay(
        350,
        withRepeat(
          withSequence(
            withTiming(8, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
            withTiming(-8, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
      blockTilt2.value = withDelay(
        350,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
            withTiming(-1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );

      cardFloat3.value = withDelay(
        700,
        withRepeat(
          withSequence(
            withTiming(-7, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
            withTiming(7, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
      blockTilt3.value = withDelay(
        700,
        withRepeat(
          withSequence(
            withTiming(-1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    });

    return () => {
      isMounted = false;
    };
  }, [blockTilt1, blockTilt2, blockTilt3, cardFloat1, cardFloat2, cardFloat3, floatY, glowOpacity]);

  // Combined scale & float transform directly inside useAnimatedStyle prevents style conflict
  const gaugeFloatStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: gaugeScale },
      { translateY: floatY.value },
    ],
  }));

  // Enhanced 3D Isometric Tilt Angles + 60fps dynamic 3D visuals on GPU
  const plate1Style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 450 },
      { rotateX: `${25 + blockTilt1.value * 2.5}deg` },
      { rotateY: `${-28 + blockTilt1.value * 2}deg` },
      { rotateZ: '-6deg' },
      { translateY: cardFloat1.value },
    ],
  }));

  const plate2Style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 450 },
      { rotateX: `${-24 + blockTilt2.value * 2.5}deg` },
      { rotateY: `${28 + blockTilt2.value * 2}deg` },
      { rotateZ: '6deg' },
      { translateY: cardFloat2.value },
    ],
  }));

  const plate3Style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 450 },
      { rotateX: `${-24 + blockTilt3.value * 2.5}deg` },
      { rotateY: `${-28 + blockTilt3.value * 2}deg` },
      { rotateZ: '-5deg' },
      { translateY: cardFloat3.value },
    ],
  }));

  const ctaGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Animated styles for educational brief modal (Smooth UPWARD rising entrance)
  const modalBackdropStyle = useAnimatedStyle(() => ({
    opacity: briefProgress.value,
  }));

  const modalContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(briefProgress.value, [0, 0.35, 1], [0, 0.85, 1]),
    transform: [
      { scale: interpolate(briefProgress.value, [0, 1], [0.84, 1]) },
      { translateY: interpolate(briefProgress.value, [0, 1], [260, 0]) },
    ],
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ─── A. Cinematic Atmospheric Background (Matching Screen 1) ─── */}
      <View style={styles.bgLayer} pointerEvents="none">
        {/* Warm Golden/Amber Ambient Glow (Left / Lower-Left) */}
        <View style={styles.amberGlowOrb} />
        {/* Electric Cyan/Blue Ambient Glow (Right / Lower-Right) */}
        <View style={styles.cyanGlowOrb} />
        {/* Atmospheric Upper Orbital Arc */}
        <View style={styles.orbitalArc} />
        {/* Subtle Horizontal Floor Reflection */}
        <View style={styles.floorReflection} />
      </View>

      {/* ─── 1. Top Header Bar ─────────────────────────────────────── */}
      <View style={styles.headerBar}>
        {/* Back button — frosted glass circle */}
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

        {/* Skip pill — frosted glass capsule */}
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

      {/* ─── 2. Central Hero Gauge & 3D Glass Composition ──────────── */}
      <Animated.View entering={FadeIn.duration(600)} style={styles.gaugeWrapper}>
        <Animated.View
          style={[styles.gaugeComposite, gaugeFloatStyle]}
          renderToHardwareTextureAndroid={true}
          shouldRasterizeIOS={true}
        >
          {/* Mortarboard Cap — enlarged & snugly resting on the attendance circle */}
          <View style={styles.mortarboardContainer}>
            <MortarboardCap width={155} height={125} />
          </View>

          {/* Main Circular Gauge */}
          <View style={styles.gaugeContainer}>
            <AttendanceGaugeSVG />

            {/* Core Metric Display — centered inside ring */}
            <View style={styles.gaugeMetric}>
              <Text style={styles.gaugeValue}>82.5<Text style={styles.gaugePercent}>%</Text></Text>
              <Text style={styles.gaugeSubtitle}>Attendance</Text>

              {/* Safety Cushion Badge — Above 75% Target */}
              <View style={styles.cushionBadge}>
                <Feather name="trending-up" size={12} color="#10B981" />
                <Text style={styles.cushionText}>
                  Safety Cushion:{'\n'}Above 75%
                </Text>
              </View>
            </View>
          </View>

          {/* ─── 3. Three 3D Tilted Interactive Blocks ───────────────── */}

          {/* Block 1: Top-Right — Zero Debar Risk */}
          <Animated.View
            style={[styles.orbitCardPos1, plate1Style]}
            renderToHardwareTextureAndroid={true}
            shouldRasterizeIOS={true}
          >
            <OrbitBlock
              icon={
                <View style={[styles.orbitIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.25)' }]}>
                  <Feather name="shield" size={16} color="#10B981" />
                </View>
              }
              label={"Zero\nDebar Risk"}
              borderColor="rgba(16, 185, 129, 0.65)"
              glowColor="rgba(16, 185, 129, 0.40)"
              accentColor="#10B981"
              onPress={() => openBrief('debar')}
            />
          </Animated.View>

          {/* Block 2: Bottom-Left — Verified Lab Credits */}
          <Animated.View
            style={[styles.orbitCardPos2, plate2Style]}
            renderToHardwareTextureAndroid={true}
            shouldRasterizeIOS={true}
          >
            <OrbitBlock
              icon={
                <View style={[styles.orbitIconCircle, { backgroundColor: 'rgba(6, 182, 212, 0.25)' }]}>
                  <FlaskIcon size={16} color="#06B6D4" />
                </View>
              }
              label={"Verified\nLab Credits"}
              borderColor="rgba(6, 182, 212, 0.65)"
              glowColor="rgba(6, 182, 212, 0.40)"
              accentColor="#06B6D4"
              onPress={() => openBrief('lab')}
            />
          </Animated.View>

          {/* Block 3: Bottom-Right — Deterministic Tracking */}
          <Animated.View
            style={[styles.orbitCardPos3, plate3Style]}
            renderToHardwareTextureAndroid={true}
            shouldRasterizeIOS={true}
          >
            <OrbitBlock
              icon={
                <View style={[styles.orbitIconCircle, { backgroundColor: 'rgba(129, 140, 248, 0.25)' }]}>
                  <Feather name="bar-chart-2" size={16} color="#818CF8" />
                </View>
              }
              label={"Deterministic\nTracking"}
              borderColor="rgba(129, 140, 248, 0.65)"
              glowColor="rgba(129, 140, 248, 0.40)"
              accentColor="#818CF8"
              onPress={() => openBrief('tracking')}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* ─── 4. Value Copy & Headline with EXCHANGED Fonts ──────────── */}
      {/* Headline in Honk, Subtitle in Isometra */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(600)}
        style={styles.copySection}
      >
        <Text style={[styles.headline, fontsLoaded && { fontFamily: 'Honk' }]}>
          {'Master Your Attendance.\nEliminate the Panic.'}
        </Text>
        <Text style={[styles.subtitle, fontsLoaded && { fontFamily: 'Isometra' }]}>
          {'Complete visibility over every credit hour\nso you never risk a low-attendance notice.'}
        </Text>
      </Animated.View>

      {/* ─── 5. Pagination & CTA Button (Exact Screen 1 Style) ──────── */}
      <Animated.View
        entering={FadeInDown.delay(500).duration(600)}
        style={styles.bottomSection}
      >
        {/* Pagination 4-Dotted Bar (Monitoring Screen 2) */}
        <OnboardingPaginationDots
          activeIndex={1}
          totalDots={4}
          onPressDot={(index) => {
            if (index === 0) {
              onBack();
            } else if (index === 2 || index === 3) {
              onNext();
            }
          }}
        />

        {/* Primary CTA: Continue → (Identical to Screen 1) */}
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
          <Animated.View
            style={[styles.ctaOuterAmberGlow, ctaGlowStyle]}
            pointerEvents="none"
            renderToHardwareTextureAndroid={true}
            shouldRasterizeIOS={true}
          />
          {/* Diffused Right Cyan Glow */}
          <Animated.View
            style={[styles.ctaOuterCyanGlow, ctaGlowStyle]}
            pointerEvents="none"
            renderToHardwareTextureAndroid={true}
            shouldRasterizeIOS={true}
          />

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
              {/* Inner Left Amber Horizon Highlight */}
              <LinearGradient
                colors={['rgba(245, 158, 11, 0.32)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 0.45, y: 0.5 }}
                style={styles.ctaInnerAmberGaze}
                pointerEvents="none"
              />

              {/* Inner Right Cyan Horizon Highlight */}
              <LinearGradient
                colors={['transparent', 'rgba(0, 225, 255, 0.32)']}
                start={{ x: 0.55, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.ctaInnerCyanGaze}
                pointerEvents="none"
              />

              {/* Top Specular Rim Reflection */}
              <View style={styles.ctaSpecularRim} pointerEvents="none" />

              {/* Button Content */}
              <View style={styles.ctaContentRow}>
                <Text style={styles.ctaLabel}>Continue</Text>
                <Text style={styles.ctaArrowSymbol}>→</Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* ─── 6. Smooth Animated Educational Brief Modal (UPWARD In Front) ── */}
      {activeBrief && (
        <View style={styles.modalRootContainer} pointerEvents="box-none">
          {/* Frosted Backdrop with Deep Darkening */}
          <Animated.View style={[StyleSheet.absoluteFill, modalBackdropStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeBrief}>
              <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.modalDarkOverlay} />
            </Pressable>
          </Animated.View>

          {/* Modal Container */}
          <View style={styles.modalCenterContainer} pointerEvents="box-none">
            <Animated.View style={[styles.modalCard, modalContentStyle]}>
              <BlurView intensity={80} tint="dark" style={styles.modalCardBlur}>
                {/* Accent top glow bar */}
                <View
                  style={[
                    styles.modalAccentGlowBar,
                    { backgroundColor: BRIEFS[activeBrief].accentColor },
                  ]}
                />

                {/* Header Row */}
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalHeaderLeft}>
                    <View
                      style={[
                        styles.modalIconCircle,
                        {
                          backgroundColor: BRIEFS[activeBrief].accentGlow,
                          borderColor: BRIEFS[activeBrief].accentColor,
                        },
                      ]}
                    >
                      {BRIEFS[activeBrief].isFlaskIcon ? (
                        <FlaskIcon size={22} color={BRIEFS[activeBrief].accentColor} />
                      ) : (
                        <Feather
                          name={BRIEFS[activeBrief].iconName}
                          size={22}
                          color={BRIEFS[activeBrief].accentColor}
                        />
                      )}
                    </View>
                    <View style={styles.modalTitleColumn}>
                      <View style={styles.modalBadgeRow}>
                        <Text
                          style={[
                            styles.modalTagline,
                            { color: BRIEFS[activeBrief].accentColor },
                          ]}
                        >
                          {BRIEFS[activeBrief].tagline}
                        </Text>
                      </View>
                      <Text style={styles.modalTitle}>{BRIEFS[activeBrief].title}</Text>
                    </View>
                  </View>

                  {/* Close button */}
                  <Pressable
                    onPress={closeBrief}
                    accessibilityRole="button"
                    accessibilityLabel="Close brief"
                    style={({ pressed }) => [
                      styles.modalCloseButton,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Feather name="x" size={20} color="rgba(255, 255, 255, 0.7)" />
                  </Pressable>
                </View>

                {/* Description Body */}
                <Text style={styles.modalDescription}>
                  {BRIEFS[activeBrief].description}
                </Text>

                {/* Highlights list */}
                <View style={styles.modalHighlightsList}>
                  {BRIEFS[activeBrief].highlights.map((h, i) => (
                    <View key={i} style={styles.modalHighlightItem}>
                      <View
                        style={[
                          styles.highlightIconDot,
                          { backgroundColor: BRIEFS[activeBrief].accentGlow },
                        ]}
                      >
                        <Feather
                          name={h.icon}
                          size={14}
                          color={BRIEFS[activeBrief].accentColor}
                        />
                      </View>
                      <View style={styles.highlightTextCol}>
                        <Text style={styles.highlightTitle}>{h.title}</Text>
                        <Text style={styles.highlightDesc}>{h.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Dismiss Action Pill */}
                <Pressable
                  onPress={closeBrief}
                  accessibilityRole="button"
                  accessibilityLabel="Got it"
                  style={({ pressed }) => [
                    styles.modalGotItButton,
                    { borderColor: BRIEFS[activeBrief].accentColor },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      BRIEFS[activeBrief].accentColor,
                      'rgba(10, 14, 24, 0.85)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalGotItGradient}
                  >
                    <Text style={styles.modalGotItText}>Got it, understood</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </LinearGradient>
                </Pressable>
              </BlurView>
            </Animated.View>
          </View>
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_COLOR,
    position: 'relative',
    overflow: 'hidden',
  },

  /* ─── Atmospheric Background (Exact match to Screen 1) ────────── */
  bgLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  amberGlowOrb: {
    position: 'absolute',
    left: -80,
    top: '18%',
    width: 300,
    height: 480,
    borderRadius: 150,
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(64px)' } as any)
      : { opacity: 0.9 }),
  },
  cyanGlowOrb: {
    position: 'absolute',
    right: -80,
    top: '26%',
    width: 320,
    height: 500,
    borderRadius: 160,
    backgroundColor: 'rgba(0, 225, 255, 0.22)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(64px)' } as any)
      : { opacity: 0.9 }),
  },
  orbitalArc: {
    position: 'absolute',
    alignSelf: 'center',
    top: '8%',
    width: 420,
    height: 420,
    borderRadius: 210,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.07)',
    transform: [{ rotate: '-18deg' }],
  },
  floorReflection: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 0,
    width: 280,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 225, 255, 0.08)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(20px)' } as any)
      : { opacity: 0.7 }),
  },

  /* ─── Header Bar ──────────────────────────────────────────────── */
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    zIndex: 20,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  backButtonBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipPill: {
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  skipPillBlur: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  /* ─── Gauge Composite ─────────────────────────────────────────── */
  gaugeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  gaugeComposite: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    alignSelf: 'center',
    width: 340,
    height: 340,
    marginTop: 8,
    zIndex: 10,
  },
  mortarboardContainer: {
    position: 'absolute',
    top: 6,
    left: 20,
    zIndex: 15,
    transform: [{ rotate: '-18deg' }],
  },

  /* ─── Gauge ───────────────────────────────────────────────────── */
  gaugeContainer: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeMetric: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeValue: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  gaugePercent: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gaugeSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
  },

  /* ─── Safety Cushion Badge ────────────────────────────────────── */
  cushionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 0.8,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  cushionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    lineHeight: 14,
  },

  /* ─── Floating 3D Orbit Blocks (Isometric & Extruded) ──────────── */
  orbitCardPos1: {
    position: 'absolute',
    top: 18,
    right: -18,
    zIndex: 12,
  },
  orbitCardPos2: {
    position: 'absolute',
    bottom: 14,
    left: -26,
    zIndex: 12,
  },
  orbitCardPos3: {
    position: 'absolute',
    bottom: 6,
    right: -18,
    zIndex: 12,
  },

  blockContainer: {
    borderRadius: 16,
    position: 'relative',
  },
  blockPressed: {
    transform: [{ translateY: 4 }, { scale: 0.95 }],
    opacity: 0.92,
  },
  blockCastGlow: {
    ...StyleSheet.absoluteFill,
    top: 10,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 10,
  },
  blockExtrusionShelf: {
    position: 'absolute',
    top: 6,
    left: 2,
    right: -2,
    bottom: -6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderRightWidth: 3,
    overflow: 'hidden',
    zIndex: 1,
  },
  blockExtrusionBevel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.6,
  },
  blockFrontFace: {
    borderRadius: 16,
    borderWidth: 1.4,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
    backgroundColor: 'rgba(12, 18, 32, 0.95)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.5)',
        } as any)
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.5,
          shadowRadius: 10,
          elevation: 6,
        }),
  },
  blockSpecularRidgeTop: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 4,
  },
  blockSpecularRidgeLeft: {
    position: 'absolute',
    top: 6,
    left: 0,
    bottom: 6,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    zIndex: 4,
  },
  blockBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  blockGradientSurface: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 16,
  },
  blockContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockIconPad: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockTextWrapper: {
    flexShrink: 1,
  },
  blockLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  blockInfoBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },

  orbitIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ─── Value Copy (EXCHANGED: Honk Headline, Isometra Subtitle) ─── */
  copySection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 'auto',
    zIndex: 10,
  },
  headline: {
    fontFamily: Platform.select({ web: "'Honk', system-ui, sans-serif", default: 'Honk' }),
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: Platform.select({ web: "'Isometra', sans-serif", default: 'Isometra' }),
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    letterSpacing: 0.3,
  },

  /* ─── Bottom Section ──────────────────────────────────────────── */
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 28 : 24,
    marginTop: 20,
    zIndex: 10,
  },

  /* ─── Pagination ──────────────────────────────────────────────── */
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
    // Glow effect via shadow
    ...(Platform.OS !== 'web'
      ? {
          shadowColor: '#00E5FF',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: 6,
        }
      : ({
          boxShadow: '0 0 8px rgba(0, 225, 255, 0.7)',
        } as any)),
  },

  /* ─── Primary CTA: Pill matching Screen 1 ──────────────────────── */
  ctaPillWrapper: {
    width: '100%',
    maxWidth: 340,
    height: 62,
    borderRadius: 31,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPillPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  ctaOuterAmberGlow: {
    position: 'absolute',
    left: 4,
    top: 6,
    width: 100,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(245, 158, 11, 0.50)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(18px)' } as any)
      : { opacity: 0.85 }),
  },
  ctaOuterCyanGlow: {
    position: 'absolute',
    right: 4,
    top: 6,
    width: 100,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 225, 255, 0.50)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(18px)' } as any)
      : { opacity: 0.85 }),
  },
  ctaGradientBorder: {
    width: '100%',
    height: 62,
    borderRadius: 31,
    padding: 1.5,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 8px 32px -4px rgba(0, 0, 0, 0.6), -10px 0 28px -2px rgba(245, 158, 11, 0.40), 10px 0 28px -2px rgba(0, 225, 255, 0.40)',
        } as any)
      : {
          shadowColor: '#00E5FF',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 8,
        }),
  },
  ctaGlassFill: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: 'rgba(10, 14, 24, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        } as any)
      : {}),
  },
  ctaInnerAmberGaze: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 115,
  },
  ctaInnerCyanGaze: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 115,
  },
  ctaSpecularRim: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  ctaContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 2,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ctaArrowSymbol: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },

  /* ─── Interactive Educational Brief Modal (UPWARD In Front) ────── */
  modalRootContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 999999,
    elevation: 999999,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999999,
        } as any)
      : {}),
  },
  modalDarkOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3, 5, 10, 0.90)',
  },
  modalCenterContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 1000000,
    elevation: 1000000,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
    backgroundColor: 'rgba(9, 13, 23, 0.98)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.8,
    shadowRadius: 36,
    elevation: 24,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 24px 50px -12px rgba(0, 0, 0, 0.9), 0 0 40px rgba(0, 0, 0, 0.6)',
        } as any)
      : {}),
  },
  modalCardBlur: {
    padding: 22,
    backgroundColor: 'rgba(9, 13, 23, 0.98)',
  },
  modalAccentGlowBar: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalTitleColumn: {
    flex: 1,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  modalTagline: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#CBD5E1',
    lineHeight: 19,
    marginBottom: 16,
  },
  modalHighlightsList: {
    gap: 10,
    marginBottom: 20,
  },
  modalHighlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  highlightIconDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  highlightTextCol: {
    flex: 1,
  },
  highlightTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  highlightDesc: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94A3B8',
    lineHeight: 15,
  },
  modalGotItButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalGotItGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalGotItText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
