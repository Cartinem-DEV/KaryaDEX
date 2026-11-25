/**
 * KaryaDEX — Notification Platform Adapter
 *
 * Provides a clean abstraction boundary over Expo Notifications:
 * - Native Expo adapter for iOS / Android
 * - Mock adapter for Jest unit testing and web environments
 * - Guarantees zero crashes on unsupported platforms
 */

import { Platform } from 'react-native';

export interface NotificationRequest {
  content: {
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: boolean | string;
    badge?: number;
  };
  trigger: {
    date?: Date;
    seconds?: number;
    channelId?: string;
  } | null;
}

export interface ScheduledNotificationItem {
  identifier: string;
  content: any;
  trigger: any;
}

export interface NotificationPlatformAdapter {
  isAvailable(): boolean;
  getPermissionsAsync(): Promise<{ status: 'granted' | 'denied' | 'undetermined' }>;
  requestPermissionsAsync(): Promise<{ status: 'granted' | 'denied' | 'undetermined' }>;
  setNotificationChannelAsync(channelId: string, channel: any): Promise<void>;
  scheduleNotificationAsync(request: NotificationRequest): Promise<string>;
  cancelScheduledNotificationAsync(identifier: string): Promise<void>;
  getAllScheduledNotificationsAsync(): Promise<ScheduledNotificationItem[]>;
  cancelAllScheduledNotificationsAsync(): Promise<void>;
  addNotificationResponseReceivedListener(listener: (response: any) => void): { remove: () => void };
}

/**
 * Mock adapter for Jest unit tests and environments without native notifications.
 */
export class MockNotificationAdapter implements NotificationPlatformAdapter {
  private scheduled = new Map<string, NotificationRequest>();
  private permissionStatus: 'granted' | 'denied' | 'undetermined' = 'granted';
  private channels = new Map<string, any>();
  private listeners = new Set<(response: any) => void>();

  isAvailable(): boolean {
    return true;
  }

  setPermissionStatus(status: 'granted' | 'denied' | 'undetermined'): void {
    this.permissionStatus = status;
  }

  async getPermissionsAsync(): Promise<{ status: 'granted' | 'denied' | 'undetermined' }> {
    return { status: this.permissionStatus };
  }

  async requestPermissionsAsync(): Promise<{ status: 'granted' | 'denied' | 'undetermined' }> {
    return { status: this.permissionStatus };
  }

  async setNotificationChannelAsync(channelId: string, channel: any): Promise<void> {
    this.channels.set(channelId, channel);
  }

  async scheduleNotificationAsync(request: NotificationRequest): Promise<string> {
    const id = `notif-mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.scheduled.set(id, request);
    return id;
  }

  async cancelScheduledNotificationAsync(identifier: string): Promise<void> {
    this.scheduled.delete(identifier);
  }

  async getAllScheduledNotificationsAsync(): Promise<ScheduledNotificationItem[]> {
    return Array.from(this.scheduled.entries()).map(([id, req]) => ({
      identifier: id,
      content: req.content,
      trigger: req.trigger,
    }));
  }

  async cancelAllScheduledNotificationsAsync(): Promise<void> {
    this.scheduled.clear();
  }

  clearAll(): void {
    this.scheduled.clear();
  }

  addNotificationResponseReceivedListener(listener: (response: any) => void): { remove: () => void } {
    this.listeners.add(listener);
    return {
      remove: () => this.listeners.delete(listener),
    };
  }

  // Test helper
  triggerNotificationResponse(payload: any): void {
    for (const l of this.listeners) {
      l({ notification: { request: { content: { data: payload } } } });
    }
  }

  getChannel(channelId: string): any {
    return this.channels.get(channelId);
  }

  getScheduledCount(): number {
    return this.scheduled.size;
  }
}

/**
 * Native Expo Notification Adapter using expo-notifications.
 */
export class ExpoNotificationAdapter implements NotificationPlatformAdapter {
  private notificationsModule: any = null;

  constructor() {
    this.initModule();
  }

  private initModule() {
    if (Platform.OS !== 'web' && typeof jest === 'undefined') {
      try {
        this.notificationsModule = require('expo-notifications');
        // Ensure foreground notifications display alerts, sound, and badge
        if (this.notificationsModule?.setNotificationHandler) {
          this.notificationsModule.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }),
          });
        }
      } catch {
        this.notificationsModule = null;
      }
    }
  }

  isAvailable(): boolean {
    return this.notificationsModule !== null && Platform.OS !== 'web';
  }

  async getPermissionsAsync(): Promise<{ status: 'granted' | 'denied' | 'undetermined' }> {
    if (!this.isAvailable()) return { status: 'granted' };
    const res = await this.notificationsModule.getPermissionsAsync();
    return { status: res.status };
  }

  async requestPermissionsAsync(): Promise<{ status: 'granted' | 'denied' | 'undetermined' }> {
    if (!this.isAvailable()) return { status: 'granted' };
    const res = await this.notificationsModule.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return { status: res.status };
  }

  async setNotificationChannelAsync(channelId: string, channel: any): Promise<void> {
    if (!this.isAvailable() || Platform.OS !== 'android') return;
    await this.notificationsModule.setNotificationChannelAsync(channelId, channel);
  }

  async scheduleNotificationAsync(request: NotificationRequest): Promise<string> {
    if (!this.isAvailable()) return `noop-${Date.now()}`;

    let triggerConfig: any = null;
    const channelId = request.trigger?.channelId;

    if (request.trigger?.date) {
      triggerConfig = {
        type: 'date',
        date: request.trigger.date,
        channelId,
      };
    } else if (request.trigger?.seconds) {
      triggerConfig = {
        type: 'timeInterval',
        seconds: request.trigger.seconds,
        channelId,
      };
    }

    // Set channelId on both content and trigger for maximum Android compatibility
    const content = {
      ...request.content,
      ...(channelId ? { channelId } : {}),
    };

    try {
      return await this.notificationsModule.scheduleNotificationAsync({
        content,
        trigger: triggerConfig,
      });
    } catch (schedErr) {
      console.warn('[NotificationAdapter] Native schedule failed:', schedErr);
      return `fallback-${Date.now()}`;
    }
  }

  async cancelScheduledNotificationAsync(identifier: string): Promise<void> {
    if (!this.isAvailable()) return;
    await this.notificationsModule.cancelScheduledNotificationAsync(identifier);
  }

  async getAllScheduledNotificationsAsync(): Promise<ScheduledNotificationItem[]> {
    if (!this.isAvailable()) return [];
    return await this.notificationsModule.getAllScheduledNotificationsAsync();
  }

  async cancelAllScheduledNotificationsAsync(): Promise<void> {
    if (!this.isAvailable()) return;
    await this.notificationsModule.cancelAllScheduledNotificationsAsync();
  }

  addNotificationResponseReceivedListener(listener: (response: any) => void): { remove: () => void } {
    if (!this.isAvailable()) {
      return { remove: () => {} };
    }
    return this.notificationsModule.addNotificationResponseReceivedListener(listener);
  }
}

/**
 * Creates default platform adapter based on runtime environment.
 */
export function createDefaultNotificationAdapter(): NotificationPlatformAdapter {
  if (typeof jest !== 'undefined' || Platform.OS === 'web') {
    return new MockNotificationAdapter();
  }
  return new ExpoNotificationAdapter();
}
