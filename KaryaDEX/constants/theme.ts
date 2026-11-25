/**
 * KaryaDEX Design System — Theme Tokens
 *
 * Visual Philosophy:
 * - Refined, modern glassmorphism with 3-tier surface hierarchy
 * - Atmospheric background ambient lighting (soft violet/blue/indigo orbs)
 * - Restrained, clean Material/iOS-level polish
 * - Subtle translucent borders, soft diffused shadows, gentle top/inner highlights
 */

import { Platform } from 'react-native';

// ─── Brand Colors ───────────────────────────────────────────────
export const brand = {
  violet: '#7C3AED',
  violetLight: '#A78BFA',
  violetDark: '#5B21B6',
  violetSoft: 'rgba(124, 58, 237, 0.10)',
  violetGlow: 'rgba(124, 58, 237, 0.18)',
  indigo: '#6366F1',
  indigoSoft: 'rgba(99, 102, 241, 0.10)',
  indigoGlow: 'rgba(99, 102, 241, 0.18)',
  accent: '#8B5CF6',
};

// ─── Semantic Status Colors ─────────────────────────────────────
export const status = {
  safe: '#10B981',
  safeBg: 'rgba(16, 185, 129, 0.10)',
  safeGlass: 'rgba(16, 185, 129, 0.12)',
  safeBorder: 'rgba(16, 185, 129, 0.24)',
  watch: '#F59E0B',
  watchBg: 'rgba(245, 158, 11, 0.10)',
  watchGlass: 'rgba(245, 158, 11, 0.12)',
  watchBorder: 'rgba(245, 158, 11, 0.24)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.10)',
  dangerGlass: 'rgba(239, 68, 68, 0.12)',
  dangerBorder: 'rgba(239, 68, 68, 0.24)',
  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.10)',
  infoGlass: 'rgba(59, 130, 246, 0.12)',
  infoBorder: 'rgba(59, 130, 246, 0.24)',
};

// ─── Light Mode Colors ──────────────────────────────────────────
export const light = {
  background: '#F6F8FC',
  surface: '#FFFFFF',
  surfaceSecondary: '#EEF2F9',
  surfaceTertiary: '#E2E8F4',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',
  border: 'rgba(15, 23, 42, 0.08)',
  borderStrong: 'rgba(15, 23, 42, 0.16)',
  shadow: 'rgba(15, 23, 42, 0.07)',
  overlay: 'rgba(15, 23, 42, 0.35)',

  // ─── Liquid Glass Tokens (Light Mode) ───
  // Tier 1: Primary Glass (Hero, Overall Card, Bottom Nav, Modals)
  glassPrimary: 'rgba(255, 255, 255, 0.64)',
  glassPrimaryBorder: 'rgba(255, 255, 255, 0.88)',
  glassPrimaryHighlight: 'rgba(255, 255, 255, 0.98)',
  glassPrimaryShadow: '0 16px 36px -4px rgba(15, 23, 42, 0.08), 0 4px 16px -2px rgba(15, 23, 42, 0.04), inset 0 1px 1px rgba(255, 255, 255, 0.98)',

  // Tier 2: Secondary Glass (Subject cards, Task cards, Schedule blocks, Attention rows)
  glassSecondary: 'rgba(255, 255, 255, 0.52)',
  glassSecondaryBorder: 'rgba(255, 255, 255, 0.75)',
  glassSecondaryHighlight: 'rgba(255, 255, 255, 0.90)',
  glassSecondaryShadow: '0 8px 24px -2px rgba(15, 23, 42, 0.05), inset 0 1px 0.5px rgba(255, 255, 255, 0.92)',

  // Tier 3: Semi-Solid / Solid Controls (Pills, inputs, small tags, buttons)
  glassTertiary: 'rgba(255, 255, 255, 0.76)',
  glassTertiaryBorder: 'rgba(255, 255, 255, 0.88)',
  glassTertiaryShadow: '0 2px 8px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9)',

  // Legacy compat tokens
  glass: 'rgba(255, 255, 255, 0.56)',
  glassStrong: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(255, 255, 255, 0.82)',
  glassHighlight: 'rgba(255, 255, 255, 0.95)',

  // ─── Floating Liquid Glass Navigation Bar ───
  tabBar: 'rgba(255, 255, 255, 0.65)',
  tabBarBorder: 'rgba(255, 255, 255, 0.90)',
  tabBarShadow: '0 20px 48px -4px rgba(15, 23, 42, 0.12), 0 6px 18px -2px rgba(15, 23, 42, 0.06), inset 0 1.5px 1px rgba(255, 255, 255, 1), inset 0 -1px 1px rgba(255, 255, 255, 0.5)',
  tabBarActiveCapsuleBg: 'rgba(255, 255, 255, 0.85)',
  tabBarActiveCapsuleBorder: 'rgba(255, 255, 255, 0.98)',
  tabBarActiveCapsuleShadow: '0 3px 12px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 1)',
  tabBarActiveText: '#0F172A',
  tabBarInactiveText: '#64748B',

  // Ambient Lighting Orbs
  ambientOrb1: 'rgba(124, 58, 237, 0.09)',
  ambientOrb2: 'rgba(59, 130, 246, 0.08)',
  ambientOrb3: 'rgba(139, 92, 246, 0.06)',
};

// ─── Dark Mode Colors ───────────────────────────────────────────
export const dark = {
  background: '#05070B',
  surface: '#0A0E1A',
  surfaceSecondary: '#101626',
  surfaceTertiary: '#161E34',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#05070B',
  border: 'rgba(255, 255, 255, 0.10)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  shadow: 'rgba(0, 0, 0, 0.75)',
  overlay: 'rgba(3, 5, 10, 0.88)',

  // ─── Liquid Glass Tokens (Dark Mode) ───
  // Tier 1: Primary Glass (Hero, Overall Card, Bottom Nav, Modals)
  glassPrimary: 'rgba(10, 14, 24, 0.78)',
  glassPrimaryBorder: 'rgba(255, 255, 255, 0.18)',
  glassPrimaryHighlight: 'rgba(255, 255, 255, 0.35)',
  glassPrimaryShadow: '0 24px 50px -4px rgba(0, 0, 0, 0.80), 0 8px 24px -2px rgba(0, 0, 0, 0.50), inset 0 1px 0 rgba(255, 255, 255, 0.25)',

  // Tier 2: Secondary Glass (Subject cards, Task cards, Schedule blocks, Attention rows)
  glassSecondary: 'rgba(12, 18, 32, 0.65)',
  glassSecondaryBorder: 'rgba(255, 255, 255, 0.12)',
  glassSecondaryHighlight: 'rgba(255, 255, 255, 0.20)',
  glassSecondaryShadow: '0 12px 28px -2px rgba(0, 0, 0, 0.60), inset 0 1px 0 rgba(255, 255, 255, 0.16)',

  // Tier 3: Semi-Solid / Solid Controls (Pills, inputs, small tags, buttons)
  glassTertiary: 'rgba(16, 22, 38, 0.82)',
  glassTertiaryBorder: 'rgba(255, 255, 255, 0.14)',
  glassTertiaryShadow: '0 4px 12px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.20)',

  // Legacy compat tokens
  glass: 'rgba(10, 14, 24, 0.70)',
  glassStrong: 'rgba(10, 14, 24, 0.88)',
  glassBorder: 'rgba(255, 255, 255, 0.15)',
  glassHighlight: 'rgba(255, 255, 255, 0.24)',

  // ─── Floating Liquid Glass Navigation Bar ───
  tabBar: 'rgba(8, 11, 20, 0.84)',
  tabBarBorder: 'rgba(255, 255, 255, 0.18)',
  tabBarShadow: '0 24px 56px -4px rgba(0, 0, 0, 0.85), 0 8px 24px -2px rgba(0, 0, 0, 0.60), inset 0 1.2px 0 rgba(255, 255, 255, 0.25), inset 0 -1px 0 rgba(255, 255, 255, 0.05)',
  tabBarActiveCapsuleBg: 'rgba(0, 225, 255, 0.16)',
  tabBarActiveCapsuleBorder: 'rgba(0, 225, 255, 0.65)',
  tabBarActiveCapsuleShadow: '0 4px 16px rgba(0, 225, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.40)',
  tabBarActiveText: '#00E5FF',
  tabBarInactiveText: '#94A3B8',

  // Ambient Lighting Orbs (Amber & Electric Cyan from Onboarding 1 & 2)
  ambientOrb1: 'rgba(245, 158, 11, 0.22)',
  ambientOrb2: 'rgba(0, 225, 255, 0.22)',
  ambientOrb3: 'rgba(245, 158, 11, 0.10)',
};

export type ColorScheme = typeof light;

// ─── Typography ─────────────────────────────────────────────────
export const typography = {
  // Font families — using system fonts for cross-platform
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'System',
  }) as string,

  fontFamilyMono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    web: "'JetBrains Mono', 'Fira Code', monospace",
    default: 'monospace',
  }) as string,

  // Named font family variants for components accessing fontFamilies
  fontFamilies: {
    regular: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      default: 'System',
    }) as string,
    medium: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      default: 'System',
    }) as string,
    semibold: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      default: 'System',
    }) as string,
    bold: Platform.select({
      ios: 'System',
      android: 'Roboto',
      web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      default: 'System',
    }) as string,
    mono: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      web: "'JetBrains Mono', 'Fira Code', monospace",
      default: 'monospace',
    }) as string,
  },

  // Size scale
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 30,
    '3xl': 36,
    '4xl': 48,
  },

  // Weight scale
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },

  // Line heights (pixel values for React Native Text components)
  lineHeights: {
    tight: 18,
    normal: 20,
    relaxed: 22,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1.0,
  },
};

// ─── Spacing Scale ──────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

// ─── Border Radii ───────────────────────────────────────────────
export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 9999,
};

// ─── Shadows ────────────────────────────────────────────────────
export const shadows = {
  sm: Platform.OS === 'web'
    ? { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
  md: Platform.OS === 'web'
    ? { boxShadow: '0 3px 10px rgba(0,0,0,0.07)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 3,
      },
  lg: Platform.OS === 'web'
    ? { boxShadow: '0 6px 20px rgba(0,0,0,0.10)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 16,
        elevation: 6,
      },
  xl: Platform.OS === 'web'
    ? { boxShadow: '0 12px 32px rgba(0,0,0,0.14)' }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
        elevation: 10,
      },
  glow: Platform.OS === 'web'
    ? { boxShadow: '0 4px 20px rgba(124,58,237,0.25)' }
    : {
        shadowColor: brand.violet,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
      },
};

// ─── Animation Durations ────────────────────────────────────────
export const animation = {
  micro: 150,
  fast: 200,
  normal: 300,
  slow: 400,
  spring: {
    damping: 20,
    stiffness: 300,
    mass: 0.8,
  },
  springGentle: {
    damping: 25,
    stiffness: 200,
    mass: 1,
  },
};

// ─── Breakpoints ────────────────────────────────────────────────
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

// ─── Glass Style Helpers ────────────────────────────────────────
export type GlassTier = 'primary' | 'secondary' | 'tertiary';
export type GlassIntensity = 'subtle' | 'medium' | 'strong';

export const getGlassStyle = (
  colors: ColorScheme,
  levelOrIntensity: GlassTier | GlassIntensity = 'secondary'
) => {
  // Map intensity names to 3-tier hierarchy
  const level: GlassTier =
    levelOrIntensity === 'strong'
      ? 'primary'
      : levelOrIntensity === 'subtle'
      ? 'tertiary'
      : levelOrIntensity === 'primary' || levelOrIntensity === 'secondary' || levelOrIntensity === 'tertiary'
      ? levelOrIntensity
      : 'secondary';

  const tierMap = {
    primary: {
      backgroundColor: colors.glassPrimary,
      borderColor: colors.glassPrimaryBorder,
      borderWidth: 1,
      blur: 24,
      boxShadow: colors.glassPrimaryShadow,
      radius: radii['2xl'],
    },
    secondary: {
      backgroundColor: colors.glassSecondary,
      borderColor: colors.glassSecondaryBorder,
      borderWidth: 1,
      blur: 16,
      boxShadow: colors.glassSecondaryShadow,
      radius: radii.xl,
    },
    tertiary: {
      backgroundColor: colors.glassTertiary,
      borderColor: colors.glassTertiaryBorder,
      borderWidth: 0.5,
      blur: 10,
      boxShadow: colors.glassTertiaryShadow,
      radius: radii.lg,
    },
  };

  const config = tierMap[level];

  return {
    backgroundColor: config.backgroundColor,
    borderColor: config.borderColor,
    borderWidth: config.borderWidth,
    borderRadius: config.radius,
    overflow: 'hidden' as const,
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: `blur(${config.blur}px) saturate(180%)`,
          WebkitBackdropFilter: `blur(${config.blur}px) saturate(180%)`,
          boxShadow: config.boxShadow,
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: level === 'primary' ? 6 : 3 },
          shadowOpacity: level === 'primary' ? 0.16 : 0.08,
          shadowRadius: level === 'primary' ? 16 : 8,
          elevation: level === 'primary' ? 6 : 3,
        }),
  };
};

// ─── Icon sizes ─────────────────────────────────────────────────
export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
};
