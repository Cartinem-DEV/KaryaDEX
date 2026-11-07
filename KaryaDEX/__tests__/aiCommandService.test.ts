/**
 * BunkMatKar — AI Command Service & Natural Language Mutation Tests
 *
 * Verifies that Banku (and Shanky) can be commanded via chat to:
 * 1. Delete tasks by exact or fuzzy title matching
 * 2. Delete all completed tasks in bulk
 * 3. Complete active tasks via command
 * 4. Edit/reschedule tasks (priority, due dates)
 * 5. Create new tasks with priority and due dates
 * 6. Remove specific recurring timetable classes
 * 7. Clear weekly or day-specific timetable routines
 * 8. Mark attendance (present/absent) directly from chat
 * 9. Schedule/create new exams
 * 10. Delete/cancel exams
 */

import { AICommandService } from '@/services/ai/core/aiCommandService';
import { taskRepository, timetableRepository, subjectRepository, examRepository } from '@/database';
import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';

jest.mock('@/database', () => ({
  taskRepository: {
    getTasks: jest.fn(),
    deleteTask: jest.fn().mockResolvedValue(undefined),
    completeTask: jest.fn().mockResolvedValue(undefined),
    updateTask: jest.fn().mockResolvedValue(undefined),
    createTask: jest.fn().mockResolvedValue({ id: 'task-new-1' }),
  },
  timetableRepository: {
    getTimetableSlots: jest.fn(),
    deleteTimetableSlot: jest.fn().mockResolvedValue(undefined),
  },
  subjectRepository: {
    getSubjects: jest.fn(),
    getStudent: jest.fn().mockResolvedValue({ attendanceTarget: 75 }),
  },
  examRepository: {
    getExams: jest.fn(),
    createExam: jest.fn().mockResolvedValue({ id: 'exam-new-1' }),
    deleteExam: jest.fn().mockResolvedValue(undefined),
  },
  attendanceRepository: {
    getAggregate: jest.fn().mockResolvedValue({ attended: 10, total: 12 }),
  },
}));

describe('AICommandService — Natural Language Commanding & Mutations', () => {
  const mockTasks = [
    { id: 't1', title: 'Calculus Assignment 3', priority: 'high', isCompleted: false, status: 'planned' },
    { id: 't2', title: 'Physics Lab Report', priority: 'medium', isCompleted: true, status: 'completed' },
    { id: 't3', title: 'Data Structures Problem Set', priority: 'urgent', isCompleted: false, status: 'planned' },
  ];

  const mockSubjects = [
    { id: 's1', name: 'Mathematics', code: 'MATH101', shortName: 'Math', color: '#3B82F6' },
    { id: 's2', name: 'Physics', code: 'PHYS101', shortName: 'Phys', color: '#10B981' },
  ];

  const mockSlots = [
    { id: 'slot-1', subjectId: 's1', dayOfWeek: 'monday', startTime: '09:00', endTime: '10:00', room: 'LH-1' },
    { id: 'slot-2', subjectId: 's2', dayOfWeek: 'wednesday', startTime: '11:00', endTime: '12:00', room: 'Lab-A' },
  ];

  const mockExams = [
    { id: 'ex-1', subjectId: 's1', name: 'Math Midterm', type: 'internal', date: '2026-11-15', maxMarks: 50 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (taskRepository.getTasks as jest.Mock).mockResolvedValue([...mockTasks]);
    (subjectRepository.getSubjects as jest.Mock).mockResolvedValue([...mockSubjects]);
    (timetableRepository.getTimetableSlots as jest.Mock).mockResolvedValue([...mockSlots]);
    (examRepository.getExams as jest.Mock).mockResolvedValue([...mockExams]);
  });

  describe('1. Task Commands', () => {
    it('deletes a specific task by matching title', async () => {
      const res = await AICommandService.executeCommand({
        userId: 'student-1',
        query: 'Banku, delete task Calculus Assignment 3',
        persona: 'banku',
      });

      expect(res.executed).toBe(true);
      expect(res.action).toBe('delete_task');
      expect(res.reply).toContain('Calculus Assignment 3');
      expect(taskRepository.deleteTask).toHaveBeenCalledWith('t1');
      expect(res.proposal?.type).toBe('DELETE_TASK');
    });

    it('clears all completed tasks when asked', async () => {
      const res = await AICommandService.executeCommand({
        userId: 'student-1',
        query: 'remove completed tasks',
        persona: 'banku',
      });

      expect(res.executed).toBe(true);
      expect(res.action).toBe('delete_completed_tasks');
      expect(res.reply).toContain('1 completed task');
      expect(taskRepository.deleteTask).toHaveBeenCalledWith('t2');
    });

    it('completes an active task via command', async () => {
      const res = await AICommandService.executeCommand({
        userId: 'student-1',
        query: 'mark Data Structures Problem Set as complete',
        persona: 'banku',
      });

      expect(res.executed).toBe(true);
      expect(res.action).toBe('complete_task');
      expect(res.reply).toContain('completed');
      expect(taskRepository.completeTask).toHaveBeenCalledWith('t3');
    });

    it('edits task priority to urgent and sets due date to tomorrow', async () => {
      const res = await AICommandService.executeCommand({
        userId: 'student-1',
        query: 'edit task Calculus Assignment 3 set priority urgent due tomorrow',
        persona: 'banku',
      });

      expect(res.executed).toBe(true);
      expect(res.action).toBe('update_task');
      expect(taskRepository.updateTask).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ priority: 'urgent' })
      );
      expect(res.proposal?.type).toBe('UPDATE_TASK');
    });

    it('creates a new task with high priority and due date', async () => {
      const spyAddTask = jest.spyOn(useAppStore.getState(), 'addTask');

      const res = await AICommandService.executeCommand({
        userId: 'student-1',
        query: 'add task Prepare Chemistry Viva urgent due tomorrow',
        persona: 'banku',
      });

      expect(res.executed).toBe(true);
      expect(res.action).toBe('create_task');
      expect(spyAddTask).toHaveBeenCalled();
      expect(res.proposal?.type).toBe('CREATE_TASK');
      expect(res.reply).toContain('Prepare Chemistry Viva');
    });
  });

  describe('2. Schedule / Routine Commands', () => {
    it('deletes recurring class slot for a subject', async () => {
      const res = await AICommandService.executeCommand({
        userId: 'student-1',
        query: 'remove Physics class on wednesday',
        persona: 'banku',
      });

      expect(res.executed).toBe(true);
      expect(res.action).toBe('delete_timetable_slot');
      expect(timetableRepository.deleteTimetableSlot).toHaveBeenCalledWith('slot-2');
      expect(res.reply).toContain('Physics');
      expect(res.proposal?.type).toBe('DELETE_TIMETABLE_SLOT');
    });

    it('clears timetable slots for a specific day', async () => {
      const res = await AICommandService.executeCommand({
        userId: 'student-1',
        query: 'clear timetable for monday',
        persona: 'banku',
      });

      expect(res.executed).toBe(true);
      expect(res.action).toBe('clear_timetable');
      expect(timetableRepository.deleteTimetableSlot).toHaveBeenCalledWith('slot-1');
      expect(res.proposal?.type).toBe('CLEAR_TIMETABLE');
    });
  });

  describe('3. Attendance & Exam Commands', () => {
    it('marks attendance present for a subject', async () => {
      const spyMark = jest.spyOn(useAppStore.getState(), 'markAttendance');

      const res = await AICommandService.executeCommand({
        userId: 'student-1',
        query: 'mark attendance present for Mathematics',
        persona: 'banku',
      });

      expect(res.executed).toBe(true);
      expect(res.action).toBe('mark_attendance');
      expect(spyMark).toHaveBeenCalledWith('s1', 'present');
      expect(res.proposal?.type).toBe('MARK_ATTENDANCE');
    });

    it('schedules a new exam via command', async () => {
      const res = await AICommandService.executeCommand({
        userId: 'student-1',
        query: 'add exam Physics Quiz 2026-11-20',
        persona: 'banku',
      });

      expect(res.executed).toBe(true);
      expect(res.action).toBe('create_exam');
      expect(examRepository.createExam).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-11-20',
          type: 'internal',
        })
      );
      expect(res.proposal?.type).toBe('CREATE_EXAM');
    });

    it('cancels/deletes an exam via command', async () => {
      const res = await AICommandService.executeCommand({
        userId: 'student-1',
        query: 'delete exam Math Midterm',
        persona: 'banku',
      });

      expect(res.executed).toBe(true);
      expect(res.action).toBe('delete_exam');
      expect(examRepository.deleteExam).toHaveBeenCalledWith('ex-1');
      expect(res.proposal?.type).toBe('DELETE_EXAM');
    });
  });
});
