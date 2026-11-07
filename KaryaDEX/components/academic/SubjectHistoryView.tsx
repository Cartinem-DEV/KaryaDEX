/**
 * BunkMatKar — SubjectHistoryView
 *
 * Chronological Class History & Notes feed for Subject Hub.
 * Shows all class sessions with attendance, topics covered, personal notes,
 * and allows tapping to open ClassSessionModal.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { StudentJournalIcon } from '@/components/ui/AcademicIcons';
import { useAcademicStore } from '@/store/useAcademicStore';
import { ClassSessionModal } from './ClassSessionModal';
import type { ClassOccurrence, ClassAttendanceStatus } from '@/types/academic';

interface SubjectHistoryViewProps {
  subjectId: string;
}

const ATTENDANCE_BADGES: Record<ClassAttendanceStatus, { label: string; color: string; bg: string }> = {
  present: { label: 'Present', color: statusColors.safe, bg: statusColors.safe + '20' },
  absent: { label: 'Absent', color: statusColors.danger, bg: statusColors.danger + '20' },
  late: { label: 'Late', color: statusColors.watch, bg: statusColors.watch + '20' },
  cancelled: { label: 'Cancelled', color: '#64748B', bg: 'rgba(100, 116, 139, 0.20)' },
  not_recorded: { label: 'Not Set', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' },
};

export function SubjectHistoryView({ subjectId }: SubjectHistoryViewProps) {
  const { colors, isDark } = useTheme();
  const academic = useAcademicStore();

  const occurrences = academic.getClassOccurrencesForSubject(subjectId);
  const [selectedOccurrence, setSelectedOccurrence] = useState<ClassOccurrence | null>(null);

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        Chronological record of all classes, topics taught, and personal notes.
      </Text>

      {occurrences.length === 0 ? (
        <GlassCard level="secondary" style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            No class sessions recorded yet for this subject.
          </Text>
        </GlassCard>
      ) : (
        occurrences.map(occ => {
          const badge = ATTENDANCE_BADGES[occ.attendanceStatus] || ATTENDANCE_BADGES.not_recorded;
          const hasNotes = Boolean(occ.note?.myNotes);
          const hasTopics = occ.topicNames.length > 0;

          return (
            <GlassCard
              key={occ.id}
              level="secondary"
              style={styles.card}
              onPress={() => setSelectedOccurrence(occ)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.dateRow}>
                  <Text style={[styles.dateText, { color: colors.text }]}>
                    {occ.date}
                  </Text>
                  <Text style={[styles.timeText, { color: colors.textTertiary }]}>
                    {occ.startTime} - {occ.endTime}
                  </Text>
                </View>

                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.color }]}>
                    {badge.label}
                  </Text>
                </View>
              </View>

              {/* Topics */}
              {hasTopics && (
                <View style={styles.topicsRow}>
                  {occ.topicNames.map((name, i) => (
                    <View
                      key={i}
                      style={[
                        styles.topicPill,
                        {
                          backgroundColor: isDark
                            ? 'rgba(124, 58, 237, 0.18)'
                            : 'rgba(124, 58, 237, 0.10)',
                        },
                      ]}
                    >
                      <Text style={[styles.topicPillText, { color: brand.violet }]}>
                        {name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Note excerpt */}
              {hasNotes ? (
                <View style={styles.noteRow}>
                  <StudentJournalIcon size={14} color={brand.violet} />
                  <Text style={[styles.noteExcerpt, { color: colors.textSecondary }]} numberOfLines={2}>
                    {occ.note?.myNotes}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.noNotesHint, { color: colors.textTertiary }]}>
                  Tap to add class notes or topics...
                </Text>
              )}

              <View style={styles.cardFooter}>
                <Text style={[styles.roomText, { color: colors.textTertiary }]}>
                  {occ.type.toUpperCase()} · Room {occ.room}
                </Text>
                {occ.note?.revisionStatus && occ.note.revisionStatus !== 'not_started' && (
                  <Text style={[styles.revText, { color: brand.violet }]}>
                    Rev: {occ.note.revisionStatus}
                  </Text>
                )}
              </View>
            </GlassCard>
          );
        })
      )}

      {/* Modal for viewing/editing selected occurrence */}
      {selectedOccurrence && (
        <ClassSessionModal
          visible={Boolean(selectedOccurrence)}
          onClose={() => setSelectedOccurrence(null)}
          slotId={selectedOccurrence.slotId}
          date={selectedOccurrence.date}
          subjectId={selectedOccurrence.subjectId}
          startTime={selectedOccurrence.startTime}
          endTime={selectedOccurrence.endTime}
          room={selectedOccurrence.room}
          type={selectedOccurrence.type}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.xs,
    marginBottom: spacing.xs,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    fontStyle: 'italic',
  },
  card: {
    padding: spacing.base,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  timeText: {
    fontSize: typography.sizes.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  topicPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  topicPillText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  noteExcerpt: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  noNotesHint: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  roomText: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  revText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    textTransform: 'capitalize',
  },
});
