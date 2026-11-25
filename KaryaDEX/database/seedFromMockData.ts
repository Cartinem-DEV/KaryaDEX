/**
 * KaryaDEX — Mock Data Seeder
 *
 * On first-ever launch, migrates current in-memory mock data into SQLite.
 * After successful seeding, sets a sentinel key ('data_seeded' = '1')
 * so this never runs again on subsequent launches.
 *
 * Safe to call multiple times — idempotent via sentinel check.
 */

import { getDatabaseConnection } from './db';
import { ensureSchemaIntegrity } from './migrations';
import { settingsRepository } from './repositories/settingsRepository';
import { subjectRepository } from './repositories/subjectRepository';
import { timetableRepository } from './repositories/timetableRepository';
import { attendanceRepository } from './repositories/attendanceRepository';
import { syllabusRepository } from './repositories/syllabusRepository';
import { examRepository } from './repositories/examRepository';
import { assessmentRepository } from './repositories/assessmentRepository';
import { resourceRepository } from './repositories/resourceRepository';
import { taskRepository } from './repositories/taskRepository';
import { classSessionRepository } from './repositories/classSessionRepository';

// Mock data sources
import {
  mockUser, mockCollege, mockSemester, mockSubjects,
  mockAttendanceData, mockTasks, mockExams,
} from '@/lib/mockData';
import {
  mockTimetableSlots,
  mockClassNotes,
  mockTopics,
  mockSyllabusUnits,
  mockExamTopics,
  mockResources,
  mockAssessments,
} from '@/lib/academicMockData';

const SEED_KEY = 'data_seeded';

export async function seedMockDataIfNeeded(): Promise<{ seeded: boolean }> {
  const already = await settingsRepository.getSetting(SEED_KEY);
  if (already === '1') {
    console.log('[Seed] Data already seeded — skipping.');
    return { seeded: false };
  }

  console.log('[Seed] First launch detected — seeding SQLite from mock data...');

  const db = await getDatabaseConnection();
  await ensureSchemaIntegrity(db);

  try {
    await db.withTransactionAsync(async () => {
      // 1. College
      await subjectRepository.saveCollege(mockCollege);

      // 2. Semester
      await subjectRepository.saveSemester(mockSemester);

      // 3. Student / User
      await subjectRepository.saveStudent(mockUser);

      // 4. Subjects
      for (const subject of mockSubjects) {
        await subjectRepository.createSubject(subject);
      }

      // 5. Timetable Slots
      for (const slot of mockTimetableSlots) {
        await timetableRepository.createTimetableSlot(slot);
      }

      // 6. Attendance aggregates
      for (const [subjectId, data] of Object.entries(mockAttendanceData)) {
        await attendanceRepository.setAggregate(subjectId, data.attended, data.total);
      }

      // 7. Syllabus Units
      for (const unit of mockSyllabusUnits) {
        await syllabusRepository.createUnit(unit);
      }

      // 8. Topics
      for (const topic of mockTopics) {
        await syllabusRepository.createTopic(topic);
      }

      // 9. Class Notes (journal entries)
      for (const note of mockClassNotes) {
        await classSessionRepository.upsertClassNote(note);
      }

      // 10. Exams
      for (const exam of mockExams) {
        await examRepository.createExam(exam);
      }

      // 11. Exam Topics
      for (const et of mockExamTopics) {
        await examRepository.addExamTopic(et.examId, et.topicId, et.weightHint);
      }

      // 12. Assessments
      for (const assessment of mockAssessments) {
        await assessmentRepository.createAssessment(assessment);
      }

      // 13. Resources
      for (const resource of mockResources) {
        await resourceRepository.createResource(resource);
      }

      // 14. Tasks
      for (const task of mockTasks) {
        await taskRepository.createTask(task);
      }

      // Mark as seeded
      await settingsRepository.setSetting(SEED_KEY, '1');
    });

    console.log('[Seed] ✅ Mock data seeded successfully.');
    return { seeded: true };
  } catch (error) {
    console.error('[Seed] ❌ Seeding failed:', error);
    throw error;
  }
}

/**
 * Force re-seed (for development/testing).
 * Clears the sentinel and re-runs seeding.
 */
export async function forceReseed(): Promise<void> {
  await settingsRepository.setSetting(SEED_KEY, '0');
  await seedMockDataIfNeeded();
}
