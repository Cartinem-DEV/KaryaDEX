/**
 * BunkMatKar — AcademicCalendarView Component (Phase 9)
 *
 * Unified Academic Calendar experience providing Day, Week, and Month views:
 * - Day View: Detailed daily academic timeline with classes, exams, tasks, workload, and study blocks.
 * - Week View: 7-day academic horizon with daily workload classifications (light, moderate, heavy, overloaded).
 * - Month View: Month-at-a-glance grid with dots for classes, exams, deadlines, and overloaded days.
 * - Class-aware & exam-aware: Fixed commitments are protected.
 * - Preserves relationships to canonical entities without creating duplicate records.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { studyPlanningService } from '@/services/studyPlanningService';
import { useAppStore } from '@/store/useAppStore';
import {
  formatLocalDate,
  parseLocalDate,
  formatDateShort,
  getDayOfWeekFromDate,
  formatTime,
  timeToMinutes,
} from '@/lib/timeUtils';
import type { CalendarEvent, DailyWorkload, WeeklyStudyPlan } from '@/types/academic';
import type { Task } from '@/types';
import { TaskRescheduleModal } from './TaskRescheduleModal';
import { DailyStudyPlanCard } from './DailyStudyPlanCard';

export type CalendarViewMode = 'day' | 'week' | 'month';

interface AcademicCalendarViewProps {
  initialDate?: Date;
  onSelectSession?: (session: any) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function AcademicCalendarView({
  initialDate = new Date(),
  onSelectSession,
}: AcademicCalendarViewProps) {
  const { colors, isDark } = useTheme();
  const tasks = useAppStore(s => s.tasks);
  const toggleTask = useAppStore(s => s.toggleTask);

  const [viewMode, setViewMode] = useState<CalendarViewMode>('day');
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [selectedTaskForReschedule, setSelectedTaskForReschedule] = useState<Task | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  const currentDateStr = formatLocalDate(currentDate);

  // Navigate functions
  const changeDate = (days: number) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + days);
    setCurrentDate(next);
  };

  const changeMonth = (months: number) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + months);
    setCurrentDate(next);
  };

  // Day View data
  const dayEvents = useMemo(() => {
    return studyPlanningService.deriveCalendarEvents(currentDateStr, currentDateStr);
  }, [currentDateStr, tasks]);

  const dayWorkload = useMemo(() => {
    return studyPlanningService.calculateDailyWorkload(currentDateStr);
  }, [currentDateStr, tasks]);

  // Week View data
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    d.setDate(d.getDate() + diff);
    return formatLocalDate(d);
  }, [currentDate]);

  const weeklyPlan: WeeklyStudyPlan = useMemo(() => {
    return studyPlanningService.generateWeeklyStudyPlan(weekStart);
  }, [weekStart, tasks]);

  // Month View dates calculation
  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();

    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    // Prefix days from prev month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, d);
      days.push({
        dateStr: formatLocalDate(prevDate),
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      const thisDate = new Date(year, month, d);
      days.push({
        dateStr: formatLocalDate(thisDate),
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Suffix days to fill complete weeks
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextDate = new Date(year, month + 1, d);
        days.push({
          dateStr: formatLocalDate(nextDate),
          dayNum: d,
          isCurrentMonth: false,
        });
      }
    }

    return days;
  }, [currentDate]);

  // Month events cache for dot indicators
  const monthEventsMap = useMemo(() => {
    if (viewMode !== 'month') return new Map<string, CalendarEvent[]>();
    if (monthData.length === 0) return new Map<string, CalendarEvent[]>();

    const firstStr = monthData[0].dateStr;
    const lastStr = monthData[monthData.length - 1].dateStr;
    const evts = studyPlanningService.deriveCalendarEvents(firstStr, lastStr);

    const map = new Map<string, CalendarEvent[]>();
    for (const e of evts) {
      const existing = map.get(e.date) || [];
      existing.push(e);
      map.set(e.date, existing);
    }
    return map;
  }, [viewMode, monthData, tasks]);

  const getStatusColor = (st: string) => {
    switch (st) {
      case 'overloaded':
        return statusColors.danger;
      case 'heavy':
        return '#F59E0B';
      case 'moderate':
        return brand.violet;
      case 'light':
      default:
        return statusColors.safe;
    }
  };

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.container}>
      {/* ─── View Toggle & Navigation Header ────────── */}
      <View style={styles.topControlRow}>
        {/* Segmented Control */}
        <View
          style={[
            styles.segmentedBar,
            {
              backgroundColor: isDark ? 'rgba(10, 16, 28, 0.72)' : 'rgba(0,0,0,0.05)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          {(['day', 'week', 'month'] as CalendarViewMode[]).map(mode => {
            const isSelected = viewMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                style={[
                  styles.segmentBtn,
                  isSelected && {
                    backgroundColor: isDark ? 'rgba(0, 229, 255, 0.16)' : '#FFFFFF',
                    borderColor: isDark ? '#00E5FF' : 'transparent',
                    borderWidth: isDark ? 1 : 0,
                    shadowColor: isDark ? '#00E5FF' : '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDark ? 0.35 : 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    { color: isSelected ? (isDark ? '#00E5FF' : colors.text) : colors.textSecondary },
                    isSelected && { fontWeight: '700' },
                  ]}
                >
                  {mode.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Date Nav Arrows */}
        <View style={styles.navRow}>
          <Pressable
            onPress={() => (viewMode === 'month' ? changeMonth(-1) : viewMode === 'week' ? changeDate(-7) : changeDate(-1))}
            style={[
              styles.navBtn,
              {
                backgroundColor: isDark ? 'rgba(0, 229, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                borderColor: isDark ? 'rgba(0, 229, 255, 0.25)' : 'rgba(0, 0, 0, 0.08)',
                borderWidth: 1,
              },
            ]}
          >
            <Feather name="chevron-left" size={16} color={isDark ? '#00E5FF' : colors.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => setCurrentDate(new Date())}
            style={[
              styles.todayBtn,
              {
                backgroundColor: isDark ? 'rgba(0, 229, 255, 0.12)' : 'rgba(124, 58, 237, 0.08)',
                borderColor: isDark ? 'rgba(0, 229, 255, 0.35)' : 'rgba(124, 58, 237, 0.2)',
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.todayBtnText, { color: isDark ? '#00E5FF' : brand.violet }]}>Today</Text>
          </Pressable>

          <Pressable
            onPress={() => (viewMode === 'month' ? changeMonth(1) : viewMode === 'week' ? changeDate(7) : changeDate(1))}
            style={[
              styles.navBtn,
              {
                backgroundColor: isDark ? 'rgba(0, 229, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                borderColor: isDark ? 'rgba(0, 229, 255, 0.25)' : 'rgba(0, 0, 0, 0.08)',
                borderWidth: 1,
              },
            ]}
          >
            <Feather name="chevron-right" size={16} color={isDark ? '#00E5FF' : colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Date Title Banner */}
      <View style={styles.dateTitleRow}>
        <Text style={[styles.dateTitleText, { color: colors.text }]}>
          {viewMode === 'month'
            ? monthName
            : viewMode === 'week'
            ? `Week of ${formatDateShort(parseLocalDate(weekStart))}`
            : formatDateShort(currentDate)}
        </Text>
        {viewMode === 'day' && (
          <View style={[styles.workloadChip, { backgroundColor: `${getStatusColor(dayWorkload.status)}20` }]}>
            <Text style={[styles.workloadChipText, { color: getStatusColor(dayWorkload.status) }]}>
              {dayWorkload.status.toUpperCase()} · {Math.floor(dayWorkload.totalMinutes / 60)}h {dayWorkload.totalMinutes % 60}m
            </Text>
          </View>
        )}
      </View>

      {/* ─── DAY VIEW ──────────────────────────────── */}
      {viewMode === 'day' && (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Integrated Daily Study Plan Card */}
          <DailyStudyPlanCard dateStr={currentDateStr} />

          {/* Chronological Timeline */}
          <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
            DAILY ACADEMIC TIMELINE
          </Text>

          {dayEvents.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                No scheduled classes or events for this date.
              </Text>
            </GlassCard>
          ) : (
            dayEvents.map(evt => {
              const isClass = evt.type === 'class';
              const isExam = evt.type === 'exam';
              const isTask = evt.type === 'task';
              const isRecovery = evt.metadata?.attendanceRecovery;

              return (
                <Pressable
                  key={evt.id}
                  onPress={() => {
                    if (isClass && onSelectSession) {
                      onSelectSession({
                        slotId: evt.sourceId,
                        date: evt.date,
                        subjectId: evt.subjectId,
                        startTime: evt.startTime,
                        endTime: evt.endTime,
                        room: evt.metadata?.room,
                        type: evt.metadata?.classType,
                      });
                    }
                  }}
                  style={[
                    styles.timelineRow,
                    { borderColor: colors.border },
                    isRecovery && { borderLeftColor: statusColors.danger, borderLeftWidth: 3 },
                  ]}
                >
                  <View style={styles.timeColumn}>
                    <Text style={[styles.timeText, { color: colors.text }]}>
                      {evt.startTime || 'Flexible'}
                    </Text>
                    {evt.endTime && (
                      <Text style={[styles.endTimeText, { color: colors.textTertiary }]}>
                        {evt.endTime}
                      </Text>
                    )}
                  </View>

                  <View style={styles.eventPill}>
                    <View style={styles.eventHeaderRow}>
                      <View style={styles.eventTagRow}>
                        <View
                          style={[
                            styles.eventTag,
                            {
                              backgroundColor: isExam
                                ? `${statusColors.danger}20`
                                : isClass
                                ? `${brand.violet}20`
                                : `${colors.border}40`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.eventTagText,
                              {
                                color: isExam
                                  ? statusColors.danger
                                  : isClass
                                  ? brand.violet
                                  : colors.textSecondary,
                              },
                            ]}
                          >
                            {evt.type.toUpperCase()}
                          </Text>
                        </View>

                        {isRecovery && (
                          <View style={[styles.recoveryTag, { backgroundColor: `${statusColors.danger}20` }]}>
                            <Text style={[styles.recoveryTagText, { color: statusColors.danger }]}>
                              ATTENDANCE RECOVERY
                            </Text>
                          </View>
                        )}
                      </View>

                      {isTask && (
                        <Pressable
                          onPress={() => {
                            const canonical = tasks.find(t => t.id === evt.sourceId);
                            if (canonical) {
                              setSelectedTaskForReschedule(canonical);
                              setShowRescheduleModal(true);
                            }
                          }}
                          style={styles.rescheduleLink}
                        >
                          <Text style={[styles.rescheduleLinkText, { color: colors.textSecondary }]}>
                            Move
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    <Text style={[styles.eventTitle, { color: colors.text }]}>{evt.title}</Text>
                    {evt.subtitle && (
                      <Text style={[styles.eventSubtitle, { color: colors.textTertiary }]}>
                        {evt.subtitle}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ─── WEEK VIEW ─────────────────────────────── */}
      {viewMode === 'week' && (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 7-Day Overview Strip */}
          <View style={styles.weekStrip}>
            {weeklyPlan.days.map(d => {
              const isSelected = d.date === currentDateStr;
              const statusColor = getStatusColor(d.workload.status);
              return (
                <Pressable
                  key={d.date}
                  onPress={() => setCurrentDate(parseLocalDate(d.date))}
                  style={[
                    styles.weekDayTab,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(59,130,246,0.2)'
                          : 'rgba(59,130,246,0.1)'
                        : isDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(0,0,0,0.02)',
                      borderColor: isSelected ? brand.violet : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.weekDayName, { color: colors.textSecondary }]}>
                    {d.dayOfWeek}
                  </Text>
                  <Text style={[styles.weekDayNum, { color: colors.text }]}>
                    {parseLocalDate(d.date).getDate()}
                  </Text>
                  <View style={[styles.weekStatusDot, { backgroundColor: statusColor }]} />
                </Pressable>
              );
            })}
          </View>

          {/* Selected Day Details inside Week View */}
          <View style={{ marginTop: spacing.md }}>
            <DailyStudyPlanCard dateStr={currentDateStr} />
          </View>
        </ScrollView>
      )}

      {/* ─── MONTH VIEW ────────────────────────────── */}
      {viewMode === 'month' && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <GlassCard style={styles.monthCard}>
            {/* Weekday headers */}
            <View style={styles.monthGridHeader}>
              {WEEKDAYS.map(w => (
                <Text key={w} style={[styles.weekdayHeaderCell, { color: colors.textTertiary }]}>
                  {w}
                </Text>
              ))}
            </View>

            {/* Grid days */}
            <View style={styles.monthGrid}>
              {monthData.map((item, idx) => {
                const isSelected = item.dateStr === currentDateStr;
                const isToday = item.dateStr === formatLocalDate();
                const evts = monthEventsMap.get(item.dateStr) || [];
                const hasClass = evts.some(e => e.type === 'class');
                const hasExam = evts.some(e => e.type === 'exam');
                const hasTask = evts.some(e => e.type === 'task');

                return (
                  <Pressable
                    key={idx}
                    onPress={() => setCurrentDate(parseLocalDate(item.dateStr))}
                    style={[
                      styles.monthCell,
                      isSelected && {
                        backgroundColor: isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.15)',
                        borderColor: brand.violet,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthCellNum,
                        {
                          color: !item.isCurrentMonth
                            ? colors.textTertiary
                            : isToday
                            ? brand.violet
                            : colors.text,
                        },
                        isToday && { fontWeight: '800' },
                      ]}
                    >
                      {item.dayNum}
                    </Text>

                    {/* Dot indicators */}
                    <View style={styles.dotsRow}>
                      {hasClass && <View style={[styles.cellDot, { backgroundColor: brand.violet }]} />}
                      {hasExam && <View style={[styles.cellDot, { backgroundColor: statusColors.danger }]} />}
                      {hasTask && <View style={[styles.cellDot, { backgroundColor: '#8B5CF6' }]} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>

          {/* Events on selected date in Month View */}
          <View style={{ marginTop: spacing.md }}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              EVENTS ON {formatDateShort(currentDate).toUpperCase()}
            </Text>
            {dayEvents.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                  No academic events on this date.
                </Text>
              </GlassCard>
            ) : (
              dayEvents.map(evt => (
                <View key={evt.id} style={[styles.timelineRow, { borderColor: colors.border }]}>
                  <View style={styles.timeColumn}>
                    <Text style={[styles.timeText, { color: colors.text }]}>
                      {evt.startTime || 'Flexible'}
                    </Text>
                  </View>
                  <View style={styles.eventPill}>
                    <Text style={[styles.eventTitle, { color: colors.text }]}>{evt.title}</Text>
                    {evt.subtitle && (
                      <Text style={[styles.eventSubtitle, { color: colors.textTertiary }]}>
                        {evt.subtitle}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  segmentedBar: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: 3,
  },
  segmentBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  navBtnText: {
    fontSize: 20,
    fontWeight: '700',
  },
  todayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateTitleText: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
  },
  workloadChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
  },
  workloadChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  timeColumn: {
    minWidth: 55,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  endTimeText: {
    fontSize: 10,
    marginTop: 1,
  },
  eventPill: {
    flex: 1,
  },
  eventHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  eventTagRow: {
    flexDirection: 'row',
    gap: 4,
  },
  eventTag: {
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: radii.xs,
  },
  eventTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  recoveryTag: {
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: radii.xs,
  },
  recoveryTagText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rescheduleLink: {
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  rescheduleLinkText: {
    fontSize: 10,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  eventSubtitle: {
    fontSize: 10,
    marginTop: 1,
  },
  emptyCard: {
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  emptyText: {
    fontSize: typography.sizes.xs,
    fontStyle: 'italic',
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekDayTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  weekDayName: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  weekDayNum: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  weekStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  monthCard: {
    padding: spacing.sm,
    borderRadius: radii.lg,
  },
  monthGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xs,
  },
  weekdayHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: '14%',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    padding: 2,
  },
  monthCellNum: {
    fontSize: 12,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 3,
    height: 4,
  },
  cellDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
