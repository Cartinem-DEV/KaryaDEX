/**
 * KaryaDEX — Smart Attendance Explainer Card (Phase 12)
 *
 * Enforces Golden Rule 1: Deterministic Academic Math.
 * Authoritative mathematical figures are displayed directly from domain engines.
 * Shanky provides clear, conversational student guidance based on those figures.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AttendanceExplanationPayload } from '@/services/ai';
import { AIBadge } from './AIBadge';

interface AIAttendanceExplainerCardProps {
  data: AttendanceExplanationPayload;
  modelSlotName?: string;
}

export const AIAttendanceExplainerCard: React.FC<AIAttendanceExplainerCardProps> = ({
  data,
  modelSlotName,
}) => {
  const isSafe = data.deterministicPercentage >= data.deterministicTarget;
  const statusColor = isSafe ? '#10B981' : data.deterministicPercentage >= data.deterministicTarget - 5 ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <AIBadge persona="shanky" label="SHANKY ATTENDANCE INTEL" showModelTag={modelSlotName} />
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}>
          <Text style={[styles.statusPillText, { color: statusColor }]}>
            {data.attendancePressure.toUpperCase()} PRESSURE
          </Text>
        </View>
      </View>

      <Text style={styles.subjectTitle}>{data.subjectName}</Text>

      {/* Deterministic Numbers Strip (Authoritative Source of Truth) */}
      <View style={styles.metricsStrip}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>ATTENDANCE</Text>
          <Text style={[styles.metricValue, { color: statusColor }]}>
            {data.deterministicPercentage.toFixed(1)}%
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>TARGET</Text>
          <Text style={styles.metricValueWhite}>{data.deterministicTarget}%</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>SAFE BUNKS</Text>
          <Text style={[styles.metricValue, { color: data.deterministicSafeBunks > 0 ? '#10B981' : '#94A3B8' }]}>
            {data.deterministicSafeBunks}
          </Text>
        </View>

        {data.deterministicRecoveryNeeded > 0 ? (
          <>
            <View style={styles.divider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>RECOVERY</Text>
              <Text style={[styles.metricValue, { color: '#EF4444' }]}>
                +{data.deterministicRecoveryNeeded}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {/* AI Explanation Content */}
      <View style={styles.explanationSection}>
        <Text style={styles.situationSummary}>{data.situationSummary}</Text>

        <View style={styles.adviceRow}>
          <Ionicons name="information-circle-outline" size={16} color="#38BDF8" style={styles.adviceIcon} />
          <Text style={styles.adviceText}>{data.bunkAdvice}</Text>
        </View>

        {data.recoveryAdvice ? (
          <View style={styles.adviceRow}>
            <Ionicons name="trending-up-outline" size={16} color="#F59E0B" style={styles.adviceIcon} />
            <Text style={styles.adviceText}>{data.recoveryAdvice}</Text>
          </View>
        ) : null}

        <View style={styles.recommendationBox}>
          <Ionicons name="compass-outline" size={16} color="#10B981" />
          <Text style={styles.recommendationText}>{data.recommendedAction}</Text>
        </View>
      </View>

      {/* Integrity Footer */}
      <View style={styles.footer}>
        <Ionicons name="shield-checkmark-outline" size={12} color="#64748B" />
        <Text style={styles.footerText}>
          Deterministic Engine Math • Interpreted by Shanky
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  subjectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  metricsStrip: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricValueWhite: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#1E293B',
  },
  explanationSection: {
    gap: 8,
  },
  situationSummary: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 20,
    fontWeight: '500',
  },
  adviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 8,
    borderRadius: 8,
  },
  adviceIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  adviceText: {
    fontSize: 12,
    color: '#CBD5E1',
    flex: 1,
    lineHeight: 18,
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginTop: 4,
  },
  recommendationText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    gap: 6,
  },
  footerText: {
    fontSize: 10,
    color: '#64748B',
  },
});
