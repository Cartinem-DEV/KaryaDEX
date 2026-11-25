-- ====================================================================
-- KaryaDEX Supabase PostgreSQL Schema Migration (Phase 10.5)
-- Multi-Tenant, Row-Level-Security Scoped Academic Cloud Data Model
-- ====================================================================

-- 1. Students / Academic Profiles
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    roll_number TEXT,
    college_id TEXT,
    semester_id TEXT,
    program TEXT,
    branch TEXT,
    year INTEGER,
    section TEXT,
    academic_year TEXT,
    attendance_target INTEGER NOT NULL DEFAULT 75,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Colleges
CREATE TABLE IF NOT EXISTS public.colleges (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    short_name TEXT,
    university_board TEXT,
    campus TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Semesters
CREATE TABLE IF NOT EXISTS public.semesters (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    number INTEGER NOT NULL,
    academic_year TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    college_id TEXT,
    is_current BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'current',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Subjects
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    short_name TEXT NOT NULL,
    color TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 3,
    semester_id TEXT,
    subject_type TEXT NOT NULL DEFAULT 'lecture',
    target_attendance INTEGER NOT NULL DEFAULT 75,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Topics (Syllabus)
CREATE TABLE IF NOT EXISTS public.topics (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit_id TEXT,
    subject_id TEXT,
    semester_id TEXT,
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    confidence TEXT NOT NULL DEFAULT 'none',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Timetable Slots
CREATE TABLE IF NOT EXISTS public.timetable_slots (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL,
    semester_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT,
    type TEXT NOT NULL DEFAULT 'lecture',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Class Sessions
CREATE TABLE IF NOT EXISTS public.class_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slot_id TEXT,
    subject_id TEXT NOT NULL,
    semester_id TEXT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT,
    type TEXT NOT NULL DEFAULT 'lecture',
    status TEXT NOT NULL DEFAULT 'scheduled',
    attendance_status TEXT NOT NULL DEFAULT 'unmarked',
    notes TEXT,
    topic_ids JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Attendance Records
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL,
    class_session_id TEXT,
    status TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    subject_id TEXT,
    semester_id TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'pending',
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TEXT,
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    tags JSONB,
    subtasks JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Exams
CREATE TABLE IF NOT EXISTS public.exams (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    semester_id TEXT,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    room TEXT,
    type TEXT NOT NULL DEFAULT 'midterm',
    max_marks INTEGER NOT NULL DEFAULT 100,
    weightage INTEGER NOT NULL DEFAULT 20,
    portion_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Revision Records
CREATE TABLE IF NOT EXISTS public.revision_records (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    semester_id TEXT,
    reviewed_at TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    confidence TEXT NOT NULL,
    outcome TEXT NOT NULL,
    notes TEXT,
    linked_task_id TEXT,
    linked_class_session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Notes
CREATE TABLE IF NOT EXISTS public.notes (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL,
    class_session_id TEXT,
    topic_id TEXT,
    title TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Sync Deletion Tombstones
CREATE TABLE IF NOT EXISTS public.sync_tombstones (
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (entity_type, entity_id, user_id)
);

-- ====================================================================
-- INDEXES FOR FAST INCREMENTAL SYNC & TENANT SCOPING
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_students_user ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_colleges_user ON public.colleges(user_id);
CREATE INDEX IF NOT EXISTS idx_semesters_user ON public.semesters(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user ON public.subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_user ON public.topics(user_id);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_user ON public.timetable_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_user ON public.class_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user ON public.attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_user ON public.exams(user_id);
CREATE INDEX IF NOT EXISTS idx_revision_records_user ON public.revision_records(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_tombstones_user ON public.sync_tombstones(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_updated ON public.tasks(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_attendance_updated ON public.attendance_records(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_revision_updated ON public.revision_records(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_class_sessions_updated ON public.class_sessions(user_id, updated_at);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: Users can ONLY select, insert, update, or delete
-- records where auth.uid() = user_id. Cross-user access is impossible.
-- ====================================================================

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'students', 'colleges', 'semesters', 'subjects', 'topics',
        'timetable_slots', 'class_sessions', 'attendance_records',
        'tasks', 'exams', 'revision_records', 'notes', 'sync_tombstones'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

        -- SELECT Policy
        EXECUTE format('DROP POLICY IF EXISTS "Users can read own %I" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Users can read own %I" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id);', tbl, tbl);

        -- INSERT Policy
        EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %I" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Users can insert own %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);', tbl, tbl);

        -- UPDATE Policy
        EXECUTE format('DROP POLICY IF EXISTS "Users can update own %I" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Users can update own %I" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);', tbl, tbl);

        -- DELETE Policy
        EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %I" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Users can delete own %I" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id);', tbl, tbl);
    END LOOP;
END $$;
