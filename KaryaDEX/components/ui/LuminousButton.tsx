/**
 * BunkMatKar — LuminousButton Component
 *
 * The signature Dual-Glow Luminous Pill Button from Onboarding 1 and 2:
 * - Amber-to-Cyan illuminated gradient border
 * - Dark translucent glass interior with backdrop blur
 * - Inner horizon highlights (amber on left, cyan on right)
 * - Top specular rim reflection
 * - Diffused outer ambient glow orbs
 * - 60fps GPU hardware texture caching and tactile haptic press feedback
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  type ViewStyle,
  type TextStyle,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export interface LuminousButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  showArrow?: boolean;
  arrowSymbol?: string;
  icon?: React.ReactNode;
  size?: 'large' | 'medium' | 'small';
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const LuminousButton = React.memo(function LuminousButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  showArrow = true,
  arrowSymbol = '→',
  icon,
  size = 'large',
  variant = 'primary',
  style,
  textStyle,
  accessibilityLabel,
}: LuminousButtonProps) {
  const handlePress = () => {
    if (disabled || loading) return;
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
    onPress();
  };

  const isSmall = size === 'small';
  const isMedium = size === 'medium';
  const height = isSmall ? 44 : isMedium ? 52 : 62;
  const borderRadius = height / 2;

  const gradientColors: [string, string, ...string[]] =
    variant === 'danger'
      ? ['#EF4444', 'rgba(239, 68, 68, 0.85)', 'rgba(255, 255, 255, 0.35)', '#F87171']
      : variant === 'secondary'
      ? ['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.3)']
      : [
          '#F59E0B',
          'rgba(245, 158, 11, 0.85)',
          'rgba(255, 255, 255, 0.40)',
          'rgba(0, 225, 255, 0.85)',
          '#00E5FF',
        ];

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={({ pressed }) => [
        styles.wrapper,
        { height, borderRadius },
        style,
        disabled && styles.disabledWrapper,
        pressed && styles.pressedWrapper,
      ]}
    >
      {/* 1. Diffused Left Amber Glow */}
      {variant === 'primary' && !disabled && (
        <View style={[styles.outerAmberGlow, { height: height - 12 }]} pointerEvents="none" />
      )}

      {/* 2. Diffused Right Cyan Glow */}
      {variant === 'primary' && !disabled && (
        <View style={[styles.outerCyanGlow, { height: height - 12 }]} pointerEvents="none" />
      )}

      {/* 3. Luminous Gradient Border */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.gradientBorder, { height, borderRadius }]}
      >
        {/* 4. Dark Translucent Glass Interior */}
        <View style={[styles.glassFill, { borderRadius: borderRadius - 1 }]}>
          {/* Inner Left Amber Horizon Highlight */}
          {variant === 'primary' && (
            <LinearGradient
              colors={['rgba(245, 158, 11, 0.32)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 0.45, y: 0.5 }}
              style={styles.innerAmberGaze}
              pointerEvents="none"
            />
          )}

          {/* Inner Right Cyan Horizon Highlight */}
          {variant === 'primary' && (
            <LinearGradient
              colors={['transparent', 'rgba(0, 225, 255, 0.32)']}
              start={{ x: 0.55, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.innerCyanGaze}
              pointerEvents="none"
            />
          )}

          {/* Top Specular Rim Reflection */}
          <View style={styles.specularRim} pointerEvents="none" />

          {/* Button Content Row */}
          <View style={styles.contentRow}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                {icon && <View style={styles.iconPad}>{icon}</View>}
                <Text
                  style={[
                    styles.label,
                    isSmall && styles.labelSmall,
                    isMedium && styles.labelMedium,
                    textStyle,
                  ]}
                >
                  {title}
                </Text>
                {showArrow && (
                  <Text
                    style={[
                      styles.arrow,
                      isSmall && styles.arrowSmall,
                    ]}
                  >
                    {arrowSymbol}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    maxWidth: 380,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedWrapper: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  disabledWrapper: {
    opacity: 0.45,
  },
  outerAmberGlow: {
    position: 'absolute',
    left: 4,
    top: 6,
    width: 90,
    borderRadius: 25,
    backgroundColor: 'rgba(245, 158, 11, 0.45)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(16px)' } as any)
      : { opacity: 0.85 }),
  },
  outerCyanGlow: {
    position: 'absolute',
    right: 4,
    top: 6,
    width: 90,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 225, 255, 0.45)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(16px)' } as any)
      : { opacity: 0.85 }),
  },
  gradientBorder: {
    width: '100%',
    padding: 1.5,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 8px 30px -4px rgba(0, 0, 0, 0.65), -8px 0 24px -2px rgba(245, 158, 11, 0.35), 8px 0 24px -2px rgba(0, 225, 255, 0.35)',
        } as any)
      : {
          shadowColor: '#00E5FF',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 8,
        }),
  },
  glassFill: {
    flex: 1,
    backgroundColor: 'rgba(10, 14, 24, 0.90)',
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
  innerAmberGaze: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 100,
  },
  innerCyanGaze: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
  },
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 2,
    paddingHorizontal: 16,
  },
  iconPad: {
    marginRight: 2,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  labelMedium: {
    fontSize: 15,
  },
  labelSmall: {
    fontSize: 13,
  },
  arrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  arrowSmall: {
    fontSize: 15,
  },
});
