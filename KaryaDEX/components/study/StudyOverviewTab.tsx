/**
 * KaryaDEX — Study Overview Tab (Dashboard)
 *
 * Comprehensive study overview and readiness dashboard:
 * Exam countdown, target goals, today's recommended topics, quick study tools,
 * and tri-state mastery breakdown (not started, learning, on target).
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing } from '@/constants/theme';
import type { Topic } from '@/types/academic';
import type { Subject, Exam } from '@/types';
import type { StudySubTab, ExamCountdownInfo } from './types';
import { studyPlanningService } from '@/services/studyPlanningService';
import { revisionService } from '@/services/revisionService';
import { syllabusRepository } from '@/database/repositories/syllabusRepository';
import { revisionRepository } from '@/database/repositories/revisionRepository';

interface StudyOverviewTabProps {
  subjects: Subject[];
  topics: Topic[];
  exams: Exam[];
  selectedSubjectId: string | 'all';
  onNavigateTab: (tab: StudySubTab) => void;
  onRefreshData: () => Promise<void>;
}

export function StudyOverviewTab({
  subjects,
  topics,
  exams,
  selectedSubjectId,
  onNavigateTab,
  onRefreshData,
}: StudyOverviewTabProps) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState<boolean>(false);
  const [togglingTopicId, setTogglingTopicId] = useState<string | null>(null);

  // Filter topics by selected subject
  const filteredTopics = selectedSubjectId === 'all'
    ? topics
    : topics.filter(t => t.subjectId === selectedSubjectId);

  // Find nearest upcoming exam
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingExams = exams
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  const primaryExam = upcomingExams[0] || (exams.length > 0 ? exams[0] : null);

  // Calculate exam countdown days
  let daysRemaining = 0;
  if (primaryExam) {
    const examDate = new Date(primaryExam.date);
    const now = new Date();
    const diffTime = examDate.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // Tri-state mastery counts
  const onTargetCount = filteredTopics.filter(t => t.revisionStatus === 'revised').length;
  const learningCount = filteredTopics.filter(t => t.revisionStatus === 'taught' || t.revisionStatus === 'needs_revision').length;
  const notStartedCount = filteredTopics.filter(t => !t.revisionStatus || t.revisionStatus === 'not_taught' || t.revisionStatus === 'not_started').length;
  const totalTopics = filteredTopics.length;
  const masteryPercentage = totalTopics > 0 ? Math.round((onTargetCount / totalTopics) * 100) : 0;

  // Recommended topics for today (topics that are 'needs_revision' or 'taught', or first 3 not_started)
  const recommendedTopics = filteredTopics
    .filter(t => t.revisionStatus === 'needs_revision' || t.revisionStatus === 'taught')
    .slice(0, 3);
  if (recommendedTopics.length < 3) {
    const additional = filteredTopics
      .filter(t => !t.revisionStatus || t.revisionStatus === 'not_taught' || t.revisionStatus === 'not_started')
      .slice(0, 3 - recommendedTopics.length);
    recommendedTopics.push(...additional);
  }

  const handleToggleTopic = async (topic: Topic) => {
    try {
      setTogglingTopicId(topic.id);
      const newStatus = topic.revisionStatus === 'revised' ? 'needs_revision' : 'revised';
      await syllabusRepository.updateTopic(topic.id, {
        revisionStatus: newStatus,
        lastRevisedAt: newStatus === 'revised' ? new Date().toISOString() : topic.lastRevisedAt,
      });
      if (newStatus === 'revised') {
        await revisionRepository.createRecord({
          topicId: topic.id,
          subjectId: topic.subjectId,
          confidence: 'high',
          outcome: 'confident',
          reviewedAt: new Date().toISOString(),
          durationMinutes: 20,
          notes: 'Completed in Study Overview',
        });
      }
      await onRefreshData();
    } catch (err) {
      console.warn('[StudyOverview] Failed to toggle topic:', err);
    } finally {
      setTogglingTopicId(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Exam Prep Hero Card (Exam Countdown) */}
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.examTagRow}>
            <View style={styles.examIndicatorDot} />
            <Text style={styles.examTagText}>PRIMARY EXAM PREP</Text>
          </View>
          <View style={[styles.daysLeftPill, { backgroundColor: 'rgba(0, 229, 255, 0.12)', borderColor: 'rgba(0, 229, 255, 0.3)' }]}>
            <Feather name="zap" size={12} color="#00E5FF" />
            <Text style={styles.daysLeftText}>{daysRemaining} days left</Text>
          </View>
        </View>

        <Text style={[styles.heroExamTitle, { color: colors.text }]}>
          {primaryExam ? primaryExam.name : 'Semester Examinations'}
        </Text>
        <Text style={[styles.heroExamSubtitle, { color: colors.textSecondary }]}>
          {primaryExam ? `Scheduled on ${primaryExam.date}` : 'Set an exam date in Study Plan to begin countdown'}
        </Text>

        {/* Goals & Forecast Metrics */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Target Score</Text>
            <Text style={[styles.metricValue, { color: '#10B981' }]}>
              {primaryExam?.maxMarks ? `${primaryExam.maxMarks}%` : '85%'}
            </Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Readiness</Text>
            <Text style={[styles.metricValue, { color: masteryPercentage >= 70 ? '#10B981' : '#F59E0B' }]}>
              {masteryPercentage}%
            </Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Topics on Target</Text>
            <Text style={[styles.metricValue, { color: '#00E5FF' }]}>
              {onTargetCount} / {totalTopics}
            </Text>
          </View>
        </View>

        {/* Quick Action Button */}
        <Pressable
          onPress={() => onNavigateTab('plan')}
          style={[styles.heroActionButton, { backgroundColor: '#7C3AED' }]}
        >
          <Text style={styles.heroActionText}>Manage Exam Study Plan</Text>
          <Feather name="arrow-right" size={15} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* 2. Today's Recommended Study Topics */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleGroup}>
          <Feather name="target" size={16} color="#A78BFA" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Revision Plan</Text>
        </View>
        <Pressable onPress={() => onNavigateTab('plan')}>
          <Text style={styles.sectionLinkText}>Full Plan →</Text>
        </Pressable>
      </View>

      {recommendedTopics.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="check-circle" size={28} color="#10B981" />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>All clear for today!</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            No topics currently require urgent revision. Start a practice quiz to reinforce memory.
          </Text>
        </View>
      ) : (
        <View style={styles.topicsList}>
          {recommendedTopics.map((topic) => {
            const isRevised = topic.revisionStatus === 'revised';
            const isToggling = togglingTopicId === topic.id;
            const subject = subjects.find(s => s.id === topic.subjectId);

            return (
              <View
                key={topic.id}
                style={[
                  styles.topicCard,
                  { backgroundColor: colors.surface, borderColor: isRevised ? 'rgba(16, 185, 129, 0.3)' : colors.border },
                ]}
              >
                <Pressable
                  onPress={() => handleToggleTopic(topic)}
                  style={[
                    styles.checkboxCircle,
                    isRevised
                      ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                      : { borderColor: colors.textTertiary },
                  ]}
                  disabled={isToggling}
                >
                  {isToggling ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : isRevised ? (
                    <Feather name="check" size={12} color="#FFFFFF" />
                  ) : null}
                </Pressable>

                <View style={styles.topicInfo}>
                  <Text
                    style={[
                      styles.topicTitle,
                      { color: isRevised ? colors.textSecondary : colors.text },
                      isRevised && styles.topicDoneText,
                    ]}
                    numberOfLines={1}
                  >
                    {topic.name}
                  </Text>
                  <View style={styles.topicMetaRow}>
                    <Text style={[styles.topicSubjectName, { color: colors.textTertiary }]}>
                      {subject ? subject.shortName : 'Subject'}
                    </Text>
                    <Text style={[styles.topicBullet, { color: colors.textTertiary }]}>•</Text>
                    <Text style={[styles.topicDuration, { color: '#F59E0B' }]}>
                      ~25 min study
                    </Text>
                  </View>
                </View>

                {/* Socratic Tutor shortcut */}
                <Pressable
                  onPress={() => onNavigateTab('tutor')}
                  style={[styles.tutorIconBtn, { backgroundColor: 'rgba(0, 229, 255, 0.12)' }]}
                >
                  <Feather name="cpu" size={14} color="#00E5FF" />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* 3. Quick Study Tools Dock */}
      <Text style={[styles.sectionTitleStandalone, { color: colors.text }]}>Study Tools</Text>
      <View style={styles.toolsDock}>
        <Pressable
          onPress={() => onNavigateTab('tutor')}
          style={[styles.dockCard, { backgroundColor: colors.surface, borderColor: 'rgba(0, 229, 255, 0.25)' }]}
        >
          <View style={[styles.dockIconBox, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
            <Feather name="cpu" size={20} color="#00E5FF" />
          </View>
          <Text style={[styles.dockTitle, { color: colors.text }]}>AI Tutor</Text>
          <Text style={[styles.dockDesc, { color: colors.textSecondary }]}>
            Step-by-step Socratic solver & concept deep dive
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onNavigateTab('practice')}
          style={[styles.dockCard, { backgroundColor: colors.surface, borderColor: 'rgba(124, 58, 237, 0.25)' }]}
        >
          <View style={[styles.dockIconBox, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
            <Feather name="layers" size={20} color="#A78BFA" />
          </View>
          <Text style={[styles.dockTitle, { color: colors.text }]}>Practice Center</Text>
          <Text style={[styles.dockDesc, { color: colors.textSecondary }]}>
            Active recall flashcards, MCQs & gap detection
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onNavigateTab('materials')}
          style={[styles.dockCard, { backgroundColor: colors.surface, borderColor: 'rgba(245, 158, 11, 0.25)' }]}
        >
          <View style={[styles.dockIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Feather name="file-text" size={20} color="#F59E0B" />
          </View>
          <Text style={[styles.dockTitle, { color: colors.text }]}>Notes & Docs</Text>
          <Text style={[styles.dockDesc, { color: colors.textSecondary }]}>
            Upload PDF & notes for Banku AI extraction
          </Text>
        </Pressable>
      </View>

      {/* 4. Tri-State Topic Mastery Distribution */}
      <View style={[styles.masteryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.masteryHeaderRow}>
          <Text style={[styles.masteryCardTitle, { color: colors.text }]}>Syllabus Mastery Distribution</Text>
          <Pressable onPress={() => onNavigateTab('mastery')}>
            <Text style={styles.sectionLinkText}>Details →</Text>
          </Pressable>
        </View>

        {/* Progress Bar Segmented */}
        <View style={styles.segmentedProgressBar}>
          <View style={[styles.progressSegment, { flex: Math.max(1, onTargetCount), backgroundColor: '#10B981' }]} />
          <View style={[styles.progressSegment, { flex: Math.max(1, learningCount), backgroundColor: '#F59E0B' }]} />
          <View style={[styles.progressSegment, { flex: Math.max(1, notStartedCount), backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} />
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
              On Target: <Text style={{ color: colors.text, fontWeight: '700' }}>{onTargetCount}</Text>
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
              Learning: <Text style={{ color: colors.text, fontWeight: '700' }}>{learningCount}</Text>
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]} />
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
              Remaining: <Text style={{ color: colors.text, fontWeight: '700' }}>{notStartedCount}</Text>
            </Text>
          </View>
        </View>
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
  heroCard: {
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  examTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  examIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
  },
  examTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.5,
  },
  daysLeftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  daysLeftText: {
    fontSize: typography.sizes.xs,
    color: '#00E5FF',
    fontWeight: '700',
  },
  heroExamTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginTop: 4,
  },
  heroExamSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  metricBox: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  heroActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 12,
    borderRadius: radii.lg,
  },
  heroActionText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  sectionTitleStandalone: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionLinkText: {
    fontSize: typography.sizes.xs,
    color: '#A78BFA',
    fontWeight: '600',
  },
  emptyBox: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  emptyTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginTop: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  topicsList: {
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicInfo: {
    flex: 1,
  },
  topicTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  topicDoneText: {
    textDecorationLine: 'line-through',
  },
  topicMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  topicSubjectName: {
    fontSize: 10,
    fontWeight: '500',
  },
  topicBullet: {
    fontSize: 10,
  },
  topicDuration: {
    fontSize: 10,
    fontWeight: '600',
  },
  tutorIconBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolsDock: {
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  dockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  dockIconBox: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  dockDesc: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
    flex: 1,
  },
  masteryCard: {
    padding: spacing.base,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  masteryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  masteryCardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  segmentedProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 2,
    marginBottom: spacing.md,
  },
  progressSegment: {
    height: '100%',
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
  },
});
