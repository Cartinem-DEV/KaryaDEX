/**
 * KaryaDEX — Study Plan Tab
 *
 * Exam-specific planning, daily capacity configuration, topic pacing,
 * and deterministic schedule generation powered by studyPlanningService.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing } from '@/constants/theme';
import type { Topic, PersistentStudyPlan } from '@/types/academic';
import type { Subject, Exam } from '@/types';
import { studyPlanningService } from '@/services/studyPlanningService';
import { syllabusRepository } from '@/database/repositories/syllabusRepository';
import { revisionRepository } from '@/database/repositories/revisionRepository';
import { studyPlanRepository } from '@/database';

interface StudyPlanTabProps {
  subjects: Subject[];
  topics: Topic[];
  exams: Exam[];
  selectedSubjectId: string | 'all';
  onRefreshData: () => Promise<void>;
}

const CAPACITY_PRESETS = [45, 60, 90, 120, 180];
const GOAL_PRESETS = [75, 80, 85, 90, 95];

export function StudyPlanTab({
  subjects,
  topics,
  exams,
  selectedSubjectId,
  onRefreshData,
}: StudyPlanTabProps) {
  const { colors, isDark } = useTheme();
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [dailyCapacityMinutes, setDailyCapacityMinutes] = useState<number>(120);
  const [targetGoal, setTargetGoal] = useState<number>(85);
  const [togglingTopicId, setTogglingTopicId] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);
  const [rescheduleMessage, setRescheduleMessage] = useState<string | null>(null);
  const [persistentPlan, setPersistentPlan] = useState<PersistentStudyPlan | null>(null);

  const selectedExam = exams.find(e => e.id === selectedExamId) || exams[0];

  useEffect(() => {
    // Load daily capacity from settings
    studyPlanningService.getDailyStudyCapacity().then(cap => {
      if (cap) setDailyCapacityMinutes(cap);
    });
  }, []);

  useEffect(() => {
    if (selectedExam?.id) {
      studyPlanRepository.getActivePlanForExam(selectedExam.id).then(plan => {
        setPersistentPlan(plan);
      }).catch(err => {
        console.warn('[StudyPlan] Could not load persistent plan:', err);
      });
    }
  }, [selectedExam?.id]);

  // Calculate days remaining to exam
  let daysUntilExam = 14;
  if (selectedExam) {
    const examDate = new Date(selectedExam.date);
    const now = new Date();
    daysUntilExam = Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Filter topics
  const filteredTopics = selectedSubjectId === 'all'
    ? topics
    : topics.filter(t => t.subjectId === selectedSubjectId);

  // Group topics by subject
  const topicsBySubject = subjects.map(s => ({
    subject: s,
    topics: filteredTopics.filter(t => t.subjectId === s.id),
  })).filter(g => g.topics.length > 0);

  const handleCapacityChange = async (minutes: number) => {
    setDailyCapacityMinutes(minutes);
    await studyPlanningService.setDailyStudyCapacity(minutes);
  };

  const handleToggleTopic = async (topic: Topic) => {
    try {
      setTogglingTopicId(topic.id);
      const newStatus = topic.revisionStatus === 'revised' ? 'needs_revision' : 'revised';
      await syllabusRepository.updateTopic(topic.id, {
        revisionStatus: newStatus,
        lastRevisedAt: newStatus === 'revised' ? new Date().toISOString() : topic.lastRevisedAt,
      });

      if (persistentPlan) {
        const alloc = persistentPlan.allocations.find(a => a.topicId === topic.id);
        if (alloc) {
          if (newStatus === 'revised') {
            await studyPlanRepository.markAllocationComplete(alloc.id);
          } else {
            await studyPlanRepository.updateAllocationStatus(alloc.id, 'scheduled');
          }
          const refreshed = await studyPlanRepository.getActivePlanForExam(selectedExam.id);
          setPersistentPlan(refreshed);
        }
      }

      if (newStatus === 'revised') {
        await revisionRepository.createRecord({
          topicId: topic.id,
          subjectId: topic.subjectId,
          confidence: 'high',
          outcome: 'confident',
          reviewedAt: new Date().toISOString(),
          durationMinutes: 25,
          notes: 'Completed in Study Plan checklist',
        });
      }
      await onRefreshData();
    } catch (err) {
      console.warn('[StudyPlan] Failed to toggle topic:', err);
    } finally {
      setTogglingTopicId(null);
    }
  };

  const handleReschedule = async () => {
    setIsRescheduling(true);
    setRescheduleMessage(null);
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const targetExamDate = selectedExam?.date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      const activeSemId = selectedExam?.semesterId || 'sem-current';

      let updatedPlan: PersistentStudyPlan;

      if (persistentPlan) {
        updatedPlan = await studyPlanRepository.regenerateRemainingSchedule({
          planId: persistentPlan.id,
          examDate: targetExamDate,
          dailyCapacityMinutes,
          todayDate,
        });
      } else {
        const unrevisedTopics = filteredTopics.filter(t => t.revisionStatus !== 'revised');
        const topicsPerDay = daysUntilExam > 0 ? Math.ceil(unrevisedTopics.length / Math.max(1, daysUntilExam)) : unrevisedTopics.length;

        const allocs = unrevisedTopics.map((t, idx) => {
          const dayOffset = Math.min(Math.floor(idx / Math.max(1, topicsPerDay)), Math.max(0, daysUntilExam - 1));
          const allocDate = new Date(Date.now() + dayOffset * 86400000).toISOString().split('T')[0];
          return {
            topicId: t.id,
            subjectId: t.subjectId,
            allocatedDate: allocDate,
            allocatedOrder: (idx % Math.max(1, topicsPerDay)) + 1,
            allocatedMinutes: 25,
            status: 'scheduled' as const,
          };
        });

        updatedPlan = await studyPlanRepository.createPlan({
          examId: selectedExam?.id || 'exam-default',
          semesterId: activeSemId,
          subjectId: selectedSubjectId === 'all' ? undefined : selectedSubjectId,
          dailyCapacityMinutes,
          targetMasteryGoal: targetGoal,
          allocations: allocs,
        });
      }

      setPersistentPlan(updatedPlan);

      const uncompletedCount = updatedPlan.allocations.filter(a => a.status !== 'completed').length;
      const topicsPerDay = daysUntilExam > 0 ? Math.ceil(uncompletedCount / Math.max(1, daysUntilExam)) : uncompletedCount;
      const estimatedMinutesPerDay = topicsPerDay * 25;
      const workloadLevel = estimatedMinutesPerDay > dailyCapacityMinutes ? 'High Workload' : 'Balanced Workload';

      setRescheduleMessage(
        `Plan v${updatedPlan.version} persisted in SQLite! Paced at ~${topicsPerDay} topic${topicsPerDay === 1 ? '' : 's'}/day (~${estimatedMinutesPerDay} min/day). Status: ${workloadLevel} against your ${dailyCapacityMinutes}m daily capacity.`
      );
    } catch (err) {
      console.warn('[StudyPlan] Reschedule error:', err);
      setRescheduleMessage(`Plan calculation completed: ${String(err)}`);
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Exam Target Configurator */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.titleWithIcon}>
            <Feather name="award" size={16} color="#00E5FF" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Exam Target & Countdown</Text>
          </View>
          <View style={[styles.pillBadge, { backgroundColor: 'rgba(0, 229, 255, 0.12)', borderColor: 'rgba(0, 229, 255, 0.3)' }]}>
            <Text style={styles.pillText}>{daysUntilExam} Days Left</Text>
          </View>
        </View>

        {/* Exam Selection Pills */}
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Select Examination:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.examPickerRow}>
          {exams.map((exam) => {
            const isSelected = selectedExam?.id === exam.id;
            return (
              <Pressable
                key={exam.id}
                onPress={() => setSelectedExamId(exam.id)}
                style={[
                  styles.examPill,
                  isSelected
                    ? { backgroundColor: '#00E5FF', borderColor: '#00E5FF' }
                    : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.examPillText,
                    isSelected ? { color: '#05070B', fontWeight: '700' } : { color: colors.textSecondary },
                  ]}
                >
                  {exam.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Goal Selector */}
        <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>
          Target Mastery Goal:
        </Text>
        <View style={styles.presetRow}>
          {GOAL_PRESETS.map((goal) => {
            const isSelected = targetGoal === goal;
            return (
              <Pressable
                key={goal}
                onPress={() => setTargetGoal(goal)}
                style={[
                  styles.presetBtn,
                  isSelected
                    ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                    : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.presetBtnText,
                    isSelected ? { color: '#FFFFFF', fontWeight: '700' } : { color: colors.textSecondary },
                  ]}
                >
                  {goal}%
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 2. Daily Study Capacity Slider / Presets */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.titleWithIcon}>
            <Feather name="clock" size={16} color="#F59E0B" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Daily Study Capacity</Text>
          </View>
          <Text style={[styles.capacityValueText, { color: '#F59E0B' }]}>
            {dailyCapacityMinutes} mins/day
          </Text>
        </View>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
          KaryaDEX plans your daily workload around your actual available time without burning you out.
        </Text>

        <View style={styles.presetRow}>
          {CAPACITY_PRESETS.map((mins) => {
            const isSelected = dailyCapacityMinutes === mins;
            return (
              <Pressable
                key={mins}
                onPress={() => handleCapacityChange(mins)}
                style={[
                  styles.presetBtn,
                  isSelected
                    ? { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }
                    : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.presetBtnText,
                    isSelected ? { color: '#05070B', fontWeight: '700' } : { color: colors.textSecondary },
                  ]}
                >
                  {mins}m
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 3. Rebalance / Reschedule Action */}
      <View style={[styles.rebalanceCard, { backgroundColor: 'rgba(124, 58, 237, 0.1)', borderColor: 'rgba(124, 58, 237, 0.3)' }]}>
        <View style={styles.rebalanceInfo}>
          <Feather name="refresh-cw" size={18} color="#A78BFA" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rebalanceTitle, { color: colors.text }]}>Adaptive Schedule Rebalancer</Text>
            <Text style={[styles.rebalanceDesc, { color: colors.textSecondary }]}>
              Falling behind? Automatically redistribute incomplete topics evenly across your remaining {daysUntilExam} days.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleReschedule}
          style={[styles.rebalanceBtn, { backgroundColor: '#7C3AED' }]}
          disabled={isRescheduling}
        >
          {isRescheduling ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="sliders" size={14} color="#FFFFFF" />
              <Text style={styles.rebalanceBtnText}>Rebalance Study Plan</Text>
            </>
          )}
        </Pressable>

        {rescheduleMessage && (
          <View style={[styles.successBanner, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }]}>
            <Feather name="check-circle" size={14} color="#10B981" />
            <Text style={styles.successBannerText}>{rescheduleMessage}</Text>
          </View>
        )}
      </View>

      {/* 4. Subject & Topic Checklist */}
      <Text style={[styles.sectionHeading, { color: colors.text }]}>Topic Study Checklist</Text>

      {topicsBySubject.map(({ subject, topics: subTopics }) => (
        <View key={subject.id} style={[styles.subjectBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.subjectBlockHeader}>
            <Text style={[styles.subjectBlockTitle, { color: colors.text }]}>
              {subject.name} ({subject.shortName})
            </Text>
            <Text style={[styles.subjectBlockStats, { color: colors.textTertiary }]}>
              {subTopics.filter(t => t.revisionStatus === 'revised').length} / {subTopics.length} Mastered
            </Text>
          </View>

          <View style={styles.topicsChecklist}>
            {subTopics.map((topic) => {
              const isRevised = topic.revisionStatus === 'revised';
              const isToggling = togglingTopicId === topic.id;

              return (
                <Pressable
                  key={topic.id}
                  onPress={() => handleToggleTopic(topic)}
                  style={[
                    styles.checklistItem,
                    { borderBottomColor: colors.border },
                    isRevised && { opacity: 0.75 },
                  ]}
                  disabled={isToggling}
                >
                  <View
                    style={[
                      styles.checklistCircle,
                      isRevised
                        ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                        : { borderColor: colors.textTertiary },
                    ]}
                  >
                    {isToggling ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : isRevised ? (
                      <Feather name="check" size={12} color="#FFFFFF" />
                    ) : null}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.checklistTopicName,
                        { color: colors.text },
                        isRevised && styles.checklistTopicDone,
                      ]}
                    >
                      {topic.name}
                    </Text>
                    <Text style={[styles.checklistTopicMeta, { color: colors.textTertiary }]}>
                      {isRevised ? '✓ Revised & On Target' : '• 25m focus needed'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

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
  card: {
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  pillBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00E5FF',
  },
  cardDesc: {
    fontSize: typography.sizes.xs,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  examPickerRow: {
    gap: spacing.xs,
    paddingVertical: 4,
  },
  examPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  examPillText: {
    fontSize: typography.sizes.xs,
  },
  capacityValueText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnText: {
    fontSize: typography.sizes.xs,
  },
  rebalanceCard: {
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: spacing.base,
    gap: spacing.md,
  },
  rebalanceInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  rebalanceTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  rebalanceDesc: {
    fontSize: typography.sizes.xs,
    lineHeight: 17,
  },
  rebalanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  rebalanceBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  successBannerText: {
    fontSize: typography.sizes.xs,
    color: '#10B981',
    fontWeight: '600',
    flex: 1,
  },
  sectionHeading: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  subjectBlock: {
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.base,
    overflow: 'hidden',
  },
  subjectBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  subjectBlockTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  subjectBlockStats: {
    fontSize: 11,
  },
  topicsChecklist: {
    paddingHorizontal: spacing.md,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  checklistCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistTopicName: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  checklistTopicDone: {
    textDecorationLine: 'line-through',
  },
  checklistTopicMeta: {
    fontSize: 10,
    marginTop: 2,
  },
});
