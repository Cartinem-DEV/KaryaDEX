/**
 * KaryaDEX — App Settings & Storage Settings Repository
 */

import { getDatabaseConnection } from '../db';
import type { AppSettingRow, StorageSettingRow } from '../types';
import type { UserStoragePreference, NotificationSettings } from '@/types/academic';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/types/academic';

export class SettingsRepository {
  async getSetting(key: string, defaultValue?: string): Promise<string | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<AppSettingRow>(
      `SELECT value FROM app_settings WHERE key = ?;`,
      [key]
    );
    if (!row) return defaultValue ?? null;
    return row.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
      [key, value]
    );
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
    const val = await this.getSetting('notification_settings');
    if (!val) {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
    try {
      const parsed = JSON.parse(val);
      return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...parsed,
        classReminders: { ...DEFAULT_NOTIFICATION_SETTINGS.classReminders, ...(parsed.classReminders || {}) },
        taskReminders: { ...DEFAULT_NOTIFICATION_SETTINGS.taskReminders, ...(parsed.taskReminders || {}) },
        examReminders: { ...DEFAULT_NOTIFICATION_SETTINGS.examReminders, ...(parsed.examReminders || {}) },
        revisionReminders: { ...DEFAULT_NOTIFICATION_SETTINGS.revisionReminders, ...(parsed.revisionReminders || {}) },
        attendanceAlerts: { ...DEFAULT_NOTIFICATION_SETTINGS.attendanceAlerts, ...(parsed.attendanceAlerts || {}) },
        postClassJournal: { ...DEFAULT_NOTIFICATION_SETTINGS.postClassJournal, ...(parsed.postClassJournal || {}) },
        quietHours: { ...DEFAULT_NOTIFICATION_SETTINGS.quietHours, ...(parsed.quietHours || {}) },
      };
    } catch {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
  }

  async setNotificationSettings(settings: NotificationSettings): Promise<void> {
    await this.setSetting('notification_settings', JSON.stringify(settings));
  }

  async getStoragePreference(): Promise<UserStoragePreference> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<StorageSettingRow>(
      `SELECT * FROM storage_settings WHERE id = 'current';`
    );
    if (!row) {
      return { storageType: 'app_storage' };
    }
    return {
      storageType: row.storage_type as any,
      folderUri: row.folder_uri || undefined,
      folderName: row.folder_name || undefined,
      lastMigratedAt: row.last_migrated_at || undefined,
    };
  }

  async setStoragePreference(pref: UserStoragePreference): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `INSERT INTO storage_settings (id, storage_type, folder_uri, folder_name, last_migrated_at, updated_at)
       VALUES ('current', ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         storage_type = excluded.storage_type,
         folder_uri = excluded.folder_uri,
         folder_name = excluded.folder_name,
         last_migrated_at = excluded.last_migrated_at,
         updated_at = excluded.updated_at;`,
      [
        pref.storageType,
        pref.folderUri || null,
        pref.folderName || null,
        pref.lastMigratedAt || null,
      ]
    );
  }
}

export const settingsRepository = new SettingsRepository();
