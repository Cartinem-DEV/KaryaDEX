/**
 * KaryaDEX — Animated 3D Hero Brand Logo
 *
 * Official 3D Glass Emblem for Onboarding Screen 1:
 * - Renders the approved 3D Frosted-Glass KaryaDEX Emblem with photographic volume and depth:
 *     1. Anchor Stem: Curved vertical blade on left with soft cyan crest, deep violet body, and needle taper
 *     2. Vision Wing: Sweeping upper blade extending toward upper-right with brilliant glowing electric cyan tip
 *     3. Grounding Fin: Dynamic arched lower blade with magenta-violet curvature and sky-blue rim
 * - Multi-layered atmospheric backlighting:
 *     - Left Indigo aura (#6366F1)
 *     - Right Electric Cyan bloom (#00E5FF)
 *     - Central Violet luminous core (#7C3AED)
 * - 60fps organic floating & breathing physics (sinusoidal vertical hover + subtle scale expansion)
 * - Dynamic 3D specular shimmer and breathing glass caustics
 * - Floating diamond starlight sparkles synchronized with the glass physics
 * - Full accessibility support via AccessibilityInfo.isReduceMotionEnabled()
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Platform,
  Easing,
  AccessibilityInfo,
  Image,
} from 'react-native';

interface AnimatedHeroLogoProps {
  size?: number;
}

export function AnimatedHeroLogo({ size = 320 }: AnimatedHeroLogoProps) {
  // ─── Animation Controllers ───────────────────────────────────────────
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowPulseAnim = useRef(new Animated.Value(0.92)).current;
  const shimmerAnim = useRef(new Animated.Value(0.8)).current;
  const sparklePulseAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!isMounted) return;

      if (reduceMotion) {
        floatAnim.setValue(0);
        glowPulseAnim.setValue(1);
        shimmerAnim.setValue(1);
        sparklePulseAnim.setValue(1);
        return;
      }

      // 1. Gentle Floating / Breathing of Entire 3D Emblem
      const floatLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -8,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 6,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      // 2. Ambient Dual Halo Breathing Glow
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulseAnim, {
            toValue: 1.14,
            duration: 2400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowPulseAnim, {
            toValue: 0.88,
            duration: 2400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );

      // 3. Specular Glass Shimmer / Crest Light Shift
      const shimmerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0.65,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      // 4. Starlight Glint Pulse
      const sparkleLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(sparklePulseAnim, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(sparklePulseAnim, {
            toValue: 0.4,
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      floatLoop.start();
      glowLoop.start();
      shimmerLoop.start();
      sparkleLoop.start();
    });

    return () => {
      isMounted = false;
    };
  }, [floatAnim, glowPulseAnim, shimmerAnim, sparklePulseAnim]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* ─── Layer 1: Atmospheric Ambient Backlighting ────────────────── */}
      <Animated.View
        style={[
          styles.glowBackdrop,
          {
            transform: [{ scale: glowPulseAnim }],
            opacity: glowPulseAnim.interpolate({
              inputRange: [0.88, 1.14],
              outputRange: [0.72, 1],
            }),
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.leftIndigoAura} />
        <View style={styles.rightCyanAura} />
        <View style={styles.centerVioletBloom} />
      </Animated.View>

      {/* ─── Layer 2: Main Floating 3D Brand Emblem ───────────────────── */}
      <Animated.View
        style={[
          styles.emblemWrapper,
          {
            width: size,
            height: size,
            transform: [
              { translateY: floatAnim },
              {
                scale: glowPulseAnim.interpolate({
                  inputRange: [0.88, 1.14],
                  outputRange: [0.985, 1.015],
                }),
              },
            ],
          },
        ]}
      >
        <Image
          source={require('../../assets/images/karyadex_hero_logo.png')}
          style={[styles.hero3DImage, { width: size, height: size }]}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="KaryaDEX 3D Brand Logo"
        />

        {/* ─── Layer 3: Dynamic Specular Reflection Caustic Overlay ───── */}
        <Animated.View
          style={[
            styles.specularOverlay,
            {
              opacity: shimmerAnim.interpolate({
                inputRange: [0.65, 1],
                outputRange: [0.15, 0.35],
              }),
            },
          ]}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ─── Layer 4: Ambient Starlight Sparkles / Diamond Glints ─────── */}
      <View style={styles.sparkleContainer} pointerEvents="none">
        {/* Sparkle 1: Electric Cyan Glint at Top-Right Wingtip */}
        <Animated.View
          style={[
            styles.sparkleCyanTop,
            {
              transform: [
                { translateY: floatAnim },
                { scale: sparklePulseAnim },
              ],
              opacity: sparklePulseAnim.interpolate({
                inputRange: [0.4, 1],
                outputRange: [0.35, 1],
              }),
            },
          ]}
        />

        {/* Sparkle 2: Lilac Flare at Left Anchor Stem Crest */}
        <Animated.View
          style={[
            styles.sparkleLilacStem,
            {
              transform: [
                { translateY: Animated.multiply(floatAnim, 0.7) },
                {
                  scale: sparklePulseAnim.interpolate({
                    inputRange: [0.4, 1],
                    outputRange: [1, 0.5], // Offset phase
                  }),
                },
              ],
              opacity: sparklePulseAnim.interpolate({
                inputRange: [0.4, 1],
                outputRange: [0.8, 0.3],
              }),
            },
          ]}
        />

        {/* Sparkle 3: Sky-Blue Diamond at Grounding Fin Tip */}
        <Animated.View
          style={[
            styles.sparkleCyanBottom,
            {
              transform: [
                { translateY: Animated.multiply(floatAnim, -0.6) },
                { scale: sparklePulseAnim },
              ],
              opacity: sparklePulseAnim.interpolate({
                inputRange: [0.4, 1],
                outputRange: [0.25, 0.9],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  /* ─── Atmospheric Ambient Glows ────────────────────────────── */
  glowBackdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  leftIndigoAura: {
    position: 'absolute',
    left: '6%',
    top: '18%',
    width: '60%',
    height: '64%',
    borderRadius: 140,
    backgroundColor: 'rgba(99, 102, 241, 0.28)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(45px)' } as any)
      : { opacity: 0.85 }),
  },
  rightCyanAura: {
    position: 'absolute',
    right: '6%',
    top: '14%',
    width: '58%',
    height: '60%',
    borderRadius: 130,
    backgroundColor: 'rgba(0, 229, 255, 0.22)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(40px)' } as any)
      : { opacity: 0.85 }),
  },
  centerVioletBloom: {
    position: 'absolute',
    alignSelf: 'center',
    top: '20%',
    width: '66%',
    height: '66%',
    borderRadius: 150,
    backgroundColor: 'rgba(124, 58, 237, 0.26)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(52px)' } as any)
      : { opacity: 0.9 }),
  },

  /* ─── 3D Emblem Container ──────────────────────────────────── */
  emblemWrapper: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          filter:
            'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.65)) drop-shadow(0 0 50px rgba(99, 102, 241, 0.35)) drop-shadow(0 0 25px rgba(0, 229, 255, 0.25))',
        } as any)
      : {
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.45,
          shadowRadius: 24,
          elevation: 12,
        }),
  },
  hero3DImage: {
    overflow: 'visible',
  },
  specularOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: [{ scale: 0.85 }],
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(25px)' } as any)
      : {}),
  },

  /* ─── Starlight Glints & Sparkles ──────────────────────────── */
  sparkleContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 3,
  },
  sparkleCyanTop: {
    position: 'absolute',
    right: '18%',
    top: '16%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0F2FE',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 14px 4px rgba(0, 229, 255, 0.95), 0 0 4px 1px #FFFFFF',
        } as any)
      : {
          shadowColor: '#00E5FF',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 6,
        }),
  },
  sparkleLilacStem: {
    position: 'absolute',
    left: '21%',
    top: '20%',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EDE9FE',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 12px 3px rgba(167, 139, 250, 0.9), 0 0 3px 1px #FFFFFF',
        } as any)
      : {
          shadowColor: '#A78BFA',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 6,
          elevation: 5,
        }),
  },
  sparkleCyanBottom: {
    position: 'absolute',
    right: '22%',
    bottom: '21%',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#BAE6FD',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 12px 3px rgba(56, 189, 248, 0.88), 0 0 3px 1px #FFFFFF',
        } as any)
      : {
          shadowColor: '#38BDF8',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.85,
          shadowRadius: 6,
          elevation: 5,
        }),
  },
});
