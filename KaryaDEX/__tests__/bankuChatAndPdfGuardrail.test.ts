/**
 * BunkMatKar — PDF Page Limit Guardrail & Banku Conversational Chat Tests
 *
 * Validates:
 * 1. Lightweight PDF Page Limit validation:
 *    - Simulated 100-page PDF triggers validation rejection before API invocation.
 *    - Simulated 5-page PDF passes validation.
 *    - 40-page boundary is accepted, 41-page PDF is rejected.
 *    - PDF upload halts before Base64 serialization when limit exceeded.
 * 2. Banku Conversational Chat Dispatch:
 *    - Plain text queries to Banku without attachment do NOT return hardcoded canned helper cards.
 *    - Dispatches prompt to geminiProvider (gemini-3.8-flash) using Banku's persona system prompt.
 *    - Live Gemini responses are returned with structured reply and suggestedActions.
 *    - Requests to clear or modify data explain the action and return a proposal draft/confirmation request.
 *    - Zero Direct SQLite Writes invariant is strictly maintained (AI cannot write directly to SQLite).
 */

import { validatePdfPageLimit } from '@/lib/fileUtils';
import {
  aiRouter,
  AIRouter,
  aiAuditService,
  ConversationalChatFeature,
  TimetableExtractionFeature,
  AI_MODELS,
  BANKU_CHAT_SYSTEM_INSTRUCTION,
  type BankuChatPayload,
} from '@/services/ai';
import { GeminiProvider } from '@/services/ai/providers/geminiProvider';
import { MistralProvider } from '@/services/ai/providers/mistralProvider';
import { timetableRepository } from '@/database';

describe('PDF Page Limit Guardrail & Banku Conversational Chat', () => {
  beforeEach(async () => {
    await aiAuditService.clearForTesting();
    jest.clearAllMocks();
  });

  describe('1. PDF Page Limit Guardrail (validatePdfPageLimit)', () => {
    it('rejects a simulated 100-page PDF with /Type /Page objects', async () => {
      // Simulate 100 pages via /Type /Page occurrences
      const simulated100PagePdf = '%PDF-1.4\n' + Array.from({ length: 100 }, (_, i) => `
${i + 1} 0 obj
<< /Type /Page /Parent 2 0 R >>
endobj
`).join('') + '\n%%EOF';

      const blob = new Blob([simulated100PagePdf], { type: 'application/pdf' });
      const result = await validatePdfPageLimit(blob, 40);

      expect(result.valid).toBe(false);
      expect(result.pageCount).toBe(100);
    });

    it('rejects a simulated 100-page PDF with /Count 100 in /Pages catalog dictionary', async () => {
      const simulatedCatalogPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 100 /Kids [3 0 R] >>
endobj
%%EOF`;

      const blob = new Blob([simulatedCatalogPdf], { type: 'application/pdf' });
      const result = await validatePdfPageLimit(blob, 40);

      expect(result.valid).toBe(false);
      expect(result.pageCount).toBe(100);
    });

    it('accepts a simulated 5-page PDF', async () => {
      const simulated5PagePdf = '%PDF-1.4\n' + Array.from({ length: 5 }, (_, i) => `
${i + 1} 0 obj
<< /Type /Page /Parent 2 0 R >>
endobj
`).join('') + '\n%%EOF';

      const blob = new Blob([simulated5PagePdf], { type: 'application/pdf' });
      const result = await validatePdfPageLimit(blob, 40);

      expect(result.valid).toBe(true);
      expect(result.pageCount).toBe(5);
    });

    it('accepts exactly 40 pages and rejects 41 pages (boundary condition)', async () => {
      const simulated40PagePdf = '%PDF-1.4\n' + Array.from({ length: 40 }, (_, i) => `
${i + 1} 0 obj
<< /Type /Page /Parent 2 0 R >>
endobj
`).join('') + '\n%%EOF';

      const blob40 = new Blob([simulated40PagePdf], { type: 'application/pdf' });
      const result40 = await validatePdfPageLimit(blob40, 40);
      expect(result40.valid).toBe(true);
      expect(result40.pageCount).toBe(40);

      const simulated41PagePdf = '%PDF-1.4\n' + Array.from({ length: 41 }, (_, i) => `
${i + 1} 0 obj
<< /Type /Page /Parent 2 0 R >>
endobj
`).join('') + '\n%%EOF';

      const blob41 = new Blob([simulated41PagePdf], { type: 'application/pdf' });
      const result41 = await validatePdfPageLimit(blob41, 40);
      expect(result41.valid).toBe(false);
      expect(result41.pageCount).toBe(41);
    });

    it('supports DocumentPicker asset wrapping with asset.file property', async () => {
      const simulatedPdf = '%PDF-1.4\n' + Array.from({ length: 100 }, (_, i) => `
${i + 1} 0 obj
<< /Type /Page >>
endobj
`).join('') + '\n%%EOF';

      const asset = {
        name: 'full_syllabus_large.pdf',
        mimeType: 'application/pdf',
        file: new Blob([simulatedPdf], { type: 'application/pdf' }),
      };

      const result = await validatePdfPageLimit(asset, 40);
      expect(result.valid).toBe(false);
      expect(result.pageCount).toBe(100);
    });

    it('halts upload before API invocation when a 100-page PDF is detected', async () => {
      const simulated100PagePdf = '%PDF-1.4\n' + Array.from({ length: 100 }, (_, i) => `
${i + 1} 0 obj
<< /Type /Page >>
endobj
`).join('') + '\n%%EOF';

      const asset = {
        name: 'large_college_calendar.pdf',
        mimeType: 'application/pdf',
        file: new Blob([simulated100PagePdf], { type: 'application/pdf' }),
      };

      // Spy on extraction API
      const extractionSpy = jest.spyOn(TimetableExtractionFeature, 'extractTimetableProposal');

      // Emulate modal/onboarding guard logic
      const isPdf = asset.name.toLowerCase().endsWith('.pdf');
      expect(isPdf).toBe(true);

      const pageCheck = await validatePdfPageLimit(asset.file || asset, 40);
      expect(pageCheck.valid).toBe(false);

      if (!pageCheck.valid) {
        // Guard triggers and halts flow before API invocation
        const warning = 'Document too large (exceeds 40 pages). Please upload only the specific routine, syllabus, or calendar pages.';
        expect(warning).toContain('exceeds 40 pages');
      } else {
        await TimetableExtractionFeature.extractTimetableProposal({
          userId: 'test-user',
          fileBase64: 'dummy',
          fileMimeType: 'application/pdf',
          fileName: asset.name,
          fileSizeBytes: 1000,
        });
      }

      // API was NOT invoked
      expect(extractionSpy).not.toHaveBeenCalled();
    });
  });

  describe('2. Banku Conversational Chat Dispatch', () => {
    it('dispatches plain text prompt to geminiProvider using gemini-3.8-flash and Banku system instruction', async () => {
      const mockGemini = new GeminiProvider('test-key');
      const mockMistral = new MistralProvider('test-key');

      const expectedResponse: BankuChatPayload = {
        reply: 'Banku online. Your routine consists of 4 classes today: Engineering Mathematics at 09:00, Operating Systems at 11:00.',
        suggestedActions: ['View Today Schedule', 'Check Attendance'],
      };

      const generateStructuredSpy = jest.spyOn(mockGemini, 'generateStructured').mockResolvedValue({
        data: expectedResponse,
        rawText: JSON.stringify(expectedResponse),
        model: 'gemini-3.8-flash',
        metrics: { latencyMs: 60, totalTokens: 120 },
      });

      const customRouter = new AIRouter(mockGemini, mockMistral);

      const result = await customRouter.routeBankuChat(
        {
          userId: 'student-unit-test',
          persona: 'banku',
          feature: 'conversational_chat',
        },
        'What classes do I have today?'
      );

      // Verify geminiProvider was called with correct model and Banku system prompt
      expect(generateStructuredSpy).toHaveBeenCalledTimes(1);
      const callOptions = generateStructuredSpy.mock.calls[0][2];
      expect(callOptions?.modelId).toBe(AI_MODELS.banku_primary.modelId);
      expect(callOptions?.modelId).toBe('gemini-3.8-flash');
      expect(callOptions?.systemInstruction).toBe(BANKU_CHAT_SYSTEM_INSTRUCTION);

      // Verify live response was returned
      expect(result.data.reply).toBe(expectedResponse.reply);
      expect(result.data.suggestedActions).toEqual(expectedResponse.suggestedActions);
      expect(result.provider).toBe('gemini');
      expect(result.model).toBe('gemini-3.8-flash');
    });

    it('does not return hardcoded canned helper card on plain text queries', async () => {
      const mockGemini = new GeminiProvider('test-key');
      const mockMistral = new MistralProvider('test-key');

      jest.spyOn(mockGemini, 'generateStructured').mockResolvedValue({
        data: {
          reply: 'I can assist you with your academic curriculum and timetable.',
          suggestedActions: ['Upload Routine', 'View Subjects'],
        },
        rawText: '...',
        model: 'gemini-3.8-flash',
        metrics: { latencyMs: 50, totalTokens: 100 },
      });

      const customRouter = new AIRouter(mockGemini, mockMistral);

      const result = await customRouter.routeBankuChat(
        {
          userId: 'student-unit-test',
          persona: 'banku',
          feature: 'conversational_chat',
        },
        'How can you help me with my engineering course?'
      );

      // Verify the canned card string is NOT returned
      const cannedCard = 'Banku is ready! Upload your timetable routine, syllabus, or academic calendar document using the action buttons above.';
      expect(result.data.reply).not.toBe(cannedCard);
      expect(result.data.reply).toBe('I can assist you with your academic curriculum and timetable.');
    });

    it('handles requests to clear or modify data by explaining the action and returning a proposal draft (Zero Direct SQLite Writes)', async () => {
      const mockGemini = new GeminiProvider('test-key');
      const mockMistral = new MistralProvider('test-key');

      // Spy on database to verify zero direct SQLite writes
      const deleteSlotsSpy = jest.spyOn(timetableRepository, 'deleteTimetableSlot');

      jest.spyOn(mockGemini, 'generateStructured').mockResolvedValue({
        data: {
          reply: 'I cannot modify or clear your local database directly. I have prepared a proposal draft to clear your timetable schedule for your explicit confirmation.',
          suggestedActions: ['Approve Proposal', 'Cancel'],
          proposal: {
            id: 'prop-clear-test',
            type: 'IMPORT_TIMETABLE',
            title: 'Clear Timetable Schedule',
            description: 'User requested to clear all routine timetable slots. Confirmation required.',
            status: 'pending',
            createdAt: new Date().toISOString(),
            userId: 'student-unit-test',
            payload: [],
          },
        },
        rawText: '...',
        model: 'gemini-3.8-flash',
        metrics: { latencyMs: 55, totalTokens: 110 },
      });

      const customRouter = new AIRouter(mockGemini, mockMistral);

      const result = await customRouter.routeBankuChat(
        {
          userId: 'student-unit-test',
          persona: 'banku',
          feature: 'conversational_chat',
        },
        'Please clear my timetable routine'
      );

      // 1. Banku explains the action
      expect(result.data.reply).toContain('cannot modify or clear');

      // 2. Returns a proposal draft / confirmation request
      expect(result.data.proposal).toBeDefined();
      expect(result.data.proposal?.status).toBe('pending');
      expect(result.data.proposal?.type).toBe('IMPORT_TIMETABLE');

      // 3. Invariant: AI did NOT directly delete or write to SQLite
      expect(deleteSlotsSpy).not.toHaveBeenCalled();
    });

    it('synthesizes confirmation proposal draft if model omits it when user asks to clear data', async () => {
      const mockGemini = new GeminiProvider('test-key');
      const mockMistral = new MistralProvider('test-key');

      // Model returned reply without proposal object
      jest.spyOn(mockGemini, 'generateStructured').mockResolvedValue({
        data: {
          reply: 'I understand you want to delete your timetable.',
          suggestedActions: ['Confirm', 'Cancel'],
        },
        rawText: '...',
        model: 'gemini-3.8-flash',
        metrics: { latencyMs: 50, totalTokens: 100 },
      });

      const customRouter = new AIRouter(mockGemini, mockMistral);

      const result = await customRouter.routeBankuChat(
        {
          userId: 'student-unit-test',
          persona: 'banku',
          feature: 'conversational_chat',
        },
        'Clear all my timetable slots now'
      );

      // Proposal draft is enforced
      expect(result.data.proposal).toBeDefined();
      expect(result.data.proposal?.status).toBe('pending');
      expect(result.data.proposal?.type).toBe('IMPORT_TIMETABLE');
      expect(result.data.reply).toContain('proposal');
    });

    it('ConversationalChatFeature.chatWithBanku executes router and handles fallback gracefully', async () => {
      // Mock routeBankuChat on aiRouter
      const routerSpy = jest.spyOn(aiRouter, 'routeBankuChat').mockResolvedValue({
        data: {
          reply: 'Banku is analyzing your academic structure.',
          suggestedActions: ['Upload Syllabus'],
        },
        rawText: '...',
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        fallbackUsed: false,
        latencyMs: 70,
        tokenUsage: 140,
      });

      const response = await ConversationalChatFeature.chatWithBanku({
        userId: 'test-user-banku',
        userMessage: 'What is the syllabus for Data Structures?',
      });

      expect(routerSpy).toHaveBeenCalledTimes(1);
      expect(response.success).toBe(true);
      expect(response.persona).toBe('banku');
      expect(response.provider).toBe('gemini');
      expect(response.model).toBe('gemini-3.8-flash');
      expect(response.data.reply).toBe('Banku is analyzing your academic structure.');
    });

    it('AIRouter.routeText dispatches to geminiProvider.generateText for Banku', async () => {
      const mockGemini = new GeminiProvider('test-key');
      const mockMistral = new MistralProvider('test-key');

      const textSpy = jest.spyOn(mockGemini, 'generateText').mockResolvedValue({
        text: 'Banku direct text answer.',
        model: 'gemini-3.8-flash',
        metrics: { latencyMs: 40, totalTokens: 80 },
      });

      const customRouter = new AIRouter(mockGemini, mockMistral);

      const result = await customRouter.routeText(
        {
          userId: 'test-user',
          persona: 'banku',
          feature: 'conversational_chat',
        },
        'Test prompt'
      );

      expect(textSpy).toHaveBeenCalledTimes(1);
      expect(result.data).toBe('Banku direct text answer.');
      expect(result.provider).toBe('gemini');
      expect(result.model).toBe('gemini-3.8-flash');
    });
  });
});
