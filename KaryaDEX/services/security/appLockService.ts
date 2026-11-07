/**
 * BunkMatKar — App Lock & Biometric Privacy Service (Phase 11.5)
 *
 * Provides optional user-controlled biometric/device authentication to protect
 * sensitive academic records (marks, attendance, private notes, accounts).
 *
 * Built on standard platform APIs via expo-local-authentication and expo-secure-store.
 * Grace period prevents annoying lockouts during quick app-switch tasks.
 */

import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_LOCK_ENABLED_KEY = 'bmk_security_app_lock_enabled';
const APP_LOCK_GRACE_PERIOD_MS = 30000; // 30-second grace period

export type LockStateListener = (isLocked: boolean) => void;

class AppLockService {
  private isLocked: boolean = false;
  private lastBackgroundTimestamp: number = 0;
  private listeners: Set<LockStateListener> = new Set();
  private enabledCache: boolean | null = null;

  /**
   * Check if the device hardware supports biometrics or device passcodes.
   */
  async isHardwareSupported(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch {
      return false;
    }
  }

  /**
   * Check if app lock is enabled by the user in settings.
   */
  async isEnabled(): Promise<boolean> {
    if (this.enabledCache !== null) return this.enabledCache;
    try {
      const val = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);
      this.enabledCache = val === 'true';
      return this.enabledCache;
    } catch {
      return false;
    }
  }

  /**
   * Enable or disable app lock.
   */
  async setEnabled(enabled: boolean): Promise<boolean> {
    try {
      if (enabled) {
        const supported = await this.isHardwareSupported();
        if (!supported && Platform.OS !== 'web') {
          return false;
        }
      }
      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, enabled ? 'true' : 'false');
      this.enabledCache = enabled;
      if (!enabled) {
        this.unlock();
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Prompt user with platform biometric/device auth to unlock.
   */
  async authenticate(): Promise<boolean> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      this.unlock();
      return true;
    }

    if (Platform.OS === 'web') {
      this.unlock();
      return true;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock KaryaDEX',
        fallbackLabel: 'Use Device Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        this.unlock();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[AppLockService] Authentication error:', err);
      return false;
    }
  }

  /**
   * Handle app background event.
   */
  handleAppBackground(): void {
    this.lastBackgroundTimestamp = Date.now();
  }

  /**
   * Handle app foreground event.
   */
  async handleAppForeground(): Promise<boolean> {
    const enabled = await this.isEnabled();
    if (!enabled) return true;

    const elapsed = Date.now() - this.lastBackgroundTimestamp;
    if (this.lastBackgroundTimestamp > 0 && elapsed > APP_LOCK_GRACE_PERIOD_MS) {
      this.lock();
      return false;
    }
    return true;
  }

  /**
   * Whether the app is currently in locked state.
   */
  getIsLocked(): boolean {
    return this.isLocked;
  }

  /**
   * Manually lock the application.
   */
  lock(): void {
    if (!this.isLocked) {
      this.isLocked = true;
      this.notify();
    }
  }

  /**
   * Mark as unlocked.
   */
  unlock(): void {
    if (this.isLocked) {
      this.isLocked = false;
      this.notify();
    }
  }

  subscribe(listener: LockStateListener): () => void {
    this.listeners.add(listener);
    listener(this.isLocked);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.isLocked);
      } catch (err) {
        console.warn('[AppLockService] Listener error:', err);
      }
    }
  }

  resetForTesting(): void {
    this.isLocked = false;
    this.lastBackgroundTimestamp = 0;
    this.enabledCache = null;
    this.listeners.clear();
  }
}

export const appLockService = new AppLockService();
