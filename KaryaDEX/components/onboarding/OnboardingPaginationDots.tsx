/**
 * KaryaDEX — Onboarding Pagination Indicator
 *
 * 3-dotted active screen monitor placed directly above primary CTAs
 * ("Start Journey" and "Continue"). Accurately monitors and highlights
 * the current screen index (Screen 1 = Dot 1, Screen 2 = Dot 2, etc.)
 * with an electric cyan glowing active pill, tactile press feedback, and haptics.
 */

import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface OnboardingPaginationDotsProps {
  activeIndex: number;
  totalDots?: number;
  onPressDot?: (index: number) => void;
  style?: any;
}

export const OnboardingPaginationDots = React.memo(function OnboardingPaginationDots({
  activeIndex = 0,
  totalDots = 3,
  onPressDot,
  style,
}: OnboardingPaginationDotsProps) {
  const handlePress = (index: number) => {
    if (index === activeIndex || !onPressDot) return;
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
    onPressDot(index);
  };

  return (
    <View style={[styles.paginationRow, style]} accessibilityRole="tablist">
      {Array.from({ length: totalDots }).map((_, index) => {
        const isActive = index === activeIndex;
        return (
          <Pressable
            key={index}
            onPress={() => handlePress(index)}
            disabled={!onPressDot || isActive}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Screen ${index + 1} of ${totalDots}`}
            hitSlop={8}
            style={({ pressed }) => [
              isActive ? styles.dotActive : styles.dotInactive,
              pressed && styles.dotPressed,
            ]}
          >
            {isActive && <View style={styles.dotGlowCore} pointerEvents="none" />}
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginBottom: 20,
    zIndex: 10,
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
    position: 'relative',
    ...(Platform.OS !== 'web'
      ? {
          shadowColor: '#00E5FF',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.85,
          shadowRadius: 8,
          elevation: 4,
        }
      : ({
          boxShadow: '0 0 10px rgba(0, 225, 255, 0.85), 0 0 2px #00E5FF',
        } as any)),
  },
  dotGlowCore: {
    ...StyleSheet.absoluteFill,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    opacity: 0.35,
  },
  dotPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.9 }],
  },
});
