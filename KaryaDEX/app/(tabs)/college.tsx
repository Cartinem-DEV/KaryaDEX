/**
 * BunkMatKar — COLLEGE Screen
 * 
 * Visual redesign with layered glass surfaces:
 * - Primary glass semester card
 * - Secondary glass subject grid with attendance & lab status
 * - Translucent upcoming exam cards with urgency badges
 * - Clean pending lab cards
 */

import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import {
  GlassCard, SectionHeader, StatusBadge,
  AmbientBackground, LuminousButton,
} from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';
import { daysUntil, formatDueDate } from '@/lib/timeUtils';
import { calculatePercentage, getAttendanceStatus } from '@/lib/attendance';
import {
  SemesterSwitcher,
  ArchiveManagerModal,
  RevisionHubModal,
  ExamSprintModal,
  TopicDetailModal,
} from '@/components/academic';
import { SyncStatusBadge } from '@/components/ui/SyncStatusBadge';
import { AccountSettingsModal } from '@/components/auth/AccountSettingsModal';
import { SparklesIcon } from '@/components/ui/AcademicIcons';
import { AIAssistantModal } from '@/components/ai/AIAssistantModal';

export default function CollegeScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const {
    semester, subjects, exams, labs, marks,
    attendanceData, attendanceTarget, college,
  } = useAppStore();

  // Upcoming exams sorted by date
  const upcomingExams = exams
    .filter(e => daysUntil(e.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  // Pending labs
  const pendingLabs = labs.filter(l => !l.isCompleted);
  const [archiveModalVisible, setArchiveModalVisible] = React.useState(false);
  const [revisionHubVisible, setRevisionHubVisible] = React.useState(false);
  const [selectedExamId, setSelectedExamId] = React.useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = React.useState<string | null>(null);
  const [accountModalVisible, setAccountModalVisible] = React.useState(false);
  const [aiModalVisible, setAiModalVisible] = React.useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Subtle atmospheric background orbs */}
      <AmbientBackground forceDark />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header ─────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : colors.text }]}>College</Text>
            <Text style={[styles.collegeName, { color: colors.textSecondary }]}>
              {college?.name || 'Example Institute of Technology'}
            </Text>
          </View>
          <SyncStatusBadge compact onPress={() => setAccountModalVisible(true)} />
        </View>

        {/* ─── Semester Info ──────────────────────── */}
        <View style={styles.section}>
          <GlassCard level="primary" style={styles.semesterCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.semesterLabel, { color: isDark ? '#00E5FF' : brand.violet }]}>
                CURRENT SEMESTER
              </Text>
              <SemesterSwitcher compact />
            </View>
            <Text style={[styles.semesterName, { color: isDark ? '#FFFFFF' : colors.text }]}>
              {semester?.name || 'Semester 3'}
            </Text>
            <View style={styles.semesterMeta}>
              <Text style={[styles.semesterMetaText, { color: colors.textSecondary }]}>
                {subjects.length} subjects · {exams.length} exams · {labs.length} labs
              </Text>
            </View>
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
              <Pressable
                onPress={() => setAiModalVisible(true)}
                style={({ pressed }) => [
                  styles.bankuImportChip,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <SparklesIcon size={14} color="#00E5FF" />
                <Text style={styles.bankuImportChipText}>
                  Import Syllabus / Calendar with Banku
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>

        {/* ─── Student Account & Backup Banner ──────────── */}
        <View style={styles.section}>
          <Pressable onPress={() => setAccountModalVisible(true)}>
            <GlassCard level="secondary" style={styles.revisionBanner}>
              <View style={styles.revisionBannerContent}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.revisionBannerKicker, { color: isDark ? '#F59E0B' : brand.indigo }]}>
                    ACCOUNT & DATA BACKUP
                  </Text>
                  <Text style={[styles.revisionBannerTitle, { color: colors.text }]}>
                    Account & Profile Settings
                  </Text>
                  <Text style={[styles.revisionBannerSub, { color: colors.textSecondary }]}>
                    Manage your profile, study sync, and multi-device cloud backup
                  </Text>
                </View>
                <View style={[styles.revisionHubPill, {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.16)' : brand.indigo,
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.40)' : 'rgba(255, 255, 255, 0.2)',
                }]}>
                  <Text style={[styles.revisionHubPillText, { color: isDark ? '#F59E0B' : '#FFF' }]}>Settings →</Text>
                </View>
              </View>
            </GlassCard>
          </Pressable>
        </View>

        {/* ─── Revision Intelligence Hub Banner ──────────────── */}
        <View style={styles.section}>
          <Pressable onPress={() => setRevisionHubVisible(true)}>
            <GlassCard level="secondary" style={styles.revisionBanner}>
              <View style={styles.revisionBannerContent}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.revisionBannerKicker, { color: isDark ? '#00E5FF' : brand.violet }]}>
                    REVISION INTELLIGENCE
                  </Text>
                  <Text style={[styles.revisionBannerTitle, { color: colors.text }]}>
                    Revision Hub & Exam Sprint
                  </Text>
                  <Text style={[styles.revisionBannerSub, { color: colors.textSecondary }]}>
                    Track topic confidence, review history, and upcoming sprint workload
                  </Text>
                </View>
                <View style={[styles.revisionHubPill, {
                  backgroundColor: isDark ? 'rgba(0, 229, 255, 0.16)' : brand.violet,
                  borderColor: isDark ? 'rgba(0, 229, 255, 0.40)' : 'rgba(255, 255, 255, 0.2)',
                }]}>
                  <Text style={[styles.revisionHubPillText, { color: isDark ? '#00E5FF' : '#FFF' }]}>Open Hub →</Text>
                </View>
              </View>
            </GlassCard>
          </Pressable>
        </View>

        {/* ─── Subjects ──────────────────────────── */}
        <SectionHeader
          title="SUBJECTS"
          subtitle={`${subjects.length} enrolled`}
          actionLabel="Archived"
          onAction={() => setArchiveModalVisible(true)}
        />
        <View style={styles.subjectGrid}>
          {subjects.map((subject) => {
            const data = attendanceData[subject.id];
            const percentage = data ? calculatePercentage(data.attended, data.total) : 0;
            const attStatus = data ? getAttendanceStatus(percentage, attendanceTarget) : 'danger';
            const subjectLabs = labs.filter(l => l.subjectId === subject.id);
            const completedLabs = subjectLabs.filter(l => l.isCompleted).length;

            return (
              <Pressable
                key={subject.id}
                onPress={() => router.push(`/subject/${subject.id}`)}
                style={({ pressed }) => [
                  styles.subjectCardWrapper,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View
                  style={[
                    styles.subjectCard,
                    {
                      backgroundColor: isDark
                        ? 'rgba(22, 23, 34, 0.48)'
                        : 'rgba(255, 255, 255, 0.52)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.10)'
                        : 'rgba(255, 255, 255, 0.75)',
                      position: 'relative',
                    },
                    Platform.OS === 'web' &&
                      ({
                        backdropFilter: 'blur(18px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                        boxShadow: isDark
                          ? '0 8px 24px -2px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                          : '0 8px 20px -2px rgba(15, 23, 42, 0.05), inset 0 1px 0.5px rgba(255, 255, 255, 0.95)',
                      } as any),
                  ]}
                >
                  {/* Top Specular Rim */}
                  <View
                    pointerEvents="none"
                    style={[
                      styles.cardSpecular,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.14)'
                          : 'rgba(255, 255, 255, 0.92)',
                      },
                    ]}
                  />
                  <View style={styles.subjectHeader}>
                    <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
                    <Text style={[styles.subjectCode, { color: colors.textTertiary }]}>
                      {subject.code}
                    </Text>
                  </View>

                  <Text style={[styles.subjectName, { color: colors.text }]} numberOfLines={1}>
                    {subject.shortName}
                  </Text>

                  <View style={styles.subjectStats}>
                    {data && (
                      <View style={styles.subjectStat}>
                        <Text
                          style={[
                            styles.statValue,
                            {
                              color:
                                attStatus === 'safe'
                                  ? statusColors.safe
                                  : attStatus === 'watch'
                                    ? statusColors.watch
                                    : statusColors.danger,
                            },
                          ]}
                        >
                          {percentage.toFixed(0)}%
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                          attendance
                        </Text>
                      </View>
                    )}
                    {subjectLabs.length > 0 && (
                      <View style={styles.subjectStat}>
                        <Text style={[styles.statValue, { color: colors.text }]}>
                          {completedLabs}/{subjectLabs.length}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                          labs
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.subjectFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="map-pin" size={10} color={colors.textTertiary} />
                      <Text style={[styles.subjectRoom, { color: colors.textTertiary }]}>
                        {subject.room}
                      </Text>
                    </View>
                    <StatusBadge variant={attStatus} size="sm" />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ─── Upcoming Exams ────────────────────── */}
        {upcomingExams.length > 0 && (
          <>
            <SectionHeader title="UPCOMING EXAMS" />
            <View style={styles.examList}>
              {upcomingExams.map((exam) => {
                const subject = subjects.find(s => s.id === exam.subjectId);
                const days = daysUntil(exam.date);

                return (
                  <Pressable
                    key={exam.id}
                    onPress={() => setSelectedExamId(exam.id)}
                    style={({ pressed }) => [
                      styles.examCard,
                      {
                        backgroundColor: isDark
                          ? 'rgba(22, 23, 34, 0.48)'
                          : 'rgba(255, 255, 255, 0.52)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.10)'
                          : 'rgba(255, 255, 255, 0.75)',
                        position: 'relative',
                      },
                      Platform.OS === 'web' &&
                        ({
                          backdropFilter: 'blur(18px) saturate(180%)',
                          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                          boxShadow: isDark
                            ? '0 6px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.10)'
                            : '0 6px 16px rgba(15, 23, 42, 0.04), inset 0 1px 0.5px rgba(255, 255, 255, 0.90)',
                        } as any),
                      pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    {/* Top Specular Rim */}
                    <View
                      pointerEvents="none"
                      style={[
                        styles.cardSpecular,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(255, 255, 255, 0.90)',
                        },
                      ]}
                    />
                    <View style={[styles.examDot, { backgroundColor: subject?.color || '#666' }]} />
                    <View style={styles.examInfo}>
                      <Text style={[styles.examName, { color: colors.text }]}>
                        {subject?.shortName} — {exam.name}
                      </Text>
                      <Text style={[styles.examMeta, { color: colors.textTertiary }]}>
                        {exam.type} · {exam.maxMarks} marks
                        {exam.room ? ` · Room ${exam.room}` : ''}
                      </Text>
                    </View>
                    <View style={styles.examDays}>
                      <Text
                        style={[
                          styles.examDaysValue,
                          {
                            color:
                              days <= 3
                                ? statusColors.danger
                                : days <= 7
                                  ? statusColors.watch
                                  : colors.text,
                          },
                        ]}
                      >
                        {days}
                      </Text>
                      <Text style={[styles.examDaysLabel, { color: colors.textTertiary }]}>
                        days left
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* ─── Pending Labs ──────────────────────── */}
        {pendingLabs.length > 0 && (
          <>
            <SectionHeader title="PENDING LABS" subtitle={`${pendingLabs.length} remaining`} />
            <View style={styles.labList}>
              {pendingLabs.map((lab) => {
                const subject = subjects.find(s => s.id === lab.subjectId);
                return (
                  <View
                    key={lab.id}
                    style={[
                      styles.labCard,
                      {
                        backgroundColor: isDark
                          ? 'rgba(22, 23, 34, 0.48)'
                          : 'rgba(255, 255, 255, 0.52)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.10)'
                          : 'rgba(255, 255, 255, 0.75)',
                        position: 'relative',
                      },
                      Platform.OS === 'web' &&
                        ({
                          backdropFilter: 'blur(18px) saturate(180%)',
                          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                          boxShadow: isDark
                            ? '0 6px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.10)'
                            : '0 6px 16px rgba(15, 23, 42, 0.04), inset 0 1px 0.5px rgba(255, 255, 255, 0.90)',
                        } as any),
                    ]}
                  >
                    {/* Top Specular Rim */}
                    <View
                      pointerEvents="none"
                      style={[
                        styles.cardSpecular,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(255, 255, 255, 0.90)',
                        },
                      ]}
                    />
                    <Text style={[styles.labNumber, { color: subject?.color || brand.violet }]}>
                      Lab {lab.labNumber}
                    </Text>
                    <Text style={[styles.labTitle, { color: colors.text }]}>
                      {lab.title}
                    </Text>
                    <Text style={[styles.labMeta, { color: colors.textTertiary }]}>
                      {subject?.shortName}
                      {lab.dueDate ? ` · Due ${formatDueDate(lab.dueDate)}` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      <ArchiveManagerModal
        visible={archiveModalVisible}
        onClose={() => setArchiveModalVisible(false)}
      />

      <RevisionHubModal
        visible={revisionHubVisible}
        onClose={() => setRevisionHubVisible(false)}
        onSelectTopic={(tId) => setSelectedTopicId(tId)}
        onSelectExam={(eId) => setSelectedExamId(eId)}
      />

      <ExamSprintModal
        visible={Boolean(selectedExamId)}
        onClose={() => setSelectedExamId(null)}
        examId={selectedExamId}
        onSelectTopic={(tId) => setSelectedTopicId(tId)}
      />

      <TopicDetailModal
        visible={Boolean(selectedTopicId)}
        onClose={() => setSelectedTopicId(null)}
        topicId={selectedTopicId}
      />

      <AccountSettingsModal
        visible={accountModalVisible}
        onClose={() => setAccountModalVisible(false)}
      />

      <AIAssistantModal
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
        initialPersona="banku"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070B' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 110 },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
  collegeName: {
    fontSize: typography.sizes.xs + 1,
    marginTop: 2,
    fontWeight: typography.weights.medium,
  },
  section: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  semesterCard: { padding: spacing.base + 2 },
  semesterLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  semesterName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  semesterMeta: { marginTop: 4 },
  semesterMetaText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.medium,
  },

  // Subject grid
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  subjectCardWrapper: {
    width: '47.5%',
  },
  subjectCard: {
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardSpecular: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    opacity: 0.85,
    borderRadius: 1,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs + 2,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subjectCode: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.5,
  },
  subjectName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  subjectStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  subjectStat: {},
  statValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 9,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subjectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectRoom: {
    fontSize: typography.sizes.xs,
  },

  // Exams
  examList: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  examDot: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  examInfo: { flex: 1 },
  examName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  examMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  examDays: { alignItems: 'center' },
  examDaysValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  examDaysLabel: {
    fontSize: 9,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
  },

  // Labs
  labList: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  labCard: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  labNumber: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  labTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  labMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },

  // Revision Banner Styles
  revisionBanner: { padding: spacing.md, borderRadius: radii.xl },
  revisionBannerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  revisionBannerKicker: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  revisionBannerTitle: { fontSize: typography.sizes.base, fontWeight: '700', marginTop: 2 },
  revisionBannerSub: { fontSize: typography.sizes.xs, marginTop: 2 },
  revisionHubPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  revisionHubPillText: { color: '#FFF', fontSize: typography.sizes.xs, fontWeight: '700' },

  // Banku Import Chip
  bankuImportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.28)',
    alignSelf: 'flex-start',
  },
  bankuImportChipText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
  },
});
