/**
 * BunkMatKar — AI Command & Direct Mutation Engine
 *
 * Empowers Banku (and Shanky) to act as authoritative academic commanders.
 * Direct chat commanding parses and executes student requests to:
 * - Delete, edit, reschedule, complete, or create tasks
 * - Delete, reschedule, add, or clear timetable slots & routines
 * - Mark or reset subject attendance
 * - Add or remove examination dates
 *
 * Directly persists to SQLite database and synchronizes Zustand stores (useAppStore & useAcademicStore)
 * in real-time so all tabs (Today, Schedule, Tasks, Attendance, College) reflect changes immediately.
 */

import {
  taskRepository,
  timetableRepository,
  subjectRepository,
  examRepository,
} from '@/database';
import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';
import { formatLocalDate } from '@/lib/timeUtils';
import type { Task, TaskPriority, DayOfWeek, Exam } from '@/types';
import type { TimetableSlot } from '@/types/academic';
import type { AIProposal, AIPersonaId } from './aiTypes';

export interface CommandExecutionResult {
  executed: boolean;
  action?: string;
  reply: string;
  proposal?: AIProposal;
  suggestedActions?: string[];
}

export class AICommandService {
  /**
   * Evaluates if query contains an authoritative command, executes it,
   * and returns the resulting feedback and proposal.
   */
  static async executeCommand(params: {
    userId: string;
    query: string;
    persona: AIPersonaId;
  }): Promise<CommandExecutionResult> {
    const { userId, query, persona } = params;
    const lower = query.toLowerCase().trim();
    const personaPrefix = persona === 'banku' ? '⚡ **Command Executed by Banku**' : '⚡ **Action by Shanky**';

    // ─── 1. Fetch live contextual entities ─────────────────────────────────
    const [tasks, subjects, allSlots] = await Promise.all([
      taskRepository.getTasks().catch(() => useAppStore.getState().tasks || []),
      subjectRepository.getSubjects().catch(() => useAppStore.getState().subjects || []),
      timetableRepository.getTimetableSlots(true).catch(() => useAcademicStore.getState().timetableSlots || []),
    ]);

    // ═══════════════════════════════════════════════════════════════════════
    // A. TASK COMMANDS: DELETE / REMOVE
    // ═══════════════════════════════════════════════════════════════════════
    const isDeleteTaskQuery =
      (lower.includes('delete') || lower.includes('remove') || lower.includes('drop')) &&
      (lower.includes('task') || lower.includes('todo') || lower.includes('assignment'));

    if (isDeleteTaskQuery) {
      // Check for bulk clear of completed tasks
      if (lower.includes('completed') || lower.includes('finished') || lower.includes('done')) {
        const completedTasks = tasks.filter(t => t.isCompleted || t.status === 'completed');
        if (completedTasks.length === 0) {
          return {
            executed: true,
            action: 'delete_completed_tasks',
            reply: `${personaPrefix}: You have no completed tasks to remove right now.`,
            suggestedActions: ['View Tasks', 'Add Task'],
          };
        }

        for (const t of completedTasks) {
          await taskRepository.deleteTask(t.id).catch(() => {});
          useAppStore.getState().deleteTask(t.id);
        }

        return {
          executed: true,
          action: 'delete_completed_tasks',
          reply: `${personaPrefix}: Successfully removed ${completedTasks.length} completed task(s) from your list.`,
          proposal: {
            id: `prop-del-comp-${Date.now()}`,
            type: 'DELETE_TASK',
            title: `Cleared ${completedTasks.length} Completed Tasks`,
            description: 'Archived and removed finished tasks from your database.',
            status: 'applied',
            createdAt: new Date().toISOString(),
            appliedAt: new Date().toISOString(),
            userId,
            payload: { taskCount: completedTasks.length },
          },
          suggestedActions: ['View Tasks', 'Add Task', 'Check Schedule'],
        };
      }

      // Target specific task deletion
      const targetTask = this.findMatchingTask(query, tasks);
      if (targetTask) {
        await taskRepository.deleteTask(targetTask.id).catch(() => {});
        useAppStore.getState().deleteTask(targetTask.id);

        return {
          executed: true,
          action: 'delete_task',
          reply: `${personaPrefix}: I have deleted the task **"${targetTask.title}"** from your tasks list. Your schedule is updated.`,
          proposal: {
            id: `prop-del-${Date.now()}`,
            type: 'DELETE_TASK',
            title: `Deleted Task: ${targetTask.title}`,
            description: `Permanently removed task "${targetTask.title}" from your database.`,
            status: 'applied',
            createdAt: new Date().toISOString(),
            appliedAt: new Date().toISOString(),
            userId,
            payload: { taskId: targetTask.id, taskTitle: targetTask.title },
          },
          suggestedActions: ['View Tasks', 'Add Task', 'Today Dashboard'],
        };
      } else {
        // Helpful disambiguation if task not found
        const activeTitles = tasks.slice(0, 5).map(t => `• ${t.title}`).join('\n');
        return {
          executed: true,
          action: 'task_not_found',
          reply: `${personaPrefix}: I couldn't find a task matching that name in your active list.\n\nHere are your current tasks:\n${activeTitles || '• No active tasks'}\n\nCommand me with the exact title to remove it!`,
          suggestedActions: tasks.slice(0, 3).map(t => `Delete task ${t.title}`),
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // B. TASK COMMANDS: COMPLETE / REOPEN
    // ═══════════════════════════════════════════════════════════════════════
    const isCompleteTaskQuery =
      (lower.includes('complete') || lower.includes('finish') || lower.includes('mark done') || lower.includes('marked as done')) &&
      !lower.includes('delete') && !lower.includes('remove');

    if (isCompleteTaskQuery) {
      const targetTask = this.findMatchingTask(query, tasks.filter(t => !t.isCompleted));
      if (targetTask) {
        await taskRepository.completeTask(targetTask.id).catch(() => {});
        useAppStore.getState().completeTask(targetTask.id);

        return {
          executed: true,
          action: 'complete_task',
          reply: `${personaPrefix}: Marked **"${targetTask.title}"** as completed! Great progress on your academic workload.`,
          proposal: {
            id: `prop-comp-${Date.now()}`,
            type: 'UPDATE_TASK',
            title: `Completed Task: ${targetTask.title}`,
            description: `Marked task "${targetTask.title}" as completed.`,
            status: 'applied',
            createdAt: new Date().toISOString(),
            appliedAt: new Date().toISOString(),
            userId,
            payload: { taskId: targetTask.id, updates: { isCompleted: true, status: 'completed' } },
          },
          suggestedActions: ['View Tasks', 'Next Task'],
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // C. TASK COMMANDS: EDIT / RESCHEDULE / UPDATE
    // ═══════════════════════════════════════════════════════════════════════
    const isEditTaskQuery =
      (lower.includes('edit task') || lower.includes('change task') || lower.includes('reschedule task') || lower.includes('update task') || lower.includes('set priority')) &&
      !isDeleteTaskQuery;

    if (isEditTaskQuery) {
      const targetTask = this.findMatchingTask(query, tasks);
      if (targetTask) {
        const updates: Partial<Task> = {};
        const changesDesc: string[] = [];

        // Parse Priority update
        if (lower.includes('urgent')) {
          updates.priority = 'urgent';
          changesDesc.push('Priority → Urgent');
        } else if (lower.includes('high priority') || lower.includes('priority high') || lower.includes('to high')) {
          updates.priority = 'high';
          changesDesc.push('Priority → High');
        } else if (lower.includes('medium priority') || lower.includes('priority medium') || lower.includes('to medium')) {
          updates.priority = 'medium';
          changesDesc.push('Priority → Medium');
        } else if (lower.includes('low priority') || lower.includes('priority low') || lower.includes('to low')) {
          updates.priority = 'low';
          changesDesc.push('Priority → Low');
        }

        // Parse Due Date update
        if (lower.includes('tomorrow')) {
          const tom = new Date();
          tom.setDate(tom.getDate() + 1);
          updates.dueDate = formatLocalDate(tom);
          changesDesc.push(`Due Date → Tomorrow (${updates.dueDate})`);
        } else if (lower.includes('today')) {
          updates.dueDate = formatLocalDate(new Date());
          changesDesc.push(`Due Date → Today (${updates.dueDate})`);
        } else {
          // Check for date pattern YYYY-MM-DD
          const dateMatch = query.match(/\b\d{4}-\d{2}-\d{2}\b/);
          if (dateMatch) {
            updates.dueDate = dateMatch[0];
            changesDesc.push(`Due Date → ${updates.dueDate}`);
          }
        }

        if (Object.keys(updates).length > 0) {
          await taskRepository.updateTask(targetTask.id, updates).catch(() => {});
          useAppStore.getState().updateTask(targetTask.id, updates);

          return {
            executed: true,
            action: 'update_task',
            reply: `${personaPrefix}: Updated **"${targetTask.title}"** (${changesDesc.join(', ')}). Changes applied across all views.`,
            proposal: {
              id: `prop-edit-${Date.now()}`,
              type: 'UPDATE_TASK',
              title: `Updated Task: ${targetTask.title}`,
              description: `Applied modifications: ${changesDesc.join(', ')}`,
              status: 'applied',
              createdAt: new Date().toISOString(),
              appliedAt: new Date().toISOString(),
              userId,
              payload: { taskId: targetTask.id, updates },
            },
            suggestedActions: ['View Tasks', 'Today Schedule'],
          };
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // D. TASK COMMANDS: CREATE / ADD
    // ═══════════════════════════════════════════════════════════════════════
    const isAddTaskQuery =
      (lower.startsWith('add task') || lower.startsWith('create task') || lower.startsWith('new task') || lower.startsWith('remind me to')) &&
      !isDeleteTaskQuery && !isEditTaskQuery;

    if (isAddTaskQuery) {
      // Extract title: remove trigger phrase
      let rawTitle = query
        .replace(/^(add\s+a?\s*task|create\s+a?\s*task|new\s+task|remind\s+me\s+to)[:\s]*/i, '')
        .trim();

      // Extract priority if specified
      let priority: TaskPriority = 'medium';
      if (lower.includes('urgent')) {
        priority = 'urgent';
        rawTitle = rawTitle.replace(/\b(urgent|priority\s+urgent)\b/gi, '').trim();
      } else if (lower.includes('high priority') || lower.includes('high')) {
        priority = 'high';
        rawTitle = rawTitle.replace(/\b(high\s+priority|high)\b/gi, '').trim();
      } else if (lower.includes('low priority') || lower.includes('low')) {
        priority = 'low';
        rawTitle = rawTitle.replace(/\b(low\s+priority|low)\b/gi, '').trim();
      }

      // Extract due date if specified
      let dueDate: string | undefined = undefined;
      if (lower.includes('due tomorrow') || lower.includes('tomorrow')) {
        const tom = new Date();
        tom.setDate(tom.getDate() + 1);
        dueDate = formatLocalDate(tom);
        rawTitle = rawTitle.replace(/\b(due\s+tomorrow|tomorrow)\b/gi, '').trim();
      } else if (lower.includes('due today') || lower.includes('today')) {
        dueDate = formatLocalDate(new Date());
        rawTitle = rawTitle.replace(/\b(due\s+today|today)\b/gi, '').trim();
      } else {
        const dateMatch = query.match(/\b\d{4}-\d{2}-\d{2}\b/);
        if (dateMatch) {
          dueDate = dateMatch[0];
          rawTitle = rawTitle.replace(dateMatch[0], '').replace(/\bdue\b/gi, '').trim();
        }
      }

      // Clean up punctuation
      rawTitle = rawTitle.replace(/^["':\s]+|["':\s]+$/g, '').trim() || 'New Task';

      const newTaskData = {
        title: rawTitle,
        category: 'assignment' as const,
        priority,
        dueDate,
        estimatedMinutes: 30,
        isCompleted: false,
        status: 'planned' as const,
      };

      useAppStore.getState().addTask(newTaskData);

      return {
        executed: true,
        action: 'create_task',
        reply: `${personaPrefix}: Created task **"${rawTitle}"** (Priority: ${priority.toUpperCase()}${dueDate ? `, Due: ${dueDate}` : ''}). Added to your active task list.`,
        proposal: {
          id: `prop-add-${Date.now()}`,
          type: 'CREATE_TASK',
          title: `Created Task: ${rawTitle}`,
          description: `Added new ${priority} priority task due ${dueDate || 'soon'}.`,
          status: 'applied',
          createdAt: new Date().toISOString(),
          appliedAt: new Date().toISOString(),
          userId,
          payload: newTaskData,
        },
        suggestedActions: ['View Tasks', 'Break Down Task', 'Check Schedule'],
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // E. TIMETABLE / SCHEDULE COMMANDS: DELETE / REMOVE CLASS
    // ═══════════════════════════════════════════════════════════════════════
    const isDeleteScheduleQuery =
      (lower.includes('delete') || lower.includes('remove') || lower.includes('cancel')) &&
      (lower.includes('class') || lower.includes('lecture') || lower.includes('routine') || lower.includes('schedule') || lower.includes('slot') || lower.includes('period'));

    if (isDeleteScheduleQuery) {
      // Find matching subject
      const matchedSubject = subjects.find(s =>
        lower.includes(s.name.toLowerCase()) || (s.code && lower.includes(s.code.toLowerCase()))
      );

      // Find day if specified
      const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const matchedDay = days.find(d => lower.includes(d));

      let targetSlot: TimetableSlot | undefined;

      if (matchedSubject) {
        if (matchedDay) {
          targetSlot = allSlots.find(s => s.subjectId === matchedSubject.id && s.dayOfWeek.toLowerCase() === matchedDay);
        } else {
          targetSlot = allSlots.find(s => s.subjectId === matchedSubject.id);
        }
      } else if (matchedDay) {
        targetSlot = allSlots.find(s => s.dayOfWeek.toLowerCase() === matchedDay);
      }

      if (targetSlot) {
        const slotSubj = subjects.find(s => s.id === targetSlot!.subjectId);
        const subjName = slotSubj?.name || 'Class';

        await timetableRepository.deleteTimetableSlot(targetSlot.id).catch(() => {});
        useAcademicStore.getState().deleteTimetableSlot(targetSlot.id);
        await useAppStore.getState().refreshFromDatabase().catch(() => {});

        return {
          executed: true,
          action: 'delete_timetable_slot',
          reply: `${personaPrefix}: Removed **"${subjName}"** (${targetSlot.dayOfWeek.toUpperCase()} ${targetSlot.startTime}–${targetSlot.endTime}) from your weekly routine.`,
          proposal: {
            id: `prop-delslot-${Date.now()}`,
            type: 'DELETE_TIMETABLE_SLOT',
            title: `Removed ${subjName} Slot`,
            description: `Removed recurring class on ${targetSlot.dayOfWeek} at ${targetSlot.startTime}.`,
            status: 'applied',
            createdAt: new Date().toISOString(),
            appliedAt: new Date().toISOString(),
            userId,
            payload: { slotId: targetSlot.id, subjectName: subjName },
          },
          suggestedActions: ['View Schedule', 'Add Class', 'Today Timeline'],
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // F. TIMETABLE / SCHEDULE COMMANDS: CLEAR / RESET SCHEDULE
    // ═══════════════════════════════════════════════════════════════════════
    const isClearScheduleQuery =
      (lower.includes('clear') || lower.includes('reset') || lower.includes('wipe')) &&
      (lower.includes('timetable') || lower.includes('schedule') || lower.includes('routine'));

    if (isClearScheduleQuery) {
      const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const matchedDay = days.find(d => lower.includes(d));

      const slotsToClear = matchedDay
        ? allSlots.filter(s => s.dayOfWeek.toLowerCase() === matchedDay)
        : allSlots;

      for (const slot of slotsToClear) {
        await timetableRepository.deleteTimetableSlot(slot.id).catch(() => {});
        useAcademicStore.getState().deleteTimetableSlot(slot.id);
      }
      await useAppStore.getState().refreshFromDatabase().catch(() => {});

      const scopeText = matchedDay ? `all classes on ${matchedDay.toUpperCase()}` : 'your entire weekly timetable';

      return {
        executed: true,
        action: 'clear_timetable',
        reply: `${personaPrefix}: Cleared ${scopeText} (${slotsToClear.length} slots removed). Schedule reset successfully.`,
        proposal: {
          id: `prop-clear-${Date.now()}`,
          type: 'CLEAR_TIMETABLE',
          title: `Cleared ${matchedDay ? `${matchedDay.toUpperCase()} Schedule` : 'Weekly Schedule'}`,
          description: `Deactivated ${slotsToClear.length} timetable slot(s).`,
          status: 'applied',
          createdAt: new Date().toISOString(),
          appliedAt: new Date().toISOString(),
          userId,
          payload: { count: slotsToClear.length, day: matchedDay },
        },
        suggestedActions: ['Import Timetable with Banku', 'Add Class Manually'],
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // G. ATTENDANCE COMMANDS: MARK ATTENDANCE
    // ═══════════════════════════════════════════════════════════════════════
    const isMarkAttendanceQuery =
      (lower.includes('mark') || lower.includes('log') || lower.includes('record')) &&
      (lower.includes('attendance') || lower.includes('present') || lower.includes('absent') || lower.includes('attended'));

    if (isMarkAttendanceQuery) {
      const matchedSubject = subjects.find(s =>
        lower.includes(s.name.toLowerCase()) || (s.code && lower.includes(s.code.toLowerCase()))
      );

      if (matchedSubject) {
        const isAbsent = lower.includes('absent') || lower.includes('bunk') || lower.includes('missed');
        const status = isAbsent ? 'absent' : 'present';

        useAppStore.getState().markAttendance(matchedSubject.id, status);

        return {
          executed: true,
          action: 'mark_attendance',
          reply: `${personaPrefix}: Marked attendance for **"${matchedSubject.name}"** as **${status.toUpperCase()}**. Metrics and bunk safety margins updated.`,
          proposal: {
            id: `prop-att-${Date.now()}`,
            type: 'MARK_ATTENDANCE',
            title: `Attendance Logged: ${matchedSubject.name}`,
            description: `Recorded 1 ${status} class session.`,
            status: 'applied',
            createdAt: new Date().toISOString(),
            appliedAt: new Date().toISOString(),
            userId,
            payload: { subjectId: matchedSubject.id, subjectName: matchedSubject.name, status },
          },
          suggestedActions: ['View Attendance Tab', 'Explain Attendance', 'Today Schedule'],
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // H. EXAM COMMANDS: DELETE / REMOVE EXAM
    // ═══════════════════════════════════════════════════════════════════════
    const isDeleteExamQuery =
      (lower.includes('delete') || lower.includes('remove') || lower.includes('cancel')) &&
      (lower.includes('exam') || lower.includes('midterm') || lower.includes('final') || lower.includes('quiz') || lower.includes('test'));

    if (isDeleteExamQuery) {
      const exams = await examRepository.getExams().catch(() => []);
      const matchedExam = exams.find(e =>
        lower.includes(e.name.toLowerCase()) ||
        subjects.some(s => s.id === e.subjectId && lower.includes(s.name.toLowerCase()))
      ) || exams[0];

      if (matchedExam) {
        await examRepository.deleteExam(matchedExam.id).catch(() => {});
        await useAppStore.getState().refreshFromDatabase().catch(() => {});

        return {
          executed: true,
          action: 'delete_exam',
          reply: `${personaPrefix}: Removed examination **"${matchedExam.name}"** scheduled for ${matchedExam.date}. Schedule updated.`,
          proposal: {
            id: `prop-delexam-${Date.now()}`,
            type: 'DELETE_EXAM',
            title: `Removed Exam: ${matchedExam.name}`,
            description: `Deleted exam date from schedule and calendar.`,
            status: 'applied',
            createdAt: new Date().toISOString(),
            appliedAt: new Date().toISOString(),
            userId,
            payload: { examId: matchedExam.id, examName: matchedExam.name },
          },
          suggestedActions: ['View Schedule', 'View Tasks', 'College Calendar'],
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // I. EXAM COMMANDS: ADD / CREATE EXAM
    // ═══════════════════════════════════════════════════════════════════════
    const isAddExamQuery =
      (lower.startsWith('add exam') || lower.startsWith('create exam') || lower.startsWith('schedule exam') || lower.startsWith('new exam')) &&
      !isDeleteExamQuery;

    if (isAddExamQuery) {
      const matchedSubject = subjects.find(s =>
        lower.includes(s.name.toLowerCase()) || (s.code && lower.includes(s.code.toLowerCase()))
      );

      let examDate = formatLocalDate(new Date());
      const dateMatch = query.match(/\b\d{4}-\d{2}-\d{2}\b/);
      if (dateMatch) {
        examDate = dateMatch[0];
      } else if (lower.includes('tomorrow')) {
        const tom = new Date();
        tom.setDate(tom.getDate() + 1);
        examDate = formatLocalDate(tom);
      } else if (lower.includes('next week')) {
        const nextW = new Date();
        nextW.setDate(nextW.getDate() + 7);
        examDate = formatLocalDate(nextW);
      }

      let examName = query
        .replace(/^(add\s+an?\s*exam|create\s+an?\s*exam|schedule\s+an?\s*exam|new\s+exam)[:\s]*/i, '')
        .replace(/\b(on|for|due)\s+\d{4}-\d{2}-\d{2}\b/i, '')
        .replace(/\b(tomorrow|next\s+week)\b/i, '')
        .trim();

      if (matchedSubject) {
        examName = examName.replace(new RegExp(matchedSubject.name, 'gi'), '').trim();
      }

      examName = examName || (matchedSubject ? `${matchedSubject.shortName || matchedSubject.name} Exam` : 'Internal Exam');

      const newExam: Exam = {
        id: `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: examName,
        subjectId: matchedSubject ? matchedSubject.id : (subjects[0]?.id || 'subj-1'),
        semesterId: (subjects[0] as any)?.semesterId || 'sem-1',
        type: 'internal',
        date: examDate,
        time: '10:00',
        maxMarks: 100,
        weightage: 20,
      };

      await examRepository.createExam(newExam).catch(() => {});
      await useAppStore.getState().refreshFromDatabase().catch(() => {});

      return {
        executed: true,
        action: 'create_exam',
        reply: `${personaPrefix}: Scheduled exam **"${examName}"** for ${examDate} (10:00–12:00). Added to your academic calendar.`,
        proposal: {
          id: `prop-addexam-${Date.now()}`,
          type: 'CREATE_EXAM',
          title: `Scheduled Exam: ${examName}`,
          description: `Date: ${examDate} • Subject: ${matchedSubject?.name || 'General'}`,
          status: 'applied',
          createdAt: new Date().toISOString(),
          appliedAt: new Date().toISOString(),
          userId,
          payload: newExam,
        },
        suggestedActions: ['View Schedule', 'Add Revision Task', 'College Calendar'],
      };
    }

    return { executed: false, reply: '' };
  }

  /**
   * Helper to locate task in list by fuzzy title match.
   */
  private static findMatchingTask(query: string, tasks: Task[]): Task | null {
    if (tasks.length === 0) return null;

    const lowerQuery = query.toLowerCase();

    // 1. Direct contains check
    for (const t of tasks) {
      const tLower = t.title.toLowerCase();
      if (lowerQuery.includes(tLower) || tLower.includes(lowerQuery.replace(/^(delete|remove|clear|complete|finish|edit|reschedule|update)\s+(task|todo|assignment)?\s*/i, '').trim())) {
        return t;
      }
    }

    // 2. Tokenized word matching
    const queryTokens = lowerQuery
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => !['delete', 'remove', 'task', 'todo', 'assignment', 'the', 'a', 'an', 'please', 'my', 'edit', 'update', 'complete'].includes(w));

    let bestTask: Task | null = null;
    let maxMatch = 0;

    for (const t of tasks) {
      const tTokens = t.title.toLowerCase().split(/\s+/);
      const matched = queryTokens.filter(q => tTokens.some(tok => tok.includes(q) || q.includes(tok)));
      if (matched.length > maxMatch) {
        maxMatch = matched.length;
        bestTask = t;
      }
    }

    return maxMatch >= 1 ? bestTask : null;
  }
}
