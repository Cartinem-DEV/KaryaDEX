/**
 * BunkMatKar — Daily AI Briefing Card (Phase 12)
 *
 * Displays prioritized morning intelligence:
 * "What should I do today?", classes, urgent tasks, attendance warnings.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DailyBriefingPayload } from '@/services/ai';
import { AIBadge } from './AIBadge';

interface AIDailyBriefingCardProps {
  data: DailyBriefingPayload;
  onRefresh?: () => void;
}

export const AIDailyBriefingCard: React.FC<AIDailyBriefingCardProps> = ({
  data,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AIBadge persona="shanky" label="SHANKY BRIEFING" />
        <Text style={styles.dateText}>{data.summaryDate}</Text>
      </View>

      <Text style={styles.greeting}>{data.greeting}</Text>
      <Text style={styles.headline}>{data.headline}</Text>

      {/* Attendance Alert if present */}
      {data.attendanceAlert ? (
        <View style={styles.alertBox}>
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>
              {data.attendanceAlert.subjectName} ({data.attendanceAlert.currentAttendance.toFixed(1)}%)
            </Text>
            <Text style={styles.alertAdvice}>{data.attendanceAlert.advice}</Text>
          </View>
        </View>
      ) : null}

      {/* Schedule Highlights */}
      {data.scheduleHighlights && data.scheduleHighlights.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TODAY'S SCHEDULE</Text>
          {data.scheduleHighlights.map((item, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <Ionicons name="time-outline" size={14} color="#38BDF8" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Priority Tasks */}
      {data.priorityTasks && data.priorityTasks.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRIORITY TASKS</Text>
          {data.priorityTasks.map((task, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <Ionicons name="checkbox-outline" size={14} color="#10B981" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>{task}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Recommended Action */}
      <View style={styles.recommendationBanner}>
        <Ionicons name="flash-outline" size={16} color="#F59E0B" />
        <Text style={styles.recommendationText}>{data.actionRecommendation}</Text>
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
  dateText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  greeting: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  headline: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
    marginBottom: 12,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  alertAdvice: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bulletIcon: {
    marginRight: 6,
  },
  bulletText: {
    color: '#E2E8F0',
    fontSize: 13,
  },
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 6,
  },
  recommendationText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
