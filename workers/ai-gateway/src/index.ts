// src/index.ts — Main Cloudflare Worker entry point
// Routes: /health, /email/*, /ai-gateway (or root)

import * as Sentry from '@sentry/cloudflare';
import { initSentry, captureWorkerError, addWorkerBreadcrumb } from './sentry';
import type { Env, AIGatewayRequest, AIGatewayResponse } from './types';
import { verifySupabaseJWT, AuthError } from './auth';
import { checkAndIncrementQuota } from './quota';
import { callGemini } from './providers/gemini';
import { callMistral } from './providers/mistral';
import { handleEmailRequest, handleEmailHealth } from './emails/emailRoutes';
import { corsResponse, handleOptions, extractMediaFromRequest, cleanJsonResponse } from './utils';

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT || 'production',
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.2 : 1.0,
    traceLifecycle: 'stream',
    sendDefaultPii: false,
  }),
  {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      // Initialize Sentry for this request
      initSentry(env);

      const url = new URL(request.url);
      const path = url.pathname;
      const startTime = Date.now();

      // Add request breadcrumb
      addWorkerBreadcrumb('http.request', `${request.method} ${path}`, 'info', {
        method: request.method,
        path,
      });

      // Handle CORS preflight for all routes
      if (request.method === 'OPTIONS') {
        return handleOptions();
      }

      // Health check endpoint
      if (path === '/health') {
        return corsResponse({ status: 'ok', service: 'ai-gateway', timestamp: new Date().toISOString() });
      }

      // Email service endpoints
      if (path.startsWith('/email')) {
        if (path === '/email/health') {
          return handleEmailHealth();
        }
        return handleEmailRequest(request, env);
      }

      // AI Gateway endpoint (root or /ai-gateway)
      if (path === '/' || path === '/ai-gateway') {
        return handleAIGatewayRequest(request, env);
      }

      return corsResponse({ error: 'Not found' }, 404);
    },
  }
);

async function handleAIGatewayRequest(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();

  try {
    // 1. Verify User Authentication via Supabase JWT
    const authHeader = request.headers.get('Authorization');
    let userId: string;

    try {
      const { userId: verifiedUserId } = await verifySupabaseJWT(authHeader, env);
      userId = verifiedUserId;

      // Set user context in Sentry
      Sentry.setUser({ id: userId });
      Sentry.getCurrentScope().setTag('user_id', userId);
    } catch (authErr) {
      if (authErr instanceof AuthError) {
        return corsResponse(
          { success: false, error: authErr.message, metrics: { latencyMs: Date.now() - startTime } },
          authErr.status
        );
      }
      throw authErr;
    }

    // 2. Parse & Validate Payload
    let body: AIGatewayRequest;
    try {
      body = await request.json();
    } catch {
      return corsResponse(
        { success: false, error: 'Invalid JSON payload', metrics: { latencyMs: Date.now() - startTime } },
        400
      );
    }

    const { request: requestBody, prompt, schemaDescription } = body;

    if (!requestBody || !prompt) {
      return corsResponse(
        { success: false, error: 'Invalid payload: missing request or prompt.', metrics: { latencyMs: Date.now() - startTime } },
        400
      );
    }

    // Tenant boundary check: user can only execute requests for their own authenticated ID
    if (requestBody.userId && requestBody.userId !== userId) {
      return corsResponse(
        { success: false, error: 'Forbidden: Cross-tenant execution is strictly prohibited.', metrics: { latencyMs: Date.now() - startTime } },
        403
      );
    }

    // 3. Check Daily Quota (50 requests/day default)
    const maxDailyRequests = parseInt(env.MAX_DAILY_REQUESTS || '50', 10);
    const quotaResult = await checkAndIncrementQuota(userId, env, maxDailyRequests);

    if (!quotaResult.allowed) {
      return corsResponse(
        {
          success: false,
          error: `Daily AI quota of ${maxDailyRequests} requests reached for today. Resets tomorrow.`,
          code: 'QUOTA_EXCEEDED',
          metrics: { latencyMs: Date.now() - startTime },
        },
        429
      );
    }

    // 4. Determine persona and route to provider
    const { isMultimodal } = extractMediaFromRequest(body);
    const persona = isMultimodal || requestBody.persona === 'banku' ? 'banku' : 'shanky';

    // Set persona tag for Sentry
    Sentry.getCurrentScope().setTag('ai_persona', persona);
    Sentry.getCurrentScope().setTag('ai_feature', requestBody.feature);

    if (persona === 'banku') {
      // Banku: Gemini with fallback
      const result = await callGemini(env, body, prompt, schemaDescription, startTime);

      if (!result.success) {
        // Sentry: Capture AI provider error
        addWorkerBreadcrumb('ai.error', `Gemini request failed: ${result.error}`, 'error', {
          persona: 'banku',
          feature: requestBody.feature,
          error: result.error,
          userId,
        });

        return corsResponse(result, 500);
      }

      // Record token usage in quota
      const tokensUsed = (result.metrics.promptTokens || 0) + (result.metrics.completionTokens || 0);
      await checkAndIncrementQuota(userId, env, maxDailyRequests, tokensUsed);

      // Sentry: Record successful AI response
      addWorkerBreadcrumb('ai.response', `Gemini request succeeded for ${requestBody.feature}`, 'info', {
        persona: 'banku',
        feature: requestBody.feature,
        model: result.model,
        latencyMs: result.metrics.latencyMs,
        tokenUsage: tokensUsed,
        fallbackUsed: result.fallbackUsed,
      });

      return corsResponse({
        success: true,
        persona: 'banku',
        provider: 'gemini',
        model: result.model,
        fallbackUsed: result.fallbackUsed,
        data: result.data,
        rawText: result.rawText,
        metrics: result.metrics,
      });
    } else {
      // Shanky: Mistral
      const result = await callMistral(env, prompt, schemaDescription, startTime);

      if (!result.success) {
        // Sentry: Capture AI provider error
        addWorkerBreadcrumb('ai.error', `Mistral request failed: ${result.error}`, 'error', {
          persona: 'shanky',
          feature: requestBody.feature,
          error: result.error,
          userId,
        });

        // For rate limits, return 429; for others, 503
        const status = result.error.includes('rate-limited') ? 429 : 503;
        return corsResponse(result, status);
      }

      // Record token usage in quota
      const tokensUsed = (result.metrics.promptTokens || 0) + (result.metrics.completionTokens || 0);
      await checkAndIncrementQuota(userId, env, maxDailyRequests, tokensUsed);

      // Sentry: Record successful AI response
      addWorkerBreadcrumb('ai.response', `Mistral request succeeded for ${requestBody.feature}`, 'info', {
        persona: 'shanky',
        feature: requestBody.feature,
        model: result.model,
        latencyMs: result.metrics.latencyMs,
        tokenUsage: tokensUsed,
      });

      return corsResponse({
        success: true,
        persona: 'shanky',
        provider: 'mistral',
        model: result.model,
        fallbackUsed: false,
        data: result.data,
        rawText: result.rawText,
        metrics: result.metrics,
      });
    }
  } catch (err: any) {
    console.error('AI Gateway error:', err);

    // Sentry: Capture unexpected errors
    const errorId = await captureWorkerError(err, request, undefined, {
      path: new URL(request.url).pathname,
      method: request.method,
    });

    return corsResponse(
      {
        success: false,
        error: err.message || 'Internal server error in AI gateway',
        errorId,
        metrics: { latencyMs: Date.now() - startTime },
      },
      500
    );
  }
}