/**
 * BunkMatKar — SCHEDULE / ACADEMIC CALENDAR Screen (Phase 9)
 *
 * Upgraded Unified Academic Calendar & Study Planning experience:
 * - Day, Week, and Month views
 * - Daily Academic Timeline (Classes, Exams, Tasks, and Study Blocks)
 * - Workload classification (Light, Moderate, Heavy, Overloaded)
 * - Daily Study Plan with time blocking & conflict detection
 * - Direct interactive class session detail & task rescheduling modal
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/ThemeContext';
import { brand, spacing, radii, typography } from '@/constants/theme';
import { AmbientBackground } from '@/components/ui';
import { SparklesIcon } from '@/components/ui/AcademicIcons';
import { AIAssistantModal } from '@/components/ai/AIAssistantModal';
import {
  SemesterSwitcher,
  AcademicCalendarView,
  ClassSessionModal,
} from '@/components/academic';

export default function ScheduleScreen() {
  const { colors, isDark } = useTheme();
  const [aiModalVisible, setAiModalVisible] = useState(false);

  const [selectedSession, setSelectedSession] = useState<{
    slotId: string;
    date: string;
    subjectId: string;
    startTime: string;
    endTime: string;
    room?: string;
    type?: any;
  } | null>(null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AmbientBackground forceDark />

      {/* ─── Header ─────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : colors.text }]}>Academic Calendar</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => setAiModalVisible(true)}
              style={({ pressed }) => [
                styles.bankuHeaderButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <SparklesIcon size={14} color="#00E5FF" />
              <Text style={styles.bankuHeaderButtonText}>Banku Import</Text>
            </Pressable>
            <SemesterSwitcher compact />
          </View>
        </View>
      </View>

      {/* ─── Calendar Body ───────────────────────── */}
      <View style={styles.calendarContainer}>
        <AcademicCalendarView onSelectSession={session => setSelectedSession(session)} />
      </View>

      {/* ─── Class Session Modal ─────────────────── */}
      {selectedSession && (
        <ClassSessionModal
          visible={!!selectedSession}
          onClose={() => setSelectedSession(null)}
          slotId={selectedSession.slotId}
          date={selectedSession.date}
          subjectId={selectedSession.subjectId}
          startTime={selectedSession.startTime}
          endTime={selectedSession.endTime}
          room={selectedSession.room}
          type={selectedSession.type}
        />
      )}

      {/* ─── AI Assistant Modal (Banku Imports) ──── */}
      <AIAssistantModal
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
        initialPersona="banku"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070B',
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: '800',
  },
  calendarContainer: {
    flex: 1,
    paddingHorizontal: spacing.base,
    marginTop: spacing.xs,
  },
  bankuHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
  },
  bankuHeaderButtonText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
  },
});
