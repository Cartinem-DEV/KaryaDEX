/**
 * KaryaDEX — Guest Progress Claim & Conflict Resolution Modal
 *
 * Provides the explicit user confirmation interface for claiming guest Playground progress
 * into an authenticated account, or resolving profile conflicts without silent merging.
 * Follows KaryaDEX obsidian liquid glass styling, specular highlights, and strict vector iconography.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { typography, radii, spacing } from '@/constants/theme';
import type { GuestClaimPromptData, ConflictResolutionOption } from '@/types/playground';

interface GuestClaimModalProps {
  visible: boolean;
  promptData: GuestClaimPromptData | null;
  onResolve: (resolution: ConflictResolutionOption) => Promise<void>;
  onDismiss: () => void;
}

export function GuestClaimModal({
  visible,
  promptData,
  onResolve,
  onDismiss,
}: GuestClaimModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  if (!promptData || !visible) {
    return null;
  }

  const { guestProfile, accountProfile, hasConflict } = promptData;

  const handleAction = async (resolution: ConflictResolutionOption) => {
    if (resolution === 'replace_account' && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }

    setIsProcessing(true);
    try {
      await onResolve(resolution);
      setConfirmReplace(false);
    } catch (err: any) {
      Alert.alert('Migration Error', err?.message || 'Could not process progress claim.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Header Icon */}
            <View style={[styles.iconBadge, { borderColor: hasConflict ? '#F59E0B' : '#00D9FF' }]}>
              {hasConflict ? (
                <Feather name="alert-triangle" size={28} color="#F59E0B" />
              ) : (
                <MaterialCommunityIcons name="trophy-award" size={32} color="#00D9FF" />
              )}
            </View>

            {/* Title & Description */}
            <Text style={styles.title}>
              {hasConflict ? 'Playground Progress Conflict' : 'Claim Your Playground Progress'}
            </Text>
            <Text style={styles.subtitle}>
              {hasConflict
                ? 'Your authenticated KaryaDEX account already has saved Playground progress. Choose which profile you want to keep active on this device.'
                : 'You earned progress while playing as a guest. Claim it into your authenticated KaryaDEX account now.'}
            </Text>

            {/* Non-Conflict Preview Card */}
            {!hasConflict && (
              <View style={styles.statsCard}>
                <Text style={styles.sectionHeader}>GUEST STATS TO CLAIM</Text>
                <View style={styles.statGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{guestProfile.brainXp.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>Brain XP</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{guestProfile.brainRating}</Text>
                    <Text style={styles.statLabel}>Rating</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{guestProfile.totalMatches}</Text>
                    <Text style={styles.statLabel}>Matches</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{guestProfile.escapeStreak}d</Text>
                    <Text style={styles.statLabel}>Streak</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Conflict Side-by-Side Comparison */}
            {hasConflict && (
              <View style={styles.comparisonWrapper}>
                {/* Account Profile Card */}
                <View style={[styles.compareCard, styles.accountCardBorder]}>
                  <View style={styles.cardHeaderRow}>
                    <Ionicons name="cloud-done-outline" size={16} color="#00D9FF" />
                    <Text style={[styles.compareCardTitle, { color: '#00D9FF' }]}>Account Profile</Text>
                  </View>
                  <View style={styles.compareStatRow}>
                    <Text style={styles.compareLabel}>Brain XP</Text>
                    <Text style={styles.compareValue}>{accountProfile.brainXp.toLocaleString()}</Text>
                  </View>
                  <View style={styles.compareStatRow}>
                    <Text style={styles.compareLabel}>Rating</Text>
                    <Text style={styles.compareValue}>{accountProfile.brainRating}</Text>
                  </View>
                  <View style={styles.compareStatRow}>
                    <Text style={styles.compareLabel}>Matches</Text>
                    <Text style={styles.compareValue}>{accountProfile.totalMatches}</Text>
                  </View>
                  <View style={styles.compareStatRow}>
                    <Text style={styles.compareLabel}>Streak</Text>
                    <Text style={styles.compareValue}>{accountProfile.escapeStreak}d</Text>
                  </View>
                </View>

                {/* Guest Profile Card */}
                <View style={[styles.compareCard, styles.guestCardBorder]}>
                  <View style={styles.cardHeaderRow}>
                    <Feather name="smartphone" size={16} color="#A855F7" />
                    <Text style={[styles.compareCardTitle, { color: '#A855F7' }]}>Guest Profile</Text>
                  </View>
                  <View style={styles.compareStatRow}>
                    <Text style={styles.compareLabel}>Brain XP</Text>
                    <Text style={styles.compareValue}>{guestProfile.brainXp.toLocaleString()}</Text>
                  </View>
                  <View style={styles.compareStatRow}>
                    <Text style={styles.compareLabel}>Rating</Text>
                    <Text style={styles.compareValue}>{guestProfile.brainRating}</Text>
                  </View>
                  <View style={styles.compareStatRow}>
                    <Text style={styles.compareLabel}>Matches</Text>
                    <Text style={styles.compareValue}>{guestProfile.totalMatches}</Text>
                  </View>
                  <View style={styles.compareStatRow}>
                    <Text style={styles.compareLabel}>Streak</Text>
                    <Text style={styles.compareValue}>{guestProfile.escapeStreak}d</Text>
                  </View>
                </View>
              </View>
            )}

            {hasConflict && confirmReplace && (
              <View style={styles.warningBox}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.warningText}>
                  Replacing will overwrite your account profile with guest stats. A recovery backup will be preserved.
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsContainer}>
              {isProcessing ? (
                <ActivityIndicator size="large" color="#00D9FF" style={{ marginVertical: 16 }} />
              ) : !hasConflict ? (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                    onPress={() => handleAction('claim')}
                  >
                    <Text style={styles.primaryBtnText}>Claim Progress</Text>
                    <Feather name="arrow-right" size={16} color="#05070B" />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
                    onPress={onDismiss}
                  >
                    <Text style={styles.secondaryBtnText}>Keep Separate for Now</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                    onPress={() => handleAction('keep_account')}
                  >
                    <Text style={styles.primaryBtnText}>Keep Account Progress</Text>
                    <Feather name="check" size={16} color="#05070B" />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.replaceBtn,
                      confirmReplace && styles.dangerActiveBtn,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => handleAction('replace_account')}
                  >
                    <Text style={[styles.replaceBtnText, confirmReplace && { color: '#FFFFFF' }]}>
                      {confirmReplace ? 'Confirm Replace Account' : 'Replace With Guest Progress'}
                    </Text>
                    <Feather name="refresh-cw" size={15} color={confirmReplace ? '#FFFFFF' : '#EF4444'} />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
                    onPress={() => {
                      setConfirmReplace(false);
                      onDismiss();
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Decide Later</Text>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 11, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0A0E17',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  scrollContent: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0F1626',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.regular,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  statsCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    color: '#00D9FF',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.regular,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  comparisonWrapper: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  compareCard: {
    flex: 1,
    backgroundColor: '#0F1626',
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
  },
  accountCardBorder: {
    borderColor: 'rgba(0, 217, 255, 0.3)',
  },
  guestCardBorder: {
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  compareCardTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
  },
  compareStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  compareLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.regular,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  compareValue: {
    fontSize: 11,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
  },
  warningText: {
    fontSize: 12,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.regular,
    color: '#FCA5A5',
    flex: 1,
    lineHeight: 16,
  },
  actionsContainer: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: '#00D9FF',
    borderRadius: radii.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    color: '#05070B',
  },
  replaceBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dangerActiveBtn: {
    backgroundColor: '#DC2626',
    borderColor: '#EF4444',
  },
  replaceBtnText: {
    fontSize: 13,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.bold,
    color: '#EF4444',
  },
  secondaryBtn: {
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.regular,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
