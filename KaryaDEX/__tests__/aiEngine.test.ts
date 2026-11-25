/**
 * KaryaDEX — AI Engine & Feature Tests (Phase 12)
 *
 * Validates:
 * - Provider routing & model configuration
 * - Retryable vs non-retryable error handling & fallback
 * - Context Builder with authoritative deterministic sources
 * - Output validation and schema enforcement
 * - Action Proposal lifecycle (Draft -> Preview -> Confirmation -> Save)
 * - Cache isolation & invalidation
 * - Quota management & daily limits
 * - BYOK secure storage
 */

import {
  aiRouter,
  AIRouter,
  aiQuotaService,
  aiCacheService,
  aiAuditService,
  AIValidation,
  AIContextBuilder,
  BYOKStorage,
  TimetableExtractionFeature,
  ProfileSetupFeature,
  AttendanceExplainerFeature,
  DailyBriefingFeature,
  TaskBreakdownFeature,
  AI_MODELS,
  AIProviderRateLimitError,
  AIProviderTimeoutError,
  AIInvalidRequestError,
  AIPolicyRejectionError,
  AIContextViolationError,
  AIQuotaExceededError,
  type AIProposal,
} from '@/services/ai';
import { GeminiProvider } from '@/services/ai/providers/geminiProvider';
import { MistralProvider } from '@/services/ai/providers/mistralProvider';
import { subjectRepository, timetableRepository, taskRepository } from '@/database';

describe('Phase 12 — AI Academic Intelligence Engine', () => {
  beforeEach(async () => {
    await aiCacheService.clearAllForTesting();
    await aiAuditService.clearForTesting();
    await aiQuotaService.resetForTesting('test-user-1');
    await aiQuotaService.resetForTesting('test-user-2');
    await BYOKStorage.clearAllKeys();
  });

  describe('1. Model Configuration & Provider Slots', () => {
    it('configures Banku Primary to Gemini 3.8 Flash', () => {
      expect(AI_MODELS.banku_primary.modelId).toBe('gemini-3.8-flash');
      expect(AI_MODELS.banku_primary.provider).toBe('gemini');
      expect(AI_MODELS.banku_primary.supportsThinking).toBe(true);
    });

    it('configures Banku Fallback to Gemini 3.7 Flash', () => {
      expect(AI_MODELS.banku_fallback.modelId).toBe('gemini-3.7-flash');
      expect(AI_MODELS.banku_fallback.provider).toBe('gemini');
    });

    it('configures Shanky Primary to Mistral ministral-8b-2512', () => {
      expect(AI_MODELS.shanky_primary.modelId).toBe('ministral-8b-2512');
      expect(AI_MODELS.shanky_primary.provider).toBe('mistral');
    });
  });

  describe('2. Router & Fallback Behavior', () => {
    it('routes vision/PDF multimodal requests to Banku (Gemini)', async () => {
      const mockGemini = new GeminiProvider('test-key');
      const mockMistral = new MistralProvider('test-key');

      const geminiSpy = jest.spyOn(mockGemini, 'generateStructured').mockResolvedValue({
        data: { test: true },
        rawText: '{"test": true}',
        model: 'gemini-3.8-flash',
        metrics: { latencyMs: 50, totalTokens: 100 },
      });

      const customRouter = new AIRouter(mockGemini, mockMistral);

      const result = await customRouter.routeStructured(
        {
          userId: 'test-user-1',
          persona: 'banku',
          feature: 'timetable_extraction',
          requiresVision: true,
        },
        'Test prompt',
        '{}'
      );

      expect(geminiSpy).toHaveBeenCalled();
      expect(result.provider).toBe('gemini');
      expect(result.model).toBe('gemini-3.8-flash');
      expect(result.fallbackUsed).toBe(false);
    });

    it('routes conversational requests to Shanky (Mistral ministral-8b-2512)', async () => {
      const mockGemini = new GeminiProvider('test-key');
      const mockMistral = new MistralProvider('test-key');

      const mistralSpy = jest.spyOn(mockMistral, 'generateStructured').mockResolvedValue({
        data: { conversational: true },
        rawText: '{"conversational": true}',
        model: 'ministral-8b-2512',
        metrics: { latencyMs: 45, totalTokens: 90 },
      });

      const customRouter = new AIRouter(mockGemini, mockMistral);

      const result = await customRouter.routeStructured(
        {
          userId: 'test-user-1',
          persona: 'shanky',
          feature: 'daily_briefing',
        },
        'Test prompt',
        '{}'
      );

      expect(mistralSpy).toHaveBeenCalled();
      expect(result.provider).toBe('mistral');
      expect(result.model).toBe('ministral-8b-2512');
      expect(result.fallbackUsed).toBe(false);
    });

    it('enforces independent quota pools: Mistral rate limit does NOT silently route Shanky to Google', async () => {
      const mockGemini = new GeminiProvider('test-key');
      const mockMistral = new MistralProvider('test-key');

      const geminiSpy = jest.spyOn(mockGemini, 'generateStructured');
      jest.spyOn(mockMistral, 'generateStructured').mockRejectedValue(
        new AIProviderRateLimitError('Mistral rate limit exceeded')
      );

      const customRouter = new AIRouter(mockGemini, mockMistral);

      await expect(
        customRouter.routeStructured(
          {
            userId: 'test-user-1',
            persona: 'shanky',
            feature: 'attendance_explainer',
          },
          'Test prompt',
          '{}'
        )
      ).rejects.toThrow(AIProviderRateLimitError);

      // Verify Google Gemini was NEVER called for Shanky failure (independent pool requirement)
      expect(geminiSpy).not.toHaveBeenCalled();
    });

    it('falls back to Gemini 3.7 Flash on retryable rate limit error in Banku', async () => {
      const mockGemini = new GeminiProvider('test-key');
      const mockMistral = new MistralProvider('test-key');

      let callCount = 0;
      jest.spyOn(mockGemini, 'generateStructured').mockImplementation(async (_prompt, _schema, options) => {
        callCount++;
        if (options?.modelId === 'gemini-3.8-flash') {
          throw new AIProviderRateLimitError('Rate limit on 3.8 Flash');
        }
        return {
          data: { fallbackPassed: true },
          rawText: '{"fallbackPassed": true}',
          model: 'gemini-3.7-flash',
          metrics: { latencyMs: 40, totalTokens: 80 },
        };
      });

      const customRouter = new AIRouter(mockGemini, mockMistral);

      const result = await customRouter.routeStructured(
        {
          userId: 'test-user-1',
          persona: 'banku',
          feature: 'routine_image_parsing',
        },
        'Test prompt',
        '{}'
      );

      expect(callCount).toBe(2);
      expect(result.fallbackUsed).toBe(true);
      expect(result.model).toBe('gemini-3.7-flash');
      expect(result.data).toEqual({ fallbackPassed: true });
    });

    it('does NOT fallback on non-retryable application policy rejections', async () => {
      const mockGemini = new GeminiProvider('test-key');
      const mockMistral = new MistralProvider('test-key');
      const geminiSpy = jest.spyOn(mockGemini, 'generateStructured');

      const customRouter = new AIRouter(mockGemini, mockMistral);

      await expect(
        customRouter.routeStructured(
          {
            userId: 'test-user-1',
            persona: 'banku',
            feature: 'test',
            // Injecting credential pattern
            rawSession: 'bearer secret_token_xyz',
          } as any,
          'Test prompt',
          '{}'
        )
      ).rejects.toThrow(AIPolicyRejectionError);

      expect(geminiSpy).not.toHaveBeenCalled();
    });
  });

  describe('2.5. Mistral Provider Adapter Verification', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('generates text via Mistral API using ministral-8b-2512', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello student!' } }],
          usage: { prompt_tokens: 15, completion_tokens: 10, total_tokens: 25 },
        }),
      } as any);

      const provider = new MistralProvider('test-key');
      const result = await provider.generateText('Hi Shanky');

      expect(result.text).toBe('Hello student!');
      expect(result.model).toBe('ministral-8b-2512');
      expect(result.metrics.totalTokens).toBe(25);
    });

    it('generates and parses structured JSON via Mistral API', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '```json\n{"summary": "Study tonight"}\n```' } }],
          usage: { prompt_tokens: 20, completion_tokens: 12, total_tokens: 32 },
        }),
      } as any);

      const provider = new MistralProvider('test-key');
      const result = await provider.generateStructured<{ summary: string }>(
        'What should I do?',
        '{"summary": string}'
      );

      expect(result.data.summary).toBe('Study tonight');
      expect(result.model).toBe('ministral-8b-2512');
    });

    it('translates HTTP 429 to AIProviderRateLimitError', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit reached',
      } as any);

      const provider = new MistralProvider('test-key');
      await expect(provider.generateText('Hello')).rejects.toThrow(AIProviderRateLimitError);
    });

    it('translates HTTP 401 to AIProviderAuthError', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      } as any);

      const provider = new MistralProvider('bad-key');
      const { AIProviderAuthError } = await import('@/services/ai');
      await expect(provider.generateText('Hello')).rejects.toThrow(AIProviderAuthError);
    });

    it('rejects multimodal calls on MistralProvider', async () => {
      const provider = new MistralProvider('test-key');
      await expect(
        provider.generateMultimodal('Prompt', 'base64', 'image/png')
      ).rejects.toThrow(AIInvalidRequestError);
    });
  });

  describe('3. Controlled Context Builder', () => {
    it('requires an authenticated userId', async () => {
      await expect(
        AIContextBuilder.buildAttendanceContext({
          userId: '',
          subjectId: 'sub-1',
        })
      ).rejects.toThrow(AIContextViolationError);
    });

    it('builds daily briefing context with only necessary fields', async () => {
      const context = await AIContextBuilder.buildDailyBriefingContext({
        userId: 'test-user-1',
        targetDate: '2026-10-08',
      });

      expect(context.userId).toBe('test-user-1');
      expect(context.feature).toBe('daily_briefing');
      expect(context.persona).toBe('shanky');
      expect(Array.isArray(context.todayClasses)).toBe(true);
      expect(Array.isArray(context.pendingTasks)).toBe(true);
      expect(Array.isArray(context.attendanceAlerts)).toBe(true);
      // Verify no sensitive tokens leaked
      expect((context as any).password).toBeUndefined();
      expect((context as any).accessToken).toBeUndefined();
    });
  });

  describe('4. Output Validation & Deterministic Math Defense', () => {
    it('validates extracted timetable slots format and normalizes times', () => {
      const rawSlots = [
        {
          dayOfWeek: 'Monday',
          startTime: '09:00',
          endTime: '10:00',
          subjectName: 'Thermodynamics',
          room: 'LH-101',
          type: 'lecture',
        },
      ];

      const validated = AIValidation.validateTimetableSlots(rawSlots);
      expect(validated.length).toBe(1);
      expect(validated[0].dayOfWeek).toBe('monday');
      expect(validated[0].startTime).toBe('09:00');
      expect(validated[0].endTime).toBe('10:00');
    });

    it('rejects timetable slots where endTime is before startTime', () => {
      const invalidSlots = [
        {
          dayOfWeek: 'monday',
          startTime: '11:00',
          endTime: '09:00',
          subjectName: 'Math',
        },
      ];

      expect(() => AIValidation.validateTimetableSlots(invalidSlots)).toThrow(AIInvalidRequestError);
    });

    it('rejects AI output that alters deterministic attendance percentage', () => {
      const expectedTruth = {
        percentage: 76.19,
        safeBunks: 2,
        recoveryNeeded: 0,
      };

      const tamperedOutput = {
        subjectName: 'Fluid Mechanics',
        deterministicPercentage: 85.0, // Hallucinated/tampered!
        deterministicTarget: 75,
        deterministicSafeBunks: 2,
        deterministicRecoveryNeeded: 0,
        attendancePressure: 'medium',
        trend: 'stable',
        situationSummary: 'Good',
        bunkAdvice: 'You have safe bunks',
        recommendedAction: 'Keep it up',
      };

      expect(() =>
        AIValidation.validateAttendanceExplanation(tamperedOutput, expectedTruth)
      ).toThrow(AIInvalidRequestError);
    });

    it('accepts valid attendance explanation that quotes exact deterministic numbers', () => {
      const expectedTruth = {
        percentage: 76.19,
        safeBunks: 2,
        recoveryNeeded: 0,
      };

      const validOutput = {
        subjectName: 'Fluid Mechanics',
        deterministicPercentage: 76.19,
        deterministicTarget: 75,
        deterministicSafeBunks: 2,
        deterministicRecoveryNeeded: 0,
        attendancePressure: 'medium',
        trend: 'stable',
        situationSummary: 'You are meeting your target.',
        bunkAdvice: 'You can safely miss 2 classes.',
        recommendedAction: 'Maintain current pace.',
      };

      const result = AIValidation.validateAttendanceExplanation(validOutput, expectedTruth);
      expect(result.deterministicPercentage).toBe(76.19);
      expect(result.deterministicSafeBunks).toBe(2);
    });
  });

  describe('5. AI Proposal Lifecycle & Zero Direct Database Writes', () => {
    it('creates an IMPORT_TIMETABLE proposal without directly writing to SQLite', async () => {
      const proposal: AIProposal = {
        id: 'prop-test-tt-1',
        type: 'IMPORT_TIMETABLE',
        title: 'Import Timetable',
        description: 'Proposed by Banku',
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: 'test-user-1',
        payload: [
          {
            dayOfWeek: 'monday',
            startTime: '08:30',
            endTime: '09:30',
            subjectName: 'Engineering Mechanics',
          },
        ],
      };

      // Before user approval, slot is NOT in timetable repository
      const slotsBefore = await timetableRepository.getSlotsForDay('monday');
      const hasMechanics = slotsBefore.some(s => s.startTime === '08:30');
      expect(hasMechanics).toBe(false);

      // Explicit user approval applies proposal
      const applyResult = await TimetableExtractionFeature.applyApprovedProposal(proposal as any);
      expect(applyResult.savedCount).toBe(1);
      expect(proposal.status).toBe('applied');

      // Cannot apply already applied proposal
      await expect(
        TimetableExtractionFeature.applyApprovedProposal(proposal as any)
      ).rejects.toThrow('already been applied');
    });

    it('creates subtasks proposal and requires confirmation to save', async () => {
      const proposal: AIProposal = {
        id: 'prop-test-tasks-1',
        type: 'CREATE_SUBTASKS',
        title: 'Breakdown: Assignment 1',
        description: 'Proposed by Shanky',
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: 'test-user-1',
        payload: {
          parentTitle: 'Assignment 1',
          subtasks: [
            { title: 'Read Chapter 4', estimatedMinutes: 30, orderIndex: 1 },
            { title: 'Solve Exercises', estimatedMinutes: 45, orderIndex: 2 },
          ],
        },
      };

      expect(proposal.status).toBe('pending');
      const result = await TaskBreakdownFeature.applyApprovedProposal(proposal as any);
      expect(result.createdSubtasks.length).toBe(2);
      expect(proposal.status).toBe('applied');
    });
  });

  describe('6. Local Cache Isolation', () => {
    it('isolates cached responses between different users', async () => {
      await aiCacheService.set('user-A', 'briefing', 'ver1', { text: 'Briefing for A' });

      // User A gets their cache
      const cachedA = await aiCacheService.get('user-A', 'briefing', 'ver1');
      expect(cachedA).toEqual({ text: 'Briefing for A' });

      // User B cannot access User A's cache
      const cachedB = await aiCacheService.get('user-B', 'briefing', 'ver1');
      expect(cachedB).toBeNull();
    });

    it('invalidates cache when feature is updated', async () => {
      await aiCacheService.set('user-A', 'briefing', 'ver1', { text: 'Old briefing' });
      await aiCacheService.invalidateFeature('user-A', 'briefing');

      const cached = await aiCacheService.get('user-A', 'briefing', 'ver1');
      expect(cached).toBeNull();
    });
  });

  describe('7. Quota Management & Denial-of-Wallet Prevention', () => {
    it('enforces daily request limits on free tier', async () => {
      aiQuotaService.setTier({
        name: 'free',
        maxDailyRequests: 3,
        maxTokensPerRequest: 2048,
        allowsMultimodal: true,
      });

      await aiQuotaService.recordUsage('test-user-1');
      await aiQuotaService.recordUsage('test-user-1');
      await aiQuotaService.recordUsage('test-user-1');

      await expect(aiQuotaService.checkQuota('test-user-1')).rejects.toThrow(AIQuotaExceededError);
    });

    it('allows BYOK tier users to bypass application request limits', async () => {
      aiQuotaService.setTier({
        name: 'byok',
        maxDailyRequests: 0,
        maxTokensPerRequest: 4096,
        allowsMultimodal: true,
      });

      await expect(aiQuotaService.checkQuota('test-user-1')).resolves.toBeUndefined();
    });
  });

  describe('8. Privacy-Aware Audit Logger', () => {
    it('records telemetry without capturing user prompts or secrets', async () => {
      await aiAuditService.logEvent({
        userId: 'test-user-1',
        persona: 'shanky',
        provider: 'mistral',
        model: 'ministral-8b-2512',
        feature: 'chat',
        success: true,
        latencyMs: 120,
        tokenUsage: 350,
        fallbackUsed: false,
      });

      const logs = await aiAuditService.getAuditEntries('test-user-1');
      expect(logs.length).toBe(1);
      expect(logs[0].provider).toBe('mistral');
      expect(logs[0].model).toBe('ministral-8b-2512');
      expect(logs[0].tokenUsage).toBe(350);
      expect((logs[0] as any).rawPrompt).toBeUndefined();
      expect((logs[0] as any).password).toBeUndefined();
    });
  });

  describe('9. BYOK Isolated Secure Storage', () => {
    it('stores and retrieves Gemini and Mistral BYOK keys in isolated storage', async () => {
      await BYOKStorage.setGeminiKey('AIzaSyTest123');
      const retrievedGemini = await BYOKStorage.getGeminiKey();
      expect(retrievedGemini).toBe('AIzaSyTest123');

      await BYOKStorage.setMistralKey('test_mistral_api_key_123');
      const retrievedMistral = await BYOKStorage.getMistralKey();
      expect(retrievedMistral).toBe('test_mistral_api_key_123');

      await BYOKStorage.clearAllKeys();
      expect(await BYOKStorage.getGeminiKey()).toBeNull();
      expect(await BYOKStorage.getMistralKey()).toBeNull();
    });
  });
});
