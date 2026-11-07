/**
 * BunkMatKar — Database Connection & Adapter
 *
 * Provides a resilient, platform-aware SQLite database connection.
 * - Native (Android / iOS): expo-sqlite with WAL and foreign keys enabled
 * - Web / Fallback / Node test: High-fidelity in-memory SQLite emulation adapter
 */

import type { DatabaseConnection } from './types';
import { runMigrations } from './migrations';
import { openNativeDatabase } from './platform/nativeDatabase';

function isMobileNativePlatform(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return false;
  }
  try {
    const rn = require('react-native');
    return Boolean(rn?.Platform?.OS === 'android' || rn?.Platform?.OS === 'ios');
  } catch {
    return false;
  }
}

let cachedConnection: DatabaseConnection | null = null;
let isInitializing = false;

/**
 * Creates an in-memory SQL emulation engine for Web and Node/Jest environments.
 * Supports tables, primary keys, prepared statements, insert/update/delete,
 * transactions, and rollbacks.
 */
class InMemoryDatabaseAdapter implements DatabaseConnection {
  private tables = new Map<string, Map<string, Record<string, any>>>();
  private inTransaction = false;
  private transactionBackup: Map<string, Map<string, Record<string, any>>> | null = null;

  private getTable(name: string): Map<string, Record<string, any>> {
    let t = this.tables.get(name.toLowerCase());
    if (!t) {
      t = new Map();
      this.tables.set(name.toLowerCase(), t);
    }
    return t;
  }

  async execAsync(sql: string): Promise<void> {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      if (stmt.toUpperCase().startsWith('CREATE TABLE')) {
        const match = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
        if (match) {
          const tableName = match[1].toLowerCase();
          if (!this.tables.has(tableName)) {
            this.tables.set(tableName, new Map());
          }
        }
      } else if (stmt.toUpperCase().startsWith('DROP TABLE')) {
        const match = stmt.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
        if (match) {
          this.tables.delete(match[1].toLowerCase());
        }
      }
    }
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    const trimmed = sql.replace(/\r?\n/g, ' ').trim().replace(/;\s*$/, '');
    const upper = trimmed.toUpperCase();

    // INSERT INTO table (col1, col2) VALUES (?, ?) [ON CONFLICT(...) DO UPDATE SET ...]
    if (upper.startsWith('INSERT')) {
      const tableMatch = trimmed.match(/INSERT\s+(?:OR\s+REPLACE\s+|OR\s+IGNORE\s+)?INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (tableMatch) {
        const tableName = tableMatch[1].toLowerCase();
        const columns = tableMatch[2].split(',').map(c => c.trim().toLowerCase());
        const rawValues = tableMatch[3].split(',').map(v => v.trim());
        const table = this.getTable(tableName);

        const row: Record<string, any> = {};
        let paramIdx = 0;
        columns.forEach((col, idx) => {
          const valExpr = rawValues[idx];
          if (valExpr === undefined || valExpr === '?') {
            row[col] = params[paramIdx++] !== undefined ? params[paramIdx - 1] : null;
          } else if (valExpr.toLowerCase().startsWith('datetime')) {
            row[col] = new Date().toISOString();
          } else if (valExpr.startsWith("'") || valExpr.startsWith('"')) {
            row[col] = valExpr.slice(1, -1);
          } else if (/^-?\d+(\.\d+)?$/.test(valExpr)) {
            row[col] = Number(valExpr);
          } else if (valExpr.toLowerCase() === 'null') {
            row[col] = null;
          } else {
            row[col] = valExpr;
          }
        });

        // Determine the primary key for the in-memory map
        // Tables use id, key, version, subject_id, or task_id as primary keys
        const id = row.id ?? row.key ?? row.version ?? row.subject_id ?? row[columns[0]]
          ?? `auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        table.set(String(id), row);
        return { lastInsertRowId: 1, changes: 1 };
      }
    }

    // UPDATE table SET col1 = ?, col2 = ? WHERE condition
    if (upper.startsWith('UPDATE')) {
      const tableMatch = trimmed.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
      if (tableMatch) {
        const tableName = tableMatch[1].toLowerCase();
        const setClause = tableMatch[2];
        const whereClause = tableMatch[3];
        const table = this.getTable(tableName);

        const setAssignments = setClause.split(',').map(s => s.trim());
        let changes = 0;

        let paramIdx = 0;
        const setValues: Record<string, any> = {};
        for (const assign of setAssignments) {
          const parts = assign.split('=').map(s => s.trim());
          const col = parts[0].toLowerCase();
          const rhs = parts[1];
          if (rhs === '?') {
            setValues[col] = params[paramIdx++];
          } else if (rhs && rhs.toLowerCase().startsWith('datetime')) {
            setValues[col] = new Date().toISOString();
          } else if (rhs && (rhs.startsWith("'") || rhs.startsWith('"'))) {
            setValues[col] = rhs.slice(1, -1);
          } else if (rhs && /^-?\d+(\.\d+)?$/.test(rhs)) {
            setValues[col] = Number(rhs);
          } else if (rhs && rhs.toLowerCase() === 'null') {
            setValues[col] = null;
          } else {
            setValues[col] = rhs;
          }
        }

        // Apply where match
        for (const [key, row] of table.entries()) {
          let match = true;
          if (whereClause) {
            const whereTokens = whereClause.split(/\s+AND\s+/i);
            let whereParamIdx = paramIdx;
            for (const token of whereTokens) {
              const isNullMatch = token.match(/^([a-zA-Z0-9_]+)\s+IS\s+NULL$/i);
              const isNotNullMatch = token.match(/^([a-zA-Z0-9_]+)\s+IS\s+NOT\s+NULL$/i);
              if (isNullMatch) {
                const col = isNullMatch[1].toLowerCase();
                if (row[col] !== null && row[col] !== undefined) {
                  match = false;
                  break;
                }
                continue;
              }
              if (isNotNullMatch) {
                const col = isNotNullMatch[1].toLowerCase();
                if (row[col] === null || row[col] === undefined) {
                  match = false;
                  break;
                }
                continue;
              }

              const wParts = token.split('=').map(s => s.trim());
              const wCol = wParts[0].toLowerCase();
              const wRhs = wParts[1];
              let wExpected: any;
              if (wRhs === '?') {
                wExpected = params[whereParamIdx++];
              } else {
                const trimmedWRhs = wRhs.replace(/['"]/g, '');
                wExpected = /^-?\d+(\.\d+)?$/.test(trimmedWRhs) ? Number(trimmedWRhs) : trimmedWRhs;
              }
              if (row[wCol] !== wExpected) {
                match = false;
                break;
              }
            }
          }

          if (match) {
            table.set(key, { ...row, ...setValues });
            changes++;
          }
        }

        return { lastInsertRowId: 0, changes };
      }
    }

    // DELETE FROM table WHERE condition
    if (upper.startsWith('DELETE')) {
      const tableMatch = trimmed.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?$/i);
      if (tableMatch) {
        const tableName = tableMatch[1].toLowerCase();
        const whereClause = tableMatch[2];
        const table = this.getTable(tableName);

        if (!whereClause) {
          const count = table.size;
          table.clear();
          return { lastInsertRowId: 0, changes: count };
        }

        let changes = 0;
        for (const [key, row] of Array.from(table.entries())) {
          let match = true;
          const whereTokens = whereClause.split(/\s+AND\s+/i);
          let wIdx = 0;
          for (const token of whereTokens) {
            const compMatch = token.match(/^([a-zA-Z0-9_]+)\s*(=|<=|>=|<|>)\s*(.+)$/);
            if (!compMatch) continue;
            const dCol = compMatch[1].toLowerCase();
            const op = compMatch[2];
            const dRhs = compMatch[3].trim();
            let dExpected: any;
            if (dRhs === '?') {
              dExpected = params[wIdx++];
            } else {
              const trimmedDRhs = dRhs.replace(/['"]/g, '');
              dExpected = /^-?\d+(\.\d+)?$/.test(trimmedDRhs) ? Number(trimmedDRhs) : trimmedDRhs;
            }
            const val = row[dCol];
            if (op === '=' && val !== dExpected) match = false;
            else if (op === '<' && !(val < dExpected)) match = false;
            else if (op === '<=' && !(val <= dExpected)) match = false;
            else if (op === '>' && !(val > dExpected)) match = false;
            else if (op === '>=' && !(val >= dExpected)) match = false;

            if (!match) break;
          }
          if (match) {
            table.delete(key);
            changes++;
          }
        }
        return { lastInsertRowId: 0, changes };
      }
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    const trimmed = sql.replace(/\r?\n/g, ' ').trim().replace(/;\s*$/, ''); // Strip trailing semicolons
    const tableMatch = trimmed.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    if (!tableMatch) return [];

    const tableName = tableMatch[1].toLowerCase();

    if (tableName === 'sqlite_master') {
      const tableNames = Array.from(this.tables.keys()).map(name => ({
        type: 'table',
        name,
      }));
      let res = tableNames;
      const nameMatch = trimmed.match(/name\s*=\s*['"]([a-zA-Z0-9_]+)['"]/i);
      if (nameMatch) {
        res = res.filter(t => t.name.toLowerCase() === nameMatch[1].toLowerCase());
      }
      return res as any;
    }

    const table = this.getTable(tableName);
    let rows = Array.from(table.values());

    const whereMatch = trimmed.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s*$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const whereTokens = whereClause.split(/\s+AND\s+/i);

      rows = rows.filter(row => {
        let pIdx = 0;
        for (const token of whereTokens) {
          const isNullMatch = token.match(/^([a-zA-Z0-9_]+)\s+IS\s+NULL$/i);
          const isNotNullMatch = token.match(/^([a-zA-Z0-9_]+)\s+IS\s+NOT\s+NULL$/i);
          if (isNullMatch) {
            const col = isNullMatch[1].toLowerCase();
            if (row[col] !== null && row[col] !== undefined) return false;
            continue;
          }
          if (isNotNullMatch) {
            const col = isNotNullMatch[1].toLowerCase();
            if (row[col] === null || row[col] === undefined) return false;
            continue;
          }

          const compMatch = token.match(/^([a-zA-Z0-9_]+)\s*(=|<=|>=|<|>)\s*(.+)$/);
          if (compMatch) {
            const col = compMatch[1].toLowerCase();
            const op = compMatch[2];
            const rhs = compMatch[3].trim();
            let expectedValue: any;

            if (rhs === '?') {
              expectedValue = params[pIdx++];
            } else {
              const trimmedRhs = rhs.replace(/['"]/g, '');
              expectedValue = /^-?\d+(\.\d+)?$/.test(trimmedRhs)
                ? Number(trimmedRhs)
                : trimmedRhs;
            }

            const val = row[col];
            if (op === '=' && val !== expectedValue) return false;
            if (op === '<' && !(val < expectedValue)) return false;
            if (op === '<=' && !(val <= expectedValue)) return false;
            if (op === '>' && !(val > expectedValue)) return false;
            if (op === '>=' && !(val >= expectedValue)) return false;
          }
        }
        return true;
      });
    }

    // Support SELECT COUNT(*) projection
    const countMatch = trimmed.match(/^SELECT\s+COUNT\(\*\)(?:\s+AS\s+([a-zA-Z0-9_]+))?/i);
    if (countMatch) {
      const alias = countMatch[1] || 'count';
      return [{ [alias]: rows.length }] as any;
    }

    // ORDER BY support
    const orderMatch = trimmed.match(/\s+ORDER\s+BY\s+(.+?)(?:\s+LIMIT|\s*$)/i);
    if (orderMatch) {
      const orderClauses = orderMatch[1].split(',').map(s => s.trim());
      rows.sort((a, b) => {
        for (const clause of orderClauses) {
          const parts = clause.split(/\s+/);
          const col = parts[0].toLowerCase();
          const dir = parts[1] && parts[1].toUpperCase() === 'DESC' ? -1 : 1;
          const valA = a[col];
          const valB = b[col];
          if (valA === valB) continue;
          if (valA === null || valA === undefined) return 1 * dir;
          if (valB === null || valB === undefined) return -1 * dir;
          if (typeof valA === 'number' && typeof valB === 'number') {
            return (valA - valB) * dir;
          }
          return String(valA).localeCompare(String(valB)) * dir;
        }
        return 0;
      });
    }

    const limitMatch = trimmed.match(/\s+LIMIT\s+(\d+)/i);
    const limit = limitMatch ? Number(limitMatch[1]) : undefined;

    const result = limit !== undefined ? rows.slice(0, limit) : rows;
    return result as T[];
  }

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    const all = await this.getAllAsync<T>(sql, params);
    return all.length > 0 ? all[0] : null;
  }

  async withTransactionAsync<T>(action: () => Promise<T>): Promise<T> {
    if (this.inTransaction) {
      return await action();
    }

    this.inTransaction = true;
    // Deep clone state for rollback
    this.transactionBackup = new Map();
    for (const [tName, map] of this.tables.entries()) {
      this.transactionBackup.set(tName, new Map(map));
    }

    try {
      const result = await action();
      this.transactionBackup = null;
      this.inTransaction = false;
      return result;
    } catch (error) {
      // Rollback
      if (this.transactionBackup) {
        this.tables = this.transactionBackup;
        this.transactionBackup = null;
      }
      this.inTransaction = false;
      throw error;
    }
  }

  clearAll(): void {
    this.tables.clear();
  }
}

/**
 * Initializes and retrieves the singleton DatabaseConnection.
 */
export async function getDatabaseConnection(): Promise<DatabaseConnection> {
  if (cachedConnection) {
    return cachedConnection;
  }

  if (isInitializing) {
    // Wait for in-flight initialization
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 50));
    }
    if (cachedConnection) return cachedConnection;
  }

  isInitializing = true;

  try {
    // Use native expo-sqlite on iOS and Android
    if (isMobileNativePlatform()) {
      try {
        const nativeConn = await openNativeDatabase();
        if (nativeConn) {
          cachedConnection = nativeConn;
        } else {
          cachedConnection = new InMemoryDatabaseAdapter();
        }
      } catch (err) {
        console.warn('[Database] Native SQLite open failed, falling back to in-memory adapter:', err);
        cachedConnection = new InMemoryDatabaseAdapter();
      }
    } else {
      // Web / Node.js test environment
      cachedConnection = new InMemoryDatabaseAdapter();
    }

    return cachedConnection;
  } finally {
    isInitializing = false;
  }
}

/**
 * Boots the database, applies all pending migrations, and guarantees readiness.
 */
export async function initDatabase(): Promise<DatabaseConnection> {
  const db = await getDatabaseConnection();
  await runMigrations(db);
  return db;
}

/**
 * Reset connection for unit tests or database teardown.
 */
export function resetDatabaseConnectionForTesting(): void {
  cachedConnection = null;
}
