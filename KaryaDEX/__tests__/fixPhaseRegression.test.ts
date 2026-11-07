/**
 * BunkMatKar — Fix Phase Regression Suite
 *
 * Verifies all fixed execution paths:
 *   1. P0-3: Topic revision updates persist to SQLite via syllabusRepository.updateTopic
 *   2. P1-4: Attachment lifecycle — removing attachments deletes resource row and fileStorageService file
 *   3. P1-5 & P1-6: AI feature approval resolves real semester ID from SQLite and triggers store refresh
 *   4. P1-7: switchActiveSemester re-derives and updates classSessions for the new semester
 *   5. P2-8 & P2-13: Task CRUD — deletion cleans up store and SQLite
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  syllabusRepository,
  resourceRepository,
  subjectRepository,
  semesterRepository,
  timetableRepository,
  taskRepository,
} from '../database';
import { revisionService } from '../services/revisionService';
import { classSessionService } from '../services/classSessionService';
import { fileStorageService } from '../services/fileStorageService';
import { TimetableExtractionFeature } from '../services/ai/features/timetableExtraction';
import { CalendarExtractionFeature } from '../services/ai/features/calendarExtraction';
import { useAppStore } from '../store/useAppStore';
import { useAcademicStore } from '../store/useAcademicStore';
import type { Topic, Resource, TimetableSlot } from '../types/academic';
import type { Subject, Semester, DayOfWeek } from '../types';
import type { AIProposal, TimetableSlotProposalPayload, CalendarProposalPayload } from '../services/ai/core/aiTypes';

describe('Fix Phase Regression Test Suite', () => {
  beforeAll(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. P0-3: Topic Revision Persistence in SQLite', () => {
    it('recordTopicRevision persists updated revisionStatus, count, and lastRevisedAt to SQLite', async () => {
      const topicId = 'topic-reg-p0-3';
      const initialTopic: Topic = {
        id: topicId,
        subjectId: 'sub-p0-3',
        unitId: 'unit-p0-3',
        name: 'Binary Trees',
        isCompleted: false,
        revisionStatus: 'not_started',
        revisionCount: 0,
        classNoteIds: [],
        order: 1,
      };

      await syllabusRepository.createTopic(initialTopic);
      useAcademicStore.setState(s => ({
        topics: [...s.topics, initialTopic],
      }));

      // Verify initial state in SQLite
      const retrievedBefore = await syllabusRepository.getTopicById(topicId);
      expect(retrievedBefore?.revisionStatus).toBe('not_started');
      expect(retrievedBefore?.revisionCount).toBe(0);

      // Execute revision update through revisionService
      revisionService.recordTopicRevision(topicId, 'revised');

      // Verify store updated immediately
      const inStore = useAcademicStore.getState().topics.find(t => t.id === topicId);
      expect(inStore?.revisionStatus).toBe('revised');
      expect(inStore?.revisionCount).toBe(1);
      expect(inStore?.lastRevisedAt).toBeDefined();

      // Wait a microtask for SQLite async write
      await new Promise(r => setTimeout(r, 60));

      // Verify SQLite was persisted!
      const retrievedAfter = await syllabusRepository.getTopicById(topicId);
      expect(retrievedAfter).not.toBeNull();
      expect(retrievedAfter?.revisionStatus).toBe('revised');
      expect(retrievedAfter?.revisionCount).toBe(1);
      expect(retrievedAfter?.lastRevisedAt).toBeDefined();
    });
  });

  describe('2. P1-4: Attachment Reconciliation and Lifecycle', () => {
    it('saveClassSession deletes detached resources from store, SQLite, and file storage', async () => {
      const deleteUserFileSpy = jest.spyOn(fileStorageService, 'deleteUserFile').mockResolvedValue(true);

      const resId = 'res-to-delete-123';
      const fileUri = 'file:///user/data/deleted_doc.pdf';

      const resourceToDelete: Resource = {
        id: resId,
        classNoteId: 'note-recon-1',
        classSessionId: 'slot-recon-1',
        title: 'Draft Notes',
        type: 'pdf',
        uri: fileUri,
        isLocal: true,
        createdAt: '2026-10-10T10:00:00Z',
      };

      await resourceRepository.createResource(resourceToDelete);
      useAcademicStore.setState(s => ({
        resources: [...s.resources, resourceToDelete],
      }));

      // Verify resource exists in SQLite
      const inDbBefore = await resourceRepository.getResourceById(resId);
      expect(inDbBefore).not.toBeNull();

      // Save session with 0 resources attached (reconciliation should remove the detached resource)
      await classSessionService.saveClassSession({
        slotId: 'slot-recon-1',
        date: '2026-10-10',
        subjectId: 'sub-recon-1',
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: 'Reconciled note without previous attachment',
        teacherNotes: '',
        revisionStatus: 'taught',
        resources: [], // EMPTY — detached resId!
        linkedTaskIds: [],
      });

      // Verify resource was deleted from useAcademicStore
      const inStoreAfter = useAcademicStore.getState().resources.find(r => r.id === resId);
      expect(inStoreAfter).toBeUndefined();

      // Verify resource was deleted from SQLite
      const inDbAfter = await resourceRepository.getResourceById(resId);
      expect(inDbAfter).toBeNull();

      // Verify fileStorageService.deleteUserFile was called
      expect(deleteUserFileSpy).toHaveBeenCalledWith(fileUri);

      deleteUserFileSpy.mockRestore();
    });
  });

  describe('3. P1-5 & P1-6: AI Proposal Approval Active Semester Resolution & Store Refresh', () => {
    it('applyApprovedProposal in TimetableExtractionFeature resolves active semester and triggers refreshFromDatabase', async () => {
      const activeSem: Semester = {
        id: 'sem-active-test-ai',
        collegeId: 'col-1',
        name: 'Semester Active AI',
        number: 4,
        startDate: '2026-08-01',
        endDate: '2026-12-15',
        isCurrent: true,
        status: 'current',
      };
      await semesterRepository.saveSemester(activeSem);
      await semesterRepository.setCurrentSemester(activeSem.id);

      const refreshSpy = jest.spyOn(useAppStore.getState(), 'refreshFromDatabase').mockResolvedValue();

      const timetableProposal: AIProposal<TimetableSlotProposalPayload[]> = {
        id: 'prop-tt-1',
        type: 'IMPORT_TIMETABLE',
        title: 'Timetable Proposal',
        description: 'Auto-extracted timetable proposal',
        status: 'approved',
        userId: 'user-test',
        payload: [
          {
            dayOfWeek: 'Monday',
            subjectCode: 'CS101',
            subjectName: 'Computer Science',
            startTime: '10:00',
            endTime: '11:00',
            type: 'lecture',
          },
        ],
        createdAt: '2026-10-10T10:00:00Z',
      };

      const result = await TimetableExtractionFeature.applyApprovedProposal(timetableProposal);
      expect(result.savedCount).toBeGreaterThanOrEqual(1);

      // Verify refreshFromDatabase was invoked
      expect(refreshSpy).toHaveBeenCalled();

      // Verify the created subject in SQLite was associated with real activeSem.id, NOT 'sem-current'
      const subjects = await subjectRepository.getSubjects();
      const subject = subjects.find(s => s.code === 'CS101');
      expect(subject?.semesterId).toBe(activeSem.id);

      refreshSpy.mockRestore();
    });

    it('applyApprovedProposal in CalendarExtractionFeature resolves active semester and triggers refreshFromDatabase', async () => {
      const refreshSpy = jest.spyOn(useAppStore.getState(), 'refreshFromDatabase').mockResolvedValue();

      const calendarProposal: AIProposal<CalendarProposalPayload> = {
        id: 'prop-cal-1',
        type: 'IMPORT_CALENDAR',
        title: 'Calendar Proposal',
        description: 'Auto-extracted calendar proposal',
        status: 'approved',
        userId: 'user-test',
        payload: {
          holidays: [],
          exams: [
            {
              title: 'Mid-term Exam',
              startDate: '2026-11-15',
              type: 'internal',
            },
          ],
        },
        createdAt: '2026-10-10T10:00:00Z',
      };

      const result = await CalendarExtractionFeature.applyApprovedProposal(calendarProposal);
      expect(result.savedExamsCount).toBe(1);
      expect(refreshSpy).toHaveBeenCalled();

      refreshSpy.mockRestore();
    });
  });

  describe('4. P1-7: switchActiveSemester Updates classSessions', () => {
    it('switchActiveSemester re-derives classSessions scoped to the newly active semester subjects', async () => {
      const semA: Semester = {
        id: 'sem-switch-a',
        collegeId: 'col-1',
        name: 'Semester Switch A',
        number: 1,
        startDate: '2026-01-01',
        endDate: '2026-05-30',
        isCurrent: true,
        status: 'current',
      };
      const semB: Semester = {
        id: 'sem-switch-b',
        collegeId: 'col-1',
        name: 'Semester Switch B',
        number: 2,
        startDate: '2026-08-01',
        endDate: '2026-12-15',
        isCurrent: false,
        status: 'completed',
      };

      await semesterRepository.saveSemester(semA);
      await semesterRepository.saveSemester(semB);

      const subA: Subject = {
        id: 'sub-switch-a',
        code: 'SWA101',
        name: 'Subject Switch A',
        shortName: 'SWA',
        semesterId: semA.id,
        color: '#8B5CF6',
        facultyId: '',
        credits: 3,
      };
      const subB: Subject = {
        id: 'sub-switch-b',
        code: 'SWB201',
        name: 'Subject Switch B',
        shortName: 'SWB',
        semesterId: semB.id,
        color: '#10B981',
        facultyId: '',
        credits: 4,
      };

      await subjectRepository.createSubject(subA);
      await subjectRepository.createSubject(subB);

      // Create a timetable slot for subB
      const slotB: TimetableSlot = {
        id: 'ts-switch-b-1',
        dayOfWeek: 'tuesday',
        subjectId: subB.id,
        semesterId: semB.id,
        room: 'Lab 204',
        startTime: '09:00',
        endTime: '10:00',
        type: 'lecture',
        isRecurring: true,
        isActive: true,
        createdAt: '2026-08-01',
        updatedAt: '2026-08-01',
      };
      await timetableRepository.createTimetableSlot(slotB);

      // Switch to semester B
      await useAppStore.getState().switchActiveSemester(semB.id);

      const stateAfter = useAppStore.getState();
      expect(stateAfter.semester?.id).toBe(semB.id);
      expect(stateAfter.subjects.some(s => s.id === subB.id)).toBe(true);

      // Verify classSessions was hydrated and contains session derived from slotB
      expect(stateAfter.classSessions.some(cs => cs.subjectId === subB.id)).toBe(true);
    });
  });

  describe('5. P2-8: Task CRUD & Deletion Consistency', () => {
    it('deleteTask removes task from store and SQLite', async () => {
      const task = {
        id: 'task-del-test-1',
        title: 'Assignment To Delete',
        category: 'assignment' as const,
        priority: 'high' as const,
        isCompleted: false,
        status: 'planned' as const,
        createdAt: '2026-10-10',
        updatedAt: '2026-10-10',
      };

      await taskRepository.createTask(task);
      useAppStore.setState(s => ({ tasks: [task, ...s.tasks] }));

      expect(useAppStore.getState().tasks.some(t => t.id === task.id)).toBe(true);

      // Execute deleteTask
      useAppStore.getState().deleteTask(task.id);

      // Verify removed from store
      expect(useAppStore.getState().tasks.some(t => t.id === task.id)).toBe(false);

      // Wait brief microtask for SQLite deletion
      await new Promise(r => setTimeout(r, 60));
      const inDb = await taskRepository.getTaskById(task.id);
      expect(inDb).toBeNull();
    });
  });
});
