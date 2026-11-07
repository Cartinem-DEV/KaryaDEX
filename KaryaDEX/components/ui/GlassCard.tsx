/**
 * BunkMatKar — GlassCard Component
 * 
 * Translucent glass card with 3-tier hierarchy, backdrop blur,
 * subtle 1px translucent border, soft diffused shadow, and inner top highlight.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  type ViewStyle,
  Pressable,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { getGlassStyle, type GlassTier, type GlassIntensity } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  /** Hierarchy level: primary (hero/top priority), secondary (cards/lists), tertiary (semi-solid) */
  level?: GlassTier;
  /** Legacy intensity prop for backward compatibility */
  intensity?: GlassIntensity;
  style?: ViewStyle;
  onPress?: () => void;
  noPadding?: boolean;
}

export function GlassCard({
  children,
  level,
  intensity = 'medium',
  style,
  onPress,
  noPadding = false,
}: GlassCardProps) {
  const { colors, isDark } = useTheme();

  // Determine hierarchy tier (level takes precedence over intensity)
  const tier: GlassTier | GlassIntensity = level || intensity;
  const glassStyle = getGlassStyle(colors, tier);

  const cardStyle: ViewStyle = {
    ...glassStyle,
    position: 'relative',
    ...(noPadding ? {} : styles.padding),
    ...style,
  };

  const specularColor = isDark
    ? tier === 'primary' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.12)'
    : tier === 'primary' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.80)';

  const content = (
    <>
      {/* Physical top specular highlight reflection */}
      <View
        pointerEvents="none"
        style={[
          styles.specularHighlight,
          { backgroundColor: specularColor },
        ]}
      />
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && {
            opacity: 0.92,
            transform: [{ scale: 0.985 }],
          },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  padding: {
    padding: 16,
  },
  specularHighlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    opacity: 0.85,
    borderRadius: 1,
  },
});
