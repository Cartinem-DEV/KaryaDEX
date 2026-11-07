/**
 * BunkMatKar — Google Gemini Provider Adapter (Phase 12)
 *
 * Implements Gemini 3.8 Flash (Primary) and Gemini 3.7 Flash (Fallback).
 * Compliant with modern Gemini API specifications (thinking level, structured JSON, multimodal inlineData).
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

export class GeminiProvider implements AIProvider {
  readonly id: AIProviderId = 'gemini';
  readonly supportedCapabilities: readonly AICapability[] = ['text', 'structured', 'vision', 'pdf', 'multimodal'];
  readonly supportsVision = true;
  readonly supportsPDF = true;

  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private resolveApiKey(options?: ProviderOptions): string {
    const key = options?.apiKeyOverride || this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new AIProviderAuthError('Gemini API key is not configured.');
    }
    return key;
  }

  private handleApiError(status: number, message: string): never {
    if (status === 429) {
      throw new AIProviderRateLimitError(`Gemini rate limit exceeded: ${message}`);
    }
    if (status === 401 || status === 403) {
      throw new AIProviderAuthError(`Gemini authentication error: ${message}`);
    }
    if (status === 400) {
      throw new AIInvalidRequestError(`Gemini invalid request: ${message}`);
    }
    if (status === 503 || status === 504 || status === 500) {
      throw new AIError(`Gemini server error (${status}): ${message}`, 'PROVIDER_UNAVAILABLE', true);
    }
    throw new AIError(`Gemini error (${status}): ${message}`, 'GEMINI_ERROR', false);
  }

  async generateText(
    prompt: string,
    options?: ProviderOptions
  ): Promise<ProviderTextResult> {
    const model = options?.modelId || AI_MODELS.banku_primary.modelId;
    const apiKey = this.resolveApiKey(options);
    const startTime = Date.now();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body: Record<string, any> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    };

    if (options?.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    // Modern Gemini 3.8 thinking configuration
    if (model.includes('3.8') && options?.thinkingLevel) {
      body.generationConfig.thinkingConfig = {
        thinkingLevel: options.thinkingLevel,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs ?? 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response.status, errorText);
      }

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const promptTokens = json.usageMetadata?.promptTokenCount;
      const completionTokens = json.usageMetadata?.candidatesTokenCount;

      return {
        text,
        model,
        metrics: {
          promptTokens,
          completionTokens,
          totalTokens: (promptTokens || 0) + (completionTokens || 0),
          latencyMs: Date.now() - startTime,
        },
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new AIProviderTimeoutError('Gemini request timed out.');
      }
      if (err instanceof AIError) throw err;
      throw new AIError(`Gemini request failed: ${err.message}`, 'NETWORK_ERROR', true);
    }
  }

  async generateStructured<T>(
    prompt: string,
    schemaDescription: string,
    options?: ProviderOptions
  ): Promise<ProviderStructuredResult<T>> {
    const structuredPrompt = `${prompt}\n\nIMPORTANT: Output MUST be valid JSON adhering strictly to this schema: ${schemaDescription}`;

    const result = await this.generateText(structuredPrompt, {
      ...options,
      modelId: options?.modelId || AI_MODELS.banku_primary.modelId,
    });

    try {
      const cleaned = result.text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned) as T;
      return {
        data: parsed,
        rawText: result.text,
        model: result.model,
        metrics: result.metrics,
      };
    } catch (e: any) {
      throw new AIInvalidRequestError(`Failed to parse structured JSON from Gemini response: ${e.message}`);
    }
  }

  async generateMultimodal<T>(
    prompt: string,
    mediaBase64: string,
    mimeType: string,
    schemaDescription?: string,
    options?: ProviderOptions
  ): Promise<ProviderStructuredResult<T>> {
    const model = options?.modelId || AI_MODELS.banku_primary.modelId;
    const apiKey = this.resolveApiKey(options);
    const startTime = Date.now();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Defensively sanitize mediaBase64: strip any data URL prefix and whitespace
    let cleanMediaBase64 = mediaBase64;
    let cleanMimeType = mimeType;
    if (typeof cleanMediaBase64 === 'string') {
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

    // Build inlineData parts for all attachments
    const contentParts: any[] = [];

    if (options?.mediaParts && options.mediaParts.length > 0) {
      for (const part of options.mediaParts) {
        let rawData = part.base64 || part.base64Data || '';
        let partMime = part.mimeType || 'application/pdf';
        if (typeof rawData === 'string') {
          if (rawData.includes(',')) {
            const split = rawData.split(',');
            const match = split[0].match(/^data:([^;]+)/i);
            if (match && match[1] && !partMime) {
              partMime = match[1];
            }
            rawData = split[1];
          }
          rawData = rawData.replace(/\s/g, '');
        }
        if (rawData) {
          contentParts.push({
            inlineData: {
              mimeType: partMime,
              data: rawData,
            },
          });
        }
      }
    } else if (cleanMediaBase64) {
      contentParts.push({
        inlineData: {
          mimeType: cleanMimeType,
          data: cleanMediaBase64,
        },
      });
    }

    const fullPrompt = schemaDescription
      ? `${prompt}\n\nIMPORTANT: Output MUST be valid JSON adhering to: ${schemaDescription}`
      : prompt;

    contentParts.push({ text: fullPrompt });

    const body: Record<string, any> = {
      contents: [
        {
          role: 'user',
          parts: contentParts,
        },
      ],
      generationConfig: {
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens ?? 4096,
        responseMimeType: 'application/json',
      },
    };

    if (options?.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs ?? 45000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response.status, errorText);
      }

      const json = await response.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const promptTokens = json.usageMetadata?.promptTokenCount;
      const completionTokens = json.usageMetadata?.candidatesTokenCount;

      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned) as T;

      return {
        data: parsed,
        rawText,
        model,
        metrics: {
          promptTokens,
          completionTokens,
          totalTokens: (promptTokens || 0) + (completionTokens || 0),
          latencyMs: Date.now() - startTime,
        },
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new AIProviderTimeoutError('Gemini multimodal processing timed out.');
      }
      if (err instanceof AIError) throw err;
      throw new AIError(`Gemini multimodal processing failed: ${err.message}`, 'NETWORK_ERROR', true);
    }
  }
}
