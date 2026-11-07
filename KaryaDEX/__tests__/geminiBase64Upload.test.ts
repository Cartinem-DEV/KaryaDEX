/**
 * BunkMatKar — Gemini 400 Base64 Document Upload Fix Validation
 *
 * Validates:
 * 1. Web FileReader and Native picker base64 parsing (separating MIME, stripping data: prefix, stripping whitespace).
 * 2. Routine PDF import produces pure Base64 and valid TimetableSlotProposalPayload schema.
 * 3. Syllabus PDF import produces pure Base64 and valid SyllabusProposalPayload schema.
 * 4. Academic Calendar PDF import produces pure Base64 and valid CalendarProposalPayload schema.
 * 5. GeminiProvider defensive inlineData.data formatting (no prefix, no whitespace, TYPE_BYTES compliant).
 */

import {
  parseFileBase64AndMime,
  cleanBase64,
  readFileAsset,
  fileAssetToBase64,
  extractMagicBytesFromBase64,
} from '@/lib/fileUtils';
import {
  aiClient,
  TimetableExtractionFeature,
  SyllabusExtractionFeature,
  CalendarExtractionFeature,
  type TimetableSlotProposalPayload,
  type SyllabusProposalPayload,
  type CalendarProposalPayload,
} from '@/services/ai';
import { GeminiProvider } from '@/services/ai/providers/geminiProvider';

// Sample valid PDF base64: begins with %PDF-1.4 (0x25, 0x50, 0x44, 0x46)
const RAW_PDF_BASE64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCg==';
const DATA_URL_PDF = `data:application/pdf;base64,${RAW_PDF_BASE64}`;
const DIRTY_DATA_URL_PDF = `data:application/pdf;base64,\n  ${RAW_PDF_BASE64.slice(0, 20)}\r\n  ${RAW_PDF_BASE64.slice(20)}  \n`;

describe('Gemini 400 Base64 Document Upload Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. File Utilities & Base64 Pipeline Parser', () => {
    it('separates MIME type and strips "data:<mime-type>;base64," prefix', () => {
      const parsed = parseFileBase64AndMime(DATA_URL_PDF);
      expect(parsed.mimeType).toBe('application/pdf');
      expect(parsed.base64).toBe(RAW_PDF_BASE64);
      expect(parsed.base64).not.toContain('data:');
      expect(parsed.base64).not.toContain(';');
      expect(parsed.base64).not.toContain(',');
    });

    it('strips whitespace, newlines, and carriage returns from base64 data', () => {
      const parsed = parseFileBase64AndMime(DIRTY_DATA_URL_PDF);
      expect(parsed.mimeType).toBe('application/pdf');
      expect(parsed.base64).toBe(RAW_PDF_BASE64);
      expect(/\s/.test(parsed.base64)).toBe(false);
    });

    it('handles raw base64 string without data URI prefix gracefully', () => {
      const parsed = parseFileBase64AndMime(RAW_PDF_BASE64, 'application/pdf');
      expect(parsed.mimeType).toBe('application/pdf');
      expect(parsed.base64).toBe(RAW_PDF_BASE64);
    });

    it('cleanBase64 returns pure base64 characters', () => {
      const cleaned = cleanBase64(DIRTY_DATA_URL_PDF);
      expect(cleaned).toBe(RAW_PDF_BASE64);
      expect(cleaned).not.toContain('data:');
      expect(cleaned).not.toContain(',');
    });

    it('extractMagicBytesFromBase64 extracts correct PDF magic bytes from data URI prefix', () => {
      const magic = extractMagicBytesFromBase64(DIRTY_DATA_URL_PDF);
      // %PDF = 0x25, 0x50, 0x44, 0x46 (37, 80, 68, 70)
      expect(magic[0]).toBe(0x25);
      expect(magic[1]).toBe(0x50);
      expect(magic[2]).toBe(0x44);
      expect(magic[3]).toBe(0x46);
    });

    it('readFileAsset parses web FileReader output correctly', async () => {
      // Mock File object with FileReader
      const mockFile = {
        name: 'semester_calendar.pdf',
        type: 'application/pdf',
      };

      const originalFileReader = (globalThis as any).FileReader;
      (globalThis as any).FileReader = class {
        onload: any = null;
        onerror: any = null;
        result: string = '';
        readAsDataURL() {
          setTimeout(() => {
            this.result = DIRTY_DATA_URL_PDF;
            if (this.onload) this.onload();
          }, 0);
        }
      };

      try {
        const result = await readFileAsset({
          uri: 'blob:http://localhost/test-uuid',
          file: mockFile,
        });

        expect(result.mimeType).toBe('application/pdf');
        expect(result.base64).toBe(RAW_PDF_BASE64);
        expect(result.base64).not.toContain('data:');
      } finally {
        (globalThis as any).FileReader = originalFileReader;
      }
    });
  });

  describe('2. Routine PDF Import Pipeline', () => {
    it('uploads Routine PDF and guarantees pure Base64 in multimodal request', async () => {
      const mockRoutineSlots: TimetableSlotProposalPayload[] = [
        {
          dayOfWeek: 'monday',
          startTime: '09:00',
          endTime: '10:00',
          subjectName: 'Operating Systems',
          room: 'LH-1',
          teacher: 'Prof. Roy',
          type: 'lecture',
        },
        {
          dayOfWeek: 'wednesday',
          startTime: '14:00',
          endTime: '16:00',
          subjectName: 'OS Lab',
          room: 'Lab 3',
          type: 'lab',
        },
      ];

      let passedMediaBase64 = '';
      let passedMimeType = '';

      jest.spyOn(aiClient, 'executeMultimodal').mockImplementation(async (params: any) => {
        passedMediaBase64 = params.mediaBase64;
        passedMimeType = params.mimeType;
        return {
          data: { slots: mockRoutineSlots },
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          fallbackUsed: false,
          latencyMs: 150,
        } as any;
      });

      // Pass input that contains data: URL prefix and whitespace
      const result = await TimetableExtractionFeature.extractTimetableProposal({
        userId: 'test-user-pdf',
        fileBase64: DIRTY_DATA_URL_PDF,
        fileMimeType: 'application/pdf',
        fileName: 'academic_routine.pdf',
        fileSizeBytes: 4096,
        magicBytes: [0x25, 0x50, 0x44, 0x46],
      });

      // Verify that data URL prefix and whitespace were stripped before sending
      expect(passedMediaBase64).toBe(RAW_PDF_BASE64);
      expect(passedMediaBase64).not.toContain('data:');
      expect(passedMediaBase64).not.toContain(',');
      expect(/\s/.test(passedMediaBase64)).toBe(false);
      expect(passedMimeType).toBe('application/pdf');

      // Verify valid schema payload
      expect(result.data.length).toBe(2);
      expect(result.data[0].subjectName).toBe('Operating Systems');
      expect(result.data[0].dayOfWeek).toBe('monday');
      expect(result.data[1].type).toBe('lab');
      expect(result.proposal?.type).toBe('IMPORT_TIMETABLE');
    });
  });

  describe('3. Syllabus PDF Import Pipeline', () => {
    it('uploads Syllabus PDF and guarantees pure Base64 in multimodal request', async () => {
      const mockSyllabus: SyllabusProposalPayload = {
        subjectName: 'Database Systems',
        subjectCode: 'CS401',
        units: [
          {
            name: 'Module 1: Relational Algebra & SQL',
            topics: [
              { name: 'Tuple Relational Calculus', orderIndex: 1 },
              { name: 'Complex Queries and Joins', orderIndex: 2 },
            ],
          },
        ],
      };

      let passedMediaBase64 = '';
      let passedMimeType = '';

      jest.spyOn(aiClient, 'executeMultimodal').mockImplementation(async (params: any) => {
        passedMediaBase64 = params.mediaBase64;
        passedMimeType = params.mimeType;
        return {
          data: mockSyllabus,
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          fallbackUsed: false,
          latencyMs: 160,
        } as any;
      });

      const result = await SyllabusExtractionFeature.extractSyllabusProposal({
        userId: 'test-user-pdf',
        fileBase64: DIRTY_DATA_URL_PDF,
        fileMimeType: 'application/pdf',
        fileName: 'dbms_syllabus.pdf',
        fileSizeBytes: 8192,
        magicBytes: [0x25, 0x50, 0x44, 0x46],
      });

      expect(passedMediaBase64).toBe(RAW_PDF_BASE64);
      expect(passedMediaBase64).not.toContain('data:');
      expect(passedMediaBase64).not.toContain(',');
      expect(/\s/.test(passedMediaBase64)).toBe(false);
      expect(passedMimeType).toBe('application/pdf');

      expect(result.data.subjectName).toBe('Database Systems');
      expect(result.data.units.length).toBe(1);
      expect(result.data.units[0].topics.length).toBe(2);
      expect(result.proposal?.type).toBe('IMPORT_SYLLABUS');
    });
  });

  describe('4. Calendar PDF Import Pipeline', () => {
    it('uploads Academic Calendar PDF and guarantees pure Base64 in multimodal request', async () => {
      const mockCalendar: CalendarProposalPayload = {
        semesterName: 'Spring 2026',
        startDate: '2026-01-12',
        endDate: '2026-05-30',
        holidays: [
          { date: '2026-01-26', name: 'Republic Day', isOfficial: true },
          { date: '2026-03-25', name: 'Holi', isOfficial: true },
        ],
        exams: [
          { title: 'Mid-Sem Examination', startDate: '2026-03-02', endDate: '2026-03-07', type: 'midterm' },
        ],
      };

      let passedMediaBase64 = '';
      let passedMimeType = '';

      jest.spyOn(aiClient, 'executeMultimodal').mockImplementation(async (params: any) => {
        passedMediaBase64 = params.mediaBase64;
        passedMimeType = params.mimeType;
        return {
          data: mockCalendar,
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          fallbackUsed: false,
          latencyMs: 140,
        } as any;
      });

      const result = await CalendarExtractionFeature.extractCalendarProposal({
        userId: 'test-user-pdf',
        fileBase64: DIRTY_DATA_URL_PDF,
        fileMimeType: 'application/pdf',
        fileName: 'spring_2026_calendar.pdf',
        fileSizeBytes: 12288,
        magicBytes: [0x25, 0x50, 0x44, 0x46],
      });

      expect(passedMediaBase64).toBe(RAW_PDF_BASE64);
      expect(passedMediaBase64).not.toContain('data:');
      expect(passedMediaBase64).not.toContain(',');
      expect(/\s/.test(passedMediaBase64)).toBe(false);
      expect(passedMimeType).toBe('application/pdf');

      expect(result.data.semesterName).toBe('Spring 2026');
      expect(result.data.startDate).toBe('2026-01-12');
      expect(result.data.holidays.length).toBe(2);
      expect(result.data.exams.length).toBe(1);
      expect(result.proposal?.type).toBe('IMPORT_CALENDAR');
    });
  });

  describe('5. GeminiProvider Defensive inlineData.data Sanitization', () => {
    it('ensures inlineData.data passed to Google Generative Language API is pure Base64', async () => {
      let sentRequestBody: any = null;

      globalThis.fetch = jest.fn().mockImplementation(async (_url: any, options: any) => {
        sentRequestBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({ success: true, count: 1 }),
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 20,
              totalTokenCount: 120,
            },
          }),
        };
      });

      const provider = new GeminiProvider('test-api-key');

      // Send raw dirty data URL
      await provider.generateMultimodal(
        'Extract information',
        DIRTY_DATA_URL_PDF,
        'application/pdf',
        '{"success": boolean}'
      );

      expect(sentRequestBody).toBeDefined();
      const inlineData = sentRequestBody.contents[0].parts[0].inlineData;
      expect(inlineData).toBeDefined();
      expect(inlineData.mimeType).toBe('application/pdf');

      // Crucial assertion: inlineData.data must be pure Base64
      expect(inlineData.data).toBe(RAW_PDF_BASE64);
      expect(inlineData.data).not.toContain('data:');
      expect(inlineData.data).not.toContain(';');
      expect(inlineData.data).not.toContain(',');
      expect(/\s/.test(inlineData.data)).toBe(false);
    });
  });
});
