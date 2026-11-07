/**
 * BunkMatKar — Subject Hub (Detail Page) — Phase 6
 * 
 * Upgraded Academic Command Center with 8 canonical tabs:
 * 1. OVERVIEW: Attendance ring, what-if simulator, quick stats, archive subject
 * 2. SYLLABUS: Deep unit/topic hierarchy with revision tracking & topic detail modal
 * 3. CLASSES: Chronological class sessions with journal & attendance indicators
 * 4. NOTES: Occurrence-bound journal records (my notes & teacher notes)
 * 5. TASKS: Relational tasks with pending/completed toggles
 * 6. EXAMS: Exam schedule, countdown, and topics
 * 7. RESOURCES: Study material, syllabus links, references
 * 8. MARKS: Assessment breakdown, weightages, grade point calculation
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import {
  GlassCard, StatusBadge, AttendanceRing,
  SectionHeader, EmptyState, AmbientBackground,
} from '@/components/ui';
import {
  SubjectSyllabusView,
  SubjectHistoryView,
  SubjectGradesView,
  SubjectResourcesView,
  AttendanceForecastCard,
  TopicDetailModal,
  ExamSprintModal,
  RevisionHubModal,
  AttendanceIntelligenceModal,
} from '@/components/academic';
import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';
import { examSprintService } from '@/services/examSprintService';
import { revisionIntelligenceService } from '@/services/revisionIntelligenceService';
import { subjectRepository } from '@/database/repositories/subjectRepository';
import { calculatePercentage, getAttendanceStatus, calculateSafeBunks, calculateRecoveryClasses } from '@/lib/attendance';
import { formatDueDate, daysUntil } from '@/lib/timeUtils';

type SubjectTabKey = 'overview' | 'syllabus' | 'classes' | 'notes' | 'tasks' | 'exams' | 'resources' | 'marks';

const TABS: { key: SubjectTabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'syllabus', label: 'Syllabus' },
  { key: 'classes', label: 'Classes' },
  { key: 'notes', label: 'Notes' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'exams', label: 'Exams' },
  { key: 'resources', label: 'Resources' },
  { key: 'marks', label: 'Marks' },
];

export default function SubjectHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SubjectTabKey>('overview');
  const [isArchiving, setIsArchiving] = useState(false);
  const [sprintExamId, setSprintExamId] = useState<string | null>(null);
  const [isRevisionHubOpen, setIsRevisionHubOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  const {
    subjects, faculty, attendanceData, attendanceTarget,
    tasks, exams, marks, labs, classSessions, toggleTask, refreshFromDatabase,
  } = useAppStore();

  const { classNotes, topics } = useAcademicStore();

  const subject = subjects.find(s => s.id === id);
  if (!subject) {
    return (
      <SafeAreaView style={styles.container}>
        <AmbientBackground />
        <EmptyState icon={<Feather name="help-circle" size={32} color="#00E5FF" />} title="Subject not found" />
      </SafeAreaView>
    );
  }

  const prof = faculty.find(f => f.id === subject.facultyId);
  const attData = attendanceData[subject.id] || { attended: 0, total: 0 };
  const target = subject.targetAttendance || attendanceTarget;
  const percentage = calculatePercentage(attData.attended, attData.total);
  const attStatus = getAttendanceStatus(percentage, target);
  const safeBunks = calculateSafeBunks(attData.attended, attData.total, target);
  const recovery = calculateRecoveryClasses(attData.attended, attData.total, target);

  const subjectTasks = tasks.filter(t => t.subjectId === subject.id);
  const pendingTasks = subjectTasks.filter(t => !t.isCompleted);
  const completedTasks = subjectTasks.filter(t => t.isCompleted);

  const subjectExams = exams.filter(e => e.subjectId === subject.id);
  const upcomingExams = subjectExams.filter(e => daysUntil(e.date) >= 0);

  const subjectNotes = classNotes.filter(cn => cn.subjectId === subject.id);
  const subjectTopics = topics.filter(top => top.subjectId === subject.id);
  const taughtTopics = subjectTopics.filter(top => top.revisionStatus === 'taught' || top.revisionStatus === 'revised');

  const weeklyClasses = classSessions.filter(cs => cs.subjectId === subject.id).length;

  const handleArchiveSubject = async () => {
    Alert.alert(
      'Archive Subject',
      `Archive "${subject.name}"? All past attendance, class sessions, notes, tasks, and marks will be preserved and can be restored anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsArchiving(true);
              await subjectRepository.archiveSubject(subject.id);
              await refreshFromDatabase();
              router.back();
            } catch (err) {
              console.error('Failed to archive subject:', err);
              setIsArchiving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AmbientBackground />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Back + Header ─────────────────────── */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="arrow-left" size={16} color="#00E5FF" />
              <Text style={[styles.backText, { color: '#00E5FF' }]}>Back</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handleArchiveSubject}
            disabled={isArchiving}
            accessibilityRole="button"
            accessibilityLabel={`Archive ${subject.name}`}
            style={({ pressed }) => [
              styles.archiveBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="archive" size={13} color={colors.textTertiary} />
              <Text style={[styles.archiveBtnText, { color: colors.textTertiary }]}>
                Archive
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ─── Subject Header ────────────────────── */}
        <View style={styles.subjectHeader}>
          <View style={[styles.colorBar, { backgroundColor: subject.color }]} />
          <View style={styles.subjectInfo}>
            <Text style={[styles.subjectName, { color: colors.text }]}>
              {subject.name}
            </Text>
            <Text style={[styles.subjectCode, { color: colors.textTertiary }]}>
              {subject.code} · {subject.credits} credits · {subject.subjectType || 'lecture'}
            </Text>
            {prof && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <Feather name="user" size={12} color={colors.textSecondary} />
                <Text style={[styles.profName, { color: colors.textSecondary }]}>
                  {prof.name}
                </Text>
              </View>
            )}
            {subject.room && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <Feather name="map-pin" size={12} color={colors.textTertiary} />
                <Text style={[styles.roomText, { color: colors.textTertiary }]}>
                  Room {subject.room} · {weeklyClasses} classes/week
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── Navigation Tabs (8 Canonical Tabs) ─── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabPill,
                  isActive && {
                    backgroundColor: isDark ? 'rgba(0, 229, 255, 0.16)' : 'rgba(0, 229, 255, 0.12)',
                    borderColor: '#00E5FF',
                  },
                  !isActive && {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    { color: isActive ? (isDark ? '#E0F7FA' : '#00E5FF') : colors.textSecondary },
                    isActive && { fontWeight: '700' },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ══════════ TAB 1: OVERVIEW ══════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Attendance Card */}
            <View style={styles.section}>
              <Pressable
                onPress={() => setIsAttendanceModalOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Open attendance intelligence details"
              >
                <GlassCard level="primary" style={styles.attendanceCard}>
                  <View style={styles.attendanceRow}>
                    <AttendanceRing
                      percentage={percentage}
                      size={76}
                      strokeWidth={5.5}
                      attendanceStatus={attStatus}
                    />
                    <View style={styles.attendanceInfo}>
                      <View style={styles.attendanceHeader}>
                        <Text style={[styles.attendancePercent, { color: colors.text }]}>
                          {percentage.toFixed(1)}%
                        </Text>
                        <StatusBadge variant={attStatus} size="md" />
                      </View>
                      <Text style={[styles.attendanceMeta, { color: colors.textSecondary }]}>
                        {attData.attended} present · {attData.total - attData.attended} absent · {attData.total} total
                      </Text>
                      {safeBunks > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                          <Feather name="shield" size={12} color={statusColors.safe} />
                          <Text style={[styles.safeBunksText, { color: statusColors.safe, marginTop: 0 }]}>
                            {safeBunks} bunks available · Tap for intelligence →
                          </Text>
                        </View>
                      )}
                      {recovery > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                          <Feather name="alert-triangle" size={12} color={statusColors.danger} />
                          <Text style={[styles.recoveryText, { color: statusColors.danger, marginTop: 0 }]}>
                            Need {recovery} consecutive classes to recover →
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            </View>

            {/* Quick Stat Pills */}
            <View style={styles.quickStats}>
              <StatCard
                label="Tasks"
                value={`${completedTasks.length}/${subjectTasks.length}`}
                color={brand.violet}
                colors={colors}
                isDark={isDark}
              />
              <StatCard
                label="Syllabus"
                value={`${taughtTopics.length}/${subjectTopics.length}`}
                color="#10B981"
                colors={colors}
                isDark={isDark}
              />
              <StatCard
                label="Notes"
                value={`${subjectNotes.length}`}
                color="#6366F1"
                colors={colors}
                isDark={isDark}
              />
              {upcomingExams.length > 0 && (
                <StatCard
                  label="Exam"
                  value={`${daysUntil(upcomingExams[0].date)}d`}
                  color={statusColors.danger}
                  colors={colors}
                  isDark={isDark}
                />
              )}
            </View>

            {/* Attendance What-If Simulator Card */}
            <View style={styles.section}>
              <AttendanceForecastCard
                subjectName={subject.name}
                subjectId={subject.id}
                attended={attData.attended}
                total={attData.total}
                target={target}
                onOpenIntelligence={() => setIsAttendanceModalOpen(true)}
              />
            </View>

            {/* Revision Intelligence & Readiness Card */}
            <View style={styles.section}>
              <GlassCard level="primary" style={styles.revisionCard}>
                <View style={styles.revCardHeader}>
                  <View>
                    <Text style={[styles.revCardKicker, { color: brand.violet }]}>REVISION INTELLIGENCE</Text>
                    <Text style={[styles.revCardTitle, { color: colors.text }]}>Syllabus Revision Progress</Text>
                  </View>
                  <Pressable
                    onPress={() => setIsRevisionHubOpen(true)}
                    style={[styles.revHubBtn, { backgroundColor: brand.violet + '20' }]}
                  >
                    <Text style={[styles.revHubBtnText, { color: brand.violet }]}>Revision Hub →</Text>
                  </Pressable>
                </View>

                <View style={styles.revStatsRow}>
                  <View style={styles.revStatItem}>
                    <Text style={[styles.revStatVal, { color: colors.text }]}>{subjectTopics.length}</Text>
                    <Text style={[styles.revStatLbl, { color: colors.textTertiary }]}>Topics</Text>
                  </View>
                  <View style={styles.revStatItem}>
                    <Text style={[styles.revStatVal, { color: '#3B82F6' }]}>{taughtTopics.length}</Text>
                    <Text style={[styles.revStatLbl, { color: colors.textTertiary }]}>Taught</Text>
                  </View>
                  <View style={styles.revStatItem}>
                    <Text style={[styles.revStatVal, { color: statusColors.safe }]}>
                      {subjectTopics.filter(t => t.revisionStatus === 'revised').length}
                    </Text>
                    <Text style={[styles.revStatLbl, { color: colors.textTertiary }]}>Revised</Text>
                  </View>
                  <View style={styles.revStatItem}>
                    <Text style={[styles.revStatVal, { color: statusColors.danger }]}>
                      {subjectTopics.filter(t => t.revisionStatus === 'needs_revision').length}
                    </Text>
                    <Text style={[styles.revStatLbl, { color: colors.textTertiary }]}>Needs Rev</Text>
                  </View>
                </View>

                {upcomingExams.length > 0 && (
                  <Pressable
                    onPress={() => setSprintExamId(upcomingExams[0].id)}
                    style={[styles.sprintCardAction, { backgroundColor: brand.violet }]}
                  >
                    <Text style={styles.sprintCardActionText}>
                      Open Exam Sprint Plan ({upcomingExams[0].name}) →
                    </Text>
                  </Pressable>
                )}
              </GlassCard>
            </View>

            {/* Subject Academic Planning & Schedule Card */}
            <View style={styles.section}>
              <GlassCard level="primary" style={styles.revisionCard}>
                <View style={styles.revCardHeader}>
                  <View>
                    <Text style={[styles.revCardKicker, { color: brand.violet }]}>ACADEMIC PLANNING</Text>
                    <Text style={[styles.revCardTitle, { color: colors.text }]}>Schedule & Commitments</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/(tabs)/schedule')}
                    style={[styles.revHubBtn, { backgroundColor: brand.violet + '20' }]}
                  >
                    <Text style={[styles.revHubBtnText, { color: brand.violet }]}>Calendar →</Text>
                  </Pressable>
                </View>

                <View style={styles.revStatsRow}>
                  <View style={styles.revStatItem}>
                    <Text style={[styles.revStatVal, { color: colors.text }]}>
                      {subjectTasks.filter(t => !t.isCompleted).length}
                    </Text>
                    <Text style={[styles.revStatLbl, { color: colors.textTertiary }]}>Pending Tasks</Text>
                  </View>
                  <View style={styles.revStatItem}>
                    <Text style={[styles.revStatVal, { color: brand.violet }]}>
                      {subjectTasks.filter(t => !t.isCompleted).reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0)}m
                    </Text>
                    <Text style={[styles.revStatLbl, { color: colors.textTertiary }]}>Workload</Text>
                  </View>
                  <View style={styles.revStatItem}>
                    <Text style={[styles.revStatVal, { color: upcomingExams.length > 0 ? statusColors.danger : colors.textTertiary }]}>
                      {upcomingExams.length}
                    </Text>
                    <Text style={[styles.revStatLbl, { color: colors.textTertiary }]}>Exams</Text>
                  </View>
                </View>
              </GlassCard>
            </View>
          </>
        )}

        {/* ══════════ TAB 2: SYLLABUS ══════════ */}
        {activeTab === 'syllabus' && (
          <View style={styles.tabSection}>
            <SubjectSyllabusView subjectId={subject.id} />
          </View>
        )}

        {/* ══════════ TAB 3: CLASSES (HISTORY) ══════════ */}
        {activeTab === 'classes' && (
          <View style={styles.tabSection}>
            <SubjectHistoryView subjectId={subject.id} />
          </View>
        )}

        {/* ══════════ TAB 4: NOTES ══════════ */}
        {activeTab === 'notes' && (
          <View style={styles.tabSection}>
            {subjectNotes.length === 0 ? (
              <EmptyState icon={<Feather name="file-text" size={32} color="#00E5FF" />} title="No class notes yet" subtitle="Notes recorded during or after classes will appear here." />
            ) : (
              <View style={styles.notesList}>
                {subjectNotes.map((note) => (
                  <GlassCard key={note.id} level="secondary" style={styles.noteCard}>
                    <View style={styles.noteHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Feather name="calendar" size={12} color={colors.textTertiary} />
                        <Text style={[styles.noteDate, { color: colors.textTertiary }]}>
                          {note.date}
                        </Text>
                      </View>
                      <View style={[styles.noteStatusPill, { backgroundColor: note.attendanceStatus === 'present' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                        <Text style={[styles.noteStatusText, { color: note.attendanceStatus === 'present' ? statusColors.safe : statusColors.danger }]}>
                          {note.attendanceStatus.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {note.myNotes ? (
                      <View style={styles.noteBodySection}>
                        <Text style={[styles.noteSectionTitle, { color: colors.textSecondary }]}>My Notes</Text>
                        <Text style={[styles.noteContent, { color: colors.text }]}>{note.myNotes}</Text>
                      </View>
                    ) : null}

                    {note.teacherNotes ? (
                      <View style={styles.noteBodySection}>
                        <Text style={[styles.noteSectionTitle, { color: brand.violet }]}>Teacher Notes</Text>
                        <Text style={[styles.noteContent, { color: colors.text }]}>{note.teacherNotes}</Text>
                      </View>
                    ) : null}

                    {!note.myNotes && !note.teacherNotes && (
                      <Text style={[styles.emptyNoteText, { color: colors.textTertiary }]}>
                        Class session recorded without text notes.
                      </Text>
                    )}
                  </GlassCard>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ══════════ TAB 5: TASKS ══════════ */}
        {activeTab === 'tasks' && (
          <View style={styles.tabSection}>
            {subjectTasks.length === 0 ? (
              <EmptyState icon={<Feather name="check-square" size={32} color="#00E5FF" />} title="No tasks for this subject" subtitle="Add tasks linked to this subject from the Tasks tab or Quick Add." />
            ) : (
              <View style={styles.taskList}>
                {subjectTasks.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => toggleTask(t.id)}
                    style={({ pressed }) => [
                      styles.taskItem,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                        opacity: t.isCompleted ? 0.6 : 1,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={[styles.taskCheckbox, { backgroundColor: t.isCompleted ? statusColors.safe : 'transparent', borderColor: t.isCompleted ? statusColors.safe : colors.textTertiary }]}>
                      {t.isCompleted && <Feather name="check" size={11} color="#FFFFFF" />}
                    </View>
                    <View style={styles.taskInfo}>
                      <Text style={[styles.taskTitle, { color: colors.text, textDecorationLine: t.isCompleted ? 'line-through' : 'none' }]}>
                        {t.title}
                      </Text>
                      <Text style={[styles.taskMeta, { color: colors.textTertiary }]}>
                        {t.category} {t.dueDate ? `· Due ${formatDueDate(t.dueDate)}` : ''} {t.estimatedMinutes ? `· ~${t.estimatedMinutes}m` : ''}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ══════════ TAB 6: EXAMS ══════════ */}
        {activeTab === 'exams' && (
          <View style={styles.tabSection}>
            {subjectExams.length === 0 ? (
              <EmptyState icon={<Feather name="target" size={32} color="#00E5FF" />} title="No exams scheduled" subtitle="Exams for this subject will be listed here once scheduled." />
            ) : (
              <View style={styles.examList}>
                {subjectExams.map((exam) => {
                  const readiness = examSprintService.getExamReadiness(exam.id);
                  return (
                    <GlassCard key={exam.id} level="secondary" style={styles.examCard}>
                      <View style={styles.examHeader}>
                        <Text style={[styles.examName, { color: colors.text }]}>{exam.name}</Text>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          {readiness && (
                            <View style={[styles.readinessPill, { backgroundColor: readiness.readinessPercentage >= 70 ? statusColors.safe + '20' : brand.violet + '20' }]}>
                              <Text style={[styles.readinessPillText, { color: readiness.readinessPercentage >= 70 ? statusColors.safe : brand.violet }]}>
                                {readiness.readinessPercentage}% Ready
                              </Text>
                            </View>
                          )}
                          <View style={styles.examDaysBadge}>
                            <Text style={styles.examDaysText}>{daysUntil(exam.date)}d left</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={[styles.examMeta, { color: colors.textTertiary }]}>
                        {exam.type} · Max {exam.maxMarks} marks · Date: {exam.date}
                        {exam.room ? ` · Room ${exam.room}` : ''}
                      </Text>

                      {readiness && (
                        <View style={styles.examReadinessInfo}>
                          <Text style={[styles.examReadinessDetail, { color: colors.textSecondary }]}>
                            {readiness.confidentTopics}/{readiness.taughtTopics} confident · ~{readiness.estimatedRevisionWorkloadMinutes}m workload
                          </Text>
                          <Pressable
                            onPress={() => setSprintExamId(exam.id)}
                            style={[styles.sprintBtnSmall, { backgroundColor: brand.violet + '20' }]}
                          >
                            <Text style={[styles.sprintBtnSmallText, { color: brand.violet }]}>
                              Exam Sprint Plan →
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </GlassCard>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ══════════ TAB 7: RESOURCES ══════════ */}
        {activeTab === 'resources' && (
          <View style={styles.tabSection}>
            <SubjectResourcesView subjectId={subject.id} />
          </View>
        )}

        {/* ══════════ TAB 8: MARKS ══════════ */}
        {activeTab === 'marks' && (
          <View style={styles.tabSection}>
            <SubjectGradesView subjectId={subject.id} />
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Phase 7 Modals */}
      <ExamSprintModal
        visible={Boolean(sprintExamId)}
        onClose={() => setSprintExamId(null)}
        examId={sprintExamId}
        onSelectTopic={(tId) => setSelectedTopicId(tId)}
      />

      <RevisionHubModal
        visible={isRevisionHubOpen}
        onClose={() => setIsRevisionHubOpen(false)}
        initialSubjectId={subject.id}
        onSelectTopic={(tId) => setSelectedTopicId(tId)}
        onSelectExam={(eId) => setSprintExamId(eId)}
      />

      <TopicDetailModal
        visible={Boolean(selectedTopicId)}
        onClose={() => setSelectedTopicId(null)}
        topicId={selectedTopicId}
      />

      <AttendanceIntelligenceModal
        visible={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        subjectId={subject.id}
      />
    </SafeAreaView>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────

function StatCard({
  label, value, color, colors, isDark,
}: {
  label: string; value: string; color: string; colors: any; isDark: boolean;
}) {
  return (
    <View
      style={[
        statStyles.card,
        {
          backgroundColor: isDark
            ? 'rgba(28, 30, 44, 0.68)'
            : 'rgba(255, 255, 255, 0.75)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.12)'
            : 'rgba(255, 255, 255, 0.90)',
          position: 'relative',
        },
      ]}
    >
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  value: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
});

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  tabBar: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  tabPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  tabPillText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.semibold,
  },
  tabSection: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.xs,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
  },
  backBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
  },
  backText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  archiveBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  archiveBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },

  subjectHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
  },
  subjectInfo: { flex: 1 },
  subjectName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  subjectCode: {
    fontSize: typography.sizes.xs + 1,
    marginTop: 2,
    fontWeight: typography.weights.medium,
  },
  profName: {
    fontSize: typography.sizes.sm,
    marginTop: 4,
  },
  roomText: {
    fontSize: typography.sizes.xs + 1,
    marginTop: 2,
  },

  section: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  attendanceCard: { padding: spacing.base + 2 },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  attendanceInfo: { flex: 1 },
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  attendancePercent: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  attendanceMeta: {
    fontSize: typography.sizes.xs + 1,
    marginTop: 3,
  },
  safeBunksText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.semibold,
    marginTop: 3,
  },
  recoveryText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },

  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },

  notesList: { gap: spacing.sm },
  noteCard: { padding: spacing.md, borderRadius: radii.lg },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  noteDate: { fontSize: typography.sizes.xs },
  noteStatusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm },
  noteStatusText: { fontSize: 10, fontWeight: '700' },
  noteBodySection: { marginTop: spacing.xs },
  noteSectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  noteContent: { fontSize: typography.sizes.base, lineHeight: 20 },
  emptyNoteText: { fontSize: typography.sizes.xs, fontStyle: 'italic', marginTop: 4 },

  taskList: { gap: spacing.xs },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  taskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheck: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: typography.sizes.base, fontWeight: '600' },
  taskMeta: { fontSize: typography.sizes.xs, marginTop: 2 },

  examList: { gap: spacing.sm },
  examCard: { padding: spacing.md, borderRadius: radii.lg },
  examHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  examName: { fontSize: typography.sizes.base, fontWeight: '700' },
  examDaysBadge: { backgroundColor: brand.violet, paddingHorizontal: spacing.xs + 2, paddingVertical: 2, borderRadius: radii.sm },
  examDaysText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  examMeta: { fontSize: typography.sizes.xs, marginTop: 4 },

  // Phase 7 Revision styles
  revisionCard: { padding: spacing.md, borderRadius: radii.lg, gap: spacing.sm },
  revCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  revCardKicker: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  revCardTitle: { fontSize: typography.sizes.sm + 1, fontWeight: '700', marginTop: 2 },
  revHubBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.sm },
  revHubBtnText: { fontSize: typography.sizes.xs, fontWeight: '700' },
  revStatsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  revStatItem: { alignItems: 'center' },
  revStatVal: { fontSize: typography.sizes.base, fontWeight: '700' },
  revStatLbl: { fontSize: 10, marginTop: 2 },
  sprintCardAction: { paddingVertical: 8, borderRadius: radii.sm, alignItems: 'center', marginTop: 4 },
  sprintCardActionText: { color: '#FFF', fontSize: typography.sizes.xs + 1, fontWeight: '700' },
  readinessPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.sm },
  readinessPillText: { fontSize: 10, fontWeight: '700' },
  examReadinessInfo: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examReadinessDetail: { fontSize: typography.sizes.xs },
  sprintBtnSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.sm },
  sprintBtnSmallText: { fontSize: 10, fontWeight: '700' },
});
