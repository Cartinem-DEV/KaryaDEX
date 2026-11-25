/**
 * KaryaDEX — Feature: Syllabus & Topics Extraction (Phase 12.2 Banku)
 *
 * Upload syllabus image / PDF ->
 * File security & magic-byte validation ->
 * Banku multimodal extraction (gemini-3.8-flash) ->
 * Runtime schema validation ->
 * AIProposal creation (Draft -> Preview -> Confirmation -> Save) ->
 * Transactional persistence via syllabusRepository.
 */

import { fileStorageService } from '@/services/fileStorageService';
import { syllabusRepository, subjectRepository } from '@/database';
import { aiClient } from '../core/aiClient';
import { AIValidation } from '../core/aiValidation';
import { buildSyllabusExtractionPrompt } from '../prompts/bankuPrompts';
import type {
  AIProposal,
  AIResponse,
  SyllabusProposalPayload,
  BaseAIRequest,
} from '../core/aiTypes';
import { AIInvalidRequestError } from '../core/aiTypes';
import { useAppStore } from '@/store/useAppStore';

export interface SyllabusFileInput {
  base64Data?: string;
  fileBase64?: string;
  mimeType?: string;
  fileMimeType?: string;
  fileName?: string;
  fileSizeBytes?: number;
  magicBytes?: number[];
}

export interface ExtractSyllabusProposalParams {
  userId: string;
  fileBase64?: string;
  fileMimeType?: string;
  fileName?: string;
  fileSizeBytes?: number;
  magicBytes?: number[];
  files?: SyllabusFileInput[];
  targetSubjectId?: string;
}

export class SyllabusExtractionFeature {
  /**
   * Pre-validates syllabus file(s), extracts units and topics via Banku,
   * validates against strict schema, and produces an AIProposal.
   * Supports single file or multiple attachments (PDFs + images simultaneously).
   */
  static async extractSyllabusProposal(
    params: ExtractSyllabusProposalParams
  ): Promise<AIResponse<SyllabusProposalPayload> & { proposal?: AIProposal<SyllabusProposalPayload> }> {
    // 1. Normalize and resolve input files
    const inputFiles: SyllabusFileInput[] = [];
    if (params.files && params.files.length > 0) {
      inputFiles.push(...params.files);
    } else if (params.fileBase64) {
      inputFiles.push({
        fileBase64: params.fileBase64,
        fileMimeType: params.fileMimeType,
        fileName: params.fileName,
        fileSizeBytes: params.fileSizeBytes,
        magicBytes: params.magicBytes,
      });
    }

    if (inputFiles.length === 0) {
      throw new AIInvalidRequestError('At least one syllabus document or photo must be provided for extraction.');
    }

    // 2. File Security Validation for each staged file
    for (const f of inputFiles) {
      const fName = f.fileName || (f.fileMimeType?.includes('pdf') || f.mimeType?.includes('pdf') ? 'syllabus.pdf' : 'syllabus.png');
      const fMime = f.fileMimeType || f.mimeType || 'application/pdf';
      const fSize = f.fileSizeBytes || (f.fileBase64 || f.base64Data ? Math.round(((f.fileBase64 || f.base64Data)!.length * 3) / 4) : 1024);

      const fileValidation = fileStorageService.validateUserFile(fName, fSize, fMime);
      if (!fileValidation.isValid) {
        throw new AIInvalidRequestError(`File security error in "${fName}": ${fileValidation.error}`);
      }

      if (f.magicBytes) {
        const magicValidation = fileStorageService.validateMagicBytes(f.magicBytes, fName);
        if (!magicValidation.isValid) {
          throw new AIInvalidRequestError(`Magic byte validation failed in "${fName}": ${magicValidation.error}`);
        }
      }
    }

    // 3. Fetch existing subjects for context
    const existingSubjects = await subjectRepository.getSubjects().catch(() => []);
    const targetSubject = params.targetSubjectId
      ? existingSubjects.find(s => s.id === params.targetSubjectId)
      : undefined;

    // 4. Sanitize all media parts (strip data: prefix & whitespace)
    const mediaParts: Array<{ base64: string; mimeType: string; fileName?: string }> = [];
    for (const f of inputFiles) {
      let rawB64 = f.fileBase64 || f.base64Data || '';
      let resolvedMime = f.fileMimeType || f.mimeType || 'application/pdf';
      if (typeof rawB64 === 'string') {
        if (rawB64.includes(',')) {
          const parts = rawB64.split(',');
          const match = parts[0].match(/^data:([^;]+)/i);
          if (match && match[1] && !resolvedMime) {
            resolvedMime = match[1];
          }
          rawB64 = parts[1];
        }
        rawB64 = rawB64.replace(/\s/g, '');
      }

      mediaParts.push({
        base64: rawB64,
        mimeType: resolvedMime,
        fileName: f.fileName,
      });
    }

    const hasPdf = mediaParts.some(p => p.mimeType.toLowerCase().includes('pdf'));

    const requestContext: BaseAIRequest = {
      userId: params.userId,
      persona: 'banku',
      feature: 'syllabus_extraction',
      requiresVision: true,
      requiresPDF: hasPdf,
      clientTimestamp: new Date().toISOString(),
    };

    // 5. Build prompt and execute via Banku
    const prompt = buildSyllabusExtractionPrompt(
      targetSubject?.name,
      existingSubjects.map(s => s.name)
    );
    const schemaDesc = `{"subjectName": string, "subjectCode"?: string, "credits"?: number, "units": [{"name": string, "topics": [{"name": string, "subtopics"?: string[]}]}], "subjects"?: [{"subjectName": string, "subjectCode"?: string, "credits"?: number, "units": [{"name": string, "topics": [{"name": string, "subtopics"?: string[]}]}]}]}`;

    const rawResponse = await aiClient.executeMultimodal<SyllabusProposalPayload>({
      request: requestContext,
      prompt,
      mediaBase64: mediaParts[0]?.base64,
      mimeType: mediaParts[0]?.mimeType,
      mediaParts,
      schemaDescription: schemaDesc,
    });

    // 6. Runtime Output Validation
    const validatedData = AIValidation.validateSyllabusPayload(rawResponse.data);

    // 7. Create AIProposal for preview & explicit confirmation
    const totalSubjects = validatedData.subjects?.length || 1;
    const totalTopics = validatedData.subjects
      ? validatedData.subjects.reduce(
          (acc, s) => acc + s.units.reduce((uAcc, u) => uAcc + u.topics.length, 0),
          0
        )
      : validatedData.units.reduce((acc, u) => acc + u.topics.length, 0);

    const proposal: AIProposal<SyllabusProposalPayload> = {
      id: `prop_syl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'IMPORT_SYLLABUS',
      title: totalSubjects > 1
        ? `Import Curriculum (${totalSubjects} Subjects)`
        : `Import Syllabus: ${validatedData.subjectName}`,
      description: totalSubjects > 1
        ? `Extracted ${totalSubjects} subjects and ${totalTopics} topics across attached documents.`
        : `Extracted ${validatedData.units.length} unit(s) and ${totalTopics} topic(s).`,
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
   * Applies the approved syllabus proposal to SQLite.
   * MUST only be called after explicit user confirmation.
   * Does NOT mark any topic as taught, revised, or mastered.
   */
  static async applyApprovedProposal(
    proposal: AIProposal<SyllabusProposalPayload>,
    targetSubjectId?: string
  ): Promise<{ savedUnitsCount: number; savedTopicsCount: number }> {
    if (proposal.status === 'applied') {
      throw new Error('This syllabus proposal has already been applied.');
    }

    const activeSemester = await subjectRepository.getSemester();
    const activeSemesterId = activeSemester?.id || 'sem-3';

    let savedUnitsCount = 0;
    let savedTopicsCount = 0;

    // Check if proposal contains multiple subjects
    const subjectsToProcess = proposal.payload.subjects && proposal.payload.subjects.length > 0
      ? proposal.payload.subjects
      : [
          {
            subjectName: proposal.payload.subjectName,
            subjectCode: proposal.payload.subjectCode,
            credits: proposal.payload.credits,
            category: proposal.payload.category,
            units: proposal.payload.units,
          },
        ];

    const existingSubjects = await subjectRepository.getSubjects().catch(() => []);

    for (const subj of subjectsToProcess) {
      let subjId = targetSubjectId;

      if (!subjId || subjectsToProcess.length > 1) {
        // Find existing subject by name/code or create new
        const normName = subj.subjectName.toLowerCase().trim();
        const matched = existingSubjects.find(
          s => s.name.toLowerCase().trim() === normName ||
               (subj.subjectCode && s.code?.toLowerCase().trim() === subj.subjectCode.toLowerCase().trim())
        );

        if (matched) {
          subjId = matched.id;
        } else {
          subjId = `subj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await subjectRepository.createSubject({
            id: subjId,
            name: subj.subjectName,
            code: subj.subjectCode || subj.subjectName.slice(0, 4).toUpperCase() + '101',
            shortName: subj.subjectCode || subj.subjectName.slice(0, 6).toUpperCase(),
            color: '#3B82F6',
            credits: subj.credits || 4,
            semesterId: activeSemesterId,
            facultyId: 'fac-default',
            subjectType: 'lecture',
            targetAttendance: 75,
          }).catch(() => {});
        }
      }

      const existingUnits = await syllabusRepository.getUnitsForSubject(subjId).catch(() => []);

      for (let uIdx = 0; uIdx < subj.units.length; uIdx++) {
        const unit = subj.units[uIdx];
        const normUnitName = unit.name.toLowerCase().trim();

        let unitId: string;
        const existingUnit = existingUnits.find(u => u.name.toLowerCase().trim() === normUnitName);

        if (existingUnit) {
          unitId = existingUnit.id;
        } else {
          const createdUnit = await syllabusRepository.createUnit({
            id: `unit_${Date.now()}_${uIdx}_${Math.random().toString(36).slice(2, 6)}`,
            subjectId: subjId,
            semesterId: activeSemesterId,
            name: unit.name,
            order: existingUnits.length + uIdx + 1,
            topicIds: [],
          });
          unitId = createdUnit.id;
          savedUnitsCount++;
        }

        const existingTopics = await syllabusRepository.getTopicsForUnit(unitId).catch(() => []);
        const existingTopicNames = new Set(existingTopics.map(t => t.name.toLowerCase().trim()));

        for (let tIdx = 0; tIdx < unit.topics.length; tIdx++) {
          const topic = unit.topics[tIdx];
          if (!existingTopicNames.has(topic.name.toLowerCase().trim())) {
            await syllabusRepository.createTopic({
              id: `topic_${Date.now()}_${tIdx}_${Math.random().toString(36).slice(2, 6)}`,
              unitId,
              subjectId: subjId,
              name: topic.name,
              order: tIdx + 1,
              isCompleted: false, // Strictly uncompleted; extraction does not imply mastery
              revisionStatus: 'not_started',
              revisionCount: 0,
              classNoteIds: [],
            });
            savedTopicsCount++;
          }
        }
      }
    }

    proposal.status = 'applied';
    proposal.appliedAt = new Date().toISOString();

    // Refresh reactive stores so UI immediately displays new units & topics
    await useAppStore.getState().refreshFromDatabase().catch(err => {
      console.warn('[SyllabusExtraction] Error refreshing stores:', err);
    });

    return { savedUnitsCount, savedTopicsCount };
  }
}
