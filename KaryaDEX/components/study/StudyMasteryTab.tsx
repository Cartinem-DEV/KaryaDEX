/**
 * KaryaDEX — Study Mastery & Revision Tab
 *
 * Topic completion breakdown, confidence meters, backlog identification,
 * and syllabus retention tracking.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing } from '@/constants/theme';
import type { Topic } from '@/types/academic';
import type { Subject } from '@/types';
import { syllabusRepository } from '@/database/repositories/syllabusRepository';
import { revisionRepository } from '@/database/repositories/revisionRepository';

interface StudyMasteryTabProps {
  subjects: Subject[];
  topics: Topic[];
  selectedSubjectId: string | 'all';
  onRefreshData: () => Promise<void>;
}

export function StudyMasteryTab({
  subjects,
  topics,
  selectedSubjectId,
  onRefreshData,
}: StudyMasteryTabProps) {
  const { colors, isDark } = useTheme();
  const [filterState, setFilterState] = useState<'all' | 'on_target' | 'learning' | 'not_started'>('all');
  const [updatingTopicId, setUpdatingTopicId] = useState<string | null>(null);

  // Filter topics by subject
  const subjectTopics = selectedSubjectId === 'all'
    ? topics
    : topics.filter(t => t.subjectId === selectedSubjectId);

  // Filter by mastery state
  const displayedTopics = subjectTopics.filter(t => {
    if (filterState === 'all') return true;
    if (filterState === 'on_target') return t.revisionStatus === 'revised';
    if (filterState === 'learning') return t.revisionStatus === 'taught' || t.revisionStatus === 'needs_revision';
    if (filterState === 'not_started') return !t.revisionStatus || t.revisionStatus === 'not_taught' || t.revisionStatus === 'not_started';
    return true;
  });

  // Calculate stats
  const onTargetCount = subjectTopics.filter(t => t.revisionStatus === 'revised').length;
  const learningCount = subjectTopics.filter(t => t.revisionStatus === 'taught' || t.revisionStatus === 'needs_revision').length;
  const notStartedCount = subjectTopics.filter(t => !t.revisionStatus || t.revisionStatus === 'not_taught' || t.revisionStatus === 'not_started').length;
  const totalCount = subjectTopics.length;
  const overallPercentage = totalCount > 0 ? Math.round((onTargetCount / totalCount) * 100) : 0;

  // Backlog topics (taught or needs_revision)
  const backlogTopics = subjectTopics.filter(t => t.revisionStatus === 'needs_revision' || t.revisionStatus === 'taught');

  const handleMarkRevised = async (topicId: string, subjectId: string) => {
    setUpdatingTopicId(topicId);
    try {
      await syllabusRepository.updateTopic(topicId, {
        revisionStatus: 'revised',
        lastRevisedAt: new Date().toISOString(),
      });
      await revisionRepository.createRecord({
        topicId,
        subjectId,
        confidence: 'high',
        outcome: 'confident',
        reviewedAt: new Date().toISOString(),
        durationMinutes: 20,
        notes: 'Revised from Mastery Tracker',
      });
      await onRefreshData();
    } finally {
      setUpdatingTopicId(null);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'revised':
        return { label: 'ON TARGET', bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' };
      case 'taught':
      case 'needs_revision':
        return { label: 'LEARNING', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' };
      default:
        return { label: 'NOT STARTED', bg: 'rgba(255, 255, 255, 0.08)', text: '#94A3B8' };
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Mastery Score Overview Card */}
      <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.overviewTop}>
          <View>
            <Text style={[styles.overviewTitle, { color: colors.text }]}>Curriculum Mastery</Text>
            <Text style={[styles.overviewSubtitle, { color: colors.textSecondary }]}>
              {onTargetCount} of {totalCount} topics on target ({overallPercentage}%)
            </Text>
          </View>
          <View style={[styles.scorePill, { backgroundColor: overallPercentage >= 70 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)' }]}>
            <Text style={[styles.scorePillText, { color: overallPercentage >= 70 ? '#10B981' : '#F59E0B' }]}>
              {overallPercentage}% Ready
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${overallPercentage}%`, backgroundColor: '#10B981' }]} />
        </View>
      </View>

      {/* 2. Backlog Warning Alert */}
      {backlogTopics.length > 0 && (
        <View style={[styles.backlogBanner, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.28)' }]}>
          <View style={styles.backlogHeader}>
            <Feather name="clock" size={15} color="#F59E0B" />
            <Text style={[styles.backlogTitle, { color: colors.text }]}>
              {backlogTopics.length} Topics in Revision Backlog
            </Text>
          </View>
          <Text style={[styles.backlogDesc, { color: colors.textSecondary }]}>
            These topics have been taught in class but have not yet been revised into memory.
          </Text>
        </View>
      )}

      {/* 3. Mastery Filter Pills */}
      <View style={styles.filtersRow}>
        {[
          { key: 'all', label: `All (${totalCount})` },
          { key: 'on_target', label: `On Target (${onTargetCount})` },
          { key: 'learning', label: `Learning (${learningCount})` },
          { key: 'not_started', label: `Remaining (${notStartedCount})` },
        ].map((f) => {
          const isSelected = filterState === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilterState(f.key as any)}
              style={[
                styles.filterPill,
                isSelected
                  ? { backgroundColor: '#7C3AED', borderColor: '#8B5CF6' }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  isSelected ? { color: '#FFFFFF', fontWeight: '700' } : { color: colors.textSecondary },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 4. Topics Breakdown Cards */}
      <View style={styles.topicsGrid}>
        {displayedTopics.map((topic) => {
          const badge = getStatusBadge(topic.revisionStatus);
          const isUpdating = updatingTopicId === topic.id;
          const subject = subjects.find(s => s.id === topic.subjectId);

          return (
            <View key={topic.id} style={[styles.topicMasteryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.topicCardTop}>
                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                </View>
                <Text style={[styles.subjectNameTag, { color: colors.textTertiary }]}>
                  {subject ? subject.shortName : ''}
                </Text>
              </View>

              <Text style={[styles.topicCardTitle, { color: colors.text }]}>{topic.name}</Text>

              <View style={styles.topicCardFooter}>
                <View style={styles.lastRevisedInfo}>
                  <Feather name="calendar" size={11} color={colors.textTertiary} />
                  <Text style={[styles.lastRevisedText, { color: colors.textTertiary }]}>
                    {topic.lastRevisedAt ? `Revised ${topic.lastRevisedAt.split('T')[0]}` : 'Not yet revised'}
                  </Text>
                </View>

                {topic.revisionStatus !== 'revised' && (
                  <Pressable
                    onPress={() => handleMarkRevised(topic.id, topic.subjectId)}
                    style={[styles.reviseActionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <>
                        <Feather name="check" size={12} color="#10B981" />
                        <Text style={[styles.reviseActionText, { color: '#10B981' }]}>Mark Revised</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Spacing for floating bottom bar */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
  },
  overviewCard: {
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  overviewTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  overviewSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  scorePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  scorePillText: {
    fontSize: typography.sizes.xs,
    fontWeight: '800',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  backlogBanner: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  backlogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  backlogTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  backlogDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11,
  },
  topicsGrid: {
    gap: spacing.sm,
  },
  topicMasteryCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  topicCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subjectNameTag: {
    fontSize: 10,
    fontWeight: '600',
  },
  topicCardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  topicCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastRevisedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lastRevisedText: {
    fontSize: 10,
  },
  reviseActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  reviseActionText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
