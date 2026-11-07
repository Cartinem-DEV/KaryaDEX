/**
 * BunkMatKar — Class Task Link Service (Task Engine 2.0)
 *
 * Manages relationships between Tasks and Class Sessions without data duplication.
 *
 * Capabilities:
 * - Create new task directly bound to classSessionId, subjectId & optional topicId
 * - Link existing task to classSessionId (with duplicate prevention)
 * - Unlink task (preserves task entity in SQLite & store)
 * - Delete task (removes relations & task)
 * - Query tasks linked to a specific class session
 * - Search linkable pending tasks
 */

import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';
import { taskRepository } from '@/database/repositories/taskRepository';
import { formatLocalDate } from '@/lib/timeUtils';
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '@/types';

export interface CreateClassTaskInput {
  title: string;
  subjectId: string;
  classSessionId: string;
  classDate?: string;
  topicId?: string;
  examId?: string;
  dueDate?: string;
  dueTime?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  estimatedMinutes?: number;
  notes?: string;
  description?: string;
}

class ClassTaskLinkService {
  /**
   * Retrieves all tasks linked to a specific class session.
   */
  getLinkedTasks(classSessionId: string): Task[] {
    const { tasks } = useAppStore.getState();
    const { taskRelations } = useAcademicStore.getState();

    const relatedTaskIds = new Set(
      taskRelations.filter(r => r.classSessionId === classSessionId).map(r => r.taskId)
    );

    return tasks.filter(t => t.classSessionId === classSessionId || relatedTaskIds.has(t.id));
  }

  /**
   * Returns pending tasks that are NOT yet linked to this class session,
   * optionally filtered by a search query (matching title, subject, category).
   */
  getLinkableTasks(classSessionId: string, searchQuery?: string): Task[] {
    const { tasks, subjects } = useAppStore.getState();
    const linked = new Set(this.getLinkedTasks(classSessionId).map(t => t.id));

    let candidates = tasks.filter(t => !t.isCompleted && t.status !== 'completed' && !linked.has(t.id));

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const subjectMap = new Map(subjects.map(s => [s.id, s]));
      candidates = candidates.filter(t => {
        const sub = t.subjectId ? subjectMap.get(t.subjectId) : null;
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchCat = t.category.toLowerCase().includes(q);
        const matchSub = sub ? (sub.name.toLowerCase().includes(q) || sub.shortName.toLowerCase().includes(q)) : false;
        return matchTitle || matchCat || matchSub;
      });
    }

    return candidates;
  }

  /**
   * Creates a new task bound to this class session.
   * Updates Zustand stores immediately and persists to SQLite in background.
   */
  createNewTask(input: CreateClassTaskInput): Task {
    const now = formatLocalDate();
    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: input.title.trim(),
      description: input.description || input.notes,
      subjectId: input.subjectId,
      classSessionId: input.classSessionId,
      classDate: input.classDate,
      topicId: input.topicId,
      examId: input.examId,
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      category: input.category || 'assignment',
      priority: input.priority || 'medium',
      status: input.status || 'planned',
      estimatedMinutes: input.estimatedMinutes || 30,
      notes: input.notes,
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Save to AppStore immediately
    useAppStore.setState(state => ({
      tasks: [newTask, ...state.tasks],
    }));

    // 2. Register relational link in AcademicStore immediately
    useAcademicStore.getState().setTaskRelations({
      taskId: newTask.id,
      classSessionId: input.classSessionId,
      classDate: input.classDate,
    });

    // 3. Persist to SQLite in background
    taskRepository.createTask(newTask).catch(err => {
      console.warn('[ClassTaskLinkService] SQLite createTask failed:', err);
    });

    return newTask;
  }

  /**
   * Links an existing task to this class session.
   * Does NOT duplicate the task record.
   * Prevents duplicate relationship.
   */
  linkExistingTask(taskId: string, classSessionId: string, classDate?: string): void {
    const { taskRelations } = useAcademicStore.getState();
    const alreadyLinked = taskRelations.some(
      r => r.taskId === taskId && r.classSessionId === classSessionId
    );
    if (alreadyLinked) {
      return; // Idempotent prevention of duplicates
    }

    // 1. Update task entity in AppStore
    useAppStore.setState(state => ({
      tasks: state.tasks.map(t =>
        t.id === taskId ? { ...t, classSessionId: t.classSessionId || classSessionId, classDate: t.classDate || classDate } : t
      ),
    }));

    // 2. Update relational record in AcademicStore
    useAcademicStore.getState().setTaskRelations({
      taskId,
      classSessionId,
      classDate,
    });

    // 3. Persist link to SQLite in background
    taskRepository.linkTaskToSession(taskId, classSessionId, classDate).catch(err => {
      console.warn('[ClassTaskLinkService] SQLite linkTaskToSession failed:', err);
    });
  }

  /**
   * Unlinks a task from this class session without deleting the user's task.
   */
  unlinkTask(taskId: string, classSessionId?: string): void {
    const sessionToUnlink = classSessionId || '';

    // 1. Update AppStore (only clear session link on the task if it points to this session)
    useAppStore.setState(state => ({
      tasks: state.tasks.map(t => {
        if (t.id !== taskId) return t;
        if (!sessionToUnlink || t.classSessionId === sessionToUnlink) {
          return { ...t, classSessionId: undefined, classDate: undefined };
        }
        return t;
      }),
    }));

    // 2. Update AcademicStore
    useAcademicStore.getState().removeTaskRelations(taskId);

    // 3. Update SQLite in background
    if (sessionToUnlink) {
      taskRepository.unlinkTaskFromSession(taskId, sessionToUnlink).catch(err => {
        console.warn('[ClassTaskLinkService] SQLite unlinkTaskFromSession failed:', err);
      });
    } else {
      taskRepository.removeTaskRelations(taskId).catch(err => {
        console.warn('[ClassTaskLinkService] SQLite removeTaskRelations failed:', err);
      });
    }
  }

  /**
   * Permanently deletes a task from the system.
   */
  deleteTask(taskId: string): void {
    useAppStore.getState().deleteTask(taskId);
    useAcademicStore.getState().removeTaskRelations(taskId);
    taskRepository.deleteTask(taskId).catch(err => {
      console.warn('[ClassTaskLinkService] SQLite deleteTask failed:', err);
    });
  }
}

export const classTaskLinkService = new ClassTaskLinkService();
