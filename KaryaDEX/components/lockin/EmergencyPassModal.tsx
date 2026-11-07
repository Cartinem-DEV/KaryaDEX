import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, spacing, typography, radii } from '@/constants/theme';
import { lockinStorage } from '../../services/lockin/lockinStorage';
import type { LockinEmergencyPass } from '@/types/lockin';

interface EmergencyPassModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onUsePass?: () => void;
}

export function EmergencyPassModal({ visible, userId, onClose, onUsePass }: EmergencyPassModalProps) {
  const { colors } = useTheme();
  const [passData, setPassData] = useState<LockinEmergencyPass | null>(null);
  const [isUsingPass, setIsUsingPass] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPassData();
    }
  }, [visible, userId]);

  const loadPassData = async () => {
    const data = await lockinStorage.getEmergencyPassStatus(userId);
    setPassData(data);
  };

  const handleUsePass = async () => {
    if (!passData || passData.usedThisWeek >= passData.weeklyAllowance) return;

    setIsUsingPass(true);
    try {
      const success = await lockinStorage.useEmergencyPass(userId);
      if (success) {
        loadPassData();
        onUsePass?.();
        onClose();
      }
    } finally {
      setIsUsingPass(false);
    }
  };

  const formatWeek = (weekStr: string) => {
    const [year, week] = weekStr.split('-W');
    return `Week ${week}, ${year}`;
  };

  const getWeekProgress = () => {
    if (!passData) return 0;
    return (passData.usedThisWeek / passData.weeklyAllowance) * 100;
  };

  const canUsePass = passData && passData.usedThisWeek < passData.weeklyAllowance;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Emergency Break Pass</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Use a pass to temporarily pause Hard Strict Mode blocking for {passData?.passDurationMinutes || 5} minutes.
          </Text>

          {/* Pass Status Card */}
          <View style={[styles.statusCard, { backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.statusHeader}>
              <View style={styles.statusIcon}>
                <Ionicons name={canUsePass ? 'shield-checkmark' : 'shield'} size={28} color={canUsePass ? brand.violet : colors.textTertiary} />
              </View>
              <View style={styles.statusInfo}>
                <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Weekly Allowance</Text>
                <Text style={[styles.statusValue, { color: colors.text }]}>
                  {passData?.usedThisWeek || 0} / {passData?.weeklyAllowance || 2} used
                </Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(getWeekProgress(), 100)}%`,
                      backgroundColor: canUsePass ? brand.violet : colors.textTertiary,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressLabels}>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Reset: {passData ? formatWeek(passData.lastResetWeek) : '—'}</Text>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>{passData?.weeklyAllowance || 2} passes per week</Text>
              </View>
            </View>

            <View style={styles.passDetails}>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Pass Duration</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{passData?.passDurationMinutes || 5} minutes</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
                <Text style={[
                  styles.detailValue,
                  { color: canUsePass ? '#22c55e' : '#ef4444', fontWeight: '600' },
                ]}>
                  {canUsePass ? 'Available' : 'Exhausted'}
                </Text>
              </View>
            </View>
          </View>

          {/* Use Pass Button */}
          <TouchableOpacity
            style={[
              styles.usePassButton,
              {
                backgroundColor: canUsePass ? brand.violet : colors.textTertiary,
                opacity: isUsingPass ? 0.7 : 1,
              },
            ]}
            onPress={handleUsePass}
            disabled={!canUsePass || isUsingPass}
          >
            {isUsingPass ? (
              <Text style={styles.usePassText}>Using Pass...</Text>
            ) : canUsePass ? (
              <>
                <Ionicons name="flash" size={20} color="#FFF" style={styles.buttonIcon} />
                <Text style={styles.usePassText}>Use Emergency Pass</Text>
              </>
            ) : (
              <Text style={styles.usePassText}>No Passes Remaining</Text>
            )}
          </TouchableOpacity>

          {/* How it works */}
          <View style={styles.infoSection}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>How It Works</Text>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={18} color={brand.violet} style={styles.infoIcon} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Available only during Hard Strict Mode sessions</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={18} color={brand.violet} style={styles.infoIcon} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Grants {passData?.passDurationMinutes || 5} minutes of unrestricted access</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={18} color={brand.violet} style={styles.infoIcon} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Automatically resumes blocking when time expires</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={18} color={brand.violet} style={styles.infoIcon} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Weekly allowance resets every Monday</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.base },
  container: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  description: { fontSize: 14, marginBottom: 20, lineHeight: 20, textAlign: 'center' },
  statusCard: { borderRadius: 16, padding: 20, marginBottom: 20 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  statusIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(139,92,246,0.15)', alignItems: 'center', justifyContent: 'center' },
  statusInfo: { flex: 1 },
  statusLabel: { fontSize: 13, marginBottom: 4 },
  statusValue: { fontSize: 24, fontWeight: '700' },
  progressContainer: { marginBottom: 16 },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressLabel: { fontSize: 12 },
  passDetails: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  detailItem: { alignItems: 'center' },
  detailLabel: { fontSize: 12, marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '600' },
  usePassButton: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 24 },
  usePassText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  buttonIcon: { marginRight: 4 },
  infoSection: { paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  infoTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoIcon: { marginRight: 2 },
  infoText: { fontSize: 13, flex: 1 },
});