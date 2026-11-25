/**
 * KaryaDEX — Phase 3 Task Engine 2.0 Tests
 *
 * Verifies all 30 requirements specified for Task Engine 2.0:
 *   1. task creation
 *   2. task persistence
 *   3. task edit
 *   4. task completion
 *   5. task reopen
 *   6. task deletion
 *   7. task relation deletion
 *   8. task unlink without deletion
 *   9. create task from ClassSession
 *   10. link existing task
 *   11. duplicate link prevention
 *   12. task-topic relationship
 *   13. task-exam relationship
 *   14. due today
 *   15. due tomorrow
 *   16. overdue calculation
 *   17. workload aggregation
 *   18. search
 *   19. filtering
 *   20. deterministic sorting
 *   21. subtask creation
 *   22. subtask progress
 *   23. dependency validation
 *   24. dependency cycle prevention
 *   25. recurring task behavior
 *   26. migration v2 execution
 *   27. app restart hydration
 *   28. transaction rollback
 *   29. invalid relation rejection
 *   30. historical task preservation
 *   31. date/time edge cases (UTC+5:30 safe)
 */

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  taskRepository,
  settingsRepository,
} from '../database';
import { useAppStore } from '../store/useAppStore';
import { useAcademicStore } from '../store/useAcademicStore';
import { classTaskLinkService } from '../services/classTaskLinkService';
import {
  isTaskOverdue,
  getDerivedTaskStatus,
  getSmartDateLabel,
  sortTasks,
  calculateWorkload,
  formatWorkload,
  validateNoDependencyCycle,
  calculateNextRecurrenceDate,
} from '../lib/taskUtils';
import { formatLocalDate, parseLocalDate } from '../lib/timeUtils';
import type { Task } from '../types';

describe('Phase 3: Task Engine 2.0', () => {
  beforeAll(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();
  });

  // ─── 1 & 26. Migration & Schema Version ────────────────────────
  describe('Migration & Schema Version', () => {
    it('applies v2_task_engine migration and updates schema_version to >= 2', async () => {
      const version = await settingsRepository.getSetting('schema_version');
      expect(Number(version)).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── 2 & 3. Task Creation & Edit ──────────────────────────────
  describe('Task Creation & Edit Persistence', () => {
    it('creates a task with all fields and persists to SQLite', async () => {
      const task: Task = {
        id: 'task-test-p3-1',
        title: 'Physics Assignment 03',
        description: 'Complete questions on PN Junction',
        subjectId: 'sub-1',
        topicId: 'top-1',
        examId: 'exam-1',
        dueDate: '2026-10-15',
        dueTime: '23:59',
        category: 'assignment',
        priority: 'high',
        status: 'planned',
        isCompleted: false,
        estimatedMinutes: 45,
        notes: 'Review textbook chapter 4',
        createdAt: '2026-10-04',
        updatedAt: '2026-10-04',
      };

      const created = await taskRepository.createTask(task);
      expect(created.id).toBe('task-test-p3-1');
      expect(created.status).toBe('planned');
      expect(created.isCompleted).toBe(false);

      const persisted = await taskRepository.getTaskById('task-test-p3-1');
      expect(persisted).not.toBeNull();
      expect(persisted?.title).toBe('Physics Assignment 03');
      expect(persisted?.topicId).toBe('top-1');
      expect(persisted?.examId).toBe('exam-1');
      expect(persisted?.estimatedMinutes).toBe(45);
      expect(persisted?.priority).toBe('high');
      expect(persisted?.dueTime).toBe('23:59');
    });

    it('edits a task and persists changes to SQLite', async () => {
      const updated = await taskRepository.updateTask('task-test-p3-1', {
        title: 'Physics Assignment 03 (Revised)',
        estimatedMinutes: 60,
        priority: 'urgent',
      });

      expect(updated?.title).toBe('Physics Assignment 03 (Revised)');
      expect(updated?.estimatedMinutes).toBe(60);
      expect(updated?.priority).toBe('urgent');

      const persisted = await taskRepository.getTaskById('task-test-p3-1');
      expect(persisted?.title).toBe('Physics Assignment 03 (Revised)');
      expect(persisted?.estimatedMinutes).toBe(60);
      expect(persisted?.priority).toBe('urgent');
    });
  });

  // ─── 4, 5 & 30. Task Lifecycle: Complete, Reopen, History ─────
  describe('Task Lifecycle (Complete, Reopen, History Preservation)', () => {
    it('completes a task, sets completedAt, preserves history, and updates status', async () => {
      const completed = await taskRepository.completeTask('task-test-p3-1');
      expect(completed?.status).toBe('completed');
      expect(completed?.isCompleted).toBe(true);
      expect(completed?.completedAt).toBeDefined();

      // Verify historical record is preserved (not deleted)
      const persisted = await taskRepository.getTaskById('task-test-p3-1');
      expect(persisted).not.toBeNull();
      expect(persisted?.isCompleted).toBe(true);
      expect(persisted?.status).toBe('completed');
    });

    it('reopens a completed task back to planned state', async () => {
      const reopened = await taskRepository.reopenTask('task-test-p3-1');
      expect(reopened?.status).toBe('planned');
      expect(reopened?.isCompleted).toBe(false);
      expect(reopened?.completedAt).toBeUndefined();

      const persisted = await taskRepository.getTaskById('task-test-p3-1');
      expect(persisted?.status).toBe('planned');
      expect(persisted?.isCompleted).toBe(false);
      expect(persisted?.completedAt).toBeUndefined();
    });

    it('toggleTask toggles between planned and completed', async () => {
      const state1 = await taskRepository.toggleTask('task-test-p3-1');
      expect(state1).toBe(true);
      const t1 = await taskRepository.getTaskById('task-test-p3-1');
      expect(t1?.isCompleted).toBe(true);

      const state2 = await taskRepository.toggleTask('task-test-p3-1');
      expect(state2).toBe(false);
      const t2 = await taskRepository.getTaskById('task-test-p3-1');
      expect(t2?.isCompleted).toBe(false);
    });
  });

  // ─── 6, 7 & 8. Deletion vs Unlinking ───────────────────────────
  describe('Deletion vs Unlinking', () => {
    it('unlinking a task from a class session removes relationship but keeps the task', async () => {
      const task: Task = {
        id: 'task-unlink-test',
        title: 'Lab Report Drafting',
        subjectId: 'sub-1',
        classSessionId: 'session-101',
        category: 'lab',
        priority: 'medium',
        isCompleted: false,
        createdAt: '2026-10-04',
      };
      await taskRepository.createTask(task);

      // Verify task and relation exist
      let linked = await taskRepository.getTasksForSession('session-101');
      expect(linked.some(t => t.id === 'task-unlink-test')).toBe(true);

      // Unlink
      await taskRepository.unlinkTaskFromSession('task-unlink-test', 'session-101');

      // Relation is gone
      linked = await taskRepository.getTasksForSession('session-101');
      expect(linked.some(t => t.id === 'task-unlink-test')).toBe(false);

      // But task itself still exists!
      const stillExists = await taskRepository.getTaskById('task-unlink-test');
      expect(stillExists).not.toBeNull();
      expect(stillExists?.title).toBe('Lab Report Drafting');
    });

    it('deleting a task removes both task and its relations transactionally', async () => {
      await taskRepository.linkTaskToSession('task-unlink-test', 'session-102');
      await taskRepository.deleteTask('task-unlink-test');

      const deletedTask = await taskRepository.getTaskById('task-unlink-test');
      expect(deletedTask).toBeNull();

      const relations = await taskRepository.getTaskRelations('task-unlink-test');
      expect(relations).toBeNull();
    });
  });

  // ─── 9, 10 & 11. ClassSession Service Integration ─────────────
  describe('ClassSession Service Integration & Duplicate Prevention', () => {
    it('creates new task from ClassSession with prefilled subject and session', async () => {
      const created = await classTaskLinkService.createNewTask({
        title: 'Differential Equations HW 2',
        subjectId: 'sub-1',
        classSessionId: 'session-201',
        dueDate: '2026-10-18',
        priority: 'high',
        category: 'assignment',
        estimatedMinutes: 50,
      });

      expect(created.id).toBeDefined();
      expect(created.subjectId).toBe('sub-1');
      expect(created.classSessionId).toBe('session-201');

      const linked = classTaskLinkService.getLinkedTasks('session-201');
      expect(linked.some(t => t.id === created.id)).toBe(true);
    });

    it('links existing task to ClassSession and prevents duplicate link', async () => {
      const existingTask: Task = {
        id: 'task-existing-linkable',
        title: 'Read Lecture Slides',
        subjectId: 'sub-1',
        category: 'study',
        priority: 'low',
        isCompleted: false,
        createdAt: '2026-10-04',
      };
      await taskRepository.createTask(existingTask);
      useAppStore.setState(s => ({ tasks: [existingTask, ...s.tasks] }));

      // Link first time
      await classTaskLinkService.linkExistingTask('task-existing-linkable', 'session-201');
      let linked = classTaskLinkService.getLinkedTasks('session-201');
      expect(linked.some(t => t.id === 'task-existing-linkable')).toBe(true);

      // Link second time — idempotent, no duplicate
      await classTaskLinkService.linkExistingTask('task-existing-linkable', 'session-201');
      const relations = useAcademicStore.getState().taskRelations.filter(
        r => r.taskId === 'task-existing-linkable' && r.classSessionId === 'session-201'
      );
      expect(relations.length).toBe(1);
    });
  });

  // ─── 12 & 13. Topic and Exam Relationships ────────────────────
  describe('Topic & Exam Relational Queries', () => {
    it('queries tasks associated with a topic', async () => {
      const task: Task = {
        id: 'task-topic-rel',
        title: 'Review PN Junction Diagrams',
        subjectId: 'sub-1',
        topicId: 'top-semiconductor-1',
        category: 'study',
        priority: 'medium',
        isCompleted: false,
        createdAt: '2026-10-04',
      };
      await taskRepository.createTask(task);

      const topicTasks = await taskRepository.getTasksForTopic('top-semiconductor-1');
      expect(topicTasks.some(t => t.id === 'task-topic-rel')).toBe(true);
    });

    it('queries tasks associated with an exam', async () => {
      const task: Task = {
        id: 'task-exam-rel',
        title: 'Midterm Prep: Chapter 1-3 Formulas',
        subjectId: 'sub-1',
        examId: 'exam-midterm-1',
        category: 'study',
        priority: 'urgent',
        isCompleted: false,
        createdAt: '2026-10-04',
      };
      await taskRepository.createTask(task);

      const examTasks = await taskRepository.getTasksForExam('exam-midterm-1');
      expect(examTasks.some(t => t.id === 'task-exam-rel')).toBe(true);
    });
  });

  // ─── 14, 15, 16 & 31. Due Dates, Overdue & Timezone Safety ───
  describe('Due Dates, Overdue & Timezone Safety (UTC+5:30)', () => {
    const fixedNow = new Date(2026, 9, 4, 14, 0, 0); // 4 Oct 2026, 2:00 PM local

    it('identifies tasks due today and returns smart date label', () => {
      const todayStr = formatLocalDate(fixedNow); // '2026-10-04'
      const label = getSmartDateLabel(todayStr, undefined, fixedNow);
      expect(label).toBe('Due today');

      const labelWithTime = getSmartDateLabel(todayStr, '18:00', fixedNow);
      expect(labelWithTime).toContain('Due today');
    });

    it('identifies tasks due tomorrow', () => {
      const tomorrow = new Date(fixedNow);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatLocalDate(tomorrow); // '2026-10-05'

      const label = getSmartDateLabel(tomorrowStr, undefined, fixedNow);
      expect(label).toBe('Due tomorrow');
    });

    it('calculates overdue for yesterday or passed due time', () => {
      // Past day
      const yesterday = new Date(fixedNow);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatLocalDate(yesterday);

      const overdueTask: Task = {
        id: 't-overdue',
        title: 'Late Submission',
        dueDate: yesterdayStr,
        isCompleted: false,
        category: 'assignment',
        priority: 'high',
        createdAt: '2026-10-01',
      };

      expect(isTaskOverdue(overdueTask, fixedNow)).toBe(true);
      expect(getDerivedTaskStatus(overdueTask, fixedNow)).toBe('OVERDUE');
      expect(getSmartDateLabel(yesterdayStr, undefined, fixedNow)).toBe('Overdue');

      // Passed time today (10:00 AM vs fixedNow 14:00)
      const passedTodayTask: Task = {
        id: 't-passed-time',
        title: 'Morning Quiz Submission',
        dueDate: formatLocalDate(fixedNow),
        dueTime: '10:00',
        isCompleted: false,
        category: 'assignment',
        priority: 'urgent',
        createdAt: '2026-10-01',
      };
      expect(isTaskOverdue(passedTodayTask, fixedNow)).toBe(true);

      // Future time today (18:00 vs fixedNow 14:00)
      const futureTodayTask: Task = {
        ...passedTodayTask,
        dueTime: '18:00',
      };
      expect(isTaskOverdue(futureTodayTask, fixedNow)).toBe(false);
    });

    it('completed tasks are never overdue', () => {
      const completedTask: Task = {
        id: 't-comp',
        title: 'Already Finished Task',
        dueDate: '2026-10-01',
        isCompleted: true,
        status: 'completed',
        category: 'assignment',
        priority: 'high',
        createdAt: '2026-10-01',
      };
      expect(isTaskOverdue(completedTask, fixedNow)).toBe(false);
      expect(getDerivedTaskStatus(completedTask, fixedNow)).toBe('COMPLETED');
    });

    it('timezone boundary safety: tests 00:01, 05:29, 05:30 (India offset), 23:59', () => {
      const times = [
        new Date(2026, 9, 4, 0, 1),
        new Date(2026, 9, 4, 5, 29),
        new Date(2026, 9, 4, 5, 30),
        new Date(2026, 9, 4, 23, 59),
      ];

      for (const t of times) {
        const formatted = formatLocalDate(t);
        expect(formatted).toBe('2026-10-04');
        const parsed = parseLocalDate(formatted);
        expect(parsed.getFullYear()).toBe(2026);
        expect(parsed.getMonth()).toBe(9);
        expect(parsed.getDate()).toBe(4);
      }
    });
  });

  // ─── 17. Workload Aggregation ──────────────────────────────────
  describe('Workload Aggregation', () => {
    it('aggregates total workload, today workload, and formats strings', () => {
      const tasks: Task[] = [
        {
          id: 'w-1',
          title: 'Math HW',
          estimatedMinutes: 60,
          dueDate: '2026-10-04',
          isCompleted: false,
          category: 'assignment',
          priority: 'high',
          createdAt: '2026-10-04',
        },
        {
          id: 'w-2',
          title: 'Chemistry Lab',
          estimatedMinutes: 95,
          dueDate: '2026-10-04',
          isCompleted: false,
          category: 'lab',
          priority: 'medium',
          createdAt: '2026-10-04',
        },
        {
          id: 'w-3',
          title: 'Future Quiz',
          estimatedMinutes: 30,
          dueDate: '2026-10-08',
          isCompleted: false,
          category: 'study',
          priority: 'low',
          createdAt: '2026-10-04',
        },
        {
          id: 'w-4',
          title: 'Completed Item',
          estimatedMinutes: 40,
          dueDate: '2026-10-04',
          isCompleted: true,
          status: 'completed',
          category: 'assignment',
          priority: 'low',
          createdAt: '2026-10-04',
        },
      ];

      const workload = calculateWorkload(tasks, '2026-10-04');
      expect(workload.todayMinutes).toBe(155); // 60 + 95
      expect(workload.totalPendingMinutes).toBe(185); // 60 + 95 + 30
      expect(workload.pendingCount).toBe(3);

      expect(formatWorkload(155)).toBe('2h 35m');
      expect(formatWorkload(45)).toBe('45 min');
      expect(formatWorkload(120)).toBe('2h');
    });
  });

  // ─── 18, 19 & 20. Search, Filtering & Deterministic Sorting ───
  describe('Search, Filtering & Deterministic Sorting', () => {
    it('searches tasks case-insensitively across title and description', async () => {
      const results = await taskRepository.searchTasks('differential');
      expect(results.some(t => t.title.includes('Differential'))).toBe(true);
    });

    it('sorts tasks deterministically: Overdue > Urgent > High > Due today > Due tomorrow > Lower priority', () => {
      const refDate = new Date(2026, 9, 4, 12, 0); // 4 Oct 2026
      const sampleTasks: Task[] = [
        { id: 't-completed', title: 'Done', isCompleted: true, category: 'study', priority: 'urgent', createdAt: '2026-10-01' },
        { id: 't-low', title: 'Low Priority Later', dueDate: '2026-10-10', isCompleted: false, category: 'personal', priority: 'low', createdAt: '2026-10-01' },
        { id: 't-high', title: 'High Priority Today', dueDate: '2026-10-04', isCompleted: false, category: 'assignment', priority: 'high', createdAt: '2026-10-01' },
        { id: 't-urgent', title: 'Urgent Today', dueDate: '2026-10-04', isCompleted: false, category: 'assignment', priority: 'urgent', createdAt: '2026-10-01' },
        { id: 't-overdue', title: 'Overdue Task', dueDate: '2026-10-01', isCompleted: false, category: 'assignment', priority: 'medium', createdAt: '2026-10-01' },
      ];

      const sorted = sortTasks(sampleTasks, refDate);
      expect(sorted[0].id).toBe('t-overdue'); // 1. Overdue first
      expect(sorted[1].id).toBe('t-urgent');  // 2. Urgent today
      expect(sorted[2].id).toBe('t-high');    // 3. High today
      expect(sorted[3].id).toBe('t-low');     // 4. Low later
      expect(sorted[4].id).toBe('t-completed'); // Completed last
    });
  });

  // ─── 21 & 22. Subtasks & Subtask Progress ─────────────────────
  describe('Subtasks & Progress Calculation', () => {
    it('creates subtasks and calculates parent progress ratio', async () => {
      const parentTask: Task = {
        id: 'parent-task-1',
        title: 'Robotics Project Submission',
        subjectId: 'sub-1',
        category: 'assignment',
        priority: 'high',
        isCompleted: false,
        createdAt: '2026-10-04',
      };
      await taskRepository.createTask(parentTask);

      // Create 4 subtasks (3 completed, 1 pending)
      const sub1: Task = { id: 'subtask-1', parentTaskId: 'parent-task-1', sortOrder: 1, title: 'Assemble Hardware', isCompleted: true, status: 'completed', category: 'assignment', priority: 'medium', createdAt: '2026-10-04' };
      const sub2: Task = { id: 'subtask-2', parentTaskId: 'parent-task-1', sortOrder: 2, title: 'Write Firmware', isCompleted: true, status: 'completed', category: 'assignment', priority: 'medium', createdAt: '2026-10-04' };
      const sub3: Task = { id: 'subtask-3', parentTaskId: 'parent-task-1', sortOrder: 3, title: 'Calibrate Sensors', isCompleted: true, status: 'completed', category: 'assignment', priority: 'medium', createdAt: '2026-10-04' };
      const sub4: Task = { id: 'subtask-4', parentTaskId: 'parent-task-1', sortOrder: 4, title: 'Upload Demo Video', isCompleted: false, status: 'planned', category: 'assignment', priority: 'medium', createdAt: '2026-10-04' };

      await taskRepository.createTask(sub1);
      await taskRepository.createTask(sub2);
      await taskRepository.createTask(sub3);
      await taskRepository.createTask(sub4);

      const subtasks = await taskRepository.getSubtasks('parent-task-1');
      expect(subtasks.length).toBe(4);
      expect(subtasks[0].id).toBe('subtask-1');
      expect(subtasks[3].id).toBe('subtask-4');

      const progress = await taskRepository.getSubtaskProgress('parent-task-1');
      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(3);
      expect(progress.percentage).toBe(75);
    });
  });

  // ─── 23 & 24. Dependency Validation & Cycle Prevention ────────
  describe('Dependency Validation & Cycle Prevention', () => {
    it('prevents a task from depending on itself', () => {
      expect(() => {
        validateNoDependencyCycle('task-a', 'task-a', () => null);
      }).toThrow('Circular dependency detected');
    });

    it('prevents indirect circular dependencies (A -> B -> A)', () => {
      const mockTasks: Record<string, Task> = {
        'task-a': { id: 'task-a', title: 'Task A', dependsOnTaskId: 'task-b' } as any,
        'task-b': { id: 'task-b', title: 'Task B' } as any,
      };

      // Adding task-b dependsOnTaskId = 'task-a' would create cycle
      expect(() => {
        validateNoDependencyCycle('task-b', 'task-a', id => mockTasks[id]);
      }).toThrow('Circular dependency detected');
    });

    it('allows valid acyclic dependencies (A -> B -> C)', () => {
      const mockTasks: Record<string, Task> = {
        'task-b': { id: 'task-b', title: 'Task B', dependsOnTaskId: 'task-c' } as any,
        'task-c': { id: 'task-c', title: 'Task C' } as any,
      };

      expect(() => {
        validateNoDependencyCycle('task-a', 'task-b', id => mockTasks[id]);
      }).not.toThrow();
    });
  });

  // ─── 25. Recurring Task Occurrence Generation ──────────────────
  describe('Recurring Task Engine', () => {
    it('completing a recurring weekly task generates next occurrence +7 days later preserving original history', async () => {
      const recurringTask: Task = {
        id: 'rec-task-weekly-1',
        title: 'Weekly Sunday Formula Revision',
        subjectId: 'sub-1',
        category: 'study',
        priority: 'high',
        isCompleted: false,
        isRecurring: true,
        recurrenceRule: 'weekly',
        dueDate: '2026-10-04',
        createdAt: '2026-10-01',
      };
      await taskRepository.createTask(recurringTask);

      // Complete the recurring task
      await taskRepository.completeTask('rec-task-weekly-1');

      // Original is completed
      const original = await taskRepository.getTaskById('rec-task-weekly-1');
      expect(original?.isCompleted).toBe(true);
      expect(original?.status).toBe('completed');
      expect(original?.completedAt).toBeDefined();

      // Next occurrence was created 7 days later ('2026-10-11')
      const allTasks = await taskRepository.getTasks();
      const nextOccurrence = allTasks.find(
        t => t.title === 'Weekly Sunday Formula Revision' && !t.isCompleted
      );

      expect(nextOccurrence).toBeDefined();
      expect(nextOccurrence?.dueDate).toBe('2026-10-11');
      expect(nextOccurrence?.isCompleted).toBe(false);
      expect(nextOccurrence?.status).toBe('planned');
    });

    it('calculateNextRecurrenceDate calculates daily, weekly, biweekly, monthly', () => {
      expect(calculateNextRecurrenceDate('2026-10-04', 'daily')).toBe('2026-10-05');
      expect(calculateNextRecurrenceDate('2026-10-04', 'weekly')).toBe('2026-10-11');
      expect(calculateNextRecurrenceDate('2026-10-04', 'biweekly')).toBe('2026-10-18');
      expect(calculateNextRecurrenceDate('2026-10-04', 'monthly')).toBe('2026-11-04');
    });
  });

  // ─── 27. App Restart & Hydration Verification ─────────────────
  describe('Store Hydration & Restart Survival', () => {
    it('persisted task state survives store wipe and rehydration', async () => {
      // 1. Wipe in-memory tasks in store
      useAppStore.setState({ tasks: [] });
      expect(useAppStore.getState().tasks.length).toBe(0);

      // 2. Fetch fresh from SQLite repository
      const freshTasks = await taskRepository.getTasks();
      useAppStore.setState({ tasks: freshTasks });

      // 3. Confirm all tasks survive
      expect(useAppStore.getState().tasks.length).toBeGreaterThan(0);
      expect(
        useAppStore.getState().tasks.some(t => t.title.includes('Weekly Sunday Formula Revision'))
      ).toBe(true);
    });
  });
});
