/**
 * KaryaDEX — Atmospheric Ambient Background Component
 *
 * Provides the cinematic obsidian space black atmosphere (#05070B)
 * with dual ambient lighting:
 * - Warm golden amber illumination (left / lower-left)
 * - Electric cyan/blue glow (right / lower-right)
 * - Atmospheric upper orbital arc
 * - Subtle floor specular reflection
 *
 * Implements 60fps GPU acceleration across all screens in the app.
 */

import React from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';

interface AmbientBackgroundProps {
  style?: ViewStyle;
  forceDark?: boolean;
}

export const AmbientBackground = React.memo(function AmbientBackground({ style, forceDark = false }: AmbientBackgroundProps) {
  const { colors, isDark: themeIsDark } = useTheme();
  const isDark = forceDark || themeIsDark;

  return (
    <View
      pointerEvents="none"
      aria-hidden={true}
      style={[
        styles.container,
        { backgroundColor: isDark ? '#05070B' : colors.background },
        style,
      ]}
    >
      {/* 1. Warm Golden/Amber Ambient Glow (Left / Lower-Left) */}
      <View
        style={[
          styles.ambientOrb,
          styles.amberOrb,
          {
            backgroundColor: isDark
              ? 'rgba(245, 158, 11, 0.22)'
              : 'rgba(245, 158, 11, 0.08)',
          },
        ]}
      />

      {/* 2. Electric Cyan/Blue Ambient Glow (Right / Lower-Right) */}
      <View
        style={[
          styles.ambientOrb,
          styles.cyanOrb,
          {
            backgroundColor: isDark
              ? 'rgba(0, 225, 255, 0.22)'
              : 'rgba(0, 225, 255, 0.08)',
          },
        ]}
      />

      {/* 3. Atmospheric Upper Orbital Arc */}
      <View
        style={[
          styles.orbitalArc,
          {
            borderColor: isDark
              ? 'rgba(245, 158, 11, 0.07)'
              : 'rgba(245, 158, 11, 0.04)',
          },
        ]}
      />

      {/* 4. Floor Specular Reflection */}
      <View
        style={[
          styles.floorReflection,
          {
            backgroundColor: isDark
              ? 'rgba(0, 225, 255, 0.08)'
              : 'rgba(0, 225, 255, 0.04)',
          },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: -1,
  },
  ambientOrb: {
    position: 'absolute',
    borderRadius: 9999,
    ...(Platform.OS === 'web'
      ? ({
          filter: 'blur(64px)',
          WebkitFilter: 'blur(64px)',
          willChange: 'transform',
        } as any)
      : {
          opacity: 0.88,
        }),
  },
  amberOrb: {
    left: -80,
    top: '18%',
    width: 320,
    height: 480,
  },
  cyanOrb: {
    right: -80,
    top: '26%',
    width: 340,
    height: 500,
  },
  orbitalArc: {
    position: 'absolute',
    alignSelf: 'center',
    top: '8%',
    width: 440,
    height: 440,
    borderRadius: 220,
    borderWidth: 1,
    transform: [{ rotate: '-18deg' }],
  },
  floorReflection: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 0,
    width: 320,
    height: 64,
    borderRadius: 32,
    ...(Platform.OS === 'web'
      ? ({
          filter: 'blur(20px)',
          WebkitFilter: 'blur(20px)',
        } as any)
      : {
          opacity: 0.7,
        }),
  },
});
