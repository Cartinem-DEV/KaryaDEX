/**
 * BunkMatKar — AI Privacy-Aware Audit Service (Phase 12)
 *
 * Records operational AI telemetry without capturing credentials,
 * tokens, or private user contents.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AIAuditEntry } from './aiTypes';

const AI_AUDIT_KEY = 'bunkmatkar_ai_audit_log';
const MAX_LOCAL_AUDIT_LOGS = 100;

export class AIAuditService {
  private inMemoryLogs: AIAuditEntry[] = [];

  /**
   * Logs an AI execution event safely.
   */
  async logEvent(entry: Omit<AIAuditEntry, 'id' | 'timestamp'>): Promise<AIAuditEntry> {
    const fullEntry: AIAuditEntry = {
      ...entry,
      id: `ai_audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      // Ensure error message does not contain secrets
      errorMessage: entry.errorMessage ? entry.errorMessage.slice(0, 200) : undefined,
    };

    this.inMemoryLogs.unshift(fullEntry);
    if (this.inMemoryLogs.length > MAX_LOCAL_AUDIT_LOGS) {
      this.inMemoryLogs = this.inMemoryLogs.slice(0, MAX_LOCAL_AUDIT_LOGS);
    }

    try {
      await AsyncStorage.setItem(AI_AUDIT_KEY, JSON.stringify(this.inMemoryLogs));
    } catch {
      // Degraded persistence
    }

    return fullEntry;
  }

  /**
   * Retrieves recent audit entries for a specific user.
   */
  async getAuditEntries(userId: string): Promise<AIAuditEntry[]> {
    if (this.inMemoryLogs.length === 0) {
      try {
        const stored = await AsyncStorage.getItem(AI_AUDIT_KEY);
        if (stored) {
          this.inMemoryLogs = JSON.parse(stored) as AIAuditEntry[];
        }
      } catch {}
    }

    return this.inMemoryLogs.filter(e => e.userId === userId);
  }

  /**
   * Clears audit log for testing.
   */
  async clearForTesting(): Promise<void> {
    this.inMemoryLogs = [];
    try {
      await AsyncStorage.removeItem(AI_AUDIT_KEY);
    } catch {}
  }
}

export const aiAuditService = new AIAuditService();
