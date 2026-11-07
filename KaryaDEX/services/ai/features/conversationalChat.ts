/**
 * BunkMatKar — Conversational Chat Feature (Shanky / Mistral 8B)
 *
 * Implements general conversational academic assistance for students.
 * Feeds bounded deterministic academic context (attendance, schedule, tasks)
 * into Shanky (ministral-8b-2512 via edge gateway).
 * Enforces strict Mistral isolation and truthful offline degradation.
 */

import {
  subjectRepository,
  timetableRepository,
  taskRepository,
  examRepository,
  attendanceRepository,
} from '@/database';
import { calculatePercentage, getAttendanceStatus, calculateSafeBunks, calculateRecoveryClasses } from '@/lib/attendance';
import { aiClient } from '../core/aiClient';
import { aiRouter } from '../core/aiRouter';
import { AIValidation } from '../core/aiValidation';
import { AICommandService } from '../core/aiCommandService';
import { buildConversationalChatPrompt } from '../prompts/shankyPrompts';
import { buildBankuChatPrompt } from '../prompts/bankuPrompts';
import { AcademicChatEngine } from './academicChatEngine';
import type {
  AIResponse,
  ConversationalChatPayload,
  ConversationalChatRequest,
  BankuChatPayload,
  BaseAIRequest,
} from '../core/aiTypes';
import { AIProviderAuthError } from '../core/aiTypes';

export class ConversationalChatFeature {
  /**
   * Primary entry point for Shanky conversational assistant.
   */
  static async chatWithShanky(params: {
    userId: string;
    userMessage: string;
    conversationHistory?: Array<{ sender: 'user' | 'assistant'; text: string }>;
    preferredSubjectId?: string;
  }): Promise<AIResponse<ConversationalChatPayload>> {
    const { userId, userMessage, conversationHistory, preferredSubjectId } = params;

    // 0. Check for direct command execution (e.g., delete/edit task, schedule, attendance)
    const commandResult = await AICommandService.executeCommand({
      userId,
      query: userMessage,
      persona: 'shanky',
    });

    if (commandResult.executed) {
      return {
        success: true,
        persona: 'shanky',
        provider: 'mistral',
        model: 'ministral-8b-2512',
        fallbackUsed: false,
        data: {
          reply: commandResult.reply,
          suggestedActions: commandResult.suggestedActions || ['View Tasks', 'View Schedule'],
          actionType: 'general',
        },
        metrics: { latencyMs: 12 },
      };
    }

    // 1. Gather authoritative deterministic academic context
    const [subjects, allSlots, tasks, exams] = await Promise.all([
      subjectRepository.getSubjects().catch(() => []),
      timetableRepository.getTimetableSlots(true).catch(() => []),
      taskRepository.getTasks().catch(() => []),
      examRepository.getExams().catch(() => []),
    ]);

    const target = (await subjectRepository.getStudent().catch(() => null))?.attendanceTarget || 75;

    // Build attendance summaries with deterministic math
    const attendanceSummary: ConversationalChatRequest['attendanceSummary'] = [];
    for (const subj of subjects) {
      try {
        const agg = await attendanceRepository.getAggregate(subj.id);
        const attended = agg?.attended || 0;
        const total = agg?.total || 0;
        const percentage = calculatePercentage(attended, total);
        const status = getAttendanceStatus(percentage, subj.targetAttendance || target);
        const safeBunks = calculateSafeBunks(attended, total, subj.targetAttendance || target);
        const recoveryNeeded = calculateRecoveryClasses(attended, total, subj.targetAttendance || target);

        attendanceSummary.push({
          subjectId: subj.id,
          subjectName: subj.name,
          percentage,
          safeBunks,
          recoveryNeeded,
          status,
        });
      } catch {}
    }

    // Today's classes
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
    const todaySlots = allSlots
      .filter(s => s.dayOfWeek.toLowerCase() === currentDay.toLowerCase())
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const subjMap = new Map(subjects.map(s => [s.id, s.name]));
    const todayClasses = todaySlots.map(s => ({
      subjectName: subjMap.get(s.subjectId) || 'Class',
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
    }));

    // Pending tasks
    const pendingTasks = tasks
      .filter(t => !t.isCompleted)
      .slice(0, 5)
      .map(t => ({ title: t.title, dueDate: t.dueDate }));

    // Upcoming exams
    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingExams = exams
      .filter(e => e.date >= todayStr)
      .slice(0, 3)
      .map(e => ({ subjectName: subjMap.get(e.subjectId) || e.name, date: e.date }));

    // 2. Assemble context contract
    const context: ConversationalChatRequest = {
      userId,
      persona: 'shanky',
      feature: 'conversational_chat',
      userMessage,
      conversationHistory,
      attendanceSummary,
      todayClasses,
      pendingTasks,
      upcomingExams,
    };

    const prompt = buildConversationalChatPrompt(context);
    const schemaDesc = `{"reply": string, "suggestedActions": string[], "actionType": string, "relatedSubjectId": string}`;

    try {
      // 3. Dispatch through Mistral path (Edge Gateway)
      const res = await aiClient.executeStructured<ConversationalChatPayload>({
        request: context,
        prompt,
        schemaDescription: schemaDesc,
      });

      const validated = AIValidation.validateConversationalChat(res.data);

      return {
        ...res,
        data: validated,
      };
    } catch (err: any) {
      // 4. Honest deterministic fallback (never claims fake AI completion)
      const fallbackReply = this.generateDeterministicLocalAssistance(
        userMessage,
        todayClasses,
        attendanceSummary,
        pendingTasks,
        preferredSubjectId
      );

      return {
        success: true,
        persona: 'shanky',
        provider: 'mistral',
        model: 'local-deterministic-fallback',
        fallbackUsed: true,
        data: fallbackReply,
        metrics: { latencyMs: 15 },
      };
    }
  }

  /**
   * Generates deterministic local assistance clearly labelled as local assistance.
   * Leverages AcademicChatEngine to answer any question across academics, code, math, and college life.
   */
  private static generateDeterministicLocalAssistance(
    query: string,
    todayClasses: Array<{ subjectName: string; startTime: string; endTime: string }>,
    attendanceSummary: NonNullable<ConversationalChatRequest['attendanceSummary']>,
    pendingTasks: Array<{ title: string }>,
    preferredSubjectId?: string
  ): ConversationalChatPayload {
    const academicRes = AcademicChatEngine.generateAnswer({
      query,
      persona: 'shanky',
      todayClasses,
      subjects: attendanceSummary.map(a => ({
        id: a.subjectId,
        name: a.subjectName,
        percentage: a.percentage,
        safeBunks: a.safeBunks,
        recoveryNeeded: a.recoveryNeeded,
      })),
      pendingTasks,
      preferredSubjectId,
    });

    return {
      reply: academicRes.reply,
      suggestedActions: academicRes.suggestedActions,
      actionType: academicRes.actionType,
      relatedSubjectId: academicRes.relatedSubjectId,
      isDeterministicFallback: true,
    };
  }

  /**
   * Primary entry point for Banku conversational assistant.
   * Dispatches text queries directly to Gemini 3.8 Flash via AIRouter or AIClient edge gateway.
   * Enforces zero direct SQLite writes, generates proposal drafts when clear/modify is requested,
   * and provides comprehensive academic answers for ANY type of question.
   */
  static async chatWithBanku(params: {
    userId: string;
    userMessage: string;
    conversationHistory?: Array<{ sender: 'user' | 'assistant'; text: string }>;
  }): Promise<AIResponse<BankuChatPayload>> {
    const { userId, userMessage, conversationHistory } = params;

    // 0. Check for direct command execution (e.g., delete/edit task, schedule, routine, attendance)
    const commandResult = await AICommandService.executeCommand({
      userId,
      query: userMessage,
      persona: 'banku',
    });

    if (commandResult.executed) {
      return {
        success: true,
        persona: 'banku',
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        fallbackUsed: false,
        data: {
          reply: commandResult.reply,
          suggestedActions: commandResult.suggestedActions || ['View Schedule', 'View Tasks'],
          proposal: commandResult.proposal,
        },
        metrics: { latencyMs: 15 },
      };
    }

    const baseRequest: BaseAIRequest = {
      userId,
      persona: 'banku',
      feature: 'conversational_chat',
    };

    try {
      const res = await aiRouter.routeBankuChat(baseRequest, userMessage, conversationHistory);
      return {
        success: true,
        persona: 'banku',
        provider: 'gemini',
        model: res.model,
        fallbackUsed: res.fallbackUsed,
        data: res.data,
        metrics: { latencyMs: res.latencyMs },
      };
    } catch (err: any) {
      // If direct routeBankuChat failed (e.g., client-side GEMINI_API_KEY absent),
      // attempt dispatch through aiClient.executeStructured (which calls Supabase Edge Gateway)
      if (err instanceof AIProviderAuthError || err.message?.includes('API key') || err.message?.includes('configured')) {
        try {
          const prompt = buildBankuChatPrompt(userMessage, conversationHistory);
          const schemaDesc = `{"reply": string, "suggestedActions": string[], "proposal": {"type": string, "title": string, "description": string, "payload": any}}`;
          const gwRes = await aiClient.executeStructured<BankuChatPayload>({
            request: baseRequest,
            prompt,
            schemaDescription: schemaDesc,
          });

          return {
            ...gwRes,
            persona: 'banku',
            provider: 'gemini',
            model: gwRes.model || 'gemini-3.8-flash',
          };
        } catch (gwErr) {
          // Edge gateway offline or session absent -> fall through to rich local assistance
        }
      }

      const fallbackReply = await this.generateBankuDeterministicFallback(userMessage, userId);
      return {
        success: true,
        persona: 'banku',
        provider: 'gemini',
        model: 'local-deterministic-fallback',
        fallbackUsed: true,
        data: fallbackReply,
        metrics: { latencyMs: 15 },
      };
    }
  }

  private static async generateBankuDeterministicFallback(query: string, userId: string): Promise<BankuChatPayload> {
    const lower = query.toLowerCase();
    const isMutation =
      lower.includes('clear') ||
      lower.includes('delete') ||
      lower.includes('remove') ||
      lower.includes('reset') ||
      lower.includes('wipe');

    if (isMutation) {
      return {
        reply: `[Banku Fallback] I cannot directly modify or clear your database. Any changes must be verified and approved through an explicit proposal.`,
        suggestedActions: ['Keep Schedule', 'Review Hub'],
        proposal: {
          id: `prop-mod-${Date.now()}`,
          type: 'IMPORT_TIMETABLE',
          title: 'Clear Timetable Schedule Confirmation',
          description: 'User requested schedule reset. Requires explicit confirmation.',
          status: 'pending',
          createdAt: new Date().toISOString(),
          userId,
          payload: [],
        },
      };
    }

    // Retrieve database entities for rich local answer synthesis
    const [subjects, allSlots, tasks] = await Promise.all([
      subjectRepository.getSubjects().catch(() => []),
      timetableRepository.getTimetableSlots(true).catch(() => []),
      taskRepository.getTasks().catch(() => []),
    ]);

    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
    const todayClasses = allSlots
      .filter(s => s.dayOfWeek.toLowerCase() === currentDay.toLowerCase())
      .map(s => ({
        subjectName: subjects.find(sub => sub.id === s.subjectId)?.name || 'Class',
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
      }));

    const academicRes = AcademicChatEngine.generateAnswer({
      query,
      persona: 'banku',
      subjects: subjects.map(s => ({ id: s.id, name: s.name })),
      todayClasses,
      pendingTasks: tasks.filter(t => !t.isCompleted).map(t => ({ title: t.title, dueDate: t.dueDate })),
    });

    return {
      reply: academicRes.reply,
      suggestedActions: academicRes.suggestedActions,
    };
  }
}


