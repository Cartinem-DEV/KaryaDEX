/**
 * KaryaDEX — Onboarding Screen 01: Welcome / Start Journey
 *
 * Authoritative Visual Reference Implementation:
 * - Cinematic deep black/navy atmospheric space background (#05070B)
 * - Indigo (#6366F1) & Violet (#7C3AED) ambient illumination with controlled Cyan (#00E5FF) accent
 * - Central 3D KaryaDEX Three-Blade Flowing K Emblem
 * - Exact typography: "KaryaDEX" and official tagline "Plan. Focus. Progress."
 * - Luminous pill-shaped glass CTA with violet-to-indigo-to-cyan illumination: "Start Journey →"
 * - Preserves all existing onboarding contracts, resume states, demo mode, and navigation hooks
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
  AccessibilityInfo,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFonts } from 'expo-font';
import { AnimatedHeroLogo } from './AnimatedHeroLogo';
import { OnboardingPaginationDots } from './OnboardingPaginationDots';

interface StepWelcomeProps {
  canResume: boolean;
  resumeStepName?: string;
  onGetStarted: () => void;
  onResume: () => void;
  onDemoMode: () => void;
}

export function StepWelcome({
  canResume,
  resumeStepName,
  onGetStarted,
  onResume,
  onDemoMode,
}: StepWelcomeProps) {
  const { width, height } = useWindowDimensions();
  const [isNavigating, setIsNavigating] = useState(false);

  // Load custom fonts with fallback
  const [fontsLoaded] = useFonts({
    Montserrat: require('../../assets/fonts/Montserrat.ttf'),
    Oswald: require('../../assets/fonts/Oswald.ttf'),
    'Oswald-Regular': require('../../assets/fonts/Oswald.ttf'),
    'Oswald-Medium': require('../../assets/fonts/Oswald.ttf'),
    'Oswald-Bold': require('../../assets/fonts/Oswald.ttf'),
  });

  // Responsive scaling calculations
  const isCompactHeight = height < 740;
  const isNarrowWidth = width < 360;

  const logoSize = Math.min(
    isCompactHeight ? height * 0.40 : height * 0.46,
    isNarrowWidth ? 280 : 360
  );

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.92)).current;
  const logoOpacityAnim = useRef(new Animated.Value(0)).current;
  const textTranslateAnim = useRef(new Animated.Value(14)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;
  const ctaTranslateAnim = useRef(new Animated.Value(18)).current;
  const ctaOpacityAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!isMounted) return;

      if (reduceMotion) {
        fadeAnim.setValue(1);
        logoScaleAnim.setValue(1);
        logoOpacityAnim.setValue(1);
        textTranslateAnim.setValue(0);
        textOpacityAnim.setValue(1);
        ctaTranslateAnim.setValue(0);
        ctaOpacityAnim.setValue(1);
        return;
      }

      // Cinematic staggered entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.spring(logoScaleAnim, {
              toValue: 1,
              friction: 8,
              tension: 40,
              useNativeDriver: true,
            }),
            Animated.timing(logoOpacityAnim, {
              toValue: 1,
              duration: 650,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(280),
          Animated.parallel([
            Animated.timing(textTranslateAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(textOpacityAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(440),
          Animated.parallel([
            Animated.timing(ctaTranslateAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(ctaOpacityAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start(() => {
        if (!isMounted) return;

        // Subtle ambient breathing float for hero logo
        Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: -5,
              duration: 2400,
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 4,
              duration: 2400,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    });

    return () => {
      isMounted = false;
    };
  }, [ctaOpacityAnim, ctaTranslateAnim, fadeAnim, floatAnim, logoOpacityAnim, logoScaleAnim, textOpacityAnim, textTranslateAnim]);

  const handleStartJourney = () => {
    if (isNavigating) return;
    setIsNavigating(true);

    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {}

    // If a saved draft exists, tapping Start Journey smoothly resumes the workflow
    if (canResume) {
      onResume();
    } else {
      onGetStarted();
    }
  };

  const handleFreshStart = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
    onGetStarted();
  };

  const handleDemo = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    onDemoMode();
  };

  return (
    <View style={styles.rootContainer}>
      <StatusBar style="light" />

      {/* ─── A. Cinematic Atmospheric Background ──────────────────────── */}
      <Animated.View style={[styles.backgroundLayer, { opacity: fadeAnim }]} pointerEvents="none">
        {/* Brand Indigo Ambient Glow (Left / Lower-Left) */}
        <View style={styles.indigoGlowOrb} />
        {/* Brand Violet Ambient Glow (Right / Upper-Right) */}
        <View style={styles.violetGlowOrb} />
        {/* Supporting Cyan Ambient Glow (Right / Center) */}
        <View style={styles.cyanGlowOrb} />
        {/* Atmospheric Upper Orbital Arc */}
        <View style={styles.orbitalArc} />
        {/* Subtle Horizontal Floor Reflection */}
        <View style={styles.floorReflection} />
      </Animated.View>

      <View style={styles.contentSafeArea}>
        {/* ─── B. Central 3D KaryaDEX Three-Blade Flowing Emblem ──────── */}
        <Animated.View
          style={[
            styles.heroLogoContainer,
            {
              width: logoSize,
              height: logoSize,
              opacity: logoOpacityAnim,
              transform: [{ scale: logoScaleAnim }],
            },
          ]}
        >
          <AnimatedHeroLogo size={logoSize} />
        </Animated.View>

        {/* ─── C & D. Brand Name & Tagline ────────────────────────────── */}
        <Animated.View
          style={[
            styles.brandTextContainer,
            {
              opacity: textOpacityAnim,
              transform: [{ translateY: textTranslateAnim }],
            },
          ]}
        >
          <Text
            style={[
              styles.brandTitle,
              fontsLoaded && { fontFamily: 'Montserrat' },
              isCompactHeight && styles.brandTitleCompact,
            ]}
          >
            Karya<Text style={styles.brandTitleDex}>DEX</Text>
          </Text>
          <Text
            style={[
              styles.tagline,
              fontsLoaded && {
                fontFamily: Platform.select({
                  web: "'Oswald', sans-serif",
                  default: 'Oswald',
                }),
              },
              isCompactHeight && styles.taglineCompact,
            ]}
          >
            Plan. Focus. Progress.
          </Text>
        </Animated.View>

        {/* ─── E. Primary Call-to-Action (Dual-Glow Pill) ─────────────── */}
        <Animated.View
          style={[
            styles.bottomSection,
            {
              opacity: ctaOpacityAnim,
              transform: [{ translateY: ctaTranslateAnim }],
            },
          ]}
        >
          {/* Pagination 4-Dotted Bar (Monitoring Screen 1) */}
          <OnboardingPaginationDots
            activeIndex={0}
            totalDots={4}
            onPressDot={(index) => {
              if (index === 1) {
                handleStartJourney();
              }
            }}
          />

          <Pressable
            onPress={handleStartJourney}
            disabled={isNavigating}
            accessibilityRole="button"
            accessibilityLabel={canResume ? 'Continue Journey' : 'Start Journey'}
            style={({ pressed }) => [
              styles.ctaPillWrapper,
              pressed && styles.ctaPillPressed,
            ]}
          >
            {/* Diffused Left Violet Glow */}
            <View style={styles.ctaOuterVioletGlow} pointerEvents="none" />
            {/* Diffused Right Cyan Glow */}
            <View style={styles.ctaOuterCyanGlow} pointerEvents="none" />

            {/* Violet-to-Indigo-to-Cyan Luminous Gradient Border */}
            <LinearGradient
              colors={[
                '#7C3AED',
                'rgba(124, 58, 237, 0.85)',
                'rgba(255, 255, 255, 0.40)',
                'rgba(99, 102, 241, 0.85)',
                '#00E5FF',
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.ctaGradientBorder}
            >
              {/* Dark Translucent Glass Interior */}
              <View style={styles.ctaGlassFill}>
                {/* Inner Left Violet Horizon Highlight */}
                <LinearGradient
                  colors={['rgba(124, 58, 237, 0.30)', 'transparent']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 0.45, y: 0.5 }}
                  style={styles.ctaInnerVioletGaze}
                  pointerEvents="none"
                />

                {/* Inner Right Cyan Horizon Highlight */}
                <LinearGradient
                  colors={['transparent', 'rgba(0, 225, 255, 0.26)']}
                  start={{ x: 0.55, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.ctaInnerCyanGaze}
                  pointerEvents="none"
                />

                {/* Top Specular Rim Reflection */}
                <View style={styles.ctaSpecularRim} pointerEvents="none" />

                {/* Button Content */}
                <View style={styles.ctaContentRow}>
                  <Text style={styles.ctaLabel}>
                    {canResume ? 'Continue Journey' : 'Start Journey'}
                  </Text>
                  <Text style={styles.ctaArrowSymbol}>→</Text>
                </View>
              </View>
            </LinearGradient>
          </Pressable>

          {/* Secondary Actions for Returning Students or Demo */}
          {canResume ? (
            <View style={styles.secondaryContainer}>
              <Pressable
                onPress={handleFreshStart}
                style={styles.secondaryTextButton}
                accessibilityRole="button"
                accessibilityLabel="Start Fresh Setup"
              >
                <Text style={styles.secondaryText}>
                  Start fresh setup {resumeStepName ? `(currently at ${resumeStepName})` : ''}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleDemo}
                style={styles.demoTextButton}
                accessibilityRole="button"
                accessibilityLabel="Explore Demo Mode"
              >
                <Text style={styles.demoText}>Explore Demo Mode</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleDemo}
              style={styles.demoTextButton}
              accessibilityRole="button"
              accessibilityLabel="Explore Demo Mode"
            >
              <Text style={styles.demoText}>Explore Demo Mode</Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#05070B',
    position: 'relative',
    overflow: 'hidden',
  },
  contentSafeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 24 : 32,
    paddingBottom: Platform.OS === 'ios' ? 28 : 24,
    zIndex: 10,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },

  /* ─── A. Atmospheric Lighting ─────────────────────────────── */
  backgroundLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  indigoGlowOrb: {
    position: 'absolute',
    left: -80,
    top: '18%',
    width: 320,
    height: 480,
    borderRadius: 160,
    backgroundColor: 'rgba(99, 102, 241, 0.20)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(64px)' } as any)
      : { opacity: 0.85 }),
  },
  violetGlowOrb: {
    position: 'absolute',
    right: -80,
    top: '22%',
    width: 340,
    height: 500,
    borderRadius: 170,
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(64px)' } as any)
      : { opacity: 0.85 }),
  },
  cyanGlowOrb: {
    position: 'absolute',
    right: '12%',
    top: '32%',
    width: 220,
    height: 280,
    borderRadius: 110,
    backgroundColor: 'rgba(0, 229, 255, 0.10)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(48px)' } as any)
      : { opacity: 0.75 }),
  },
  orbitalArc: {
    position: 'absolute',
    alignSelf: 'center',
    top: '10%',
    width: 420,
    height: 420,
    borderRadius: 210,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.12)',
    transform: [{ rotate: '-18deg' }],
  },
  floorReflection: {
    position: 'absolute',
    alignSelf: 'center',
    top: '56%',
    width: 260,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(16px)' } as any)
      : { opacity: 0.7 }),
  },

  /* ─── B. Hero Logo ────────────────────────────────────────── */
  heroLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 'auto',
    marginBottom: 6,
  },

  /* ─── C & D. Brand Text ───────────────────────────────────── */
  brandTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 'auto',
    paddingHorizontal: 16,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: Platform.select({ web: "'Montserrat', sans-serif", default: 'Montserrat' }),
  },
  brandTitleDex: {
    color: '#8B5CF6',
  },
  brandTitleCompact: {
    fontSize: 30,
    marginTop: 4,
  },
  tagline: {
    color: 'rgba(255, 255, 255, 0.90)',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 6,
    fontFamily: Platform.select({ web: "'Oswald', sans-serif", default: 'Oswald' }),
  },
  taglineCompact: {
    fontSize: 14,
    marginTop: 4,
  },

  /* ─── E. Call-to-Action ───────────────────────────────────── */
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 'auto',
  },
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
  ctaOuterVioletGlow: {
    position: 'absolute',
    left: 4,
    top: 6,
    width: 100,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(124, 58, 237, 0.40)',
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
    backgroundColor: 'rgba(0, 225, 255, 0.35)',
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
            '0 8px 32px -4px rgba(0, 0, 0, 0.6), -10px 0 28px -2px rgba(124, 58, 237, 0.35), 10px 0 28px -2px rgba(0, 225, 255, 0.35)',
        } as any)
      : {
          shadowColor: '#7C3AED',
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
  ctaInnerVioletGaze: {
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

  /* ─── Secondary Links ─────────────────────────────────────── */
  secondaryContainer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  secondaryTextButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  secondaryText: {
    color: 'rgba(255, 255, 255, 0.70)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  demoTextButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  demoText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
