/**
 * KaryaDEX — Tasks & Task Relations Repository (Task Engine 2.0)
 *
 * Implements:
 * - Full relational persistence for Task ↔ Subject ↔ ClassSession ↔ Topic ↔ Exam ↔ Resource
 * - Target queries (pending, completed, overdue, today, by subject, by session, by topic, by exam)
 * - Workload aggregations
 * - Subtasks & progress
 * - Recurrence next-occurrence generation
 * - Transactional deletes & unlinking
 * - Dependency cycle validation
 */

import { getDatabaseConnection } from '../db';
import type { TaskRow, TaskRelationRow } from '../types';
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '@/types';
import type { TaskRelations } from '@/types/academic';
import { formatLocalDate } from '@/lib/timeUtils';
import {
  isTaskOverdue,
  calculateWorkload,
  calculateNextRecurrenceDate,
  validateNoDependencyCycle,
  sortTasks,
  type WorkloadSummary,
} from '@/lib/taskUtils';

export class TaskRepository {
  async getTasks(): Promise<Task[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks ORDER BY is_completed ASC, due_date ASC, created_at DESC;`
    );
    const mapped = rows.map(r => this.mapTaskRow(r));
    return sortTasks(mapped);
  }

  async getTaskById(id: string): Promise<Task | null> {
    const db = await getDatabaseConnection();
    const r = await db.getFirstAsync<TaskRow>(
      `SELECT * FROM tasks WHERE id = ?;`,
      [id]
    );
    return r ? this.mapTaskRow(r) : null;
  }

  async getPendingTasks(): Promise<Task[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks WHERE is_completed = 0 ORDER BY due_date ASC, created_at DESC;`
    );
    return rows.map(r => this.mapTaskRow(r));
  }

  async getCompletedTasks(): Promise<Task[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks WHERE is_completed = 1 ORDER BY completed_at DESC, updated_at DESC;`
    );
    return rows.map(r => this.mapTaskRow(r));
  }

  async getOverdueTasks(now: Date = new Date()): Promise<Task[]> {
    const pending = await this.getPendingTasks();
    return pending.filter(t => isTaskOverdue(t, now));
  }

  async getTasksDueToday(now: Date = new Date()): Promise<Task[]> {
    const today = formatLocalDate(now);
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks WHERE due_date = ? AND is_completed = 0;`,
      [today]
    );
    return rows.map(r => this.mapTaskRow(r));
  }

  async getTasksDueBetween(startDate: string, endDate: string): Promise<Task[]> {
    const all = await this.getTasks();
    return all.filter(t => t.dueDate && t.dueDate >= startDate && t.dueDate <= endDate);
  }

  async getTasksForSubject(subjectId: string): Promise<Task[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks WHERE subject_id = ? ORDER BY is_completed ASC, due_date ASC;`,
      [subjectId]
    );
    return rows.map(r => this.mapTaskRow(r));
  }

  async getTasksForSession(classSessionId: string): Promise<Task[]> {
    const db = await getDatabaseConnection();
    // 1. Get task IDs linked via task_relations
    const relations = await db.getAllAsync<{ task_id: string }>(
      `SELECT task_id FROM task_relations WHERE class_session_id = ?;`,
      [classSessionId]
    );
    const relationTaskIds = new Set(relations.map(r => r.task_id));

    // 2. Get tasks directly associated via class_session_id
    const directRows = await db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks WHERE class_session_id = ?;`,
      [classSessionId]
    );

    const taskMap = new Map<string, Task>();
    for (const row of directRows) {
      const task = this.mapTaskRow(row);
      taskMap.set(task.id, task);
    }

    for (const taskId of relationTaskIds) {
      if (!taskMap.has(taskId)) {
        const task = await this.getTaskById(taskId);
        if (task) {
          taskMap.set(task.id, task);
        }
      }
    }

    const tasks = Array.from(taskMap.values());
    return sortTasks(tasks);
  }

  async getTasksForTopic(topicId: string): Promise<Task[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks WHERE topic_id = ? ORDER BY is_completed ASC, due_date ASC;`,
      [topicId]
    );
    return rows.map(r => this.mapTaskRow(r));
  }

  async getTasksForExam(examId: string): Promise<Task[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks WHERE exam_id = ? ORDER BY is_completed ASC, due_date ASC;`,
      [examId]
    );
    return rows.map(r => this.mapTaskRow(r));
  }

  async getHighPriorityTasks(): Promise<Task[]> {
    const pending = await this.getPendingTasks();
    return pending.filter(t => t.priority === 'urgent' || t.priority === 'high');
  }

  async getSubtasks(parentTaskId: string): Promise<Task[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY sort_order ASC, created_at ASC;`,
      [parentTaskId]
    );
    return rows.map(r => this.mapTaskRow(r));
  }

  async getSubtaskProgress(parentTaskId: string): Promise<{ total: number; completed: number; percentage: number }> {
    const subtasks = await this.getSubtasks(parentTaskId);
    const total = subtasks.length;
    if (total === 0) return { total: 0, completed: 0, percentage: 0 };
    const completed = subtasks.filter(s => s.isCompleted || s.status === 'completed').length;
    const percentage = Math.round((completed / total) * 100);
    return { total, completed, percentage };
  }

  async getWorkloadSummary(date: string = formatLocalDate(new Date())): Promise<WorkloadSummary> {
    const all = await this.getTasks();
    return calculateWorkload(all, date);
  }

  async searchTasks(query: string): Promise<Task[]> {
    if (!query || !query.trim()) return this.getTasks();
    const q = query.trim().toLowerCase();
    const all = await this.getTasks();
    return all.filter(t => {
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description ? t.description.toLowerCase().includes(q) : false;
      const matchNotes = t.notes ? t.notes.toLowerCase().includes(q) : false;
      const matchCategory = t.category.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchNotes || matchCategory;
    });
  }

  async createTask(task: Task): Promise<Task> {
    const db = await getDatabaseConnection();
    const now = formatLocalDate();

    // Validate dependency cycle if dependsOnTaskId is set
    if (task.dependsOnTaskId) {
      const allTasks = await this.getTasks();
      const taskMap = new Map(allTasks.map(t => [t.id, t]));
      validateNoDependencyCycle(task.id, task.dependsOnTaskId, id => taskMap.get(id));
    }

    const taskStatus = task.status || (task.isCompleted ? 'completed' : 'planned');
    const isCompleted = taskStatus === 'completed' || task.isCompleted ? 1 : 0;
    const completedAt = isCompleted ? (task.completedAt || now) : null;

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO tasks (
          id, title, description, subject_id, class_session_id, class_date, topic_id, exam_id,
          resource_id, due_date, due_time, category, priority, status, estimated_minutes,
          is_completed, completed_at, notes, parent_task_id, sort_order, depends_on_task_id,
          recurrence_rule, recurrence_end_date, scheduled_date, scheduled_start_time,
          scheduled_end_time, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          task.id,
          task.title.trim(),
          task.description || null,
          task.subjectId || null,
          task.classSessionId || null,
          task.classDate || null,
          task.topicId || null,
          task.examId || null,
          task.resourceId || null,
          task.dueDate || null,
          task.dueTime || null,
          task.category || 'assignment',
          task.priority || 'medium',
          taskStatus,
          task.estimatedMinutes || 30,
          isCompleted,
          completedAt,
          task.notes || null,
          task.parentTaskId || null,
          task.sortOrder || 0,
          task.dependsOnTaskId || null,
          task.recurrenceRule || null,
          task.recurrenceEndDate || null,
          task.scheduledDate || null,
          task.scheduledStartTime || null,
          task.scheduledEndTime || null,
          task.createdAt || now,
          task.updatedAt || now,
        ]
      );

      // Register relation in task_relations if classSessionId is present
      if (task.classSessionId) {
        await db.runAsync(
          `INSERT INTO task_relations (id, task_id, class_session_id, class_date, class_note_id, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(task_id, class_session_id) DO UPDATE SET
             class_date = excluded.class_date;`,
          [
            `tr-${task.id}-${task.classSessionId}`,
            task.id,
            task.classSessionId,
            task.classDate || null,
            null,
          ]
        );
      }
    });

    return {
      ...task,
      status: taskStatus as TaskStatus,
      isCompleted: isCompleted === 1,
      completedAt: completedAt || undefined,
    };
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const db = await getDatabaseConnection();
    const current = await this.getTaskById(id);
    if (!current) return null;

    const merged = { ...current, ...updates };

    if (updates.dependsOnTaskId) {
      const allTasks = await this.getTasks();
      const taskMap = new Map(allTasks.map(t => [t.id, t]));
      validateNoDependencyCycle(id, updates.dependsOnTaskId, tId => taskMap.get(tId));
    }

    const taskStatus = updates.status || (updates.isCompleted !== undefined ? (updates.isCompleted ? 'completed' : 'planned') : merged.status || 'planned');
    const isCompleted = taskStatus === 'completed' || merged.isCompleted ? 1 : 0;
    const completedAt = isCompleted ? (merged.completedAt || formatLocalDate()) : null;

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE tasks SET
          title = ?,
          description = ?,
          subject_id = ?,
          class_session_id = ?,
          class_date = ?,
          topic_id = ?,
          exam_id = ?,
          resource_id = ?,
          due_date = ?,
          due_time = ?,
          category = ?,
          priority = ?,
          status = ?,
          estimated_minutes = ?,
          is_completed = ?,
          completed_at = ?,
          notes = ?,
          parent_task_id = ?,
          sort_order = ?,
          depends_on_task_id = ?,
          recurrence_rule = ?,
          recurrence_end_date = ?,
          scheduled_date = ?,
          scheduled_start_time = ?,
          scheduled_end_time = ?,
          updated_at = datetime('now')
         WHERE id = ?;`,
        [
          merged.title.trim(),
          merged.description || null,
          merged.subjectId || null,
          merged.classSessionId || null,
          merged.classDate || null,
          merged.topicId || null,
          merged.examId || null,
          merged.resourceId || null,
          merged.dueDate || null,
          merged.dueTime || null,
          merged.category,
          merged.priority,
          taskStatus,
          merged.estimatedMinutes || 30,
          isCompleted,
          completedAt,
          merged.notes || null,
          merged.parentTaskId || null,
          merged.sortOrder || 0,
          merged.dependsOnTaskId || null,
          merged.recurrenceRule || null,
          merged.recurrenceEndDate || null,
          merged.scheduledDate || null,
          merged.scheduledStartTime || null,
          merged.scheduledEndTime || null,
          id,
        ]
      );

      if (merged.classSessionId) {
        await db.runAsync(
          `INSERT INTO task_relations (id, task_id, class_session_id, class_date, class_note_id, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(task_id, class_session_id) DO UPDATE SET
             class_date = excluded.class_date;`,
          [
            `tr-${id}-${merged.classSessionId}`,
            id,
            merged.classSessionId,
            merged.classDate || null,
            null,
          ]
        );
      }
    });

    return {
      ...merged,
      status: taskStatus as TaskStatus,
      isCompleted: isCompleted === 1,
      completedAt: completedAt || undefined,
    };
  }

  async completeTask(id: string): Promise<Task | null> {
    const current = await this.getTaskById(id);
    if (!current) return null;

    const now = formatLocalDate();
    const updated = await this.updateTask(id, {
      status: 'completed',
      isCompleted: true,
      completedAt: now,
    });

    // If recurring task: spawn next occurrence preserving original history
    if (current.isRecurring && current.recurrenceRule && current.dueDate) {
      const nextDueDate = calculateNextRecurrenceDate(current.dueDate, current.recurrenceRule);
      const nextTask: Task = {
        ...current,
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dueDate: nextDueDate,
        status: 'planned',
        isCompleted: false,
        completedAt: undefined,
        createdAt: now,
        updatedAt: now,
      };
      await this.createTask(nextTask);
    }

    return updated;
  }

  async reopenTask(id: string): Promise<Task | null> {
    return this.updateTask(id, {
      status: 'planned',
      isCompleted: false,
      completedAt: undefined,
    });
  }

  async toggleTask(id: string): Promise<boolean> {
    const current = await this.getTaskById(id);
    if (!current) return false;

    if (current.isCompleted || current.status === 'completed') {
      await this.reopenTask(id);
      return false;
    } else {
      await this.completeTask(id);
      return true;
    }
  }

  async deleteTask(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.withTransactionAsync(async () => {
      // 1. Delete relations
      await db.runAsync(`DELETE FROM task_relations WHERE task_id = ?;`, [id]);
      // 2. Cascade delete subtasks
      await db.runAsync(`DELETE FROM tasks WHERE parent_task_id = ?;`, [id]);
      // 3. Clear dependency references where depends_on_task_id = id
      await db.runAsync(`UPDATE tasks SET depends_on_task_id = NULL WHERE depends_on_task_id = ?;`, [id]);
      // 4. Delete the task
      await db.runAsync(`DELETE FROM tasks WHERE id = ?;`, [id]);
    });
  }

  async linkTaskToSession(taskId: string, classSessionId: string, classDate?: string, classNoteId?: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO task_relations (id, task_id, class_session_id, class_date, class_note_id, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(task_id, class_session_id) DO UPDATE SET
           class_date = excluded.class_date,
           class_note_id = excluded.class_note_id;`,
        [
          `tr-${taskId}-${classSessionId}`,
          taskId,
          classSessionId,
          classDate || null,
          classNoteId || null,
        ]
      );

      // Also set on task entity if empty
      const task = await this.getTaskById(taskId);
      if (task && !task.classSessionId) {
        await db.runAsync(
          `UPDATE tasks SET class_session_id = ?, class_date = ?, updated_at = datetime('now') WHERE id = ?;`,
          [classSessionId, classDate || null, taskId]
        );
      }
    });
  }

  async unlinkTaskFromSession(taskId: string, classSessionId: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `DELETE FROM task_relations WHERE task_id = ? AND class_session_id = ?;`,
        [taskId, classSessionId]
      );
      // If task directly points to this session, clear it but KEEP the task!
      const task = await this.getTaskById(taskId);
      if (task && task.classSessionId === classSessionId) {
        await db.runAsync(
          `UPDATE tasks SET class_session_id = NULL, class_date = NULL, updated_at = datetime('now') WHERE id = ?;`,
          [taskId]
        );
      }
    });
  }

  async getTaskRelations(taskId: string): Promise<TaskRelations | null> {
    const db = await getDatabaseConnection();
    const r = await db.getFirstAsync<TaskRelationRow>(
      `SELECT * FROM task_relations WHERE task_id = ?;`,
      [taskId]
    );
    if (!r) return null;
    return {
      taskId: r.task_id,
      classSessionId: r.class_session_id || undefined,
      classDate: r.class_date || undefined,
      classNoteId: r.class_note_id || undefined,
    };
  }

  async getAllTaskRelations(): Promise<TaskRelations[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<TaskRelationRow>(`SELECT * FROM task_relations;`);
    return rows.map(r => ({
      taskId: r.task_id,
      classSessionId: r.class_session_id || undefined,
      classDate: r.class_date || undefined,
      classNoteId: r.class_note_id || undefined,
    }));
  }

  async setTaskRelations(rel: TaskRelations): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `INSERT INTO task_relations (id, task_id, class_session_id, class_date, class_note_id, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(task_id, class_session_id) DO UPDATE SET
         class_date = excluded.class_date,
         class_note_id = excluded.class_note_id;`,
      [
        `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        rel.taskId,
        rel.classSessionId || null,
        rel.classDate || null,
        rel.classNoteId || null,
      ]
    );
  }

  async removeTaskRelations(taskId: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM task_relations WHERE task_id = ?;`, [taskId]);
  }

  private mapTaskRow(r: TaskRow): Task {
    const isCompleted = r.is_completed === 1;
    let status: TaskStatus = (r.status as TaskStatus) || (isCompleted ? 'completed' : 'planned');
    if (isCompleted && status !== 'completed') {
      status = 'completed';
    }

    return {
      id: r.id,
      title: r.title,
      description: r.description || undefined,
      subjectId: r.subject_id || '',
      classSessionId: r.class_session_id || undefined,
      classDate: r.class_date || undefined,
      topicId: r.topic_id || undefined,
      examId: r.exam_id || undefined,
      resourceId: r.resource_id || undefined,
      dueDate: r.due_date || undefined,
      dueTime: r.due_time || undefined,
      category: r.category as TaskCategory,
      priority: r.priority as TaskPriority,
      status,
      estimatedMinutes: r.estimated_minutes,
      isCompleted,
      completedAt: r.completed_at || undefined,
      notes: r.notes || undefined,
      parentTaskId: r.parent_task_id || undefined,
      sortOrder: r.sort_order ?? undefined,
      dependsOnTaskId: r.depends_on_task_id || undefined,
      isRecurring: Boolean(r.recurrence_rule),
      recurrenceRule: r.recurrence_rule || undefined,
      recurrenceEndDate: r.recurrence_end_date || undefined,
      scheduledDate: r.scheduled_date || undefined,
      scheduledStartTime: r.scheduled_start_time || undefined,
      scheduledEndTime: r.scheduled_end_time || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

export const taskRepository = new TaskRepository();
