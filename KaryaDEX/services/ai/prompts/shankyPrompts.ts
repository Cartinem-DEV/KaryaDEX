/**
 * KaryaDEX — Shanky Specialized Prompts (Phase 12)
 *
 * Prompts for conversational chat, daily briefing, attendance explainer,
 * task breakdown, and natural language profile extraction.
 */

import { buildSecuredPrompt } from './systemPolicy';
import { SHANKY_SYSTEM_INSTRUCTION } from '../personas/shanky';
import type {
  AttendanceExplainRequest,
  DailyBriefingRequest,
  TaskBreakdownRequest,
  ConversationalChatRequest,
} from '../core/aiTypes';

export function buildAttendanceExplainerPrompt(context: AttendanceExplainRequest): string {
  const schemaDescription = `
Return ONLY valid JSON matching this exact structure:
{
  "subjectName": string,
  "deterministicPercentage": number,
  "deterministicTarget": number,
  "deterministicSafeBunks": number,
  "deterministicRecoveryNeeded": number,
  "attendancePressure": "low" | "medium" | "high" | "critical",
  "trend": "improving" | "stable" | "declining" | "insufficient_data",
  "situationSummary": string,
  "bunkAdvice": string,
  "recoveryAdvice": string (optional),
  "recommendedAction": string
}
`.trim();

  return buildSecuredPrompt({
    personaInstruction: SHANKY_SYSTEM_INSTRUCTION,
    trustedData: {
      authoritativeAttendanceData: {
        subjectName: context.subjectName,
        currentPercentage: context.currentAttendance,
        targetPercentage: context.targetAttendance,
        attendedClasses: context.attendedClasses,
        conductedClasses: context.conductedClasses,
        safeBunkCapacity: context.safeBunkCapacity,
        recoveryNeeded: context.recoveryNeeded,
        attendancePressure: context.attendancePressure,
        trend: context.trend,
        nextClassDate: context.nextClassDate,
      },
      requiredOutputSchema: schemaDescription,
    },
    userRequest: `Explain the student's attendance situation for "${context.subjectName}".
Rules:
1. You MUST copy the deterministic numeric values directly into the output. Do NOT recalculate or modify them.
2. Explain clearly in conversational, student-friendly terms why they are in this zone.
3. If safeBunkCapacity > 0, explain that they can safely miss up to that many classes while maintaining their target.
4. If recoveryNeeded > 0, explain how many consecutive classes must be attended to recover.
5. Provide one actionable, realistic recommendation for the student.`,
  });
}

export function buildDailyBriefingPrompt(context: DailyBriefingRequest): string {
  const schemaDescription = `
Return ONLY valid JSON matching this exact structure:
{
  "greeting": string,
  "summaryDate": string,
  "headline": string,
  "attendanceAlert": {
    "subjectName": string,
    "currentAttendance": number,
    "status": "safe" | "watch" | "danger",
    "advice": string
  } (optional),
  "scheduleHighlights": string[],
  "priorityTasks": string[],
  "actionRecommendation": string
}
`.trim();

  return buildSecuredPrompt({
    personaInstruction: SHANKY_SYSTEM_INSTRUCTION,
    trustedData: {
      date: context.dateString,
      todayClasses: context.todayClasses,
      pendingTasks: context.pendingTasks,
      attendanceAlerts: context.attendanceAlerts,
      upcomingExams: context.upcomingExams,
      requiredOutputSchema: schemaDescription,
    },
    userRequest: `Generate a snappy, motivating daily briefing for the student answering "What should I do today?".
Highlight their critical academic priorities, flag any danger-zone classes they cannot miss, and recommend what task to tackle first. Keep it concise and practical.`,
  });
}

export function buildTaskBreakdownPrompt(context: TaskBreakdownRequest): string {
  const schemaDescription = `
Return ONLY valid JSON matching this exact structure:
{
  "parentTitle": string,
  "subjectName": string (optional),
  "subtasks": [
    {
      "title": string,
      "estimatedMinutes": number,
      "orderIndex": number
    }
  ]
}
`.trim();

  return buildSecuredPrompt({
    personaInstruction: SHANKY_SYSTEM_INSTRUCTION,
    trustedData: {
      taskTitle: context.taskTitle,
      taskDescription: context.taskDescription,
      subjectName: context.subjectName,
      requiredOutputSchema: schemaDescription,
    },
    untrustedContent: context.taskDescription
      ? [{ tag: 'untrusted_student_note', content: context.taskDescription }]
      : undefined,
    userRequest: `Break down this academic task/assignment into 3 to 5 clear, actionable subtasks.
Each subtask should take between 15 and 90 minutes.
Order them in a sensible chronological sequence.`,
  });
}

export function buildProfileSetupPrompt(userInput: string): string {
  const schemaDescription = `
Return ONLY valid JSON matching this exact structure:
{
  "studentName": string (optional),
  "collegeName": string (optional),
  "program": string (optional),
  "semesterName": string (optional),
  "attendanceTarget": number (optional, integer between 50 and 95),
  "subjects": [
    {
      "name": string,
      "code": string (optional)
    }
  ] (optional)
}
`.trim();

  return buildSecuredPrompt({
    personaInstruction: SHANKY_SYSTEM_INSTRUCTION,
    trustedData: {
      requiredOutputSchema: schemaDescription,
    },
    untrustedContent: [
      { tag: 'untrusted_user_content', content: userInput },
    ],
    userRequest: `Extract candidate student profile and academic setup information from the user's natural language input.
Only extract information that is explicitly stated or strongly implied.
Leave missing fields null or undefined.
Default attendanceTarget to 75 if not specified.`,
  });
}

export function buildConversationalChatPrompt(context: ConversationalChatRequest): string {
  const schemaDescription = `
Return ONLY valid JSON matching this exact structure:
{
  "reply": string,
  "suggestedActions": string[],
  "actionType": "view_attendance" | "view_tasks" | "view_schedule" | "create_subtasks" | "general",
  "relatedSubjectId": string (optional)
}
`.trim();

  const historyText = context.conversationHistory && context.conversationHistory.length > 0
    ? context.conversationHistory.slice(-4).map(m => `${m.sender === 'user' ? 'Student' : 'Shanky'}: ${m.text}`).join('\n')
    : undefined;

  return buildSecuredPrompt({
    personaInstruction: `${SHANKY_SYSTEM_INSTRUCTION}
You are Shanky, the agile, witty, logic-focused academic companion for college students.
CRITICAL MATHEMATICAL INTEGRITY RULES:
1. NEVER recalculate or hallucinate attendance percentages, safe bunks, or recovery classes.
2. If the student asks about attendance, rely strictly on the authoritative attendance data provided in trustedData.
3. If the student asks about today or their schedule, refer to the provided today's timetable classes.
4. If the student asks what to study or pending work, refer to the pending tasks and upcoming exams.
5. You can answer ANY question asked by the student: programming, math, physics, engineering, study hacks, exam strategies, formal emails, or everyday college life! Answer helpfully, accurately, and with Shanky's energetic, direct tone.`,
    trustedData: {
      studentAttendance: context.attendanceSummary,
      todaySchedule: context.todayClasses,
      pendingTasks: context.pendingTasks,
      upcomingExams: context.upcomingExams,
      recentConversation: historyText,
      requiredOutputSchema: schemaDescription,
    },
    untrustedContent: [
      { tag: 'student_chat_message', content: context.userMessage },
    ],
    userRequest: `Respond to the student's message: "${context.userMessage}". Answer directly, helpfully, and engagingly in valid JSON matching the schema. You are fully equipped to answer any academic or general question asked.`,
  });
}

