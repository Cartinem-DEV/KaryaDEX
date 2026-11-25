/**
 * KaryaDEX — TODAY Screen
 * 
 * Visual redesign with refined glassmorphism:
 * - Ambient atmospheric background lighting
 * - Primary glass hero card with subtle ambient glow
 * - Clean vertical timeline with subtle glass elevation
 * - Restrained status-tinted attention glass cards
 * - Secondary glass upcoming task cards
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
  RefreshControl, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status } from '@/constants/theme';
import {
  GlassCard, StatusBadge, SectionHeader,
  AttendanceRing, AmbientBackground, Block3D, LuminousButton,
  GlassButton,
} from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';
import {
  getGreeting, formatDate, formatTime,
  getTodayClasses, getNextClass, getCurrentClass,
  buildTimeline, formatDueDate, daysUntil, formatLocalDate,
} from '@/lib/timeUtils';
import { calculatePercentage, getAttendanceStatus } from '@/lib/attendance';
import { useTodayAcademic } from '@/hooks/useTodayAcademic';
import { ClassSessionModal } from '@/components/academic/ClassSessionModal';
import { NotificationSettingsModal } from '@/components/academic/NotificationSettingsModal';
import { SemesterSwitcher, AcademicHealthCard, DailyStudyPlanCard } from '@/components/academic';
import { NotificationBellIcon } from '@/components/ui/AcademicIcons';
import { SyncStatusBadge } from '@/components/ui/SyncStatusBadge';
import { AccountSettingsModal } from '@/components/auth/AccountSettingsModal';
import { AIAssistantModal } from '@/components/ai';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlaygroundStore } from '@/store/usePlaygroundStore';
import type { TimelineEvent, AttentionItem } from '@/types';

export default function TodayScreen() {
  const { colors, isDark, toggle } = useTheme();
  const router = useRouter();
  const {
    user, subjects, classSessions, attendanceData,
    attendanceTarget, tasks, getAttentionItems, refreshFromDatabase,
  } = useAppStore();
  const academicData = useTodayAcademic();
  const brainRating = usePlaygroundStore((s) => s.brainRating);
  const escapeStreak = usePlaygroundStore((s) => s.escapeStreak);

  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<{
    slotId: string;
    date: string;
    subjectId: string;
    startTime?: string;
    endTime?: string;
    room?: string;
    type?: 'lecture' | 'lab' | 'tutorial';
  } | null>(null);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const todayClasses = getTodayClasses(classSessions, subjects, now);
  const nextClass = getNextClass(todayClasses);
  const currentClass = getCurrentClass(todayClasses);
  const heroClass = currentClass || nextClass;
  const timeline = buildTimeline(todayClasses);
  const { greeting, emoji: greetingEmoji } = getGreeting();
  const baseAttentionItems = getAttentionItems();

  const attentionItems: AttentionItem[] = academicData.snapshot.attentionItems.map(item => ({
    id: item.id,
    type: item.type as any,
    title: item.title,
    subtitle: item.subtitle,
    severity: item.priority === 'critical' ? 'danger' : item.priority === 'high' ? 'warning' : 'info',
    subjectId: item.subjectId,
    actionLabel: item.actionLabel,
  }));

  const onRefresh = async () => {
    setRefreshing(true);
    setNow(new Date());
    try {
      await refreshFromDatabase();
    } catch (err) {
      console.warn('[TodayScreen] Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Get attendance for hero card subject
  const getSubjectAttendance = (subjectId: string) => {
    const data = attendanceData[subjectId];
    if (!data) return { percentage: 0, status: 'danger' as const };
    const percentage = calculatePercentage(data.attended, data.total);
    return { percentage, status: getAttendanceStatus(percentage, attendanceTarget) };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Subtle atmospheric background orbs */}
      <AmbientBackground forceDark />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />
        }
      >
        {/* ─── Header ─────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.greeting, { color: isDark ? '#FFFFFF' : colors.text }]}>
              {greeting}
            </Text>
            <Text style={[styles.date, { color: isDark ? '#00E5FF' : colors.textSecondary }]}>
              {formatDate(now)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <SemesterSwitcher compact />
            <SyncStatusBadge compact onPress={() => setAccountModalVisible(true)} />
            <Pressable
              onPress={(event: any) => setShowAIModal(true)}
              style={({ pressed }) => [
                styles.notifBtn,
                {
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(56, 189, 248, 0.08)',
                  borderColor: isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(56, 189, 248, 0.18)',
                },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityLabel="AI Academic Assistant"
            >
              <Ionicons name="sparkles" size={17} color="#38BDF8" />
            </Pressable>

            <Pressable
              onPress={(event: any) => setShowNotificationModal(true)}
              style={({ pressed }) => [
                styles.notifBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityLabel="Notification Settings"
            >
              <NotificationBellIcon size={18} color={colors.text} />
            </Pressable>

            <Pressable
              onPress={(event: any) => setAccountModalVisible(true)}
              onLongPress={toggle}
              style={({ pressed }) => [
                styles.avatar,
                {
                  backgroundColor: isDark ? 'rgba(0, 229, 255, 0.14)' : 'rgba(124, 58, 237, 0.10)',
                  borderColor: isDark ? 'rgba(0, 229, 255, 0.32)' : 'rgba(124, 58, 237, 0.18)',
                },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityLabel="Account and Cloud Sync"
            >
              <Text style={[styles.avatarText, { color: isDark ? '#00E5FF' : brand.violet }]}>
                {user?.name?.charAt(0)?.toUpperCase() || 'S'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ─── Hero: Next/Current Class ───────────── */}
        {heroClass ? (
          <View style={styles.heroSection}>
            <Text style={[styles.heroLabel, { color: isDark ? '#00E5FF' : colors.textTertiary }]}>
              {currentClass ? 'HAPPENING NOW' : 'NEXT CLASS'}
            </Text>

            {/* Ambient light glow behind hero card */}
            <View style={styles.heroGlowWrapper}>
              <View
                style={[
                  styles.heroGlow,
                  {
                    backgroundColor: isDark
                      ? 'rgba(0, 229, 255, 0.16)'
                      : 'rgba(124, 58, 237, 0.10)',
                  },
                ]}
              />
              <GlassCard
                level="primary"
                onPress={() => {
                  const todayStr = formatLocalDate(new Date());
                  setSelectedSessionForModal({
                    slotId: heroClass.classSessionId,
                    date: heroClass.date || todayStr,
                    subjectId: heroClass.subject.id,
                    startTime: heroClass.startTime,
                    endTime: heroClass.endTime,
                    room: heroClass.room,
                    type: heroClass.type as any,
                  });
                }}
                style={styles.heroCard}
              >
                <View style={styles.heroContent}>
                  <View style={styles.heroLeft}>
                    <View style={[styles.subjectDot, { backgroundColor: heroClass.subject.color }]} />
                    <View style={styles.heroInfo}>
                      <Text style={[styles.heroSubject, { color: colors.text }]}>
                        {heroClass.subject.shortName}
                      </Text>
                      <Text style={[styles.heroTime, { color: colors.textSecondary }]}>
                        {formatTime(heroClass.startTime)} — {formatTime(heroClass.endTime)}
                      </Text>
                      <Text style={[styles.heroRoom, { color: colors.textTertiary }]}>
                        {heroClass.room} · {heroClass.type}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.heroRight}>
                    {(() => {
                      const att = getSubjectAttendance(heroClass.subject.id);
                      return (
                        <View style={styles.heroAttendance}>
                          <AttendanceRing
                            percentage={att.percentage}
                            size={56}
                            strokeWidth={4.5}
                            attendanceStatus={att.status}
                          />
                          <StatusBadge variant={att.status} size="sm" />
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </GlassCard>
            </View>
          </View>
        ) : (
          <View style={styles.heroSection}>
            <GlassCard level="secondary" style={styles.heroCard}>
              <View style={styles.noClassContent}>
                <View
                  style={[
                    styles.noClassIconBadge,
                    {
                      backgroundColor: isDark
                        ? 'rgba(0, 229, 255, 0.12)'
                        : 'rgba(16, 185, 129, 0.10)',
                      borderColor: isDark ? 'rgba(0, 229, 255, 0.3)' : 'rgba(16, 185, 129, 0.25)',
                    },
                  ]}
                >
                  <Feather
                    name={todayClasses.length === 0 ? 'sun' : 'check-circle'}
                    size={22}
                    color={todayClasses.length === 0 ? '#00E5FF' : '#10B981'}
                  />
                </View>
                <Text style={[styles.noClassTitle, { color: colors.text }]}>
                  {todayClasses.length === 0
                    ? 'No classes scheduled today — great day to review or recharge.'
                    : 'All scheduled classes completed for today'}
                </Text>
              </View>
            </GlassCard>
          </View>
        )}

        {/* ─── 3D Quick Actions ───────────────────── */}
        <View style={styles.quickActionsRow}>
          <GlassButton
            title="Log Today · Attendance"
            level="secondary"
            variant="secondary"
            size="md"
            fullWidth={false}
            onPress={() => router.push('/(tabs)/attendance')}
            icon={<Feather name="check-square" size={17} color="#00E5FF" />}
          />
          <GlassButton
            title="Timetable · Full Routine"
            level="secondary"
            variant="secondary"
            size="md"
            fullWidth={false}
            onPress={() => router.push('/(tabs)/schedule')}
            icon={<Feather name="calendar" size={17} color="#F59E0B" />}
          />
          <GlassButton
            title="AI Sprint · Study Plan"
            level="secondary"
            variant="secondary"
            size="md"
            fullWidth={false}
            onPress={() => setShowAIModal(true)}
            icon={<Feather name="zap" size={17} color="#8B5CF6" />}
          />
        </View>

        {/* ─── Today's Study Plan ───────────────── */}
        <View style={styles.workloadSection}>
          <GlassButton
            title="Open Calendar · Full Timetable"
            level="secondary"
            variant="secondary"
            size="lg"
            fullWidth={true}
            onPress={() => router.push('/(tabs)/schedule')}
            icon={<Feather name="calendar" size={18} color="#00E5FF" />}
          />
        </View>

        {/* ─── Your Day Timeline ─────────────────── */}
        {timeline.length > 0 && (
          <>
            <SectionHeader title="YOUR DAY" subtitle={`${timeline.length} classes`} />
            <View style={styles.timeline}>
              {timeline.map((event, index) => (
                <TimelineRow
                  key={event.id}
                  event={event}
                  isLast={index === timeline.length - 1}
                  colors={colors}
                  isDark={isDark}
                  onPress={() => {
                    const todayStr = formatLocalDate(new Date());
                    setSelectedSessionForModal({
                      slotId: event.classSessionId || event.id,
                      date: event.date || todayStr,
                      subjectId: event.subjectId || '',
                      startTime: event.startTime,
                      endTime: event.endTime || '',
                      room: event.room,
                      type: 'lecture',
                    });
                  }}
                />
              ))}
            </View>
          </>
        )}

        {/* ─── Needs Attention ────────────────────── */}
        {attentionItems.length > 0 && (
          <>
            <SectionHeader title="NEEDS ATTENTION" />
            <View style={styles.attentionContainer}>
              {attentionItems.map((item) => (
                <AttentionRow key={item.id} item={item} colors={colors} isDark={isDark} />
              ))}
            </View>
          </>
        )}

        {/* ─── Upcoming Tasks ────────────────────── */}
        {(() => {
          const pendingTasks = tasks
            .filter(t => !t.isCompleted && t.dueDate)
            .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
            .slice(0, 3);

          if (pendingTasks.length === 0) return null;

          return (
            <>
              <SectionHeader
                title="UPCOMING TASKS"
                actionLabel="See all"
                onAction={() => router.push('/(tabs)/tasks')}
              />
              <View style={styles.tasksContainer}>
                {pendingTasks.map((task) => {
                  const subject = subjects.find(s => s.id === task.subjectId);
                  return (
                    <GlassCard key={task.id} level="secondary" style={styles.taskCard}>
                      <View style={styles.taskRow}>
                        <View style={[
                          styles.taskDot,
                          { backgroundColor: subject?.color || brand.violet }
                        ]} />
                        <View style={styles.taskInfo}>
                          <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={1}>
                            {task.title}
                          </Text>
                          <Text style={[styles.taskMeta, { color: colors.textTertiary }]}>
                            {subject?.shortName}{task.dueDate ? ` · ${formatDueDate(task.dueDate)}` : ''}
                            {task.estimatedMinutes ? ` · ~${task.estimatedMinutes} min` : ''}
                          </Text>
                        </View>
                        {task.dueDate && daysUntil(task.dueDate) <= 1 && (
                          <View style={[styles.urgentDot, { backgroundColor: status.danger }]} />
                        )}
                      </View>
                    </GlassCard>
                  );
                })}
              </View>
            </>
          );
        })()}

        {/* ─── Escape The Matrix: Brain Playground ── */}
        <View style={styles.playgroundSection}>
          <Pressable
            style={({ pressed }) => [
              styles.playgroundCard,
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
            onPress={() => router.push('/(tabs)/playground' as any)}
          >
            <View style={styles.playgroundGlowLine} />
            <View style={styles.playgroundInner}>
              <View style={styles.playgroundTopRow}>
                <View style={styles.playgroundTag}>
                  <View style={styles.playgroundTagDot} />
                  <Text style={styles.playgroundTagText}>ESCAPE THE MATRIX</Text>
                </View>
                <View style={styles.playgroundStreakBadge}>
                  <Text style={styles.playgroundStreakText}>🔥 {escapeStreak}d Streak</Text>
                </View>
              </View>

              <View style={styles.playgroundTitleRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.playgroundTitle}>Brain Playground</Text>
                  <Text style={styles.playgroundSubtitle}>
                    Break free from mindless scrolling. Rewire with Sprint Math, Queens & Tango.
                  </Text>
                </View>
                <View style={styles.playgroundIconBox}>
                  <MaterialCommunityIcons name="gamepad-variant" size={26} color="#B1FA63" />
                </View>
              </View>

              <View style={styles.playgroundFooter}>
                <View style={styles.playgroundEloPill}>
                  <Feather name="zap" size={13} color="#00D9FF" />
                  <Text style={styles.playgroundEloText}>{brainRating} ELO</Text>
                </View>
                <View style={styles.playgroundLaunchPill}>
                  <Text style={styles.playgroundLaunchText}>Play Games</Text>
                  <Feather name="arrow-right" size={13} color="#05070B" />
                </View>
              </View>
            </View>
          </Pressable>
        </View>

        {/* ─── Semester Health ───────────────────── */}
        <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.md }}>
          <AcademicHealthCard />
        </View>

        <View style={styles.footer} />
      </ScrollView>

      {/* ─── Class Session Modal ─────────────────── */}
      {selectedSessionForModal && (
        <ClassSessionModal
          visible={Boolean(selectedSessionForModal)}
          onClose={() => setSelectedSessionForModal(null)}
          slotId={selectedSessionForModal.slotId}
          date={selectedSessionForModal.date}
          subjectId={selectedSessionForModal.subjectId}
          startTime={selectedSessionForModal.startTime || ''}
          endTime={selectedSessionForModal.endTime || ''}
        />
      )}

      {/* ─── Notification Settings Modal ─────────── */}
      <NotificationSettingsModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />

      {/* ─── Account & Cloud Sync Modal ──────────── */}
      <AccountSettingsModal
        visible={accountModalVisible}
        onClose={() => setAccountModalVisible(false)}
      />

      {/* ─── AI Academic Assistant Modal ─────────── */}
      <AIAssistantModal
        visible={showAIModal}
        onClose={() => setShowAIModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Timeline Row Component ─────────────────────────────────────

function TimelineRow({
  event,
  isLast,
  colors,
  isDark,
  onPress,
}: {
  event: TimelineEvent;
  isLast: boolean;
  colors: any;
  isDark: boolean;
  onPress: () => void;
}) {
  const isActive = event.isCurrent;
  const isPast = event.isPast;

  return (
    <Pressable onPress={onPress} style={styles.timelineRow}>
      {/* Time column */}
      <View style={styles.timeColumn}>
        <Text style={[
          styles.timeText,
          { color: isActive ? '#00E5FF' : isPast ? colors.textTertiary : colors.textSecondary },
        ]}>
          {formatTime(event.startTime)}
        </Text>
      </View>

      {/* Indicator line */}
      <View style={styles.indicatorColumn}>
        <View style={[
          styles.indicatorDot,
          {
            backgroundColor: isActive
              ? '#00E5FF'
              : isPast
                ? colors.textTertiary
                : event.color || colors.textSecondary,
            width: isActive ? 10 : 8,
            height: isActive ? 10 : 8,
            borderRadius: isActive ? 5 : 4,
          },
        ]} />
        {!isLast && (
          <View style={[
            styles.indicatorLine,
            {
              backgroundColor: isPast
                ? colors.border
                : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
            },
          ]} />
        )}
      </View>

      {/* Content */}
      <View style={[
        styles.timelineContent,
        isActive && {
          backgroundColor: isDark ? 'rgba(0, 229, 255, 0.08)' : 'rgba(124, 58, 237, 0.06)',
          borderRadius: radii.lg,
          borderLeftWidth: 3,
          borderLeftColor: '#00E5FF',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(0, 229, 255, 0.28)' : 'rgba(124, 58, 237, 0.12)',
          paddingLeft: 12,
          paddingVertical: 8,
          paddingRight: 10,
        },
      ]}>
        <Text style={[
          styles.timelineTitle,
          {
            color: isPast ? colors.textTertiary : colors.text,
            textDecorationLine: isPast ? 'line-through' : 'none',
          },
        ]}>
          {event.title}
          {event.isNext && ' ←'}
        </Text>
        {event.subtitle && (
          <Text style={[styles.timelineSub, { color: colors.textTertiary }]}>
            {event.subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Attention Row Component ────────────────────────────────────

function AttentionRow({
  item,
  colors,
  isDark,
}: {
  item: AttentionItem;
  colors: any;
  isDark: boolean;
}) {
  const severityConfig = {
    danger: {
      bg: isDark ? 'rgba(239, 68, 68, 0.09)' : 'rgba(239, 68, 68, 0.06)',
      border: isDark ? 'rgba(239, 68, 68, 0.24)' : 'rgba(239, 68, 68, 0.18)',
      color: status.danger,
    },
    warning: {
      bg: isDark ? 'rgba(245, 158, 11, 0.09)' : 'rgba(245, 158, 11, 0.06)',
      border: isDark ? 'rgba(245, 158, 11, 0.24)' : 'rgba(245, 158, 11, 0.18)',
      color: status.watch,
    },
    info: {
      bg: isDark ? 'rgba(59, 130, 246, 0.09)' : 'rgba(59, 130, 246, 0.06)',
      border: isDark ? 'rgba(59, 130, 246, 0.24)' : 'rgba(59, 130, 246, 0.18)',
      color: status.info,
    },
  };

  const config = severityConfig[item.severity];

  return (
    <View
      style={[
        styles.attentionRow,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              } as any)
            : {}),
        },
      ]}
    >
      <View style={[styles.attentionDot, { backgroundColor: config.color }]} />
      <View style={styles.attentionContent}>
        <Text style={[styles.attentionTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.attentionSub, { color: config.color }]}>
          {item.subtitle}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070B',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
  date: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.medium,
    marginTop: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: brand.violet,
  },

  // Hero
  heroSection: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  heroLabel: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.xs + 2,
    textTransform: 'uppercase',
  },
  heroGlowWrapper: {
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: 4,
    left: 12,
    right: 12,
    bottom: 4,
    borderRadius: radii['2xl'],
    ...(Platform.OS === 'web'
      ? {
          filter: 'blur(20px)',
          WebkitFilter: 'blur(20px)',
        }
      : {}),
  },
  heroCard: {
    padding: spacing.base + 2,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  subjectDot: {
    width: 4,
    height: 44,
    borderRadius: 2,
  },
  heroInfo: {
    flex: 1,
  },
  heroSubject: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  heroTime: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginTop: 2,
  },
  heroRoom: {
    fontSize: typography.sizes.xs + 1,
    marginTop: 2,
  },
  heroRight: {
    marginLeft: spacing.md,
  },
  heroAttendance: {
    alignItems: 'center',
    gap: 6,
  },

  // No class
  noClassContent: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: 10,
  },
  noClassIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  noClassTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },

  // 3D Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.base,
    marginVertical: spacing.xs,
  },

  // Timeline
  timeline: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 52,
    alignItems: 'flex-start',
  },
  timeColumn: {
    width: 64,
    paddingTop: 2,
  },
  timeText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.semibold,
    fontVariant: ['tabular-nums'],
  },
  indicatorColumn: {
    width: 20,
    alignItems: 'center',
    paddingTop: 5,
  },
  indicatorDot: {
    zIndex: 1,
  },
  indicatorLine: {
    width: 1.5,
    flex: 1,
    marginTop: 4,
    marginBottom: -4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.md,
    paddingLeft: spacing.sm,
  },
  timelineTitle: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: typography.weights.semibold,
  },
  timelineSub: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },

  // Attention
  attentionContainer: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  attentionIcon: {
    fontSize: 14,
  },
  attentionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  attentionContent: {
    flex: 1,
  },
  attentionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  attentionSub: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginTop: 2,
  },

  // Tasks
  tasksContainer: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  taskCard: {
    padding: spacing.md,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  taskDot: {
    width: 4,
    height: 26,
    borderRadius: 2,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  taskMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  urgentDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  footer: {
    height: spacing['2xl'],
  },

  // Notification Button
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Workload
  workloadSection: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  workloadCard: {
    padding: spacing.base,
    borderRadius: radii.lg,
  },
  workloadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workloadLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  workloadTime: {
    fontSize: typography.sizes.xl,
    fontWeight: '800',
    marginTop: 2,
  },
  workloadStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  workloadStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  workloadStatNumber: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  workloadStatLabel: {
    fontSize: typography.sizes.xs,
  },

  // Escape The Matrix Playground Card
  playgroundSection: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.md,
  },
  playgroundCard: {
    backgroundColor: '#0A0F1A',
    borderColor: 'rgba(177, 250, 99, 0.25)',
    borderWidth: 1,
    borderRadius: radii.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  playgroundGlowLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: '#B1FA63',
    opacity: 0.8,
  },
  playgroundInner: {
    padding: spacing.base,
  },
  playgroundTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  playgroundTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(177, 250, 99, 0.1)',
    borderColor: 'rgba(177, 250, 99, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  playgroundTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B1FA63',
  },
  playgroundTagText: {
    color: '#B1FA63',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  playgroundStreakBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  playgroundStreakText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  playgroundTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  playgroundTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 3,
  },
  playgroundSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  playgroundIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(177, 250, 99, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(177, 250, 99, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playgroundFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  playgroundEloPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
    borderColor: 'rgba(0, 217, 255, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  playgroundEloText: {
    color: '#00D9FF',
    fontSize: 11,
    fontWeight: '800',
  },
  playgroundLaunchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#B1FA63',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  playgroundLaunchText: {
    color: '#05070B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
