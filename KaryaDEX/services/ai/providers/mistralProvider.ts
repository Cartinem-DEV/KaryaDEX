/**
 * BunkMatKar — Mistral AI Provider Adapter (Phase 12)
 *
 * Implements high-speed inference for Shanky using Mistral AI.
 * Configured with ministral-8b-2512 (Ministral 3 8B).
 * Supports chat completions, structured JSON mode, timeout management,
 * and strict independent rate limit/quota handling.
 */

import type { AIProvider, ProviderOptions, ProviderStructuredResult, ProviderTextResult } from './aiProvider';
import type { AICapability, AIProviderId } from '../core/aiTypes';
import {
  AIProviderRateLimitError,
  AIProviderTimeoutError,
  AIProviderAuthError,
  AIInvalidRequestError,
  AIError,
} from '../core/aiTypes';
import { AI_MODELS } from './providerConfig';

export class MistralProvider implements AIProvider {
  readonly id: AIProviderId = 'mistral';
  readonly supportedCapabilities: readonly AICapability[] = ['text', 'structured'];
  readonly supportsVision = false;
  readonly supportsPDF = false;

  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private resolveApiKey(options?: ProviderOptions): string {
    const key = options?.apiKeyOverride || this.apiKey || process.env.MISTRAL_API_KEY;
    if (!key) {
      throw new AIProviderAuthError('Mistral API key is not configured.');
    }
    return key;
  }

  private handleApiError(status: number, message: string): never {
    if (status === 429) {
      throw new AIProviderRateLimitError(`Mistral rate limit exceeded (429): ${message}`);
    }
    if (status === 401 || status === 403) {
      throw new AIProviderAuthError(`Mistral authentication failed (${status}): ${message}`);
    }
    if (status === 400) {
      throw new AIInvalidRequestError(`Mistral invalid request (400): ${message}`);
    }
    if (status === 500 || status === 502 || status === 503 || status === 504) {
      throw new AIError(`Mistral server error (${status}): ${message}`, 'PROVIDER_UNAVAILABLE', true);
    }
    throw new AIError(`Mistral provider error (${status}): ${message}`, 'MISTRAL_ERROR', false);
  }

  async generateText(
    prompt: string,
    options?: ProviderOptions
  ): Promise<ProviderTextResult> {
    const model = options?.modelId || AI_MODELS.shanky_primary.modelId;
    const apiKey = this.resolveApiKey(options);
    const startTime = Date.now();

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const body = {
      model,
      messages,
      temperature: options?.temperature ?? 0.4,
      max_tokens: options?.maxTokens ?? 2048,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs ?? 20000);

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        this.handleApiError(response.status, errText);
      }

      const resJson = await response.json();
      const rawText = resJson.choices?.[0]?.message?.content || '';
      const latencyMs = Date.now() - startTime;

      return {
        text: rawText,
        model,
        metrics: {
          latencyMs,
          promptTokens: resJson.usage?.prompt_tokens,
          completionTokens: resJson.usage?.completion_tokens,
          totalTokens: resJson.usage?.total_tokens,
        },
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new AIProviderTimeoutError('Mistral request timed out.');
      }
      if (err instanceof AIError) {
        throw err;
      }
      throw new AIError(`Mistral connection error: ${err.message}`, 'NETWORK_ERROR', true);
    }
  }

  async generateStructured<T>(
    prompt: string,
    schemaDescription: string,
    options?: ProviderOptions
  ): Promise<ProviderStructuredResult<T>> {
    const model = options?.modelId || AI_MODELS.shanky_primary.modelId;
    const apiKey = this.resolveApiKey(options);
    const startTime = Date.now();

    const systemInstruction = options?.systemInstruction
      ? `${options.systemInstruction}\n\nStrict Output Requirement:\nYou must respond ONLY with valid JSON conforming to this schema:\n${schemaDescription}`
      : `Strict Output Requirement:\nYou must respond ONLY with valid JSON conforming to this schema:\n${schemaDescription}`;

    const messages = [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt },
    ];

    const body = {
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 2048,
      response_format: { type: 'json_object' },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs ?? 25000);

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        this.handleApiError(response.status, errText);
      }

      const resJson = await response.json();
      const rawText = resJson.choices?.[0]?.message?.content || '';
      const latencyMs = Date.now() - startTime;

      // Clean Markdown code block fences if present
      const cleanedText = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let parsedData: T;
      try {
        parsedData = JSON.parse(cleanedText);
      } catch (parseErr: any) {
        throw new AIInvalidRequestError(
          `Mistral returned invalid JSON output: ${parseErr.message}\nRaw: ${rawText.slice(0, 200)}`
        );
      }

      return {
        data: parsedData,
        rawText,
        model,
        metrics: {
          latencyMs,
          promptTokens: resJson.usage?.prompt_tokens,
          completionTokens: resJson.usage?.completion_tokens,
          totalTokens: resJson.usage?.total_tokens,
        },
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new AIProviderTimeoutError('Mistral structured request timed out.');
      }
      if (err instanceof AIError) {
        throw err;
      }
      throw new AIError(`Mistral structured request error: ${err.message}`, 'NETWORK_ERROR', true);
    }
  }

  async generateMultimodal<T>(
    _prompt: string,
    _mediaBase64: string,
    _mimeType: string,
    _schemaDescription?: string,
    _options?: ProviderOptions
  ): Promise<ProviderStructuredResult<T>> {
    throw new AIInvalidRequestError(
      'Mistral provider does not support multimodal vision/PDF processing. Use Banku (Gemini).'
    );
  }
}
