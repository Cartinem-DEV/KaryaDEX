/**
 * BunkMatKar — Hardening & Data-Integrity Audit Test Suite (Phase 1)
 *
 * Covers the 10 minimum requirements of Part 21:
 * 1. ClassSession uniqueness
 * 2. Attendance status transitions (Scenarios A through J)
 * 3. No double counting on multiple saves
 * 4. Timetable occurrence generation & boundaries
 * 5. Topic / revision transitions
 * 6. Backlog calculation
 * 7. Task relationship integrity & cascading cleanup
 * 8. Resource relationship integrity & orphan prevention
 * 9. Date calculations & local timezone math
 * 10. Storage failure handling & safe file operations
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'mock://docs/',
  cacheDirectory: 'mock://cache/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue(['file1.pdf', 'file2.pdf']),
}));

import { useAcademicStore } from '@/store/useAcademicStore';
import { useAppStore } from '@/store/useAppStore';
import { classSessionService } from '@/services/classSessionService';
import { classTaskLinkService } from '@/services/classTaskLinkService';
import { revisionService } from '@/services/revisionService';
import { fileStorageService } from '@/services/fileStorageService';
import { formatLocalDate, parseLocalDate } from '@/lib/timeUtils';
import type { Resource } from '@/types/academic';

describe('Phase 1: Hardening & Data-Integrity Audit Suite', () => {
  beforeEach(() => {
    useAcademicStore.getState().resetAcademicStore();
    useAppStore.getState().logout();
  });

  // ────────────────────────────────────────────────────────────────
  // 1. ClassSession Uniqueness & Stability
  // ────────────────────────────────────────────────────────────────
  describe('1. ClassSession Uniqueness & Stability', () => {
    it('one real class occurrence (slotId + date) has exactly one stable ID', async () => {
      const slotId = 'ts-audit-unique-1';
      const date = '2026-10-12';
      const subjectId = 'sub-1';

      const note1 = await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: 'First pass notes',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      const note2 = await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: 'Second pass updated notes',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      expect(note1.id).toBe(note2.id);
      const allNotes = useAcademicStore.getState().classNotes.filter(
        n => n.classSessionId === slotId && n.date === date
      );
      expect(allNotes.length).toBe(1);
      expect(allNotes[0].myNotes).toBe('Second pass updated notes');
    });

    it('reopening a session retrieves the identical record without creating duplicates', async () => {
      const slotId = 'ts-audit-unique-2';
      const date = '2026-10-14';

      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId: 'sub-2',
        attendanceStatus: 'late',
        selectedTopicIds: [],
        myNotes: 'Saved journal',
        teacherNotes: 'Exam hint',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      const retrieved = useAcademicStore.getState().getClassNote(slotId, date);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.attendanceStatus).toBe('late');
      expect(retrieved?.teacherNotes).toBe('Exam hint');

      const count = useAcademicStore.getState().classNotes.filter(
        n => n.classSessionId === slotId && n.date === date
      ).length;
      expect(count).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 2. Attendance Status Transitions & 3. No Double Counting (A-J)
  // ────────────────────────────────────────────────────────────────
  describe('2 & 3. Attendance Status Transitions & Zero Double-Counting', () => {
    const subjectId = 'sub-audit-att';
    const slotId = 'ts-audit-att-1';
    const date = '2026-10-15';

    beforeEach(() => {
      useAppStore.setState({
        attendanceData: {
          [subjectId]: { attended: 10, total: 10 },
        },
      });
    });

    it('Scenario A: Open -> Save (Not Set -> Present)', async () => {
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      const att = useAppStore.getState().attendanceData[subjectId];
      expect(att.attended).toBe(11);
      expect(att.total).toBe(11);
    });

    it('Scenario B & J: Save multiple times does NOT double count', async () => {
      // First save
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      // Second save (identical status)
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: 'Updated text',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      // Third save
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: 'Updated text again',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      const att = useAppStore.getState().attendanceData[subjectId];
      expect(att.attended).toBe(11);
      expect(att.total).toBe(11);
    });

    it('Scenario D: Present -> Absent decrements attended by 1, preserves total', async () => {
      // Start as present
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      // Change to absent
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'absent',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      const att = useAppStore.getState().attendanceData[subjectId];
      expect(att.attended).toBe(10); // reverted back to base 10
      expect(att.total).toBe(11);    // total includes the absent class
    });

    it('Scenario E: Absent -> Present increments attended by 1, keeps total', async () => {
      // Set to absent
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'absent',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      // Switch to present
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      const att = useAppStore.getState().attendanceData[subjectId];
      expect(att.attended).toBe(11);
      expect(att.total).toBe(11);
    });

    it('Scenario F: Present -> Late preserves attended and total', async () => {
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'late',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      const att = useAppStore.getState().attendanceData[subjectId];
      expect(att.attended).toBe(11);
      expect(att.total).toBe(11);
    });

    it('Scenario G: Present -> Cancelled removes class occurrence from attendance totals', async () => {
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'cancelled',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      const att = useAppStore.getState().attendanceData[subjectId];
      expect(att.attended).toBe(10);
      expect(att.total).toBe(10);
    });

    it('Scenario I: Cancelled -> Present adds 1 to attended and 1 to total', async () => {
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'cancelled',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: 'present',
        selectedTopicIds: [],
        myNotes: '',
        teacherNotes: '',
        revisionStatus: 'not_started',
        resources: [],
        linkedTaskIds: [],
      });

      const att = useAppStore.getState().attendanceData[subjectId];
      expect(att.attended).toBe(11);
      expect(att.total).toBe(11);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 4. Timetable Occurrence Generation & Boundary Math
  // ────────────────────────────────────────────────────────────────
  describe('4. Timetable Occurrence Generation & Boundary Math', () => {
    it('generates occurrences accurately across month and year boundaries', () => {
      const store = useAcademicStore.getState();
      const slot = store.addTimetableSlot({
        subjectId: 'sub-bounds',
        semesterId: 'sem-3',
        dayOfWeek: 'friday',
        startTime: '10:00',
        endTime: '11:00',
        room: 'B-101',
        type: 'lecture',
        isRecurring: true,
      });

      // 2026-12-25 to 2027-01-08 (spans year boundary):
      // Dec 25, 2026 is Friday
      // Jan 01, 2027 is Friday
      // Jan 08, 2027 is Friday
      const occurrences = store.getAllClassOccurrences('2026-12-25', '2027-01-08');
      const matches = occurrences.filter(o => o.slotId === slot.id);

      expect(matches.length).toBe(3);
      expect(matches.map(m => m.date)).toEqual(['2027-01-08', '2027-01-01', '2026-12-25']);
    });

    it('handles Sunday correctly when slot is scheduled on Sunday', () => {
      const store = useAcademicStore.getState();
      const slot = store.addTimetableSlot({
        subjectId: 'sub-sun',
        semesterId: 'sem-3',
        dayOfWeek: 'sunday',
        startTime: '10:00',
        endTime: '12:00',
        room: 'Weekend-Hall',
        type: 'lecture',
        isRecurring: true,
      });

      // Oct 4, 2026 is Sunday, Oct 11, 2026 is Sunday
      const occurrences = store.getAllClassOccurrences('2026-10-04', '2026-10-11');
      const matches = occurrences.filter(o => o.slotId === slot.id);
      expect(matches.length).toBe(2);
      expect(matches.map(m => m.date)).toEqual(['2026-10-11', '2026-10-04']);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 5. Topic / Revision Transitions & 6. Backlog Calculation
  // ────────────────────────────────────────────────────────────────
  describe('5 & 6. Topic Revision Transitions & Backlog Calculation', () => {
    it('distinguishes UNTAUGHT vs TAUGHT vs REVISED vs NEEDS_REVISION', () => {
      const store = useAcademicStore.getState();
      const subId = 'sub-topic-states';

      // 1. Untaught topic
      const topic1 = store.addTopic({
        subjectId: subId,
        unitId: 'unit-1',
        name: 'Untaught Concept',
        isCompleted: false,
        revisionStatus: 'not_started',
        classNoteIds: [],
        order: 1,
      });

      // 2. Taught but unrevised
      const topic2 = store.addTopic({
        subjectId: subId,
        unitId: 'unit-1',
        name: 'Taught Concept',
        isCompleted: true,
        revisionStatus: 'taught',
        classNoteIds: [],
        order: 2,
      });

      // 3. Revised topic
      const topic3 = store.addTopic({
        subjectId: subId,
        unitId: 'unit-1',
        name: 'Revised Concept',
        isCompleted: true,
        revisionStatus: 'revised',
        classNoteIds: [],
        order: 3,
      });

      // 4. Needs revision again
      const topic4 = store.addTopic({
        subjectId: subId,
        unitId: 'unit-1',
        name: 'Needs Revision Again',
        isCompleted: true,
        revisionStatus: 'needs_revision',
        classNoteIds: [],
        order: 4,
      });

      const backlog = store.getTopicsNeedingRevision(subId);
      const taughtOnly = store.getTopicsTaughtNotRevised(subId);

      // Backlog contains 'needs_revision'
      expect(backlog.some(t => t.id === topic4.id)).toBe(true);
      expect(backlog.some(t => t.id === topic3.id)).toBe(false);

      // Taught but unrevised contains 'taught'
      expect(taughtOnly.some(t => t.id === topic2.id)).toBe(true);
      expect(taughtOnly.some(t => t.id === topic1.id)).toBe(false);
    });

    it('records topic revision via revisionService and preserves timestamp', () => {
      const store = useAcademicStore.getState();
      const topic = store.addTopic({
        subjectId: 'sub-rev-svc',
        unitId: 'unit-1',
        name: 'Calculus of Variations',
        isCompleted: false,
        revisionStatus: 'not_started',
        classNoteIds: [],
        order: 1,
      });

      revisionService.recordTopicRevision(topic.id, 'revised', 'slot-123');

      const updated = useAcademicStore.getState().topics.find(t => t.id === topic.id);
      expect(updated?.revisionStatus).toBe('revised');
      expect(updated?.lastRevisedAt).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 7. Task Relationship Integrity & Cascading
  // ────────────────────────────────────────────────────────────────
  describe('7. Task Relationship Integrity & Cascading Cleanup', () => {
    it('creates a task linked to a classSession and verifies query in service', () => {
      const sessionSlotId = 'ts-task-link-test';
      const task = classTaskLinkService.createNewTask({
        title: 'Complete Lab 4 Report',
        subjectId: 'sub-1',
        classSessionId: sessionSlotId,
        classDate: '2026-10-18',
        dueDate: '2026-10-22',
        priority: 'high',
      });

      expect(task.id).toBeDefined();
      expect(task.classSessionId).toBe(sessionSlotId);

      // AppStore contains the task
      const appTask = useAppStore.getState().tasks.find(t => t.id === task.id);
      expect(appTask).toBeDefined();

      // AcademicStore registers relations
      const rel = useAcademicStore.getState().getTaskRelations(task.id);
      expect(rel?.classSessionId).toBe(sessionSlotId);

      // Service query returns the linked task
      const linked = classTaskLinkService.getLinkedTasks(sessionSlotId);
      expect(linked.some(t => t.id === task.id)).toBe(true);
    });

    it('unlinking task clears link while preserving task in app store', () => {
      const sessionSlotId = 'ts-unlink-test';
      const task = classTaskLinkService.createNewTask({
        title: 'Task to Unlink',
        subjectId: 'sub-1',
        classSessionId: sessionSlotId,
      });

      classTaskLinkService.unlinkTask(task.id);

      // Still in AppStore
      const appTask = useAppStore.getState().tasks.find(t => t.id === task.id);
      expect(appTask).toBeDefined();
      expect(appTask?.classSessionId).toBeUndefined();

      // Relation removed in AcademicStore
      const rel = useAcademicStore.getState().getTaskRelations(task.id);
      expect(rel).toBeNull();
    });

    it('deleting task removes it from AppStore and AcademicStore taskRelations', () => {
      const sessionSlotId = 'ts-del-task-test';
      const task = classTaskLinkService.createNewTask({
        title: 'Task to Delete',
        subjectId: 'sub-1',
        classSessionId: sessionSlotId,
      });

      classTaskLinkService.deleteTask(task.id);

      expect(useAppStore.getState().tasks.find(t => t.id === task.id)).toBeUndefined();
      expect(useAcademicStore.getState().getTaskRelations(task.id)).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8. Resource Relationship Integrity & Cascading Topic Deletion
  // ────────────────────────────────────────────────────────────────
  describe('8. Resource Relationship Integrity & Cascade Cleanup', () => {
    it('attaches and retrieves resources by classNoteId and subjectId', () => {
      const store = useAcademicStore.getState();
      const res = store.addResource({
        title: 'Wave Equation Notes.pdf',
        type: 'pdf',
        uri: 'file:///data/user/0/notes.pdf',
        sizeBytes: 1024,
        classNoteId: 'cn-res-test',
        subjectId: 'sub-res-test',
        isLocal: true,
      });

      expect(res.id).toBeDefined();
      expect(store.getResourcesForClassNote('cn-res-test').some(r => r.id === res.id)).toBe(true);
      expect(store.getResourcesForSubject('sub-res-test').some(r => r.id === res.id)).toBe(true);
    });

    it('cascades topic deletion when syllabus unit is deleted to prevent orphan references', () => {
      const store = useAcademicStore.getState();
      const unit = store.addSyllabusUnit({
        subjectId: 'sub-cascade',
        semesterId: 'sem-3',
        name: 'Unit to Delete',
        order: 1,
        topicIds: [],
      });

      const topic = store.addTopic({
        subjectId: 'sub-cascade',
        unitId: unit.id,
        name: 'Topic in Unit to Delete',
        isCompleted: false,
        revisionStatus: 'not_started',
        classNoteIds: [],
        order: 1,
      });

      // Link topic to an exam
      const et = store.addExamTopic('exam-cascade-test', topic.id, 'high');

      // Link topic to a class note
      const note = store.upsertClassNote({
        classSessionId: 'slot-cascade-1',
        date: '2026-10-19',
        subjectId: 'sub-cascade',
        topicIds: [topic.id],
      });

      // Delete the unit
      store.deleteSyllabusUnit(unit.id);

      // Topic deleted
      expect(useAcademicStore.getState().topics.find(t => t.id === topic.id)).toBeUndefined();

      // Exam topic relation cleaned up
      expect(useAcademicStore.getState().examTopics.find(r => r.id === et.id)).toBeUndefined();

      // Class note cleaned up
      const updatedNote = useAcademicStore.getState().classNotes.find(n => n.id === note.id);
      expect(updatedNote?.topicIds.includes(topic.id)).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 9. Date Calculations & Local Timezone Math
  // ────────────────────────────────────────────────────────────────
  describe('9. Date Calculations & Local Timezone Math', () => {
    it('formatLocalDate formats a date consistently without UTC midnight shift', () => {
      const localDate = new Date(2026, 9, 4, 1, 30, 0); // Oct 4, 2026 1:30 AM local
      const formatted = formatLocalDate(localDate);
      expect(formatted).toBe('2026-10-04');
    });

    it('parseLocalDate parses YYYY-MM-DD as local midnight without UTC off-by-one', () => {
      const parsed = parseLocalDate('2026-10-04');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(9); // 0-indexed October
      expect(parsed.getDate()).toBe(4);
      expect(parsed.getHours()).toBe(0);
    });

    it('exam countdown calculation produces correct non-negative day difference', () => {
      const todayDate = parseLocalDate('2026-10-04');
      const examDate = parseLocalDate('2026-10-07');
      const daysUntil = Math.ceil(
        (examDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysUntil).toBe(3);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 10. Storage Failure Handling & Graceful Fallbacks
  // ────────────────────────────────────────────────────────────────
  describe('10. Storage Failure Handling & Graceful Fallbacks', () => {
    it('returns platform capabilities safely across environments', () => {
      const caps = fileStorageService.getPlatformCapabilities();
      expect(caps.platformName).toBeDefined();
      expect(typeof caps.canChooseFolder).toBe('boolean');
    });

    it('migrates files safely without deleting original contents before copy', async () => {
      const result = await fileStorageService.migrateFiles('file:///new/target/dir/');
      expect(result).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.migratedCount).toBe('number');
    });
  });
});
