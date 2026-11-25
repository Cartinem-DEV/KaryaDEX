/**
 * KaryaDEX — AttendanceIntelligenceModal Component (Phase 8)
 *
 * Comprehensive Attendance Intelligence Modal:
 * - Deterministic Attendance Intelligence Snapshot
 * - Status, Trend, and Pressure badges
 * - Safe Bunk Breakdown (Immediately Safe vs Conditionally Safe vs Effective Capacity)
 * - Recovery Intelligence with mathematical feasibility and deadline estimation
 * - Exam-Aware Attendance Exposure
 * - Interactive Multi-Class What-If Simulator (miss, attend, custom)
 * - 1-tap Attendance Task creation for recovery planning
 * - Accessible, responsive, aligned with KaryaDEX glassmorphism design system
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard, StatusBadge, AttendanceRing } from '@/components/ui';
import { attendanceIntelligenceService } from '@/services/attendanceIntelligenceService';
import { useAppStore } from '@/store/useAppStore';
import type { AttendanceIntelligenceSnapshot } from '@/types/academic';
import type { Task } from '@/types';
import { formatLocalDate } from '@/lib/timeUtils';

interface AttendanceIntelligenceModalProps {
  visible: boolean;
  onClose: () => void;
  subjectId: string;
}

export function AttendanceIntelligenceModal({
  visible,
  onClose,
  subjectId,
}: AttendanceIntelligenceModalProps) {
  const { colors, isDark } = useTheme();
  const addTask = useAppStore(s => s.addTask);

  // What-If Simulator local state
  const [simMode, setSimMode] = useState<'miss' | 'attend'>('miss');
  const [simCount, setSimCount] = useState<number>(1);
  const [taskCreated, setTaskCreated] = useState<boolean>(false);

  if (!visible || !subjectId) return null;

  const snapshot: AttendanceIntelligenceSnapshot =
    attendanceIntelligenceService.getSubjectAttendanceSnapshot(subjectId);

  // Simulation result
  const simResult = attendanceIntelligenceService.simulateWhatIf({
    subjectId,
    simulatedMisses: simMode === 'miss' ? simCount : 0,
    simulatedPresents: simMode === 'attend' ? simCount : 0,
  });

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return statusColors.safe;
      case 'declining': return statusColors.danger;
      case 'stable': return '#3B82F6';
      default: return colors.textTertiary;
    }
  };

  const getPressureColor = (pressure: string) => {
    switch (pressure) {
      case 'critical': return statusColors.danger;
      case 'high': return '#F59E0B';
      case 'medium': return '#EAB308';
      case 'low': return statusColors.safe;
      default: return colors.textTertiary;
    }
  };

  const handleCreateRecoveryTask = () => {
    const todayStr = formatLocalDate();
    const newTask: Task = {
      id: `task-att-${Date.now()}`,
      title: `Attend ${snapshot.subjectName} Classes (Recovery)`,
      description: `Target attendance is ${snapshot.targetPercentage}%. Currently at ${snapshot.currentPercentage.toFixed(1)}%. Need ${snapshot.recovery.consecutiveClassesNeeded} consecutive classes to recover.`,
      subjectId: snapshot.subjectId,
      dueDate: snapshot.recovery.recoveryDeadlineDate || todayStr,
      category: 'study',
      priority: snapshot.pressure === 'critical' ? 'urgent' : 'high',
      status: 'planned',
      isCompleted: false,
      scheduledDate: todayStr,
      createdAt: new Date().toISOString(),
    };

    addTask(newTask);
    setTaskCreated(true);
    setTimeout(() => setTaskCreated(false), 3000);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#12121A' : '#F9FAFB',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.kicker, { color: brand.violet }]}>
                ATTENDANCE INTELLIGENCE
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                {snapshot.subjectName}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close attendance modal"
              style={[
                styles.closeBtn,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
              ]}
            >
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Snapshot Hero Card */}
            <GlassCard level="primary" style={styles.heroCard}>
              <View style={styles.heroRow}>
                <AttendanceRing
                  percentage={snapshot.currentPercentage}
                  size={84}
                  strokeWidth={6}
                  attendanceStatus={snapshot.status}
                />
                <View style={styles.heroMeta}>
                  <View style={styles.badgeRow}>
                    <StatusBadge variant={snapshot.status} size="md" />
                    <View style={[styles.pillBadge, { borderColor: getTrendColor(snapshot.trend) }]}>
                      <Text style={[styles.pillBadgeText, { color: getTrendColor(snapshot.trend) }]}>
                        {snapshot.trend.toUpperCase().replace('_', ' ')}
                      </Text>
                    </View>
                    <View style={[styles.pillBadge, { borderColor: getPressureColor(snapshot.pressure) }]}>
                      <Text style={[styles.pillBadgeText, { color: getPressureColor(snapshot.pressure) }]}>
                        {snapshot.pressure.toUpperCase()} PRESSURE
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.heroPercent, { color: colors.text }]}>
                    {snapshot.currentPercentage.toFixed(1)}%
                  </Text>
                  <Text style={[styles.heroDetail, { color: colors.textSecondary }]}>
                    Target: {snapshot.targetPercentage}% · {snapshot.attended} present / {snapshot.total} total ({snapshot.missed} missed)
                  </Text>
                  <Text
                    style={[
                      styles.marginNote,
                      { color: snapshot.safetyMargin >= 0 ? statusColors.safe : statusColors.danger },
                    ]}
                  >
                    {snapshot.safetyMargin >= 0
                      ? `+${snapshot.safetyMargin.toFixed(1)}% margin above target`
                      : `${Math.abs(snapshot.safetyMargin).toFixed(1)}% below target threshold`}
                  </Text>
                </View>
              </View>

              {/* Recommendation Banner */}
              <View style={[styles.recommendationBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <Text style={[styles.recText, { color: colors.text }]}>
                  {snapshot.recommendation}
                </Text>
              </View>
            </GlassCard>

            {/* Safe Bunk Breakdown Card */}
            <GlassCard level="secondary" style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Safe Bunk Capacity
              </Text>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: statusColors.safe }]}>
                    {snapshot.safeBunks.immediatelySafe}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Immediately Safe (≥ {snapshot.targetPercentage + 5}%)
                  </Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                    {snapshot.safeBunks.conditionallySafe}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Conditionally Safe (Watch Zone)
                  </Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: brand.violet }]}>
                    {snapshot.safeBunks.effectiveBunkCapacity}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Effective Capacity ({snapshot.futureClassesRemaining} classes left)
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Recovery Intelligence (if in danger or needed) */}
            {snapshot.recovery.isNeeded && (
              <GlassCard
                level="secondary"
                style={{
                  ...styles.sectionCard,
                  borderColor: snapshot.recovery.isPossible ? statusColors.danger : '#EF4444',
                }}
              >
                <Text style={[styles.sectionTitle, { color: statusColors.danger }]}>
                  Attendance Recovery Plan
                </Text>
                {snapshot.recovery.isPossible ? (
                  <>
                    <Text style={[styles.recoveryBody, { color: colors.text }]}>
                      Attend the next <Text style={{ fontWeight: '700' }}>{snapshot.recovery.consecutiveClassesNeeded}</Text> consecutive classes to restore attendance to {snapshot.recovery.projectedPercentageAfterRecovery.toFixed(1)}%.
                    </Text>
                    {snapshot.recovery.recoveryDeadlineDate && (
                      <Text style={[styles.recoveryDeadline, { color: colors.textSecondary }]}>
                        Target Recovery Date: {snapshot.recovery.recoveryDeadlineDate}
                      </Text>
                    )}
                    <Pressable
                      onPress={handleCreateRecoveryTask}
                      disabled={taskCreated}
                      style={[
                        styles.taskBtn,
                        { backgroundColor: taskCreated ? statusColors.safe : brand.violet },
                      ]}
                    >
                      <Text style={styles.taskBtnText}>
                        {taskCreated ? '✓ Recovery Task Added' : '+ Create Attendance Recovery Task'}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={[styles.impossibleWarning, { color: statusColors.danger }]}>
                    ⚠️ {snapshot.recovery.impossibleReason}
                  </Text>
                )}
              </GlassCard>
            )}

            {/* Upcoming Exam Exposure */}
            {snapshot.examExposure && (
              <GlassCard level="secondary" style={styles.sectionCard}>
                <View style={styles.examHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Exam Attendance Exposure
                  </Text>
                  {snapshot.examExposure.isHighExposure && (
                    <View style={[styles.pillBadge, { borderColor: statusColors.danger }]}>
                      <Text style={[styles.pillBadgeText, { color: statusColors.danger }]}>
                        HIGH RISK
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.examMeta, { color: colors.textSecondary }]}>
                  Exam: {snapshot.examExposure.examName} on {snapshot.examExposure.examDate} ({snapshot.examExposure.daysUntil} days away)
                </Text>
                <Text style={[styles.examDetail, { color: colors.text }]}>
                  Classes before exam: {snapshot.examExposure.classesBeforeExam} · Safe bunks allowed before exam: {snapshot.examExposure.safeBunksBeforeExam}
                </Text>
              </GlassCard>
            )}

            {/* What-If Simulator Card */}
            <GlassCard level="secondary" style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Attendance What-If Simulator
              </Text>

              {/* Mode Toggle */}
              <View style={styles.modeRow}>
                <Pressable
                  onPress={() => setSimMode('miss')}
                  style={[
                    styles.modeBtn,
                    simMode === 'miss' && {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)',
                      borderColor: statusColors.danger,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      { color: simMode === 'miss' ? statusColors.danger : colors.textSecondary },
                    ]}
                  >
                    If I miss classes
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setSimMode('attend')}
                  style={[
                    styles.modeBtn,
                    simMode === 'attend' && {
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)',
                      borderColor: statusColors.safe,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      { color: simMode === 'attend' ? statusColors.safe : colors.textSecondary },
                    ]}
                  >
                    If I attend classes
                  </Text>
                </Pressable>
              </View>

              {/* Class Count Selector */}
              <View style={styles.stepperRow}>
                <Text style={[styles.stepperLabel, { color: colors.textSecondary }]}>
                  Simulate {simMode === 'miss' ? 'missing' : 'attending'}:
                </Text>
                <View style={styles.countList}>
                  {[1, 2, 3, 4, 5, 8].map(count => (
                    <Pressable
                      key={count}
                      onPress={() => setSimCount(count)}
                      style={[
                        styles.countBtn,
                        simCount === count && {
                          backgroundColor: brand.violet,
                          borderColor: brand.violet,
                        },
                        simCount !== count && {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.countBtnText,
                          { color: simCount === count ? '#FFFFFF' : colors.text },
                        ]}
                      >
                        {count}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Projected Result Box */}
              <View style={styles.simResultBox}>
                <View style={styles.simResultHeader}>
                  <Text style={[styles.simResultPct, { color: colors.text }]}>
                    {simResult.projectedPercentage.toFixed(1)}%
                  </Text>
                  <Text
                    style={[
                      styles.simResultDelta,
                      {
                        color:
                          simResult.delta > 0
                            ? statusColors.safe
                            : simResult.delta < 0
                            ? statusColors.danger
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    {simResult.delta > 0 ? `+${simResult.delta.toFixed(1)}%` : `${simResult.delta.toFixed(1)}%`}
                  </Text>
                  <StatusBadge variant={simResult.projectedStatus} size="sm" />
                </View>

                <Text style={[styles.simResultMsg, { color: colors.textSecondary }]}>
                  {simResult.recommendation}
                </Text>
              </View>
            </GlassCard>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '90%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  heroCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroMeta: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  pillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  pillBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroPercent: {
    fontSize: 28,
    fontWeight: '800',
  },
  heroDetail: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  marginNote: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  recommendationBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  recText: {
    fontSize: typography.sizes.xs + 1,
    lineHeight: 18,
  },
  sectionCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statBox: {
    flex: 1,
    padding: spacing.xs + 2,
    borderRadius: radii.md,
    backgroundColor: 'rgba(124, 77, 255, 0.05)',
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  recoveryBody: {
    fontSize: typography.sizes.sm,
    marginTop: 4,
  },
  recoveryDeadline: {
    fontSize: typography.sizes.xs,
    marginTop: 4,
  },
  impossibleWarning: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 4,
  },
  taskBtn: {
    marginTop: spacing.sm,
    paddingVertical: 10,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  taskBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.sizes.sm,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  examDetail: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: '600',
    marginTop: 4,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  modeBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  stepperLabel: {
    fontSize: typography.sizes.xs,
  },
  countList: {
    flexDirection: 'row',
    gap: 6,
  },
  countBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  countBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  simResultBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(124, 77, 255, 0.08)',
  },
  simResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  simResultPct: {
    fontSize: 22,
    fontWeight: '800',
  },
  simResultDelta: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  simResultMsg: {
    fontSize: typography.sizes.xs,
    marginTop: 4,
    lineHeight: 16,
  },
});
