/**
 * BunkMatKar — Onboarding Orchestration Service
 *
 * Coordinates onboarding state machine, draft persistence, conflict checks,
 * validation, and final transactional commitment to SQLite.
 */

import {
  subjectRepository,
  timetableRepository,
  syllabusRepository,
  attendanceRepository,
  settingsRepository,
  onboardingRepository,
  seedMockDataIfNeeded,
} from '@/database';
import type {
  OnboardingStep,
  OnboardingProgress,
  OnboardingDraftData,
  StartupState,
  TimetableSlotDraft,
  SubjectDraft,
  TimetableConflict,
} from '@/types/onboarding';
import type { Subject, College, Semester, User } from '@/types';
import type { TimetableSlot, SyllabusUnit, Topic } from '@/types/academic';
import { notificationService } from './notificationService';

export class OnboardingService {
  /**
   * Evaluates startup state to distinguish:
   * A. Brand-new user
   * B. Existing real user
   * C. Existing demo user
   * D. Partially completed onboarding
   */
  async getStartupState(): Promise<StartupState> {
    const isCompleted = await onboardingRepository.isCompleted();
    if (isCompleted) {
      const student = await subjectRepository.getStudent();
      return {
        status: 'completed',
        isDemo: false,
        canResume: false,
        lastStep: 'completion',
        studentName: student?.name,
      };
    }

    const demoFlag = await settingsRepository.getSetting('demo_mode');
    if (demoFlag === '1') {
      const student = await subjectRepository.getStudent();
      return {
        status: 'completed',
        isDemo: true,
        canResume: false,
        lastStep: 'completion',
        studentName: student?.name || 'Demo Student',
      };
    }

    const progress = await onboardingRepository.getProgress();
    if (progress && progress.status === 'in_progress') {
      return {
        status: 'in_progress',
        isDemo: false,
        canResume: true,
        lastStep: progress.currentStep,
        studentName: progress.draftData.profile?.name,
      };
    }

    return {
      status: 'not_started',
      isDemo: false,
      canResume: false,
      lastStep: 'welcome',
    };
  }

  /**
   * Begins or resumes the onboarding workflow.
   * If fresh setup is requested, cleanly clears seeded mock demo data (Option B)
   * so Demo Mathematics never pollutes the real student workspace.
   */
  async startOnboarding(clearDemoData = true): Promise<OnboardingProgress> {
    const isCompleted = await onboardingRepository.isCompleted();
    if (isCompleted) {
      // Real student has completed onboarding! Never wipe active academic history.
      const existing = await onboardingRepository.getProgress();
      return (
        existing || {
          id: 'current',
          status: 'completed',
          currentStep: 'completion',
          completedSteps: [],
          draftData: {},
          updatedAt: new Date().toISOString(),
        }
      );
    }

    const existing = await onboardingRepository.getProgress();
    // If onboarding is already in progress, preserve existing draft data
    if (existing && existing.status === 'in_progress') {
      return existing;
    }

    if (clearDemoData) {
      await onboardingRepository.clearAllAcademicData();
    }

    const initial: OnboardingProgress = {
      id: 'current',
      status: 'in_progress',
      currentStep: 'profile',
      completedSteps: ['welcome'],
      draftData: {
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
      },
      updatedAt: new Date().toISOString(),
    };

    await onboardingRepository.saveProgress(initial);
    return initial;
  }

  /**
   * Persists step draft data immediately to protect against app crashes.
   */
  async saveStepData(
    step: OnboardingStep,
    data: Partial<OnboardingDraftData>,
    nextStep?: OnboardingStep
  ): Promise<OnboardingProgress> {
    let current = await onboardingRepository.getProgress();
    if (!current) {
      current = {
        id: 'current',
        status: 'in_progress',
        currentStep: step,
        completedSteps: [],
        draftData: {},
        updatedAt: new Date().toISOString(),
      };
    }

    const mergedDraft: OnboardingDraftData = {
      ...current.draftData,
      ...data,
      profile: data.profile ? { ...current.draftData.profile, ...data.profile } : current.draftData.profile,
      college: data.college ? { ...current.draftData.college, ...data.college } : current.draftData.college,
      academic: data.academic ? { ...current.draftData.academic, ...data.academic } : current.draftData.academic,
      subjects: data.subjects !== undefined ? data.subjects : current.draftData.subjects,
      syllabusUnits: data.syllabusUnits !== undefined ? data.syllabusUnits : current.draftData.syllabusUnits,
      timetableSlots: data.timetableSlots !== undefined ? data.timetableSlots : current.draftData.timetableSlots,
      attendance: data.attendance ? { ...current.draftData.attendance, ...data.attendance } : current.draftData.attendance,
      storage: data.storage ? { ...current.draftData.storage, ...data.storage } : current.draftData.storage,
      notifications: data.notifications ? { ...current.draftData.notifications, ...data.notifications } : current.draftData.notifications,
    };

    const completed = new Set(current.completedSteps);
    completed.add(step);

    const updated: OnboardingProgress = {
      id: 'current',
      status: 'in_progress',
      currentStep: nextStep || step,
      completedSteps: Array.from(completed),
      draftData: mergedDraft,
      updatedAt: new Date().toISOString(),
    };

    await onboardingRepository.saveProgress(updated);
    return updated;
  }

  /**
   * Conflict Detection Engine:
   * Detects if a new or edited timetable slot overlaps with any existing slot on that day.
   */
  checkTimetableConflict(
    existingSlots: TimetableSlotDraft[],
    newSlot: TimetableSlotDraft,
    subjects: SubjectDraft[] = []
  ): TimetableConflict | null {
    const normalize = (t: string) => t.trim().padStart(5, '0');
    const newStart = normalize(newSlot.startTime);
    const newEnd = normalize(newSlot.endTime);
    const newSubj = subjects.find(s => s.id === newSlot.subjectId)?.name || 'Class';

    for (const slot of existingSlots) {
      if (slot.id === newSlot.id) continue;
      if (slot.dayOfWeek.toLowerCase() !== newSlot.dayOfWeek.toLowerCase()) continue;

      const slotStart = normalize(slot.startTime);
      const slotEnd = normalize(slot.endTime);

      // Overlap condition: startA < endB && startB < endA
      if (newStart < slotEnd && slotStart < newEnd) {
        const slotSubj = subjects.find(s => s.id === slot.subjectId)?.name || 'Class';
        return {
          existingSlotId: slot.id,
          existingSubjectName: slotSubj,
          existingTime: `${slot.startTime}–${slot.endTime}`,
          newSubjectName: newSubj,
          newTime: `${newSlot.startTime}–${newSlot.endTime}`,
          dayOfWeek: newSlot.dayOfWeek,
          message: `Schedule conflict with ${slotSubj} (${slot.startTime}–${slot.endTime}) on ${newSlot.dayOfWeek}.`,
        };
      }
    }

    return null;
  }

  /**
   * Validation Engine for individual steps.
   */
  validateStep(step: OnboardingStep, draft: OnboardingDraftData): { valid: boolean; error?: string } {
    switch (step) {
      case 'profile':
        if (!draft.profile?.name || draft.profile.name.trim().length === 0) {
          return { valid: false, error: 'Student name is required.' };
        }
        return { valid: true };

      case 'college':
        if (!draft.college?.name || draft.college.name.trim().length === 0) {
          return { valid: false, error: 'College or institution name is required.' };
        }
        return { valid: true };

      case 'academic':
        if (!draft.academic?.program || draft.academic.program.trim().length === 0) {
          return { valid: false, error: 'Program or degree is required.' };
        }
        if (!draft.academic?.semesterName || draft.academic.semesterName.trim().length === 0) {
          return { valid: false, error: 'Semester is required.' };
        }
        return { valid: true };

      case 'subjects':
        if (!draft.subjects || draft.subjects.length === 0) {
          return { valid: false, error: 'Please add at least one subject to continue.' };
        }
        return { valid: true };

      case 'timetable':
        if (draft.timetableSlots && draft.timetableSlots.length > 0) {
          for (const slot of draft.timetableSlots) {
            if (slot.endTime <= slot.startTime) {
              return { valid: false, error: `Invalid class time: end time must be after start time (${slot.startTime}–${slot.endTime}).` };
            }
          }
        }
        return { valid: true };

      case 'attendance':
        const target = draft.attendance?.target ?? 75;
        if (target < 1 || target > 100) {
          return { valid: false, error: 'Attendance target must be between 1% and 100%.' };
        }
        if (draft.attendance?.startingTotals) {
          for (const [subjId, tot] of Object.entries(draft.attendance.startingTotals)) {
            if (tot.attended < 0 || tot.total < 0) {
              return { valid: false, error: 'Attendance counts cannot be negative.' };
            }
            if (tot.attended > tot.total) {
              return { valid: false, error: 'Attended classes cannot exceed total classes.' };
            }
          }
        }
        return { valid: true };

      default:
        return { valid: true };
    }
  }

  /**
   * Finalization Pipeline:
   * Commits all onboarding draft data to SQLite canonical repositories,
   * configures notification preferences, updates storage preferences,
   * marks onboarding as completed, and reconciles the academic engine.
   */
  async finalizeOnboarding(draft: OnboardingDraftData): Promise<void> {
    const profileVal = this.validateStep('profile', draft);
    if (!profileVal.valid) throw new Error(profileVal.error);

    const collegeVal = this.validateStep('college', draft);
    if (!collegeVal.valid) throw new Error(collegeVal.error);

    const academicVal = this.validateStep('academic', draft);
    if (!academicVal.valid) throw new Error(academicVal.error);

    const now = new Date().toISOString();
    const collegeId = `col-${Date.now()}`;
    const semesterId = `sem-${draft.academic?.semesterNumber || 1}-${Date.now()}`;
    const studentId = `student-${Date.now()}`;

    // 1. College
    const college: College = {
      id: collegeId,
      name: draft.college?.name.trim() || 'My College',
      shortName: draft.college?.shortName?.trim() || draft.college?.name.trim().slice(0, 10) || 'College',
      universityBoard: draft.college?.universityBoard?.trim(),
      campus: draft.college?.campus?.trim(),
      city: draft.college?.city?.trim(),
      state: draft.college?.state?.trim(),
      category: draft.college?.category?.trim(),
    };
    await subjectRepository.saveCollege(college);

    // 2. Semester
    const semester: Semester = {
      id: semesterId,
      name: draft.academic?.semesterName.trim() || `Semester ${draft.academic?.semesterNumber || 1}`,
      number: draft.academic?.semesterNumber || 1,
      startDate: draft.academic?.startDate || now.split('T')[0],
      endDate: draft.academic?.endDate || '',
      collegeId: collegeId,
      academicYear: draft.academic?.academicYear || draft.profile?.academicYear,
      isCurrent: true,
    };
    await subjectRepository.saveSemester(semester);

    // 3. Student Profile
    const student: User = {
      id: studentId,
      name: draft.profile?.name.trim() || 'Student',
      email: draft.profile?.email?.trim() || `${draft.profile?.name.trim().toLowerCase().replace(/\s+/g, '.')}@college.edu`,
      avatarUrl: draft.profile?.avatarUrl,
      collegeId: collegeId,
      semesterId: semesterId,
      attendanceTarget: draft.academic?.attendanceTarget ?? draft.attendance?.target ?? 75,
      program: draft.academic?.program,
      branch: draft.academic?.branch,
      year: draft.academic?.year,
      section: draft.academic?.section,
      academicYear: draft.academic?.academicYear || draft.profile?.academicYear,
      createdAt: now,
    };
    await subjectRepository.saveStudent(student);

    // 4. Subjects
    if (draft.subjects && draft.subjects.length > 0) {
      for (const s of draft.subjects) {
        const subject: Subject = {
          id: s.id || `subj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: s.name.trim(),
          shortName: s.shortName?.trim() || s.name.trim().slice(0, 10),
          code: s.code?.trim() || s.name.trim().slice(0, 4).toUpperCase(),
          color: s.color || '#3b82f6',
          semesterId: semesterId,
          facultyId: '',
          facultyName: s.facultyName?.trim(),
          room: s.room?.trim(),
          credits: s.credits ?? 3,
          isArchived: false,
          subjectType: s.subjectType || 'lecture',
          targetAttendance: s.targetAttendance,
        };
        await subjectRepository.createSubject(subject);
      }
    }

    // 5. Syllabus (if provided)
    if (draft.syllabusUnits && draft.syllabusUnits.length > 0) {
      for (const u of draft.syllabusUnits) {
        const unit: SyllabusUnit = {
          id: u.id || `unit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          subjectId: u.subjectId,
          semesterId: semesterId,
          name: u.name.trim(),
          order: u.order || 0,
          topicIds: [],
        };
        await syllabusRepository.createUnit(unit);

        if (u.topics && u.topics.length > 0) {
          for (const t of u.topics) {
            const topic: Topic = {
              id: t.id || `topic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              unitId: unit.id,
              subjectId: u.subjectId,
              name: t.name.trim(),
              isCompleted: false,
              revisionStatus: 'not_started',
              revisionCount: 0,
              order: t.order || 0,
              classNoteIds: [],
            };
            await syllabusRepository.createTopic(topic);
          }
        }
      }
    }

    // 6. Timetable Slots (if provided)
    if (draft.timetableSlots && draft.timetableSlots.length > 0) {
      for (const ts of draft.timetableSlots) {
        const slot: TimetableSlot = {
          id: ts.id || `ts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          subjectId: ts.subjectId,
          semesterId: semesterId,
          dayOfWeek: ts.dayOfWeek as any,
          startTime: ts.startTime,
          endTime: ts.endTime,
          room: ts.room || '',
          type: (ts.type as any) || 'lecture',
          isActive: true,
          isRecurring: true,
          weekPattern: null,
          createdAt: now,
          updatedAt: now,
        };
        await timetableRepository.createTimetableSlot(slot);
      }
    }

    // 7. Attendance starting totals (if provided)
    if (draft.attendance?.startingTotals) {
      for (const [subjectId, totals] of Object.entries(draft.attendance.startingTotals)) {
        await attendanceRepository.setAggregate(subjectId, totals.attended, totals.total);
      }
    }

    // 8. Storage preference
    if (draft.storage) {
      await settingsRepository.setStoragePreference({
        storageType: draft.storage.storageType,
        folderUri: draft.storage.folderUri,
        folderName: draft.storage.folderName,
      });
    }

    // 9. Notification preferences
    if (draft.notifications) {
      await settingsRepository.setNotificationSettings({
        masterEnabled: draft.notifications.enabled,
        classReminders: {
          enabled: draft.notifications.enabled && (draft.notifications.classReminders10 || draft.notifications.classReminders30),
          minutesBefore: [
            ...(draft.notifications.classReminders10 ? [10] : []),
            ...(draft.notifications.classReminders30 ? [30] : []),
          ],
        },
        taskReminders: {
          enabled: draft.notifications.enabled,
          dueToday: draft.notifications.taskDueToday,
          overdue: draft.notifications.taskOverdue,
        },
        examReminders: {
          enabled: draft.notifications.enabled,
          daysBefore: [
            ...(draft.notifications.examReminders1Day ? [1] : []),
            ...(draft.notifications.examReminders3Days ? [3] : []),
          ],
        },
        revisionReminders: {
          enabled: draft.notifications.enabled && draft.notifications.revisionReminders,
          dailyLimitPerSubject: 1,
        },
        attendanceAlerts: {
          enabled: draft.notifications.enabled && draft.notifications.attendanceAlerts,
          dangerThreshold: draft.attendance?.target ?? 75,
        },
        postClassJournal: {
          enabled: draft.notifications.enabled && draft.notifications.postClassJournal,
          delayMinutesAfterEnd: 15,
        },
        quietHours: {
          enabled: true,
          startHour: 23,
          startMinute: 0,
          endHour: 7,
          endMinute: 0,
          suppressNonCritical: true,
        },
      });
    }

    // 10. Mark onboarding complete in durable storage
    await onboardingRepository.markCompleted();

    // 11. Run notification engine reconciliation
    try {
      await notificationService.reconcileNotifications();
    } catch (err) {
      console.warn('[OnboardingService] Notification reconciliation deferred:', err);
    }
  }

  /**
   * Activates demo mode explicitly for testing/demo workflows.
   */
  async initDemoMode(): Promise<void> {
    await settingsRepository.setSetting('demo_mode', '1');
    await seedMockDataIfNeeded();
  }

  /**
   * Resets onboarding progress to allow testing or re-onboarding.
   */
  async resetToOnboarding(): Promise<void> {
    await onboardingRepository.resetProgress();
  }
}

export const onboardingService = new OnboardingService();
