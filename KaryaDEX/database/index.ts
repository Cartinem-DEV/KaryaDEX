/**
 * KaryaDEX — Database Barrel Export
 *
 * Single import point for all database-related modules.
 */

export { getDatabaseConnection, initDatabase, resetDatabaseConnectionForTesting } from './db';
export { runMigrations } from './migrations';

// Repositories
export { subjectRepository } from './repositories/subjectRepository';
export { timetableRepository } from './repositories/timetableRepository';
export { classSessionRepository } from './repositories/classSessionRepository';
export { attendanceRepository } from './repositories/attendanceRepository';
export { syllabusRepository } from './repositories/syllabusRepository';
export { revisionRepository } from './repositories/revisionRepository';
export { taskRepository } from './repositories/taskRepository';
export { examRepository } from './repositories/examRepository';
export { assessmentRepository } from './repositories/assessmentRepository';
export { resourceRepository } from './repositories/resourceRepository';
export { settingsRepository } from './repositories/settingsRepository';
export { notificationRecordRepository } from './repositories/notificationRecordRepository';
export { onboardingRepository } from './repositories/onboardingRepository';
export { semesterRepository } from './repositories/semesterRepository';
export { studyPlanRepository } from './repositories/studyPlanRepository';

// Provider & Seeder
export { DatabaseProvider, useDatabaseReady, useDatabaseError, hydrateStoresFromDatabase } from './DatabaseProvider';
export { seedMockDataIfNeeded, forceReseed } from './seedFromMockData';
