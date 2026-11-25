/**
 * KaryaDEX — SubjectSyllabusView
 *
 * Visual Syllabus & Topic Tracker for Subject Hub.
 * Shows Units -> Topics -> Completion Checkbox -> Revision State.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { useAcademicStore } from '@/store/useAcademicStore';
import { useAppStore } from '@/store/useAppStore';
import { TopicDetailModal } from './TopicDetailModal';
import type { RevisionStatus, Topic } from '@/types/academic';

interface SubjectSyllabusViewProps {
  subjectId: string;
}

export function SubjectSyllabusView({ subjectId }: SubjectSyllabusViewProps) {
  const { colors, isDark } = useTheme();
  const academic = useAcademicStore();
  const { semester, subjects } = useAppStore();
  const currentSubject = subjects.find(s => s.id === subjectId);
  const activeSemesterId = currentSubject?.semesterId || semester?.id || 'sem-current';

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [selectedUnitForNewTopic, setSelectedUnitForNewTopic] = useState<string | undefined>(undefined);

  const units = academic.getUnitsForSubject(subjectId);
  const topics = academic.getTopicsForSubject(subjectId);
  const unassignedTopics = topics.filter(t => !t.unitId || !units.some(u => u.id === t.unitId));

  const completedCount = topics.filter(t => t.isCompleted).length;
  const progressPct = topics.length > 0 ? (completedCount / topics.length) * 100 : 0;

  const cycleRevision = (topic: Topic) => {
    const sequence: RevisionStatus[] = ['not_started', 'taught', 'needs_revision', 'revised'];
    const nextIdx = (sequence.indexOf(topic.revisionStatus) + 1) % sequence.length;
    academic.updateTopicRevision(topic.id, sequence[nextIdx]);
  };

  const handleAddTopic = () => {
    if (!newTopicName.trim()) return;

    let targetUnitId = selectedUnitForNewTopic;
    if (!targetUnitId && units.length > 0) {
      targetUnitId = units[0].id;
    } else if (!targetUnitId) {
      const defaultUnit = academic.addSyllabusUnit({
        subjectId,
        semesterId: activeSemesterId,
        name: 'Unit 1: Fundamentals',
        order: 1,
        topicIds: [],
      });
      targetUnitId = defaultUnit.id;
    }

    academic.addTopic({
      subjectId,
      unitId: targetUnitId,
      name: newTopicName.trim(),
      order: topics.length + 1,
      isCompleted: false,
      revisionStatus: 'not_started',
      revisionCount: 0,
      classNoteIds: [],
    });

    setNewTopicName('');
    setShowAddTopic(false);
  };

  const getRevisionBadge = (status: RevisionStatus) => {
    switch (status) {
      case 'revised':
        return { label: 'Revised', color: statusColors.safe, bg: statusColors.safe + '22' };
      case 'needs_revision':
        return { label: 'Needs Rev', color: statusColors.danger, bg: statusColors.danger + '22' };
      case 'taught':
        return { label: 'Taught', color: statusColors.watch, bg: statusColors.watch + '22' };
      default:
        return { label: 'Not Started', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' };
    }
  };

  const renderTopicRow = (topic: Topic) => {
    const rev = getRevisionBadge(topic.revisionStatus);
    return (
      <View
        key={topic.id}
        style={[
          styles.topicRow,
          {
            borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
          },
        ]}
      >
        <Pressable
          onPress={() => academic.toggleTopicCompletion(topic.id)}
          style={styles.checkboxTouch}
        >
          <View
            style={[
              styles.checkbox,
              topic.isCompleted && { backgroundColor: '#00E5FF', borderColor: '#00E5FF' },
              { borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)' },
            ]}
          >
            {topic.isCompleted && <Feather name="check" size={11} color="#05070B" />}
          </View>
        </Pressable>

        <Pressable
          onPress={() => setSelectedTopicId(topic.id)}
          style={styles.topicInfo}
        >
          <Text
            style={[
              styles.topicName,
              {
                color: topic.isCompleted ? colors.textSecondary : colors.text,
                textDecorationLine: topic.isCompleted ? 'line-through' : 'none',
              },
            ]}
          >
            {topic.name}
          </Text>
        </Pressable>

        {topic.revisionStatus === 'needs_revision' && (
          <View style={[styles.priorityPill, { backgroundColor: '#EF444422' }]}>
            <Text style={[styles.priorityPillText, { color: '#EF4444' }]}>NEEDS REV</Text>
          </View>
        )}

        <Pressable
          onPress={() => cycleRevision(topic)}
          style={[styles.revBadge, { backgroundColor: rev.bg }]}
        >
          <Text style={[styles.revBadgeText, { color: rev.color }]}>
            {rev.label}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ─── Overall Progress Card ─── */}
      <GlassCard level="secondary" style={styles.summaryCard}>
        <View style={styles.progressHeader}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Syllabus Completion</Text>
          <Text style={[styles.progressPct, { color: '#00E5FF' }]}>
            {progressPct.toFixed(0)}%
          </Text>
        </View>
        <View style={[styles.progressBarTrack, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
          <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: '#00E5FF' }]} />
        </View>
        <View style={styles.summaryFooterRow}>
          <Text style={[styles.progressMeta, { color: colors.textSecondary }]}>
            {completedCount} of {topics.length} topics covered
          </Text>
          <Pressable onPress={() => setShowAddTopic(prev => !prev)}>
            <Text style={[styles.addTopicLink, { color: '#00E5FF' }]}>
              {showAddTopic ? 'Cancel' : '+ Add Topic'}
            </Text>
          </Pressable>
        </View>
      </GlassCard>

      {/* ─── Inline Add Topic Form ─── */}
      {showAddTopic && (
        <GlassCard level="secondary" style={styles.addCard}>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
            placeholder="Topic Name (e.g. Binary Search Trees)"
            placeholderTextColor={colors.textTertiary}
            value={newTopicName}
            onChangeText={setNewTopicName}
            autoFocus
          />
          {units.length > 0 && (
            <View style={styles.unitSelectorRow}>
              {units.map(u => (
                <Pressable
                  key={u.id}
                  onPress={() => setSelectedUnitForNewTopic(u.id)}
                  style={[
                    styles.unitChip,
                    (selectedUnitForNewTopic === u.id || (!selectedUnitForNewTopic && units[0]?.id === u.id)) && {
                      backgroundColor: brand.violet,
                    },
                    {
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.unitChipText,
                      {
                        color:
                          selectedUnitForNewTopic === u.id || (!selectedUnitForNewTopic && units[0]?.id === u.id)
                            ? '#FFF'
                            : colors.textSecondary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {u.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable onPress={handleAddTopic} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save Topic</Text>
          </Pressable>
        </GlassCard>
      )}

      {/* ─── Units & Topics List ─── */}
      {units.length === 0 && topics.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            No syllabus units or topics defined for this subject yet.
          </Text>
          {!showAddTopic && (
            <Pressable onPress={() => setShowAddTopic(true)} style={[styles.saveBtn, { marginTop: spacing.md, paddingHorizontal: spacing.lg }]}>
              <Text style={styles.saveBtnText}>+ Add First Topic</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          {units.map(unit => {
            const unitTopics = topics.filter(t => t.unitId === unit.id);
            const unitCompleted = unitTopics.filter(t => t.isCompleted).length;

            return (
              <GlassCard key={unit.id} level="secondary" style={styles.unitCard}>
                <View style={styles.unitHeader}>
                  <Text style={[styles.unitTitle, { color: colors.text }]}>
                    {unit.name}
                  </Text>
                  <Text style={[styles.unitCount, { color: colors.textTertiary }]}>
                    {unitCompleted}/{unitTopics.length} done
                  </Text>
                </View>

                <View style={styles.topicList}>
                  {unitTopics.map(renderTopicRow)}
                </View>
              </GlassCard>
            );
          })}

          {unassignedTopics.length > 0 && (
            <GlassCard level="secondary" style={styles.unitCard}>
              <View style={styles.unitHeader}>
                <Text style={[styles.unitTitle, { color: colors.text }]}>
                  General Topics
                </Text>
                <Text style={[styles.unitCount, { color: colors.textTertiary }]}>
                  {unassignedTopics.filter(t => t.isCompleted).length}/{unassignedTopics.length} done
                </Text>
              </View>

              <View style={styles.topicList}>
                {unassignedTopics.map(renderTopicRow)}
              </View>
            </GlassCard>
          )}
        </>
      )}

      {/* Topic Academic Context Modal */}
      <TopicDetailModal
        visible={Boolean(selectedTopicId)}
        onClose={() => setSelectedTopicId(null)}
        topicId={selectedTopicId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  summaryCard: {
    padding: spacing.base,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  summaryTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  progressPct: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: radii.full,
    overflow: 'hidden',
    marginVertical: spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  progressMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 4,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    fontStyle: 'italic',
  },
  unitCard: {
    padding: spacing.base,
  },
  unitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  unitTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  unitCount: {
    fontSize: typography.sizes.xs,
  },
  topicList: {
    gap: 4,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkboxTouch: {
    paddingRight: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  topicInfo: {
    flex: 1,
  },
  topicName: {
    fontSize: typography.sizes.sm,
  },
  revBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  revBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  summaryFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  addTopicLink: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  addCard: {
    padding: spacing.base,
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: typography.sizes.sm,
  },
  unitSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  unitChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  unitChipText: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
  },
  saveBtn: {
    backgroundColor: '#00E5FF',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#05070B',
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginRight: 6,
  },
  priorityPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
});
