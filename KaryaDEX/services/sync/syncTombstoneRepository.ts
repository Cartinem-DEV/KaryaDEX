// services/sync/syncTombstoneRepository.ts
/**
 * SyncTombstoneRepository
 * Durable record of deleted entities to prevent resurrection bugs across
 * offline queues, multiple devices, and cloud re-pulls.
 */

import { getDatabaseConnection } from '../../database/db';
import { SyncEntityType, SyncTombstone } from './syncTypes';

export class SyncTombstoneRepository {
  /**
   * Records a tombstone for a deleted entity.
   */
  public async addTombstone(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
    deletedAt?: string
  ): Promise<void> {
    const db = await getDatabaseConnection();
    const timestamp = deletedAt || new Date().toISOString();

    try {
      await db.runAsync(
        `INSERT INTO sync_tombstones (entity_type, entity_id, user_id, deleted_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(entity_type, entity_id, user_id) 
         DO UPDATE SET deleted_at = excluded.deleted_at;`,
        [entityType, entityId, userId, timestamp]
      );
    } catch (error) {
      console.error('[SyncTombstoneRepository] Failed to record tombstone:', error);
    }
  }

  /**
   * Checks if an entity has been deleted.
   */
  public async isTombstoned(
    userId: string,
    entityType: SyncEntityType,
    entityId: string
  ): Promise<boolean> {
    const db = await getDatabaseConnection();
    try {
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM sync_tombstones 
         WHERE user_id = ? AND entity_type = ? AND entity_id = ?;`,
        [userId, entityType, entityId]
      );
      return (row?.count ?? 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Returns tombstone timestamp if present.
   */
  public async getTombstone(
    userId: string,
    entityType: SyncEntityType,
    entityId: string
  ): Promise<SyncTombstone | null> {
    const db = await getDatabaseConnection();
    try {
      const row = await db.getFirstAsync<{
        entity_type: SyncEntityType;
        entity_id: string;
        user_id: string;
        deleted_at: string;
      }>(
        `SELECT entity_type, entity_id, user_id, deleted_at FROM sync_tombstones 
         WHERE user_id = ? AND entity_type = ? AND entity_id = ?;`,
        [userId, entityType, entityId]
      );
      if (!row) return null;
      return {
        entityType: row.entity_type,
        entityId: row.entity_id,
        userId: row.user_id,
        deletedAt: row.deleted_at,
      };
    } catch {
      return null;
    }
  }

  /**
   * Retrieves all tombstones for a user since a given timestamp.
   */
  public async getTombstonesSince(
    userId: string,
    sinceTimestamp?: string
  ): Promise<SyncTombstone[]> {
    const db = await getDatabaseConnection();
    try {
      const rows = sinceTimestamp
        ? await db.getAllAsync<{
            entity_type: SyncEntityType;
            entity_id: string;
            user_id: string;
            deleted_at: string;
          }>(
            `SELECT entity_type, entity_id, user_id, deleted_at FROM sync_tombstones 
             WHERE user_id = ? AND deleted_at > ?;`,
            [userId, sinceTimestamp]
          )
        : await db.getAllAsync<{
            entity_type: SyncEntityType;
            entity_id: string;
            user_id: string;
            deleted_at: string;
          }>(
            `SELECT entity_type, entity_id, user_id, deleted_at FROM sync_tombstones 
             WHERE user_id = ?;`,
            [userId]
          );

      return rows.map(r => ({
        entityType: r.entity_type,
        entityId: r.entity_id,
        userId: r.user_id,
        deletedAt: r.deleted_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Clean up tombstones older than retention window (e.g., 90 days)
   */
  public async pruneOldTombstones(userId: string, olderThanDays = 90): Promise<void> {
    const db = await getDatabaseConnection();
    const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    try {
      await db.runAsync(
        `DELETE FROM sync_tombstones WHERE user_id = ? AND deleted_at < ?;`,
        [userId, cutoff]
      );
    } catch (e) {
      console.error('[SyncTombstoneRepository] Failed to prune tombstones:', e);
    }
  }
}

export const syncTombstoneRepository = new SyncTombstoneRepository();
