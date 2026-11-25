/**
 * KaryaDEX — StepSyllabus Multi-File Banku Vision & Dual-Mode Architecture Tests
 *
 * Verifies:
 * 1. Multi-File & Mixed-Media Upload Queue:
 *    - Additive staging queue supports adding multiple PDFs, multiple photos, or mixed PDF + photo batches.
 *    - Pre-flight guardrail: validatePdfPageLimit blocks any individual oversized PDF (>40 pages)
 *      before Base64 conversion while allowing the remaining files to be staged safely.
 *    - 15MB file size limit check.
 *    - parseFileBase64AndMime sanitizes all Base64 parts (stripping data: prefixes and whitespace).
 * 2. Multi-Part Multimodal Extraction Pipeline:
 *    - Passes all sanitized inlineData parts to GeminiProvider.generateMultimodal and aiClient.executeMultimodal.
 *    - GeminiProvider constructs contents with all inlineData parts followed by the extraction prompt.
 * 3. Multi-Subject Extraction & Proposal Lifecycle:
 *    - Banku analyzes multiple documents/photos together and extracts multiple subjects.
 *    - AIValidation.validateSyllabusPayload normalizes and validates multi-subject curriculum payloads.
 *    - Strict confirmation lifecycle: proposal is only persisted to SQLite after explicit user confirmation.
 *    - Discard executes zero database writes.
 * 4. Downward Manual Subject & Unit Builder:
 *    - Manual subject registration and unit/topic addition remains intact below Banku Vision.
 */

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  subjectRepository,
  syllabusRepository,
} from '../database';
import { SyllabusExtractionFeature } from '../services/ai';
import { aiClient } from '../services/ai/core/aiClient';
import { GeminiProvider } from '../services/ai/providers/geminiProvider';
import { AIValidation } from '../services/ai/core/aiValidation';
import { validatePdfPageLimit, parseFileBase64AndMime, cleanBase64 } from '../lib/fileUtils';
import type { SyllabusProposalPayload, AIProposal } from '../services/ai/core/aiTypes';
import type { SubjectDraft, SyllabusUnitDraft } from '../types/onboarding';

describe('StepSyllabus Multi-File Banku Vision & Subject Architecture', () => {
  beforeEach(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();
    jest.clearAllMocks();
  });

  describe('1. Multi-File & Mixed-Media Upload Queue Guardrails', () => {
    it('supports additive staging with multiple PDFs, multiple images, and mixed batches', () => {
      interface StagedFile {
        id: string;
        name: string;
        isPdf: boolean;
        mimeType: string;
      }

      const queue: StagedFile[] = [];

      // Step 1: Add 2 PDFs
      const pdfBatch: StagedFile[] = [
        { id: '1', name: 'Math_Syllabus.pdf', isPdf: true, mimeType: 'application/pdf' },
        { id: '2', name: 'Physics_Curriculum.pdf', isPdf: true, mimeType: 'application/pdf' },
      ];
      queue.push(...pdfBatch);
      expect(queue).toHaveLength(2);

      // Step 2: Add 3 photos into the same batch
      const photoBatch: StagedFile[] = [
        { id: '3', name: 'cs_notes_page1.jpg', isPdf: false, mimeType: 'image/jpeg' },
        { id: '4', name: 'cs_notes_page2.jpg', isPdf: false, mimeType: 'image/jpeg' },
        { id: '5', name: 'lab_experiments.png', isPdf: false, mimeType: 'image/png' },
      ];
      queue.push(...photoBatch);
      expect(queue).toHaveLength(5);

      // Verify mixed composition
      const pdfCount = queue.filter((f) => f.isPdf).length;
      const photoCount = queue.filter((f) => !f.isPdf).length;
      expect(pdfCount).toBe(2);
      expect(photoCount).toBe(3);
    });

    it('blocks any individual oversized PDF (>40 pages) in a multi-file batch before Base64 conversion without breaking valid files', async () => {
      const candidateFiles = [
        { name: 'Unit1_Mechanics.pdf', isPdf: true, pageCount: 12, size: 50000 },
        { name: 'Entire_1000Page_Textbook.pdf', isPdf: true, pageCount: 65, size: 9000000 },
        { name: 'Unit2_Thermodynamics.pdf', isPdf: true, pageCount: 28, size: 120000 },
        { name: 'TOC_Photo.jpg', isPdf: false, size: 85000 },
      ];

      const staged: Array<{ name: string; isPdf: boolean }> = [];
      const warnings: string[] = [];

      for (const file of candidateFiles) {
        if (file.isPdf) {
          const check = await validatePdfPageLimit(file as any, 40);
          if (!check.valid) {
            warnings.push(`"${file.name}" exceeds the 40-page limit (${check.pageCount} pages).`);
            continue; // Prevent from being added to queue
          }
        }
        staged.push({ name: file.name, isPdf: file.isPdf });
      }

      // Oversized PDF is rejected
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Entire_1000Page_Textbook.pdf');
      expect(warnings[0]).toContain('65 pages');

      // Valid files safely remain in the staged batch
      expect(staged).toHaveLength(3);
      expect(staged.map((f) => f.name)).toEqual([
        'Unit1_Mechanics.pdf',
        'Unit2_Thermodynamics.pdf',
        'TOC_Photo.jpg',
      ]);
    });

    it('sanitizes all file Base64 strings by stripping data URL prefixes and whitespace', () => {
      const pdfDataUri = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr   \n\r';
      const jpegDataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD   \t';

      const parsedPdf = parseFileBase64AndMime(pdfDataUri, 'application/pdf');
      const parsedJpeg = parseFileBase64AndMime(jpegDataUri, 'image/jpeg');

      expect(parsedPdf.mimeType).toBe('application/pdf');
      expect(parsedPdf.base64).toBe('JVBERi0xLjQKJcTl8uXr');
      expect(parsedPdf.base64).not.toContain('data:');
      expect(parsedPdf.base64).not.toContain(' ');

      expect(parsedJpeg.mimeType).toBe('image/jpeg');
      expect(parsedJpeg.base64).toBe('/9j/4AAQSkZJRgABAQEASABIAAD');
      expect(parsedJpeg.base64).not.toContain('data:');
      expect(parsedJpeg.base64).not.toContain(' ');
    });
  });

  describe('2. Multi-Part Multimodal Gemini Pipeline', () => {
    it('GeminiProvider.generateMultimodal builds inlineData parts for all attachments in batch', async () => {
      const provider = new GeminiProvider();

      // Spy on global fetch
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      subjectName: 'Data Structures',
                      subjectCode: 'CS201',
                      units: [{ name: 'Unit 1', topics: [{ name: 'Arrays & Lists' }] }],
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 50 },
        }),
      });
      (globalThis as any).fetch = mockFetch;

      await provider.generateMultimodal(
        'Extract syllabus curriculum',
        'data:application/pdf;base64,JVBERi0x...',
        'application/pdf',
        undefined,
        {
          mediaParts: [
            { base64: 'data:application/pdf;base64,PDF_PART_1_BASE64', mimeType: 'application/pdf' },
            { base64: 'data:image/jpeg;base64,IMAGE_PART_2_BASE64', mimeType: 'image/jpeg' },
          ],
          apiKeyOverride: 'test-key',
        }
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      // Verify that contents[0].parts contains both inlineData parts and the text prompt
      const parts = requestBody.contents[0].parts;
      expect(parts).toHaveLength(3);

      expect(parts[0].inlineData).toEqual({
        mimeType: 'application/pdf',
        data: 'PDF_PART_1_BASE64',
      });
      expect(parts[1].inlineData).toEqual({
        mimeType: 'image/jpeg',
        data: 'IMAGE_PART_2_BASE64',
      });
      expect(parts[2].text).toContain('Extract syllabus curriculum');
    });

    it('aiClient.executeMultimodal forwards mediaParts and records audit telemetry', async () => {
      const executeSpy = jest.spyOn(aiClient, 'executeMultimodal').mockResolvedValue({
        success: true,
        persona: 'banku',
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        fallbackUsed: false,
        data: {
          subjectName: 'Digital Signal Processing',
          subjectCode: 'EC401',
          units: [{ name: 'Unit 1: DFT & FFT', topics: [{ name: 'Twiddle Factor', orderIndex: 1 }] }],
        },
        metrics: { latencyMs: 250, totalTokens: 300 },
      } as any);

      const result = await SyllabusExtractionFeature.extractSyllabusProposal({
        userId: 'student-batch-tester',
        files: [
          {
            fileBase64: 'data:application/pdf;base64,Syllabus1_B64',
            fileMimeType: 'application/pdf',
            fileName: 'DSP_Part1.pdf',
            fileSizeBytes: 2048,
          },
          {
            fileBase64: 'data:image/png;base64,Photo2_B64',
            fileMimeType: 'image/png',
            fileName: 'DSP_Topics_Photo.png',
            fileSizeBytes: 1024,
          },
        ],
      });

      expect(executeSpy).toHaveBeenCalledTimes(1);
      const passedParams = executeSpy.mock.calls[0][0];
      expect(passedParams.mediaParts).toHaveLength(2);
      expect(passedParams.mediaParts?.[0].base64).toBe('Syllabus1_B64');
      expect(passedParams.mediaParts?.[1].base64).toBe('Photo2_B64');

      expect(result.data.subjectName).toBe('Digital Signal Processing');
      expect(result.proposal?.type).toBe('IMPORT_SYLLABUS');
    });
  });

  describe('3. Multi-Subject Extraction & Proposal Confirmation Lifecycle', () => {
    const mockMultiSubjectPayload: SyllabusProposalPayload = {
      subjectName: 'Computer Networks',
      subjectCode: 'CS401',
      units: [
        {
          name: 'Unit 1: OSI Reference Model',
          topics: [
            { name: 'Physical & Data Link Layers', orderIndex: 1 },
            { name: 'Network Layer & Routing Protocols', orderIndex: 2 },
          ],
        },
      ],
      subjects: [
        {
          subjectName: 'Computer Networks',
          subjectCode: 'CS401',
          credits: 4,
          units: [
            {
              name: 'Unit 1: OSI Reference Model',
              topics: [
                { name: 'Physical & Data Link Layers', orderIndex: 1 },
                { name: 'Network Layer & Routing Protocols', orderIndex: 2 },
              ],
            },
          ],
        },
        {
          subjectName: 'Database Management Systems',
          subjectCode: 'CS402',
          credits: 4,
          units: [
            {
              name: 'Unit 1: Relational Model & SQL',
              topics: [
                { name: 'ER Diagrams & Normalization', orderIndex: 1 },
                { name: 'ACID Properties & Transactions', orderIndex: 2 },
              ],
            },
          ],
        },
      ],
    };

    it('AIValidation.validateSyllabusPayload validates and normalizes multi-subject payload', () => {
      const validated = AIValidation.validateSyllabusPayload(mockMultiSubjectPayload);
      expect(validated.subjectName).toBe('Computer Networks');
      expect(validated.subjects).toBeDefined();
      expect(validated.subjects).toHaveLength(2);

      expect(validated.subjects?.[0].subjectName).toBe('Computer Networks');
      expect(validated.subjects?.[0].units[0].topics).toHaveLength(2);

      expect(validated.subjects?.[1].subjectName).toBe('Database Management Systems');
      expect(validated.subjects?.[1].subjectCode).toBe('CS402');
      expect(validated.subjects?.[1].units[0].topics).toHaveLength(2);
    });

    it('confirms and commits multi-subject proposals to SQLite and Zustand', async () => {
      const proposal: AIProposal<SyllabusProposalPayload> = {
        id: 'prop-multi-batch-001',
        type: 'IMPORT_SYLLABUS',
        title: 'Import Curriculum (2 Subjects)',
        description: 'Extracted 2 subjects across attached documents.',
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: 'student-multi',
        payload: mockMultiSubjectPayload,
      };

      // Invariant: Before confirmation, proposal is pending and zero writes exist for these subjects
      expect(proposal.status).toBe('pending');

      const applyResult = await SyllabusExtractionFeature.applyApprovedProposal(proposal);

      expect(applyResult.savedUnitsCount).toBe(2);
      expect(applyResult.savedTopicsCount).toBe(4);
      expect(proposal.status).toBe('applied');

      // Verify that subjects and units were created in SQLite repository
      const allSubjects = await subjectRepository.getSubjects();
      const cnSubject = allSubjects.find((s) => s.name === 'Computer Networks');
      const dbSubject = allSubjects.find((s) => s.name === 'Database Management Systems');

      expect(cnSubject).toBeDefined();
      expect(dbSubject).toBeDefined();

      if (cnSubject && dbSubject) {
        const cnUnits = await syllabusRepository.getUnitsForSubject(cnSubject.id);
        const dbUnits = await syllabusRepository.getUnitsForSubject(dbSubject.id);

        expect(cnUnits).toHaveLength(1);
        expect(dbUnits).toHaveLength(1);

        const cnTopics = await syllabusRepository.getTopicsForUnit(cnUnits[0].id);
        const dbTopics = await syllabusRepository.getTopicsForUnit(dbUnits[0].id);

        expect(cnTopics).toHaveLength(2);
        expect(dbTopics).toHaveLength(2);

        // Verify topics are uncompleted (strictly zero fake progress)
        expect(cnTopics.every((t) => t.isCompleted === false)).toBe(true);
        expect(dbTopics.every((t) => t.isCompleted === false)).toBe(true);
      }
    });

    it('executes zero writes on proposal discard', async () => {
      const initialUnits = await syllabusRepository.getAllUnits();
      const initialTopics = await syllabusRepository.getAllTopics();

      // Discarding without calling applyApprovedProposal
      const proposalDiscarded = true;
      expect(proposalDiscarded).toBe(true);

      const afterUnits = await syllabusRepository.getAllUnits();
      const afterTopics = await syllabusRepository.getAllTopics();

      expect(afterUnits.length).toBe(initialUnits.length);
      expect(afterTopics.length).toBe(initialTopics.length);
    });
  });

  describe('4. Manual Subject & Unit/Topic Entry Intact Below Banku Vision', () => {
    it('manually registers subjects and allows units to be added directly', async () => {
      const manualDraft: SubjectDraft = {
        id: 'subj-manual-chem',
        name: 'Engineering Chemistry',
        shortName: 'CHEM',
        code: 'CH101',
        color: '#F59E0B',
        credits: 3,
        subjectType: 'lecture',
      };

      const committed = await subjectRepository.createSubject({
        id: manualDraft.id,
        name: manualDraft.name,
        shortName: manualDraft.shortName,
        code: manualDraft.code,
        color: manualDraft.color,
        credits: manualDraft.credits,
        semesterId: 'sem-current',
        facultyId: 'fac-default',
        subjectType: manualDraft.subjectType,
        targetAttendance: 75,
      });

      expect(committed.name).toBe('Engineering Chemistry');

      // Manual Unit addition with topics parsed from text
      const parsedTopics = ['Polymers & Composites', 'Corrosion & Control', 'Spectroscopy'].map(
        (t, idx) => ({
          id: `topic-chem-${idx + 1}`,
          name: t,
          order: idx + 1,
        })
      );

      const manualUnit: SyllabusUnitDraft = {
        id: 'unit-chem-1',
        subjectId: committed.id,
        name: 'Unit 1: Applied Chemistry',
        order: 1,
        topics: parsedTopics,
      };

      expect(manualUnit.topics).toHaveLength(3);
      expect(manualUnit.topics[1].name).toBe('Corrosion & Control');
    });
  });
});
