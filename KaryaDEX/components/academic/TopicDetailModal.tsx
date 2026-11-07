/**
 * BunkMatKar — Topic Academic Context Modal (Phase 7)
 *
 * Shows comprehensive academic context for a topic:
 * - Overview & Unit
 * - Revision State & Priority (Phase 7 Intelligence)
 * - Interactive Topic Review Flow (Confidence, Outcome, Duration, Notes)
 * - Chronological Revision History timeline
 * - Covered in classes (dates, attendance, notes)
 * - My Notes & Teacher Notes
 * - Linked Tasks (pending, completed, overdue) with 1-tap conversion
 * - Associated Exams with readiness
 * - Attached Resources
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
  TextInput,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import {
  CalendarIcon,
  TaskClipboardIcon,
  NotebookIcon,
  AttachFileIcon,
  CheckmarkIcon,
} from '@/components/ui/AcademicIcons';
import { academicHubService } from '@/services/academicHubService';
import { revisionIntelligenceService } from '@/services/revisionIntelligenceService';
import { useAcademicStore } from '@/store/useAcademicStore';
import { useAppStore } from '@/store/useAppStore';
import type { RevisionConfidence, RevisionOutcome, RevisionPriority, RevisionState } from '@/types/academic';
import { formatLocalDate } from '@/lib/timeUtils';

interface TopicDetailModalProps {
  visible: boolean;
  onClose: () => void;
  topicId: string | null;
  onOpenClassSession?: (slotId: string, date: string, subjectId: string) => void;
}

export function TopicDetailModal({
  visible,
  onClose,
  topicId,
  onOpenClassSession,
}: TopicDetailModalProps) {
  const { colors, isDark } = useTheme();
  const academic = useAcademicStore();
  const { toggleTask } = useAppStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'tasks' | 'resources' | 'history'>('overview');

  // Review Flow State
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [selectedConfidence, setSelectedConfidence] = useState<RevisionConfidence>('medium');
  const [selectedOutcome, setSelectedOutcome] = useState<RevisionOutcome>('okay');
  const [selectedDuration, setSelectedDuration] = useState<number>(20);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [taskAddedToast, setTaskAddedToast] = useState(false);

  if (!visible || !topicId) {
    return null;
  }

  const context = academicHubService.getTopicAcademicContext(topicId);
  if (!context) {
    return null;
  }

  const { topic, subject, unit, classSessions, resources, tasks, exams } = context;
  const intel = revisionIntelligenceService.getTopicIntelligence(topic.id);
  const topicRecords = academic.getRevisionRecordsForTopic(topic.id);

  const handleSaveReview = async () => {
    try {
      setIsSavingReview(true);
      await academic.recordTopicRevision({
        topicId: topic.id,
        subjectId: topic.subjectId,
        reviewedAt: formatLocalDate(),
        durationMinutes: selectedDuration,
        confidence: selectedConfidence,
        outcome: selectedOutcome,
        notes: reviewNotes.trim() ? reviewNotes.trim() : undefined,
      });
      setIsReviewFormOpen(false);
      setReviewNotes('');
    } catch (err) {
      console.error('Failed to save review:', err);
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleCreateTask = async () => {
    try {
      await academic.convertRevisionToTask(topic.id);
      setTaskAddedToast(true);
      setTimeout(() => setTaskAddedToast(false), 2500);
    } catch (err) {
      console.error('Failed to convert revision to task:', err);
    }
  };

  const getStateBadge = (state?: RevisionState) => {
    switch (state) {
      case 'CONFIDENT':
        return { label: 'Confident', color: statusColors.safe, bg: statusColors.safe + '20' };
      case 'NEEDS_REVIEW':
        return { label: 'Needs Review', color: statusColors.danger, bg: statusColors.danger + '20' };
      case 'REVIEWED':
        return { label: 'Reviewed', color: '#3B82F6', bg: '#3B82F620' };
      case 'NOT_REVIEWED':
        return { label: 'Not Reviewed', color: statusColors.watch, bg: statusColors.watch + '20' };
      default:
        return { label: 'Not Taught', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' };
    }
  };

  const getPriorityBadge = (priority?: RevisionPriority) => {
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

  const stateBadge = getStateBadge(intel?.revisionState);
  const priorityBadge = getPriorityBadge(intel?.revisionPriority);

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
              backgroundColor: isDark ? 'rgba(18, 19, 28, 0.95)' : 'rgba(255, 255, 255, 0.97)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.10)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.subjectRow}>
                {subject && (
                  <View style={[styles.subjectTag, { backgroundColor: subject.color + '20' }]}>
                    <Text style={[styles.subjectTagText, { color: subject.color }]}>
                      {subject.shortName}
                    </Text>
                  </View>
                )}
                {unit && (
                  <Text style={[styles.unitText, { color: colors.textTertiary }]}>
                    {unit.name}
                  </Text>
                )}
              </View>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {topic.name}
              </Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          {/* Quick Action Badges */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => academic.toggleTopicCompletion(topic.id)}
              style={[
                styles.actionPill,
                {
                  backgroundColor: topic.isCompleted ? brand.violet + '20' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: topic.isCompleted ? brand.violet : colors.border,
                },
              ]}
            >
              <View style={[styles.miniCheck, topic.isCompleted && { backgroundColor: brand.violet }]}>
                {topic.isCompleted && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
              </View>
              <Text
                style={[
                  styles.actionPillText,
                  { color: topic.isCompleted ? brand.violet : colors.textSecondary },
                ]}
              >
                {topic.isCompleted ? 'Covered' : 'Mark Covered'}
              </Text>
            </Pressable>

            <View style={[styles.actionPill, { backgroundColor: stateBadge.bg, borderColor: stateBadge.color + '40' }]}>
              <Text style={[styles.actionPillText, { color: stateBadge.color, fontWeight: '700' }]}>
                {stateBadge.label}
              </Text>
            </View>

            <View style={[styles.actionPill, { backgroundColor: priorityBadge.bg, borderColor: priorityBadge.color + '40' }]}>
              <Text style={[styles.actionPillText, { color: priorityBadge.color, fontWeight: '700' }]}>
                {priorityBadge.label}
              </Text>
            </View>

            <Pressable
              onPress={() => setIsReviewFormOpen(prev => !prev)}
              style={[
                styles.actionPill,
                { backgroundColor: brand.violet, borderColor: brand.violet },
              ]}
            >
              <Text style={[styles.actionPillText, { color: '#FFF', fontWeight: '700' }]}>
                {isReviewFormOpen ? 'Cancel' : 'Review Topic'}
              </Text>
            </Pressable>
          </View>

          {/* Review Topic Form Drawer */}
          {isReviewFormOpen && (
            <View style={[styles.reviewDrawer, { backgroundColor: isDark ? 'rgba(30, 31, 46, 0.95)' : '#F8FAFC' }]}>
              <Text style={[styles.drawerTitle, { color: colors.text }]}>Record Topic Revision</Text>

              {/* Confidence Selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Confidence</Text>
                <View style={styles.optionRow}>
                  {(['low', 'medium', 'high'] as RevisionConfidence[]).map(conf => (
                    <Pressable
                      key={conf}
                      onPress={() => setSelectedConfidence(conf)}
                      style={[
                        styles.optionBtn,
                        selectedConfidence === conf && {
                          backgroundColor: conf === 'high' ? statusColors.safe : conf === 'medium' ? brand.violet : statusColors.danger,
                          borderColor: 'transparent',
                        },
                        selectedConfidence !== conf && { borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionBtnText,
                          { color: selectedConfidence === conf ? '#FFF' : colors.textSecondary },
                        ]}
                      >
                        {conf.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Outcome Selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Outcome</Text>
                <View style={styles.optionRow}>
                  {([
                    { key: 'needs_review', label: 'Needs Review' },
                    { key: 'okay', label: 'Okay' },
                    { key: 'confident', label: 'Confident' },
                  ] as Array<{ key: RevisionOutcome; label: string }>).map(out => (
                    <Pressable
                      key={out.key}
                      onPress={() => setSelectedOutcome(out.key)}
                      style={[
                        styles.optionBtn,
                        selectedOutcome === out.key && {
                          backgroundColor: brand.violet,
                          borderColor: 'transparent',
                        },
                        selectedOutcome !== out.key && { borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionBtnText,
                          { color: selectedOutcome === out.key ? '#FFF' : colors.textSecondary },
                        ]}
                      >
                        {out.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Duration Selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Duration</Text>
                <View style={styles.optionRow}>
                  {[15, 30, 45, 60].map(dur => (
                    <Pressable
                      key={dur}
                      onPress={() => setSelectedDuration(dur)}
                      style={[
                        styles.optionBtn,
                        selectedDuration === dur && {
                          backgroundColor: brand.violet,
                          borderColor: 'transparent',
                        },
                        selectedDuration !== dur && { borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionBtnText,
                          { color: selectedDuration === dur ? '#FFF' : colors.textSecondary },
                        ]}
                      >
                        {dur}m
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Notes Input */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Notes (Optional)</Text>
                <TextInput
                  style={[
                    styles.notesInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#FFF',
                    },
                  ]}
                  placeholder="Key concepts reviewed, formulas practiced..."
                  placeholderTextColor={colors.textTertiary}
                  value={reviewNotes}
                  onChangeText={setReviewNotes}
                  multiline
                />
              </View>

              {/* Submit Buttons */}
              <View style={styles.submitRow}>
                <Pressable
                  onPress={handleSaveReview}
                  disabled={isSavingReview}
                  style={[styles.saveReviewBtn, { backgroundColor: brand.violet }]}
                >
                  <Text style={styles.saveReviewBtnText}>
                    {isSavingReview ? 'Saving...' : 'Save Revision'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Navigation SubTabs */}
          <View style={styles.tabsRow}>
            {[
              { key: 'overview', label: `Classes (${classSessions.length})` },
              { key: 'history', label: `History (${topicRecords.length})` },
              { key: 'notes', label: 'Notes' },
              { key: 'tasks', label: `Tasks (${tasks.all.length})` },
              { key: 'resources', label: `Files (${resources.length})` },
            ].map(tab => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key as any)}
                style={[
                  styles.tabBtn,
                  activeTab === tab.key && {
                    borderBottomColor: brand.violet,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    {
                      color: activeTab === tab.key ? brand.violet : colors.textSecondary,
                      fontWeight: activeTab === tab.key ? '700' : '500',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Body Content */}
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* 1. Classes Tab */}
            {activeTab === 'overview' && (
              <View style={{ gap: spacing.sm }}>
                {intel?.upcomingExam && (
                  <GlassCard level="secondary" style={styles.examCard}>
                    <Text style={[styles.sectionHeading, { color: statusColors.danger }]}>
                      UPCOMING RELEVANT EXAM
                    </Text>
                    <Text style={[styles.examName, { color: colors.text }]}>
                      {intel.upcomingExam.name}
                    </Text>
                    <Text style={[styles.examMeta, { color: colors.textSecondary }]}>
                      {intel.upcomingExam.date} ({intel.upcomingExam.daysUntil} days remaining)
                    </Text>
                  </GlassCard>
                )}

                <View style={styles.taskActionBanner}>
                  <Pressable
                    onPress={handleCreateTask}
                    style={[styles.createTaskBtn, { backgroundColor: brand.violet + '20', borderColor: brand.violet + '60' }]}
                  >
                    <Text style={[styles.createTaskBtnText, { color: brand.violet }]}>
                      {taskAddedToast ? 'Revision Task Created!' : '+ Create Revision Task'}
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                  CLASSES COVERING THIS TOPIC
                </Text>

                {classSessions.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <CalendarIcon size={20} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                      This topic has not been tagged in any class sessions yet.
                    </Text>
                  </View>
                ) : (
                  classSessions.map(session => (
                    <GlassCard key={`${session.id}-${session.date}`} level="secondary" style={styles.sessionCard}>
                      <View style={styles.sessionHeaderRow}>
                        <View>
                          <Text style={[styles.sessionDate, { color: colors.text }]}>
                            {session.date}
                          </Text>
                          <Text style={[styles.sessionMeta, { color: colors.textTertiary }]}>
                            {session.startTime && session.endTime ? `${session.startTime} - ${session.endTime}` : 'Class session'}
                          </Text>
                        </View>
                        {onOpenClassSession && (
                          <Pressable
                            onPress={() => onOpenClassSession(session.id, session.date, topic.subjectId)}
                            style={styles.openSessionBtn}
                          >
                            <Text style={styles.openSessionBtnText}>View Class</Text>
                          </Pressable>
                        )}
                      </View>
                    </GlassCard>
                  ))
                )}
              </View>
            )}

            {/* 2. Revision History Tab */}
            {activeTab === 'history' && (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                  CHRONOLOGICAL REVISION HISTORY
                </Text>

                {topicRecords.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <TaskClipboardIcon size={20} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                      No revision sessions recorded yet. Tap "Review Topic" above to record your first session.
                    </Text>
                  </View>
                ) : (
                  topicRecords.map(rec => (
                    <GlassCard key={rec.id} level="secondary" style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <View>
                          <Text style={[styles.historyDate, { color: colors.text }]}>
                            {rec.reviewedAt}
                          </Text>
                          <Text style={[styles.historyDuration, { color: colors.textTertiary }]}>
                            {rec.durationMinutes} min session
                          </Text>
                        </View>
                        <View style={styles.historyBadges}>
                          <View
                            style={[
                              styles.miniBadge,
                              {
                                backgroundColor:
                                  rec.outcome === 'confident'
                                    ? statusColors.safe + '20'
                                    : rec.outcome === 'needs_review'
                                    ? statusColors.danger + '20'
                                    : '#3B82F620',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.miniBadgeText,
                                {
                                  color:
                                    rec.outcome === 'confident'
                                      ? statusColors.safe
                                      : rec.outcome === 'needs_review'
                                      ? statusColors.danger
                                      : '#3B82F6',
                                },
                              ]}
                            >
                              {rec.outcome === 'confident'
                                ? 'Confident'
                                : rec.outcome === 'needs_review'
                                ? 'Needs Review'
                                : 'Okay'}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.miniBadge,
                              {
                                backgroundColor:
                                  rec.confidence === 'high'
                                    ? statusColors.safe + '20'
                                    : rec.confidence === 'low'
                                    ? statusColors.danger + '20'
                                    : brand.violet + '20',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.miniBadgeText,
                                {
                                  color:
                                    rec.confidence === 'high'
                                      ? statusColors.safe
                                      : rec.confidence === 'low'
                                      ? statusColors.danger
                                      : brand.violet,
                                },
                              ]}
                            >
                              {rec.confidence.toUpperCase()} CONFIDENCE
                            </Text>
                          </View>
                        </View>
                      </View>
                      {rec.notes ? (
                        <View style={styles.historyNotes}>
                          <Text style={[styles.historyNotesText, { color: colors.textSecondary }]}>
                            {rec.notes}
                          </Text>
                        </View>
                      ) : null}
                    </GlassCard>
                  ))
                )}
              </View>
            )}

            {/* 3. Notes Tab */}
            {activeTab === 'notes' && (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                  CLASS NOTES FOR THIS TOPIC
                </Text>

                {classSessions.filter(cs => cs.myNotes || cs.teacherNotes).length === 0 ? (
                  <View style={styles.emptyCard}>
                    <NotebookIcon size={20} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                      No personal or teacher notes recorded yet for this topic.
                    </Text>
                  </View>
                ) : (
                  classSessions.map(cs => {
                    if (!cs.myNotes && !cs.teacherNotes) return null;
                    return (
                      <GlassCard key={cs.id} level="secondary" style={styles.notesCard}>
                        <Text style={[styles.notesDateHeader, { color: brand.violet }]}>
                          Class of {cs.date}
                        </Text>
                        {cs.myNotes ? (
                          <View style={{ marginTop: spacing.xs }}>
                            <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>
                              MY NOTES
                            </Text>
                            <Text style={[styles.notesBody, { color: colors.text }]}>
                              {cs.myNotes}
                            </Text>
                          </View>
                        ) : null}
                        {cs.teacherNotes ? (
                          <View style={{ marginTop: spacing.sm }}>
                            <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>
                              TEACHER NOTES
                            </Text>
                            <Text style={[styles.notesBody, { color: colors.text }]}>
                              {cs.teacherNotes}
                            </Text>
                          </View>
                        ) : null}
                      </GlassCard>
                    );
                  })
                )}
              </View>
            )}

            {/* 4. Tasks Tab */}
            {activeTab === 'tasks' && (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                  LINKED TASKS ({tasks.all.length})
                </Text>

                {tasks.all.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <TaskClipboardIcon size={20} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                      No tasks linked to this topic yet.
                    </Text>
                  </View>
                ) : (
                  tasks.all.map(task => (
                    <GlassCard key={task.id} level="secondary" style={styles.taskCard}>
                      <Pressable onPress={() => toggleTask(task.id)} style={styles.taskCheck}>
                        <View style={[styles.miniCheck, task.isCompleted && { backgroundColor: brand.violet }]}>
                          {task.isCompleted && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                        </View>
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.taskTitle,
                            { color: colors.text },
                            task.isCompleted && { textDecorationLine: 'line-through', opacity: 0.6 },
                          ]}
                        >
                          {task.title}
                        </Text>
                        <Text style={[styles.taskMeta, { color: colors.textTertiary }]}>
                          Due: {task.dueDate || 'No date'} · {task.priority.toUpperCase()}
                        </Text>
                      </View>
                    </GlassCard>
                  ))
                )}
              </View>
            )}

            {/* 5. Resources Tab */}
            {activeTab === 'resources' && (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                  RESOURCES & ATTACHMENTS ({resources.length})
                </Text>

                {resources.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AttachFileIcon size={20} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                      No resources attached to this topic yet.
                    </Text>
                  </View>
                ) : (
                  resources.map(res => (
                    <GlassCard key={res.id} level="secondary" style={styles.resourceCard}>
                      <AttachFileIcon size={18} color={brand.violet} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resourceTitle, { color: colors.text }]}>
                          {res.title}
                        </Text>
                        <Text style={[styles.resourceMeta, { color: colors.textTertiary }]}>
                          {res.type.toUpperCase()} · {((res.fileSize || 0) / 1024).toFixed(0)} KB
                        </Text>
                      </View>
                    </GlassCard>
                  ))
                )}
              </View>
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
    maxHeight: '90%',
    minHeight: '65%',
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
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  subjectTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  subjectTagText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  unitText: {
    fontSize: typography.sizes.xs,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
  },
  closeBtn: {
    padding: spacing.xs,
    borderRadius: radii.full,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  actionPillText: {
    fontSize: typography.sizes.xs,
  },
  miniCheck: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewDrawer: {
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    gap: spacing.sm,
  },
  drawerTitle: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: '700',
  },
  formGroup: {
    gap: 4,
  },
  formLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: typography.sizes.xs + 1,
    minHeight: 50,
  },
  submitRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  saveReviewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  saveReviewBtnText: {
    color: '#FFF',
    fontSize: typography.sizes.xs + 1,
    fontWeight: '700',
  },
  taskActionBanner: {
    marginBottom: spacing.xs,
  },
  createTaskBtn: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  createTaskBtnText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabBtn: {
    paddingVertical: spacing.sm + 2,
    marginRight: spacing.md,
  },
  tabBtnText: {
    fontSize: typography.sizes.sm,
  },
  body: {
    padding: spacing.base,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  emptyCard: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
  sessionCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionDate: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: typography.sizes.xs,
  },
  openSessionBtn: {
    backgroundColor: brand.violet + '20',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  openSessionBtnText: {
    color: brand.violet,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  examCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  examName: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: '600',
  },
  examMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  historyCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyDate: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  historyDuration: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  historyBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyNotes: {
    marginTop: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  historyNotesText: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
  },
  notesCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  notesDateHeader: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  notesLabel: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  notesBody: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
    lineHeight: 18,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  taskCheck: {
    padding: 2,
  },
  taskTitle: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: '500',
  },
  taskMeta: {
    fontSize: typography.sizes.xs,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  resourceTitle: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: '500',
  },
  resourceMeta: {
    fontSize: typography.sizes.xs,
  },
});
