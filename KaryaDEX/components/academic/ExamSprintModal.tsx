/**
 * KaryaDEX — Exam Sprint Modal (Phase 7)
 *
 * Surfaces deterministic Exam Readiness snapshot and sequenced,
 * workload-aware day-by-day revision sprint plans.
 * Provides 1-tap conversion of sprint recommendations into Tasks.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { examSprintService } from '@/services/examSprintService';
import { useAcademicStore } from '@/store/useAcademicStore';
import type { RevisionPriority } from '@/types/academic';

interface ExamSprintModalProps {
  visible: boolean;
  onClose: () => void;
  examId: string | null;
  onSelectTopic?: (topicId: string) => void;
}

export function ExamSprintModal({
  visible,
  onClose,
  examId,
  onSelectTopic,
}: ExamSprintModalProps) {
  const { colors, isDark } = useTheme();
  const academic = useAcademicStore();
  const [createdTasks, setCreatedTasks] = useState<Record<string, boolean>>({});

  if (!visible || !examId) return null;

  const plan = examSprintService.generateExamSprintPlan(examId);
  if (!plan) return null;

  const { readiness, days, totalSprintTopics, totalEstimatedMinutes, workloadWarning } = plan;

  const handleCreateTaskForTopic = async (topicId: string, scheduledDate: string, minutes: number) => {
    try {
      await examSprintService.convertSprintTopicToTask({
        topicId,
        examId,
        scheduledDate,
        estimatedMinutes: minutes,
      });
      setCreatedTasks(prev => ({ ...prev, [topicId]: true }));
    } catch (err) {
      console.error('Failed to create sprint task:', err);
    }
  };

  const getPriorityBadge = (priority: RevisionPriority) => {
    switch (priority) {
      case 'critical':
        return { label: 'CRITICAL', color: '#EF4444', bg: '#EF444422' };
      case 'high':
        return { label: 'HIGH', color: '#F97316', bg: '#F9731622' };
      case 'medium':
        return { label: 'MEDIUM', color: '#FBBF24', bg: '#FBBF2422' };
      default:
        return { label: 'LOW', color: '#10B981', bg: '#10B98122' };
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          Platform.OS === 'web' && ({ backdropFilter: 'blur(20px)' } as any),
        ]}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? 'rgba(18, 19, 28, 0.96)' : 'rgba(255, 255, 255, 0.98)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.10)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: brand.violet }]}>EXAM SPRINT PLANNER</Text>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {plan.examName}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {readiness.daysRemaining <= 0
                  ? 'Exam is Today!'
                  : `${readiness.daysRemaining} days remaining · ${totalSprintTopics} topics in sprint`}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* 1. Exam Readiness Card */}
            <GlassCard level="primary" style={styles.readinessCard}>
              <View style={styles.readinessHeader}>
                <View>
                  <Text style={[styles.readinessLabel, { color: colors.textSecondary }]}>
                    ACADEMIC READINESS
                  </Text>
                  <Text style={[styles.readinessPercent, { color: colors.text }]}>
                    {readiness.readinessPercentage}%
                  </Text>
                </View>
                <View style={styles.readinessMetaRight}>
                  <Text style={[styles.workloadText, { color: brand.violet }]}>
                    ~{totalEstimatedMinutes} min
                  </Text>
                  <Text style={[styles.workloadSub, { color: colors.textTertiary }]}>
                    Revision workload
                  </Text>
                </View>
              </View>

              {/* Metrics Grid */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricVal, { color: colors.text }]}>
                    {readiness.totalSyllabusTopics}
                  </Text>
                  <Text style={[styles.metricLbl, { color: colors.textTertiary }]}>Total</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricVal, { color: '#3B82F6' }]}>
                    {readiness.taughtTopics}
                  </Text>
                  <Text style={[styles.metricLbl, { color: colors.textTertiary }]}>Taught</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricVal, { color: statusColors.safe }]}>
                    {readiness.confidentTopics}
                  </Text>
                  <Text style={[styles.metricLbl, { color: colors.textTertiary }]}>Confident</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricVal, { color: statusColors.danger }]}>
                    {readiness.needsReviewTopics}
                  </Text>
                  <Text style={[styles.metricLbl, { color: colors.textTertiary }]}>Needs Review</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricVal, { color: statusColors.watch }]}>
                    {readiness.notReviewedTopics}
                  </Text>
                  <Text style={[styles.metricLbl, { color: colors.textTertiary }]}>Unreviewed</Text>
                </View>
              </View>

              <Text style={[styles.readinessNote, { color: colors.textTertiary }]}>
                Snapshot based on your recorded reviews, syllabus coverage, and confidence.
              </Text>
            </GlassCard>

            {/* Workload Warning Banner (if overloaded) */}
            {workloadWarning && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>{workloadWarning}</Text>
              </View>
            )}

            {/* 2. Sequenced Sprint Days */}
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              RECOMMENDED SPRINT SEQUENCE
            </Text>

            {days.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                  All taught topics are already confident! Take a light review before the exam.
                </Text>
              </View>
            ) : (
              days.map(day => (
                <View key={`day-${day.dayIndex}`} style={styles.dayContainer}>
                  <View style={styles.dayHeader}>
                    <Text style={[styles.dayTitle, { color: brand.violet }]}>
                      Day {day.dayIndex} · {day.date}
                    </Text>
                    <Text style={[styles.dayMeta, { color: colors.textTertiary }]}>
                      ~{day.totalEstimatedMinutes} min · {day.topics.length} topic{day.topics.length > 1 ? 's' : ''}
                    </Text>
                  </View>

                  {day.topics.map(topicItem => {
                    const badge = getPriorityBadge(topicItem.priority);
                    const isTaskCreated = createdTasks[topicItem.topicId];

                    return (
                      <GlassCard
                        key={topicItem.topicId}
                        level="secondary"
                        style={styles.topicCard}
                      >
                        <Pressable
                          style={{ flex: 1 }}
                          onPress={() => onSelectTopic && onSelectTopic(topicItem.topicId)}
                        >
                          <View style={styles.topicRow}>
                            <View style={[styles.priorityPill, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.priorityText, { color: badge.color }]}>
                                {badge.label}
                              </Text>
                            </View>
                            <Text style={[styles.topicDuration, { color: colors.textTertiary }]}>
                              {topicItem.estimatedMinutes}m
                            </Text>
                          </View>
                          <Text style={[styles.topicTitle, { color: colors.text }]} numberOfLines={2}>
                            {topicItem.topicName}
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() =>
                            handleCreateTaskForTopic(topicItem.topicId, day.date, topicItem.estimatedMinutes)
                          }
                          disabled={isTaskCreated}
                          style={[
                            styles.taskBtn,
                            isTaskCreated && { backgroundColor: statusColors.safe + '20' },
                            !isTaskCreated && { backgroundColor: brand.violet + '20' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.taskBtnText,
                              { color: isTaskCreated ? statusColors.safe : brand.violet },
                            ]}
                          >
                            {isTaskCreated ? 'Added' : '+ Task'}
                          </Text>
                        </Pressable>
                      </GlassCard>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '92%',
    minHeight: '75%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  kicker: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    marginTop: 2,
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    padding: spacing.base,
    paddingBottom: 40,
    gap: spacing.base,
  },
  readinessCard: {
    padding: spacing.md,
    borderRadius: radii.md,
  },
  readinessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  readinessLabel: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  readinessPercent: {
    fontSize: typography.sizes.xl + 4,
    fontWeight: '800',
    marginTop: 2,
  },
  readinessMetaRight: {
    alignItems: 'flex-end',
  },
  workloadText: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
  },
  workloadSub: {
    fontSize: typography.sizes.xs,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricVal: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: '700',
  },
  metricLbl: {
    fontSize: 10,
    marginTop: 2,
  },
  readinessNote: {
    fontSize: 10,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  warningBanner: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: '#F9731620',
    borderWidth: 1,
    borderColor: '#F9731640',
  },
  warningText: {
    color: '#F97316',
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  emptyStateText: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
  dayContainer: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  dayMeta: {
    fontSize: typography.sizes.xs,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
  },
  topicDuration: {
    fontSize: typography.sizes.xs,
  },
  topicTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  taskBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  taskBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
});
