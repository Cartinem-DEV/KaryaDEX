/**
 * BunkMatKar — StorageSettingsModal
 *
 * User Files Location management:
 * - Differentiates APP DATA from USER FILES
 * - Allows switching between "BunkMatKar App Storage (Recommended)" and "Choose folder on device" (Android SAF)
 * - Safe migration handling with progress and error reporting
 * - Reset to app storage
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import {
  CloseIcon,
  StorageHardDriveIcon,
  CheckmarkIcon,
  OptionsDotsIcon,
} from '@/components/ui/AcademicIcons';
import { fileStorageService } from '@/services/fileStorageService';

interface StorageSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function StorageSettingsModal({ visible, onClose }: StorageSettingsModalProps) {
  const { colors, isDark } = useTheme();
  const caps = fileStorageService.getPlatformCapabilities();
  const [pref, setPref] = useState(fileStorageService.getStoragePreference());
  const [migrating, setMigrating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSelectAppStorage = () => {
    fileStorageService.setStoragePreference({
      storageType: 'app_storage',
      folderUri: undefined,
      folderName: undefined,
    });
    setPref(fileStorageService.getStoragePreference());
    setMessage('Storage set to KaryaDEX App Storage.');
    setTimeout(() => setMessage(null), 3000);
  };

  const handleChooseCustomFolder = async () => {
    if (!caps.canChooseFolder) {
      Alert.alert(
        'Platform Storage Notice',
        `${caps.platformName} manages files securely within the application container. Custom folder selection is not needed on this OS.`
      );
      return;
    }

    const res = await fileStorageService.requestCustomFolderPermission();
    if (res.granted && res.directoryUri) {
      setPref(fileStorageService.getStoragePreference());
      setMessage('Custom folder selected and authorized.');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    const res = await fileStorageService.migrateFiles(pref.folderUri);
    setMigrating(false);
    if (res.errors.length > 0) {
      Alert.alert('Migration completed with notices', res.errors.join('\n'));
    } else {
      Alert.alert('Migration Complete', `Successfully verified and synchronized ${res.migratedCount} file(s).`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: isDark ? 'rgba(18, 20, 32, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.10)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <StorageHardDriveIcon size={20} color={brand.violet} />
              <Text style={[styles.title, { color: colors.text }]}>User Files Location</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <CloseIcon size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            BunkMatKar separates App Data (attendance, database, settings) from your User Files
            (lecture PDFs, PowerPoint slides, scanned camera notes, and attached study documents).
          </Text>

          {message && (
            <View style={[styles.messageBanner, { backgroundColor: brand.violet + '20' }]}>
              <Text style={[styles.messageText, { color: brand.violet }]}>{message}</Text>
            </View>
          )}

          {/* Option 1: App Storage */}
          <Pressable
            onPress={handleSelectAppStorage}
            style={[
              styles.optionCard,
              {
                backgroundColor:
                  pref.storageType === 'app_storage'
                    ? brand.violet + '18'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.03)',
                borderColor:
                  pref.storageType === 'app_storage'
                    ? brand.violet
                    : isDark
                    ? 'rgba(255, 255, 255, 0.10)'
                    : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
          >
            <View style={styles.optionLeft}>
              <View style={styles.optionHeaderRow}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>
                  KaryaDEX App Storage
                </Text>
                <View style={styles.recBadge}>
                  <Text style={styles.recBadgeText}>RECOMMENDED</Text>
                </View>
              </View>
              <Text style={[styles.optionMeta, { color: colors.textTertiary }]}>
                {caps.description}
              </Text>
            </View>
            {pref.storageType === 'app_storage' && (
              <CheckmarkIcon size={18} color={brand.violet} />
            )}
          </Pressable>

          {/* Option 2: Choose folder on device */}
          <Pressable
            onPress={handleChooseCustomFolder}
            style={[
              styles.optionCard,
              {
                backgroundColor:
                  pref.storageType === 'custom_folder'
                    ? brand.violet + '18'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.03)',
                borderColor:
                  pref.storageType === 'custom_folder'
                    ? brand.violet
                    : isDark
                    ? 'rgba(255, 255, 255, 0.10)'
                    : 'rgba(0, 0, 0, 0.08)',
                opacity: caps.canChooseFolder ? 1 : 0.6,
              },
            ]}
          >
            <View style={styles.optionLeft}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                Choose a folder on this device
              </Text>
              <Text style={[styles.optionMeta, { color: colors.textTertiary }]}>
                {pref.folderName
                  ? `Authorized folder: ${pref.folderName}`
                  : caps.canChooseFolder
                  ? 'Store PDFs directly in an accessible device folder'
                  : 'Available on Android via Storage Access Framework'}
              </Text>
            </View>
            {pref.storageType === 'custom_folder' && (
              <CheckmarkIcon size={18} color={brand.violet} />
            )}
          </Pressable>

          {/* Action Row */}
          <View style={styles.actions}>
            <Pressable
              onPress={handleMigrate}
              disabled={migrating}
              style={[
                styles.migrateBtn,
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.15)',
                },
              ]}
            >
              {migrating ? (
                <ActivityIndicator size="small" color={brand.violet} />
              ) : (
                <Text style={[styles.migrateBtnText, { color: colors.text }]}>
                  Move Existing Files
                </Text>
              )}
            </Pressable>

            <Pressable onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 500,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
  },
  messageBanner: {
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  messageText: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.sm,
  },
  optionLeft: {
    flex: 1,
    gap: 4,
  },
  optionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  optionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  recBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  recBadgeText: {
    color: statusColors.safe,
    fontSize: 9,
    fontWeight: typography.weights.bold,
  },
  optionMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  migrateBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  migrateBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  doneBtn: {
    flex: 1,
    backgroundColor: brand.violet,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFF',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
});
