/**
 * BunkMatKar — AI Client (Phase 12 / 12.2)
 *
 * Central client for all AI interactions.
 * Connects securely to the Cloudflare Workers AI Gateway,
 * enforcing JWT authentication, tenant boundary alignment, quota tracking,
 * and truthful error propagation (zero silent swallows or fake local errors).
 */

import { supabase } from '@/services/supabase/supabaseClient';
import { isSupabaseConfigured, isCloudflareConfigured, getCloudflareConfig } from '@/services/supabase/supabaseConfig';
import { aiRouter } from './aiRouter';
import { AIPolicy } from './aiPolicy';
import { aiQuotaService } from './aiQuotaService';
import { aiCacheService } from './aiCacheService';
import { aiAuditService } from './aiAuditService';
import { BYOKStorage } from '../storage/byokStorage';
import { addBreadcrumb, captureException, setTag } from '@/services/monitoring/sentryService';
import type {
  AIResponse,
  BaseAIRequest,
  AIPersonaId,
  AIProviderId,
} from './aiTypes';
import {
  AIError,
  AIProviderAuthError,
  AIProviderRateLimitError,
  AIInvalidRequestError,
  AIPolicyRejectionError,
  AIContextViolationError,
} from './aiTypes';

export interface ExecuteStructuredParams {
  request: BaseAIRequest;
  prompt: string;
  schemaDescription: string;
  cacheVersionKey?: string;
  cacheTtlSeconds?: number;
}

export interface ExecuteMultimodalParams {
  request: BaseAIRequest;
  prompt: string;
  mediaBase64?: string;
  mimeType?: string;
  mediaParts?: Array<{
    base64?: string;
    base64Data?: string;
    mimeType: string;
    fileName?: string;
  }>;
  schemaDescription: string;
}

export class AIClient {
  /**
   * Resolves the CURRENT authenticated Supabase session user id, if any.
   * Never creates or mutates sessions: tenant identity is the user's own sign-in.
   * Returns null when unauthenticated so callers can fail truthfully.
   */
  async ensureAuthenticatedSession(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        return session.user.id;
      }
    } catch (err) {
      console.warn('[AIClient] Auth session resolution warning:', err);
    }
    return null;
  }

  /**
   * Truthfully parses edge gateway error payloads into typed AIErrors.
   */
  private async parseGatewayError(edgeErr: any, edgeRes: any): Promise<AIError> {
    let errorMsg = edgeRes?.error || edgeErr?.message || 'AI Gateway execution failed';
    let errorCode = edgeRes?.code || 'GATEWAY_ERROR';

    if (edgeErr && (edgeErr as any).context) {
      try {
        const body = await (edgeErr as any).context.json();
        if (body?.error) errorMsg = body.error;
        if (body?.code) errorCode = body.code;
      } catch {}
    }

    if (errorCode === 'QUOTA_EXCEEDED' || errorMsg.includes('quota') || errorMsg.includes('429')) {
      return new AIProviderRateLimitError(errorMsg);
    }
    if (errorMsg.includes('Unauthorized') || errorMsg.includes('Invalid or expired token') || errorMsg.includes('Missing Authorization')) {
      return new AIProviderAuthError(`AI Gateway authentication required: ${errorMsg}`);
    }
    if (errorMsg.includes('Forbidden') || errorMsg.includes('Cross-tenant')) {
      return new AIError(errorMsg, 'CROSS_TENANT_FORBIDDEN');
    }
    if (errorMsg.includes('rate-limited')) {
      return new AIProviderRateLimitError(errorMsg);
    }
    if (errorMsg.includes('unavailable') || errorMsg.includes('503') || errorMsg.includes('500')) {
      return new AIError(errorMsg, 'PROVIDER_UNAVAILABLE', true);
    }

    return new AIError(errorMsg, errorCode);
  }

  /**
   * Executes structured AI generation with caching, policy checks, and error handling.
   */
  async executeStructured<T>(params: ExecuteStructuredParams): Promise<AIResponse<T>> {
    const { request, prompt, schemaDescription, cacheVersionKey, cacheTtlSeconds } = params;
    const startTime = Date.now();

    // Sentry: Add breadcrumb for AI request start
    addBreadcrumb({
      category: 'ai.request',
      message: `Starting ${request.persona} request for ${request.feature}`,
      level: 'info',
      data: {
        persona: request.persona,
        feature: request.feature,
        userId: request.userId,
        hasCacheKey: !!cacheVersionKey,
      },
    });

    // 1. Policy & Authorization check
    AIPolicy.validateRequestPayload(request as any);
    await aiQuotaService.checkQuota(request.userId, false);

    // 2. Cache lookup if key provided
    if (cacheVersionKey) {
      const cached = await aiCacheService.get<T>(request.userId, request.feature, cacheVersionKey);
      if (cached) {
        // Sentry: Record cache hit
        addBreadcrumb({
          category: 'ai.cache',
          message: `Cache hit for ${request.feature}`,
          level: 'info',
          data: { feature: request.feature, cacheKey: cacheVersionKey },
        });

        // transaction?.finish();
        return {
          success: true,
          persona: request.persona,
          provider: 'edge-gateway',
          model: 'cached',
          fallbackUsed: false,
          data: cached,
          metrics: { latencyMs: Date.now() - startTime },
        };
      }
    }

    // 3. Check for BYOK keys
    const byokMistral = await BYOKStorage.getMistralKey();
    const byokGemini = await BYOKStorage.getGeminiKey();

    // 4. Dispatch through Cloudflare Worker AI Gateway if configured & no BYOK override
    // Falls back to Supabase Edge Function if Worker not configured
    const cloudflareConfig = getCloudflareConfig();
    const useWorker = isCloudflareConfigured() && !byokMistral && !byokGemini;

    if ((useWorker || isSupabaseConfigured()) && !byokMistral && !byokGemini) {
      // Ensure user session & align request.userId with authenticated session
      const authUserId = await this.ensureAuthenticatedSession();
      if (!authUserId) {
        throw new AIProviderAuthError(
          'Sign in required: AI features need your own account so requests, quota, and cached context stay isolated to you. Open Account & Cloud Sync to sign in.'
        );
      }
      request.userId = authUserId;

      let edgeRes: any = null;
      let edgeErr: any = null;

      try {
        if (useWorker) {
          // Call Cloudflare Worker directly
          const { data: { session } } = await supabase.auth.getSession();
          const authToken = session?.access_token;

          const response = await fetch(cloudflareConfig.workerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
            body: JSON.stringify({
              request,
              prompt,
              schemaDescription,
            }),
          });

          const result = await response.json();
          edgeRes = result;
          if (!response.ok) {
            edgeErr = result;
          }
        } else {
          // Fallback to Supabase Edge Function
          const invokeRes = await supabase.functions.invoke('ai-gateway', {
            body: {
              request,
              prompt,
              schemaDescription,
            },
          });
          edgeRes = invokeRes.data;
          edgeErr = invokeRes.error;
        }
      } catch (err: any) {
        edgeErr = err;
      }

      if (!edgeErr && edgeRes && edgeRes.success) {
        const latencyMs = Date.now() - startTime;
        const tokenUsage = (edgeRes.metrics?.promptTokens || 0) + (edgeRes.metrics?.completionTokens || 0);

        await aiQuotaService.recordUsage(request.userId, tokenUsage);
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: request.persona,
          provider: edgeRes.provider || (request.persona === 'banku' ? 'gemini' : 'mistral'),
          model: edgeRes.model || 'unknown',
          feature: request.feature,
          success: true,
          latencyMs,
          tokenUsage,
          fallbackUsed: Boolean(edgeRes.fallbackUsed),
        });

        // Sentry: Record successful AI response
        addBreadcrumb({
          category: 'ai.response',
          message: `${request.persona} request succeeded for ${request.feature}`,
          level: 'info',
          data: {
            persona: request.persona,
            feature: request.feature,
            provider: edgeRes.provider,
            model: edgeRes.model,
            latencyMs,
            tokenUsage,
            fallbackUsed: Boolean(edgeRes.fallbackUsed),
          },
        });

        // Sentry: Set tags for filtering
        setTag('ai_persona', request.persona);
        setTag('ai_provider', edgeRes.provider || 'unknown');
        setTag('ai_model', edgeRes.model || 'unknown');
        setTag('ai_feature', request.feature);

        // transaction?.finish();

        if (cacheVersionKey) {
          await aiCacheService.set(
            request.userId,
            request.feature,
            cacheVersionKey,
            edgeRes.data,
            cacheTtlSeconds
          );
        }

        return {
          success: true,
          persona: edgeRes.persona,
          provider: edgeRes.provider,
          model: edgeRes.model,
          fallbackUsed: Boolean(edgeRes.fallbackUsed),
          data: edgeRes.data as T,
          metrics: {
            latencyMs,
            promptTokens: edgeRes.metrics?.promptTokens,
            completionTokens: edgeRes.metrics?.completionTokens,
            totalTokens: tokenUsage,
          },
        };
      }

      // If gateway returned an error and NO BYOK key is configured,
      // truthfully propagate the error instead of silently falling back to a client-side key
      if (!byokMistral && !byokGemini) {
        const parsedError = await this.parseGatewayError(edgeErr, edgeRes);

        // Sentry: Capture AI gateway error
        addBreadcrumb({
          category: 'ai.error',
          message: `${request.persona} request failed for ${request.feature}: ${parsedError.message}`,
          level: 'error',
          data: {
            persona: request.persona,
            feature: request.feature,
            errorCode: parsedError.code,
            isRetryable: parsedError.isRetryable,
            gatewayError: edgeErr?.error || edgeRes?.error,
            gatewayCode: edgeRes?.code,
          },
        });

        captureException(parsedError, {
          persona: request.persona,
          feature: request.feature,
          provider: 'edge-gateway',
          errorCode: parsedError.code,
          isRetryable: parsedError.isRetryable,
        });

        // transaction?.finish();
        throw parsedError;
      }
    }

    // 5. Fallback or direct local execution via aiRouter (BYOK explicitly configured)
    const options = {
      apiKeyOverride: request.persona === 'banku' ? byokGemini || undefined : byokMistral || undefined,
    };

    const routeRes = await aiRouter.routeStructured<T>(
      request,
      prompt,
      schemaDescription,
      options
    );

    // Sentry: Record successful local AI response
    addBreadcrumb({
      category: 'ai.response',
      message: `${request.persona} local request succeeded for ${request.feature}`,
      level: 'info',
      data: {
        persona: request.persona,
        feature: request.feature,
        provider: routeRes.provider,
        model: routeRes.model,
        latencyMs: routeRes.latencyMs,
        tokenUsage: routeRes.tokenUsage,
        fallbackUsed: routeRes.fallbackUsed,
      },
    });

    setTag('ai_persona', request.persona);
    setTag('ai_provider', routeRes.provider);
    setTag('ai_model', routeRes.model);
    setTag('ai_feature', request.feature);

    // transaction?.finish();

    if (cacheVersionKey) {
      await aiCacheService.set(
        request.userId,
        request.feature,
        cacheVersionKey,
        routeRes.data,
        cacheTtlSeconds
      );
    }

    return {
      success: true,
      persona: request.persona,
      provider: routeRes.provider,
      model: routeRes.model,
      fallbackUsed: routeRes.fallbackUsed,
      data: routeRes.data,
      metrics: {
        latencyMs: routeRes.latencyMs,
        totalTokens: routeRes.tokenUsage,
      },
    };
  }

  /**
   * Executes multimodal document or image extraction.
   */
  async executeMultimodal<T>(params: ExecuteMultimodalParams): Promise<AIResponse<T>> {
    const { request, prompt, mediaBase64, mimeType, mediaParts, schemaDescription } = params;
    const startTime = Date.now();

    // Sentry: Add breadcrumb for multimodal AI request start
    addBreadcrumb({
      category: 'ai.request',
      message: `Starting Banku multimodal request for ${request.feature}`,
      level: 'info',
      data: {
        persona: 'banku',
        feature: request.feature,
        userId: request.userId,
        hasMedia: !!mediaBase64,
        mediaPartsCount: mediaParts?.length || 0,
      },
    });

    // Parse and sanitize mediaBase64 to strip any data URL prefix and whitespace
    let cleanMediaBase64 = mediaBase64 || '';
    let cleanMimeType = mimeType || '';
    if (typeof cleanMediaBase64 === 'string' && cleanMediaBase64.length > 0) {
      if (cleanMediaBase64.includes(',')) {
        const parts = cleanMediaBase64.split(',');
        const match = parts[0].match(/^data:([^;]+)/i);
        if (match && match[1] && !cleanMimeType) {
          cleanMimeType = match[1];
        }
        cleanMediaBase64 = parts[1];
      }
      cleanMediaBase64 = cleanMediaBase64.replace(/\s/g, '');
    }

    // Sanitize any mediaParts provided
    const sanitizedMediaParts: Array<{ base64: string; mimeType: string; fileName?: string }> = [];
    if (mediaParts && mediaParts.length > 0) {
      for (const p of mediaParts) {
        let pData = p.base64 || p.base64Data || '';
        let pMime = p.mimeType || 'application/pdf';
        if (typeof pData === 'string') {
          if (pData.includes(',')) {
            const split = pData.split(',');
            const match = split[0].match(/^data:([^;]+)/i);
            if (match && match[1] && !pMime) {
              pMime = match[1];
            }
            pData = split[1];
          }
          pData = pData.replace(/\s/g, '');
        }
        if (pData) {
          sanitizedMediaParts.push({
            base64: pData,
            mimeType: pMime,
            fileName: p.fileName,
          });
        }
      }
    }

    // If cleanMediaBase64 wasn't set but sanitizedMediaParts has items, initialize from first part
    if (!cleanMediaBase64 && sanitizedMediaParts.length > 0) {
      cleanMediaBase64 = sanitizedMediaParts[0].base64;
      cleanMimeType = sanitizedMediaParts[0].mimeType;
    }

    // 1. Policy & Authorization check
    AIPolicy.validateRequestPayload(request as any);
    await aiQuotaService.checkQuota(request.userId, true);

    const byokGemini = await BYOKStorage.getGeminiKey();

    // 2. Gateway dispatch if available and not BYOK
    // Prefers Cloudflare Worker, falls back to Supabase Edge Function
    const cloudflareConfig = getCloudflareConfig();
    const useWorker = isCloudflareConfigured() && !byokGemini;

    if ((useWorker || isSupabaseConfigured()) && !byokGemini) {
      const authUserId = await this.ensureAuthenticatedSession();
      if (!authUserId) {
        throw new AIProviderAuthError(
          'Sign in required: Banku document analysis needs your own account so requests, quota, and results stay isolated to you. Open Account & Cloud Sync to sign in.'
        );
      }
      request.userId = authUserId;

      let edgeRes: any = null;
      let edgeErr: any = null;

      try {
        if (useWorker) {
          // Call Cloudflare Worker directly
          const { data: { session } } = await supabase.auth.getSession();
          const authToken = session?.access_token;

          const response = await fetch(cloudflareConfig.workerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
            body: JSON.stringify({
              request,
              prompt,
              schemaDescription,
              mediaBase64: cleanMediaBase64,
              mimeType: cleanMimeType,
              mediaParts: sanitizedMediaParts.length > 0 ? sanitizedMediaParts : undefined,
            }),
          });

          const result = await response.json();
          edgeRes = result;
          if (!response.ok) {
            edgeErr = result;
          }
        } else {
          // Fallback to Supabase Edge Function
          const invokeRes = await supabase.functions.invoke('ai-gateway', {
            body: {
              request,
              prompt,
              schemaDescription,
              mediaBase64: cleanMediaBase64,
              mimeType: cleanMimeType,
              mediaParts: sanitizedMediaParts.length > 0 ? sanitizedMediaParts : undefined,
            },
          });
          edgeRes = invokeRes.data;
          edgeErr = invokeRes.error;
        }
      } catch (err: any) {
        edgeErr = err;
      }

      if (!edgeErr && edgeRes && edgeRes.success) {
        const latencyMs = Date.now() - startTime;
        const tokenUsage = (edgeRes.metrics?.promptTokens || 0) + (edgeRes.metrics?.completionTokens || 0);

        await aiQuotaService.recordUsage(request.userId, tokenUsage);
        await aiAuditService.logEvent({
          userId: request.userId,
          persona: 'banku',
          provider: 'gemini',
          model: edgeRes.model || 'gemini-3.8-flash',
          feature: request.feature,
          success: true,
          latencyMs,
          tokenUsage,
          fallbackUsed: Boolean(edgeRes.fallbackUsed),
        });

        // Sentry: Record successful multimodal response
        addBreadcrumb({
          category: 'ai.response',
          message: `Banku multimodal request succeeded for ${request.feature}`,
          level: 'info',
          data: {
            feature: request.feature,
            model: edgeRes.model,
            latencyMs,
            tokenUsage,
          },
        });

        setTag('ai_persona', 'banku');
        setTag('ai_provider', 'gemini');
        setTag('ai_model', edgeRes.model || 'gemini-3.8-flash');
        setTag('ai_feature', request.feature);

        // transaction?.finish();

        return {
          success: true,
          persona: 'banku',
          provider: 'gemini',
          model: edgeRes.model,
          fallbackUsed: Boolean(edgeRes.fallbackUsed),
          data: edgeRes.data as T,
          metrics: {
            latencyMs,
            promptTokens: edgeRes.metrics?.promptTokens,
            completionTokens: edgeRes.metrics?.completionTokens,
            totalTokens: tokenUsage,
          },
        };
      }

      // If gateway returned an error and NO BYOK key is configured, truthfully propagate error
      if (!byokGemini) {
        const parsedError = await this.parseGatewayError(edgeErr, edgeRes);

        // Sentry: Capture AI gateway error
        addBreadcrumb({
          category: 'ai.error',
          message: `Banku multimodal request failed for ${request.feature}: ${parsedError.message}`,
          level: 'error',
          data: {
            feature: request.feature,
            errorCode: parsedError.code,
            isRetryable: parsedError.isRetryable,
            gatewayError: edgeErr?.error || edgeRes?.error,
          },
        });

        captureException(parsedError, {
          feature: request.feature,
          provider: 'edge-gateway',
        });

        // transaction?.finish();
        throw parsedError;
      }
    }

    // 3. Local route via aiRouter (BYOK explicitly configured)
    const options = {
      apiKeyOverride: byokGemini || undefined,
      mediaParts: sanitizedMediaParts.length > 0 ? sanitizedMediaParts : undefined,
    };

    const routeRes = await aiRouter.routeMultimodal<T>(
      request,
      prompt,
      cleanMediaBase64,
      cleanMimeType,
      schemaDescription,
      options
    );

    // Sentry: Record successful local multimodal response
    addBreadcrumb({
      category: 'ai.response',
      message: `Banku local multimodal request succeeded for ${request.feature}`,
      level: 'info',
      data: {
        feature: request.feature,
        provider: routeRes.provider,
        model: routeRes.model,
        latencyMs: routeRes.latencyMs,
        tokenUsage: routeRes.tokenUsage,
        fallbackUsed: routeRes.fallbackUsed,
      },
    });

    setTag('ai_persona', 'banku');
    setTag('ai_provider', routeRes.provider);
    setTag('ai_model', routeRes.model);
    setTag('ai_feature', request.feature);

    // transaction?.finish();

    return {
      success: true,
      persona: 'banku',
      provider: routeRes.provider,
      model: routeRes.model,
      fallbackUsed: routeRes.fallbackUsed,
      data: routeRes.data,
      metrics: {
        latencyMs: routeRes.latencyMs,
        totalTokens: routeRes.tokenUsage,
      },
    };
  }
}

export const aiClient = new AIClient();
