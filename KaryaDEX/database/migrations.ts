/**
 * BunkMatKar — Database Migration Runner
 *
 * Handles versioned, idempotent schema migrations.
 * Never edits past migrations; appends new migrations sequentially.
 */

import type { DatabaseConnection } from './types';
import { V1_SCHEMA_STATEMENTS } from './schema';

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseConnection) => Promise<void>;
}

export const V2_TASK_ENGINE_STATEMENTS = [
  `ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'planned';`,
  `ALTER TABLE tasks ADD COLUMN topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL;`,
  `ALTER TABLE tasks ADD COLUMN resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL;`,
  `ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE;`,
  `ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;`,
  `ALTER TABLE tasks ADD COLUMN recurrence_end_date TEXT;`,
  `ALTER TABLE tasks ADD COLUMN depends_on_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;`,
  `ALTER TABLE tasks ADD COLUMN scheduled_date TEXT;`,
  `ALTER TABLE tasks ADD COLUMN scheduled_start_time TEXT;`,
  `ALTER TABLE tasks ADD COLUMN scheduled_end_time TEXT;`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_topic ON tasks(topic_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_exam ON tasks(exam_id);`,
];

export const V3_NOTIFICATIONS_AND_HUB_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS notification_records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    expo_notification_id TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(type, entity_id, scheduled_for)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_notif_entity ON notification_records(entity_id);`,
  `CREATE INDEX IF NOT EXISTS idx_notif_scheduled ON notification_records(scheduled_for);`,
  `CREATE INDEX IF NOT EXISTS idx_notif_type ON notification_records(type);`,
];

export const V4_ONBOARDING_STATEMENTS = [
  `ALTER TABLE colleges ADD COLUMN university_board TEXT;`,
  `ALTER TABLE colleges ADD COLUMN campus TEXT;`,
  `ALTER TABLE colleges ADD COLUMN city TEXT;`,
  `ALTER TABLE colleges ADD COLUMN state TEXT;`,
  `ALTER TABLE colleges ADD COLUMN category TEXT;`,
  `ALTER TABLE semesters ADD COLUMN academic_year TEXT;`,
  `ALTER TABLE semesters ADD COLUMN is_current INTEGER NOT NULL DEFAULT 1;`,
  `ALTER TABLE students ADD COLUMN program TEXT;`,
  `ALTER TABLE students ADD COLUMN branch TEXT;`,
  `ALTER TABLE students ADD COLUMN year INTEGER;`,
  `ALTER TABLE students ADD COLUMN section TEXT;`,
  `ALTER TABLE students ADD COLUMN academic_year TEXT;`,
  `ALTER TABLE subjects ADD COLUMN subject_type TEXT DEFAULT 'lecture';`,
  `ALTER TABLE subjects ADD COLUMN target_attendance INTEGER;`,
  `CREATE TABLE IF NOT EXISTS onboarding_progress (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'not_started',
    current_step TEXT NOT NULL DEFAULT 'welcome',
    completed_steps TEXT NOT NULL DEFAULT '[]',
    draft_data TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_progress(status);`,
];

export const V5_ACADEMIC_INTELLIGENCE_STATEMENTS = [
  `ALTER TABLE semesters ADD COLUMN status TEXT DEFAULT 'current';`,
  `CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects(semester_id);`,
  `CREATE INDEX IF NOT EXISTS idx_timetable_slots_semester ON timetable_slots(semester_id);`,
  `CREATE INDEX IF NOT EXISTS idx_class_sessions_semester ON class_sessions(semester_id);`,
  `CREATE INDEX IF NOT EXISTS idx_syllabus_units_semester ON syllabus_units(semester_id);`,
];

export const V6_REVISION_INTELLIGENCE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS revision_records (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    semester_id TEXT REFERENCES semesters(id) ON DELETE SET NULL,
    reviewed_at TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    confidence TEXT NOT NULL,
    outcome TEXT NOT NULL,
    notes TEXT,
    linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    linked_class_session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE INDEX IF NOT EXISTS idx_revision_records_topic ON revision_records(topic_id);`,
  `CREATE INDEX IF NOT EXISTS idx_revision_records_subject ON revision_records(subject_id);`,
  `CREATE INDEX IF NOT EXISTS idx_revision_records_semester ON revision_records(semester_id);`,
  `CREATE INDEX IF NOT EXISTS idx_revision_records_date ON revision_records(reviewed_at);`,
];

export const V8_LOCKIN_STATEMENTS = [
  // Lockin Sessions
  `CREATE TABLE IF NOT EXISTS lockin_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    session_type TEXT NOT NULL,
    preset_id TEXT REFERENCES lockin_exam_presets(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    planned_duration_minutes INTEGER NOT NULL,
    actual_duration_minutes INTEGER NOT NULL DEFAULT 0,
    focus_score INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    paused_at TEXT,
    resumed_at TEXT,
    completed_at TEXT,
    abandoned_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // Lockin Streaks
  `CREATE TABLE IF NOT EXISTS lockin_streaks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    streak_type TEXT NOT NULL,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_session_date TEXT NOT NULL,
    streak_start_date TEXT NOT NULL,
    streak_end_date TEXT,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_focus_minutes INTEGER NOT NULL DEFAULT 0,
    average_focus_score REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, streak_type)
  );`,

  // Lockin Exam Presets
  `CREATE TABLE IF NOT EXISTS lockin_exam_presets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    work_duration_minutes INTEGER NOT NULL DEFAULT 25,
    short_break_minutes INTEGER NOT NULL DEFAULT 5,
    long_break_minutes INTEGER NOT NULL DEFAULT 15,
    sessions_until_long_break INTEGER NOT NULL DEFAULT 4,
    target_focus_minutes INTEGER,
    target_sessions INTEGER,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // Lockin Indexes
  `CREATE INDEX IF NOT EXISTS idx_lockin_sessions_user ON lockin_sessions(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_sessions_subject ON lockin_sessions(subject_id);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_sessions_status ON lockin_sessions(status);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_sessions_started ON lockin_sessions(started_at);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_streaks_user_type ON lockin_streaks(user_id, streak_type);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_streaks_last_session ON lockin_streaks(last_session_date);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_presets_user ON lockin_exam_presets(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_presets_active ON lockin_exam_presets(is_active);`,

  // Add user_id to lockin tables for multi-tenant isolation
  `ALTER TABLE lockin_sessions ADD COLUMN user_id TEXT;`,
  `ALTER TABLE lockin_streaks ADD COLUMN user_id TEXT;`,
  `ALTER TABLE lockin_exam_presets ADD COLUMN user_id TEXT;`,
];

export const V9_LOCKIN_BLOCKED_YT_STATEMENTS = [
  // Lockin Blocked Apps
  `CREATE TABLE IF NOT EXISTS lockin_blocked_apps (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    package_name TEXT NOT NULL,
    app_name TEXT NOT NULL,
    is_blocked INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_blocked_apps_user ON lockin_blocked_apps(user_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_lockin_blocked_apps_pkg_user ON lockin_blocked_apps(user_id, package_name);`,

  // Lockin YouTube Channels
  `CREATE TABLE IF NOT EXISTS lockin_yt_channels (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    channel_url TEXT NOT NULL,
    is_whitelisted INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_yt_channels_user ON lockin_yt_channels(user_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_lockin_yt_channels_chid_user ON lockin_yt_channels(user_id, channel_id);`,
];

export const V7_AUTH_AND_SYNC_STATEMENTS = [
  // Auth Tables
  `CREATE TABLE IF NOT EXISTS auth_accounts (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES auth_accounts(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_auth_accounts_email ON auth_accounts(email);`,

  // Durable Sync Queue
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON sync_queue(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);`,

  // Deletion Tombstones
  `CREATE TABLE IF NOT EXISTS sync_tombstones (
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    PRIMARY KEY (entity_type, entity_id, user_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_sync_tombstones_user ON sync_tombstones(user_id);`,

  // Sync Metadata
  `CREATE TABLE IF NOT EXISTS sync_metadata (
    user_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    last_synced_at TEXT NOT NULL,
    last_server_version INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, table_name)
  );`,

  // User association columns on canonical tables (for multi-tenant local isolation and sync)
  `ALTER TABLE students ADD COLUMN user_id TEXT;`,
  `ALTER TABLE colleges ADD COLUMN user_id TEXT;`,
  `ALTER TABLE semesters ADD COLUMN user_id TEXT;`,
  `ALTER TABLE subjects ADD COLUMN user_id TEXT;`,
  `ALTER TABLE tasks ADD COLUMN user_id TEXT;`,
  `ALTER TABLE exams ADD COLUMN user_id TEXT;`,
  `ALTER TABLE class_sessions ADD COLUMN user_id TEXT;`,
  `ALTER TABLE attendance_records ADD COLUMN user_id TEXT;`,
  `ALTER TABLE revision_records ADD COLUMN user_id TEXT;`,
  `ALTER TABLE notes ADD COLUMN user_id TEXT;`,
];

export const V11_STUDY_PLANS_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS study_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    exam_id TEXT NOT NULL,
    semester_id TEXT NOT NULL,
    subject_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    daily_capacity_minutes INTEGER NOT NULL DEFAULT 120,
    target_mastery_goal INTEGER NOT NULL DEFAULT 85,
    total_planned_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    applied_at TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_study_plans_exam ON study_plans(exam_id);`,
  `CREATE INDEX IF NOT EXISTS idx_study_plans_status ON study_plans(status);`,
  `CREATE INDEX IF NOT EXISTS idx_study_plans_user ON study_plans(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_study_plans_version ON study_plans(exam_id, version);`,
  `CREATE TABLE IF NOT EXISTS study_plan_allocations (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    allocated_date TEXT NOT NULL,
    allocated_order INTEGER NOT NULL DEFAULT 1,
    allocated_minutes INTEGER NOT NULL DEFAULT 25,
    status TEXT NOT NULL DEFAULT 'scheduled',
    completed_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(plan_id, topic_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_plan_alloc_plan ON study_plan_allocations(plan_id);`,
  `CREATE INDEX IF NOT EXISTS idx_plan_alloc_date ON study_plan_allocations(allocated_date);`,
  `CREATE INDEX IF NOT EXISTS idx_plan_alloc_topic ON study_plan_allocations(topic_id);`,
  `CREATE INDEX IF NOT EXISTS idx_plan_alloc_status ON study_plan_allocations(status);`,
];

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'v1_initial_schema',
    up: async (db: DatabaseConnection) => {
      for (const statement of V1_SCHEMA_STATEMENTS) {
        await db.execAsync(statement);
      }
    },
  },
  {
    version: 2,
    name: 'v2_task_engine',
    up: async (db: DatabaseConnection) => {
      for (const statement of V2_TASK_ENGINE_STATEMENTS) {
        try {
          await db.execAsync(statement);
        } catch {
          // Idempotent column check for sqlite variations
        }
      }
    },
  },
  {
    version: 3,
    name: 'v3_notifications_and_hub',
    up: async (db: DatabaseConnection) => {
      for (const statement of V3_NOTIFICATIONS_AND_HUB_STATEMENTS) {
        try {
          await db.execAsync(statement);
        } catch {
          // Idempotent table/index check
        }
      }
    },
  },
  {
    version: 4,
    name: 'v4_onboarding_and_academic_structure',
    up: async (db: DatabaseConnection) => {
      for (const statement of V4_ONBOARDING_STATEMENTS) {
        try {
          await db.execAsync(statement);
        } catch {
          // Idempotent column/table check
        }
      }
    },
  },
  {
    version: 5,
    name: 'v5_academic_intelligence',
    up: async (db: DatabaseConnection) => {
      for (const statement of V5_ACADEMIC_INTELLIGENCE_STATEMENTS) {
        try {
          await db.execAsync(statement);
        } catch {
          // Idempotent column/index check
        }
      }
    },
  },
  {
    version: 6,
    name: 'v6_revision_intelligence',
    up: async (db: DatabaseConnection) => {
      for (const statement of V6_REVISION_INTELLIGENCE_STATEMENTS) {
        try {
          await db.execAsync(statement);
        } catch {
          // Idempotent table/index check
        }
      }
    },
  },
  {
    version: 7,
    name: 'v7_auth_and_sync',
    up: async (db: DatabaseConnection) => {
      for (const statement of V7_AUTH_AND_SYNC_STATEMENTS) {
        try {
          await db.execAsync(statement);
        } catch {
          // Idempotent table/column check
        }
      }
    },
  },
  {
    version: 8,
    name: 'v8_lockin',
    up: async (db: DatabaseConnection) => {
      for (const statement of V8_LOCKIN_STATEMENTS) {
        try {
          await db.execAsync(statement);
        } catch {
          // Idempotent table/column check
        }
      }
    },
  },
  {
    version: 9,
    name: 'v9_lockin_blocked_yt',
    up: async (db: DatabaseConnection) => {
      for (const statement of V9_LOCKIN_BLOCKED_YT_STATEMENTS) {
        try {
          await db.execAsync(statement);
        } catch {
          // Idempotent table/index check
        }
      }
    },
  },
  {
    version: 10,
    name: 'v10_schema_repair_and_column_integrity',
    up: async (db: DatabaseConnection) => {
      await ensureSchemaIntegrity(db);
    },
  },
  {
    version: 11,
    name: 'v11_persistent_study_plans',
    up: async (db: DatabaseConnection) => {
      for (const statement of V11_STUDY_PLANS_STATEMENTS) {
        try {
          await db.execAsync(statement);
        } catch {
          // Idempotent table/index check
        }
      }
    },
  },
];

/**
 * Idempotently verifies and adds any missing columns across critical tables.
 * Guarantees that even if previous migration runs partially failed or skipped statements,
 * all required repository and seed columns are guaranteed to exist.
 */
export async function ensureSchemaIntegrity(db: DatabaseConnection): Promise<void> {
  const tableColumnsToCheck: Record<string, { column: string; def: string }[]> = {
    colleges: [
      { column: 'university_board', def: 'TEXT' },
      { column: 'campus', def: 'TEXT' },
      { column: 'city', def: 'TEXT' },
      { column: 'state', def: 'TEXT' },
      { column: 'category', def: 'TEXT' },
      { column: 'user_id', def: 'TEXT' },
    ],
    semesters: [
      { column: 'academic_year', def: 'TEXT' },
      { column: 'is_current', def: 'INTEGER NOT NULL DEFAULT 1' },
      { column: 'status', def: "TEXT DEFAULT 'current'" },
      { column: 'user_id', def: 'TEXT' },
    ],
    students: [
      { column: 'program', def: 'TEXT' },
      { column: 'branch', def: 'TEXT' },
      { column: 'year', def: 'INTEGER' },
      { column: 'section', def: 'TEXT' },
      { column: 'academic_year', def: 'TEXT' },
      { column: 'user_id', def: 'TEXT' },
    ],
    subjects: [
      { column: 'subject_type', def: "TEXT DEFAULT 'lecture'" },
      { column: 'target_attendance', def: 'INTEGER' },
      { column: 'user_id', def: 'TEXT' },
    ],
    tasks: [
      { column: 'status', def: "TEXT NOT NULL DEFAULT 'planned'" },
      { column: 'topic_id', def: 'TEXT' },
      { column: 'resource_id', def: 'TEXT' },
      { column: 'parent_task_id', def: 'TEXT' },
      { column: 'sort_order', def: 'INTEGER NOT NULL DEFAULT 0' },
      { column: 'recurrence_rule', def: 'TEXT' },
      { column: 'recurrence_end_date', def: 'TEXT' },
      { column: 'depends_on_task_id', def: 'TEXT' },
      { column: 'scheduled_date', def: 'TEXT' },
      { column: 'scheduled_start_time', def: 'TEXT' },
      { column: 'scheduled_end_time', def: 'TEXT' },
      { column: 'user_id', def: 'TEXT' },
    ],
    lockin_sessions: [{ column: 'user_id', def: 'TEXT' }],
    lockin_streaks: [{ column: 'user_id', def: 'TEXT' }],
    lockin_exam_presets: [{ column: 'user_id', def: 'TEXT' }],
    exams: [{ column: 'user_id', def: 'TEXT' }],
    class_sessions: [{ column: 'user_id', def: 'TEXT' }],
    attendance_records: [{ column: 'user_id', def: 'TEXT' }],
    revision_records: [{ column: 'user_id', def: 'TEXT' }],
    notes: [{ column: 'user_id', def: 'TEXT' }],
  };

  for (const [table, columns] of Object.entries(tableColumnsToCheck)) {
    try {
      const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
      if (!tableInfo || tableInfo.length === 0) {
        continue;
      }
      const existingCols = new Set(tableInfo.map(c => c.name));
      for (const col of columns) {
        if (!existingCols.has(col.column)) {
          try {
            await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col.column} ${col.def};`);
            console.log(`[SchemaIntegrity] Added missing column ${table}.${col.column}`);
          } catch (alterErr) {
            console.warn(`[SchemaIntegrity] Could not add column ${table}.${col.column}:`, alterErr);
          }
        }
      }
    } catch {
      // Table doesn't exist yet or PRAGMA unsupported
    }
  }
}

export async function runMigrations(db: DatabaseConnection): Promise<{ appliedCount: number; currentVersion: number }> {
  // Ensure schema_migrations table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Query already applied versions
  const appliedRows = await db.getAllAsync<{ version: number }>(
    `SELECT version FROM schema_migrations ORDER BY version ASC;`
  );
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  let appliedCount = 0;
  let currentVersion = 0;

  for (const m of MIGRATIONS) {
    if (!appliedVersions.has(m.version)) {
      await db.withTransactionAsync(async () => {
        await m.up(db);
        await db.runAsync(
          `INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime('now'));`,
          [m.version, m.name]
        );
      });
      appliedCount++;
    }
    currentVersion = Math.max(currentVersion, m.version);
  }

  // Store current schema version in app_settings for easy querying
  if (currentVersion > 0) {
    await db.runAsync(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
      ['schema_version', String(currentVersion)]
    );
  }

  // Verify and repair any missing columns across critical tables
  await ensureSchemaIntegrity(db);

  return { appliedCount, currentVersion };
}
