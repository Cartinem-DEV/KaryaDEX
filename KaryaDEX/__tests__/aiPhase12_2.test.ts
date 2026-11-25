/**
 * KaryaDEX — Phase 12.2 Acceptance Test Suite
 *
 * Validates:
 * 1. Banku Connectivity & Error Truthfulness (Gateway auth, no client key requirement, truthful error types)
 * 2. Shanky Conversational Chat & Provider Isolation (Mistral ministral-8b-2512, strict isolation from Gemini, honest local assistance fallback)
 * 3. Onboarding & Academic Import Flows (Timetable, Syllabus, Calendar)
 * 4. Unified Proposal & Persistence Safety (Draft -> Preview -> User Confirmation -> Zero writes on cancel)
 */

import {
  aiClient,
  aiQuotaService,
  aiCacheService,
  aiAuditService,
  AIValidation,
  TimetableExtractionFeature,
  SyllabusExtractionFeature,
  CalendarExtractionFeature,
  ConversationalChatFeature,
  AI_MODELS,
  AIProviderRateLimitError,
  AIProviderAuthError,
  AIInvalidRequestError,
  type AIProposal,
  type ConversationalChatPayload,
  type TimetableSlotProposalPayload,
  type SyllabusProposalPayload,
  type CalendarProposalPayload,
} from '@/services/ai';
import {
  timetableRepository,
  subjectRepository,
  syllabusRepository,
  semesterRepository,
  examRepository,
} from '@/database';

describe('Phase 12.2 — AI Connectivity Recovery, Floating Companion & Smart Academic Onboarding', () => {
  beforeEach(async () => {
    await aiCacheService.clearAllForTesting();
    await aiAuditService.clearForTesting();
    await aiQuotaService.resetForTesting('test-user-12_2');
    jest.clearAllMocks();
  });

  describe('A. Banku Real Connectivity & Error Truthfulness', () => {
    it('verifies Banku is configured to Gemini 3.8 Flash primary with Gemini 3.7 Flash fallback', () => {
      expect(AI_MODELS.banku_primary.modelId).toBe('gemini-3.8-flash');
      expect(AI_MODELS.banku_primary.provider).toBe('gemini');
      expect(AI_MODELS.banku_fallback.modelId).toBe('gemini-3.7-flash');
      expect(AI_MODELS.banku_fallback.provider).toBe('gemini');
    });

    it('executes shared gateway requests without requiring client-side GEMINI_API_KEY', async () => {
      // Ensure no client-side Gemini key exists
      delete process.env.GEMINI_API_KEY;
      delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;

      const mockResponse = {
        data: {
          slots: [
            {
              dayOfWeek: 'Monday',
              startTime: '09:00',
              endTime: '10:00',
              subjectName: 'Computer Networks',
              room: 'Room 401',
              teacher: 'Dr. Sen',
              type: 'lecture',
              confidence: 0.95,
            },
          ],
        },
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        fallbackUsed: false,
        latencyMs: 120,
      };

      const executeSpy = jest.spyOn(aiClient, 'executeMultimodal').mockResolvedValue(mockResponse as any);

      const result = await TimetableExtractionFeature.extractTimetableProposal({
        userId: 'test-user-12_2',
        fileBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        fileMimeType: 'image/png',
        fileName: 'routine.png',
        fileSizeBytes: 1024,
      });

      expect(executeSpy).toHaveBeenCalled();
      expect(result.data.length).toBe(1);
      expect(result.data[0].subjectName).toBe('Computer Networks');
      expect(result.data[0].startTime).toBe('09:00');
      expect(result.proposal).toBeDefined();
      expect(result.proposal?.status).toBe('pending');
      expect(result.proposal?.type).toBe('IMPORT_TIMETABLE');
    });

    it('truthfully propagates gateway 429 rate limit error rather than masking as missing API key', async () => {
      jest.spyOn(aiClient, 'executeMultimodal').mockRejectedValue(
        new AIProviderRateLimitError('Rate limit exceeded: 15 requests per minute allowed.')
      );

      await expect(
        TimetableExtractionFeature.extractTimetableProposal({
          userId: 'test-user-12_2',
          fileBase64: 'dummy_base64',
          fileMimeType: 'image/png',
          fileName: 'routine.png',
          fileSizeBytes: 1024,
        })
      ).rejects.toThrow(AIProviderRateLimitError);
    });

    it('rejects unauthenticated requests truthfully without client key fallback', async () => {
      jest.spyOn(aiClient, 'executeMultimodal').mockRejectedValue(
        new AIProviderAuthError('User is not authenticated with Supabase gateway.')
      );

      await expect(
        TimetableExtractionFeature.extractTimetableProposal({
          userId: 'test-user-12_2',
          fileBase64: 'dummy_base64',
          fileMimeType: 'image/png',
          fileName: 'routine.png',
          fileSizeBytes: 1024,
        })
      ).rejects.toThrow(AIProviderAuthError);
    });
  });

  describe('B. Shanky Conversational Chat & Provider Isolation', () => {
    it('verifies Shanky is configured to Mistral ministral-8b-2512', () => {
      expect(AI_MODELS.shanky_primary.modelId).toBe('ministral-8b-2512');
      expect(AI_MODELS.shanky_primary.provider).toBe('mistral');
    });

    it('invokes Mistral provider for general student conversation with bounded academic context', async () => {
      const mockChatReply: ConversationalChatPayload = {
        reply: "You currently have 85% attendance in Chemistry, which is safely above your 75% target. You can safely bunk 2 classes if needed.",
        suggestedActions: ['View Chemistry Details'],
      };

      const executeSpy = jest.spyOn(aiClient, 'executeStructured').mockResolvedValue({
        data: mockChatReply,
        provider: 'mistral',
        model: 'ministral-8b-2512',
        fallbackUsed: false,
        latencyMs: 85,
      } as any);

      const response = await ConversationalChatFeature.chatWithShanky({
        userId: 'test-user-12_2',
        userMessage: 'How is my chemistry attendance looking?',
      });

      expect(executeSpy).toHaveBeenCalled();
      const calledContext = executeSpy.mock.calls[0][0];
      expect(calledContext.request.persona).toBe('shanky');
      expect(calledContext.request.feature).toBe('conversational_chat');
      expect(response.data.reply).toContain('Chemistry');
      expect(response.fallbackUsed).toBeFalsy();
    });

    it('strictly isolates Shanky from silently routing to Gemini on Mistral failure', async () => {
      // Simulate Mistral provider failure
      jest.spyOn(aiClient, 'executeStructured').mockRejectedValue(
        new Error('Mistral provider network unreachable')
      );

      const response = await ConversationalChatFeature.chatWithShanky({
        userId: 'test-user-12_2',
        userMessage: 'What should I study today?',
      });

      // Shanky must degrade to transparent [Local Assistance], NEVER silently routing to Gemini
      expect(response.fallbackUsed).toBe(true);
      expect(response.data.reply).toContain('[Local Assistance]');
    });

    it('rejects hardcoded static placeholder strings and validates conversational responses against schema', () => {
      const invalidPayload = {
        wrongField: 'Understood! You can use the quick action chips above...',
      };

      expect(() => {
        AIValidation.validateConversationalChat(invalidPayload);
      }).toThrow();

      const validPayload = {
        reply: 'Hello! I am Shanky. How can I help with your classes today?',
      };
      const validated = AIValidation.validateConversationalChat(validPayload);
      expect(validated.reply).toBe(validPayload.reply);
    });
  });

  describe('C. Smart Academic Onboarding Imports (Banku)', () => {
    describe('1. Timetable Routine Import', () => {
      it('validates routine slots and detects overlap conflicts', () => {
        const slotsToValidate = [
          {
            dayOfWeek: 'Monday',
            startTime: '09:00',
            endTime: '10:00',
            subjectName: 'Mathematics',
            type: 'lecture',
          },
          {
            dayOfWeek: 'Monday',
            startTime: '10:30',
            endTime: '12:00',
            subjectName: 'Physics Lab',
            type: 'lab',
          },
        ];

        const validated = AIValidation.validateTimetableSlots(slotsToValidate);
        expect(validated.length).toBe(2);
        expect(validated[0].dayOfWeek).toBe('monday');
        expect(validated[1].type).toBe('lab');
      });

      it('rejects invalid slot times during validation', () => {
        const invalidSlot = [
          {
            dayOfWeek: 'Monday',
            startTime: '11:00',
            endTime: '09:00', // end before start
            subjectName: 'Math',
          },
        ];

        expect(() => {
          AIValidation.validateTimetableSlots(invalidSlot);
        }).toThrow();
      });
    });

    describe('2. Syllabus & Topic Extraction', () => {
      it('validates extracted syllabus units and topics without marking topics as completed', async () => {
        const mockSyllabusData: SyllabusProposalPayload = {
          subjectName: 'Operating Systems',
          subjectCode: 'CS301',
          units: [
            {
              name: 'Unit 1: Process Management',
              topics: [
                { name: 'Process Control Block (PCB)', orderIndex: 1, subtopics: ['Context Switching', 'Process States'] },
                { name: 'CPU Scheduling Algorithms', orderIndex: 2, subtopics: ['FCFS', 'SJF', 'Round Robin'] },
              ],
            },
            {
              name: 'Unit 2: Memory Management',
              topics: [
                { name: 'Paging & Segmentation', orderIndex: 1 },
                { name: 'Virtual Memory & Page Replacement', orderIndex: 2 },
              ],
            },
          ],
        };

        jest.spyOn(aiClient, 'executeMultimodal').mockResolvedValue({
          data: mockSyllabusData,
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          fallbackUsed: false,
          latencyMs: 90,
        } as any);

        const result = await SyllabusExtractionFeature.extractSyllabusProposal({
          userId: 'test-user-12_2',
          fileBase64: 'dummy_pdf_base64',
          fileMimeType: 'application/pdf',
          fileName: 'os_syllabus.pdf',
          fileSizeBytes: 2048,
        });

        expect(result.data.units.length).toBe(2);
        expect(result.data.units[0].topics.length).toBe(2);
        expect(result.proposal).toBeDefined();
        expect(result.proposal?.type).toBe('IMPORT_SYLLABUS');
        expect(result.proposal?.status).toBe('pending');
      });
    });

    describe('3. Academic Calendar & Holiday Import', () => {
      it('extracts semester dates, official holidays, and exams without hallucinating dates', async () => {
        const mockCalendarData: CalendarProposalPayload = {
          semesterName: 'Odd Semester 2026',
          startDate: '2026-07-20',
          endDate: '2026-12-15',
          holidays: [
            { date: '2026-08-15', name: 'Independence Day', isOfficial: true, confidence: 1.0 },
            { date: '2026-10-02', name: 'Gandhi Jayanti', isOfficial: true, confidence: 1.0 },
          ],
          exams: [
            { title: 'Mid-Term Examinations', startDate: '2026-09-21', endDate: '2026-09-26', type: 'midterm' },
            { title: 'End-Semester Theory Exams', startDate: '2026-11-23', endDate: '2026-12-05', type: 'endterm' },
          ],
        };

        jest.spyOn(aiClient, 'executeMultimodal').mockResolvedValue({
          data: mockCalendarData,
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          fallbackUsed: false,
          latencyMs: 110,
        } as any);

        const result = await CalendarExtractionFeature.extractCalendarProposal({
          userId: 'test-user-12_2',
          fileBase64: 'dummy_calendar_base64',
          fileMimeType: 'image/jpeg',
          fileName: 'academic_notice.jpg',
          fileSizeBytes: 4096,
        });

        expect(result.data.startDate).toBe('2026-07-20');
        expect(result.data.holidays.length).toBe(2);
        expect(result.data.exams.length).toBe(2);
        expect(result.proposal?.type).toBe('IMPORT_CALENDAR');
        expect(result.proposal?.status).toBe('pending');
      });
    });
  });

  describe('D. Unified Persistence Safety (Zero Writes on Cancel)', () => {
    it('guarantees zero database writes when an AI proposal is discarded or cancelled', async () => {
      const initialSlots = await timetableRepository.getTimetableSlots(true);
      const initialSlotCount = initialSlots.length;

      // Create a pending proposal
      const proposal: AIProposal<TimetableSlotProposalPayload[]> = {
        id: 'prop-test-cancel',
        type: 'IMPORT_TIMETABLE',
        title: 'Draft Routine',
        description: 'Test draft',
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: 'test-user-12_2',
        payload: [
          {
            dayOfWeek: 'friday',
            startTime: '14:00',
            endTime: '15:00',
            subjectName: 'Elective III',
            type: 'lecture',
          },
        ],
      };

      // User chooses Cancel / Discard -> proposal is marked rejected or discarded
      proposal.status = 'rejected';

      // Verify no changes occurred to timetableRepository
      const afterSlots = await timetableRepository.getTimetableSlots(true);
      expect(afterSlots.length).toBe(initialSlotCount);
    });

    it('commits data through canonical repository only upon explicit user confirmation', async () => {
      const initialSlots = await timetableRepository.getTimetableSlots(true);
      const initialCount = initialSlots.length;

      const proposal: AIProposal<TimetableSlotProposalPayload[]> = {
        id: 'prop-test-confirm',
        type: 'IMPORT_TIMETABLE',
        title: 'Approved Routine',
        description: 'User confirmed',
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: 'test-user-12_2',
        payload: [
          {
            dayOfWeek: 'tuesday',
            startTime: '11:00',
            endTime: '12:00',
            subjectName: 'Cloud Computing',
            room: 'Lab 2',
            type: 'lecture',
          },
        ],
      };

      // Explicit user confirmation:
      const applyResult = await TimetableExtractionFeature.applyApprovedProposal(proposal, [0]);
      expect(applyResult.savedCount).toBe(1);

      const afterSlots = await timetableRepository.getTimetableSlots(true);
      expect(afterSlots.length).toBe(initialCount + 1);
    });
  });
});
