/**
 * KaryaDEX — BlockedAppsManager
 *
 * Modal for managing the app blocklist.
 * Users can add/remove apps from the blocklist, toggle blocking on/off,
 * and the list is synced to the native blocking service.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, spacing, typography, radii } from '@/constants/theme';
import { lockinStorage } from '../../services/lockin/lockinStorage';
import type { LockinBlockedApp } from '@/types/lockin';
import { LockinModule } from '@/modules/expo-module-lockin/src';

interface BlockedAppsManagerProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  blockedApps?: LockinBlockedApp[];
  onToggle?: (id: string, isBlocked: boolean) => void;
  onRemove?: (id: string) => void;
  onAddApp?: (packageName: string, appName: string) => void;
}

const EMPTY_BLOCKED_APPS: LockinBlockedApp[] = [];

export function BlockedAppsManager({
  visible,
  userId,
  onClose,
  blockedApps = EMPTY_BLOCKED_APPS,
  onToggle,
  onRemove,
  onAddApp,
}: BlockedAppsManagerProps) {
  const { colors, isDark } = useTheme();
  const [filter, setFilter] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newAppPackage, setNewAppPackage] = useState('');
  const [newAppName, setNewAppName] = useState('');

  // Filter blocked apps by search query
  const searchResults = useMemo(() => {
    if (!filter) {
      return blockedApps;
    }
    const lower = filter.toLowerCase();
    return blockedApps.filter(
      (app) =>
        app.appName.toLowerCase().includes(lower) ||
        app.packageName.toLowerCase().includes(lower)
    );
  }, [filter, blockedApps]);

  // Sync apps to native module when list changes
  useEffect(() => {
    if (typeof LockinModule?.addBlockedPackages === 'function') {
      const packageNames = blockedApps.filter((a) => a.isBlocked).map((app) => app.packageName);
      try {
        const res = LockinModule.addBlockedPackages(packageNames);
        if (res && typeof (res as any).catch === 'function') {
          (res as any).catch((err: any) => {
            console.warn('[BlockedAppsManager] Failed to sync blocked packages:', err);
          });
        }
      } catch (err) {
        console.warn('[BlockedAppsManager] Failed to sync blocked packages:', err);
      }
    }
  }, [blockedApps]);

  const handleToggle = async (id: string, newIsBlocked: boolean) => {
    if (onToggle) {
      onToggle(id, newIsBlocked);
    }
  };

  const handleRemove = async (id: string) => {
    if (onRemove) {
      onRemove(id);
    }
  };

  const handleAddApp = async () => {
    if (!newAppPackage || !newAppName) return;
    setIsAdding(true);
    try {
      if (onAddApp) {
        onAddApp(newAppPackage, newAppName);
      } else {
        // Create blocked app record in SQLite
        await lockinStorage.createBlockedApp({
          userId,
          packageName: newAppPackage,
          appName: newAppName,
          isBlocked: true,
        });
      }
      // Reset form
      setNewAppPackage('');
      setNewAppName('');
    } catch (error) {
      console.warn('[BlockedAppsManager] Failed to add app:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const renderApp = ({ item: app }: { item: LockinBlockedApp }) => {
    const isToggled = app.isBlocked;
    return (
      <View style={styles.appRow}>
        <View style={styles.appInfo}>
          <Text style={[styles.appName, { color: colors.text }]}>{app.appName}</Text>
          <Text style={[styles.appPackage, { color: colors.textSecondary }]}>
            {app.packageName}
          </Text>
        </View>
        <Switch
          value={isToggled}
          onValueChange={(val) => handleToggle(app.id, val)}
          thumbColor={isDark ? '#00E5FF' : brand.violet}
          trackColor={{
            false: isDark ? 'rgba(0, 225, 255, 0.3)' : brand.violetSoft,
            true: isDark ? '#00E5FF' : brand.violet,
          }}
        />
        <Pressable onPress={() => handleRemove(app.id)} style={styles.removeBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} onRequestClose={onClose} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="apps-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Blocked Apps</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Search Section */}
          <View style={styles.searchSection}>
            <View style={[styles.searchInputWrapper, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
              <TextInput
                placeholder="Search apps..."
                placeholderTextColor={colors.textSecondary}
                value={filter}
                onChangeText={setFilter}
                style={[styles.searchInput, { color: colors.text }]}
                autoCapitalize="none"
              />
              {filter.length > 0 && (
                <Pressable onPress={() => setFilter('')} style={styles.clearSearchBtn}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Blocked Apps List */}
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderApp}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={{ color: colors.textSecondary }}>
                  {blockedApps.length === 0 ? 'No blocked apps yet' : 'No apps match your search'}
                </Text>
              </View>
            }
          />

          {/* Add New App Form */}
          <View style={[styles.addSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.addSectionTitle, { color: colors.text }]}>Add App to Blocklist</Text>
            <View style={styles.addForm}>
              <TextInput
                placeholder="Package name (e.g. com.instagram.android)"
                placeholderTextColor={colors.textSecondary}
                value={newAppPackage}
                onChangeText={setNewAppPackage}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
                editable={!isAdding}
              />
              <TextInput
                placeholder="App name (e.g. Instagram)"
                placeholderTextColor={colors.textSecondary}
                value={newAppName}
                onChangeText={setNewAppName}
                autoCapitalize="none"
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
                editable={!isAdding}
              />
            </View>
            <Pressable
              onPress={handleAddApp}
              style={[
                styles.addBtn,
                {
                  backgroundColor: brand.violet,
                  opacity: isAdding || !newAppPackage || !newAppName ? 0.5 : 1,
                },
              ]}
              disabled={isAdding || !newAppPackage || !newAppName}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="add-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.addBtnText}>Add App</Text>
                </>
              )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '80%',
    paddingBottom: spacing.lg,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginLeft: spacing.sm,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  searchSection: {
    padding: spacing.md,
  },
  searchInputWrapper: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.xs,
    fontSize: typography.sizes.sm,
  },
  clearSearchBtn: {
    padding: 4,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  addSection: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
  addSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  addForm: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
  },
  addBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  appPackage: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  removeBtn: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
});