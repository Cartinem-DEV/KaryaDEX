/**
 * BunkMatKar — Feature 4: "What Should I Do Today?" Daily Briefing (Phase 12 Shanky MVP)
 *
 * Gathers today's timetable, pending tasks, exams, and attendance pressure ->
 * Generates structured, prioritized daily game plan ->
 * Locally caches by (userId + dateString) ->
 * Graceful fallback to deterministic day summary if AI is unavailable.
 */

import { aiClient } from '../core/aiClient';
import { AIContextBuilder } from '../core/aiContextBuilder';
import { AIValidation } from '../core/aiValidation';
import { buildDailyBriefingPrompt } from '../prompts/shankyPrompts';
import { formatLocalDate } from '@/lib/timeUtils';
import type {
  AIResponse,
  DailyBriefingPayload,
} from '../core/aiTypes';

export class DailyBriefingFeature {
  /**
   * Retrieves or generates the daily academic briefing for a student.
   */
  static async getDailyBriefing(params: {
    userId: string;
    targetDate?: string;
  }): Promise<AIResponse<DailyBriefingPayload>> {
    const today = params.targetDate || formatLocalDate();

    // 1. Build authoritative context
    const context = await AIContextBuilder.buildDailyBriefingContext({
      userId: params.userId,
      targetDate: today,
    });

    const prompt = buildDailyBriefingPrompt(context);
    const schemaDesc = `{"greeting": string, "summaryDate": string, "headline": string, "attendanceAlert": {"subjectName": string, "currentAttendance": number, "status": string, "advice": string}, "scheduleHighlights": [string], "priorityTasks": [string], "actionRecommendation": string}`;

    const cacheVersionKey = `briefing_${today}_tasks${context.pendingTasks.length}_cls${context.todayClasses.length}`;

    try {
      const rawResponse = await aiClient.executeStructured<DailyBriefingPayload>({
        request: context,
        prompt,
        schemaDescription: schemaDesc,
        cacheVersionKey,
        cacheTtlSeconds: 7200, // 2 hours cache
      });

      const validated = AIValidation.validateDailyBriefing(rawResponse.data);

      return {
        ...rawResponse,
        data: validated,
      };
    } catch (err: any) {
      // 2. Graceful Offline / Failure Fallback
      const fallbackData = this.generateDeterministicBriefingFallback(context);
      return {
        success: true,
        persona: 'shanky',
        provider: 'edge-gateway',
        model: 'deterministic-fallback',
        fallbackUsed: true,
        data: fallbackData,
        metrics: { latencyMs: 5 },
      };
    }
  }

  /**
   * Generates a deterministic day summary when AI is unreachable.
   */
  private static generateDeterministicBriefingFallback(
    context: import('../core/aiTypes').DailyBriefingRequest
  ): DailyBriefingPayload {
    const classCount = context.todayClasses.length;
    const taskCount = context.pendingTasks.length;

    const headline = classCount > 0
      ? `You have ${classCount} class${classCount > 1 ? 'es' : ''} scheduled today.`
      : `No scheduled classes today! Great time for study & task completion.`;

    const scheduleHighlights = context.todayClasses.slice(0, 3).map(
      c => `${c.time}: ${c.subjectName}${c.room ? ` (${c.room})` : ''}`
    );

    const priorityTasks = context.pendingTasks.slice(0, 3).map(t => t.title);

    let alert: DailyBriefingPayload['attendanceAlert'] | undefined;
    if (context.attendanceAlerts.length > 0) {
      const topAlert = context.attendanceAlerts[0];
      alert = {
        subjectName: topAlert.subjectName,
        currentAttendance: topAlert.currentPercentage,
        status: topAlert.status,
        advice: `Attendance in ${topAlert.subjectName} is at ${topAlert.currentPercentage.toFixed(1)}%. Attending today's class is highly recommended.`,
      };
    }

    const actionRecommendation = taskCount > 0
      ? `Start by tackling "${context.pendingTasks[0].title}" during your break.`
      : `Review upcoming notes and prepare for the week ahead.`;

    return {
      greeting: 'Good day!',
      summaryDate: context.dateString,
      headline,
      attendanceAlert: alert,
      scheduleHighlights: scheduleHighlights.length > 0 ? scheduleHighlights : ['No classes scheduled today'],
      priorityTasks: priorityTasks.length > 0 ? priorityTasks : ['No pending tasks due today'],
      actionRecommendation,
    };
  }
}
