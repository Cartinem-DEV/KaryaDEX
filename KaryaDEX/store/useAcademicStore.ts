/**
 * BunkMatKar — Academic Extension Store (Zustand)
 *
 * Separate store for the Phase 1-10 academic features.
 * Keeps existing useAppStore.ts completely untouched.
 *
 * Architecture decision: separate store (not merged into useAppStore)
 * because the new slice is large, independently testable, and prepares
 * for eventual database-layer separation.
 * The two stores can share data by reading from each other's state.
 */

import { create } from 'zustand';
import type {
  TimetableSlot,
  TimetableSlotInput,
  ClassNote,
  ClassNoteInput,
  ClassAttendanceStatus,
  Topic,
  SyllabusUnit,
  ExamTopic,
  ExamWithTopics,
  TaskRelations,
  Resource,
  Assessment,
  SubjectPerformance,
  SemesterGPA,
  CalendarEvent,
  ClassOccurrence,
  RevisionStatus,
  RevisionRecord,
  RevisionRecordInput,
  TopicRevisionIntelligence,
} from '@/types/academic';
import type { Task } from '@/types';
import {
  mockTimetableSlots,
  mockClassNotes,
  mockTopics,
  mockSyllabusUnits,
  mockExamTopics,
  mockExamExtensions,
  mockTaskRelations,
  mockResources,
  mockAssessments,
  mockCalendarEvents,
} from '@/lib/academicMockData';
import { getDayOfWeekFromDate, formatLocalDate } from '@/lib/timeUtils';
import {
  timetableRepository,
  classSessionRepository,
  syllabusRepository,
  revisionRepository,
  examRepository,
  taskRepository,
  resourceRepository,
  assessmentRepository,
} from '@/database';

// ─── ID generation ───────────────────────────────────────────────
/** Generate a collision-safe ID: timestamp + 4-char random hex. */
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Grading utilities ───────────────────────────────────────────

/**
 * Map percentage to a 10-point grade scale (AICTE common scheme).
 * Modular: swap this function later for institution-specific rules.
 */
function percentageToGradePoints(percentage: number): { grade: string; points: number } {
  if (percentage >= 90) return { grade: 'O',  points: 10 };
  if (percentage >= 80) return { grade: 'A+', points: 9  };
  if (percentage >= 70) return { grade: 'A',  points: 8  };
  if (percentage >= 60) return { grade: 'B+', points: 7  };
  if (percentage >= 50) return { grade: 'B',  points: 6  };
  if (percentage >= 40) return { grade: 'C',  points: 5  };
  return                       { grade: 'F',  points: 0  };
}

/**
 * Compute weighted average across assessments for a subject.
 * If no weightage is set, uses simple average.
 */
function computeSubjectPercentage(assessments: Assessment[]): number {
  if (assessments.length === 0) return 0;
  const hasWeightage = assessments.every(a => a.weightage !== undefined);
  if (hasWeightage) {
    const totalWeight = assessments.reduce((sum, a) => sum + (a.weightage ?? 0), 0);
    if (totalWeight === 0) return 0;
    const weighted = assessments.reduce((sum, a) => {
      const pct = a.marksMax > 0 ? (a.marksObtained / a.marksMax) * 100 : 0;
      return sum + pct * (a.weightage ?? 0);
    }, 0);
    return weighted / totalWeight;
  }
  const total = assessments.reduce((sum, a) => {
    return sum + (a.marksMax > 0 ? (a.marksObtained / a.marksMax) * 100 : 0);
  }, 0);
  return total / assessments.length;
}

// ─── Class occurrence generation ─────────────────────────────────

/**
 * Generate all class occurrence dates between fromDate and toDate
 * for a given set of timetable slots.
 * Uses the DayOfWeek mapping to expand weekly recurring slots into instances.
 */
function generateOccurrenceDates(
  slots: TimetableSlot[],
  fromDate: Date,
  toDate: Date
): Array<{ slot: TimetableSlot; date: string }> {
  const results: Array<{ slot: TimetableSlot; date: string }> = [];
  const activeSlots = slots.filter(s => s.isActive && s.isRecurring);

  const current = new Date(fromDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dow = getDayOfWeekFromDate(current);
    // Build local date string (YYYY-MM-DD) — do NOT use toISOString() which is UTC
    // and causes off-by-one-day errors in UTC+ timezones like IST (UTC+5:30)
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    for (const slot of activeSlots) {
      if (slot.dayOfWeek === dow) {
        results.push({ slot, date: dateStr });
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return results;
}

// ─── Store State + Actions Interface ────────────────────────────

interface AcademicState {
  // ── Data ──────────────────────────────────────────────────────
  timetableSlots: TimetableSlot[];
  classNotes: ClassNote[];
  topics: Topic[];
  syllabusUnits: SyllabusUnit[];
  examTopics: ExamTopic[];
  examExtensions: ExamWithTopics[];
  taskRelations: TaskRelations[];
  resources: Resource[];
  assessments: Assessment[];
  calendarEvents: CalendarEvent[];
  revisionRecords: RevisionRecord[];

  // ── Init ──────────────────────────────────────────────────────
  initAcademicDemoMode: () => void;
  resetAcademicStore: () => void;

  // ── Phase 4: Timetable CRUD ───────────────────────────────────
  addTimetableSlot: (input: TimetableSlotInput) => TimetableSlot;
  updateTimetableSlot: (id: string, updates: Partial<TimetableSlotInput>) => void;
  deleteTimetableSlot: (id: string) => void;
  getTimetableSlotsForDay: (dayOfWeek: string) => TimetableSlot[];
  getTimetableSlotsForSubject: (subjectId: string) => TimetableSlot[];

  // ── Phase 1: Class Journal ────────────────────────────────────
  upsertClassNote: (input: ClassNoteInput) => ClassNote;
  getClassNote: (classSessionId: string, date: string) => ClassNote | null;
  getClassNotesForSubject: (subjectId: string) => ClassNote[];
  getClassNotesForDate: (date: string) => ClassNote[];
  updateClassNoteField: (noteId: string, field: Partial<Omit<ClassNote, 'id' | 'classSessionId' | 'date' | 'subjectId' | 'createdAt'>>) => void;

  // ── Phase 7: Syllabus Tracker ─────────────────────────────────
  addSyllabusUnit: (unit: Omit<SyllabusUnit, 'id'>) => SyllabusUnit;
  updateSyllabusUnit: (id: string, updates: Partial<Omit<SyllabusUnit, 'id'>>) => void;
  deleteSyllabusUnit: (id: string) => void;
  addTopic: (topic: Omit<Topic, 'id'>) => Topic;
  updateTopicRevision: (topicId: string, status: RevisionStatus) => void;
  toggleTopicCompletion: (topicId: string) => void;
  getTopicsForSubject: (subjectId: string) => Topic[];
  getTopicsForUnit: (unitId: string) => Topic[];
  getUnitsForSubject: (subjectId: string) => SyllabusUnit[];
  getSyllabusProgress: (subjectId: string) => { completed: number; total: number; percentage: number };

  // ── Phase 6: Exam Topics ──────────────────────────────────────
  addExamTopic: (examId: string, topicId: string, weightHint?: ExamTopic['weightHint']) => ExamTopic;
  removeExamTopic: (examTopicId: string) => void;
  getTopicsForExam: (examId: string) => ExamTopic[];
  upsertExamExtension: (data: Partial<ExamWithTopics> & { examId: string }) => void;
  getExamExtension: (examId: string) => ExamWithTopics | null;

  // ── Phase 5: Task Relations ───────────────────────────────────
  setTaskRelations: (relations: TaskRelations) => void;
  getTaskRelations: (taskId: string) => TaskRelations | null;
  removeTaskRelations: (taskId: string) => void;

  // ── Phase 9: Resources ────────────────────────────────────────
  addResource: (resource: Omit<Resource, 'id' | 'createdAt'>) => Resource;
  deleteResource: (resourceId: string) => void;
  getResourcesForClassNote: (classNoteId: string) => Resource[];
  getResourcesForSubject: (subjectId: string) => Resource[];
  getResourcesForTopic: (topicId: string) => Resource[];
  getResourcesForExam: (examId: string) => Resource[];

  // ── Phase 8: Assessments & GPA ───────────────────────────────
  addAssessment: (assessment: Omit<Assessment, 'id'>) => Assessment;
  updateAssessment: (id: string, updates: Partial<Omit<Assessment, 'id'>>) => void;
  deleteAssessment: (assessmentId: string) => void;
  getAssessmentsForSubject: (subjectId: string) => Assessment[];
  getSubjectPerformance: (subjectId: string, subjectCredits?: number) => SubjectPerformance;
  getSemesterGPA: (semesterId?: string, subjectCredits?: Record<string, number>) => SemesterGPA;

  // ── Phase 2: Calendar ─────────────────────────────────────────
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => CalendarEvent;
  removeCalendarEvent: (eventId: string) => void;
  getCalendarEventsForDate: (date: string) => CalendarEvent[];
  getCalendarEventsForMonth: (year: number, month: number) => CalendarEvent[];
  getCalendarEventsForRange: (fromDate: string, toDate: string) => CalendarEvent[];

  // ── Phase 3: Class History ────────────────────────────────────
  getClassOccurrencesForSubject: (subjectId: string, fromDate?: Date | string, toDate?: Date | string) => ClassOccurrence[];
  getClassOccurrencesForDate: (date: string) => ClassOccurrence[];
  getAllClassOccurrences: (fromDate: string, toDate: string) => ClassOccurrence[];

  // ── Phase 10: Revision History ────────────────────────────────
  getRevisionHistory: (subjectId?: string) => Array<{ topicId: string; topicName: string; status: RevisionStatus; lastRevisedAt?: string; subjectId: string }>;
  getTopicsNeedingRevision: (subjectId?: string) => Topic[];
  getTopicsTaughtNotRevised: (subjectId?: string) => Topic[];

  // ── Phase 7: Revision Intelligence & Exam Sprint ─────────────
  recordTopicRevision: (input: RevisionRecordInput) => Promise<RevisionRecord>;
  deleteRevisionRecord: (id: string) => Promise<void>;
  getRevisionRecordsForTopic: (topicId: string) => RevisionRecord[];
  getTopicRevisionIntelligence: (topicId: string) => TopicRevisionIntelligence | null;
  convertRevisionToTask: (topicId: string, scheduledDate?: string, examId?: string) => Promise<Task>;
}

// ─── Store Implementation ────────────────────────────────────────

export const useAcademicStore = create<AcademicState>((set, get) => ({
  // ── Initial State ────────────────────────────────────────────
  timetableSlots:  [],
  classNotes:      [],
  topics:          [],
  syllabusUnits:   [],
  examTopics:      [],
  examExtensions:  [],
  taskRelations:   [],
  resources:       [],
  assessments:     [],
  calendarEvents:  [],
  revisionRecords: [],

  // ── Init ────────────────────────────────────────────────────
  initAcademicDemoMode: () => {
    set({
      timetableSlots:  [...mockTimetableSlots],
      classNotes:      [...mockClassNotes],
      topics:          [...mockTopics],
      syllabusUnits:   [...mockSyllabusUnits],
      examTopics:      [...mockExamTopics],
      examExtensions:  [...mockExamExtensions],
      taskRelations:   [...mockTaskRelations],
      resources:       [...mockResources],
      assessments:     [...mockAssessments],
      calendarEvents:  [...mockCalendarEvents],
      revisionRecords: [],
    });
  },

  resetAcademicStore: () => {
    set({
      timetableSlots:  [],
      classNotes:      [],
      topics:          [],
      syllabusUnits:   [],
      examTopics:      [],
      examExtensions:  [],
      taskRelations:   [],
      resources:       [],
      assessments:     [],
      calendarEvents:  [],
      revisionRecords: [],
    });
  },

  // ── Phase 4: Timetable CRUD ──────────────────────────────────

  addTimetableSlot: (input) => {
    const now = formatLocalDate();
    const slot: TimetableSlot = {
      ...input,
      id: uid('ts'),
      isRecurring: input.isRecurring ?? true,
      isActive: true,
      weekPattern: input.weekPattern ?? null,
      createdAt: now,
      updatedAt: now,
    };
    set(s => ({ timetableSlots: [...s.timetableSlots, slot] }));
    timetableRepository.createTimetableSlot(slot).catch(err => {
      console.warn('[useAcademicStore] Failed to persist timetable slot:', err);
    });
    return slot;
  },

  updateTimetableSlot: (id, updates) => {
    set(s => ({
      timetableSlots: s.timetableSlots.map(ts =>
        ts.id === id
          ? { ...ts, ...updates, updatedAt: formatLocalDate() }
          : ts
      ),
    }));
    timetableRepository.updateTimetableSlot(id, updates).catch(err => {
      console.warn('[useAcademicStore] Failed to update timetable slot:', err);
    });
  },

  deleteTimetableSlot: (id) => {
    // Soft delete — set isActive: false to preserve history
    set(s => ({
      timetableSlots: s.timetableSlots.map(ts =>
        ts.id === id ? { ...ts, isActive: false, updatedAt: formatLocalDate() } : ts
      ),
    }));
    timetableRepository.deleteTimetableSlot(id).catch(err => {
      console.warn('[useAcademicStore] Failed to delete timetable slot:', err);
    });
  },

  getTimetableSlotsForDay: (dayOfWeek) => {
    return get().timetableSlots.filter(ts => ts.dayOfWeek === dayOfWeek && ts.isActive);
  },

  getTimetableSlotsForSubject: (subjectId) => {
    return get().timetableSlots.filter(ts => ts.subjectId === subjectId && ts.isActive);
  },

  // ── Phase 1: Class Journal ───────────────────────────────────

  upsertClassNote: (input) => {
    const { classNotes } = get();
    const existing = classNotes.find(
      n => n.classSessionId === input.classSessionId && n.date === input.date
    );
    const now = new Date().toISOString();

    if (existing) {
      // Update existing
      const updated: ClassNote = {
        ...existing,
        attendanceStatus: input.attendanceStatus ?? existing.attendanceStatus,
        topicIds:          input.topicIds          ?? existing.topicIds,
        myNotes:           input.myNotes           ?? existing.myNotes,
        teacherNotes:      input.teacherNotes      ?? existing.teacherNotes,
        revisionStatus:    input.revisionStatus    ?? existing.revisionStatus,
        lastRevisedAt:     input.lastRevisedAt     ?? existing.lastRevisedAt,
        resourceIds:       input.resourceIds       ?? existing.resourceIds,
        linkedTaskIds:     input.linkedTaskIds     ?? existing.linkedTaskIds,
        linkedExamTopicIds: input.linkedExamTopicIds ?? existing.linkedExamTopicIds,
        aiSummary:         input.aiSummary         ?? existing.aiSummary,
        aiSummaryStatus:   input.aiSummaryStatus   ?? existing.aiSummaryStatus,
        aiSummaryUpdatedAt: input.aiSummaryUpdatedAt ?? existing.aiSummaryUpdatedAt,
        aiSourceHash:      input.aiSourceHash      ?? existing.aiSourceHash,
        topicRevisions:    input.topicRevisions    ?? existing.topicRevisions,
        updatedAt: now,
      };
      set(s => ({
        classNotes: s.classNotes.map(n => n.id === existing.id ? updated : n),
      }));
      classSessionRepository.upsertClassNote(updated).catch(err => {
        console.warn('[useAcademicStore] Failed to persist class note update:', err);
      });
      return updated;
    }

    // Create new
    const note: ClassNote = {
      id: uid('cn'),
      classSessionId:    input.classSessionId,
      date:              input.date,
      subjectId:         input.subjectId,
      attendanceStatus:  input.attendanceStatus  ?? 'not_recorded',
      topicIds:          input.topicIds          ?? [],
      myNotes:           input.myNotes           ?? '',
      teacherNotes:      input.teacherNotes      ?? '',
      revisionStatus:    input.revisionStatus    ?? 'not_started',
      lastRevisedAt:     input.lastRevisedAt,
      resourceIds:       input.resourceIds       ?? [],
      linkedTaskIds:     input.linkedTaskIds     ?? [],
      linkedExamTopicIds: input.linkedExamTopicIds ?? [],
      aiSummary:         input.aiSummary,
      aiSummaryStatus:   input.aiSummaryStatus,
      aiSummaryUpdatedAt: input.aiSummaryUpdatedAt,
      aiSourceHash:      input.aiSourceHash,
      topicRevisions:    input.topicRevisions,
      createdAt: now,
      updatedAt: now,
    };
    set(s => ({ classNotes: [...s.classNotes, note] }));
    classSessionRepository.upsertClassNote(note).catch(err => {
      console.warn('[useAcademicStore] Failed to persist new class note:', err);
    });
    return note;
  },

  getClassNote: (classSessionId, date) => {
    return get().classNotes.find(
      n => n.classSessionId === classSessionId && n.date === date
    ) ?? null;
  },

  getClassNotesForSubject: (subjectId) => {
    return get().classNotes
      .filter(n => n.subjectId === subjectId)
      .sort((a, b) => b.date.localeCompare(a.date)); // newest first
  },

  getClassNotesForDate: (date) => {
    return get().classNotes.filter(n => n.date === date);
  },

  updateClassNoteField: (noteId, field) => {
    set(s => {
      const updatedNotes = s.classNotes.map(n =>
        n.id === noteId
          ? { ...n, ...field, updatedAt: new Date().toISOString() }
          : n
      );
      const target = updatedNotes.find(n => n.id === noteId);
      if (target) {
        classSessionRepository.upsertClassNote(target).catch(err => {
          console.warn('[useAcademicStore] Failed to persist class note field update:', err);
        });
      }
      return { classNotes: updatedNotes };
    });
  },

  // ── Phase 7: Syllabus Tracker ────────────────────────────────

  addSyllabusUnit: (unit) => {
    const newUnit: SyllabusUnit = { ...unit, id: uid('unit') };
    set(s => ({ syllabusUnits: [...s.syllabusUnits, newUnit] }));
    syllabusRepository.createUnit(newUnit).catch(err => {
      console.warn('[useAcademicStore] Failed to persist syllabus unit:', err);
    });
    return newUnit;
  },

  updateSyllabusUnit: (id, updates) => {
    set(s => ({
      syllabusUnits: s.syllabusUnits.map(u => u.id === id ? { ...u, ...updates } : u),
    }));
    syllabusRepository.updateUnit(id, updates).catch(err => {
      console.warn('[useAcademicStore] Failed to update syllabus unit:', err);
    });
  },

  deleteSyllabusUnit: (id) => {
    set(s => {
      const deletedTopicIds = new Set(s.topics.filter(t => t.unitId === id).map(t => t.id));
      return {
        syllabusUnits: s.syllabusUnits.filter(u => u.id !== id),
        topics: s.topics.filter(t => t.unitId !== id),
        examTopics: s.examTopics.filter(et => !deletedTopicIds.has(et.topicId)),
        classNotes: s.classNotes.map(n => ({
          ...n,
          topicIds: n.topicIds.filter(tid => !deletedTopicIds.has(tid)),
        })),
        resources: s.resources.filter(r => !r.topicId || !deletedTopicIds.has(r.topicId)),
      };
    });
    syllabusRepository.deleteUnit(id).catch(err => {
      console.warn('[useAcademicStore] Failed to delete syllabus unit:', err);
    });
  },

  addTopic: (topic) => {
    const newTopic: Topic = { ...topic, id: uid('topic') };
    set(s => ({
      topics: [...s.topics, newTopic],
      // Update parent unit's topicIds
      syllabusUnits: s.syllabusUnits.map(u =>
        u.id === topic.unitId
          ? { ...u, topicIds: [...u.topicIds, newTopic.id] }
          : u
      ),
    }));
    syllabusRepository.createTopic(newTopic).catch(err => {
      console.warn('[useAcademicStore] Failed to persist topic:', err);
    });
    return newTopic;
  },

  updateTopicRevision: (topicId, status) => {
    set(s => ({
      topics: s.topics.map(t =>
        t.id === topicId
          ? { ...t, revisionStatus: status, lastRevisedAt: new Date().toISOString() }
          : t
      ),
    }));
    revisionRepository.recordRevision(topicId, status).catch(err => {
      console.warn('[useAcademicStore] Failed to persist topic revision:', err);
    });
  },

  toggleTopicCompletion: (topicId) => {
    set(s => ({
      topics: s.topics.map(t =>
        t.id === topicId ? { ...t, isCompleted: !t.isCompleted } : t
      ),
    }));
    syllabusRepository.toggleTopicCompletion(topicId).catch(err => {
      console.warn('[useAcademicStore] Failed to toggle topic completion:', err);
    });
  },

  getTopicsForSubject: (subjectId) => {
    return get().topics.filter(t => t.subjectId === subjectId).sort((a, b) => a.order - b.order);
  },

  getTopicsForUnit: (unitId) => {
    return get().topics.filter(t => t.unitId === unitId).sort((a, b) => a.order - b.order);
  },

  getUnitsForSubject: (subjectId) => {
    return get().syllabusUnits.filter(u => u.subjectId === subjectId).sort((a, b) => a.order - b.order);
  },

  getSyllabusProgress: (subjectId) => {
    const topics = get().topics.filter(t => t.subjectId === subjectId);
    const completed = topics.filter(t => t.isCompleted).length;
    return {
      completed,
      total: topics.length,
      percentage: topics.length > 0 ? Math.round((completed / topics.length) * 100) : 0,
    };
  },

  // ── Phase 6: Exam Topics ─────────────────────────────────────

  addExamTopic: (examId, topicId, weightHint) => {
    const et: ExamTopic = {
      id: uid('et'),
      examId,
      topicId,
      weightHint,
    };
    set(s => ({ examTopics: [...s.examTopics, et] }));
    examRepository.addExamTopic(examId, topicId, weightHint).catch(err => {
      console.warn('[useAcademicStore] Failed to persist exam topic:', err);
    });
    return et;
  },

  removeExamTopic: (examTopicId) => {
    set(s => ({ examTopics: s.examTopics.filter(et => et.id !== examTopicId) }));
    examRepository.removeExamTopic(examTopicId).catch(err => {
      console.warn('[useAcademicStore] Failed to remove exam topic:', err);
    });
  },

  getTopicsForExam: (examId) => {
    return get().examTopics.filter(et => et.examId === examId);
  },

  upsertExamExtension: (data) => {
    const { examExtensions } = get();
    const existing = examExtensions.find(e => e.examId === data.examId);
    if (existing) {
      set(s => ({
        examExtensions: s.examExtensions.map(e =>
          e.examId === data.examId ? { ...e, ...data } : e
        ),
      }));
    } else {
      const newExt: ExamWithTopics = {
        examTopics:       [],
        revisionProgress: 0,
        relatedTaskIds:   [],
        relatedNoteIds:   [],
        ...data,
      };
      set(s => ({ examExtensions: [...s.examExtensions, newExt] }));
    }
  },

  getExamExtension: (examId) => {
    return get().examExtensions.find(e => e.examId === examId) ?? null;
  },

  // ── Phase 5: Task Relations ──────────────────────────────────

  setTaskRelations: (relations) => {
    const { taskRelations } = get();
    const exists = taskRelations.some(r => r.taskId === relations.taskId);
    if (exists) {
      set(s => ({
        taskRelations: s.taskRelations.map(r =>
          r.taskId === relations.taskId ? relations : r
        ),
      }));
    } else {
      set(s => ({ taskRelations: [...s.taskRelations, relations] }));
    }
    taskRepository.setTaskRelations(relations).catch(err => {
      console.warn('[useAcademicStore] Failed to persist task relations:', err);
    });
  },

  getTaskRelations: (taskId) => {
    return get().taskRelations.find(r => r.taskId === taskId) ?? null;
  },

  removeTaskRelations: (taskId) => {
    set(s => ({ taskRelations: s.taskRelations.filter(r => r.taskId !== taskId) }));
    taskRepository.removeTaskRelations(taskId).catch(err => {
      console.warn('[useAcademicStore] Failed to remove task relations:', err);
    });
  },

  // ── Phase 9: Resources ───────────────────────────────────────

  addResource: (resource) => {
    const res: Resource = {
      ...resource,
      id: uid('res'),
      createdAt: new Date().toISOString(),
    };
    set(s => ({ resources: [...s.resources, res] }));
    resourceRepository.createResource(res).catch(err => {
      console.warn('[useAcademicStore] Failed to persist resource:', err);
    });
    return res;
  },

  deleteResource: (resourceId) => {
    set(s => ({ resources: s.resources.filter(r => r.id !== resourceId) }));
    resourceRepository.deleteResource(resourceId).catch(err => {
      console.warn('[useAcademicStore] Failed to delete resource:', err);
    });
  },

  getResourcesForClassNote: (classNoteId) => {
    return get().resources.filter(r => r.classNoteId === classNoteId);
  },

  getResourcesForSubject: (subjectId) => {
    return get().resources.filter(r => r.subjectId === subjectId);
  },

  getResourcesForTopic: (topicId) => {
    return get().resources.filter(r => r.topicId === topicId);
  },

  getResourcesForExam: (examId) => {
    return get().resources.filter(r => r.examId === examId);
  },

  // ── Phase 8: Assessments & GPA ──────────────────────────────

  addAssessment: (assessment) => {
    const a: Assessment = { ...assessment, id: uid('assess') };
    set(s => ({ assessments: [...s.assessments, a] }));
    assessmentRepository.createAssessment(a).catch(err => {
      console.warn('[useAcademicStore] Failed to persist assessment:', err);
    });
    return a;
  },

  updateAssessment: (id, updates) => {
    set(s => ({
      assessments: s.assessments.map(a => a.id === id ? { ...a, ...updates } : a),
    }));
    assessmentRepository.updateAssessment(id, updates).catch(err => {
      console.warn('[useAcademicStore] Failed to update assessment:', err);
    });
  },

  deleteAssessment: (assessmentId) => {
    set(s => ({ assessments: s.assessments.filter(a => a.id !== assessmentId) }));
    assessmentRepository.deleteAssessment(assessmentId).catch(err => {
      console.warn('[useAcademicStore] Failed to delete assessment:', err);
    });
  },

  getAssessmentsForSubject: (subjectId) => {
    return get().assessments.filter(a => a.subjectId === subjectId);
  },

  getSubjectPerformance: (subjectId, subjectCredits = 3) => {
    const assessments = get().assessments.filter(a => a.subjectId === subjectId);
    const overallPercentage = computeSubjectPercentage(assessments);
    const { grade, points } = percentageToGradePoints(overallPercentage);
    return {
      subjectId,
      assessments,
      overallPercentage,
      grade,
      gradePoints: points,
      credits: subjectCredits,
    };
  },

  getSemesterGPA: (semesterId = 'sem-3', subjectCredits = {}) => {
    const semesterAssessments = get().assessments.filter(a => a.semesterId === semesterId);
    const subjectIds = [...new Set(semesterAssessments.map(a => a.subjectId))];

    const subjects: SubjectPerformance[] = subjectIds.map(sid => {
      const credits = subjectCredits[sid] ?? 3;
      return get().getSubjectPerformance(sid, credits);
    });

    // SGPA = sum(gradePoints * credits) / sum(credits)
    const totalCredits = subjects.reduce((s, p) => s + p.credits, 0);
    const totalWeighted = subjects.reduce((s, p) => s + (p.gradePoints ?? 0) * p.credits, 0);
    const sgpa = totalCredits > 0 ? Math.round((totalWeighted / totalCredits) * 100) / 100 : 0;

    return { semesterId, subjects, sgpa };
  },

  // ── Phase 2: Calendar ────────────────────────────────────────

  addCalendarEvent: (event) => {
    const ev: CalendarEvent = { ...event, id: uid('cal') };
    set(s => ({ calendarEvents: [...s.calendarEvents, ev] }));
    return ev;
  },

  removeCalendarEvent: (eventId) => {
    set(s => ({ calendarEvents: s.calendarEvents.filter(e => e.id !== eventId) }));
  },

  getCalendarEventsForDate: (date) => {
    return get().calendarEvents.filter(e => e.date === date);
  },

  getCalendarEventsForMonth: (year, month) => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return get().calendarEvents.filter(e => e.date.startsWith(prefix));
  },

  getCalendarEventsForRange: (fromDate, toDate) => {
    return get().calendarEvents.filter(e => e.date >= fromDate && e.date <= toDate);
  },

  // ── Phase 3: Class History ───────────────────────────────────

  getClassOccurrencesForSubject: (subjectId, fromDate, toDate) => {
    const { timetableSlots, classNotes, topics } = get();
    const subjectSlots = timetableSlots.filter(ts => ts.subjectId === subjectId && ts.isActive);

    const now = new Date();
    const from = fromDate
      ? (typeof fromDate === 'string' ? new Date(fromDate + (fromDate.includes('T') ? '' : 'T00:00:00')) : fromDate)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate
      ? (typeof toDate === 'string' ? new Date(toDate + (toDate.includes('T') ? '' : 'T23:59:59')) : toDate)
      : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const pairs = generateOccurrenceDates(subjectSlots, from, to);

    return pairs
      .map(({ slot, date }) => {
        const note = classNotes.find(n => n.classSessionId === slot.id && n.date === date) ?? null;
        const topicNames = note
          ? note.topicIds.map(tid => topics.find(t => t.id === tid)?.name ?? tid)
          : [];
        const attendanceStatus: ClassAttendanceStatus = note?.attendanceStatus ?? 'not_recorded';

        return {
          id: `${slot.id}-${date}`,
          slotId: slot.id,
          date,
          subjectId: slot.subjectId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          type: slot.type,
          note,
          attendanceStatus,
          topicNames,
        } satisfies ClassOccurrence;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // newest first
  },

  getClassOccurrencesForDate: (date) => {
    const { timetableSlots, classNotes, topics } = get();
    const targetDate = new Date(date + 'T00:00:00');
    const dow = getDayOfWeekFromDate(targetDate);

    const daySlots = timetableSlots.filter(ts => ts.dayOfWeek === dow && ts.isActive);

    return daySlots.map(slot => {
      const note = classNotes.find(n => n.classSessionId === slot.id && n.date === date) ?? null;
      const topicNames = note
        ? note.topicIds.map(tid => topics.find(t => t.id === tid)?.name ?? tid)
        : [];

      return {
        id: `${slot.id}-${date}`,
        slotId: slot.id,
        date,
        subjectId: slot.subjectId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        type: slot.type,
        note,
        attendanceStatus: (note?.attendanceStatus ?? 'not_recorded') as ClassAttendanceStatus,
        topicNames,
      } satisfies ClassOccurrence;
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  },

  getAllClassOccurrences: (fromDate, toDate) => {
    const { timetableSlots, classNotes, topics } = get();
    const from = new Date(fromDate + 'T00:00:00');
    const to   = new Date(toDate   + 'T00:00:00');
    const pairs = generateOccurrenceDates(timetableSlots, from, to);

    return pairs
      .map(({ slot, date }) => {
        const note = classNotes.find(n => n.classSessionId === slot.id && n.date === date) ?? null;
        const topicNames = note
          ? note.topicIds.map(tid => topics.find(t => t.id === tid)?.name ?? tid)
          : [];

        return {
          id: `${slot.id}-${date}`,
          slotId: slot.id,
          date,
          subjectId: slot.subjectId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          type: slot.type,
          note,
          attendanceStatus: (note?.attendanceStatus ?? 'not_recorded') as ClassAttendanceStatus,
          topicNames,
        } satisfies ClassOccurrence;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime));
  },

  // ── Phase 10: Revision History ───────────────────────────────

  getRevisionHistory: (subjectId) => {
    const { topics } = get();
    const filtered = subjectId ? topics.filter(t => t.subjectId === subjectId) : topics;
    return filtered
      .map(t => ({
        topicId: t.id,
        topicName: t.name,
        status: t.revisionStatus,
        lastRevisedAt: t.lastRevisedAt,
        subjectId: t.subjectId,
      }))
      .sort((a, b) => {
        if (!a.lastRevisedAt && !b.lastRevisedAt) return 0;
        if (!a.lastRevisedAt) return 1;
        if (!b.lastRevisedAt) return -1;
        return b.lastRevisedAt.localeCompare(a.lastRevisedAt);
      });
  },

  getTopicsNeedingRevision: (subjectId) => {
    const { topics } = get();
    const filtered = subjectId ? topics.filter(t => t.subjectId === subjectId) : topics;
    return filtered.filter(t => t.revisionStatus === 'needs_revision');
  },

  getTopicsTaughtNotRevised: (subjectId) => {
    const { topics } = get();
    const filtered = subjectId ? topics.filter(t => t.subjectId === subjectId) : topics;
    return filtered.filter(t => t.revisionStatus === 'taught');
  },

  // ── Phase 7: Revision Intelligence ───────────────────────────
  recordTopicRevision: async (input) => {
    const record = await revisionRepository.createRecord(input);
    set(s => ({
      revisionRecords: [record, ...s.revisionRecords.filter(r => r.id !== record.id)],
      topics: s.topics.map(t =>
        t.id === input.topicId
          ? {
              ...t,
              revisionStatus:
                input.outcome === 'confident' || input.outcome === 'okay'
                  ? 'revised'
                  : 'needs_revision',
              lastRevisedAt: input.reviewedAt,
              revisionCount: (t.revisionCount || 0) + 1,
            }
          : t
      ),
    }));
    return record;
  },

  deleteRevisionRecord: async (id) => {
    await revisionRepository.deleteRecord(id);
    set(s => ({
      revisionRecords: s.revisionRecords.filter(r => r.id !== id),
    }));
  },

  getRevisionRecordsForTopic: (topicId) => {
    return get()
      .revisionRecords.filter(r => r.topicId === topicId)
      .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
  },

  getTopicRevisionIntelligence: (topicId) => {
    const { revisionIntelligenceService } = require('@/services/revisionIntelligenceService');
    return revisionIntelligenceService.getTopicIntelligence(topicId);
  },

  convertRevisionToTask: async (topicId, scheduledDate, examId) => {
    const { examSprintService } = require('@/services/examSprintService');
    return await examSprintService.convertSprintTopicToTask({
      topicId,
      examId,
      scheduledDate,
    });
  },
}));
