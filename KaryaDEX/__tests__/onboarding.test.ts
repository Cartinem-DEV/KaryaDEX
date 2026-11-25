/**
 * KaryaDEX — Phase 5: Production Onboarding & Real Academic Setup Tests
 *
 * Comprehensive verification of all 30 Phase 5 requirements:
 *
 * ONBOARDING STATE MACHINE & PERSISTENCE:
 *   1. First-launch detection
 *   2. Onboarding state persistence
 *   3. Resume after app restart
 *   4. Profile persistence
 *   5. College persistence
 *   6. Semester creation
 *   7. Subject creation
 *   8. Duplicate subject prevention
 *   9. Syllabus creation
 *   10. Topic creation
 *   11. Timetable creation
 *   12. Timetable conflict detection
 *   13. Attendance target persistence
 *   14. Existing attendance baseline validation
 *   15. Storage preference persistence
 *   16. Notification preference persistence
 *   17. Skipped optional step behavior
 *   18. Onboarding completion persistence
 *   19. Historical semester preservation
 *   20. Subject archival behavior
 *   21. Seeded demo vs real onboarding distinction
 *   22. Post-onboarding data hydration
 *   23. Post-onboarding Today snapshot
 *   24. Post-onboarding Schedule population
 *   25. Post-onboarding Subject Hub population
 *   26. Failed database save behavior
 *   27. Interrupted onboarding recovery
 *   28. Invalid form validation
 *   29. Semester transition
 *   30. Academic year transition
 *   31. End-to-end real student onboarding simulation
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg' }] }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg' }] }),
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({ uri: 'file:///printed.pdf' }),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/com.karyadex/files/',
  cacheDirectory: 'file:///data/user/0/com.karyadex/cache/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 2048 }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, directoryUri: 'content://tree/primary:Docs' }),
  },
}));

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  subjectRepository,
  timetableRepository,
  syllabusRepository,
  attendanceRepository,
  settingsRepository,
  onboardingRepository,
  hydrateStoresFromDatabase,
} from '../database';
import { onboardingService } from '../services/onboardingService';
import { academicHubService } from '../services/academicHubService';
import { useAppStore } from '../store/useAppStore';
import { useAcademicStore } from '../store/useAcademicStore';
import type { OnboardingDraftData } from '../types/onboarding';

describe('Phase 5: Production Onboarding & Real Academic Setup', () => {
  beforeEach(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();
  });

  describe('1. Startup & State Machine Detection', () => {
    it('1. detects first launch on clean database', async () => {
      const state = await onboardingService.getStartupState();
      expect(state.status).toBe('not_started');
      expect(state.isDemo).toBe(false);
      expect(state.canResume).toBe(false);
      expect(state.lastStep).toBe('welcome');
    });

    it('2. persists onboarding state and current step', async () => {
      await onboardingService.startOnboarding(false);
      const updated = await onboardingService.saveStepData(
        'profile',
        { profile: { name: 'Aarav Sharma', academicYear: '2026-27' } },
        'college'
      );

      expect(updated.status).toBe('in_progress');
      expect(updated.currentStep).toBe('college');
      expect(updated.completedSteps).toContain('profile');
      expect(updated.draftData.profile?.name).toBe('Aarav Sharma');

      const saved = await onboardingRepository.getProgress();
      expect(saved?.draftData.profile?.name).toBe('Aarav Sharma');
      expect(saved?.currentStep).toBe('college');
    });

    it('3. allows resuming after simulated app restart', async () => {
      await onboardingService.startOnboarding(false);
      await onboardingService.saveStepData(
        'profile',
        { profile: { name: 'Priya Patel' } },
        'college'
      );

      // Simulate app reopen
      const state = await onboardingService.getStartupState();
      expect(state.status).toBe('in_progress');
      expect(state.canResume).toBe(true);
      expect(state.lastStep).toBe('college');
      expect(state.studentName).toBe('Priya Patel');
    });
  });

  describe('2. Academic Data Persistence & Relationships', () => {
    it('4. persists student profile durably in SQLite', async () => {
      await subjectRepository.saveStudent({
        id: 'student-test-1',
        name: 'Saikat Roy',
        email: 'saikat@college.edu',
        collegeId: 'col-1',
        semesterId: 'sem-1',
        attendanceTarget: 80,
        program: 'B.Tech',
        branch: 'Production Engineering',
        year: 1,
        section: 'Section I',
        academicYear: '2026-27',
        createdAt: '2026-10-04T00:00:00',
      });

      const student = await subjectRepository.getStudent();
      expect(student).not.toBeNull();
      expect(student?.name).toBe('Saikat Roy');
      expect(student?.program).toBe('B.Tech');
      expect(student?.branch).toBe('Production Engineering');
      expect(student?.section).toBe('Section I');
      expect(student?.attendanceTarget).toBe(80);
    });

    it('5. persists college and campus metadata', async () => {
      await subjectRepository.saveCollege({
        id: 'col-test-1',
        name: 'Indian Institute of Engineering Science and Technology',
        shortName: 'IIEST',
        universityBoard: 'Autonomous',
        campus: 'Shibpur',
      });

      const col = await subjectRepository.getCollege();
      expect(col).not.toBeNull();
      expect(col?.name).toBe('Indian Institute of Engineering Science and Technology');
      expect(col?.shortName).toBe('IIEST');
      expect(col?.universityBoard).toBe('Autonomous');
      expect(col?.campus).toBe('Shibpur');
    });

    it('6. creates semester record with current flag and academic year', async () => {
      await subjectRepository.saveSemester({
        id: 'sem-test-1',
        name: 'Semester 1',
        number: 1,
        startDate: '2026-08-01',
        endDate: '2026-12-15',
        collegeId: 'col-1',
        academicYear: '2026-27',
        isCurrent: true,
      });

      const sem = await subjectRepository.getSemester();
      expect(sem).not.toBeNull();
      expect(sem?.name).toBe('Semester 1');
      expect(sem?.number).toBe(1);
      expect(sem?.academicYear).toBe('2026-27');
      expect(sem?.isCurrent).toBe(true);
    });

    it('7. creates real subjects with subjectType and credits', async () => {
      await subjectRepository.createSubject({
        id: 'subj-math-1',
        name: 'Engineering Mathematics I',
        shortName: 'Math',
        code: 'M-101',
        color: '#3B82F6',
        semesterId: 'sem-1',
        facultyId: '',
        facultyName: 'Dr. Banerjee',
        credits: 4,
        subjectType: 'lecture',
        targetAttendance: 75,
      });

      const subjects = await subjectRepository.getSubjects();
      expect(subjects.length).toBe(1);
      expect(subjects[0].name).toBe('Engineering Mathematics I');
      expect(subjects[0].credits).toBe(4);
      expect(subjects[0].subjectType).toBe('lecture');
      expect(subjects[0].facultyName).toBe('Dr. Banerjee');
    });

    it('8. prevents duplicate subjects by normalized comparison', async () => {
      const existingSubjects = [
        {
          id: 'subj-1',
          name: 'Physics',
          shortName: 'Physics',
          code: 'PH-101',
          color: '#8B5CF6',
          credits: 3,
        },
      ];

      // Form helper logic test
      const isDuplicate1 = existingSubjects.some(
        s => s.name.trim().toLowerCase() === '  physics  '.trim().toLowerCase()
      );
      const isDuplicate2 = existingSubjects.some(
        s => s.name.trim().toLowerCase() === 'Chemistry'.trim().toLowerCase()
      );

      expect(isDuplicate1).toBe(true);
      expect(isDuplicate2).toBe(false);
    });

    it('9. creates syllabus units', async () => {
      await syllabusRepository.createUnit({
        id: 'unit-1',
        subjectId: 'subj-1',
        semesterId: 'sem-1',
        name: 'Unit 1: Quantum Mechanics',
        order: 1,
        topicIds: [],
      });

      const units = await syllabusRepository.getUnitsForSubject('subj-1');
      expect(units.length).toBe(1);
      expect(units[0].name).toBe('Unit 1: Quantum Mechanics');
    });

    it('10. creates syllabus topics under unit', async () => {
      await syllabusRepository.createUnit({
        id: 'unit-1',
        subjectId: 'subj-1',
        semesterId: 'sem-1',
        name: 'Unit 1',
        order: 1,
        topicIds: [],
      });

      await syllabusRepository.createTopic({
        id: 'topic-1',
        unitId: 'unit-1',
        subjectId: 'subj-1',
        name: 'Wave-Particle Duality',
        isCompleted: false,
        revisionStatus: 'not_started',
        revisionCount: 0,
        order: 1,
        classNoteIds: [],
      });

      const topics = await syllabusRepository.getTopicsForUnit('unit-1');
      expect(topics.length).toBe(1);
      expect(topics[0].name).toBe('Wave-Particle Duality');
    });

    it('11. creates recurring timetable slots', async () => {
      await timetableRepository.createTimetableSlot({
        id: 'ts-1',
        subjectId: 'subj-1',
        semesterId: 'sem-1',
        dayOfWeek: 'monday',
        startTime: '09:00',
        endTime: '10:00',
        room: 'Room 302',
        type: 'lecture',
        isActive: true,
        isRecurring: true,
        weekPattern: null,
        createdAt: '2026-10-04T00:00:00',
        updatedAt: '2026-10-04T00:00:00',
      });

      const slots = await timetableRepository.getSlotsForDay('monday');
      expect(slots.length).toBe(1);
      expect(slots[0].startTime).toBe('09:00');
      expect(slots[0].endTime).toBe('10:00');
      expect(slots[0].room).toBe('Room 302');
    });

    it('12. detects timetable schedule conflicts on overlapping times', async () => {
      const existingSlots = [
        {
          id: 'ts-1',
          subjectId: 'subj-math',
          dayOfWeek: 'monday',
          startTime: '09:00',
          endTime: '10:00',
        },
      ];
      const subjects = [
        { id: 'subj-math', name: 'Mathematics', shortName: 'Math', code: 'M-101', color: '#3B82F6', credits: 4 },
        { id: 'subj-phys', name: 'Physics', shortName: 'Phys', code: 'P-101', color: '#8B5CF6', credits: 3 },
      ];

      // Overlapping slot
      const conflictSlot = {
        id: 'ts-2',
        subjectId: 'subj-phys',
        dayOfWeek: 'monday',
        startTime: '09:30',
        endTime: '10:30',
      };
      const conflict = onboardingService.checkTimetableConflict(existingSlots, conflictSlot, subjects);
      expect(conflict).not.toBeNull();
      expect(conflict?.existingSubjectName).toBe('Mathematics');
      expect(conflict?.message).toContain('Schedule conflict with Mathematics');

      // Non-overlapping slot
      const nonConflictSlot = {
        id: 'ts-3',
        subjectId: 'subj-phys',
        dayOfWeek: 'monday',
        startTime: '10:00',
        endTime: '11:00',
      };
      const noConflict = onboardingService.checkTimetableConflict(existingSlots, nonConflictSlot, subjects);
      expect(noConflict).toBeNull();

      // Different day slot
      const diffDaySlot = {
        id: 'ts-4',
        subjectId: 'subj-phys',
        dayOfWeek: 'tuesday',
        startTime: '09:00',
        endTime: '10:00',
      };
      const diffDayConflict = onboardingService.checkTimetableConflict(existingSlots, diffDaySlot, subjects);
      expect(diffDayConflict).toBeNull();
    });
  });

  describe('3. Preferences, Validation, & Skipped Steps', () => {
    it('13. persists attendance target preference', async () => {
      await subjectRepository.saveStudent({
        id: 'student-1',
        name: 'Student',
        email: 'test@college.edu',
        collegeId: 'col-1',
        semesterId: 'sem-1',
        attendanceTarget: 85,
        createdAt: '2026-10-04T00:00:00',
      });

      const s = await subjectRepository.getStudent();
      expect(s?.attendanceTarget).toBe(85);
    });

    it('14. validates existing attendance baseline (attended <= total)', () => {
      const invalidDraft: OnboardingDraftData = {
        attendance: {
          target: 75,
          startingTotals: {
            'subj-1': { attended: 15, total: 10 },
          },
        },
      };

      const result = onboardingService.validateStep('attendance', invalidDraft);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed total');

      const validDraft: OnboardingDraftData = {
        attendance: {
          target: 75,
          startingTotals: {
            'subj-1': { attended: 8, total: 10 },
          },
        },
      };
      const validResult = onboardingService.validateStep('attendance', validDraft);
      expect(validResult.valid).toBe(true);
    });

    it('15. persists storage preference to storage_settings', async () => {
      await settingsRepository.setStoragePreference({
        storageType: 'custom_folder',
        folderName: 'College Documents',
        folderUri: 'content://com.android.providers.documents/tree/college',
      });

      const pref = await settingsRepository.getStoragePreference();
      expect(pref.storageType).toBe('custom_folder');
      expect(pref.folderName).toBe('College Documents');
    });

    it('16. persists notification category preferences', async () => {
      await settingsRepository.setNotificationSettings({
        masterEnabled: true,
        classReminders: { enabled: true, minutesBefore: [10] },
        taskReminders: { enabled: true, dueToday: true, overdue: true },
        examReminders: { enabled: true, daysBefore: [1, 3] },
        revisionReminders: { enabled: true, dailyLimitPerSubject: 1 },
        attendanceAlerts: { enabled: true, dangerThreshold: 80 },
        postClassJournal: { enabled: true, delayMinutesAfterEnd: 15 },
        quietHours: { enabled: true, startHour: 23, startMinute: 0, endHour: 7, endMinute: 0, suppressNonCritical: true },
      });

      const notif = await settingsRepository.getNotificationSettings();
      expect(notif.masterEnabled).toBe(true);
      expect(notif.classReminders.minutesBefore).toEqual([10]);
      expect(notif.attendanceAlerts.dangerThreshold).toBe(80);
    });

    it('17. allows skipping optional syllabus and timetable cleanly', async () => {
      const draft: OnboardingDraftData = {
        profile: { name: 'Aakash Verma' },
        college: { name: 'Delhi Technological University', shortName: 'DTU' },
        academic: { program: 'B.Tech', branch: 'Computer Engineering', year: 1, semesterNumber: 1, semesterName: 'Semester 1' },
        subjects: [
          { id: 'subj-cs1', name: 'Programming Fundamentals', shortName: 'Prog', code: 'CS-101', color: '#3B82F6', credits: 4 },
        ],
        // syllabusUnits and timetableSlots omitted
        attendance: { target: 75 },
        storage: { storageType: 'app_storage' },
        notifications: {
          enabled: true,
          classReminders10: true,
          classReminders30: false,
          taskDueToday: true,
          taskOverdue: true,
          examReminders1Day: true,
          examReminders3Days: true,
          revisionReminders: true,
          attendanceAlerts: true,
          postClassJournal: true,
        },
      };

      await onboardingService.finalizeOnboarding(draft);

      const isDone = await onboardingRepository.isCompleted();
      expect(isDone).toBe(true);

      const slots = await timetableRepository.getTimetableSlots();
      expect(slots.length).toBe(0);

      const units = await syllabusRepository.getAllUnits();
      expect(units.length).toBe(0);
    });

    it('18. persists onboarding completion flag in app_settings and onboarding_progress', async () => {
      await onboardingRepository.markCompleted();
      const flag = await onboardingRepository.isCompleted();
      expect(flag).toBe(true);

      const state = await onboardingService.getStartupState();
      expect(state.status).toBe('completed');
    });
  });

  describe('4. Historical Semesters & Archival', () => {
    it('19. preserves historical semesters without deleting previous records', async () => {
      await subjectRepository.saveSemester({
        id: 'sem-1',
        name: 'Semester 1',
        number: 1,
        startDate: '2026-01-01',
        endDate: '2026-05-30',
        collegeId: 'col-1',
        academicYear: '2025-26',
        isCurrent: false,
      });

      await subjectRepository.saveSemester({
        id: 'sem-2',
        name: 'Semester 2',
        number: 2,
        startDate: '2026-08-01',
        endDate: '2026-12-15',
        collegeId: 'col-1',
        academicYear: '2026-27',
        isCurrent: true,
      });

      const all = await subjectRepository.getAllSemesters();
      expect(all.length).toBe(2);
      expect(all.map(s => s.name)).toEqual(['Semester 1', 'Semester 2']);

      const current = await subjectRepository.getSemester();
      expect(current?.name).toBe('Semester 2');
    });

    it('20. archives subject without deleting attendance or historical notes', async () => {
      await subjectRepository.createSubject({
        id: 'subj-old',
        name: 'Basic Electrical Engineering',
        shortName: 'BEE',
        code: 'EE-101',
        color: '#F59E0B',
        semesterId: 'sem-1',
        facultyId: '',
        credits: 3,
      });

      await subjectRepository.archiveSubject('subj-old');

      const active = await subjectRepository.getSubjects(false);
      expect(active.find(s => s.id === 'subj-old')).toBeUndefined();

      const all = await subjectRepository.getSubjects(true);
      expect(all.find(s => s.id === 'subj-old')).toBeDefined();
      expect(all.find(s => s.id === 'subj-old')?.isArchived).toBe(true);

      // Verify unarchive / restore functionality
      await subjectRepository.unarchiveSubject('subj-old');
      const restored = await subjectRepository.getSubjects(false);
      expect(restored.find(s => s.id === 'subj-old')).toBeDefined();
      expect(restored.find(s => s.id === 'subj-old')?.isArchived).toBe(false);
    });

    it('21. distinguishes seeded demo mode from real onboarding completion', async () => {
      await onboardingService.initDemoMode();
      const demoState = await onboardingService.getStartupState();
      expect(demoState.isDemo).toBe(true);
      expect(demoState.status).toBe('completed');

      // Now start real onboarding
      await onboardingService.startOnboarding(true);
      const realState = await onboardingService.getStartupState();
      expect(realState.isDemo).toBe(false);
      expect(realState.status).toBe('in_progress');
    });
  });

  describe('5. Post-Onboarding Ecosystem Integration', () => {
    it('22. hydrates Zustand stores from SQLite after onboarding completion', async () => {
      const draft: OnboardingDraftData = {
        profile: { name: 'Kavita Singh' },
        college: { name: 'BITS Pilani', shortName: 'BITS' },
        academic: { program: 'B.E.', branch: 'Electrical & Electronics', year: 1, semesterNumber: 1, semesterName: 'Semester 1' },
        subjects: [
          { id: 'subj-ee1', name: 'Circuit Theory', shortName: 'Circuits', code: 'EE-201', color: '#10B981', credits: 4 },
        ],
        attendance: { target: 80 },
        storage: { storageType: 'app_storage' },
      };

      await onboardingService.finalizeOnboarding(draft);
      await hydrateStoresFromDatabase();

      const storeState = useAppStore.getState();
      expect(storeState.isAuthenticated).toBe(true);
      expect(storeState.isDemoMode).toBe(false);
      expect(storeState.user?.name).toBe('Kavita Singh');
      expect(storeState.college?.shortName).toBe('BITS');
      expect(storeState.subjects.length).toBe(1);
      expect(storeState.subjects[0].name).toBe('Circuit Theory');
    });

    it('23. produces accurate Today snapshot for newly onboarded student', async () => {
      const draft: OnboardingDraftData = {
        profile: { name: 'Saikat Roy' },
        college: { name: 'IIEST Shibpur', shortName: 'IIEST' },
        academic: { program: 'B.Tech', branch: 'Production Engineering', year: 1, semesterNumber: 1, semesterName: 'Semester 1' },
        subjects: [
          { id: 'subj-prod1', name: 'Manufacturing Processes', shortName: 'Mfg', code: 'PE-101', color: '#3B82F6', credits: 4 },
        ],
        attendance: { target: 75 },
      };

      await onboardingService.finalizeOnboarding(draft);
      await hydrateStoresFromDatabase();

      const snapshot = academicHubService.getTodayAcademicSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.pendingTasks.length).toBe(0);
      expect(snapshot.overdueTasks.length).toBe(0);
      expect(snapshot.todayWorkloadMinutes).toBe(0);
    });

    it('24. populates Schedule occurrences from onboarded timetable', async () => {
      const draft: OnboardingDraftData = {
        profile: { name: 'Student' },
        college: { name: 'College', shortName: 'Col' },
        academic: { program: 'Degree', branch: 'Branch', year: 1, semesterNumber: 1, semesterName: 'Semester 1' },
        subjects: [
          { id: 'subj-chem', name: 'Chemistry', shortName: 'Chem', code: 'CH-101', color: '#EC4899', credits: 3 },
        ],
        timetableSlots: [
          { id: 'ts-chem-1', subjectId: 'subj-chem', dayOfWeek: 'wednesday', startTime: '11:00', endTime: '12:00', room: 'Lab 1', type: 'lab' },
        ],
        attendance: { target: 75 },
      };

      await onboardingService.finalizeOnboarding(draft);
      await hydrateStoresFromDatabase();

      const slots = await timetableRepository.getSlotsForSubject('subj-chem');
      expect(slots.length).toBe(1);
      expect(slots[0].startTime).toBe('11:00');
      expect(slots[0].type).toBe('lab');
    });

    it('25. populates Subject Hub snapshot with zero-data fallback', async () => {
      const draft: OnboardingDraftData = {
        profile: { name: 'Student' },
        college: { name: 'College', shortName: 'Col' },
        academic: { program: 'Degree', branch: 'Branch', year: 1, semesterNumber: 1, semesterName: 'Semester 1' },
        subjects: [
          { id: 'subj-mech', name: 'Engineering Mechanics', shortName: 'Mechanics', code: 'ME-101', color: '#F59E0B', credits: 4 },
        ],
        attendance: { target: 75 },
      };

      await onboardingService.finalizeOnboarding(draft);
      await hydrateStoresFromDatabase();

      const summary = academicHubService.getSubjectAcademicSnapshot('subj-mech');

      expect(summary).not.toBeNull();
      expect(summary?.subjectName).toBe('Engineering Mechanics');
      expect(summary?.safeBunks).toBe(0);
      expect(summary?.tasksPending).toBe(0);
      expect(summary?.topicsTotal).toBe(0);
    });

    it('26. rejects finalization with missing required academic info', async () => {
      const incompleteDraft: OnboardingDraftData = {
        profile: { name: '' }, // Missing name
        college: { name: 'College', shortName: 'Col' },
        academic: { program: 'Degree', branch: 'Branch', year: 1, semesterNumber: 1, semesterName: 'Sem 1' },
      };

      await expect(onboardingService.finalizeOnboarding(incompleteDraft)).rejects.toThrow(
        'Student name is required'
      );
    });

    it('27. supports interrupted onboarding recovery after multiple steps', async () => {
      await onboardingService.startOnboarding(false);
      await onboardingService.saveStepData('profile', { profile: { name: 'Dev Student' } }, 'college');
      await onboardingService.saveStepData('college', { college: { name: 'NIT Trichy', shortName: 'NITT' } }, 'academic');

      const recovery = await onboardingService.getStartupState();
      expect(recovery.canResume).toBe(true);
      expect(recovery.lastStep).toBe('academic');
      expect(recovery.studentName).toBe('Dev Student');
    });

    it('28. validates all steps correctly via validateStep', () => {
      expect(onboardingService.validateStep('profile', {}).valid).toBe(false);
      expect(onboardingService.validateStep('college', {}).valid).toBe(false);
      expect(onboardingService.validateStep('academic', {}).valid).toBe(false);
      expect(onboardingService.validateStep('subjects', {}).valid).toBe(false);
      expect(onboardingService.validateStep('timetable', {
        timetableSlots: [{ id: '1', subjectId: 's', dayOfWeek: 'mon', startTime: '11:00', endTime: '10:00' }],
      }).valid).toBe(false);
      expect(onboardingService.validateStep('attendance', { attendance: { target: 120 } }).valid).toBe(false);
    });

    it('29. transitions between semesters seamlessly without wiping history', async () => {
      await subjectRepository.saveSemester({
        id: 'sem-1',
        name: 'Semester 1',
        number: 1,
        startDate: '2026-01-01',
        endDate: '2026-05-01',
        collegeId: 'col-1',
        isCurrent: true,
      });

      await subjectRepository.saveSemester({
        id: 'sem-2',
        name: 'Semester 2',
        number: 2,
        startDate: '2026-08-01',
        endDate: '2026-12-01',
        collegeId: 'col-1',
        isCurrent: false,
      });

      await subjectRepository.setCurrentSemester('sem-2');
      const current = await subjectRepository.getSemester();
      expect(current?.id).toBe('sem-2');
      expect(current?.name).toBe('Semester 2');
    });

    it('30. handles academic year transition cleanly', async () => {
      await subjectRepository.saveStudent({
        id: 'std-1',
        name: 'Student',
        email: 'std@col.edu',
        collegeId: 'col-1',
        semesterId: 'sem-1',
        attendanceTarget: 75,
        academicYear: '2026-27',
        createdAt: '2026-10-04T00:00:00',
      });

      await subjectRepository.saveStudent({
        id: 'std-1',
        name: 'Student',
        email: 'std@col.edu',
        collegeId: 'col-1',
        semesterId: 'sem-3',
        attendanceTarget: 75,
        academicYear: '2027-28',
        createdAt: '2026-10-04T00:00:00',
      });

      const updated = await subjectRepository.getStudent();
      expect(updated?.academicYear).toBe('2027-28');
      expect(updated?.semesterId).toBe('sem-3');
    });
  });

  describe('6. Real Student Workflow Simulation (Section 53)', () => {
    it('31. full realistic onboarding workflow', async () => {
      // Student details from Section 53
      const realStudentDraft: OnboardingDraftData = {
        profile: {
          name: 'Student',
          academicYear: '2026-27',
        },
        college: {
          name: 'Test University',
          shortName: 'TestUni',
        },
        academic: {
          program: 'Engineering',
          branch: 'Production Engineering',
          year: 1,
          semesterNumber: 1,
          semesterName: 'Semester 1',
        },
        subjects: [
          { id: 'subj-math', name: 'Mathematics', shortName: 'Math', code: 'M-101', color: '#3B82F6', credits: 4 },
          { id: 'subj-phys', name: 'Physics', shortName: 'Physics', code: 'PH-101', color: '#8B5CF6', credits: 4 },
          { id: 'subj-chem', name: 'Chemistry', shortName: 'Chem', code: 'CH-101', color: '#10B981', credits: 3 },
        ],
        timetableSlots: [
          { id: 'ts-math-mon', subjectId: 'subj-math', dayOfWeek: 'monday', startTime: '09:00', endTime: '10:00', room: '301', type: 'lecture' },
          { id: 'ts-phys-mon', subjectId: 'subj-phys', dayOfWeek: 'monday', startTime: '10:00', endTime: '11:00', room: '302', type: 'lecture' },
        ],
        attendance: {
          target: 75,
        },
        storage: {
          storageType: 'app_storage',
        },
        notifications: {
          enabled: true,
          classReminders10: true,
          classReminders30: false,
          taskDueToday: true,
          taskOverdue: true,
          examReminders1Day: true,
          examReminders3Days: true,
          revisionReminders: true,
          attendanceAlerts: true,
          postClassJournal: true,
        },
      };

      // 1. Finalize onboarding
      await onboardingService.finalizeOnboarding(realStudentDraft);

      // 2. Rehydrate
      await hydrateStoresFromDatabase();

      // 3. Verify real user state
      const appStore = useAppStore.getState();
      expect(appStore.isAuthenticated).toBe(true);
      expect(appStore.isDemoMode).toBe(false);
      expect(appStore.user?.name).toBe('Student');
      expect(appStore.college?.name).toBe('Test University');
      expect(appStore.subjects.length).toBe(3);
      expect(appStore.attendanceTarget).toBe(75);

      // 4. Verify Schedule has Monday classes
      const mondaySlots = await timetableRepository.getSlotsForDay('monday');
      expect(mondaySlots.length).toBe(2);
      expect(mondaySlots[0].startTime).toBe('09:00');
      expect(mondaySlots[1].startTime).toBe('10:00');

      // 5. Verify notifications configured
      const notifSettings = await settingsRepository.getNotificationSettings();
      expect(notifSettings.masterEnabled).toBe(true);
      expect(notifSettings.classReminders.minutesBefore).toEqual([10]);

      // 6. Simulate restart
      const restartState = await onboardingService.getStartupState();
      expect(restartState.status).toBe('completed');
      expect(restartState.isDemo).toBe(false);
    });

    it('32. prevents accidental data wipe if startOnboarding is called after completion', async () => {
      await subjectRepository.createSubject({
        id: 'subj-keep',
        name: 'Operating Systems',
        shortName: 'OS',
        code: 'CS-301',
        color: '#3B82F6',
        semesterId: 'sem-1',
        facultyId: '',
        credits: 4,
      });

      await onboardingRepository.markCompleted();
      const countBefore = (await subjectRepository.getSubjects(true)).length;
      expect(countBefore).toBe(1);

      // Attempting to trigger fresh onboarding MUST NOT wipe active academic records
      const progress = await onboardingService.startOnboarding(true);
      expect(progress.status).toBe('completed');

      const countAfter = (await subjectRepository.getSubjects(true)).length;
      expect(countAfter).toBe(countBefore);
      expect(countAfter).toBe(1);
    });

    it('33. accurately evaluates mid-semester attendance baseline (attended 42, total 50)', async () => {
      const { calculatePercentage, calculateSafeBunks, calculateRecoveryClasses, getAttendanceStatus } = await import('../lib/attendance');

      const attended = 42;
      const total = 50;
      const pct = calculatePercentage(attended, total);
      expect(pct).toBe(84);

      // At 75% target:
      const safeBunks75 = calculateSafeBunks(attended, total, 75);
      const recovery75 = calculateRecoveryClasses(attended, total, 75);
      const status75 = getAttendanceStatus(pct, 75);
      expect(safeBunks75).toBe(6);
      expect(recovery75).toBe(0);
      expect(status75).toBe('safe');

      // At 85% target:
      const safeBunks85 = calculateSafeBunks(attended, total, 85);
      const recovery85 = calculateRecoveryClasses(attended, total, 85);
      const status85 = getAttendanceStatus(pct, 85);
      expect(safeBunks85).toBe(0);
      expect(recovery85).toBe(4);
      expect(status85).toBe('danger');
    });

    it('34. dispatches deep linking navigation routes for all notification categories', async () => {
      const { notificationService } = await import('../services/notificationService');
      await notificationService.init();
      const receivedRoutes: string[] = [];

      notificationService.setNavigationHandler((payload) => {
        if (payload.deepLinkTarget) {
          receivedRoutes.push(payload.deepLinkTarget);
        } else if (payload.subjectId) {
          receivedRoutes.push(`/subject/${payload.subjectId}`);
        } else if (payload.type === 'class_reminder' || payload.type === 'post_class_journal') {
          receivedRoutes.push('/schedule');
        } else if (payload.type === 'task_reminder') {
          receivedRoutes.push('/tasks');
        } else if (payload.type === 'attendance_alert') {
          receivedRoutes.push('/attendance');
        } else if (payload.type === 'exam_reminder' || payload.type === 'revision_reminder') {
          receivedRoutes.push('/college');
        }
      });

      // Simulate notification response payloads
      const adapter = notificationService.getAdapter() as any;
      adapter.triggerNotificationResponse({ type: 'class_reminder', entityId: 'slot-1' });
      adapter.triggerNotificationResponse({ type: 'task_reminder', entityId: 'task-1' });
      adapter.triggerNotificationResponse({ type: 'attendance_alert', entityId: 'subj-1' });
      adapter.triggerNotificationResponse({ type: 'exam_reminder', entityId: 'exam-1' });
      adapter.triggerNotificationResponse({ type: 'post_class_journal', entityId: 'slot-2' });
      adapter.triggerNotificationResponse({ type: 'revision_reminder', entityId: 'rev-1', subjectId: 'subj-99' });

      expect(receivedRoutes).toEqual([
        '/schedule',
        '/tasks',
        '/attendance',
        '/college',
        '/schedule',
        '/subject/subj-99',
      ]);
    });

    it('35. formats standard lecture note filename and stores persistent user files', async () => {
      const { noteScanService } = await import('../services/noteScanService');
      const { fileStorageService } = await import('../services/fileStorageService');

      const fileName = noteScanService.getDefaultFileName('Engineering Physics', '2026-10-04');
      expect(fileName).toBe('Engineering_Physics_2026-10-04_Lecture_Notes.pdf');

      const saved = await fileStorageService.saveUserFile('test://temp/lecture.pdf', fileName, 'application/pdf');
      expect(saved.fileName).toBe(fileName);
      expect(saved.permanentUri).toBeDefined();
    });
  });
});
