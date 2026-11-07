/**
 * KaryaDEX — Study Header & Navigation Component
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing } from '@/constants/theme';
import type { Subject } from '@/types';
import type { StudySubTab } from './types';

interface StudyHeaderProps {
  activeTab: StudySubTab;
  onSelectTab: (tab: StudySubTab) => void;
  subjects: Subject[];
  selectedSubjectId: string | 'all';
  onSelectSubject: (subjectId: string | 'all') => void;
  countdownDays: number | null;
  examName: string | null;
}

const SUB_TABS: { id: StudySubTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'overview', label: 'Overview', icon: 'compass' },
  { id: 'plan', label: 'Study Plan', icon: 'calendar' },
  { id: 'materials', label: 'Materials', icon: 'folder' },
  { id: 'tutor', label: 'AI Tutor', icon: 'cpu' },
  { id: 'practice', label: 'Practice', icon: 'check-circle' },
  { id: 'mastery', label: 'Mastery', icon: 'trending-up' },
];

export function StudyHeader({
  activeTab,
  onSelectTab,
  subjects,
  selectedSubjectId,
  onSelectSubject,
  countdownDays,
  examName,
}: StudyHeaderProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {/* Top Bar: Title, Exam Countdown Pill */}
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <View style={[styles.iconCapsule, { backgroundColor: 'rgba(124, 58, 237, 0.15)', borderColor: 'rgba(124, 58, 237, 0.3)' }]}>
            <Feather name="book-open" size={18} color="#A78BFA" />
          </View>
          <View>
            <Text style={[styles.screenTitle, { color: colors.text }]}>Study OS</Text>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              Plan • Learn • Practice • Master
            </Text>
          </View>
        </View>

        {countdownDays !== null && examName && (
          <View style={[styles.countdownBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.28)' }]}>
            <Feather name="clock" size={12} color="#F59E0B" />
            <Text style={styles.countdownText}>
              {countdownDays === 0 ? 'Exam Today!' : `${examName}: in ${countdownDays}d`}
            </Text>
          </View>
        )}
      </View>

      {/* Subject Filter Pills (Horizontally Scrollable) */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subjectScrollContent}
        >
          <Pressable
            onPress={() => onSelectSubject('all')}
            style={[
              styles.subjectPill,
              selectedSubjectId === 'all'
                ? { backgroundColor: '#7C3AED', borderColor: '#8B5CF6' }
                : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.subjectPillText,
                selectedSubjectId === 'all' ? { color: '#FFFFFF', fontWeight: '700' } : { color: colors.textSecondary },
              ]}
            >
              All Subjects
            </Text>
          </Pressable>

          {subjects.map((s) => {
            const isSelected = selectedSubjectId === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => onSelectSubject(s.id)}
                style={[
                  styles.subjectPill,
                  isSelected
                    ? { backgroundColor: '#7C3AED', borderColor: '#8B5CF6' }
                    : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.subjectPillText,
                    isSelected ? { color: '#FFFFFF', fontWeight: '700' } : { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {s.shortName || s.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Sub-Tabs Navigator */}
      <View style={styles.subTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabsScrollContent}
        >
          {SUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => onSelectTab(tab.id)}
                style={[
                  styles.subTabItem,
                  isActive
                    ? {
                        backgroundColor: 'rgba(124, 58, 237, 0.16)',
                        borderColor: '#7C3AED',
                      }
                    : {
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                      },
                ]}
              >
                <Feather
                  name={tab.icon}
                  size={14}
                  color={isActive ? '#A78BFA' : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.subTabLabel,
                    isActive
                      ? { color: '#FFFFFF', fontWeight: '700' }
                      : { color: colors.textSecondary, fontWeight: '500' },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCapsule: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  countdownText: {
    fontSize: typography.sizes.xs,
    color: '#F59E0B',
    fontWeight: '700',
  },
  filterSection: {
    marginBottom: spacing.xs,
  },
  subjectScrollContent: {
    paddingHorizontal: spacing.base,
    gap: spacing.xs,
  },
  subjectPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  subjectPillText: {
    fontSize: typography.sizes.xs,
  },
  subTabsContainer: {
    marginTop: spacing.xs,
  },
  subTabsScrollContent: {
    paddingHorizontal: spacing.base,
    gap: 6,
  },
  subTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  subTabLabel: {
    fontSize: typography.sizes.xs,
  },
});
