/**
 * KaryaDEX — Feature: Academic Calendar & Holiday Extraction (Phase 12.2 Banku)
 *
 * Upload official college circular / calendar / notice image or PDF ->
 * File security & magic-byte validation ->
 * Banku multimodal extraction (gemini-3.8-flash) ->
 * Runtime schema validation ->
 * AIProposal creation (Draft -> Preview -> Confirmation -> Save) ->
 * Transactional persistence via semesterRepository and examRepository.
 */

import { fileStorageService } from '@/services/fileStorageService';
import { semesterRepository, examRepository, settingsRepository, subjectRepository } from '@/database';
import { aiClient } from '../core/aiClient';
import { AIValidation } from '../core/aiValidation';
import { buildCalendarExtractionPrompt } from '../prompts/bankuPrompts';
import type {
  AIProposal,
  AIResponse,
  CalendarProposalPayload,
  BaseAIRequest,
} from '../core/aiTypes';
import { AIInvalidRequestError } from '../core/aiTypes';
import { useAppStore } from '@/store/useAppStore';

export class CalendarExtractionFeature {
  /**
   * Pre-validates calendar file, extracts semester dates, holidays, and exam periods via Banku,
   * validates against strict schema, and produces an AIProposal.
   */
  static async extractCalendarProposal(params: {
    userId: string;
    fileBase64: string;
    fileMimeType: string;
    fileName: string;
    fileSizeBytes: number;
    magicBytes?: number[];
  }): Promise<AIResponse<CalendarProposalPayload> & { proposal?: AIProposal<CalendarProposalPayload> }> {
    // 1. File Security Validation
    const fileValidation = fileStorageService.validateUserFile(
      params.fileName,
      params.fileSizeBytes,
      params.fileMimeType
    );
    if (!fileValidation.isValid) {
      throw new AIInvalidRequestError(`File security error: ${fileValidation.error}`);
    }

    if (params.magicBytes) {
      const magicValidation = fileStorageService.validateMagicBytes(
        params.magicBytes,
        params.fileName
      );
      if (!magicValidation.isValid) {
        throw new AIInvalidRequestError(`Magic byte validation failed: ${magicValidation.error}`);
      }
    }

    const requestContext: BaseAIRequest = {
      userId: params.userId,
      persona: 'banku',
      feature: 'calendar_extraction',
      requiresVision: true,
      requiresPDF: params.fileMimeType === 'application/pdf',
      clientTimestamp: new Date().toISOString(),
    };

    // 2. Build prompt and execute via Banku
    let cleanBase64 = params.fileBase64;
    let resolvedMime = params.fileMimeType;
    if (typeof cleanBase64 === 'string') {
      if (cleanBase64.includes(',')) {
        const parts = cleanBase64.split(',');
        const match = parts[0].match(/^data:([^;]+)/i);
        if (match && match[1] && !resolvedMime) {
          resolvedMime = match[1];
        }
        cleanBase64 = parts[1];
      }
      cleanBase64 = cleanBase64.replace(/\s/g, '');
    }

    const prompt = buildCalendarExtractionPrompt();
    const schemaDesc = `{"semesterName"?: string, "startDate"?: string, "endDate"?: string, "holidays": [{"date": string, "name": string, "isOfficial": boolean, "confidence"?: number}], "exams": [{"title": string, "startDate": string, "endDate"?: string, "type"?: string}], "deadlines"?: [{"title": string, "date": string}]}`;

    const rawResponse = await aiClient.executeMultimodal<CalendarProposalPayload>({
      request: requestContext,
      prompt,
      mediaBase64: cleanBase64,
      mimeType: resolvedMime,
      schemaDescription: schemaDesc,
    });

    // 3. Runtime Output Validation
    const validatedData = AIValidation.validateCalendarPayload(rawResponse.data);

    // 4. Create AIProposal for preview & explicit confirmation
    const eventCount = validatedData.holidays.length + validatedData.exams.length + (validatedData.deadlines?.length || 0);
    const proposal: AIProposal<CalendarProposalPayload> = {
      id: `prop_cal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'IMPORT_CALENDAR',
      title: `Import Calendar: ${validatedData.semesterName || 'Academic Schedule'}`,
      description: `Extracted ${validatedData.holidays.length} holiday(s), ${validatedData.exams.length} exam period(s)${validatedData.startDate ? `, semester starts ${validatedData.startDate}` : ''}.`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      userId: params.userId,
      payload: validatedData,
    };

    return {
      ...rawResponse,
      data: validatedData,
      proposal,
    };
  }

  /**
   * Applies the approved calendar proposal to SQLite.
   * MUST only be called after explicit user confirmation.
   */
  static async applyApprovedProposal(
    proposal: AIProposal<CalendarProposalPayload>,
    activeSemesterId?: string
  ): Promise<{ savedHolidaysCount: number; savedExamsCount: number; updatedSemester: boolean }> {
    if (proposal.status === 'applied') {
      throw new Error('This calendar proposal has already been applied.');
    }

    const payload = proposal.payload;
    let updatedSemester = false;
    let savedExamsCount = 0;
    let savedHolidaysCount = 0;

    // 1. Resolve active semester and update start/end dates if available
    let semId = activeSemesterId;
    if (!semId || semId === 'sem-current') {
      const activeSem = await subjectRepository.getSemester();
      semId = activeSem?.id || 'sem-3';
    }

    try {
      if (payload.startDate || payload.endDate) {
        const activeSem = await semesterRepository.getSemesterById(semId);
        if (activeSem) {
          await semesterRepository.updateSemester(semId, {
            startDate: payload.startDate || activeSem.startDate,
            endDate: payload.endDate || activeSem.endDate,
            name: payload.semesterName || activeSem.name,
          });
          updatedSemester = true;
        }
      }
    } catch (e) {
      console.warn('[CalendarExtraction] Semester update warning:', e);
    }

    // 2. Save extracted exams
    for (const exam of payload.exams) {
      try {
        await examRepository.createExam({
          id: `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          subjectId: '', // General / multi-subject exam
          name: exam.title,
          type: (exam.type === 'internal' || exam.type === 'practical' || exam.type === 'final' ? exam.type : 'internal') as any,
          date: exam.startDate,
          time: '10:00',
          maxMarks: 100,
          weightage: 30,
          semesterId: semId,
        });
        savedExamsCount++;
      } catch (e) {
        console.warn('[CalendarExtraction] Exam creation warning:', e);
      }
    }

    // 3. Store official holidays in app_settings JSON cache for calendar & schedule views
    if (payload.holidays.length > 0) {
      try {
        const existingHolidaysRaw = await settingsRepository.getSetting('academic_holidays_json').catch(() => null);
        let existingHolidays: any[] = [];
        if (existingHolidaysRaw) {
          try {
            existingHolidays = JSON.parse(existingHolidaysRaw);
          } catch {}
        }

        const mergedHolidays = [...existingHolidays];
        const dateSet = new Set(existingHolidays.map(h => h.date));

        for (const h of payload.holidays) {
          if (!dateSet.has(h.date)) {
            mergedHolidays.push(h);
            dateSet.add(h.date);
            savedHolidaysCount++;
          }
        }

        await settingsRepository.setSetting('academic_holidays_json', JSON.stringify(mergedHolidays));
      } catch (e) {
        console.warn('[CalendarExtraction] Holidays store warning:', e);
      }
    }

    proposal.status = 'applied';
    proposal.appliedAt = new Date().toISOString();

    // Refresh reactive stores so UI immediately displays new calendar dates & exams
    await useAppStore.getState().refreshFromDatabase().catch(err => {
      console.warn('[CalendarExtraction] Error refreshing stores:', err);
    });

    return { savedHolidaysCount, savedExamsCount, updatedSemester };
  }
}
