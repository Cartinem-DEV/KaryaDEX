// components/ui/SyncStatusBadge.tsx
/**
 * SyncStatusBadge
 * Truthful, non-intrusive indicator of BunkMatKar cloud synchronization status.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { syncService } from '../../services/sync/syncService';
import { SyncState } from '../../services/sync/syncTypes';
import { brand, status } from '../../constants/theme';
import { useTheme } from '@/constants/ThemeContext';

interface Props {
  compact?: boolean;
  onPress?: () => void;
}

export const SyncStatusBadge: React.FC<Props> = ({ compact = true, onPress }) => {
  const { colors, isDark } = useTheme();
  const [syncState, setSyncState] = useState<SyncState>(syncService.getSyncState());

  useEffect(() => {
    const unsubscribe = syncService.subscribe(setSyncState);
    return unsubscribe;
  }, []);

  const getStatusConfig = () => {
    switch (syncState.status) {
      case 'syncing':
        return {
          icon: null,
          spinning: true,
          label: 'Syncing...',
          color: brand.indigo,
          bg: brand.indigoSoft,
          border: brand.indigoGlow,
        };
      case 'pending':
        return {
          icon: 'cloud-upload-outline' as const,
          spinning: false,
          label: `${syncState.pendingCount} pending`,
          color: status.watch,
          bg: status.watchBg,
          border: status.watchBorder,
        };
      case 'offline':
        return {
          icon: 'cloud-offline-outline' as const,
          spinning: false,
          label: 'Offline',
          color: colors.textTertiary,
          bg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          border: colors.border,
        };
      case 'error':
        return {
          icon: 'alert-circle-outline' as const,
          spinning: false,
          label: 'Sync issue',
          color: status.danger,
          bg: status.dangerBg,
          border: status.dangerBorder,
        };
      case 'synced':
      default:
        return {
          icon: 'cloud-done-outline' as const,
          spinning: false,
          label: 'Synced',
          color: status.safe,
          bg: status.safeBg,
          border: status.safeBorder,
        };
    }
  };

  const config = getStatusConfig();

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
        compact ? styles.compactContainer : styles.fullContainer,
      ]}
    >
      {config.spinning ? (
        <ActivityIndicator size="small" color={config.color} style={styles.icon} />
      ) : (
        <Ionicons name={config.icon!} size={compact ? 13 : 16} color={config.color} style={styles.icon} />
      )}
      <Text
        style={[
          styles.label,
          { color: config.color },
          compact && styles.compactLabel,
        ]}
        numberOfLines={1}
      >
        {config.label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  compactContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fullContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactLabel: {
    fontSize: 11,
  },
});
