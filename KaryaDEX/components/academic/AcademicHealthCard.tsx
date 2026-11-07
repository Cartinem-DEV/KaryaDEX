/**
 * BunkMatKar — AcademicHealthCard Component (Phase 6)
 *
 * Visual representation of the deterministic Academic Health Index:
 * - Overall Semester Health Score (0-100)
 * - 6 weighted dimensions (Attendance, Tasks, Syllabus, Revision, Exams, Marks)
 * - Highlights the weakest area requiring attention
 * - Expandable dimension breakdown
 * - Built with existing Liquid Glass design language
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { academicAnalyticsService } from '@/services/academicAnalyticsService';
import type { SemesterHealthReport, SemesterHealthDimension } from '@/types/academic';

interface AcademicHealthCardProps {
  report?: SemesterHealthReport;
}

export function AcademicHealthCard({ report: propReport }: AcademicHealthCardProps) {
  const { colors, isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  // Compute report if not passed via props
  const report = propReport || academicAnalyticsService.getAcademicHealth();
  const { overallScore, dimensions, mainAttentionArea } = report;

  // Determine overall score color
  const scoreColor =
    overallScore >= 75
      ? statusColors.safe
      : overallScore >= 50
      ? statusColors.watch
      : statusColors.danger;

  const dimensionList: SemesterHealthDimension[] = [
    dimensions.attendance,
    dimensions.tasks,
    dimensions.syllabus,
    dimensions.revision,
    dimensions.exams,
    dimensions.marks,
  ];

  return (
    <GlassCard level="primary" style={styles.card}>
      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>
            Academic Health Index
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Deterministic 6-dimension evaluation
          </Text>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={[styles.scoreValue, { color: scoreColor }]}>
            {overallScore}
          </Text>
          <Text style={[styles.scoreMax, { color: colors.textTertiary }]}>/100</Text>
        </View>
      </View>

      {/* Main Attention Area Banner */}
      {mainAttentionArea && (
        <View
          style={[
            styles.attentionBanner,
            {
              backgroundColor:
                mainAttentionArea.severity === 'critical'
                  ? 'rgba(239, 68, 68, 0.12)'
                  : mainAttentionArea.severity === 'high'
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'rgba(59, 130, 246, 0.12)',
              borderColor:
                mainAttentionArea.severity === 'critical'
                  ? statusColors.danger
                  : mainAttentionArea.severity === 'high'
                  ? statusColors.watch
                  : brand.violet,
            },
          ]}
        >
          <View style={{ marginRight: 6 }}>
            <Feather
              name={mainAttentionArea.severity === 'critical' ? 'alert-circle' : 'alert-triangle'}
              size={18}
              color={mainAttentionArea.severity === 'critical' ? statusColors.danger : statusColors.watch}
            />
          </View>
          <View style={styles.attentionTextWrap}>
            <Text style={[styles.attentionTitle, { color: colors.text }]}>
              {mainAttentionArea.title}
            </Text>
            <Text style={[styles.attentionSubtitle, { color: colors.textSecondary }]}>
              {mainAttentionArea.subtitle}
            </Text>
          </View>
        </View>
      )}

      {/* Dimension Quick Summary Bars */}
      <View style={styles.dimGrid}>
        {dimensionList.map((dim) => {
          const dimColor =
            dim.status === 'healthy'
              ? statusColors.safe
              : dim.status === 'warning'
              ? statusColors.watch
              : dim.status === 'critical'
              ? statusColors.danger
              : colors.textTertiary;

          return (
            <View key={dim.name} style={styles.dimItem}>
              <View style={styles.dimItemHeader}>
                <Text style={[styles.dimName, { color: colors.textSecondary }]}>
                  {dim.label}
                </Text>
                <Text style={[styles.dimScore, { color: dimColor }]}>
                  {dim.score}%
                </Text>
              </View>
              <View
                style={[
                  styles.progressBarBg,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.max(4, Math.min(100, dim.score))}%`,
                      backgroundColor: dimColor,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Expand/Collapse Toggle */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide health details' : 'Show health details'}
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => [styles.toggleBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.toggleBtnText, { color: brand.violet }]}>
          {expanded ? 'Hide Details ▲' : 'View Breakdown & Weights ▼'}
        </Text>
      </Pressable>

      {/* Detailed Breakdown */}
      {expanded && (
        <View style={styles.detailsContainer}>
          {dimensionList.map((dim) => (
            <View key={dim.name} style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Text style={[styles.detailLabel, { color: colors.text }]}>
                  {dim.label} ({Math.round(dim.weight * 100)}% weight)
                </Text>
                <Text style={[styles.detailText, { color: colors.textTertiary }]}>
                  {dim.detail}
                </Text>
              </View>
              <View
                style={[
                  styles.statusTag,
                  {
                    backgroundColor:
                      dim.status === 'healthy'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : dim.status === 'warning'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : dim.status === 'critical'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(107, 114, 128, 0.15)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusTagText,
                    {
                      color:
                        dim.status === 'healthy'
                          ? statusColors.safe
                          : dim.status === 'warning'
                          ? statusColors.watch
                          : dim.status === 'critical'
                          ? statusColors.danger
                          : colors.textTertiary,
                    },
                  ]}
                >
                  {dim.status.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.xl,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: spacing.sm,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  scoreMax: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  attentionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  attentionIcon: {
    fontSize: 18,
  },
  attentionTextWrap: {
    flex: 1,
  },
  attentionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
  attentionSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
  },
  dimGrid: {
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  dimItem: {
    marginBottom: 2,
  },
  dimItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  dimName: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
  dimScore: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  toggleBtn: {
    paddingVertical: spacing.xs,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  toggleBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  detailsContainer: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  detailLeft: {
    flex: 1,
  },
  detailLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  detailText: {
    fontSize: 11,
    marginTop: 1,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginLeft: spacing.xs,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
});
