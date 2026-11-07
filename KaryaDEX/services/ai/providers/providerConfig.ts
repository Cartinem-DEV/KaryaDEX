/**
 * BunkMatKar — AI Model & Provider Configuration (Phase 12)
 *
 * Central configuration registry for AI model slots and providers.
 * Do NOT scatter model strings across UI or feature files.
 */

import type { AIModelConfig, AIModelSlot, AIProviderLimitConfig } from '../core/aiTypes';

export const AI_MODELS: Record<AIModelSlot, AIModelConfig> = {
  banku_primary: {
    slot: 'banku_primary',
    provider: 'gemini',
    modelId: 'gemini-3.8-flash',
    maxTokens: 4096,
    temperature: 0.2, // Low temperature for factual parsing
    supportsThinking: true,
    thinkingLevel: 'low',
  },
  banku_fallback: {
    slot: 'banku_fallback',
    provider: 'gemini',
    modelId: 'gemini-3.7-flash',
    maxTokens: 4096,
    temperature: 0.2,
    supportsThinking: false,
  },
  shanky_primary: {
    slot: 'shanky_primary',
    provider: 'mistral',
    // Mistral Ministral 3 8B exact model ID: ministral-8b-2512
    modelId: 'ministral-8b-2512',
    maxTokens: 2048,
    temperature: 0.4,
    supportsThinking: false,
  },
};

/**
 * AI Provider Limits & Rate Configuration.
 * Treats provider limits as runtime/account-configurable parameters.
 */
export const AI_PROVIDER_LIMITS: Record<'gemini' | 'mistral', AIProviderLimitConfig> = {
  gemini: {
    provider: 'gemini',
    requestsPerMinute: 15,
    tokensPerMinute: 1000000,
    dailyRequestCeiling: 1500,
    monthlyTokenBudget: 50000000,
    retryAfterSeconds: 30,
  },
  mistral: {
    provider: 'mistral',
    requestsPerMinute: 30,
    tokensPerMinute: 500000,
    dailyRequestCeiling: 1000,
    monthlyTokenBudget: 25000000,
    retryAfterSeconds: 60,
  },
};

export const AI_TIMEOUT_MS = {
  textChat: 15000,
  visionParsing: 30000,
  pdfParsing: 45000,
  general: 20000,
};

export const AI_GATEWAY_CONFIG = {
  endpoint: 'ai-gateway', // Supabase Edge Function name
  maxRetriesPerSlot: 1,
  defaultDailyRequestLimit: 50,
  defaultDailyTokenLimit: 100000,
};
