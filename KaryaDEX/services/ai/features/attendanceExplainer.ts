/**
 * BunkMatKar — Feature 3: Smart Attendance Explainer (Phase 12 Shanky MVP)
 *
 * 100% Deterministic Math Pre-computed ->
 * Shanky explains the student's status, safe bunks, recovery needs, and next actions ->
 * Output validation verifies numbers were NOT tampered with ->
 * Graceful fallback to deterministic template if AI is offline.
 */

import { aiClient } from '../core/aiClient';
import { AIContextBuilder } from '../core/aiContextBuilder';
import { AIValidation } from '../core/aiValidation';
import { buildAttendanceExplainerPrompt } from '../prompts/shankyPrompts';
import type {
  AIResponse,
  AttendanceExplanationPayload,
} from '../core/aiTypes';

export class AttendanceExplainerFeature {
  /**
   * Generates conversational explanation for a subject's attendance.
   * Strictly preserves deterministic calculation values.
   */
  static async explainSubjectAttendance(params: {
    userId: string;
    subjectId: string;
  }): Promise<AIResponse<AttendanceExplanationPayload>> {
    // 1. Build authoritative deterministic context
    const context = await AIContextBuilder.buildAttendanceContext(params);

    const prompt = buildAttendanceExplainerPrompt(context);
    const schemaDesc = `{"subjectName": string, "deterministicPercentage": number, "deterministicTarget": number, "deterministicSafeBunks": number, "deterministicRecoveryNeeded": number, "attendancePressure": string, "trend": string, "situationSummary": string, "bunkAdvice": string, "recoveryAdvice": string, "recommendedAction": string}`;

    const cacheKey = `att_${context.subjectId}_${context.currentAttendance}_${context.attendedClasses}_${context.conductedClasses}`;

    try {
      const rawResponse = await aiClient.executeStructured<AttendanceExplanationPayload>({
        request: context,
        prompt,
        schemaDescription: schemaDesc,
        cacheVersionKey: cacheKey,
        cacheTtlSeconds: 1800, // 30 min
      });

      // 2. Validate that AI didn't hallucinate or tamper with the numbers
      const validated = AIValidation.validateAttendanceExplanation(rawResponse.data, {
        percentage: context.currentAttendance,
        safeBunks: context.safeBunkCapacity,
        recoveryNeeded: context.recoveryNeeded,
      });

      return {
        ...rawResponse,
        data: validated,
      };
    } catch (err: any) {
      // 3. Graceful Offline / Failure Fallback:
      // Return deterministic explanation directly without breaking app
      const fallbackData = this.generateDeterministicFallback(context);
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
   * Provides deterministic fallback explanation when AI provider is unavailable.
   */
  private static generateDeterministicFallback(
    context: import('../core/aiTypes').AttendanceExplainRequest
  ): AttendanceExplanationPayload {
    const isSafe = context.currentAttendance >= context.targetAttendance;
    const situation = isSafe
      ? `Your attendance is currently ${context.currentAttendance.toFixed(1)}%, which meets your ${context.targetAttendance}% target.`
      : `Your attendance is currently ${context.currentAttendance.toFixed(1)}%, which is below your target of ${context.targetAttendance}%.`;

    const bunkAdvice = context.safeBunkCapacity > 0
      ? `You have a safe cushion of ${context.safeBunkCapacity} class${context.safeBunkCapacity > 1 ? 'es' : ''} you can miss without dropping below target.`
      : `You have 0 safe bunks available. Missing any upcoming class will directly reduce your attendance percentage.`;

    const recoveryAdvice = context.recoveryNeeded > 0
      ? `You need to attend your next ${context.recoveryNeeded} consecutive class${context.recoveryNeeded > 1 ? 'es' : ''} to recover above ${context.targetAttendance}%.`
      : undefined;

    const recommendedAction = isSafe
      ? `Keep up the momentum in ${context.subjectName} to preserve your safe bunk buffer.`
      : `Prioritize attending the next ${context.subjectName} session to start attendance recovery immediately.`;

    return {
      subjectName: context.subjectName,
      deterministicPercentage: context.currentAttendance,
      deterministicTarget: context.targetAttendance,
      deterministicSafeBunks: context.safeBunkCapacity,
      deterministicRecoveryNeeded: context.recoveryNeeded,
      attendancePressure: context.attendancePressure,
      trend: context.trend,
      situationSummary: situation,
      bunkAdvice,
      recoveryAdvice,
      recommendedAction,
    };
  }
}
