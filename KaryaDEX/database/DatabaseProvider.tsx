/**
 * BunkMatKar — Database Provider
 *
 * React context that initializes the database (migrations + seed)
 * and hydrates Zustand stores from SQLite before rendering children.
 *
 * Flow:
 *   1. Init database connection + run migrations
 *   2. Seed mock data if first launch
 *   3. Hydrate both Zustand stores from SQLite rows
 *   4. Render children
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initDatabase } from './db';
import { seedMockDataIfNeeded } from './seedFromMockData';
import { subjectRepository } from './repositories/subjectRepository';
import { timetableRepository } from './repositories/timetableRepository';
import { attendanceRepository } from './repositories/attendanceRepository';
import { syllabusRepository } from './repositories/syllabusRepository';
import { classSessionRepository } from './repositories/classSessionRepository';
import { examRepository } from './repositories/examRepository';
import { assessmentRepository } from './repositories/assessmentRepository';
import { resourceRepository } from './repositories/resourceRepository';
import { taskRepository } from './repositories/taskRepository';
import { revisionRepository } from './repositories/revisionRepository';
import { settingsRepository } from './repositories/settingsRepository';
import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';
import { authService } from '@/services/auth/authService';
import { syncService } from '@/services/sync/syncService';

interface DatabaseContextValue {
  isReady: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  isReady: false,
  error: null,
});

export function useDatabaseReady(): boolean {
  return useContext(DatabaseContext).isReady;
}

export function useDatabaseError(): Error | null {
  return useContext(DatabaseContext).error;
}

interface Props {
  children: ReactNode;
}

import { onboardingRepository } from './repositories/onboardingRepository';
import type { ClassSession } from '@/types';
import type { TimetableSlot } from '@/types/academic';

/**
 * Derives the legacy ClassSession[] view (consumed by the Today screen and
 * study planning) from canonical active timetable slots, optionally scoped to
 * the given subject ids (used when switching semesters).
 */
export function deriveClassSessionsFromSlots(
  slots: TimetableSlot[],
  subjectIds?: Set<string>
): ClassSession[] {
  return slots
    .filter(ts => ts.isActive)
    .filter(ts => !subjectIds || subjectIds.has(ts.subjectId))
    .map(ts => ({
      id: ts.id,
      subjectId: ts.subjectId,
      semesterId: ts.semesterId,
      dayOfWeek: ts.dayOfWeek,
      startTime: ts.startTime,
      endTime: ts.endTime,
      room: ts.room,
      type: ts.type,
    }));
}

export async function hydrateStoresFromDatabase(): Promise<void> {
  console.log('[DB Provider] Hydrating stores from SQLite...');

  // ── useAppStore hydration ──────────────────────────────────────
  const [college, semester, user, subjects, attendanceData, tasks, exams, isCompleted, demoSetting] =
    await Promise.all([
      subjectRepository.getCollege(),
      subjectRepository.getSemester(),
      subjectRepository.getStudent(),
      subjectRepository.getSubjects(),
      attendanceRepository.getAllAggregates(),
      taskRepository.getTasks(),
      examRepository.getExams(),
      onboardingRepository.isCompleted(),
      settingsRepository.getSetting('demo_mode'),
    ]);

  const isDemo = demoSetting === '1';

  // Only hydrate user as authenticated if real onboarding was completed OR demo mode is active
  if (user && (isCompleted || isDemo)) {
    useAppStore.setState({
      isAuthenticated: true,
      isDemoMode: isDemo,
      user,
      college,
      semester,
      subjects,
      attendanceData,
      tasks,
      exams,
      attendanceTarget: user.attendanceTarget,
    });
  } else if (!isCompleted && !isDemo) {
    useAppStore.setState({
      isAuthenticated: false,
      isDemoMode: false,
    });
  }

  // ── useAcademicStore hydration ─────────────────────────────────
  const [
    timetableSlots,
    classNotes,
    topics,
    syllabusUnits,
    examTopics,
    resources,
    assessments,
    taskRelations,
    revisionRecords,
  ] = await Promise.all([
    timetableRepository.getTimetableSlots(false), // all, including inactive
    classSessionRepository.getAllClassNotes(),
    syllabusRepository.getAllTopics(),
    syllabusRepository.getAllUnits(),
    examRepository.getAllExamTopics(),
    resourceRepository.getAllResources(),
    assessmentRepository.getAllAssessments(),
    taskRepository.getAllTaskRelations(),
    revisionRepository.getAllRecords(),
  ]);

  useAcademicStore.setState({
    timetableSlots,
    classNotes,
    topics,
    syllabusUnits,
    examTopics,
    resources,
    assessments,
    taskRelations,
    revisionRecords,
  });

  // Legacy Today-screen view derived from canonical active timetable slots.
  // Must run AFTER academic hydration so it reflects freshly loaded slots.
  if (user && (isCompleted || isDemo)) {
    useAppStore.setState({
      classSessions: deriveClassSessionsFromSlots(
        timetableSlots,
        new Set(subjects.map(s => s.id))
      ),
    });
  }

  console.log(
    `[DB Provider] ✅ Hydrated: ${subjects.length} subjects, ${timetableSlots.length} slots, ` +
    `${classNotes.length} notes, ${topics.length} topics, ${revisionRecords.length} revisions, ${tasks.length} tasks, ${exams.length} exams`
  );
}

export function DatabaseProvider({ children }: Props) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Step 1: Initialize database (connection + migrations)
        await initDatabase();
        console.log('[DB Provider] Database initialized.');

        // Step 2: Restore Auth session
        try {
          await authService.init();
        } catch (authErr) {
          console.warn('[DB Provider] Auth init non-fatal warning:', authErr);
        }

        // Step 3: Initialize Sync Service
        try {
          await syncService.init();
        } catch (syncErr) {
          console.warn('[DB Provider] Sync init non-fatal warning:', syncErr);
        }

        // Step 4: Seed mock data if first launch
        await seedMockDataIfNeeded();

        // Step 5: Hydrate Zustand stores from SQLite
        await hydrateStoresFromDatabase();

        if (!cancelled) {
          setIsReady(true);
        }
      } catch (err) {
        console.error('[DB Provider] ❌ Initialization failed:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          // Still mark as ready so the app can show an error state
          // rather than being stuck on splash screen
          setIsReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DatabaseContext.Provider value={{ isReady, error }}>
      {children}
    </DatabaseContext.Provider>
  );
}
