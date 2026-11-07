/**
 * BunkMatKar — Privacy Shield Overlay (Phase 11.5)
 *
 * Protects sensitive academic content (attendance, marks, private notes) from:
 * 1. OS App Switcher previews and background snapshots (Android Recents & iOS App Switcher)
 * 2. Unauthenticated access when App Lock is active
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AppState,
  AppStateStatus,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { appLockService } from '@/services/security/appLockService';

export const PrivacyShieldOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBackgrounded, setIsBackgrounded] = useState(false);
  const [isLocked, setIsLocked] = useState(appLockService.getIsLocked());

  useEffect(() => {
    const unsubscribeLock = appLockService.subscribe((locked) => {
      setIsLocked(locked);
    });

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App moving to background or app-switcher: immediately mask UI
        setIsBackgrounded(true);
        appLockService.handleAppBackground();
      } else if (nextAppState === 'active') {
        setIsBackgrounded(false);
        const unlocked = await appLockService.handleAppForeground();
        if (!unlocked) {
          // App lock engaged; prompt for authentication
          await appLockService.authenticate();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      unsubscribeLock();
      subscription.remove();
    };
  }, []);

  const handleUnlockPress = async () => {
    await appLockService.authenticate();
  };

  // When backgrounded: render pure opaque shield to prevent OS app-switcher snapshot leakage
  if (isBackgrounded) {
    return (
      <View style={styles.container}>
        <View style={styles.shieldBackground}>
          <MaterialCommunityIcons name="shield-lock-outline" size={72} color="#6366F1" />
          <Text style={styles.title}>KaryaDEX</Text>
          <Text style={styles.subtitle}>Privacy Shield Active</Text>
        </View>
      </View>
    );
  }

  // When locked by app lock: render unlock screen
  if (isLocked) {
    return (
      <View style={styles.container}>
        <View style={styles.shieldBackground}>
          <MaterialCommunityIcons name="lock" size={64} color="#6366F1" />
          <Text style={styles.title}>KaryaDEX Locked</Text>
          <Text style={styles.subtitle}>Unlock to view your attendance and academic records</Text>
          <TouchableOpacity style={styles.unlockButton} onPress={handleUnlockPress}>
            <MaterialCommunityIcons name="fingerprint" size={24} color="#FFFFFF" />
            <Text style={styles.unlockButtonText}>Unlock with Biometrics</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    zIndex: 999999,
  },
  shieldBackground: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 32,
    gap: 8,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
