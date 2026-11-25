/**
 * KaryaDEX — Onboarding Step 9: Storage Setup
 *
 * Explains separation of app data vs user attachments and configures storage location.
 * Features:
 * - 3D extruded option blocks (Block3D) with mechanical keycap depression
 * - LuminousButton CTA
 * - Frosted glass back button
 * - Zero emojis, vector Feather icons only
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, radii } from '@/constants/theme';
import { GlassCard, Block3D, LuminousButton } from '@/components/ui';
import { GenericFileIcon } from '@/components/ui/AcademicIcons';

interface StepStorageProps {
  initialStorageType?: 'app_storage' | 'custom_folder';
  initialFolderName?: string;
  onNext: (data: { storageType: 'app_storage' | 'custom_folder'; folderName?: string }) => void;
  onBack: () => void;
}

export function StepStorage({
  initialStorageType = 'app_storage',
  initialFolderName,
  onNext,
  onBack,
}: StepStorageProps) {
  const { colors, isDark } = useTheme();
  const [storageType, setStorageType] = useState<'app_storage' | 'custom_folder'>(initialStorageType);
  const [folderName, setFolderName] = useState<string | undefined>(initialFolderName);

  const handleNext = () => {
    onNext({
      storageType,
      folderName,
    });
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : colors.text }]}>
          File Storage
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
          Where should KaryaDEX save your academic files?
        </Text>
      </View>

      {/* Explanation Glass Card */}
      <GlassCard level="primary" style={styles.explainerCard}>
        <View style={styles.explainerBadgeRow}>
          <Feather name="shield" size={14} color="#00E5FF" />
          <Text style={[styles.cardHeader, { color: isDark ? '#00E5FF' : brand.violet }]}>
            HOW STORAGE WORKS
          </Text>
        </View>
        <View style={styles.explainerRow}>
          <GenericFileIcon size={20} color="#3B82F6" />
          <View style={styles.explainerTextContainer}>
            <Text style={[styles.explainerTitle, { color: isDark ? '#FFFFFF' : colors.text }]}>
              App Data vs User Files
            </Text>
            <Text style={[styles.explainerDesc, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
              Your database, settings, and journal entries are kept in private SQLite. Lecture PDFs, scanned notes, and materials are stored separately.
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* 3D Option 1: App Storage (Default Recommended) */}
      <Block3D
        title="KaryaDEX Storage"
        subtitle="Private, zero configuration. No extra folder permissions needed."
        badge="RECOMMENDED"
        badgeColor="#00E5FF"
        selected={storageType === 'app_storage'}
        onPress={() => setStorageType('app_storage')}
        accentColor="#00E5FF"
        glowColor="rgba(0, 229, 255, 0.35)"
        icon={
          <Feather
            name="hard-drive"
            size={20}
            color={storageType === 'app_storage' ? '#00E5FF' : isDark ? '#94A3B8' : '#64748B'}
          />
        }
      />

      {/* 3D Option 2: Custom Folder */}
      <Block3D
        title="Choose a Folder"
        subtitle={
          Platform.OS === 'web'
            ? 'Save to your browser documents folder.'
            : 'Save to a dedicated folder on your device. Configure anytime in Settings.'
        }
        selected={storageType === 'custom_folder'}
        onPress={() => setStorageType('custom_folder')}
        accentColor="#00E5FF"
        glowColor="rgba(0, 229, 255, 0.35)"
        icon={
          <Feather
            name="folder"
            size={20}
            color={storageType === 'custom_folder' ? '#00E5FF' : isDark ? '#94A3B8' : '#64748B'}
          />
        }
      />

      {/* Navigation Buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: isDark ? 'rgba(10, 16, 28, 0.85)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : colors.border,
            },
            pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Feather name="chevron-left" size={18} color={isDark ? '#E2E8F0' : colors.text} />
          <Text style={[styles.backButtonText, { color: isDark ? '#E2E8F0' : colors.textSecondary }]}>
            Back
          </Text>
        </Pressable>

        <View style={styles.nextButtonWrapper}>
          <LuminousButton
            title="Continue"
            onPress={handleNext}
            size="medium"
            showArrow
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 4 },
  explainerCard: { padding: 18, borderRadius: 20, marginBottom: 16, gap: 10 },
  explainerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  explainerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  explainerTextContainer: { flex: 1 },
  explainerTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  explainerDesc: { fontSize: 13, lineHeight: 18 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  backButton: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  backButtonText: { fontSize: 15, fontWeight: '600' },
  nextButtonWrapper: {
    flex: 1,
  },
});
