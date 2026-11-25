/**
 * KaryaDEX — GlassButton Component
 *
 * Glassmorphic interactive button with:
 * - 3-tier glass backdrop blur styling
 * - Strict Fitts's Law touch target enforcement (min 48dp height)
 * - Doherty Threshold instant touch haptics & scale feedback
 * - Inset top specular highlight rim
 */

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  Platform,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { getGlassStyle, type GlassTier, typography, radii, brand } from '@/constants/theme';

export interface GlassButtonProps {
  title?: string;
  onPress: () => void;
  icon?: React.ReactNode;
  level?: GlassTier;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export function GlassButton({
  title,
  onPress,
  icon,
  level = 'secondary',
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
}: GlassButtonProps) {
  const { colors, isDark } = useTheme();
  const glassBase = getGlassStyle(colors, level);

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    onPress();
  };

  // Height scaling enforcing Fitts's Law (min 48dp for touchable buttons)
  const minHeight = size === 'sm' ? 44 : size === 'lg' ? 56 : 48;

  const getVariantStyles = (): { bg: string; border: string; text: string; specular: string } => {
    if (variant === 'primary') {
      return {
        bg: isDark ? 'rgba(0, 229, 255, 0.18)' : brand.violet,
        border: isDark ? 'rgba(0, 229, 255, 0.45)' : brand.violetDark,
        text: isDark ? '#00E5FF' : '#FFFFFF',
        specular: isDark ? 'rgba(0, 229, 255, 0.6)' : 'rgba(255, 255, 255, 0.4)',
      };
    }
    if (variant === 'danger') {
      return {
        bg: isDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.10)',
        border: isDark ? 'rgba(239, 68, 68, 0.45)' : 'rgba(239, 68, 68, 0.25)',
        text: '#EF4444',
        specular: 'rgba(239, 68, 68, 0.3)',
      };
    }
    if (variant === 'ghost') {
      return {
        bg: 'transparent',
        border: 'transparent',
        text: colors.textSecondary,
        specular: 'transparent',
      };
    }
    // secondary (default)
    return {
      bg: glassBase.backgroundColor as string,
      border: glassBase.borderColor as string,
      text: colors.text,
      specular: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.90)',
    };
  };

  const v = getVariantStyles();

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight,
          backgroundColor: v.bg,
          borderColor: v.border,
          width: fullWidth ? '100%' : undefined,
        },
        variant !== 'ghost' && Platform.OS === 'web' && ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        } as any),
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {/* Top Specular Rim */}
      {variant !== 'ghost' && (
        <View
          pointerEvents="none"
          style={[styles.specularRim, { backgroundColor: v.specular }]}
        />
      )}

      <View style={styles.contentRow}>
        {icon ? <View style={styles.iconWrapper}>{icon}</View> : null}
        <Text
          style={[
            styles.label,
            {
              color: disabled ? colors.textTertiary : v.text,
              fontSize: size === 'sm' ? typography.sizes.xs + 1 : size === 'lg' ? typography.sizes.base : typography.sizes.sm,
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    opacity: 0.9,
    borderRadius: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.15,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
