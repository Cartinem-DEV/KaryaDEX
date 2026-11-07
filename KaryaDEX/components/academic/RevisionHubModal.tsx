/**
 * BunkMatKar — Revision Hub Modal (Phase 7)
 *
 * Dedicated Revision Hub interface:
 * - Filtering by Subject, Exam, Priority, and Revision State
 * - Surfaces critical, high-priority, and backlog topics
 * - Subject-wise revision progress
 * - Chronological recent reviews
 * - 1-tap topic inspection and review
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
import { academicHubService } from '@/services/academicHubService';
import { useAppStore } from '@/store/useAppStore';
import type { RevisionPriority, RevisionState, TopicRevisionIntelligence } from '@/types/academic';

interface RevisionHubModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTopic: (topicId: string) => void;
  onSelectExam?: (examId: string) => void;
  initialSubjectId?: string;
}

export function RevisionHubModal({
  visible,
  onClose,
  onSelectTopic,
  onSelectExam,
  initialSubjectId,
}: RevisionHubModalProps) {
  const { colors, isDark } = useTheme();
  const { subjects, exams } = useAppStore();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(initialSubjectId || null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<RevisionPriority | 'all'>('all');
  const [selectedState, setSelectedState] = useState<RevisionState | 'all'>('all');

  if (!visible) return null;

  const hubData = academicHubService.getRevisionHubData();
  const { backlogTopics, criticalTopics, highPriorityTopics, subjectProgress, upcomingExamsWithReadiness } = hubData;

  // Filter topics based on selections
  let filteredTopics = hubData.backlogTopics;

  // If a specific subject is selected
  if (selectedSubjectId) {
    filteredTopics = filteredTopics.filter((t: TopicRevisionIntelligence) => t.subjectId === selectedSubjectId);
  }

  // If a specific exam is selected
  if (selectedExamId) {
    filteredTopics = filteredTopics.filter(
      (t: TopicRevisionIntelligence) => t.upcomingExam && t.upcomingExam.examId === selectedExamId
    );
  }

  // If a priority filter is set
  if (selectedPriority !== 'all') {
    filteredTopics = filteredTopics.filter((t: TopicRevisionIntelligence) => t.revisionPriority === selectedPriority);
  }

  // If a state filter is set
  if (selectedState !== 'all') {
    filteredTopics = filteredTopics.filter((t: TopicRevisionIntelligence) => t.revisionState === selectedState);
  }

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

  const getStateBadge = (state: RevisionState) => {
    switch (state) {
      case 'CONFIDENT':
        return { label: 'Confident', color: statusColors.safe };
      case 'NEEDS_REVIEW':
        return { label: 'Needs Review', color: statusColors.danger };
      case 'REVIEWED':
        return { label: 'Reviewed', color: '#3B82F6' };
      case 'NOT_REVIEWED':
        return { label: 'Not Reviewed', color: statusColors.watch };
      default:
        return { label: 'Not Taught', color: '#94A3B8' };
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
              <Text style={[styles.kicker, { color: brand.violet }]}>ACADEMIC INTELLIGENCE</Text>
              <Text style={[styles.title, { color: colors.text }]}>Revision Hub</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {criticalTopics.length} critical · {highPriorityTopics.length} high priority · {backlogTopics.length} pending revision
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          {/* Filter Pills Bar */}
          <View style={styles.filtersBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {/* Subject Filters */}
              <Pressable
                onPress={() => setSelectedSubjectId(null)}
                style={[
                  styles.filterPill,
                  selectedSubjectId === null && { backgroundColor: brand.violet },
                  selectedSubjectId !== null && { borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: selectedSubjectId === null ? '#FFF' : colors.textSecondary },
                  ]}
                >
                  All Subjects
                </Text>
              </Pressable>

              {subjects.map(s => (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedSubjectId(s.id === selectedSubjectId ? null : s.id)}
                  style={[
                    styles.filterPill,
                    selectedSubjectId === s.id && { backgroundColor: s.color },
                    selectedSubjectId !== s.id && { borderColor: colors.border, borderWidth: 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: selectedSubjectId === s.id ? '#FFF' : colors.textSecondary },
                    ]}
                  >
                    {s.shortName}
                  </Text>
                </Pressable>
              ))}

              {/* Priority Filters */}
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => (
                <Pressable
                  key={p}
                  onPress={() => setSelectedPriority(p)}
                  style={[
                    styles.filterPill,
                    selectedPriority === p && { backgroundColor: brand.violet },
                    selectedPriority !== p && { borderColor: colors.border, borderWidth: 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: selectedPriority === p ? '#FFF' : colors.textSecondary },
                    ]}
                  >
                    {p === 'all' ? 'All Priorities' : p.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* 1. Subject-Wise Progress Cards */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              SUBJECT REVISION PROGRESS
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectProgressRow}>
              {subjectProgress.map(sp => (
                <GlassCard key={sp.subjectId} level="secondary" style={styles.subjectProgressCard}>
                  <View style={styles.spCardHeader}>
                    <Text style={[styles.spSubjectName, { color: colors.text }]}>{sp.shortName}</Text>
                    <Text style={[styles.spReadiness, { color: sp.readinessPct >= 70 ? statusColors.safe : brand.violet }]}>
                      {sp.readinessPct}%
                    </Text>
                  </View>
                  <Text style={[styles.spMeta, { color: colors.textTertiary }]}>
                    {sp.confidentTopics}/{sp.taughtTopics} confident · {sp.needsReviewTopics} need review
                  </Text>
                  {sp.criticalCount > 0 && (
                    <Text style={[styles.spCriticalNotice, { color: statusColors.danger }]}>
                      {sp.criticalCount} critical topic{sp.criticalCount > 1 ? 's' : ''}
                    </Text>
                  )}
                </GlassCard>
              ))}
            </ScrollView>

            {/* 2. Upcoming Exams Section */}
            {upcomingExamsWithReadiness.length > 0 && (
              <>
                <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                  UPCOMING EXAMS & READINESS
                </Text>
                {upcomingExamsWithReadiness.map(({ exam, readiness }) => (
                  <GlassCard key={exam.id} level="secondary" style={styles.examCard}>
                    <View style={styles.examHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.examTitle, { color: colors.text }]}>{exam.name}</Text>
                        <Text style={[styles.examDate, { color: colors.textSecondary }]}>
                          {exam.date} · {readiness ? `${readiness.daysRemaining} days left` : ''}
                        </Text>
                      </View>
                      {readiness && (
                        <View style={styles.examReadinessBox}>
                          <Text style={[styles.examReadinessVal, { color: brand.violet }]}>
                            {readiness.readinessPercentage}%
                          </Text>
                          <Text style={[styles.examReadinessLbl, { color: colors.textTertiary }]}>Ready</Text>
                        </View>
                      )}
                    </View>
                    {onSelectExam && (
                      <Pressable
                        onPress={() => onSelectExam(exam.id)}
                        style={[styles.sprintBtn, { backgroundColor: brand.violet + '20' }]}
                      >
                        <Text style={[styles.sprintBtnText, { color: brand.violet }]}>
                          Open Exam Sprint Plan →
                        </Text>
                      </Pressable>
                    )}
                  </GlassCard>
                ))}
              </>
            )}

            {/* 3. Filtered Revision Topics List */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              TOPICS NEEDING REVISION ({filteredTopics.length})
            </Text>

            {filteredTopics.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No topics match the selected filters. Great job on your revision!
                </Text>
              </View>
            ) : (
              filteredTopics.map((topicItem: TopicRevisionIntelligence) => {
                const priorityB = getPriorityBadge(topicItem.revisionPriority);
                const stateB = getStateBadge(topicItem.revisionState);

                return (
                  <Pressable
                    key={topicItem.topicId}
                    onPress={() => onSelectTopic(topicItem.topicId)}
                  >
                    <GlassCard level="secondary" style={styles.topicCard}>
                      <View style={styles.topicHeader}>
                        <View style={styles.topicTags}>
                          <View style={[styles.badge, { backgroundColor: priorityB.bg }]}>
                            <Text style={[styles.badgeText, { color: priorityB.color }]}>
                              {priorityB.label}
                            </Text>
                          </View>
                          <Text style={[styles.stateText, { color: stateB.color }]}>
                            {stateB.label}
                          </Text>
                        </View>
                        {topicItem.reviewCount > 0 ? (
                          <Text style={[styles.reviewCountText, { color: colors.textTertiary }]}>
                            {topicItem.reviewCount} review{topicItem.reviewCount > 1 ? 's' : ''}
                          </Text>
                        ) : (
                          <Text style={[styles.reviewCountText, { color: statusColors.watch }]}>
                            Never reviewed
                          </Text>
                        )}
                      </View>

                      <Text style={[styles.topicTitle, { color: colors.text }]}>
                        {topicItem.topicName}
                      </Text>

                      {topicItem.upcomingExam && (
                        <Text style={[styles.topicExamNotice, { color: colors.textTertiary }]}>
                          Exam: {topicItem.upcomingExam.name} ({topicItem.upcomingExam.daysUntil}d left)
                        </Text>
                      )}
                    </GlassCard>
                  </Pressable>
                );
              })
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
    maxHeight: '94%',
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
  filtersBar: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterRow: {
    paddingHorizontal: spacing.base,
    gap: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  filterPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  body: {
    padding: spacing.base,
    paddingBottom: 40,
    gap: spacing.md,
  },
  sectionHeading: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  subjectProgressRow: {
    gap: spacing.sm,
  },
  subjectProgressCard: {
    width: 170,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
  },
  spCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spSubjectName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  spReadiness: {
    fontSize: typography.sizes.sm,
    fontWeight: '800',
  },
  spMeta: {
    fontSize: 10,
    marginTop: 4,
  },
  spCriticalNotice: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  examCard: {
    padding: spacing.md,
    borderRadius: radii.md,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examTitle: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: '700',
  },
  examDate: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  examReadinessBox: {
    alignItems: 'flex-end',
  },
  examReadinessVal: {
    fontSize: typography.sizes.md,
    fontWeight: '800',
  },
  examReadinessLbl: {
    fontSize: 9,
  },
  sprintBtn: {
    marginTop: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  sprintBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  emptyCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
  topicCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  topicTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  stateText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  reviewCountText: {
    fontSize: typography.sizes.xs,
  },
  topicTitle: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: '600',
  },
  topicExamNotice: {
    fontSize: 10,
    marginTop: 4,
  },
});
