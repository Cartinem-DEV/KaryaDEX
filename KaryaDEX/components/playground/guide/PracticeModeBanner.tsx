/**
 * KaryaDEX — Practice Mode Banner
 *
 * Visual indicator shown during unranked practice sessions.
 * Clarifies that 0 XP, 0 ELO, and 0 streak are impacted.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { typography, radii, spacing } from '@/constants/theme';

interface PracticeModeBannerProps {
  onExitPractice?: () => void;
}

export function PracticeModeBanner({ onExitPractice }: PracticeModeBannerProps) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <View style={styles.leftContent}>
        <View style={styles.flaskIconBox}>
          <Ionicons name="flask" size={14} color="#00D9FF" />
        </View>
        <View style={styles.textColumn}>
          <Text style={styles.bannerTitle}>PRACTICE MODE</Text>
          <Text style={styles.bannerSub}>Unranked • 0 XP • 0 ELO • No Quest Progress</Text>
        </View>
      </View>

      {onExitPractice && (
        <Pressable
          onPress={onExitPractice}
          style={styles.exitButton}
          accessibilityRole="button"
          accessibilityLabel="Exit Practice Mode"
        >
          <Text style={styles.exitText}>Exit</Text>
          <Feather name="log-out" size={12} color="#94A3B8" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
    borderColor: 'rgba(0, 217, 255, 0.25)',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flaskIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  textColumn: {
    flex: 1,
  },
  bannerTitle: {
    color: '#00D9FF',
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  bannerSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 1,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  exitText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: typography.weights.medium,
  },
});
