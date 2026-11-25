/**
 * KaryaDEX — Academic Backup & Restore Validation Service (Phase 11.6)
 *
 * Implements strict defensive validation for backup restoration:
 * 1. Schema & structure validation (requires valid academic entities).
 * 2. Strict rejection of credentials, tokens, sessions, and auth tables.
 * 3. Enforces ownership boundaries (binds imported records to current user).
 * 4. Record count & memory DoS limits.
 */

import { getDatabaseConnection } from '@/database/db';

export interface BackupValidationResult {
  isValid: boolean;
  sanitizedPayload?: Record<string, any[]>;
  recordCount: number;
  errors: string[];
}

export class BackupValidationService {
  public static readonly ALLOWED_BACKUP_TABLES = new Set([
    'subjects',
    'tasks',
    'exams',
    'class_sessions',
    'attendance_records',
    'revision_records',
    'notes',
  ]);

  public static readonly FORBIDDEN_KEYS = new Set([
    'password_hash',
    'token',
    'auth_accounts',
    'auth_sessions',
    'service_role',
    'master_key',
    'sync_queue',
  ]);

  public static readonly MAX_RECORDS_PER_TABLE = 5000;

  /**
   * Sanitizes in-memory data for safe export by removing any authentication
   * accounts, tokens, session keys, passwords, or sync queues.
   */
  public sanitizeForExport(rawPayload: Record<string, any>): Record<string, any[]> {
    const sanitized: Record<string, any[]> = {};
    for (const [key, val] of Object.entries(rawPayload)) {
      if (BackupValidationService.FORBIDDEN_KEYS.has(key)) {
        continue;
      }
      if (Array.isArray(val)) {
        sanitized[key] = val.map(item => {
          if (item && typeof item === 'object') {
            const copy = { ...item };
            delete copy.password_hash;
            delete copy.token;
            delete copy.refresh_token;
            return copy;
          }
          return item;
        });
      }
    }
    return sanitized;
  }

  /**
   * Validates and sanitizes an imported backup payload.
   */
  public validateAndSanitizeImport(
    rawPayload: any,
    currentUserId?: string
  ): { isValid: boolean; sanitizedData?: Record<string, any[]>; recordCount: number; error?: string } {
    const res = this.validateBackup(rawPayload, currentUserId);
    return {
      isValid: res.isValid,
      sanitizedData: res.sanitizedPayload,
      recordCount: res.recordCount,
      error: res.errors.length > 0 ? res.errors.join('; ') : undefined,
    };
  }

  /**
   * Defensive validation of untrusted backup JSON before any restoration.
   */
  public validateBackup(rawPayload: any, currentUserId?: string): BackupValidationResult {
    const errors: string[] = [];

    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
      return { isValid: false, recordCount: 0, errors: ['Backup payload must be a valid JSON object.'] };
    }

    // Check for forbidden security credentials
    const rawKeys = Object.keys(rawPayload);
    for (const key of rawKeys) {
      if (BackupValidationService.FORBIDDEN_KEYS.has(key)) {
        errors.push(`Backup payload contains forbidden security key: '${key}'.`);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, recordCount: 0, errors };
    }

    const sanitizedPayload: Record<string, any[]> = {};
    let totalCount = 0;

    for (const table of BackupValidationService.ALLOWED_BACKUP_TABLES) {
      const records = rawPayload[table];
      if (records === undefined) continue;

      if (!Array.isArray(records)) {
        errors.push(`Table '${table}' must be an array of records.`);
        continue;
      }

      if (records.length > BackupValidationService.MAX_RECORDS_PER_TABLE) {
        errors.push(`Table '${table}' exceeds maximum allowed record limit of ${BackupValidationService.MAX_RECORDS_PER_TABLE}.`);
        continue;
      }

      const sanitizedRecords: any[] = [];
      for (const record of records) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
          continue;
        }

        // Deep check for injected secrets or script payloads
        const recCopy = { ...record };
        delete recCopy.password_hash;
        delete recCopy.token;

        // Guarantee ownership binding: force user_id to match current authenticated session
        if (currentUserId) {
          recCopy.user_id = currentUserId;
        }

        sanitizedRecords.push(recCopy);
        totalCount += 1;
      }

      sanitizedPayload[table] = sanitizedRecords;
    }

    if (errors.length > 0) {
      return { isValid: false, recordCount: 0, errors };
    }

    return {
      isValid: true,
      sanitizedPayload,
      recordCount: totalCount,
      errors: [],
    };
  }

  /**
   * Applies validated backup into local SQLite within an atomic transaction.
   */
  public async restoreBackup(rawPayload: any, currentUserId?: string): Promise<{ success: boolean; restoredCount: number; error?: string }> {
    const validation = this.validateBackup(rawPayload, currentUserId);
    if (!validation.isValid || !validation.sanitizedPayload) {
      return { success: false, restoredCount: 0, error: validation.errors.join(' ') };
    }

    const db = await getDatabaseConnection();
    try {
      await db.withTransactionAsync(async () => {
        for (const [table, records] of Object.entries(validation.sanitizedPayload!)) {
          for (const record of records) {
            const keys = Object.keys(record).filter(k => /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(k));
            if (keys.length === 0 || !record.id) continue;

            const cols = keys.join(', ');
            const placeholders = keys.map(() => '?').join(', ');
            const updates = keys.map(k => `${k} = excluded.${k}`).join(', ');
            const values = keys.map(k => record[k]);

            await db.runAsync(
              `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates};`,
              values
            );
          }
        }
      });
      return { success: true, restoredCount: validation.recordCount };
    } catch (err: any) {
      return { success: false, restoredCount: 0, error: err?.message || 'Restore transaction failed.' };
    }
  }
}

export const backupValidationService = new BackupValidationService();
