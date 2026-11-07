/**
 * BunkMatKar — Database Schema Definitions (V1)
 *
 * Defines relational tables, constraints, foreign keys, and indexes.
 */

export const V1_SCHEMA_STATEMENTS = [
  // 1. Colleges
  `CREATE TABLE IF NOT EXISTS colleges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    university_board TEXT,
    campus TEXT,
    city TEXT,
    state TEXT,
    category TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // 2. Semesters
  `CREATE TABLE IF NOT EXISTS semesters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    number INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    college_id TEXT REFERENCES colleges(id) ON DELETE SET NULL,
    academic_year TEXT,
    is_current INTEGER NOT NULL DEFAULT 1,
    status TEXT DEFAULT 'current',
    user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // 3. Students / User Profile
  `CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    college_id TEXT REFERENCES colleges(id) ON DELETE SET NULL,
    semester_id TEXT REFERENCES semesters(id) ON DELETE SET NULL,
    program TEXT,
    branch TEXT,
    year INTEGER,
    section TEXT,
    academic_year TEXT,
    user_id TEXT,
    attendance_target INTEGER NOT NULL DEFAULT 75,
    created_at TEXT NOT NULL
  );`,

  // 4. Subjects
  `CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    code TEXT NOT NULL,
    color TEXT NOT NULL,
    semester_id TEXT REFERENCES semesters(id) ON DELETE SET NULL,
    faculty_id TEXT,
    faculty_name TEXT,
    room TEXT,
    credits INTEGER NOT NULL DEFAULT 3,
    subject_type TEXT DEFAULT 'lecture',
    target_attendance INTEGER,
    user_id TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // 5. Timetable Slots (Recurring schedule rules)
  `CREATE TABLE IF NOT EXISTS timetable_slots (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    semester_id TEXT REFERENCES semesters(id) ON DELETE SET NULL,
    day_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT,
    type TEXT NOT NULL DEFAULT 'lecture',
    is_active INTEGER NOT NULL DEFAULT 1,
    is_recurring INTEGER NOT NULL DEFAULT 1,
    effective_from TEXT,
    effective_until TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  // 6. Class Sessions (Specific date occurrences)
  `CREATE TABLE IF NOT EXISTS class_sessions (
    id TEXT PRIMARY KEY,
    timetable_slot_id TEXT NOT NULL REFERENCES timetable_slots(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT,
    type TEXT NOT NULL DEFAULT 'lecture',
    attendance_status TEXT NOT NULL DEFAULT 'not_recorded',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(timetable_slot_id, date)
  );`,

  // 7. Class Notes (Occurrence-bound journal records)
  `CREATE TABLE IF NOT EXISTS class_notes (
    id TEXT PRIMARY KEY,
    class_session_id TEXT NOT NULL,
    date TEXT NOT NULL,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    attendance_status TEXT NOT NULL DEFAULT 'not_recorded',
    my_notes TEXT NOT NULL DEFAULT '',
    teacher_notes TEXT NOT NULL DEFAULT '',
    revision_status TEXT NOT NULL DEFAULT 'not_started',
    last_revised_at TEXT,
    ai_summary TEXT,
    ai_summary_status TEXT,
    ai_summary_updated_at TEXT,
    ai_source_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(class_session_id, date)
  );`,

  // 8. Class Session Topics Link Table
  `CREATE TABLE IF NOT EXISTS class_session_topics (
    id TEXT PRIMARY KEY,
    class_session_id TEXT NOT NULL,
    date TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(class_session_id, date, topic_id)
  );`,

  // 9. Attendance Records
  `CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_session_id TEXT,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(subject_id, date, class_session_id)
  );`,

  // 10. Attendance Aggregates (Authoritative cached totals for pure O(1) performance)
  `CREATE TABLE IF NOT EXISTS attendance_aggregates (
    subject_id TEXT PRIMARY KEY REFERENCES subjects(id) ON DELETE CASCADE,
    attended INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );`,

  // 11. Syllabus Units
  `CREATE TABLE IF NOT EXISTS syllabus_units (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    semester_id TEXT REFERENCES semesters(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // 12. Topics
  `CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL REFERENCES syllabus_units(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    revision_status TEXT NOT NULL DEFAULT 'not_started',
    last_revised_at TEXT,
    revision_count INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // 13. Topic Revision History
  `CREATE TABLE IF NOT EXISTS topic_revision_history (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    revision_status TEXT NOT NULL,
    revised_at TEXT NOT NULL,
    class_session_id TEXT,
    notes TEXT
  );`,

  // 13b. Persistent Revision Records (Phase 7)
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

  // 14. Resources (Metadata only; physical files kept in fileStorageService)
  `CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    class_note_id TEXT,
    class_session_id TEXT,
    subject_id TEXT REFERENCES subjects(id) ON DELETE CASCADE,
    topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
    exam_id TEXT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    uri TEXT,
    url TEXT,
    mime_type TEXT,
    file_size INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual',
    is_local INTEGER NOT NULL DEFAULT 1,
    is_recommended INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`,

  // 15. Tasks
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    class_session_id TEXT,
    class_date TEXT,
    exam_id TEXT,
    due_date TEXT,
    due_time TEXT,
    category TEXT NOT NULL DEFAULT 'assignment',
    priority TEXT NOT NULL DEFAULT 'medium',
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  // 16. Task Relations
  `CREATE TABLE IF NOT EXISTS task_relations (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    class_session_id TEXT,
    class_date TEXT,
    class_note_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(task_id, class_session_id)
  );`,

  // 17. Exams
  `CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    semester_id TEXT REFERENCES semesters(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    room TEXT,
    max_marks REAL NOT NULL,
    weightage REAL,
    syllabus_notes TEXT,
    revision_progress REAL NOT NULL DEFAULT 0,
    venue TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // 18. Exam Topics Link Table
  `CREATE TABLE IF NOT EXISTS exam_topics (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    weight_hint TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(exam_id, topic_id)
  );`,

  // 19. Assessments & Grades
  `CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL DEFAULT 'sem-3',
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    marks_obtained REAL NOT NULL,
    marks_max REAL NOT NULL,
    weightage REAL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // 20. App Settings (Key-Value)
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // 21. Storage Settings
  `CREATE TABLE IF NOT EXISTS storage_settings (
    id TEXT PRIMARY KEY DEFAULT 'current',
    storage_type TEXT NOT NULL DEFAULT 'app_storage',
    folder_uri TEXT,
    folder_name TEXT,
    last_migrated_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // 22. Lockin Sessions (Focus/Deep Work sessions)
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

  // 23. Lockin Streaks (Daily/Weekly/Monthly streak tracking)
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

  // 24. Lockin Exam Presets (Pomodoro/Exam prep configurations)
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

  // 25. Lockin Blocked Apps
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

  // 26. Lockin YouTube Channels
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

  // 27. Lockin Schedules (Recurring study blocks)
  `CREATE TABLE IF NOT EXISTS lockin_schedules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    days_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    exam_id TEXT REFERENCES lockin_exam_presets(id) ON DELETE SET NULL,
    strict_mode TEXT NOT NULL DEFAULT 'none',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_schedules_user ON lockin_schedules(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_schedules_active ON lockin_schedules(is_active);`,

  // 28. Lockin App Quotas (Daily usage limits)
  `CREATE TABLE IF NOT EXISTS lockin_app_quotas (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    package_name TEXT NOT NULL,
    app_name TEXT NOT NULL,
    daily_limit_minutes INTEGER NOT NULL,
    used_minutes_today INTEGER NOT NULL DEFAULT 0,
    last_reset_date TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_app_quotas_user ON lockin_app_quotas(user_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_lockin_app_quotas_pkg_user ON lockin_app_quotas(user_id, package_name);`,

  // 29. Lockin Reality Checks (Intentional delay settings)
  `CREATE TABLE IF NOT EXISTS lockin_reality_checks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    delay_seconds INTEGER NOT NULL DEFAULT 10,
    prompt_question TEXT NOT NULL DEFAULT 'Why are you opening this app?',
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_reality_checks_user ON lockin_reality_checks(user_id);`,

  // 30. Lockin Emergency Passes (Break tokens)
  `CREATE TABLE IF NOT EXISTS lockin_emergency_passes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    weekly_allowance INTEGER NOT NULL DEFAULT 2,
    used_this_week INTEGER NOT NULL DEFAULT 0,
    last_reset_week TEXT NOT NULL,
    pass_duration_minutes INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_emergency_passes_user ON lockin_emergency_passes(user_id);`,

  // 31. Indexes for fast relational queries
  `CREATE INDEX IF NOT EXISTS idx_slots_subject ON timetable_slots(subject_id);`,
  `CREATE INDEX IF NOT EXISTS idx_slots_day ON timetable_slots(day_of_week);`,

  // Lockin indexes
  `CREATE INDEX IF NOT EXISTS idx_lockin_sessions_user ON lockin_sessions(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_sessions_subject ON lockin_sessions(subject_id);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_sessions_status ON lockin_sessions(status);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_sessions_started ON lockin_sessions(started_at);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_streaks_user_type ON lockin_streaks(user_id, streak_type);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_streaks_last_session ON lockin_streaks(last_session_date);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_presets_user ON lockin_exam_presets(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_lockin_presets_active ON lockin_exam_presets(is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_subject_date ON class_sessions(subject_id, date);`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_date ON class_sessions(date);`,
  `CREATE INDEX IF NOT EXISTS idx_notes_session_date ON class_notes(class_session_id, date);`,
  `CREATE INDEX IF NOT EXISTS idx_notes_subject ON class_notes(subject_id);`,
  `CREATE INDEX IF NOT EXISTS idx_topics_unit ON topics(unit_id);`,
  `CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);`,
  `CREATE INDEX IF NOT EXISTS idx_rev_history_topic ON topic_revision_history(topic_id);`,
  `CREATE INDEX IF NOT EXISTS idx_revision_records_topic ON revision_records(topic_id);`,
  `CREATE INDEX IF NOT EXISTS idx_revision_records_subject ON revision_records(subject_id);`,
  `CREATE INDEX IF NOT EXISTS idx_revision_records_semester ON revision_records(semester_id);`,
  `CREATE INDEX IF NOT EXISTS idx_revision_records_date ON revision_records(reviewed_at);`,
  `CREATE INDEX IF NOT EXISTS idx_resources_session ON resources(class_session_id);`,
  `CREATE INDEX IF NOT EXISTS idx_resources_note ON resources(class_note_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_subject ON tasks(subject_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);`,
  `CREATE INDEX IF NOT EXISTS idx_task_rel_session ON task_relations(class_session_id);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_topics_exam ON exam_topics(exam_id);`,
  `CREATE INDEX IF NOT EXISTS idx_assessments_subject ON assessments(subject_id);`,

  // 32. Persistent Versioned Study Plans (Phase 14)
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

  // 33. Study Plan Allocations (Phase 14)
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
