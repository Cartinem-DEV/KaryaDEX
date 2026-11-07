// services/sync/cloudBackendAdapter.ts
/**
 * CloudBackendAdapter
 * Pluggable cloud interface defining contract for remote sync operations.
 * Includes a deterministic simulated cloud adapter for multi-device sync testing and offline resilience.
 */

import { CloudRecord, SyncEntityType, SyncOperation, SyncTombstone } from './syncTypes';

export interface ICloudBackendAdapter {
  pushRecord(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
    payload?: any
  ): Promise<{ success: boolean; remoteVersion: number; error?: string }>;

  pullChanges(
    userId: string,
    sinceTimestamp?: string
  ): Promise<{
    records: CloudRecord[];
    tombstones: SyncTombstone[];
    serverTimestamp: string;
  }>;

  isOnline(): Promise<boolean>;
}

/**
 * Simulated Cloud Backend Adapter
 * In-memory cloud simulation that models multi-tenant data storage,
 * remote device mutations, offline states, and server timestamps.
 */
export class SimulatedCloudBackendAdapter implements ICloudBackendAdapter {
  private static instance: SimulatedCloudBackendAdapter;
  private storage = new Map<string, CloudRecord>(); // key: `${userId}:${entityType}:${entityId}`
  private tombstones = new Map<string, SyncTombstone>(); // key: `${userId}:${entityType}:${entityId}`
  private onlineStatus = true;
  private versionCounters = new Map<string, number>();

  public static getInstance(): SimulatedCloudBackendAdapter {
    if (!SimulatedCloudBackendAdapter.instance) {
      SimulatedCloudBackendAdapter.instance = new SimulatedCloudBackendAdapter();
    }
    return SimulatedCloudBackendAdapter.instance;
  }

  public setOnline(isOnline: boolean): void {
    this.onlineStatus = isOnline;
  }

  public isOnline(): Promise<boolean> {
    return Promise.resolve(this.onlineStatus);
  }

  public clearStorage(): void {
    this.storage.clear();
    this.tombstones.clear();
    this.versionCounters.clear();
  }

  private getKey(userId: string, entityType: SyncEntityType, entityId: string): string {
    return `${userId}:${entityType}:${entityId}`;
  }

  public async pushRecord(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
    payload?: any
  ): Promise<{ success: boolean; remoteVersion: number; error?: string }> {
    if (!this.onlineStatus) {
      return { success: false, remoteVersion: 0, error: 'Network unavailable' };
    }

    const key = this.getKey(userId, entityType, entityId);
    const now = new Date().toISOString();
    const currentVersion = (this.versionCounters.get(key) || 0) + 1;
    this.versionCounters.set(key, currentVersion);

    if (operation === 'DELETE') {
      this.storage.delete(key);
      this.tombstones.set(key, {
        userId,
        entityType,
        entityId,
        deletedAt: now,
      });
      return { success: true, remoteVersion: currentVersion };
    }

    // CREATE or UPDATE
    const record: CloudRecord = {
      id: entityId,
      userId,
      entityType,
      payload: payload || {},
      version: currentVersion,
      updatedAt: now,
    };
    this.storage.set(key, record);
    // Remove any previous tombstone if entity was recreated
    this.tombstones.delete(key);

    return { success: true, remoteVersion: currentVersion };
  }

  public async pullChanges(
    userId: string,
    sinceTimestamp?: string
  ): Promise<{
    records: CloudRecord[];
    tombstones: SyncTombstone[];
    serverTimestamp: string;
  }> {
    if (!this.onlineStatus) {
      throw new Error('Network unavailable');
    }

    const now = new Date().toISOString();
    const matchedRecords: CloudRecord[] = [];
    const matchedTombstones: SyncTombstone[] = [];

    for (const [key, record] of this.storage.entries()) {
      if (record.userId === userId) {
        if (!sinceTimestamp || record.updatedAt > sinceTimestamp) {
          matchedRecords.push(record);
        }
      }
    }

    for (const [key, tombstone] of this.tombstones.entries()) {
      if (tombstone.userId === userId) {
        if (!sinceTimestamp || tombstone.deletedAt > sinceTimestamp) {
          matchedTombstones.push(tombstone);
        }
      }
    }

    return {
      records: matchedRecords,
      tombstones: matchedTombstones,
      serverTimestamp: now,
    };
  }

  /**
   * Helper to simulate a remote edit from another device (Device B)
   */
  public simulateRemoteDeviceEdit(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
    payload: any,
    updatedAt?: string
  ): void {
    const key = this.getKey(userId, entityType, entityId);
    const version = (this.versionCounters.get(key) || 0) + 1;
    this.versionCounters.set(key, version);
    this.storage.set(key, {
      id: entityId,
      userId,
      entityType,
      payload,
      version,
      updatedAt: updatedAt || new Date().toISOString(),
    });
    this.tombstones.delete(key);
  }

  /**
   * Helper to simulate a remote delete from another device (Device B)
   */
  public simulateRemoteDeviceDelete(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
    deletedAt?: string
  ): void {
    const key = this.getKey(userId, entityType, entityId);
    this.storage.delete(key);
    this.tombstones.set(key, {
      userId,
      entityType,
      entityId,
      deletedAt: deletedAt || new Date().toISOString(),
    });
  }
}

export const simulatedCloudAdapter = SimulatedCloudBackendAdapter.getInstance();
