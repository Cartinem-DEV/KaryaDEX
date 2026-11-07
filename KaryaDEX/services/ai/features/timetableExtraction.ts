/**
 * BunkMatKar — Feature 1: Timetable & Routine Extraction (Phase 12 Banku MVP)
 *
 * Upload routine image / screenshot / PDF ->
 * File security & magic-byte validation ->
 * Banku multimodal parsing ->
 * Schema validation ->
 * Timetable conflict engine check ->
 * Structured AIProposal creation ->
 * User preview & confirmation ->
 * Transactional persistence via TimetableRepository.
 */

import { fileStorageService } from '@/services/fileStorageService';
import { timetableRepository, subjectRepository } from '@/database';
import { aiClient } from '../core/aiClient';
import { AIContextBuilder } from '../core/aiContextBuilder';
import { AIValidation } from '../core/aiValidation';
import { buildTimetableExtractionPrompt } from '../prompts/bankuPrompts';
import type {
  AIProposal,
  AIResponse,
  TimetableSlotProposalPayload,
} from '../core/aiTypes';
import { AIInvalidRequestError } from '../core/aiTypes';
import { useAppStore } from '@/store/useAppStore';
import type { TimetableSlot } from '@/types/academic';

export class TimetableExtractionFeature {
  /**
   * Pre-validates the file, extracts timetable slots via Banku,
   * performs schedule conflict checks, and produces an AIProposal.
   */
  static async extractTimetableProposal(params: {
    userId: string;
    fileBase64: string;
    fileMimeType: string;
    fileName: string;
    fileSizeBytes: number;
    magicBytes?: number[];
  }): Promise<AIResponse<TimetableSlotProposalPayload[]>> {
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

    // 2. Build Context
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

    const context = await AIContextBuilder.buildTimetableExtractionContext({
      userId: params.userId,
      fileBase64: cleanBase64,
      fileMimeType: resolvedMime,
      fileName: params.fileName,
      fileSizeBytes: params.fileSizeBytes,
    });

    // 3. Multimodal Banku Extraction
    const prompt = buildTimetableExtractionPrompt(context.existingSubjects);
    const schemaDesc = `{"slots": [{"dayOfWeek": string, "startTime": "HH:MM", "endTime": "HH:MM", "subjectName": string, "room": string, "teacher": string, "type": string, "confidence": number}]}`;

    const rawResponse = await aiClient.executeMultimodal<{ slots: any[] }>({
      request: context,
      prompt,
      mediaBase64: cleanBase64,
      mimeType: resolvedMime,
      schemaDescription: schemaDesc,
    });

    // 4. Runtime Output Validation
    const validatedSlots = AIValidation.validateTimetableSlots(rawResponse.data.slots || []);

    // 5. Conflict Checking against Existing Timetable Engine
    const existingSlots = await timetableRepository.getTimetableSlots(true);
    const subjects = await subjectRepository.getSubjects();
    const subjMap = new Map(subjects.map(s => [s.id, s.name]));

    const checkedSlots: TimetableSlotProposalPayload[] = validatedSlots.map(slot => {
      const daySlots = existingSlots.filter(s => s.dayOfWeek.toLowerCase() === slot.dayOfWeek.toLowerCase());
      let conflictWarning: string | undefined;

      for (const ex of daySlots) {
        // Overlap condition: startA < endB && startB < endA
        if (slot.startTime < ex.endTime && ex.startTime < slot.endTime) {
          const exSubj = subjMap.get(ex.subjectId) || 'Class';
          conflictWarning = `Conflicts with ${exSubj} (${ex.startTime}–${ex.endTime}) on ${slot.dayOfWeek}`;
          break;
        }
      }

      return {
        ...slot,
        conflictWarning,
      };
    });

    // 6. Create Proposal (Zero direct DB writes)
    const proposal: AIProposal<TimetableSlotProposalPayload[]> = {
      id: `prop_tt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'IMPORT_TIMETABLE',
      title: `Import ${checkedSlots.length} Timetable Slots`,
      description: `Extracted from ${params.fileName} by Banku. Requires your confirmation.`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      userId: params.userId,
      payload: checkedSlots,
    };

    return {
      ...rawResponse,
      data: checkedSlots,
      proposal,
    };
  }

  /**
   * Applies the approved proposal to SQLite.
   * MUST only be called after explicit user confirmation.
   */
  static async applyApprovedProposal(
    proposal: AIProposal<TimetableSlotProposalPayload[]>,
    confirmedSlotIndices?: number[]
  ): Promise<{ savedCount: number }> {
    if (proposal.status === 'applied') {
      throw new Error('This timetable proposal has already been applied.');
    }

    const slotsToSave = confirmedSlotIndices
      ? proposal.payload.filter((_, idx) => confirmedSlotIndices.includes(idx))
      : proposal.payload;

    if (slotsToSave.length === 0) {
      return { savedCount: 0 };
    }

    const existingSubjects = await subjectRepository.getSubjects();
    const activeSemester = await subjectRepository.getSemester();
    const activeSemesterId = activeSemester?.id || 'sem-3';
    const subjectNameToId = new Map(existingSubjects.map(s => [s.name.toLowerCase().trim(), s.id]));

    let savedCount = 0;

    for (const slot of slotsToSave) {
      const normSubjName = slot.subjectName.toLowerCase().trim();
      let subjectId = subjectNameToId.get(normSubjName);

      // Create subject if it doesn't exist yet
      if (!subjectId) {
        const newSubject = await subjectRepository.createSubject({
          id: `subj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: slot.subjectName,
          shortName: slot.subjectName.slice(0, 4).toUpperCase(),
          code: slot.subjectCode || slot.subjectName.slice(0, 3).toUpperCase(),
          color: '#3B82F6',
          semesterId: activeSemesterId,
          facultyId: '',
          credits: 3,
          targetAttendance: 75,
        });
        subjectId = newSubject.id;
        subjectNameToId.set(normSubjName, subjectId);
      }

      const classType = slot.type === 'lab' || slot.type === 'tutorial' ? slot.type : 'lecture';

      const slotRecord: TimetableSlot = {
        id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        subjectId,
        semesterId: activeSemesterId,
        dayOfWeek: slot.dayOfWeek as any,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room || '',
        type: classType,
        isActive: true,
        isRecurring: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await timetableRepository.createTimetableSlot(slotRecord);
      savedCount++;
    }

    proposal.status = 'applied';
    proposal.appliedAt = new Date().toISOString();

    // Refresh reactive stores so UI immediately displays new subjects & slots
    await useAppStore.getState().refreshFromDatabase().catch(err => {
      console.warn('[TimetableExtraction] Error refreshing stores:', err);
    });

    return { savedCount };
  }
}
