/**
 * BunkMatKar — DailyStudyPlanCard Component (Phase 9)
 *
 * Surfaces the deterministic Today Study Plan:
 * - Workload status (Light, Moderate, Heavy, Overloaded)
 * - Configurable daily study capacity (e.g. 120m) with +/- 30m adjustments
 * - Time-blocked study recommendations ordered by academic urgency:
 *   Critical revision -> Urgent exam prep -> Overdue tasks -> Due today -> High priority
 * - Class-aware: Never overlaps fixed commitments
 * - Non-destructive: Displays capacity overflow transparently instead of dropping tasks
 * - Interactive task completion, rescheduling, and revision task conversion
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { studyPlanningService } from '@/services/studyPlanningService';
import { useAppStore } from '@/store/useAppStore';
import { formatLocalDate } from '@/lib/timeUtils';
import type { StudyPlan, StudyPlanItem, DailyWorkload } from '@/types/academic';
import type { Task } from '@/types';
import { TaskRescheduleModal } from './TaskRescheduleModal';

interface DailyStudyPlanCardProps {
  onOpenCalendar?: () => void;
  dateStr?: string;
}

export function DailyStudyPlanCard({ onOpenCalendar, dateStr }: DailyStudyPlanCardProps) {
  const { colors, isDark } = useTheme();
  const tasks = useAppStore(s => s.tasks);
  const toggleTask = useAppStore(s => s.toggleTask);

  const targetDate = dateStr || formatLocalDate();

  const [capacity, setCapacity] = useState<number>(120);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [workload, setWorkload] = useState<DailyWorkload | null>(null);
  const [selectedTaskForReschedule, setSelectedTaskForReschedule] = useState<Task | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  // Load capacity & compute plan
  useEffect(() => {
    let mounted = true;
    studyPlanningService.getDailyStudyCapacity().then(cap => {
      if (mounted) {
        setCapacity(cap);
        const w = studyPlanningService.calculateDailyWorkload(targetDate, { capacityMinutesOverride: cap });
        const p = studyPlanningService.generateDailyStudyPlan(targetDate, { capacityMinutesOverride: cap });
        setWorkload(w);
        setPlan(p);
      }
    });
    return () => {
      mounted = false;
    };
  }, [targetDate, tasks]);

  const updateCapacity = async (delta: number) => {
    const newCap = Math.max(30, Math.min(360, capacity + delta));
    setCapacity(newCap);
    await studyPlanningService.setDailyStudyCapacity(newCap);
    const w = studyPlanningService.calculateDailyWorkload(targetDate, { capacityMinutesOverride: newCap });
    const p = studyPlanningService.generateDailyStudyPlan(targetDate, { capacityMinutesOverride: newCap });
    setWorkload(w);
    setPlan(p);
  };

  const handleConvertRevision = async (item: StudyPlanItem) => {
    await studyPlanningService.convertRevisionToTask(
      item.sourceId,
      targetDate,
      item.suggestedStartTime,
      item.durationMinutes
    );
  };

  const handleOpenReschedule = (item: StudyPlanItem) => {
    if (item.sourceType === 'task') {
      const canonical = tasks.find(t => t.id === item.sourceId);
      if (canonical) {
        setSelectedTaskForReschedule(canonical);
        setShowRescheduleModal(true);
      }
    }
  };

  if (!plan || !workload) return null;

  const getStatusColor = (st: string) => {
    switch (st) {
      case 'overloaded':
        return statusColors.danger;
      case 'heavy':
        return '#F59E0B'; // Amber
      case 'moderate':
        return brand.violet;
      case 'light':
      default:
        return statusColors.safe;
    }
  };

  const getPriorityBadgeColor = (type: string) => {
    switch (type) {
      case 'critical_revision':
        return statusColors.danger;
      case 'urgent_exam_prep':
        return '#EC4899'; // Pink
      case 'overdue_task':
        return statusColors.danger;
      case 'due_task':
        return '#F59E0B';
      case 'high_priority_task':
        return brand.violet;
      default:
        return colors.textSecondary;
    }
  };

  const formatPlanTypeLabel = (type: string) => {
    switch (type) {
      case 'critical_revision':
        return 'CRITICAL REVISION';
      case 'urgent_exam_prep':
        return 'EXAM PREP';
      case 'overdue_task':
        return 'OVERDUE';
      case 'due_task':
        return 'DUE TODAY';
      case 'high_priority_task':
        return 'HIGH PRIORITY';
      case 'recommended_revision':
        return 'REVISION';
      default:
        return 'PLANNED';
    }
  };

  return (
    <GlassCard style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleWithBadge}>
            <Text style={[styles.title, { color: colors.text }]}>Today's Study Plan</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(workload.status)}20` }]}>
              <Text style={[styles.statusBadgeText, { color: getStatusColor(workload.status) }]}>
                {workload.status.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
            {workload.explanation}
          </Text>
        </View>

        {onOpenCalendar && (
          <Pressable onPress={onOpenCalendar} style={styles.calendarLink}>
            <Text style={[styles.calendarLinkText, { color: brand.violet }]}>Calendar →</Text>
          </Pressable>
        )}
      </View>

      {/* Capacity & Workload Stats Bar */}
      <View
        style={[
          styles.statsRow,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
        ]}
      >
        <View style={styles.statCol}>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>CLASSES</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {Math.floor(workload.classesMinutes / 60)}h {workload.classesMinutes % 60}m
          </Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>STUDY PLANNED</Text>
          <Text style={[styles.statValue, { color: brand.violet }]}>
            {Math.floor(plan.plannedStudyMinutes / 60)}h {plan.plannedStudyMinutes % 60}m
          </Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>DAILY CAPACITY</Text>
          <View style={styles.capacityAdjuster}>
            <Pressable onPress={() => updateCapacity(-30)} style={styles.adjustBtn}>
              <Text style={[styles.adjustBtnText, { color: colors.textSecondary }]}>−</Text>
            </Pressable>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {Math.floor(capacity / 60)}h{capacity % 60 > 0 ? ` ${capacity % 60}m` : ''}
            </Text>
            <Pressable onPress={() => updateCapacity(30)} style={styles.adjustBtn}>
              <Text style={[styles.adjustBtnText, { color: colors.textSecondary }]}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Conflicts Banner (if any) */}
      {plan.conflicts.length > 0 && (
        <View
          style={[
            styles.conflictBanner,
            { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)' },
          ]}
        >
          <Text style={[styles.conflictTitle, { color: statusColors.danger }]}>
            {plan.conflicts[0].title}
          </Text>
          <Text style={[styles.conflictDesc, { color: colors.textSecondary }]}>
            {plan.conflicts[0].description}
          </Text>
        </View>
      )}

      {/* Plan Items */}
      <View style={styles.itemsList}>
        {plan.items.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            No urgent study tasks for today. You are caught up!
          </Text>
        ) : (
          plan.items.map(item => {
            const isTask = item.sourceType === 'task';
            const canonicalTask = isTask ? tasks.find(t => t.id === item.sourceId) : null;
            const isCompleted = canonicalTask?.isCompleted || item.isCompleted;

            return (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* Time & Checkbox */}
                <View style={styles.itemTimeCol}>
                  <Text style={[styles.itemTime, { color: brand.violet }]}>
                    {item.suggestedStartTime || 'Flexible'}
                  </Text>
                  <Text style={[styles.itemDuration, { color: colors.textTertiary }]}>
                    {item.durationMinutes}m
                  </Text>
                </View>

                {/* Content */}
                <View style={styles.itemContentCol}>
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.planTypeBadge,
                        { backgroundColor: `${getPriorityBadgeColor(item.planType)}20` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.planTypeBadgeText,
                          { color: getPriorityBadgeColor(item.planType) },
                        ]}
                      >
                        {formatPlanTypeLabel(item.planType)}
                      </Text>
                    </View>
                    {item.subjectName && (
                      <Text style={[styles.subjectNameText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.subjectName}
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.itemTitle,
                      { color: colors.text },
                      isCompleted && styles.completedTitle,
                    ]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text style={[styles.reasonText, { color: colors.textTertiary }]} numberOfLines={1}>
                    {item.reason}
                  </Text>
                </View>

                {/* Action button */}
                <View style={styles.itemActionCol}>
                  {isTask ? (
                    <Pressable
                      onPress={() => canonicalTask && toggleTask(canonicalTask.id)}
                      style={[
                        styles.checkBtn,
                        isCompleted && { backgroundColor: statusColors.safe, borderColor: statusColors.safe },
                      ]}
                    >
                      <Feather
                        name={isCompleted ? 'check' : 'circle'}
                        size={12}
                        color={isCompleted ? '#FFF' : colors.textTertiary}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => handleConvertRevision(item)}
                      style={[
                        styles.addBtn,
                        {
                          backgroundColor: 'rgba(0, 229, 255, 0.14)',
                          borderColor: 'rgba(0, 229, 255, 0.35)',
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[styles.addBtnText, { color: '#00E5FF' }]}>+ Task</Text>
                    </Pressable>
                  )}

                  {isTask && !isCompleted && (
                    <Pressable onPress={() => handleOpenReschedule(item)} style={styles.rescheduleBtn}>
                      <Text style={[styles.rescheduleBtnText, { color: colors.textSecondary }]}>Move</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Overflow Section (Capacity Exceeded) */}
      {plan.overflowItems.length > 0 && (
        <View
          style={[
            styles.overflowContainer,
            { backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)' },
          ]}
        >
          <View style={styles.overflowHeader}>
            <Text style={[styles.overflowTitle, { color: '#F59E0B' }]}>
              {plan.overflowItems.length} Deferred Item(s)
            </Text>
            <Text style={[styles.overflowSub, { color: colors.textTertiary }]}>
              Exceeds {Math.round(capacity / 60)}h study capacity
            </Text>
          </View>
          {plan.overflowItems.map(ov => (
            <View key={ov.id} style={styles.overflowItemRow}>
              <Text style={[styles.overflowItemTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                • {ov.title}
              </Text>
              <Text style={[styles.overflowItemDuration, { color: colors.textTertiary }]}>
                {ov.durationMinutes}m
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Task Reschedule Modal */}
      <TaskRescheduleModal
        visible={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false);
          setSelectedTaskForReschedule(null);
        }}
        task={selectedTaskForReschedule}
      />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  explanationText: {
    fontSize: typography.sizes.xs,
    marginTop: 4,
    lineHeight: 18,
  },
  calendarLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  calendarLinkText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  capacityAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adjustBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  adjustBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  conflictBanner: {
    padding: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: statusColors.danger,
  },
  conflictTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  conflictDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  itemsList: {
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: typography.sizes.xs,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  itemTimeCol: {
    alignItems: 'center',
    minWidth: 54,
  },
  itemTime: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemDuration: {
    fontSize: 10,
    marginTop: 1,
  },
  itemContentCol: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  planTypeBadge: {
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: radii.xs,
  },
  planTypeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subjectNameText: {
    fontSize: 10,
    fontWeight: '500',
  },
  itemTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  reasonText: {
    fontSize: 10,
    marginTop: 1,
  },
  itemActionCol: {
    alignItems: 'center',
    gap: 4,
  },
  checkBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  rescheduleBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  rescheduleBtnText: {
    fontSize: 9,
    fontWeight: '600',
  },
  overflowContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  overflowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  overflowTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  overflowSub: {
    fontSize: 10,
  },
  overflowItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  overflowItemTitle: {
    fontSize: 11,
    flex: 1,
  },
  overflowItemDuration: {
    fontSize: 10,
    marginLeft: spacing.xs,
  },
});
