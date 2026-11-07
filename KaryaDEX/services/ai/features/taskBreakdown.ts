/**
 * BunkMatKar — Feature 5: Complex Task Breakdown (Phase 12 Shanky MVP)
 *
 * User requests help on a large assignment/study goal ->
 * Shanky breaks it down into 3-5 structured subtasks with estimated minutes ->
 * Schema validation ->
 * AIProposal created ->
 * User preview & confirmation ->
 * Transactional creation via TaskRepository.
 */

import { taskRepository, subjectRepository } from '@/database';
import { aiClient } from '../core/aiClient';
import { AIContextBuilder } from '../core/aiContextBuilder';
import { AIValidation } from '../core/aiValidation';
import { buildTaskBreakdownPrompt } from '../prompts/shankyPrompts';
import { formatLocalDate } from '@/lib/timeUtils';
import type {
  AIProposal,
  AIResponse,
  TaskBreakdownProposalPayload,
} from '../core/aiTypes';
import type { Task } from '@/types';
import { useAppStore } from '@/store/useAppStore';

export class TaskBreakdownFeature {
  /**
   * Generates a 3-5 step task breakdown proposal.
   */
  static async generateBreakdownProposal(params: {
    userId: string;
    taskTitle: string;
    taskDescription?: string;
    subjectId?: string;
    parentTaskId?: string;
  }): Promise<AIResponse<TaskBreakdownProposalPayload>> {
    const context = await AIContextBuilder.buildTaskBreakdownContext({
      userId: params.userId,
      taskTitle: params.taskTitle,
      taskDescription: params.taskDescription,
      subjectId: params.subjectId,
    });

    const prompt = buildTaskBreakdownPrompt(context);
    const schemaDesc = `{"parentTitle": string, "subjectName": string, "subtasks": [{"title": string, "estimatedMinutes": number, "orderIndex": number}]}`;

    const rawResponse = await aiClient.executeStructured<TaskBreakdownProposalPayload>({
      request: context,
      prompt,
      schemaDescription: schemaDesc,
    });

    const validated = AIValidation.validateTaskBreakdown(rawResponse.data);

    const proposal: AIProposal<TaskBreakdownProposalPayload> = {
      id: `prop_task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'CREATE_SUBTASKS',
      title: `Breakdown: ${validated.parentTitle}`,
      description: `Proposed ${validated.subtasks.length} actionable subtasks by Shanky. Review and save below.`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      userId: params.userId,
      payload: {
        ...validated,
        subjectId: params.subjectId,
      },
    };

    return {
      ...rawResponse,
      data: validated,
      proposal,
    };
  }

  /**
   * Applies the approved breakdown proposal into TaskRepository.
   * Requires explicit user confirmation.
   */
  static async applyApprovedProposal(
    proposal: AIProposal<TaskBreakdownProposalPayload>,
    options?: {
      parentTaskId?: string;
      dueDate?: string;
    }
  ): Promise<{ createdSubtasks: Task[]; parentTask?: Task }> {
    if (proposal.status === 'applied') {
      throw new Error('This task breakdown proposal has already been applied.');
    }

    const { payload } = proposal;
    const now = formatLocalDate();
    let parentId = options?.parentTaskId;
    let parentTask: Task | undefined;

    // If no existing parent task, create the parent task first
    if (!parentId) {
      const newParent: Task = {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: payload.parentTitle,
        subjectId: payload.subjectId,
        category: 'assignment',
        priority: 'high',
        status: 'planned',
        isCompleted: false,
        dueDate: options?.dueDate || now,
        estimatedMinutes: payload.subtasks.reduce((acc, st) => acc + st.estimatedMinutes, 0),
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      };
      parentTask = await taskRepository.createTask(newParent);
      parentId = parentTask.id;
    }

    // Create subtasks
    const createdSubtasks: Task[] = [];
    for (const sub of payload.subtasks) {
      const subtaskRecord: Task = {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: sub.title,
        subjectId: payload.subjectId,
        parentTaskId: parentId,
        category: 'assignment',
        priority: 'medium',
        status: 'planned',
        isCompleted: false,
        dueDate: options?.dueDate || now,
        estimatedMinutes: sub.estimatedMinutes,
        sortOrder: sub.orderIndex,
        createdAt: now,
        updatedAt: now,
      };

      const saved = await taskRepository.createTask(subtaskRecord);
      createdSubtasks.push(saved);
    }

    proposal.status = 'applied';
    proposal.appliedAt = new Date().toISOString();

    // Refresh reactive stores so UI immediately displays new subtasks
    await useAppStore.getState().refreshFromDatabase().catch(err => {
      console.warn('[TaskBreakdown] Error refreshing stores:', err);
    });

    return { createdSubtasks, parentTask };
  }
}
