/**
 * KaryaDEX — AI Capability Router & Intelligent Fallback Engine (Phase 12)
 *
 * Routes requests based on persona and capability requirements.
 * Executes primary model with automated, intelligent fallback on retryable failures only.
 */

import type { AIProvider, ProviderOptions, ProviderStructuredResult, ProviderTextResult } from '../providers/aiProvider';
import { GeminiProvider } from '../providers/geminiProvider';
import { MistralProvider } from '../providers/mistralProvider';
import { AI_MODELS } from '../providers/providerConfig';
import type { AIPersonaId, AIResponse, BaseAIRequest, BankuChatPayload, AIProposal } from './aiTypes';
import {
  AIError,
  AIProviderRateLimitError,
  AIProviderTimeoutError,
  AIPolicyRejectionError,
  AIContextViolationError,
  AIInvalidRequestError,
  AIQuotaExceededError,
} from './aiTypes';
import { AIPolicy } from './aiPolicy';
import { aiQuotaService } from './aiQuotaService';
import { aiAuditService } from './aiAuditService';
import { BANKU_SYSTEM_INSTRUCTION, BANKU_CHAT_SYSTEM_INSTRUCTION } from '../personas/banku';
import { buildBankuChatPrompt } from '../prompts/bankuPrompts';

export interface RouteExecutionResult<T> {
  data: T;
  rawText?: string;
  provider: 'gemini' | 'mistral';
  model: string;
  fallbackUsed: boolean;
  latencyMs: number;
  tokenUsage?: number;
}

export class AIRouter {
  private geminiProvider: GeminiProvider;
  private mistralProvider: MistralProvider;

  constructor(geminiProvider?: GeminiProvider, mistralProvider?: MistralProvider) {
    this.geminiProvider = geminiProvider || new GeminiProvider();
    this.mistralProvider = mistralProvider || new MistralProvider();
  }

  /**
   * Determines whether an error is retryable for provider fallback.
   */
  private isRetryableError(error: any): boolean {
    if (
      error instanceof AIPolicyRejectionError ||
      error instanceof AIContextViolationError ||
      error instanceof AIInvalidRequestError ||
      error instanceof AIQuotaExceededError
    ) {
      return false; // Fatal application/policy errors must never trigger fallback
    }

    if (error instanceof AIProviderRateLimitError || error instanceof AIProviderTimeoutError) {
      return true;
    }

    if (error instanceof AIError && error.isRetryable) {
      return true;
    }

    return false;
  }

  /**
   * Executes structured AI generation with capability routing and fallback.
   */
  async routeStructured<T>(
    request: BaseAIRequest,
    prompt: string,
    schemaDescription: string,
    options?: ProviderOptions
  ): Promise<RouteExecutionResult<T>> {
    const startTime = Date.now();
    let fallbackUsed = false;

    // 1. Enforce safety policy & quota
    AIPolicy.validateRequestPayload(request as any);
    await aiQuotaService.checkQuota(request.userId, Boolean(request.requiresVision || request.requiresPDF));

    // 2. Select route
    const isMultimodal = Boolean(request.requiresVision || request.requiresPDF);
    const persona: AIPersonaId = isMultimodal || request.persona === 'banku' ? 'banku' : 'shanky';

    if (persona === 'banku') {
      // Primary: Gemini 3.8 Flash
      const primaryConfig = AI_MODELS.banku_primary;
      try {
        const result = await this.geminiProvider.generateStructured<T>(prompt, schemaDescription, {
          ...options,
          modelId: primaryConfig.modelId,
          thinkingLevel: primaryConfig.thinkingLevel,
        });

        const latencyMs = Date.now() - startTime;
        await aiQuotaService.recordUsage(request.userId, result.metrics.totalTokens);
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'banku',
          provider: 'gemini',
          model: primaryConfig.modelId,
          feature: request.feature,
          success: true,
          latencyMs,
          tokenUsage: result.metrics.totalTokens,
          fallbackUsed: false,
        });

        return {
          data: result.data,
          rawText: result.rawText,
          provider: 'gemini',
          model: primaryConfig.modelId,
          fallbackUsed: false,
          latencyMs,
          tokenUsage: result.metrics.totalTokens,
        };
      } catch (primaryErr: any) {
        if (!this.isRetryableError(primaryErr)) {
          await aiAuditService.logEvent({
            userId: request.userId,
            persona: 'banku',
            provider: 'gemini',
            model: primaryConfig.modelId,
            feature: request.feature,
            success: false,
            latencyMs: Date.now() - startTime,
            fallbackUsed: false,
            errorMessage: primaryErr.message,
            policyRejection: primaryErr instanceof AIPolicyRejectionError,
          });
          throw primaryErr;
        }

        // Retryable error -> Fallback to Gemini 3.7 Flash
        fallbackUsed = true;
        const fallbackConfig = AI_MODELS.banku_fallback;
        try {
          const fallbackResult = await this.geminiProvider.generateStructured<T>(prompt, schemaDescription, {
            ...options,
            modelId: fallbackConfig.modelId,
          });

          const latencyMs = Date.now() - startTime;
          await aiQuotaService.recordUsage(request.userId, fallbackResult.metrics.totalTokens);
          await aiAuditService.logEvent({
            userId: request.userId,
            persona: 'banku',
            provider: 'gemini',
            model: fallbackConfig.modelId,
            feature: request.feature,
            success: true,
            latencyMs,
            tokenUsage: fallbackResult.metrics.totalTokens,
            fallbackUsed: true,
          });

          return {
            data: fallbackResult.data,
            rawText: fallbackResult.rawText,
            provider: 'gemini',
            model: fallbackConfig.modelId,
            fallbackUsed: true,
            latencyMs,
            tokenUsage: fallbackResult.metrics.totalTokens,
          };
        } catch (fallbackErr: any) {
          await aiAuditService.logEvent({
            userId: request.userId,
            persona: 'banku',
            provider: 'gemini',
            model: fallbackConfig.modelId,
            feature: request.feature,
            success: false,
            latencyMs: Date.now() - startTime,
            fallbackUsed: true,
            errorMessage: fallbackErr.message,
          });
          throw fallbackErr;
        }
      }
    } else {
      // Persona: SHANKY (Speedster / Conversational AI)
      // Primary: Mistral ministral-8b-2512
      // STRICT REQUIREMENT: Independent quota pool from Google.
      // Do NOT silently route Shanky to Google if Mistral fails or rate limits.
      const primaryConfig = AI_MODELS.shanky_primary;
      try {
        const result = await this.mistralProvider.generateStructured<T>(prompt, schemaDescription, {
          ...options,
          modelId: primaryConfig.modelId,
        });

        const latencyMs = Date.now() - startTime;
        await aiQuotaService.recordUsage(request.userId, result.metrics.totalTokens);
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'shanky',
          provider: 'mistral',
          model: primaryConfig.modelId,
          feature: request.feature,
          success: true,
          latencyMs,
          tokenUsage: result.metrics.totalTokens,
          fallbackUsed: false,
        });

        return {
          data: result.data,
          rawText: result.rawText,
          provider: 'mistral',
          model: primaryConfig.modelId,
          fallbackUsed: false,
          latencyMs,
          tokenUsage: result.metrics.totalTokens,
        };
      } catch (primaryErr: any) {
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'shanky',
          provider: 'mistral',
          model: primaryConfig.modelId,
          feature: request.feature,
          success: false,
          latencyMs: Date.now() - startTime,
          fallbackUsed: false,
          errorMessage: primaryErr.message,
          policyRejection: primaryErr instanceof AIPolicyRejectionError,
        });

        // Handle specific policy/validation errors directly
        if (
          primaryErr instanceof AIPolicyRejectionError ||
          primaryErr instanceof AIContextViolationError ||
          primaryErr instanceof AIInvalidRequestError ||
          primaryErr instanceof AIQuotaExceededError
        ) {
          throw primaryErr;
        }

        if (primaryErr instanceof AIProviderRateLimitError) {
          throw new AIProviderRateLimitError('Shanky is temporarily rate-limited. Please try again shortly.');
        }

        // Return a graceful "Shanky temporarily unavailable" state without breaking
        throw new AIError(
          `Shanky is temporarily unavailable: ${primaryErr.message || 'Mistral provider offline'}.`,
          'PROVIDER_UNAVAILABLE',
          false
        );
      }
    }
  }

  /**
   * Executes multimodal document/image analysis via Banku.
   */
  async routeMultimodal<T>(
    request: BaseAIRequest,
    prompt: string,
    mediaBase64: string,
    mimeType: string,
    schemaDescription: string,
    options?: ProviderOptions
  ): Promise<RouteExecutionResult<T>> {
    const startTime = Date.now();

    // 1. Enforce safety policy & quota
    AIPolicy.validateRequestPayload(request as any);
    await aiQuotaService.checkQuota(request.userId, true);

    const primaryConfig = AI_MODELS.banku_primary;
    try {
      const result = await this.geminiProvider.generateMultimodal<T>(
        prompt,
        mediaBase64,
        mimeType,
        schemaDescription,
        {
          ...options,
          modelId: primaryConfig.modelId,
        }
      );

      const latencyMs = Date.now() - startTime;
      await aiQuotaService.recordUsage(request.userId, result.metrics.totalTokens);
      await aiAuditService.logEvent({
        userId: request.userId,
        persona: 'banku',
        provider: 'gemini',
        model: primaryConfig.modelId,
        feature: request.feature,
        success: true,
        latencyMs,
        tokenUsage: result.metrics.totalTokens,
        fallbackUsed: false,
      });

      return {
        data: result.data,
        rawText: result.rawText,
        provider: 'gemini',
        model: primaryConfig.modelId,
        fallbackUsed: false,
        latencyMs,
        tokenUsage: result.metrics.totalTokens,
      };
    } catch (primaryErr: any) {
      if (!this.isRetryableError(primaryErr)) {
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'banku',
          provider: 'gemini',
          model: primaryConfig.modelId,
          feature: request.feature,
          success: false,
          latencyMs: Date.now() - startTime,
          fallbackUsed: false,
          errorMessage: primaryErr.message,
        });
        throw primaryErr;
      }

      // Retryable -> Fallback to Gemini 3.7 Flash
      const fallbackConfig = AI_MODELS.banku_fallback;
      try {
        const fallbackResult = await this.geminiProvider.generateMultimodal<T>(
          prompt,
          mediaBase64,
          mimeType,
          schemaDescription,
          {
            ...options,
            modelId: fallbackConfig.modelId,
          }
        );

        const latencyMs = Date.now() - startTime;
        await aiQuotaService.recordUsage(request.userId, fallbackResult.metrics.totalTokens);
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'banku',
          provider: 'gemini',
          model: fallbackConfig.modelId,
          feature: request.feature,
          success: true,
          latencyMs,
          tokenUsage: fallbackResult.metrics.totalTokens,
          fallbackUsed: true,
        });

        return {
          data: fallbackResult.data,
          rawText: fallbackResult.rawText,
          provider: 'gemini',
          model: fallbackConfig.modelId,
          fallbackUsed: true,
          latencyMs,
          tokenUsage: fallbackResult.metrics.totalTokens,
        };
      } catch (fallbackErr: any) {
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'banku',
          provider: 'gemini',
          model: fallbackConfig.modelId,
          feature: request.feature,
          success: false,
          latencyMs: Date.now() - startTime,
          fallbackUsed: true,
          errorMessage: fallbackErr.message,
        });
        throw fallbackErr;
      }
    }
  }

  getGeminiProvider(): GeminiProvider {
    return this.geminiProvider;
  }

  getMistralProvider(): MistralProvider {
    return this.mistralProvider;
  }

  /**
   * Dispatches Banku conversational chat via geminiProvider (gemini-3.8-flash).
   * Enforces Banku persona system instruction and zero direct database write invariant.
   * If the request is to clear or modify data, explains the action and returns a proposal draft or confirmation request.
   */
  async routeBankuChat(
    request: BaseAIRequest,
    userMessage: string,
    conversationHistory?: Array<{ sender: 'user' | 'assistant'; text: string }>,
    options?: ProviderOptions
  ): Promise<RouteExecutionResult<BankuChatPayload>> {
    const startTime = Date.now();
    let fallbackUsed = false;

    // 1. Enforce safety policy & quota
    AIPolicy.validateRequestPayload(request as any);
    await aiQuotaService.checkQuota(request.userId, false);

    const primaryConfig = AI_MODELS.banku_primary;
    const prompt = buildBankuChatPrompt(userMessage, conversationHistory);
    const schemaDesc = `{"reply": string, "suggestedActions": string[], "proposal": {"type": string, "title": string, "description": string, "payload": any}}`;

    const lowerQuery = userMessage.toLowerCase();
    const isMutationRequest =
      lowerQuery.includes('clear') ||
      lowerQuery.includes('delete') ||
      lowerQuery.includes('remove') ||
      lowerQuery.includes('reset') ||
      lowerQuery.includes('wipe');

    const ensureProposalDraft = (resultData: BankuChatPayload): BankuChatPayload => {
      let data = { ...resultData };
      if (data.proposal) {
        data.proposal = {
          ...data.proposal,
          id: data.proposal.id || `prop-${Date.now()}`,
          status: 'pending',
          createdAt: data.proposal.createdAt || new Date().toISOString(),
          userId: request.userId,
        };
      } else if (isMutationRequest) {
        let propType: AIProposal['type'] = 'IMPORT_TIMETABLE';
        let propTitle = 'Clear Academic Schedule';
        let propDesc = 'User requested data reset. Explicit confirmation required to apply changes.';
        let payload: any = [];

        if (lowerQuery.includes('profile')) {
          propType = 'UPDATE_PROFILE';
          propTitle = 'Reset Profile Information';
          propDesc = 'User requested to clear or update profile. Requires confirmation.';
          payload = {};
        } else if (lowerQuery.includes('task')) {
          propType = 'CREATE_SUBTASKS';
          propTitle = 'Modify Task Schedule';
          propDesc = 'User requested task modification. Requires confirmation.';
          payload = { subtasks: [] };
        } else if (lowerQuery.includes('syllabus')) {
          propType = 'IMPORT_SYLLABUS';
          propTitle = 'Clear Syllabus Units';
          propDesc = 'User requested syllabus reset. Requires confirmation.';
          payload = { units: [] };
        }

        data.proposal = {
          id: `prop-mod-${Date.now()}`,
          type: propType,
          title: propTitle,
          description: propDesc,
          status: 'pending',
          createdAt: new Date().toISOString(),
          userId: request.userId,
          payload,
        };

        if (!data.reply || (!data.reply.toLowerCase().includes('proposal') && !data.reply.toLowerCase().includes('confirm'))) {
          data.reply = `I cannot directly write to or clear your database. I have generated a confirmation proposal draft for you to review and approve below.`;
        }
      }
      return data;
    };

    try {
      const result = await this.geminiProvider.generateStructured<BankuChatPayload>(
        prompt,
        schemaDesc,
        {
          ...options,
          modelId: primaryConfig.modelId,
          thinkingLevel: primaryConfig.thinkingLevel,
          systemInstruction: BANKU_CHAT_SYSTEM_INSTRUCTION,
        }
      );

      const processedData = ensureProposalDraft(result.data);
      const latencyMs = Date.now() - startTime;
      await aiQuotaService.recordUsage(request.userId, result.metrics.totalTokens);
      await aiAuditService.logEvent({
        userId: request.userId,
        persona: 'banku',
        provider: 'gemini',
        model: primaryConfig.modelId,
        feature: request.feature || 'conversational_chat',
        success: true,
        latencyMs,
        tokenUsage: result.metrics.totalTokens,
        fallbackUsed: false,
      });

      return {
        data: processedData,
        rawText: result.rawText,
        provider: 'gemini',
        model: primaryConfig.modelId,
        fallbackUsed: false,
        latencyMs,
        tokenUsage: result.metrics.totalTokens,
      };
    } catch (primaryErr: any) {
      if (!this.isRetryableError(primaryErr)) {
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'banku',
          provider: 'gemini',
          model: primaryConfig.modelId,
          feature: request.feature || 'conversational_chat',
          success: false,
          latencyMs: Date.now() - startTime,
          fallbackUsed: false,
          errorMessage: primaryErr.message,
          policyRejection: primaryErr instanceof AIPolicyRejectionError,
        });
        throw primaryErr;
      }

      // Retryable -> Fallback to Gemini 3.7 Flash
      fallbackUsed = true;
      const fallbackConfig = AI_MODELS.banku_fallback;
      try {
        const fallbackResult = await this.geminiProvider.generateStructured<BankuChatPayload>(
          prompt,
          schemaDesc,
          {
            ...options,
            modelId: fallbackConfig.modelId,
            systemInstruction: BANKU_CHAT_SYSTEM_INSTRUCTION,
          }
        );

        const processedData = ensureProposalDraft(fallbackResult.data);
        const latencyMs = Date.now() - startTime;
        await aiQuotaService.recordUsage(request.userId, fallbackResult.metrics.totalTokens);
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'banku',
          provider: 'gemini',
          model: fallbackConfig.modelId,
          feature: request.feature || 'conversational_chat',
          success: true,
          latencyMs,
          tokenUsage: fallbackResult.metrics.totalTokens,
          fallbackUsed: true,
        });

        return {
          data: processedData,
          rawText: fallbackResult.rawText,
          provider: 'gemini',
          model: fallbackConfig.modelId,
          fallbackUsed: true,
          latencyMs,
          tokenUsage: fallbackResult.metrics.totalTokens,
        };
      } catch (fallbackErr: any) {
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'banku',
          provider: 'gemini',
          model: fallbackConfig.modelId,
          feature: request.feature || 'conversational_chat',
          success: false,
          latencyMs: Date.now() - startTime,
          fallbackUsed: true,
          errorMessage: fallbackErr.message,
        });
        throw fallbackErr;
      }
    }
  }

  /**
   * Executes text generation with capability routing and fallback.
   */
  async routeText(
    request: BaseAIRequest,
    prompt: string,
    options?: ProviderOptions
  ): Promise<RouteExecutionResult<string>> {
    const startTime = Date.now();
    let fallbackUsed = false;

    // 1. Enforce safety policy & quota
    AIPolicy.validateRequestPayload(request as any);
    await aiQuotaService.checkQuota(request.userId, false);

    const persona: AIPersonaId = request.persona === 'banku' ? 'banku' : 'shanky';

    if (persona === 'banku') {
      const primaryConfig = AI_MODELS.banku_primary;
      const systemInstruction = options?.systemInstruction || BANKU_SYSTEM_INSTRUCTION;
      try {
        const result = await this.geminiProvider.generateText(prompt, {
          ...options,
          modelId: primaryConfig.modelId,
          thinkingLevel: primaryConfig.thinkingLevel,
          systemInstruction,
        });

        const latencyMs = Date.now() - startTime;
        await aiQuotaService.recordUsage(request.userId, result.metrics.totalTokens);
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'banku',
          provider: 'gemini',
          model: primaryConfig.modelId,
          feature: request.feature,
          success: true,
          latencyMs,
          tokenUsage: result.metrics.totalTokens,
          fallbackUsed: false,
        });

        return {
          data: result.text,
          rawText: result.text,
          provider: 'gemini',
          model: primaryConfig.modelId,
          fallbackUsed: false,
          latencyMs,
          tokenUsage: result.metrics.totalTokens,
        };
      } catch (primaryErr: any) {
        if (!this.isRetryableError(primaryErr)) {
          await aiAuditService.logEvent({
            userId: request.userId,
            persona: 'banku',
            provider: 'gemini',
            model: primaryConfig.modelId,
            feature: request.feature,
            success: false,
            latencyMs: Date.now() - startTime,
            fallbackUsed: false,
            errorMessage: primaryErr.message,
            policyRejection: primaryErr instanceof AIPolicyRejectionError,
          });
          throw primaryErr;
        }

        fallbackUsed = true;
        const fallbackConfig = AI_MODELS.banku_fallback;
        try {
          const fallbackResult = await this.geminiProvider.generateText(prompt, {
            ...options,
            modelId: fallbackConfig.modelId,
            systemInstruction,
          });

          const latencyMs = Date.now() - startTime;
          await aiQuotaService.recordUsage(request.userId, fallbackResult.metrics.totalTokens);
          await aiAuditService.logEvent({
            userId: request.userId,
            persona: 'banku',
            provider: 'gemini',
            model: fallbackConfig.modelId,
            feature: request.feature,
            success: true,
            latencyMs,
            tokenUsage: fallbackResult.metrics.totalTokens,
            fallbackUsed: true,
          });

          return {
            data: fallbackResult.text,
            rawText: fallbackResult.text,
            provider: 'gemini',
            model: fallbackConfig.modelId,
            fallbackUsed: true,
            latencyMs,
            tokenUsage: fallbackResult.metrics.totalTokens,
          };
        } catch (fallbackErr: any) {
          await aiAuditService.logEvent({
            userId: request.userId,
            persona: 'banku',
            provider: 'gemini',
            model: fallbackConfig.modelId,
            feature: request.feature,
            success: false,
            latencyMs: Date.now() - startTime,
            fallbackUsed: true,
            errorMessage: fallbackErr.message,
          });
          throw fallbackErr;
        }
      }
    } else {
      const primaryConfig = AI_MODELS.shanky_primary;
      try {
        const result = await this.mistralProvider.generateText(prompt, {
          ...options,
          modelId: primaryConfig.modelId,
        });

        const latencyMs = Date.now() - startTime;
        await aiQuotaService.recordUsage(request.userId, result.metrics.totalTokens);
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'shanky',
          provider: 'mistral',
          model: primaryConfig.modelId,
          feature: request.feature,
          success: true,
          latencyMs,
          tokenUsage: result.metrics.totalTokens,
          fallbackUsed: false,
        });

        return {
          data: result.text,
          rawText: result.text,
          provider: 'mistral',
          model: primaryConfig.modelId,
          fallbackUsed: false,
          latencyMs,
          tokenUsage: result.metrics.totalTokens,
        };
      } catch (primaryErr: any) {
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'shanky',
          provider: 'mistral',
          model: primaryConfig.modelId,
          feature: request.feature,
          success: false,
          latencyMs: Date.now() - startTime,
          fallbackUsed: false,
          errorMessage: primaryErr.message,
          policyRejection: primaryErr instanceof AIPolicyRejectionError,
        });
        throw primaryErr;
      }
    }
  }
}


export const aiRouter = new AIRouter();
