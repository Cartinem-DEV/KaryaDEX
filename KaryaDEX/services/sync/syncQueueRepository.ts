// services/sync/syncQueueRepository.ts
/**
 * SyncQueueRepository
 * Durable SQLite-backed queue for local-first mutations.
 * Survives process death, restarts, and network transitions.
 */

import { getDatabaseConnection } from '../../database/db';
import { SyncQueueItem, SyncEntityType, SyncOperation } from './syncTypes';

export class SyncQueueRepository {
  /**
   * Enqueues a mutation with intelligent queue compaction.
   */
  public async enqueue(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
    payload?: any
  ): Promise<void> {
    const db = await getDatabaseConnection();
    const id = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const payloadStr = payload ? JSON.stringify(payload) : null;

    try {
      // Check existing pending item for this same entity
      const existing = await db.getFirstAsync<{
        id: string;
        operation: string;
        payload: string | null;
      }>(
        `SELECT id, operation, payload FROM sync_queue 
         WHERE user_id = ? AND entity_type = ? AND entity_id = ? 
         ORDER BY created_at DESC LIMIT 1;`,
        [userId, entityType, entityId]
      );

      if (existing) {
        if (existing.operation === 'CREATE' && operation === 'DELETE') {
          // Entity was created locally and deleted before ever reaching the server: cancel both!
          await db.runAsync(`DELETE FROM sync_queue WHERE id = ?;`, [existing.id]);
          return;
        }

        if (existing.operation === 'CREATE' && operation === 'UPDATE') {
          // Merge update into CREATE payload
          let merged = payload || {};
          if (existing.payload) {
            try {
              merged = { ...JSON.parse(existing.payload), ...payload };
            } catch {
              // fallback
            }
          }
          await db.runAsync(
            `UPDATE sync_queue SET payload = ?, created_at = ? WHERE id = ?;`,
            [JSON.stringify(merged), now, existing.id]
          );
          return;
        }

        if (existing.operation === 'UPDATE' && operation === 'UPDATE') {
          // Compact multiple updates into latest state
          let merged = payload || {};
          if (existing.payload) {
            try {
              merged = { ...JSON.parse(existing.payload), ...payload };
            } catch {
              // fallback
            }
          }
          await db.runAsync(
            `UPDATE sync_queue SET payload = ?, created_at = ? WHERE id = ?;`,
            [JSON.stringify(merged), now, existing.id]
          );
          return;
        }

        if (existing.operation === 'UPDATE' && operation === 'DELETE') {
          // Replace update with delete
          await db.runAsync(
            `UPDATE sync_queue SET operation = 'DELETE', payload = NULL, created_at = ? WHERE id = ?;`,
            [now, existing.id]
          );
          return;
        }
      }

      // Default: insert new queue entry
      await db.runAsync(
        `INSERT INTO sync_queue (id, user_id, entity_type, entity_id, operation, payload, created_at, retry_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0);`,
        [id, userId, entityType, entityId, operation, payloadStr, now]
      );
    } catch (error) {
      console.error('[SyncQueueRepository] Failed to enqueue mutation:', error);
    }
  }

  /**
   * Retrieves oldest pending items in FIFO order
   */
  public async peek(userId: string, limit = 50): Promise<SyncQueueItem[]> {
    const db = await getDatabaseConnection();
    try {
      const rows = await db.getAllAsync<{
        id: string;
        user_id: string;
        entity_type: SyncEntityType;
        entity_id: string;
        operation: SyncOperation;
        payload: string | null;
        created_at: string;
        retry_count: number;
        last_error: string | null;
      }>(
        `SELECT id, user_id, entity_type, entity_id, operation, payload, created_at, retry_count, last_error
         FROM sync_queue
         WHERE user_id = ?
         ORDER BY created_at ASC
         LIMIT ?;`,
        [userId, limit]
      );

      return rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        operation: r.operation,
        payload: r.payload ? JSON.parse(r.payload) : null,
        createdAt: r.created_at,
        retryCount: r.retry_count,
        lastError: r.last_error || undefined,
      }));
    } catch (error) {
      console.error('[SyncQueueRepository] Failed to peek queue:', error);
      return [];
    }
  }

  /**
   * Dequeues an item after successful sync
   */
  public async dequeue(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    try {
      await db.runAsync(`DELETE FROM sync_queue WHERE id = ?;`, [id]);
    } catch (error) {
      console.error('[SyncQueueRepository] Failed to dequeue item:', error);
    }
  }

  /**
   * Record failure and increment retry count with exponential backoff awareness
   */
  public async markFailed(id: string, error: string): Promise<void> {
    const db = await getDatabaseConnection();
    try {
      await db.runAsync(
        `UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?;`,
        [error, id]
      );
    } catch (e) {
      console.error('[SyncQueueRepository] Failed to mark item failed:', e);
    }
  }

  /**
   * Count of pending items
   */
  public async getPendingCount(userId: string): Promise<number> {
    const db = await getDatabaseConnection();
    try {
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM sync_queue WHERE user_id = ?;`,
        [userId]
      );
      return row?.count ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Clear all queued items for a user
   */
  public async clearQueue(userId: string): Promise<void> {
    const db = await getDatabaseConnection();
    try {
      await db.runAsync(`DELETE FROM sync_queue WHERE user_id = ?;`, [userId]);
    } catch (e) {
      console.error('[SyncQueueRepository] Failed to clear queue:', e);
    }
  }
}

export const syncQueueRepository = new SyncQueueRepository();
