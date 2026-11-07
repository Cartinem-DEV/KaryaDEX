/**
 * BunkMatKar — Academic Extension Unit Tests
 *
 * Tests for the 8 core features of the academic operating system:
 * 1. ClassSession / Timetable slot creation & editing
 * 2. Class note association (occurrence-bound journal notes)
 * 3. Topic association & syllabus hierarchy
 * 4. Task-to-class association (relational context)
 * 5. Exam-topic association & revision progress
 * 6. Class history retrieval (chronological occurrence resolution)
 * 7. Revision status tracking & queries
 * 8. Timetable recurrence logic (day of week matching, range expansion)
 */

import { useAcademicStore } from '@/store/useAcademicStore';
import type { TimetableSlotInput, ClassNoteInput, RevisionStatus } from '@/types/academic';

describe('Academic Extension — Phase 1-10 Architecture', () => {
  // Reset store before each test to prevent state pollution
  beforeEach(() => {
    useAcademicStore.getState().resetAcademicStore();
  });

  // ─── 1. ClassSession / Timetable Slot Creation ──────────────────
  describe('1. ClassSession / TimetableSlot Creation', () => {
    it('creates a new timetable slot with proper defaults', () => {
      const store = useAcademicStore.getState();
      const input: TimetableSlotInput = {
        subjectId: 'sub-test-1',
        semesterId: 'sem-3',
        dayOfWeek: 'wednesday',
        startTime: '13:00',
        endTime: '14:00',
        room: 'Test-101',
        type: 'lecture',
        isRecurring: true,
      };

      const slot = store.addTimetableSlot(input);
      expect(slot).toBeDefined();
      expect(slot.id).toBeDefined();
      expect(slot.subjectId).toBe('sub-test-1');
      expect(slot.room).toBe('Test-101');
      expect(slot.isActive).toBe(true);
      expect(slot.isRecurring).toBe(true);

      const found = useAcademicStore.getState().timetableSlots.find(s => s.id === slot.id);
      expect(found).toBeDefined();
    });

    it('updates timetable slot details', () => {
      const store = useAcademicStore.getState();
      const slot = store.addTimetableSlot({
        subjectId: 'sub-test-1',
        semesterId: 'sem-3',
        dayOfWeek: 'friday',
        startTime: '15:00',
        endTime: '16:00',
        room: 'Old-Room',
        type: 'lecture',
      });

      store.updateTimetableSlot(slot.id, { room: 'New-Room-500', startTime: '15:30' });
      const updated = useAcademicStore.getState().timetableSlots.find(s => s.id === slot.id);
      expect(updated?.room).toBe('New-Room-500');
      expect(updated?.startTime).toBe('15:30');
    });

    it('deactivates (soft-deletes) a timetable slot', () => {
      const store = useAcademicStore.getState();
      const slot = store.addTimetableSlot({
        subjectId: 'sub-test-del',
        semesterId: 'sem-3',
        dayOfWeek: 'monday',
        startTime: '08:00',
        endTime: '09:00',
        room: 'Del-101',
        type: 'tutorial',
      });

      store.deleteTimetableSlot(slot.id);
      const afterDel = useAcademicStore.getState().timetableSlots.find(s => s.id === slot.id);
      expect(afterDel?.isActive).toBe(false);
    });
  });

  // ─── 2. Class Note Association ──────────────────────────────────
  describe('2. Class Note Association', () => {
    it('creates a note bound to a specific class session occurrence (slotId + date)', () => {
      const store = useAcademicStore.getState();
      const noteInput: ClassNoteInput = {
        classSessionId: 'slot-occ-1',
        date: '2026-10-15',
        subjectId: 'sub-1',
        attendanceStatus: 'present',
        myNotes: 'Derived formula for wave propagation',
        teacherNotes: 'Exam on this next Thursday',
        topicIds: ['topic-phy-1'],
        revisionStatus: 'taught',
      };

      const note = store.upsertClassNote(noteInput);
      expect(note).toBeDefined();
      expect(note.classSessionId).toBe('slot-occ-1');
      expect(note.date).toBe('2026-10-15');
      expect(note.attendanceStatus).toBe('present');
      expect(note.myNotes).toBe('Derived formula for wave propagation');

      // Retrieve via getClassNote
      const fetched = store.getClassNote('slot-occ-1', '2026-10-15');
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(note.id);
    });

    it('updates existing note on subsequent upsert rather than duplicating', () => {
      const store = useAcademicStore.getState();
      const note1 = store.upsertClassNote({
        classSessionId: 'slot-occ-2',
        date: '2026-10-20',
        subjectId: 'sub-2',
        myNotes: 'Initial draft note',
      });

      const note2 = store.upsertClassNote({
        classSessionId: 'slot-occ-2',
        date: '2026-10-20',
        subjectId: 'sub-2',
        myNotes: 'Updated comprehensive note',
        attendanceStatus: 'late',
      });

      expect(note1.id).toBe(note2.id);
      expect(note2.myNotes).toBe('Updated comprehensive note');
      expect(note2.attendanceStatus).toBe('late');
    });

    it('retrieves notes by subject and by date', () => {
      const store = useAcademicStore.getState();
      store.upsertClassNote({
        classSessionId: 'slot-occ-filter',
        date: '2026-11-01',
        subjectId: 'sub-filter-target',
        myNotes: 'Special note',
      });

      const bySubject = store.getClassNotesForSubject('sub-filter-target');
      expect(bySubject.length).toBeGreaterThanOrEqual(1);
      expect(bySubject.some(n => n.date === '2026-11-01')).toBe(true);

      const byDate = store.getClassNotesForDate('2026-11-01');
      expect(byDate.some(n => n.subjectId === 'sub-filter-target')).toBe(true);
    });
  });

  // ─── 3. Topic Association ────────────────────────────────────────
  describe('3. Topic Association', () => {
    it('creates syllabus units and topics hierarchically', () => {
      const store = useAcademicStore.getState();
      const unit = store.addSyllabusUnit({
        subjectId: 'sub-topic-test',
        semesterId: 'sem-3',
        name: 'Unit 9: Quantum Mechanics',
        order: 9,
        topicIds: [],
      });

      expect(unit.id).toBeDefined();
      expect(unit.name).toBe('Unit 9: Quantum Mechanics');

      const topic = store.addTopic({
        subjectId: 'sub-topic-test',
        unitId: unit.id,
        name: 'Schrodinger Equation',
        isCompleted: false,
        revisionStatus: 'not_started',
        classNoteIds: [],
        order: 1,
      });

      expect(topic.id).toBeDefined();
      expect(topic.unitId).toBe(unit.id);

      const subjectTopics = store.getTopicsForSubject('sub-topic-test');
      expect(subjectTopics.some(t => t.id === topic.id)).toBe(true);

      const unitTopics = store.getTopicsForUnit(unit.id);
      expect(unitTopics.some(t => t.id === topic.id)).toBe(true);
    });

    it('toggles topic completion status', () => {
      const store = useAcademicStore.getState();
      const topic = store.addTopic({
        subjectId: 'sub-toggle',
        unitId: 'unit-1',
        name: 'Topic to toggle',
        isCompleted: false,
        revisionStatus: 'not_started',
        classNoteIds: [],
        order: 1,
      });

      expect(topic.isCompleted).toBe(false);
      store.toggleTopicCompletion(topic.id);
      const afterFirst = useAcademicStore.getState().topics.find(t => t.id === topic.id);
      expect(afterFirst?.isCompleted).toBe(true);

      store.toggleTopicCompletion(topic.id);
      const afterSecond = useAcademicStore.getState().topics.find(t => t.id === topic.id);
      expect(afterSecond?.isCompleted).toBe(false);
    });
  });

  // ─── 4. Task-to-Class Association ────────────────────────────────
  describe('4. Task-to-Class Association', () => {
    it('associates a task with a classSessionId and classDate', () => {
      const store = useAcademicStore.getState();
      store.setTaskRelations({
        taskId: 'task-test-rel-1',
        classSessionId: 'slot-math-mon',
        classDate: '2026-10-05',
        classNoteId: 'cn-rel-1',
        topicIds: ['topic-mat-1'],
      });

      const rel = store.getTaskRelations('task-test-rel-1');
      expect(rel).not.toBeNull();
      expect(rel?.classSessionId).toBe('slot-math-mon');
      expect(rel?.classDate).toBe('2026-10-05');
      expect(rel?.topicIds).toContain('topic-mat-1');
    });

    it('returns null for tasks without custom relational extensions', () => {
      const store = useAcademicStore.getState();
      const rel = store.getTaskRelations('task-unrelated-random-id');
      expect(rel).toBeNull();
    });
  });

  // ─── 5. Exam-Topic Association ───────────────────────────────────
  describe('5. Exam-Topic Association', () => {
    it('links topics to an exam with weight hints', () => {
      const store = useAcademicStore.getState();
      const examTopic = store.addExamTopic('exam-midterm-1', 'topic-phy-1', 'high');

      expect(examTopic.id).toBeDefined();
      expect(examTopic.examId).toBe('exam-midterm-1');
      expect(examTopic.topicId).toBe('topic-phy-1');
      expect(examTopic.weightHint).toBe('high');

      const examTopics = store.getTopicsForExam('exam-midterm-1');
      expect(examTopics.some(et => et.topicId === 'topic-phy-1')).toBe(true);
    });

    it('removes an exam topic link', () => {
      const store = useAcademicStore.getState();
      const et = store.addExamTopic('exam-to-remove', 'topic-mat-1', 'medium');
      expect(store.getTopicsForExam('exam-to-remove').length).toBeGreaterThanOrEqual(1);

      store.removeExamTopic(et.id);
      expect(store.getTopicsForExam('exam-to-remove').some(t => t.id === et.id)).toBe(false);
    });

    it('updates exam extensions (revision progress and syllabus notes)', () => {
      const store = useAcademicStore.getState();
      store.upsertExamExtension({
        examId: 'exam-ext-test',
        revisionProgress: 75,
        syllabusNotes: 'Focus on chapters 1 through 4',
        venue: 'Exam Hall 2',
      });

      const ext = store.getExamExtension('exam-ext-test');
      expect(ext).not.toBeNull();
      expect(ext?.revisionProgress).toBe(75);
      expect(ext?.venue).toBe('Exam Hall 2');
    });
  });

  // ─── 6. Class History Retrieval ──────────────────────────────────
  describe('6. Class History Retrieval', () => {
    it('retrieves chronological occurrences for a subject with attendance and topic names', () => {
      const store = useAcademicStore.getState();
      // Add a monday slot for sub-1 so history is non-empty
      store.addTimetableSlot({
        subjectId: 'sub-1',
        semesterId: 'sem-3',
        dayOfWeek: 'monday',
        startTime: '09:00',
        endTime: '10:00',
        room: 'T-101',
        type: 'lecture',
        isRecurring: true,
      });

      // 2026-10-05 to 2026-10-05 is a Monday — use a wide range to guarantee hits
      const history = store.getClassOccurrencesForSubject(
        'sub-1',
        '2026-10-05',
        '2026-10-26'
      );
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      // Verify each occurrence conforms to ClassOccurrence contract
      const first = history[0];
      expect(first.id).toBeDefined();
      expect(first.slotId).toBeDefined();
      expect(first.date).toBeDefined();
      expect(first.subjectId).toBe('sub-1');
      expect(first.startTime).toBeDefined();
      expect(first.endTime).toBeDefined();
      expect(first.attendanceStatus).toBeDefined();
      expect(Array.isArray(first.topicNames)).toBe(true);
    });

    it('correctly associates class notes with resolved occurrences', () => {
      const store = useAcademicStore.getState();
      // Ensure a known slot and note exist
      const slot = store.addTimetableSlot({
        subjectId: 'sub-hist-test',
        semesterId: 'sem-3',
        dayOfWeek: 'tuesday',
        startTime: '09:00',
        endTime: '10:00',
        room: 'Hist-Room',
        type: 'lecture',
        isRecurring: true,
      });

      // Upsert note on a Tuesday
      // 2026-10-06 is a Tuesday
      store.upsertClassNote({
        classSessionId: slot.id,
        date: '2026-10-06',
        subjectId: 'sub-hist-test',
        attendanceStatus: 'present',
        myNotes: 'History test lecture notes',
        topicIds: [],
      });

      // Use an explicit date range that includes 2026-10-06
      const history = store.getClassOccurrencesForSubject(
        'sub-hist-test',
        '2026-10-01',
        '2026-10-10'
      );
      const targetOcc = history.find(h => h.slotId === slot.id && h.date === '2026-10-06');
      expect(targetOcc).toBeDefined();
      expect(targetOcc?.attendanceStatus).toBe('present');
      expect(targetOcc?.note?.myNotes).toBe('History test lecture notes');
    });
  });

  // ─── 7. Revision Status ──────────────────────────────────────────
  describe('7. Revision Status', () => {
    it('updates topic revision status and sets lastRevisedAt', () => {
      const store = useAcademicStore.getState();
      const topic = store.addTopic({
        subjectId: 'sub-rev-test',
        unitId: 'unit-rev',
        name: 'Thermodynamics Cycle',
        isCompleted: true,
        revisionStatus: 'not_started',
        classNoteIds: [],
        order: 1,
      });

      store.updateTopicRevision(topic.id, 'revised');
      const updated = useAcademicStore.getState().topics.find(t => t.id === topic.id);
      expect(updated?.revisionStatus).toBe('revised');
      expect(updated?.lastRevisedAt).toBeDefined();
    });

    it('filters topics needing revision vs taught not revised', () => {
      const store = useAcademicStore.getState();
      const t1 = store.addTopic({
        subjectId: 'sub-filter-rev',
        unitId: 'unit-1',
        name: 'Topic Need Rev',
        isCompleted: true,
        revisionStatus: 'needs_revision',
        classNoteIds: [],
        order: 1,
      });

      const t2 = store.addTopic({
        subjectId: 'sub-filter-rev',
        unitId: 'unit-1',
        name: 'Topic Taught Only',
        isCompleted: true,
        revisionStatus: 'taught',
        classNoteIds: [],
        order: 2,
      });

      const needing = store.getTopicsNeedingRevision('sub-filter-rev');
      expect(needing.some(t => t.id === t1.id)).toBe(true);
      expect(needing.some(t => t.id === t2.id)).toBe(false);

      const taught = store.getTopicsTaughtNotRevised('sub-filter-rev');
      expect(taught.some(t => t.id === t2.id)).toBe(true);
      expect(taught.some(t => t.id === t1.id)).toBe(false);
    });

    it('returns revision history sorted by last revision date', () => {
      const store = useAcademicStore.getState();
      const revHistory = store.getRevisionHistory();
      expect(Array.isArray(revHistory)).toBe(true);
      // Items with revision dates should be sorted descending
      const withDates = revHistory.filter(r => r.lastRevisedAt);
      for (let i = 0; i < withDates.length - 1; i++) {
        expect(withDates[i].lastRevisedAt! >= withDates[i + 1].lastRevisedAt!).toBe(true);
      }
    });
  });

  // ─── 8. Timetable Recurrence Logic ───────────────────────────────
  describe('8. Timetable Recurrence Logic', () => {
    it('expands recurring timetable slots across a date range matching day of week', () => {
      const store = useAcademicStore.getState();
      // Add a Thursday slot
      const slot = store.addTimetableSlot({
        subjectId: 'sub-recur-test',
        semesterId: 'sem-3',
        dayOfWeek: 'thursday',
        startTime: '10:00',
        endTime: '11:00',
        room: 'R-401',
        type: 'lecture',
        isRecurring: true,
      });

      // Oct 1, 2026 to Oct 22, 2026:
      // Oct 1 is Thursday
      // Oct 8 is Thursday
      // Oct 15 is Thursday
      // Oct 22 is Thursday (4 Thursdays)
      const occurrences = store.getAllClassOccurrences('2026-10-01', '2026-10-22');
      const slotOccurrences = occurrences.filter(o => o.slotId === slot.id);

      expect(slotOccurrences.length).toBe(4);
      expect(slotOccurrences.map(o => o.date).sort()).toEqual([
        '2026-10-01',
        '2026-10-08',
        '2026-10-15',
        '2026-10-22',
      ]);
    });

    it('excludes inactive (soft-deleted) slots from recurrence generation', () => {
      const store = useAcademicStore.getState();
      const slot = store.addTimetableSlot({
        subjectId: 'sub-inactive-test',
        semesterId: 'sem-3',
        dayOfWeek: 'monday',
        startTime: '14:00',
        endTime: '15:00',
        room: 'R-Dead',
        type: 'lecture',
        isRecurring: true,
      });

      // Deactivate it
      store.deleteTimetableSlot(slot.id);

      const occurrences = store.getAllClassOccurrences('2026-10-01', '2026-10-31');
      const matches = occurrences.filter(o => o.slotId === slot.id);
      expect(matches.length).toBe(0);
    });

    it('does not generate occurrences for days other than the slot dayOfWeek', () => {
      const store = useAcademicStore.getState();
      const slot = store.addTimetableSlot({
        subjectId: 'sub-monday-only',
        semesterId: 'sem-3',
        dayOfWeek: 'monday',
        startTime: '11:00',
        endTime: '12:00',
        room: 'R-Mon',
        type: 'lecture',
        isRecurring: true,
      });

      // Oct 2, 2026 to Oct 4, 2026: Friday, Saturday, Sunday (no Monday)
      const occurrences = store.getAllClassOccurrences('2026-10-02', '2026-10-04');
      const matches = occurrences.filter(o => o.slotId === slot.id);
      expect(matches.length).toBe(0);
    });
  });
});
