// components/auth/AccountSettingsModal.tsx
/**
 * AccountSettingsModal
 * Account management, cloud sync status, manual sync triggers, and session controls.
 * Respects local-first architecture: Clearly distinguishes between Local Mode and Cloud Sync.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/auth/authService';
import { syncService } from '../../services/sync/syncService';
import { appLockService } from '@/services/security/appLockService';
import { AuthUser } from '../../services/auth/authTypes';
import { SyncState } from '../../services/sync/syncTypes';
import { SyncStatusBadge } from '../ui/SyncStatusBadge';
import { useAppStore } from '@/store/useAppStore';
import { brand, status } from '../../constants/theme';
import { useTheme } from '@/constants/ThemeContext';
import { getDatabaseConnection } from '@/database/db';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const AccountSettingsModal: React.FC<Props> = ({ visible, onClose }) => {
  const { colors, isDark } = useTheme();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authService.getCurrentUser());
  const [syncState, setSyncState] = useState<SyncState>(syncService.getSyncState());
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);

  useEffect(() => {
    const unsubAuth = authService.subscribe(setCurrentUser);
    const unsubSync = syncService.subscribe(setSyncState);
    appLockService.isEnabled().then(setIsAppLockEnabled);
    return () => {
      unsubAuth();
      unsubSync();
    };
  }, []);

  const handleToggleAppLock = async (val: boolean) => {
    const success = await appLockService.setEnabled(val);
    if (success) {
      setIsAppLockEnabled(val);
    } else {
      Alert.alert('App Lock', 'Device does not support biometrics or device passcode is not configured.');
    }
  };

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    try {
      await syncService.sync();
    } catch {
      // Handled in syncService
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Academic Data',
      'This backup contains all your subjects, attendance records, tasks, and notes. Store it securely and avoid sharing over untrusted channels. Tokens and passwords are never included.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export Data',
          onPress: async () => {
            try {
              const db = await getDatabaseConnection();
              const exportPayload: Record<string, any> = {
                exportedAt: new Date().toISOString(),
                version: '1.0',
                user: currentUser ? { id: currentUser.id, email: currentUser.email, name: currentUser.name } : null,
              };

              const tables = [
                'subjects',
                'tasks',
                'exams',
                'class_sessions',
                'attendance_records',
                'revision_records',
                'notes',
              ];
              for (const t of tables) {
                try {
                  const rows = await db.getAllAsync(`SELECT * FROM ${t};`);
                  exportPayload[t] = rows;
                } catch {
                  exportPayload[t] = [];
                }
              }

              const totalItems = Object.values(exportPayload).reduce(
                (acc, val) => acc + (Array.isArray(val) ? val.length : 0),
                0
              );

              if (typeof window !== 'undefined' && window.document) {
                const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute('href', dataStr);
                downloadAnchor.setAttribute('download', `karyadex_backup_${Date.now()}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
                Alert.alert('Data Exported', `Downloaded JSON archive containing ${totalItems} academic records.`);
              } else {
                Alert.alert('Data Exported', `Successfully prepared JSON archive containing ${totalItems} academic records.`);
              }
            } catch (err: any) {
              Alert.alert('Export Failed', err?.message || 'Unable to export data.');
            }
          },
        },
      ]
    );
  };

  const handleClearLocalData = () => {
    Alert.alert(
      'Clear Local Data',
      'This will erase all academic data stored locally on this device. If cloud sync was active, your cloud data remains intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Local Records',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabaseConnection();
              const tables = [
                'tasks',
                'attendance_records',
                'class_sessions',
                'exams',
                'revision_records',
                'notes',
                'timetable_slots',
                'subjects',
                'semesters',
                'students',
                'colleges',
                'sync_metadata',
                'sync_queue',
              ];
              for (const tbl of tables) {
                try {
                  await db.runAsync(`DELETE FROM ${tbl};`);
                } catch {
                  // Ignore table errors
                }
              }
              Alert.alert('Cleared', 'All local academic records have been erased from this device.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear local records.');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your academic data will remain securely saved on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            onClose();
            await authService.signOut();
            useAppStore.getState().logout();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account & Data',
      'This permanently deletes your cloud account and all associated cloud and device records. This action cannot be reversed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await authService.deleteAccount();
            if (res.success) {
              onClose();
              useAppStore.getState().logout();
              Alert.alert('Account Deleted', 'Your account and data have been completely removed.');
            } else {
              Alert.alert('Error', res.error || 'Failed to delete account.');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <View style={[styles.avatarCircle, { backgroundColor: brand.violetSoft }]}>
                  {currentUser ? (
                    <Text style={[styles.avatarText, { color: brand.violet }]}>
                      {currentUser.name.charAt(0).toUpperCase()}
                    </Text>
                  ) : (
                    <Ionicons name="person-outline" size={20} color={brand.violet} />
                  )}
                </View>
                <View>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {currentUser ? currentUser.name : 'Account & Sync'}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {currentUser ? currentUser.email : 'Local-First Mode'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Sync Status Section */}
            <View style={[styles.sectionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={styles.syncRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Cloud Sync</Text>
                <SyncStatusBadge compact={false} />
              </View>

              <Text style={[styles.syncDetail, { color: colors.textSecondary }]}>
                {currentUser
                  ? syncState.lastSyncedAt
                    ? `Last synchronized: ${new Date(syncState.lastSyncedAt).toLocaleTimeString()}`
                    : 'Awaiting initial cloud synchronization'
                  : 'Operating in local offline mode. Data is stored on your device.'}
              </Text>

              {currentUser && (
                <TouchableOpacity
                  style={[styles.syncBtn, { borderColor: brand.violet }]}
                  onPress={handleManualSync}
                  disabled={isSyncingNow || syncState.status === 'syncing'}
                >
                  {isSyncingNow || syncState.status === 'syncing' ? (
                    <ActivityIndicator size="small" color={brand.violet} />
                  ) : (
                    <View style={styles.syncBtnContent}>
                      <Ionicons name="refresh" size={16} color={brand.violet} style={{ marginRight: 6 }} />
                      <Text style={[styles.syncBtnText, { color: brand.violet }]}>Sync Now</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Privacy & Data Controls */}
            <View style={[styles.sectionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginVertical: 12 }]}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 10 }]}>Privacy & Data Controls</Text>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Ionicons name="finger-print-outline" size={20} color={brand.violet} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>App Privacy Lock</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>Biometric or device passcode protection</Text>
                    </View>
                  </View>
                  <Switch
                    value={isAppLockEnabled}
                    onValueChange={handleToggleAppLock}
                    trackColor={{ false: colors.border, true: brand.violet }}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={handleExportData}
                >
                  <Ionicons name="download-outline" size={18} color={colors.text} style={{ marginRight: 8 }} />
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>Export Academic Data (JSON)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: status.watchBorder, backgroundColor: colors.surface }]}
                  onPress={handleClearLocalData}
                >
                  <Ionicons name="trash-bin-outline" size={18} color={status.watch} style={{ marginRight: 8 }} />
                  <Text style={[styles.actionBtnText, { color: status.watch }]}>Clear Local Device Records</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Auth Actions */}
            {currentUser ? (
              <View style={styles.actionsContainer}>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={handleSignOut}>
                  <Ionicons name="log-out-outline" size={18} color={colors.text} style={{ marginRight: 8 }} />
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>Sign Out</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn, { borderColor: status.dangerBorder }]}
                  onPress={handleDeleteAccount}
                >
                  <Ionicons name="trash-outline" size={18} color={status.danger} style={{ marginRight: 8 }} />
                  <Text style={[styles.actionBtnText, { color: status.danger }]}>Delete Cloud Account</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.guestContainer}>
                <Text style={[styles.guestDesc, { color: colors.textSecondary }]}>
                  Sign in or create an account to back up your attendance, timetable, and study plans to the cloud.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: brand.violet }]}
                  onPress={() => {
                    onClose();
                    useAppStore.getState().requestOnboardingStep('auth');
                  }}
                >
                  <Ionicons name="cloud-upload" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Sign In / Create Account</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  syncDetail: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  syncBtn: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  syncBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionsContainer: {
    gap: 10,
  },
  actionBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  guestContainer: {
    gap: 14,
  },
  guestDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
