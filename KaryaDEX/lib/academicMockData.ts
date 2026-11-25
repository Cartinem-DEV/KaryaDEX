/**
 * KaryaDEX — Academic Extension Seed Data
 *
 * Mock data for Phases 1-10 feature set.
 * Structured around the real mockSubjects / mockClassSessions from mockData.ts.
 */

import type {
  TimetableSlot,
  ClassNote,
  Topic,
  SyllabusUnit,
  ExamTopic,
  ExamWithTopics,
  TaskRelations,
  Resource,
  Assessment,
  CalendarEvent,
} from '@/types/academic';

// ─── Phase 4: Timetable Slots ───────────────────────────────────
// Mirror the existing mockClassSessions as editable TimetableSlots.
// The app will use these going forward instead of read-only ClassSessions.
export const mockTimetableSlots: TimetableSlot[] = [
  // Monday
  { id: 'ts-1',  subjectId: 'sub-1', semesterId: 'sem-3', dayOfWeek: 'monday',    startTime: '09:00', endTime: '10:00', room: '204',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-2',  subjectId: 'sub-2', semesterId: 'sem-3', dayOfWeek: 'monday',    startTime: '10:00', endTime: '11:00', room: '301',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-3',  subjectId: 'sub-3', semesterId: 'sem-3', dayOfWeek: 'monday',    startTime: '11:00', endTime: '12:00', room: '105',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-4',  subjectId: 'sub-4', semesterId: 'sem-3', dayOfWeek: 'monday',    startTime: '14:00', endTime: '16:00', room: 'Lab 2', type: 'lab',      isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  // Tuesday
  { id: 'ts-5',  subjectId: 'sub-5', semesterId: 'sem-3', dayOfWeek: 'tuesday',   startTime: '09:00', endTime: '10:00', room: '402',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-6',  subjectId: 'sub-1', semesterId: 'sem-3', dayOfWeek: 'tuesday',   startTime: '10:00', endTime: '11:00', room: '204',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-7',  subjectId: 'sub-2', semesterId: 'sem-3', dayOfWeek: 'tuesday',   startTime: '11:00', endTime: '12:00', room: '301',   type: 'tutorial', isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-8',  subjectId: 'sub-3', semesterId: 'sem-3', dayOfWeek: 'tuesday',   startTime: '14:00', endTime: '16:00', room: 'Lab 1', type: 'lab',      isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  // Wednesday
  { id: 'ts-9',  subjectId: 'sub-2', semesterId: 'sem-3', dayOfWeek: 'wednesday', startTime: '09:00', endTime: '10:00', room: '301',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-10', subjectId: 'sub-4', semesterId: 'sem-3', dayOfWeek: 'wednesday', startTime: '10:00', endTime: '11:00', room: 'Lab 2', type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-11', subjectId: 'sub-5', semesterId: 'sem-3', dayOfWeek: 'wednesday', startTime: '11:00', endTime: '12:00', room: '402',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-12', subjectId: 'sub-1', semesterId: 'sem-3', dayOfWeek: 'wednesday', startTime: '14:00', endTime: '15:00', room: '204',   type: 'tutorial', isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  // Thursday
  { id: 'ts-13', subjectId: 'sub-3', semesterId: 'sem-3', dayOfWeek: 'thursday',  startTime: '09:00', endTime: '10:00', room: '105',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-14', subjectId: 'sub-5', semesterId: 'sem-3', dayOfWeek: 'thursday',  startTime: '10:00', endTime: '11:00', room: '402',   type: 'tutorial', isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-15', subjectId: 'sub-4', semesterId: 'sem-3', dayOfWeek: 'thursday',  startTime: '11:00', endTime: '12:00', room: 'Lab 2', type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-16', subjectId: 'sub-2', semesterId: 'sem-3', dayOfWeek: 'thursday',  startTime: '14:00', endTime: '15:00', room: '301',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  // Friday
  { id: 'ts-17', subjectId: 'sub-1', semesterId: 'sem-3', dayOfWeek: 'friday',    startTime: '09:00', endTime: '10:00', room: '204',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-18', subjectId: 'sub-3', semesterId: 'sem-3', dayOfWeek: 'friday',    startTime: '10:00', endTime: '11:00', room: '105',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-19', subjectId: 'sub-5', semesterId: 'sem-3', dayOfWeek: 'friday',    startTime: '11:00', endTime: '12:00', room: '402',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-20', subjectId: 'sub-4', semesterId: 'sem-3', dayOfWeek: 'friday',    startTime: '14:00', endTime: '16:00', room: 'Lab 2', type: 'lab',      isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  // Saturday
  { id: 'ts-21', subjectId: 'sub-2', semesterId: 'sem-3', dayOfWeek: 'saturday',  startTime: '09:00', endTime: '10:00', room: '301',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
  { id: 'ts-22', subjectId: 'sub-1', semesterId: 'sem-3', dayOfWeek: 'saturday',  startTime: '10:00', endTime: '11:00', room: '204',   type: 'lecture',  isRecurring: true, isActive: true, createdAt: '2026-08-01', updatedAt: '2026-08-01' },
];

// ─── Phase 7: Syllabus Units ─────────────────────────────────────
export const mockSyllabusUnits: SyllabusUnit[] = [
  // Physics
  { id: 'unit-phy-1', subjectId: 'sub-1', semesterId: 'sem-3', name: 'Unit 1: Optics',            order: 1, topicIds: ['topic-phy-1','topic-phy-2','topic-phy-3'] },
  { id: 'unit-phy-2', subjectId: 'sub-1', semesterId: 'sem-3', name: 'Unit 2: Electromagnetism',  order: 2, topicIds: ['topic-phy-4','topic-phy-5'] },
  // Mathematics
  { id: 'unit-mat-1', subjectId: 'sub-2', semesterId: 'sem-3', name: 'Unit 1: Differential Equations', order: 1, topicIds: ['topic-mat-1','topic-mat-2','topic-mat-3'] },
  { id: 'unit-mat-2', subjectId: 'sub-2', semesterId: 'sem-3', name: 'Unit 2: Laplace Transforms',     order: 2, topicIds: ['topic-mat-4','topic-mat-5'] },
  // Chemistry
  { id: 'unit-che-1', subjectId: 'sub-3', semesterId: 'sem-3', name: 'Unit 1: Electrochemistry',   order: 1, topicIds: ['topic-che-1','topic-che-2'] },
  // Programming
  { id: 'unit-cse-1', subjectId: 'sub-4', semesterId: 'sem-3', name: 'Unit 1: Arrays & Strings',   order: 1, topicIds: ['topic-cse-1','topic-cse-2'] },
  { id: 'unit-cse-2', subjectId: 'sub-4', semesterId: 'sem-3', name: 'Unit 2: Linked Lists',        order: 2, topicIds: ['topic-cse-3','topic-cse-4'] },
];

// ─── Phase 7: Topics ────────────────────────────────────────────
export const mockTopics: Topic[] = [
  // Physics
  { id: 'topic-phy-1', subjectId: 'sub-1', unitId: 'unit-phy-1', name: 'Wave Nature of Light',    order: 1, isCompleted: true,  revisionStatus: 'revised',       classNoteIds: ['cn-1'] },
  { id: 'topic-phy-2', subjectId: 'sub-1', unitId: 'unit-phy-1', name: 'Interference',            order: 2, isCompleted: true,  revisionStatus: 'taught',        classNoteIds: ['cn-2'] },
  { id: 'topic-phy-3', subjectId: 'sub-1', unitId: 'unit-phy-1', name: 'Diffraction',             order: 3, isCompleted: true,  revisionStatus: 'needs_revision', classNoteIds: [] },
  { id: 'topic-phy-4', subjectId: 'sub-1', unitId: 'unit-phy-2', name: 'Electromagnetic Induction', order: 1, isCompleted: true, revisionStatus: 'revised',      classNoteIds: [] },
  { id: 'topic-phy-5', subjectId: 'sub-1', unitId: 'unit-phy-2', name: 'Maxwell Equations',       order: 2, isCompleted: false, revisionStatus: 'not_started',   classNoteIds: [] },
  // Mathematics
  { id: 'topic-mat-1', subjectId: 'sub-2', unitId: 'unit-mat-1', name: 'First Order ODE',          order: 1, isCompleted: true,  revisionStatus: 'revised',        classNoteIds: ['cn-3'] },
  { id: 'topic-mat-2', subjectId: 'sub-2', unitId: 'unit-mat-1', name: 'Second Order ODE',         order: 2, isCompleted: true,  revisionStatus: 'taught',         classNoteIds: [] },
  { id: 'topic-mat-3', subjectId: 'sub-2', unitId: 'unit-mat-1', name: 'Homogeneous Equations',    order: 3, isCompleted: true,  revisionStatus: 'needs_revision', classNoteIds: [] },
  { id: 'topic-mat-4', subjectId: 'sub-2', unitId: 'unit-mat-2', name: 'Laplace Transform',        order: 1, isCompleted: true,  revisionStatus: 'taught',         classNoteIds: [] },
  { id: 'topic-mat-5', subjectId: 'sub-2', unitId: 'unit-mat-2', name: 'Inverse Laplace',          order: 2, isCompleted: false, revisionStatus: 'not_started',    classNoteIds: [] },
  // Chemistry
  { id: 'topic-che-1', subjectId: 'sub-3', unitId: 'unit-che-1', name: 'Electrolytic Cells',       order: 1, isCompleted: true,  revisionStatus: 'revised',        classNoteIds: [] },
  { id: 'topic-che-2', subjectId: 'sub-3', unitId: 'unit-che-1', name: 'Redox Reactions',          order: 2, isCompleted: false, revisionStatus: 'taught',         classNoteIds: [] },
  // Programming
  { id: 'topic-cse-1', subjectId: 'sub-4', unitId: 'unit-cse-1', name: 'Arrays',                  order: 1, isCompleted: true,  revisionStatus: 'revised',        classNoteIds: [] },
  { id: 'topic-cse-2', subjectId: 'sub-4', unitId: 'unit-cse-1', name: 'String Manipulation',     order: 2, isCompleted: true,  revisionStatus: 'taught',         classNoteIds: [] },
  { id: 'topic-cse-3', subjectId: 'sub-4', unitId: 'unit-cse-2', name: 'Singly Linked List',      order: 1, isCompleted: false, revisionStatus: 'taught',         classNoteIds: [] },
  { id: 'topic-cse-4', subjectId: 'sub-4', unitId: 'unit-cse-2', name: 'Doubly Linked List',      order: 2, isCompleted: false, revisionStatus: 'not_started',    classNoteIds: [] },
];

// ─── Phase 1: Class Notes ────────────────────────────────────────
export const mockClassNotes: ClassNote[] = [
  {
    id: 'cn-1',
    classSessionId: 'ts-1',
    date: '2026-09-29',
    subjectId: 'sub-1',
    attendanceStatus: 'present',
    topicIds: ['topic-phy-1'],
    myNotes: 'Wave nature of light — Huygen\'s principle. Light travels as waves. Discussed interference conditions.',
    teacherNotes: 'Will continue with double slit experiment next class.',
    revisionStatus: 'revised',
    lastRevisedAt: '2026-10-01T10:00:00.000Z',
    resourceIds: ['res-1'],
    linkedTaskIds: ['task-1'],
    linkedExamTopicIds: [],
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'cn-2',
    classSessionId: 'ts-6',
    date: '2026-09-30',
    subjectId: 'sub-1',
    attendanceStatus: 'present',
    topicIds: ['topic-phy-2'],
    myNotes: 'Young\'s Double Slit experiment. Path difference determines constructive/destructive interference.',
    teacherNotes: '',
    revisionStatus: 'taught',
    resourceIds: [],
    linkedTaskIds: [],
    linkedExamTopicIds: ['et-1'],
    createdAt: '2026-09-30T10:00:00.000Z',
    updatedAt: '2026-09-30T10:00:00.000Z',
  },
  {
    id: 'cn-3',
    classSessionId: 'ts-2',
    date: '2026-09-29',
    subjectId: 'sub-2',
    attendanceStatus: 'present',
    topicIds: ['topic-mat-1'],
    myNotes: 'First order ODE — separable equations. dy/dx = f(x)g(y). Separate and integrate both sides.',
    teacherNotes: 'Practice 5 problems from exercise 2.1.',
    revisionStatus: 'revised',
    lastRevisedAt: '2026-10-02T08:00:00.000Z',
    resourceIds: [],
    linkedTaskIds: ['task-2'],
    linkedExamTopicIds: [],
    createdAt: '2026-09-29T10:05:00.000Z',
    updatedAt: '2026-10-02T08:00:00.000Z',
  },
  {
    id: 'cn-4',
    classSessionId: 'ts-1',
    date: '2026-09-22',
    subjectId: 'sub-1',
    attendanceStatus: 'absent',
    topicIds: [],
    myNotes: '',
    teacherNotes: '',
    revisionStatus: 'not_started',
    resourceIds: [],
    linkedTaskIds: [],
    linkedExamTopicIds: [],
    createdAt: '2026-09-22T10:00:00.000Z',
    updatedAt: '2026-09-22T10:00:00.000Z',
  },
  {
    id: 'cn-5',
    classSessionId: 'ts-17',
    date: '2026-10-03',
    subjectId: 'sub-1',
    attendanceStatus: 'not_recorded',
    topicIds: ['topic-phy-3'],
    myNotes: '',
    teacherNotes: '',
    revisionStatus: 'not_started',
    resourceIds: [],
    linkedTaskIds: [],
    linkedExamTopicIds: [],
    createdAt: '2026-10-03T09:00:00.000Z',
    updatedAt: '2026-10-03T09:00:00.000Z',
  },
];

// ─── Phase 6: Exam Topics ────────────────────────────────────────
export const mockExamTopics: ExamTopic[] = [
  { id: 'et-1', examId: 'exam-1', topicId: 'topic-phy-1', weightHint: 'high' },
  { id: 'et-2', examId: 'exam-1', topicId: 'topic-phy-2', weightHint: 'high' },
  { id: 'et-3', examId: 'exam-1', topicId: 'topic-phy-3', weightHint: 'medium' },
  { id: 'et-4', examId: 'exam-2', topicId: 'topic-mat-1', weightHint: 'high' },
  { id: 'et-5', examId: 'exam-2', topicId: 'topic-mat-2', weightHint: 'medium' },
  { id: 'et-6', examId: 'exam-2', topicId: 'topic-mat-4', weightHint: 'high' },
];

export const mockExamExtensions: ExamWithTopics[] = [
  {
    examId: 'exam-1',
    examTopics: [mockExamTopics[0], mockExamTopics[1], mockExamTopics[2]],
    venue: 'Hall A',
    revisionProgress: 60,
    syllabusNotes: 'Focus on numerical problems in interference and diffraction.',
    relatedTaskIds: ['task-1'],
    relatedNoteIds: ['cn-1', 'cn-2'],
  },
  {
    examId: 'exam-2',
    examTopics: [mockExamTopics[3], mockExamTopics[4], mockExamTopics[5]],
    venue: 'Hall A',
    revisionProgress: 40,
    syllabusNotes: 'Practice 10 ODE problems. Laplace tables will be provided.',
    relatedTaskIds: ['task-2'],
    relatedNoteIds: ['cn-3'],
  },
];

// ─── Phase 5: Task Relations ─────────────────────────────────────
export const mockTaskRelations: TaskRelations[] = [
  { taskId: 'task-1', classNoteId: 'cn-1', classSessionId: 'ts-1', classDate: '2026-09-29', examId: 'exam-1', topicIds: ['topic-phy-1'] },
  { taskId: 'task-2', classNoteId: 'cn-3', classSessionId: 'ts-2', classDate: '2026-09-29', examId: 'exam-2', topicIds: ['topic-mat-1'] },
  { taskId: 'task-3', classSessionId: 'ts-8', classDate: '2026-09-30', topicIds: [] },
  { taskId: 'task-4', classSessionId: 'ts-4', classDate: '2026-09-29', topicIds: ['topic-cse-3'] },
];

// ─── Phase 9: Resources ──────────────────────────────────────────
export const mockResources: Resource[] = [
  {
    id: 'res-1',
    title: 'Wave Optics — Lecture Slides',
    type: 'url',
    url: 'https://example.com/phy201-optics.pdf',
    classNoteId: 'cn-1',
    subjectId: 'sub-1',
    createdAt: '2026-09-29T10:30:00.000Z',
  },
  {
    id: 'res-2',
    title: 'ODE Practice Problems',
    type: 'pdf',
    url: 'https://example.com/mat201-ode.pdf',
    subjectId: 'sub-2',
    topicId: 'topic-mat-1',
    createdAt: '2026-09-30T08:00:00.000Z',
  },
  {
    id: 'res-3',
    title: 'C Programming Lab Manual',
    type: 'document',
    url: 'https://example.com/cse201-lab.pdf',
    subjectId: 'sub-4',
    createdAt: '2026-08-15T00:00:00.000Z',
  },
];

// ─── Phase 8: Assessments ────────────────────────────────────────
export const mockAssessments: Assessment[] = [
  { id: 'assess-1', subjectId: 'sub-1', semesterId: 'sem-3', examId: 'exam-prev-1', name: 'Quiz 1',     type: 'quiz',     marksObtained: 8,  marksMax: 10,  weightage: 5,  date: '2026-08-20' },
  { id: 'assess-2', subjectId: 'sub-1', semesterId: 'sem-3', examId: 'exam-prev-1', name: 'Internal 1', type: 'internal', marksObtained: 24, marksMax: 30,  weightage: 15, date: '2026-09-10' },
  { id: 'assess-3', subjectId: 'sub-2', semesterId: 'sem-3', examId: 'exam-prev-2', name: 'Internal 1', type: 'internal', marksObtained: 27, marksMax: 30,  weightage: 15, date: '2026-09-12' },
  { id: 'assess-4', subjectId: 'sub-3', semesterId: 'sem-3', examId: 'exam-prev-3', name: 'Quiz 1',     type: 'quiz',     marksObtained: 11, marksMax: 15,  weightage: 5,  date: '2026-09-20' },
  { id: 'assess-5', subjectId: 'sub-4', semesterId: 'sem-3',                        name: 'Lab 1',      type: 'practical',marksObtained: 18, marksMax: 20,  weightage: 10, date: '2026-09-05' },
];

// ─── Phase 2: Calendar Events ────────────────────────────────────
export const mockCalendarEvents: CalendarEvent[] = [
  { id: 'cal-1', type: 'exam',  date: '2026-10-05', startTime: '10:00', title: 'Physics Internal 1',   subtitle: 'Hall A',  color: '#6366F1', subjectId: 'sub-1', sourceId: 'exam-1', isCustom: false },
  { id: 'cal-2', type: 'exam',  date: '2026-10-07', startTime: '10:00', title: 'Mathematics Internal 1', subtitle: 'Hall A', color: '#8B5CF6', subjectId: 'sub-2', sourceId: 'exam-2', isCustom: false },
  { id: 'cal-3', type: 'task',  date: '2026-09-13', title: 'Physics Assignment 3 Due', subjectId: 'sub-1', sourceId: 'task-1', isCustom: false },
  { id: 'cal-4', type: 'holiday', date: '2026-10-02', title: 'Gandhi Jayanti', isCustom: false, isAllDay: true },
  { id: 'cal-5', type: 'custom',  date: '2026-10-15', title: 'College Fest', subtitle: 'Main Auditorium', isCustom: true, isAllDay: true },
];
