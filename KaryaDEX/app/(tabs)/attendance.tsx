/**
 * KaryaDEX — ATTENDANCE Screen
 * 
 * Visual redesign as a premium analytics surface:
 * - Overall attendance hero card in Primary Glass
 * - Subject attendance cards in Secondary Glass with translucent status tints
 * - Elevated floating glass "Can I Bunk?" simulation bottom sheet
 * - Refined Target Picker glass modal
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import {
  GlassCard, StatusBadge, SectionHeader,
  AttendanceRing, EmptyState, AmbientBackground, GlassButton,
} from '@/components/ui';
import { Feather } from '@expo/vector-icons';
import { useAppStore } from '@/store/useAppStore';
import { canBunk } from '@/lib/attendance';
import type { SubjectAttendance } from '@/types';

export default function AttendanceScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const {
    getSubjectAttendance, getOverallAttendance,
    attendanceTarget, setAttendanceTarget,
    markAttendance,
  } = useAppStore();

  const subjectAttendance = getSubjectAttendance();
  const overall = getOverallAttendance();
  const [bunkSubject, setBunkSubject] = useState<SubjectAttendance | null>(null);
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  // Group by status
  const safeSubjects = subjectAttendance.filter(s => s.status === 'safe');
  const watchSubjects = subjectAttendance.filter(s => s.status === 'watch');
  const dangerSubjects = subjectAttendance.filter(s => s.status === 'danger');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Subtle atmospheric background orbs */}
      <AmbientBackground forceDark />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header ─────────────────────────────── */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : colors.text }]}>Attendance</Text>
          <Pressable
            onPress={() => setShowTargetPicker(true)}
            style={({ pressed }) => [
              styles.targetBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(0, 229, 255, 0.12)'
                  : 'rgba(124, 58, 237, 0.10)',
                borderColor: isDark
                  ? 'rgba(0, 229, 255, 0.32)'
                  : 'rgba(124, 58, 237, 0.18)',
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.targetBtnText, { color: isDark ? '#00E5FF' : brand.violet }]}>
              Target: {attendanceTarget}%
            </Text>
          </Pressable>
        </View>

        {/* ─── Overall Card ──────────────────────── */}
        <View style={styles.overallSection}>
          <GlassCard level="primary" style={styles.overallCard}>
            <View style={styles.overallContent}>
              <AttendanceRing
                percentage={overall.percentage}
                size={84}
                strokeWidth={6.5}
              />
              <View style={styles.overallInfo}>
                <Text style={[styles.overallLabel, { color: colors.textSecondary }]}>
                  Overall Attendance
                </Text>
                <Text style={[styles.overallPercent, { color: colors.text }]}>
                  {overall.percentage.toFixed(1)}%
                </Text>
                <Text style={[styles.overallMeta, { color: colors.textTertiary }]}>
                  {overall.attended} / {overall.total} classes attended
                </Text>
              </View>
            </View>
          </GlassCard>
        </View>

        {/* ─── Subject Groups ────────────────────── */}
        {dangerSubjects.length > 0 && (
          <>
            <SectionHeader title="DANGER ZONE" subtitle={`${dangerSubjects.length} subjects`} />
            <View style={styles.subjectList}>
              {dangerSubjects.map(sa => (
                <SubjectAttendanceCard
                  key={sa.subjectId}
                  sa={sa}
                  colors={colors}
                  isDark={isDark}
                  onPress={() => router.push(`/subject/${sa.subjectId}`)}
                  onBunkPress={() => setBunkSubject(sa)}
                  onMarkPresent={() => markAttendance(sa.subjectId, 'present')}
                  onMarkAbsent={() => markAttendance(sa.subjectId, 'absent')}
                />
              ))}
            </View>
          </>
        )}

        {watchSubjects.length > 0 && (
          <>
            <SectionHeader title="WATCH LIST" subtitle={`${watchSubjects.length} subjects`} />
            <View style={styles.subjectList}>
              {watchSubjects.map(sa => (
                <SubjectAttendanceCard
                  key={sa.subjectId}
                  sa={sa}
                  colors={colors}
                  isDark={isDark}
                  onPress={() => router.push(`/subject/${sa.subjectId}`)}
                  onBunkPress={() => setBunkSubject(sa)}
                  onMarkPresent={() => markAttendance(sa.subjectId, 'present')}
                  onMarkAbsent={() => markAttendance(sa.subjectId, 'absent')}
                />
              ))}
            </View>
          </>
        )}

        {safeSubjects.length > 0 && (
          <>
            <SectionHeader title="SAFE" subtitle={`${safeSubjects.length} subjects`} />
            <View style={styles.subjectList}>
              {safeSubjects.map(sa => (
                <SubjectAttendanceCard
                  key={sa.subjectId}
                  sa={sa}
                  colors={colors}
                  isDark={isDark}
                  onPress={() => router.push(`/subject/${sa.subjectId}`)}
                  onBunkPress={() => setBunkSubject(sa)}
                  onMarkPresent={() => markAttendance(sa.subjectId, 'present')}
                  onMarkAbsent={() => markAttendance(sa.subjectId, 'absent')}
                />
              ))}
            </View>
          </>
        )}

        {subjectAttendance.length === 0 && (
          <EmptyState
            icon={<Feather name="bar-chart-2" size={28} color="#00E5FF" />}
            title="Mark your first class to start tracking attendance."
          />
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ─── Can I Bunk? Bottom Sheet ────────────── */}
      <BunkSheet
        subject={bunkSubject}
        attendanceTarget={attendanceTarget}
        onClose={() => setBunkSubject(null)}
        colors={colors}
        isDark={isDark}
      />

      {/* ─── Target Picker ───────────────────────── */}
      <TargetPickerModal
        visible={showTargetPicker}
        currentTarget={attendanceTarget}
        onSelect={(target) => {
          setAttendanceTarget(target);
          setShowTargetPicker(false);
        }}
        onClose={() => setShowTargetPicker(false)}
        colors={colors}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

// ─── Subject Attendance Card ────────────────────────────────────

function SubjectAttendanceCard({
  sa, colors, isDark, onPress, onBunkPress,
  onMarkPresent, onMarkAbsent,
}: {
  sa: SubjectAttendance;
  colors: any;
  isDark: boolean;
  onPress: () => void;
  onBunkPress: () => void;
  onMarkPresent: () => void;
  onMarkAbsent: () => void;
}) {
  const statusTheme = {
    danger: {
      bg: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 241, 242, 0.62)',
      border: isDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(254, 205, 211, 0.85)',
      specular: isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.95)',
    },
    watch: {
      bg: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 251, 235, 0.62)',
      border: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(253, 230, 138, 0.85)',
      specular: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.95)',
    },
    safe: {
      bg: isDark ? 'rgba(16, 185, 129, 0.07)' : 'rgba(240, 253, 244, 0.62)',
      border: isDark ? 'rgba(16, 185, 129, 0.20)' : 'rgba(187, 247, 208, 0.85)',
      specular: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.95)',
    },
  };

  const st = statusTheme[sa.status];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View
        style={[
          styles.subjectCard,
          {
            backgroundColor: st.bg,
            borderColor: st.border,
            position: 'relative',
          },
          Platform.OS === 'web' &&
            ({
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              boxShadow: isDark
                ? '0 8px 24px -2px rgba(0, 0, 0, 0.45), inset 0 1px 0.5px rgba(255, 255, 255, 0.12)'
                : '0 8px 20px -2px rgba(15, 23, 42, 0.05), inset 0 1px 0.5px rgba(255, 255, 255, 0.95)',
            } as any),
        ]}
      >
        {/* Specular highlight rim */}
        <View
          pointerEvents="none"
          style={[
            styles.cardSpecular,
            { backgroundColor: st.specular },
          ]}
        />
        <View style={styles.subjectTop}>
          <View style={styles.subjectInfo}>
            <View style={[styles.subjectColorBar, { backgroundColor: sa.subject.color }]} />
            <View style={styles.subjectText}>
              <Text style={[styles.subjectName, { color: colors.text }]}>
                {sa.subject.shortName}
              </Text>
              <Text style={[styles.subjectMeta, { color: colors.textTertiary }]}>
                {sa.attended}/{sa.total} classes · {sa.total - sa.attended} missed
              </Text>
            </View>
          </View>

          <View style={styles.subjectRight}>
            <Text
              style={[
                styles.subjectPercent,
                {
                  color:
                    sa.status === 'safe'
                      ? statusColors.safe
                      : sa.status === 'watch'
                        ? statusColors.watch
                        : statusColors.danger,
                },
              ]}
            >
              {sa.percentage.toFixed(1)}%
            </Text>
            <StatusBadge variant={sa.status} size="sm" />
          </View>
        </View>

        {/* Recovery / Safety cushion info */}
        <View style={styles.subjectStats}>
          {sa.status === 'safe' && sa.safeBunks > 0 && (
            <View style={styles.statLine}>
              <Feather name="shield" size={13} color={statusColors.safe} />
              <Text style={[styles.statText, { color: statusColors.safe }]}>
                {sa.safeBunks} {sa.safeBunks === 1 ? 'class' : 'classes'} buffer above target
              </Text>
            </View>
          )}
          {sa.classesNeededToRecover > 0 && (
            <View style={styles.statLine}>
              <Feather name="alert-triangle" size={13} color={statusColors.danger} />
              <Text style={[styles.statText, { color: statusColors.danger }]}>
                Need {sa.classesNeededToRecover} consecutive classes to recover
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.subjectActions}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onMarkPresent();
            }}
            accessibilityRole="button"
            accessibilityLabel="Mark Present"
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: statusColors.safeGlass,
                borderColor: statusColors.safeBorder,
              },
              pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Feather name="check" size={13} color={statusColors.safe} />
            <Text style={[styles.actionBtnText, { color: statusColors.safe }]}>Present</Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onMarkAbsent();
            }}
            accessibilityRole="button"
            accessibilityLabel="Mark Absent"
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: statusColors.dangerGlass,
                borderColor: statusColors.dangerBorder,
              },
              pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Feather name="x" size={13} color={statusColors.danger} />
            <Text style={[styles.actionBtnText, { color: statusColors.danger }]}>Absent</Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onBunkPress();
            }}
            accessibilityRole="button"
            accessibilityLabel="View Outlook"
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(0, 229, 255, 0.14)'
                  : 'rgba(124, 58, 237, 0.10)',
                borderColor: isDark
                  ? 'rgba(0, 229, 255, 0.35)'
                  : 'rgba(124, 58, 237, 0.18)',
              },
              pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Feather name="trending-up" size={13} color={isDark ? '#00E5FF' : brand.violet} />
            <Text style={[styles.actionBtnText, { color: isDark ? '#00E5FF' : brand.violet }]}>Outlook</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Bunk Simulator Bottom Sheet ────────────────────────────────

function BunkSheet({
  subject,
  attendanceTarget,
  onClose,
  colors,
  isDark,
}: {
  subject: SubjectAttendance | null;
  attendanceTarget: number;
  onClose: () => void;
  colors: any;
  isDark: boolean;
}) {
  if (!subject) return null;

  const result = canBunk(subject.attended, subject.total, attendanceTarget);

  return (
    <Modal visible={!!subject} animationType="slide" transparent>
      <Pressable
        style={[
          styles.bunkOverlay,
          Platform.OS === 'web' &&
            ({
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            } as any),
        ]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.bunkSheet,
            {
              backgroundColor: isDark
                ? 'rgba(18, 19, 28, 0.78)'
                : 'rgba(255, 255, 255, 0.80)',
              borderColor: isDark
                ? 'rgba(255, 255, 255, 0.16)'
                : 'rgba(255, 255, 255, 0.92)',
              position: 'relative',
            },
            Platform.OS === 'web' &&
              ({
                backdropFilter: 'blur(32px) saturate(190%)',
                WebkitBackdropFilter: 'blur(32px) saturate(190%)',
                boxShadow: isDark
                  ? '0 -16px 48px rgba(0, 0, 0, 0.75), inset 0 1.5px 1px rgba(255, 255, 255, 0.24)'
                  : '0 -16px 48px rgba(15, 23, 42, 0.12), inset 0 1.5px 1px rgba(255, 255, 255, 1)',
              } as any),
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Top Specular Rim */}
          <View
            pointerEvents="none"
            style={[
              styles.cardSpecular,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.25)'
                  : 'rgba(255, 255, 255, 0.98)',
              },
            ]}
          />
          <View
            style={[
              styles.dragHandle,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.20)'
                  : 'rgba(15, 23, 42, 0.15)',
              },
            ]}
          />

          <View
            style={[
              styles.bunkBadgeIcon,
              {
                backgroundColor: result.canBunk
                  ? 'rgba(16, 185, 129, 0.14)'
                  : 'rgba(239, 68, 68, 0.14)',
                borderColor: result.canBunk
                  ? 'rgba(16, 185, 129, 0.35)'
                  : 'rgba(239, 68, 68, 0.35)',
              },
            ]}
          >
            <Feather
              name={result.canBunk ? 'shield' : 'alert-triangle'}
              size={26}
              color={result.canBunk ? statusColors.safe : statusColors.danger}
            />
          </View>
          <Text style={[styles.bunkTitle, { color: colors.text }]}>
            Attendance Outlook · {subject.subject.shortName}
          </Text>

          {/* Current vs Projected */}
          <View style={styles.bunkStats}>
            <View
              style={[
                styles.bunkStatCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(26, 28, 42, 0.65)'
                    : 'rgba(255, 255, 255, 0.72)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.10)'
                    : 'rgba(255, 255, 255, 0.88)',
                },
                Platform.OS === 'web' &&
                  ({
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    boxShadow: isDark
                      ? '0 4px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.12)'
                      : '0 4px 12px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.95)',
                  } as any),
              ]}
            >
              <Text style={[styles.bunkStatLabel, { color: colors.textTertiary }]}>Current</Text>
              <Text style={[styles.bunkStatValue, { color: colors.text }]}>
                {result.currentPercentage.toFixed(1)}%
              </Text>
            </View>

            <View style={styles.bunkArrow}>
              <Text style={{ color: brand.violet, fontSize: 22, fontWeight: '700' }}>→</Text>
            </View>

            <View
              style={[
                styles.bunkStatCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(30, 32, 48, 0.7)'
                    : 'rgba(241, 243, 250, 0.8)',
                  borderColor: result.canBunk
                    ? statusColors.safeBorder
                    : statusColors.dangerBorder,
                },
              ]}
            >
              <Text style={[styles.bunkStatLabel, { color: colors.textTertiary }]}>If 1 class missed</Text>
              <Text
                style={[
                  styles.bunkStatValue,
                  {
                    color: result.canBunk ? statusColors.safe : statusColors.danger,
                  },
                ]}
              >
                {result.projectedPercentage.toFixed(1)}%
              </Text>
            </View>
          </View>

          {/* Target line */}
          <View
            style={[
              styles.targetLine,
              {
                backgroundColor: isDark
                  ? 'rgba(30, 32, 48, 0.5)'
                  : 'rgba(241, 243, 250, 0.6)',
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.targetLineText, { color: colors.textSecondary }]}>
              Attendance Target: <Text style={{ fontWeight: '700', color: colors.text }}>{attendanceTarget}%</Text>
            </Text>
          </View>

          {/* Verdict */}
          <View
            style={[
              styles.verdict,
              {
                backgroundColor: result.canBunk ? statusColors.safeGlass : statusColors.dangerGlass,
                borderColor: result.canBunk ? statusColors.safeBorder : statusColors.dangerBorder,
              },
            ]}
          >
            {result.canBunk ? (
              <Feather name="check-circle" size={18} color={statusColors.safe} />
            ) : (
              <Feather name="x-circle" size={18} color={statusColors.danger} />
            )}
            <Text
              style={[
                styles.verdictText,
                {
                  color: result.canBunk ? statusColors.safe : statusColors.danger,
                },
              ]}
            >
              {result.message}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(35, 37, 52, 0.8)'
                  : 'rgba(238, 240, 248, 0.9)',
                borderColor: colors.border,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.closeBtnText, { color: colors.text }]}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Target Picker Modal ────────────────────────────────────────

function TargetPickerModal({
  visible, currentTarget, onSelect, onClose, colors, isDark,
}: {
  visible: boolean;
  currentTarget: number;
  onSelect: (target: number) => void;
  onClose: () => void;
  colors: any;
  isDark: boolean;
}) {
  const targets = [75, 80, 85, 90];

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <Pressable
        style={[
          styles.bunkOverlay,
          Platform.OS === 'web' &&
            ({
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            } as any),
        ]}
        onPress={onClose}
      >
        <View
          style={[
            styles.pickerContent,
            {
              backgroundColor: isDark
                ? 'rgba(18, 19, 28, 0.78)'
                : 'rgba(255, 255, 255, 0.80)',
              borderColor: isDark
                ? 'rgba(255, 255, 255, 0.16)'
                : 'rgba(255, 255, 255, 0.92)',
              position: 'relative',
            },
            Platform.OS === 'web' &&
              ({
                backdropFilter: 'blur(32px) saturate(190%)',
                WebkitBackdropFilter: 'blur(32px) saturate(190%)',
                boxShadow: isDark
                  ? '0 24px 56px rgba(0, 0, 0, 0.75), inset 0 1.5px 1px rgba(255, 255, 255, 0.22)'
                  : '0 24px 56px rgba(15, 23, 42, 0.14), inset 0 1.5px 1px rgba(255, 255, 255, 1)',
              } as any),
          ]}
        >
          {/* Top Specular Rim */}
          <View
            pointerEvents="none"
            style={[
              styles.cardSpecular,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.22)'
                  : 'rgba(255, 255, 255, 0.98)',
              },
            ]}
          />
          <Text style={[styles.pickerTitle, { color: colors.text }]}>Attendance Target</Text>
          {targets.map((target) => (
            <Pressable
              key={target}
              onPress={() => onSelect(target)}
              style={({ pressed }) => [
                styles.pickerOption,
                {
                  backgroundColor:
                    currentTarget === target
                      ? isDark ? 'rgba(0, 229, 255, 0.16)' : 'rgba(255, 255, 255, 0.90)'
                      : isDark ? 'rgba(26, 28, 42, 0.45)' : 'rgba(255, 255, 255, 0.52)',
                  borderColor:
                    currentTarget === target
                      ? isDark ? '#00E5FF' : 'rgba(255, 255, 255, 1)'
                      : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.72)',
                  borderWidth: 1,
                },
                currentTarget === target &&
                  Platform.OS === 'web' &&
                  ({
                    boxShadow: isDark
                      ? '0 4px 14px rgba(0, 229, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
                      : '0 4px 12px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,1)',
                  } as any),
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text
                style={{
                  color: currentTarget === target ? (isDark ? '#00E5FF' : colors.text) : colors.textSecondary,
                  fontSize: 16,
                  fontWeight: currentTarget === target ? '800' : '600',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {target}%
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070B' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 110 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
  targetBtn: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  targetBtnText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
  },

  // Overall
  overallSection: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  overallCard: { padding: spacing.lg },
  overallContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  overallInfo: { flex: 1 },
  overallLabel: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.2,
  },
  overallPercent: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  overallMeta: {
    fontSize: typography.sizes.xs + 1,
    marginTop: 2,
  },

  // Subject list
  subjectList: {
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  subjectCard: {
    borderRadius: radii.xl,
    padding: spacing.base,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardSpecular: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    opacity: 0.85,
    borderRadius: 1,
  },
  subjectTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  subjectColorBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  subjectText: { flex: 1 },
  subjectName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  subjectMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  subjectRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  subjectPercent: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  subjectStats: {
    paddingTop: spacing.sm,
    paddingLeft: spacing.base + 4,
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  statText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  subjectActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },

  // Bunk sheet
  bunkOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  bunkSheet: {
    borderTopLeftRadius: radii['3xl'],
    borderTopRightRadius: radii['3xl'],
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 44 : spacing.xl,
    alignItems: 'center',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.base,
  },
  bunkBadgeIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  bunkEmoji: {
    fontSize: 44,
    marginBottom: spacing.sm,
  },
  bunkTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.lg,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  bunkStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.base,
    width: '100%',
  },
  bunkStatCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  bunkStatLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginBottom: 4,
  },
  bunkStatValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  bunkArrow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  targetLine: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.base,
    width: '100%',
    alignItems: 'center',
  },
  targetLineText: {
    fontSize: typography.sizes.xs + 1,
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
    width: '100%',
    marginBottom: spacing.lg,
  },
  verdictIcon: {
    fontSize: 20,
  },
  verdictText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    flex: 1,
    lineHeight: 20,
  },
  closeBtn: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: typography.weights.bold,
  },

  // Target picker
  pickerContent: {
    margin: spacing.xl,
    padding: spacing.xl,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    alignSelf: 'center',
    width: 280,
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  pickerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.base,
    textAlign: 'center',
  },
  pickerOption: {
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
