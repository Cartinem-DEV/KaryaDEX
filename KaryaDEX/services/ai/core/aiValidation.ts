/**
 * BunkMatKar — AI Structured Output Validator (Phase 12)
 *
 * Enforces runtime schema validation and data integrity on all AI outputs.
 * Prevents model hallucinations, invalid IDs, malformed dates, and fabricated numbers.
 */

import { AIInvalidRequestError } from './aiTypes';
import type {
  TimetableSlotProposalPayload,
  TaskBreakdownProposalPayload,
  ProfileSetupProposalPayload,
  DailyBriefingPayload,
  AttendanceExplanationPayload,
  ConversationalChatPayload,
  SyllabusProposalPayload,
  ExtractedSubjectProposalItem,
  CalendarProposalPayload,
} from './aiTypes';

export class AIValidation {
  private static readonly VALID_DAYS = new Set([
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ]);

  private static readonly TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

  /**
   * Validates extracted timetable slots.
   */
  static validateTimetableSlots(rawSlots: any[]): TimetableSlotProposalPayload[] {
    if (!Array.isArray(rawSlots)) {
      throw new AIInvalidRequestError('Extracted timetable output must contain an array of slots.');
    }

    if (rawSlots.length === 0) {
      throw new AIInvalidRequestError('No timetable slots could be detected in the document.');
    }

    if (rawSlots.length > 50) {
      throw new AIInvalidRequestError('Extracted slots exceed allowable safety limit of 50.');
    }

    const validated: TimetableSlotProposalPayload[] = [];

    for (let i = 0; i < rawSlots.length; i++) {
      const slot = rawSlots[i];
      if (!slot || typeof slot !== 'object') {
        throw new AIInvalidRequestError(`Slot at index ${i} is not a valid object.`);
      }

      const dayOfWeek = (slot.dayOfWeek || '').toLowerCase().trim();
      if (!this.VALID_DAYS.has(dayOfWeek)) {
        throw new AIInvalidRequestError(`Invalid day of week '${slot.dayOfWeek}' at index ${i}.`);
      }

      const startTime = (slot.startTime || '').trim();
      const endTime = (slot.endTime || '').trim();

      if (!this.TIME_REGEX.test(startTime) || !this.TIME_REGEX.test(endTime)) {
        throw new AIInvalidRequestError(`Invalid time format at index ${i}: startTime='${startTime}', endTime='${endTime}'. Expected HH:MM.`);
      }

      if (endTime <= startTime) {
        throw new AIInvalidRequestError(`Class endTime (${endTime}) must be strictly after startTime (${startTime}) at index ${i}.`);
      }

      const subjectName = (slot.subjectName || '').trim();
      if (!subjectName || subjectName.length < 2 || subjectName.length > 100) {
        throw new AIInvalidRequestError(`Invalid subject name '${subjectName}' at index ${i}.`);
      }

      validated.push({
        dayOfWeek,
        startTime,
        endTime,
        subjectName,
        subjectCode: slot.subjectCode ? String(slot.subjectCode).trim().slice(0, 20) : undefined,
        room: slot.room ? String(slot.room).trim().slice(0, 30) : undefined,
        teacher: slot.teacher ? String(slot.teacher).trim().slice(0, 60) : undefined,
        type: ['lecture', 'lab', 'tutorial', 'other'].includes(slot.type) ? slot.type : 'lecture',
        confidence: typeof slot.confidence === 'number' ? Math.max(0, Math.min(1, slot.confidence)) : 0.8,
      });
    }

    return validated;
  }

  /**
   * Validates task breakdown payload.
   */
  static validateTaskBreakdown(raw: any): TaskBreakdownProposalPayload {
    if (!raw || typeof raw !== 'object') {
      throw new AIInvalidRequestError('Task breakdown output must be a valid object.');
    }

    const parentTitle = (raw.parentTitle || '').trim();
    if (!parentTitle || parentTitle.length > 200) {
      throw new AIInvalidRequestError('Invalid task breakdown parent title.');
    }

    if (!Array.isArray(raw.subtasks) || raw.subtasks.length < 1 || raw.subtasks.length > 10) {
      throw new AIInvalidRequestError('Task breakdown must contain between 1 and 10 subtasks.');
    }

    const subtasks = raw.subtasks.map((st: any, idx: number) => {
      const title = (st.title || '').trim();
      if (!title || title.length > 150) {
        throw new AIInvalidRequestError(`Invalid subtask title at index ${idx}.`);
      }
      const mins = Number(st.estimatedMinutes) || 30;
      return {
        title,
        estimatedMinutes: Math.min(240, Math.max(5, mins)),
        orderIndex: idx + 1,
      };
    });

    return {
      parentTitle,
      subjectName: raw.subjectName ? String(raw.subjectName).trim().slice(0, 100) : undefined,
      subtasks,
    };
  }

  /**
   * Validates profile setup proposal.
   */
  static validateProfileSetup(raw: any): ProfileSetupProposalPayload {
    if (!raw || typeof raw !== 'object') {
      throw new AIInvalidRequestError('Profile setup output must be a valid object.');
    }

    const target = raw.attendanceTarget !== undefined ? Number(raw.attendanceTarget) : undefined;
    if (target !== undefined && (isNaN(target) || target < 50 || target > 95)) {
      throw new AIInvalidRequestError('Attendance target must be between 50 and 95.');
    }

    let subjects: Array<{ name: string; code?: string }> | undefined;
    if (Array.isArray(raw.subjects)) {
      subjects = raw.subjects
        .filter((s: any) => s && typeof s.name === 'string' && s.name.trim().length > 0)
        .map((s: any) => ({
          name: s.name.trim().slice(0, 100),
          code: s.code ? String(s.code).trim().slice(0, 20) : undefined,
        }));
    }

    return {
      studentName: raw.studentName ? String(raw.studentName).trim().slice(0, 60) : undefined,
      collegeName: raw.collegeName ? String(raw.collegeName).trim().slice(0, 100) : undefined,
      program: raw.program ? String(raw.program).trim().slice(0, 80) : undefined,
      semesterName: raw.semesterName ? String(raw.semesterName).trim().slice(0, 30) : undefined,
      attendanceTarget: target,
      subjects,
    };
  }

  /**
   * Validates attendance explanation payload against deterministic engine truth.
   * Ensures AI didn't tamper with deterministic math.
   */
  static validateAttendanceExplanation(
    raw: any,
    expectedTruth: {
      percentage: number;
      safeBunks: number;
      recoveryNeeded: number;
    }
  ): AttendanceExplanationPayload {
    if (!raw || typeof raw !== 'object') {
      throw new AIInvalidRequestError('Attendance explanation must be an object.');
    }

    // Verify deterministic integrity
    const pDiff = Math.abs((Number(raw.deterministicPercentage) || 0) - expectedTruth.percentage);
    if (pDiff > 0.1) {
      throw new AIInvalidRequestError(
        `AI output altered attendance percentage! Expected ${expectedTruth.percentage}%, got ${raw.deterministicPercentage}%.`
      );
    }

    const safeDiff = Math.abs((Number(raw.deterministicSafeBunks) || 0) - expectedTruth.safeBunks);
    if (safeDiff > 0.01) {
      throw new AIInvalidRequestError(
        `AI output altered safe bunk count! Expected ${expectedTruth.safeBunks}, got ${raw.deterministicSafeBunks}.`
      );
    }

    return {
      subjectName: String(raw.subjectName || '').trim(),
      deterministicPercentage: expectedTruth.percentage,
      deterministicTarget: Number(raw.deterministicTarget) || 75,
      deterministicSafeBunks: expectedTruth.safeBunks,
      deterministicRecoveryNeeded: expectedTruth.recoveryNeeded,
      attendancePressure: ['low', 'medium', 'high', 'critical'].includes(raw.attendancePressure)
        ? raw.attendancePressure
        : 'medium',
      trend: ['improving', 'stable', 'declining', 'insufficient_data'].includes(raw.trend)
        ? raw.trend
        : 'stable',
      situationSummary: String(raw.situationSummary || '').trim(),
      bunkAdvice: String(raw.bunkAdvice || '').trim(),
      recoveryAdvice: raw.recoveryAdvice ? String(raw.recoveryAdvice).trim() : undefined,
      recommendedAction: String(raw.recommendedAction || '').trim(),
    };
  }

  /**
   * Validates daily briefing payload.
   */
  static validateDailyBriefing(raw: any): DailyBriefingPayload {
    if (!raw || typeof raw !== 'object') {
      throw new AIInvalidRequestError('Daily briefing must be an object.');
    }

    return {
      greeting: String(raw.greeting || 'Good day!').trim().slice(0, 100),
      summaryDate: String(raw.summaryDate || '').trim(),
      headline: String(raw.headline || 'Your Academic Plan').trim().slice(0, 200),
      scheduleHighlights: Array.isArray(raw.scheduleHighlights)
        ? raw.scheduleHighlights.map((s: any) => String(s).trim()).slice(0, 5)
        : [],
      priorityTasks: Array.isArray(raw.priorityTasks)
        ? raw.priorityTasks.map((t: any) => String(t).trim()).slice(0, 5)
        : [],
      actionRecommendation: String(raw.actionRecommendation || '').trim().slice(0, 300),
      attendanceAlert: raw.attendanceAlert && typeof raw.attendanceAlert === 'object'
        ? {
            subjectName: String(raw.attendanceAlert.subjectName || '').trim(),
            currentAttendance: Number(raw.attendanceAlert.currentAttendance) || 0,
            status: ['safe', 'watch', 'danger'].includes(raw.attendanceAlert.status)
              ? raw.attendanceAlert.status
              : 'watch',
            advice: String(raw.attendanceAlert.advice || '').trim(),
          }
        : undefined,
    };
  }

  /**
   * Validates conversational chat payload.
   */
  static validateConversationalChat(raw: any): ConversationalChatPayload {
    if (!raw || typeof raw !== 'object') {
      throw new AIInvalidRequestError('Conversational chat output must be an object.');
    }

    const reply = String(raw.reply || raw.message || raw.response || '').trim();
    if (!reply) {
      throw new AIInvalidRequestError('Conversational chat reply cannot be empty.');
    }

    return {
      reply,
      suggestedActions: Array.isArray(raw.suggestedActions)
        ? raw.suggestedActions.map((a: any) => String(a).trim()).filter(Boolean).slice(0, 4)
        : undefined,
      actionType: ['view_attendance', 'view_tasks', 'view_schedule', 'create_subtasks', 'general'].includes(raw.actionType)
        ? raw.actionType
        : 'general',
      relatedSubjectId: raw.relatedSubjectId ? String(raw.relatedSubjectId).trim() : undefined,
      isDeterministicFallback: Boolean(raw.isDeterministicFallback),
    };
  }

  /**
   * Validates syllabus extraction payload.
   */
  static validateSyllabusPayload(raw: any): SyllabusProposalPayload {
    if (!raw || typeof raw !== 'object') {
      throw new AIInvalidRequestError('Syllabus output must be an object.');
    }

    const helperValidateUnits = (rawUnits: any[]): Array<{
      name: string;
      topics: Array<{ name: string; orderIndex: number; subtopics?: string[] }>;
    }> => {
      const unitsArray = Array.isArray(rawUnits) ? rawUnits : [];
      return unitsArray.map((u: any, uIdx: number) => {
        const uName = String(u.name || `Unit ${uIdx + 1}`).trim();
        const rawTopics = Array.isArray(u.topics) ? u.topics : [];
        const topics = rawTopics
          .map((t: any, tIdx: number) => {
            const tName = typeof t === 'string' ? t.trim() : String(t.name || `Topic ${tIdx + 1}`).trim();
            const subtopics = Array.isArray(t.subtopics)
              ? t.subtopics.map((st: any) => String(st).trim()).filter(Boolean)
              : undefined;
            return {
              name: tName,
              orderIndex: tIdx + 1,
              subtopics,
            };
          })
          .filter((t: any) => t.name.length > 0);

        return {
          name: uName,
          topics: topics.length > 0 ? topics : [{ name: `${uName} Core Concepts`, orderIndex: 1 }],
        };
      });
    };

    // Check if multiple subjects were extracted
    const rawSubjects = Array.isArray(raw.subjects) ? raw.subjects : [];
    let validatedSubjects: ExtractedSubjectProposalItem[] | undefined;

    if (rawSubjects.length > 0) {
      validatedSubjects = rawSubjects.map((s: any, sIdx: number) => {
        const sName = String(s.subjectName || s.name || `Subject ${sIdx + 1}`).trim();
        const sCode = s.subjectCode || s.code ? String(s.subjectCode || s.code).trim().slice(0, 20) : undefined;
        const credits = typeof s.credits === 'number' ? s.credits : (parseInt(s.credits, 10) || undefined);
        const category = s.category ? String(s.category).trim() : undefined;
        const sUnits = helperValidateUnits(s.units);

        return {
          subjectName: sName,
          subjectCode: sCode,
          credits,
          category,
          units: sUnits.length > 0 ? sUnits : [{ name: 'Unit 1: Fundamentals', topics: [{ name: 'Core Concepts', orderIndex: 1 }] }],
        };
      });
    }

    // Determine primary subject and units
    let primarySubjectName = String(raw.subjectName || (validatedSubjects && validatedSubjects[0]?.subjectName) || 'Extracted Subject').trim();
    let primarySubjectCode = raw.subjectCode ? String(raw.subjectCode).trim().slice(0, 20) : (validatedSubjects && validatedSubjects[0]?.subjectCode);
    let primaryUnits = helperValidateUnits(raw.units);

    if (primaryUnits.length === 0 && validatedSubjects && validatedSubjects.length > 0) {
      primaryUnits = validatedSubjects[0].units as any;
    }

    if (primaryUnits.length === 0) {
      throw new AIInvalidRequestError('At least one unit or module must be present in syllabus output.');
    }

    // If subjects was not explicitly provided, create single-subject array
    if (!validatedSubjects || validatedSubjects.length === 0) {
      validatedSubjects = [
        {
          subjectName: primarySubjectName,
          subjectCode: primarySubjectCode,
          credits: typeof raw.credits === 'number' ? raw.credits : (parseInt(raw.credits, 10) || undefined),
          category: raw.category ? String(raw.category).trim() : undefined,
          units: primaryUnits,
        },
      ];
    }

    return {
      subjectName: primarySubjectName,
      subjectCode: primarySubjectCode,
      credits: typeof raw.credits === 'number' ? raw.credits : (parseInt(raw.credits, 10) || undefined),
      category: raw.category ? String(raw.category).trim() : undefined,
      units: primaryUnits,
      subjects: validatedSubjects,
    };
  }

  /**
   * Validates academic calendar payload.
   */
  static validateCalendarPayload(raw: any): CalendarProposalPayload {
    if (!raw || typeof raw !== 'object') {
      throw new AIInvalidRequestError('Calendar extraction output must be an object.');
    }

    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

    const holidays = (Array.isArray(raw.holidays) ? raw.holidays : [])
      .map((h: any) => {
        const dateStr = String(h.date || '').trim();
        const name = String(h.name || '').trim();
        if (!name || !DATE_REGEX.test(dateStr)) return null;
        return {
          date: dateStr,
          name,
          isOfficial: h.isOfficial !== false,
          confidence: typeof h.confidence === 'number' ? Math.max(0, Math.min(1, h.confidence)) : 0.9,
        };
      })
      .filter(Boolean) as CalendarProposalPayload['holidays'];

    const exams = (Array.isArray(raw.exams) ? raw.exams : [])
      .map((e: any) => {
        const title = String(e.title || e.name || '').trim();
        const startDate = String(e.startDate || e.date || '').trim();
        if (!title || !DATE_REGEX.test(startDate)) return null;
        const endDate = e.endDate && DATE_REGEX.test(String(e.endDate).trim())
          ? String(e.endDate).trim()
          : undefined;
        return {
          title,
          startDate,
          endDate,
          type: e.type ? String(e.type).trim() : 'exam',
        };
      })
      .filter(Boolean) as CalendarProposalPayload['exams'];

    const deadlines = (Array.isArray(raw.deadlines) ? raw.deadlines : [])
      .map((d: any) => {
        const title = String(d.title || '').trim();
        const date = String(d.date || '').trim();
        if (!title || !DATE_REGEX.test(date)) return null;
        return { title, date };
      })
      .filter(Boolean) as CalendarProposalPayload['deadlines'];

    const startDate = raw.startDate && DATE_REGEX.test(String(raw.startDate).trim())
      ? String(raw.startDate).trim()
      : undefined;

    const endDate = raw.endDate && DATE_REGEX.test(String(raw.endDate).trim())
      ? String(raw.endDate).trim()
      : undefined;

    return {
      semesterName: raw.semesterName ? String(raw.semesterName).trim() : undefined,
      startDate,
      endDate,
      holidays,
      exams,
      deadlines,
    };
  }
}
