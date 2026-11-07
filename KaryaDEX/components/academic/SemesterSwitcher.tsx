/**
 * BunkMatKar — SemesterSwitcher Component (Phase 6)
 *
 * Canonical semester selector providing:
 * - Active semester pill button
 * - Modal listing all semesters with status (Current / Completed / Archived)
 * - Safe switching that preserves historical data and switches active context
 * - Offline-first, accessible, responsive
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
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';
import { semesterRepository } from '@/database/repositories/semesterRepository';
import type { Semester } from '@/types';

interface SemesterSwitcherProps {
  compact?: boolean;
}

export function SemesterSwitcher({ compact = false }: SemesterSwitcherProps) {
  const { colors, isDark } = useTheme();
  const { semester: activeSemester, switchActiveSemester } = useAppStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  const loadSemesters = async () => {
    try {
      setLoading(true);
      const list = await semesterRepository.getAllSemesters();
      setSemesters(list);
    } catch (err) {
      console.warn('[SemesterSwitcher] Error loading semesters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (modalVisible) {
      loadSemesters();
    }
  }, [modalVisible]);

  const handleSelectSemester = async (sem: Semester) => {
    if (sem.id === activeSemester?.id) {
      setModalVisible(false);
      return;
    }
    try {
      setSwitching(true);
      await switchActiveSemester(sem.id);
      setModalVisible(false);
    } catch (err) {
      console.error('[SemesterSwitcher] Failed to switch semester:', err);
    } finally {
      setSwitching(false);
    }
  };

  const displayName = activeSemester?.name || 'Semester';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Active semester: ${displayName}. Tap to switch semester.`}
        onPress={() => setModalVisible(true)}
        style={({ pressed }) => [
          styles.pillContainer,
          {
            backgroundColor: isDark ? 'rgba(0, 229, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            borderColor: isDark ? 'rgba(0, 229, 255, 0.28)' : 'rgba(0, 0, 0, 0.08)',
          },
          compact && styles.pillCompact,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Feather name="calendar" size={13} color="#00E5FF" style={{ marginRight: 5 }} />
        <Text style={[styles.pillText, { color: isDark ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Feather name="chevron-down" size={13} color={isDark ? '#00E5FF' : colors.textTertiary} style={{ marginLeft: 2 }} />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !switching && setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <GlassCard level="primary" style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    Switch Semester
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Historical attendance and classes remain safely preserved
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close semester selector"
                  onPress={() => setModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Feather name="x" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>

              {loading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator color={brand.violet} />
                </View>
              ) : semesters.length === 0 ? (
                <View style={styles.centerContainer}>
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                    No other semesters found
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
                  {semesters.map((sem) => {
                    const isActive = sem.id === activeSemester?.id;
                    const semStatus = sem.status || (isActive ? 'current' : 'completed');

                    return (
                      <Pressable
                        key={sem.id}
                        disabled={switching}
                        accessibilityRole="button"
                        accessibilityLabel={`${sem.name}, status ${semStatus}${isActive ? ', selected' : ''}`}
                        onPress={() => handleSelectSemester(sem)}
                        style={({ pressed }) => [
                          styles.semesterItem,
                          {
                            backgroundColor: isActive
                              ? isDark
                                ? 'rgba(124, 77, 255, 0.16)'
                                : 'rgba(103, 58, 183, 0.08)'
                              : isDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isActive ? brand.violet : 'transparent',
                          },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <View style={styles.itemLeft}>
                          <Text style={[styles.itemName, { color: colors.text }]}>
                            {sem.name}
                          </Text>
                          <Text style={[styles.itemDates, { color: colors.textTertiary }]}>
                            {sem.startDate && sem.endDate
                              ? `${sem.startDate.slice(0, 4)} – ${sem.endDate.slice(0, 4)}`
                              : `Semester ${sem.number}`}
                          </Text>
                        </View>
                        <View style={styles.itemRight}>
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor:
                                  semStatus === 'current'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : 'rgba(107, 114, 128, 0.15)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                {
                                  color:
                                    semStatus === 'current'
                                      ? statusColors.safe
                                      : colors.textTertiary,
                                },
                              ]}
                            >
                              {semStatus.toUpperCase()}
                            </Text>
                          </View>
                          {isActive && (
                            <Feather name="check" size={16} color="#00E5FF" />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {switching && (
                <View style={styles.switchingOverlay}>
                  <ActivityIndicator color={brand.violet} />
                  <Text style={[styles.switchingText, { color: colors.text }]}>
                    Switching semester...
                  </Text>
                </View>
              )}
            </GlassCard>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    gap: 4,
  },
  pillCompact: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
  },
  pillIcon: {
    fontSize: 12,
  },
  pillText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    maxWidth: 120,
  },
  pillChevron: {
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalCard: {
    padding: spacing.md,
    borderRadius: radii.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
  },
  modalSubtitle: {
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
  },
  emptyText: {
    fontSize: typography.sizes.base,
  },
  listScroll: {
    maxHeight: 280,
  },
  semesterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginBottom: spacing.xs,
  },
  itemLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: typography.sizes.base,
    fontWeight: '600',
  },
  itemDates: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 4,
  },
  switchingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  switchingText: {
    fontSize: typography.sizes.base,
    fontWeight: '600',
  },
});
