/**
 * KaryaDEX — Block3D Component
 *
 * Universal 3D Extruded Plate / Block Architecture:
 * - Physical extruded bottom & side shelf with depth bevel
 * - Raised glass front slab with specular ridge highlights (top & left)
 * - Mechanical keycap press depression with native tactile haptics
 * - Active state with Electric Cyan luminous aura and border highlight
 * - Zero emojis — strict vector icon pad with ambient glow
 * - 60fps GPU rasterization and web/native cross-platform support
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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

export interface Block3DProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  selected?: boolean;
  onPress?: () => void;
  accentColor?: string;
  glowColor?: string;
  variant?: 'compact' | 'card' | 'tile' | 'pill';
  rightElement?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const Block3D = React.memo(function Block3D({
  icon,
  title,
  subtitle,
  badge,
  badgeColor,
  selected = false,
  onPress,
  accentColor = '#00E5FF',
  glowColor,
  variant = 'card',
  rightElement,
  children,
  disabled = false,
  style,
  contentStyle,
  titleStyle,
  subtitleStyle,
  accessibilityLabel,
}: Block3DProps) {
  const activeGlow = glowColor || (selected ? 'rgba(0, 229, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)');
  const activeAccent = selected ? '#00E5FF' : accentColor;
  const activeBorder = selected
    ? 'rgba(0, 229, 255, 0.85)'
    : 'rgba(255, 255, 255, 0.16)';

  const handlePress = () => {
    if (disabled || !onPress) return;
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
    onPress();
  };

  const isCompact = variant === 'compact';
  const isPill = variant === 'pill';
  const isTile = variant === 'tile';

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={selected ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel || title}
      style={({ pressed }) => [
        styles.container,
        isCompact && styles.containerCompact,
        isPill && styles.containerPill,
        isTile && styles.containerTile,
        style,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {/* 1. Deep Cast Ambient Shadow & Colored Glow Aura */}
      <View
        style={[
          styles.castGlow,
          selected && {
            shadowColor: activeAccent,
            ...(Platform.OS === 'web'
              ? ({
                  boxShadow: `0 14px 28px -6px rgba(0, 0, 0, 0.7), 0 0 20px ${activeGlow}`,
                } as any)
              : {}),
          },
        ]}
        pointerEvents="none"
      />

      {/* 2. 3D Extruded Block Thickness (Physical bottom & side shelf) */}
      <View
        style={[
          styles.extrusionShelf,
          {
            borderColor: selected ? activeAccent : 'rgba(255, 255, 255, 0.12)',
            backgroundColor: selected ? 'rgba(0, 30, 48, 0.95)' : '#070B14',
          },
        ]}
        pointerEvents="none"
      >
        <View
          style={[
            styles.extrusionBevel,
            { backgroundColor: selected ? '#00E5FF' : activeGlow },
          ]}
        />
      </View>

      {/* 3. Main 3D Front Face (Raised Glass Slab) */}
      <View
        style={[
          styles.frontFace,
          {
            borderColor: activeBorder,
            backgroundColor: selected ? 'rgba(10, 24, 40, 0.96)' : 'rgba(12, 18, 32, 0.95)',
          },
        ]}
      >
        {/* Specular Ridge Lighting across top and left edges */}
        <View
          style={[
            styles.specularRidgeTop,
            selected && { backgroundColor: 'rgba(0, 229, 255, 0.85)' },
          ]}
          pointerEvents="none"
        />
        <View style={styles.specularRidgeLeft} pointerEvents="none" />

        <BlurView intensity={50} tint="dark" style={styles.blurLayer}>
          <LinearGradient
            colors={
              selected
                ? ['rgba(0, 45, 75, 0.85)', 'rgba(6, 20, 36, 0.98)']
                : ['rgba(26, 36, 56, 0.85)', 'rgba(10, 15, 26, 0.96)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.gradientSurface,
              isCompact && styles.surfaceCompact,
              isPill && styles.surfacePill,
              contentStyle,
            ]}
          >
            <View style={[styles.contentRow, isTile && styles.contentTile]}>
              {/* Embossed Icon Pad with Neon Halo */}
              {icon && (
                <View
                  style={[
                    styles.iconPad,
                    {
                      backgroundColor: selected
                        ? 'rgba(0, 229, 255, 0.18)'
                        : 'rgba(255, 255, 255, 0.06)',
                      borderColor: selected
                        ? 'rgba(0, 229, 255, 0.65)'
                        : 'rgba(255, 255, 255, 0.15)',
                    },
                  ]}
                >
                  {icon}
                </View>
              )}

              {/* Text Column */}
              <View style={[styles.textCol, isTile && styles.textColTile]}>
                <View style={styles.titleBadgeRow}>
                  <Text
                    style={[
                      styles.title,
                      selected && styles.titleSelected,
                      titleStyle,
                    ]}
                    numberOfLines={isCompact ? 1 : 2}
                  >
                    {title}
                  </Text>
                  {badge && (
                    <View
                      style={[
                        styles.badgePill,
                        {
                          backgroundColor: badgeColor || 'rgba(0, 229, 255, 0.18)',
                          borderColor: badgeColor || 'rgba(0, 229, 255, 0.45)',
                        },
                      ]}
                    >
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  )}
                </View>

                {subtitle ? (
                  <Text
                    style={[
                      styles.subtitle,
                      selected && styles.subtitleSelected,
                      subtitleStyle,
                    ]}
                    numberOfLines={isCompact ? 1 : 3}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>

              {/* Right Element or Selected Indicator */}
              {rightElement ? (
                <View style={styles.rightElementCol}>{rightElement}</View>
              ) : selected ? (
                <View style={styles.selectedPill}>
                  <Feather name="check" size={13} color="#00E5FF" />
                </View>
              ) : null}
            </View>

            {/* Custom Children Container */}
            {children ? <View style={styles.childrenContainer}>{children}</View> : null}
          </LinearGradient>
        </BlurView>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    position: 'relative',
    marginVertical: 6,
  },
  containerCompact: {
    borderRadius: 14,
    marginVertical: 4,
  },
  containerPill: {
    borderRadius: 24,
    marginVertical: 4,
  },
  containerTile: {
    borderRadius: 18,
    marginVertical: 6,
    flex: 1,
  },
  pressed: {
    transform: [{ translateY: 3 }, { scale: 0.98 }],
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.5,
  },

  /* 1. Deep Cast Glow */
  castGlow: {
    ...StyleSheet.absoluteFill,
    top: 8,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },

  /* 2. Physical 3D Extrusion Shelf */
  extrusionShelf: {
    position: 'absolute',
    top: 4,
    left: 2,
    right: -2,
    bottom: -5,
    borderRadius: 18,
    borderWidth: 1.2,
    borderBottomWidth: 4,
    borderRightWidth: 3,
    overflow: 'hidden',
    zIndex: 1,
  },
  extrusionBevel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.5,
  },

  /* 3. Front Face Raised Glass Slab */
  frontFace: {
    borderRadius: 18,
    borderWidth: 1.2,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
        } as any)
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 5,
        }),
  },
  specularRidgeTop: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    zIndex: 4,
  },
  specularRidgeLeft: {
    position: 'absolute',
    top: 6,
    left: 0,
    bottom: 6,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 4,
  },
  blurLayer: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  gradientSurface: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
  },
  surfaceCompact: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  surfacePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },

  /* Content Row */
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contentTile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconPad: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    justifyContent: 'center',
  },
  textColTile: {
    width: '100%',
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  titleSelected: {
    color: '#E0F7FA',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 3,
    lineHeight: 16,
  },
  subtitleSelected: {
    color: '#B2EBF2',
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rightElementCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
    borderWidth: 1,
    borderColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childrenContainer: {
    marginTop: 12,
  },
});
