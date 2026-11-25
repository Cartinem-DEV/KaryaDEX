/**
 * KaryaDEX — AI Provider Interface (Phase 12)
 *
 * Provider-agnostic abstraction enabling seamless pluggability of
 * Gemini, Groq, OpenAI, Anthropic, or local on-device models.
 */

import type { AICapability, AIProviderId, AIUsageMetrics } from '../core/aiTypes';

export interface MediaPartInput {
  base64?: string;
  base64Data?: string;
  mimeType: string;
  fileName?: string;
}

export interface ProviderOptions {
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  timeoutMs?: number;
  apiKeyOverride?: string; // Optional BYOK key
  mediaParts?: MediaPartInput[];
}

export interface ProviderTextResult {
  text: string;
  model: string;
  metrics: AIUsageMetrics;
}

export interface ProviderStructuredResult<T = any> {
  data: T;
  rawText: string;
  model: string;
  metrics: AIUsageMetrics;
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly supportedCapabilities: readonly AICapability[];
  readonly supportsVision: boolean;
  readonly supportsPDF: boolean;

  generateText(
    prompt: string,
    options?: ProviderOptions
  ): Promise<ProviderTextResult>;

  generateStructured<T>(
    prompt: string,
    schemaDescription: string,
    options?: ProviderOptions
  ): Promise<ProviderStructuredResult<T>>;

  generateMultimodal<T>(
    prompt: string,
    mediaBase64: string,
    mimeType: string,
    schemaDescription?: string,
    options?: ProviderOptions
  ): Promise<ProviderStructuredResult<T>>;
}
