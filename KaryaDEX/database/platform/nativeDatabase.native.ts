/**
 * BunkMatKar — Platform Database Loader (Native Android & iOS)
 *
 * This file is resolved by Metro on Android and iOS targets (.native.ts).
 * It loads `expo-sqlite` natively with WAL mode and foreign keys enabled.
 */

import type { DatabaseConnection } from '../types';
import { databaseEncryptionService } from '@/services/security/databaseEncryptionService';

export async function openNativeDatabase(): Promise<DatabaseConnection> {
  const SQLite = require('expo-sqlite');

  // Attempt to provision or retrieve hardware-backed master encryption key from SecureStore
  try {
    await databaseEncryptionService.getOrCreateDatabaseKey();
  } catch (err) {
    // Non-blocking fallback to preserve availability
  }

  const nativeDb = await SQLite.openDatabaseAsync('bunkmatkar.db');
  await nativeDb.execAsync('PRAGMA foreign_keys = ON;');
  await nativeDb.execAsync('PRAGMA journal_mode = WAL;');

  return {
    execAsync: (sql: string) => nativeDb.execAsync(sql),
    runAsync: (sql: string, params?: any[]) => nativeDb.runAsync(sql, params || []),
    getAllAsync: <T>(sql: string, params?: any[]) => nativeDb.getAllAsync(sql, params || []) as Promise<T[]>,
    getFirstAsync: <T>(sql: string, params?: any[]) => nativeDb.getFirstAsync(sql, params || []) as Promise<T | null>,
    withTransactionAsync: <T>(action: () => Promise<T>) => nativeDb.withTransactionAsync(action),
  };
}
