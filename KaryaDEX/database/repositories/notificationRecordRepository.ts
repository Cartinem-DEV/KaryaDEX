/**
 * KaryaDEX — Notification Records Repository
 *
 * Provides durable persistence and duplicate prevention for scheduled notifications.
 */

import { getDatabaseConnection } from '../db';
import type { NotificationRecordRow } from '../types';

export interface NotificationRecord {
  id: string;
  type: string;
  entityId: string;
  scheduledFor: string;
  expoNotificationId?: string;
  title: string;
  body: string;
  payload?: any;
  createdAt: string;
  updatedAt: string;
}

export class NotificationRecordRepository {
  private mapRow(row: NotificationRecordRow): NotificationRecord {
    let parsedPayload: any = undefined;
    if (row.payload) {
      try {
        parsedPayload = JSON.parse(row.payload);
      } catch {
        parsedPayload = row.payload;
      }
    }

    return {
      id: row.id,
      type: row.type,
      entityId: row.entity_id,
      scheduledFor: row.scheduled_for,
      expoNotificationId: row.expo_notification_id || undefined,
      title: row.title,
      body: row.body,
      payload: parsedPayload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAll(): Promise<NotificationRecord[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<NotificationRecordRow>(
      `SELECT * FROM notification_records ORDER BY scheduled_for ASC;`
    );
    return rows.map(r => this.mapRow(r));
  }

  async getByEntityId(entityId: string): Promise<NotificationRecord[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<NotificationRecordRow>(
      `SELECT * FROM notification_records WHERE entity_id = ? ORDER BY scheduled_for ASC;`,
      [entityId]
    );
    return rows.map(r => this.mapRow(r));
  }

  async getByType(type: string): Promise<NotificationRecord[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<NotificationRecordRow>(
      `SELECT * FROM notification_records WHERE type = ? ORDER BY scheduled_for ASC;`,
      [type]
    );
    return rows.map(r => this.mapRow(r));
  }

  async findExisting(type: string, entityId: string, scheduledFor: string): Promise<NotificationRecord | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<NotificationRecordRow>(
      `SELECT * FROM notification_records WHERE type = ? AND entity_id = ? AND scheduled_for = ?;`,
      [type, entityId, scheduledFor]
    );
    return row ? this.mapRow(row) : null;
  }

  async create(record: Omit<NotificationRecord, 'createdAt' | 'updatedAt'>): Promise<NotificationRecord> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();
    const payloadStr = record.payload ? JSON.stringify(record.payload) : null;

    await db.runAsync(
      `INSERT INTO notification_records (
        id, type, entity_id, scheduled_for, expo_notification_id, title, body, payload, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(type, entity_id, scheduled_for) DO UPDATE SET
        expo_notification_id = excluded.expo_notification_id,
        title = excluded.title,
        body = excluded.body,
        payload = excluded.payload,
        updated_at = excluded.updated_at;`,
      [
        record.id,
        record.type,
        record.entityId,
        record.scheduledFor,
        record.expoNotificationId || null,
        record.title,
        record.body,
        payloadStr,
        now,
        now,
      ]
    );

    return {
      ...record,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateExpoId(id: string, expoNotificationId: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `UPDATE notification_records SET expo_notification_id = ?, updated_at = datetime('now') WHERE id = ?;`,
      [expoNotificationId, id]
    );
  }

  async deleteById(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM notification_records WHERE id = ?;`, [id]);
  }

  async deleteByEntityId(entityId: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM notification_records WHERE entity_id = ?;`, [entityId]);
  }

  async deleteByType(type: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM notification_records WHERE type = ?;`, [type]);
  }

  async deletePassedRecords(beforeISO: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM notification_records WHERE scheduled_for < ?;`, [beforeISO]);
  }

  async clearAll(): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM notification_records;`);
  }
}

export const notificationRecordRepository = new NotificationRecordRepository();
