// services/sync/syncTypes.ts
/**
 * Types and interfaces for the KaryaDEX Sync Engine
 */

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'pending';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncEntityType =
  | 'student'
  | 'college'
  | 'semester'
  | 'subject'
  | 'task'
  | 'exam'
  | 'class_session'
  | 'attendance'
  | 'revision'
  | 'note'
  | 'timetable_slot'
  | 'topic'
  // Lockin entities
  | 'lockin_session'
  | 'lockin_streak'
  | 'lockin_exam_preset'
  | 'lockin_blocked_app'
  | 'lockin_yt_channel'
  | 'lockin_schedule'
  | 'lockin_app_quota'
  | 'lockin_reality_check'
  | 'lockin_emergency_pass';

export interface SyncQueueItem {
  id: string;
  userId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: any;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export interface SyncTombstone {
  entityType: SyncEntityType;
  entityId: string;
  userId: string;
  deletedAt: string;
}

export interface SyncMetadata {
  userId: string;
  tableName: string;
  lastSyncedAt: string;
  lastServerVersion: number;
}

export interface SyncConflictResult<T = any> {
  resolvedPayload: T | null; // null indicates delete wins
  strategy: 'local_wins' | 'remote_wins' | 'merged';
  reason: string;
}

export interface SyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  conflictCount: number;
  errors: string[];
  timestamp: string;
}

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingCount: number;
  error: string | null;
  isOnline: boolean;
}

export interface CloudRecord<T = any> {
  id: string;
  userId: string;
  entityType: SyncEntityType;
  payload: T;
  version: number;
  updatedAt: string;
  deletedAt?: string | null;
}
