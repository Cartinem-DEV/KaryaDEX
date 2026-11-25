/**
 * KaryaDEX — ArchiveManagerModal Component (Phase 6)
 *
 * Subject Archive & Restoration Management:
 * - Lists archived subjects with historical attendance stats
 * - Preserves all relational history (classes, notes, tasks, syllabus, marks)
 * - Safe one-tap "Restore" making subject active again with same ID
 * - Accessible, styled with Liquid Glass
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';
import { subjectRepository } from '@/database/repositories/subjectRepository';
import { calculatePercentage } from '@/lib/attendance';
import type { Subject } from '@/types';

interface ArchiveManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ArchiveManagerModal({ visible, onClose }: ArchiveManagerModalProps) {
  const { colors, isDark } = useTheme();
  const { semester, attendanceData, refreshFromDatabase } = useAppStore();
  const [archivedSubjects, setArchivedSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadArchived = async () => {
    try {
      setLoading(true);
      const list = await subjectRepository.getArchivedSubjects(semester?.id);
      setArchivedSubjects(list);
    } catch (err) {
      console.warn('[ArchiveManagerModal] Failed to load archived subjects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadArchived();
    }
  }, [visible, semester?.id]);

  const handleRestore = async (subject: Subject) => {
    try {
      setRestoringId(subject.id);
      await subjectRepository.unarchiveSubject(subject.id);
      await refreshFromDatabase();
      await loadArchived();
    } catch (err) {
      console.error('[ArchiveManagerModal] Failed to restore subject:', err);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalContainer}>
          <GlassCard level="primary" style={styles.modalCard}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  Archived Subjects
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Restoring brings back complete academic and attendance history
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close archived subjects modal"
                onPress={onClose}
                style={styles.closeBtn}
              >
                <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator color={brand.violet} />
              </View>
            ) : archivedSubjects.length === 0 ? (
              <View style={styles.centerContainer}>
                <Text style={[styles.emptyIcon, { color: colors.textTertiary }]}>📦</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No Archived Subjects
                </Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  When you archive a subject, it will safely appear here.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
                {archivedSubjects.map((sub) => {
                  const att = attendanceData[sub.id] || { attended: 0, total: 0 };
                  const pct = calculatePercentage(att.attended, att.total);
                  const isRestoring = restoringId === sub.id;

                  return (
                    <View
                      key={sub.id}
                      style={[
                        styles.subjectItem,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'rgba(0, 0, 0, 0.02)',
                        },
                      ]}
                    >
                      <View style={styles.subjectLeft}>
                        <View style={[styles.colorDot, { backgroundColor: sub.color }]} />
                        <View style={styles.subjectDetails}>
                          <Text style={[styles.subjectName, { color: colors.text }]}>
                            {sub.name}
                          </Text>
                          <Text style={[styles.subjectMeta, { color: colors.textTertiary }]}>
                            {sub.code} · {pct.toFixed(0)}% attendance ({att.attended}/{att.total})
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        disabled={isRestoring}
                        accessibilityRole="button"
                        accessibilityLabel={`Restore subject ${sub.name}`}
                        onPress={() => handleRestore(sub)}
                        style={({ pressed }) => [
                          styles.restoreBtn,
                          { backgroundColor: brand.violet },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        {isRestoring ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.restoreBtnText}>Restore</Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </GlassCard>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
  },
  modalCard: {
    padding: spacing.md,
    borderRadius: radii.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  centerContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: typography.sizes.xs,
    textAlign: 'center',
  },
  listScroll: {
    maxHeight: 300,
  },
  subjectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  subjectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs + 2,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  subjectDetails: {
    flex: 1,
  },
  subjectName: {
    fontSize: typography.sizes.base,
    fontWeight: '600',
  },
  subjectMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  restoreBtn: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  restoreBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
});
