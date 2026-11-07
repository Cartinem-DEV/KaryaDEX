/**
 * BunkMatKar — LOCKIN Tab Screen
 *
 * Dedicated screen for the LOCKIN deep work & exam focus timer.
 * Integrates LockInTimer, StreakCard, FocusAnalyticsView, SessionConfigModal,
 * and FocusGuidanceModal with Liquid Glass design.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing, brand } from '@/constants/theme';
import { AmbientBackground } from '@/components/ui';
import { LockInTimer } from '@/components/lockin/LockInTimer';
import { StreakCard } from '@/components/lockin/StreakCard';
import { FocusAnalyticsView } from '@/components/lockin/FocusAnalyticsView';
import { SessionConfigModal } from '@/components/lockin/SessionConfigModal';
import { FocusGuidanceModal } from '@/components/lockin/FocusGuidanceModal';
import { FocusPlannerModal } from '@/components/lockin/FocusPlannerModal';
import { AppQuotaModal } from '@/components/lockin/AppQuotaModal';
import { RealityCheckOverlay } from '@/components/lockin/RealityCheckOverlay';
import { EmergencyPassModal } from '@/components/lockin/EmergencyPassModal';
import { BlockedAppsManager } from '@/components/lockin/BlockedAppsManager';
import { useLockInStore } from '@/hooks/useLockInStore';
import { AuthService } from '@/services/auth/authService';
import { useRouter } from 'expo-router';
import { lockinPlaygroundBridge } from '@/lib/lockin/lockinPlaygroundBridge';

export default function LockInScreen() {
  const { colors, isDark } = useTheme();

  const loadActiveSession = useLockInStore((s) => s.loadActiveSession);
  const loadSessions = useLockInStore((s) => s.loadSessions);
  const loadStreaks = useLockInStore((s) => s.loadStreaks);
  const loadPresets = useLockInStore((s) => s.loadPresets);
  const loadStatistics = useLockInStore((s) => s.loadStatistics);
  const defaultPreset = useLockInStore((s) => s.defaultPreset);
  const selectedPresetId = useLockInStore((s) => s.selectedPresetId);
  const presets = useLockInStore((s) => s.presets);
  const isConfigModalOpen = useLockInStore((s) => s.isConfigModalOpen);
  const setConfigModalOpen = useLockInStore((s) => s.setConfigModalOpen);
  const isGuidanceModalOpen = useLockInStore((s) => s.isGuidanceModalOpen);
  const setGuidanceModalOpen = useLockInStore((s) => s.setGuidanceModalOpen);
  const isFocusPlannerOpen = useLockInStore((s) => s.isFocusPlannerOpen);
  const setFocusPlannerOpen = useLockInStore((s) => s.setFocusPlannerOpen);
  const isAppQuotaOpen = useLockInStore((s) => s.isAppQuotaOpen);
  const setAppQuotaOpen = useLockInStore((s) => s.setAppQuotaOpen);
  const isRealityCheckOpen = useLockInStore((s) => s.isRealityCheckOpen);
  const setRealityCheckOpen = useLockInStore((s) => s.setRealityCheckOpen);
  const isEmergencyPassOpen = useLockInStore((s) => s.isEmergencyPassOpen);
  const setEmergencyPassOpen = useLockInStore((s) => s.setEmergencyPassOpen);
  const [isBlockedAppsManagerOpen, setBlockedAppsManagerOpen] = useState(false);
  const blockedApps = useLockInStore((s) => s.blockedApps);
  const toggleBlockedApp = useLockInStore((s) => s.toggleBlockedApp);
  const removeBlockedApp = useLockInStore((s) => s.removeBlockedApp);
  const addBlockedApp = useLockInStore((s) => s.addBlockedApp);

  const [activePreset, setActivePreset] = useState(defaultPreset);
  const router = useRouter();
  const [activeBreak, setActiveBreak] = useState(lockinPlaygroundBridge.getActiveBreak());
  const [remainingBreakSec, setRemainingBreakSec] = useState(lockinPlaygroundBridge.getRemainingBreakSeconds());

  useEffect(() => {
    const unsub = lockinPlaygroundBridge.subscribe(() => {
      setActiveBreak(lockinPlaygroundBridge.getActiveBreak());
      setRemainingBreakSec(lockinPlaygroundBridge.getRemainingBreakSeconds());
    });
    const interval = setInterval(() => {
      if (lockinPlaygroundBridge.isBreakActive()) {
        setRemainingBreakSec(lockinPlaygroundBridge.getRemainingBreakSeconds());
      }
    }, 1000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleLaunchPlaygroundFromBreak = () => {
    const validation = lockinPlaygroundBridge.validateLaunch();
    if (!validation.allowed) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    lockinPlaygroundBridge.launchGame('sprint_duel');
    router.push('/(tabs)/playground');
  };

  const handleEndBreak = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lockinPlaygroundBridge.endBreak();
  };

  useEffect(() => {
    const user = AuthService.getInstance().getCurrentUser();
    if (user) {
      loadActiveSession();
      loadSessions(user.id);
      loadStreaks(user.id);
      loadPresets(user.id);
      loadStatistics(user.id);
    }
  }, [loadActiveSession, loadSessions, loadStreaks, loadPresets, loadStatistics]);

  // Keep active preset in sync with selectedPresetId or defaultPreset
  useEffect(() => {
    if (selectedPresetId && presets.length > 0) {
      const found = presets.find((p) => p.id === selectedPresetId);
      if (found) {
        setActivePreset(found);
        return;
      }
    }
    if (defaultPreset) {
      setActivePreset(defaultPreset);
    } else if (presets.length > 0) {
      setActivePreset(presets[0]);
    }
  }, [selectedPresetId, defaultPreset, presets]);

  const handleOpenConfig = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfigModalOpen(true);
  };

  const handleOpenGuidance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGuidanceModalOpen(true);
  };

  const handleOpenFocusPlanner = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFocusPlannerOpen(true);
  };

  const handleOpenAppQuota = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAppQuotaOpen(true);
  };

  const handleOpenRealityCheck = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRealityCheckOpen(true);
  };

  const handleOpenEmergencyPass = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmergencyPassOpen(true);
  };

  const user = AuthService.getInstance().getCurrentUser();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AmbientBackground forceDark />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : colors.text }]}>LOCKIN</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Deep work & exam focus timer
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={handleOpenConfig}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: isDark ? 'rgba(0, 225, 255, 0.12)' : brand.violetSoft,
                  borderColor: isDark ? 'rgba(0, 225, 255, 0.3)' : 'rgba(124, 58, 237, 0.2)',
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather
                name="sliders"
                size={18}
                color={isDark ? '#00E5FF' : brand.violet}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleOpenGuidance}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather name="help-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Timer Hero Component */}
        <View style={styles.section}>
          <LockInTimer preset={activePreset} />
        </View>

        {/* LockIn Break & Playground Bridge Card */}
        {activeBreak?.isBreakActive ? (
          <View style={styles.section}>
            <View
              style={[
                styles.breakCard,
                {
                  backgroundColor: isDark ? 'rgba(0, 229, 255, 0.08)' : 'rgba(0, 229, 255, 0.05)',
                  borderColor: isDark ? 'rgba(0, 229, 255, 0.3)' : 'rgba(0, 229, 255, 0.2)',
                },
              ]}
              testID="lockin-active-break-card"
            >
              <View style={styles.breakCardHeader}>
                <View style={styles.breakCardBadge}>
                  <View style={styles.breakCardPulseDot} />
                  <Text style={styles.breakCardBadgeText}>BREAK ACTIVE</Text>
                </View>
                <Pressable onPress={handleEndBreak} accessibilityRole="button">
                  <Text style={styles.breakEndText}>End Break</Text>
                </Pressable>
              </View>

              <Text style={[styles.breakCardTitle, { color: isDark ? '#FFFFFF' : colors.text }]}>
                {Math.floor(remainingBreakSec / 60)}m {String(remainingBreakSec % 60).padStart(2, '0')}s remaining
              </Text>
              <Text style={[styles.breakCardSubtitle, { color: colors.textSecondary }]}>
                'Cognitive mini-games unlocked! Quick 60s speed math & logic puzzles.'
              </Text>

              <Pressable
                onPress={remainingBreakSec > 0 ? handleLaunchPlaygroundFromBreak : undefined}
                disabled={remainingBreakSec <= 0}
                style={({ pressed }) => [
                  styles.breakLaunchBtn,
                  remainingBreakSec <= 0
                    ? styles.breakLaunchBtnDisabled
                    : { backgroundColor: '#00E5FF' },
                  pressed && remainingBreakSec > 0 && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                testID="lockin-launch-playground-btn"
              >
                <Ionicons
                  name="game-controller-outline"
                  size={18}
                  color={remainingBreakSec <= 0 ? 'rgba(255, 255, 255, 0.35)' : '#05070B'}
                />
                <Text
                  style={[
                    styles.breakLaunchBtnText,
                    remainingBreakSec <= 0 && styles.breakLaunchBtnTextDisabled,
                  ]}
                >
                  {remainingBreakSec > 0
                    ? 'Play Brain Break Game (Playground)'
                    : 'Break Concluded'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View
              style={[
                styles.breakCardInactive,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
              testID="lockin-inactive-break-card"
            >
              <View style={styles.breakCardInactiveRow}>
                <Ionicons name="game-controller-outline" size={20} color={colors.textSecondary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.breakInactiveTitle, { color: isDark ? '#FFFFFF' : colors.text }]}>
                    Brain Playground Breaks
                  </Text>
                  <Text style={[styles.breakInactiveSub, { color: colors.textSecondary }]}>
                    Unlock speed duels & puzzles during scheduled breaks.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Streak Visualization */}
        <View style={styles.section}>
          <StreakCard streakType="daily" />
        </View>

        {/* Focus Analytics */}
        <View style={[styles.section, styles.lastSection]}>
          <FocusAnalyticsView />
        </View>

        {/* Phase 3 Features */}
        <View style={[styles.section, styles.lastSection]}>
          <View style={styles.phase3Grid}>
            <Pressable
              accessibilityRole="button"
              onPress={handleOpenFocusPlanner}
              style={({ pressed }) => [
                styles.phase3Card,
                { backgroundColor: isDark ? '#1A1A2E' : colors.surfaceSecondary },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="calendar-outline" size={24} color={brand.violet} />
              <Text style={styles.phase3CardTitle}>Focus Planner</Text>
              <Text style={styles.phase3CardDesc}>Recurring study schedules</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleOpenAppQuota}
              style={({ pressed }) => [
                styles.phase3Card,
                { backgroundColor: isDark ? '#1A1A2E' : colors.surfaceSecondary },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="timer-outline" size={24} color="#F59E0B" />
              <Text style={styles.phase3CardTitle}>App Quotas</Text>
              <Text style={styles.phase3CardDesc}>Daily usage limits</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleOpenRealityCheck}
              style={({ pressed }) => [
                styles.phase3Card,
                { backgroundColor: isDark ? '#1A1A2E' : colors.surfaceSecondary },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="pause-circle-outline" size={24} color="#10B981" />
              <Text style={styles.phase3CardTitle}>Reality Check</Text>
              <Text style={styles.phase3CardDesc}>Intentional pause before apps</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleOpenEmergencyPass}
              style={({ pressed }) => [
                styles.phase3Card,
                { backgroundColor: isDark ? '#1A1A2E' : colors.surfaceSecondary },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="shield-checkmark" size={24} color="#EF4444" />
              <Text style={styles.phase3CardTitle}>Emergency Pass</Text>
              <Text style={styles.phase3CardDesc}>Break passes for hard mode</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setBlockedAppsManagerOpen(true)}
              style={({ pressed }) => [
                styles.phase3Card,
                { backgroundColor: isDark ? '#1A1A2E' : colors.surfaceSecondary },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="grid-outline" size={24} color="#F59E0B" />
              <Text style={styles.phase3CardTitle}>Blocked Apps</Text>
              <Text style={styles.phase3CardDesc}>Manage app blocklist</Text>
            </Pressable>

          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <SessionConfigModal
        visible={isConfigModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onSelectPreset={(preset) => setActivePreset(preset)}
      />

      <FocusGuidanceModal
        visible={isGuidanceModalOpen}
        onClose={() => setGuidanceModalOpen(false)}
      />

      <FocusPlannerModal
        visible={isFocusPlannerOpen}
        userId={user?.id || ''}
        onClose={() => setFocusPlannerOpen(false)}
      />

      <AppQuotaModal
        visible={isAppQuotaOpen}
        userId={user?.id || ''}
        onClose={() => setAppQuotaOpen(false)}
      />

      <RealityCheckOverlay
        visible={isRealityCheckOpen}
        userId={user?.id || ''}
        onClose={() => setRealityCheckOpen(false)}
      />

      <EmergencyPassModal
        visible={isEmergencyPassOpen}
        userId={user?.id || ''}
        onClose={() => setEmergencyPassOpen(false)}
      />

      <BlockedAppsManager
        visible={isBlockedAppsManagerOpen}
        userId={user?.id || ''}
        onClose={() => setBlockedAppsManagerOpen(false)}
        blockedApps={blockedApps}
        onToggle={toggleBlockedApp}
        onRemove={removeBlockedApp}
        onAddApp={addBlockedApp}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070B',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: 120, // space for floating tab bar
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  section: {
    width: '100%',
  },
  lastSection: {
    marginBottom: spacing.xl,
  },
  phase3Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  phase3Card: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  phase3CardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  breakCard: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1.5,
  },
  breakCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  breakCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  breakCardPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
  },
  breakCardBadgeText: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  breakEndText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: typography.weights.medium,
  },
  breakCardTitle: {
    fontSize: 22,
    fontWeight: typography.weights.heavy,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  breakCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
    lineHeight: 16,
  },
  breakLaunchBtn: {
    height: 44,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  breakLaunchBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  breakLaunchBtnText: {
    color: '#05070B',
    fontSize: 14,
    fontWeight: typography.weights.bold,
  },
  breakLaunchBtnTextDisabled: {
    color: 'rgba(255, 255, 255, 0.35)',
  },
  breakCardInactive: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  breakCardInactiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakInactiveTitle: {
    fontSize: 13,
    fontWeight: typography.weights.semibold,
  },
  breakInactiveSub: {
    fontSize: 11,
    marginTop: 2,
  },
  takeBreakQuickBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  takeBreakQuickBtnText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  phase3CardDesc: {
    fontSize: typography.sizes.xs,
    color: '#888',
    textAlign: 'center',
  },
});