/**
 * BunkMatKar — FocusGuidanceModal
 *
 * Productivity and iOS/Android DND guidance walkthrough modal
 * explaining how to configure Do Not Disturb and Focus modes during study sessions.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing, brand } from '@/constants/theme';
import { GlassCard } from '@/components/ui';

interface FocusGuidanceModalProps {
  visible: boolean;
  onClose: () => void;
}

export function FocusGuidanceModal({ visible, onClose }: FocusGuidanceModalProps) {
  const { colors, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: Platform.OS === 'web'
              ? 'rgba(5, 7, 11, 0.85)'
              : 'rgba(3, 5, 10, 0.90)',
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close guidance modal"
        />
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#0A0E1A' : colors.surface,
              borderColor: colors.borderStrong,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>Focus Guidance</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Maximize deep work & eliminate distractions
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: colors.surfaceSecondary },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather name="x" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Guide steps */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.stepCard,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              ]}
            >
              <View style={styles.stepNumWrap}>
                <Text style={styles.stepNum}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Enable Do Not Disturb</Text>
                <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                  Silence non-essential notifications in your device settings before starting a LOCKIN session.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.stepCard,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              ]}
            >
              <View style={styles.stepNumWrap}>
                <Text style={styles.stepNum}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Choose an Exam Preset</Text>
                <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                  Select your target exam or study routine from our curated presets to match your preparation depth.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.stepCard,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              ]}
            >
              <View style={styles.stepNumWrap}>
                <Text style={styles.stepNum}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Maintain Your Streak</Text>
                <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                  Complete at least one focus session every day to keep your streak burning and build consistency.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.footerBtn,
              { backgroundColor: isDark ? '#00E5FF' : brand.violet },
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Text style={[styles.footerBtnText, { color: isDark ? '#05070B' : '#FFFFFF' }]}>
              Got it, let's focus
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
      },
      default: {},
    }),
  },
  container: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    borderRadius: radii['2xl'],
    borderWidth: 1,
    padding: spacing.xl,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      },
      default: {
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  stepNumWrap: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: brand.violet,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  stepDesc: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  footerBtn: {
    marginTop: spacing.lg,
    height: 50,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
});