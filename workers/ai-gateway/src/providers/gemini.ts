// src/providers/gemini.ts — Gemini provider with 3.8 Flash primary → 3.7 Flash fallback

import type { Env } from '../types';
import { normalizeGeminiParts, buildGeminiParts, cleanJsonResponse, isRetryableError, getRetryableStatus, extractMediaFromRequest } from '../utils';

export interface GeminiResponse {
  success: true;
  data: any;
  rawText: string;
  model: string;
  fallbackUsed: boolean;
  metrics: {
    latencyMs: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface GeminiError {
  success: false;
  error: string;
  code?: string;
  metrics: {
    latencyMs: number;
  };
}

export type GeminiResult = GeminiResponse | GeminiError;

const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.7-flash';

async function callGeminiApi(
  apiKey: string,
  model: string,
  parts: any[],
  startTime: number
): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (response.ok) {
    return await response.json();
  }

  const errText = await response.text();
  throw new Error(`Gemini status ${response.status}: ${errText}`);
}

export async function callGemini(
  env: Env,
  body: any,
  prompt: string,
  schemaDescription: string,
  startTime: number
): Promise<GeminiResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'Server configuration error: Gemini API key missing.',
      metrics: { latencyMs: Date.now() - startTime },
    };
  }

  const { mediaBase64, mimeType, isMultimodal } = extractMediaFromRequest(body);
  const rawParts = buildGeminiParts(body, isMultimodal, mimeType, mediaBase64, schemaDescription, prompt);
  const normalizedParts = normalizeGeminiParts(rawParts, mimeType);

  let modelId = PRIMARY_MODEL;
  let fallbackUsed = false;
  let primaryError: string | null = null;

  try {
    const resultJson = await callGeminiApi(apiKey, modelId, normalizedParts, startTime);
    const rawText = resultJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = cleanJsonResponse(rawText);
    const parsedData = JSON.parse(cleaned);

    return {
      success: true,
      data: parsedData,
      rawText,
      model: modelId,
      fallbackUsed: false,
      metrics: {
        latencyMs: Date.now() - startTime,
        promptTokens: resultJson.usageMetadata?.promptTokenCount,
        completionTokens: resultJson.usageMetadata?.candidatesTokenCount,
      },
    };
  } catch (err: any) {
    const errMsg: string = err?.message || String(err);
    primaryError = errMsg;
    console.error(`Gemini primary (${PRIMARY_MODEL}) failed:`, errMsg);

    // If primaryOnly requested, don't fallback
    if (body.request?.primaryOnly) {
      return {
        success: false,
        error: `Primary model (${PRIMARY_MODEL}) failed: ${errMsg}`,
        metrics: { latencyMs: Date.now() - startTime },
      };
    }

    // Check if primary error is non-retryable
    if (!isRetryableError(errMsg)) {
      return {
        success: false,
        error: `Primary model (${PRIMARY_MODEL}) non-retryable error: ${errMsg}`,
        metrics: { latencyMs: Date.now() - startTime },
      };
    }

    // Retryable fallback to Gemini 3.7 Flash
    fallbackUsed = true;
    modelId = FALLBACK_MODEL;

    // Brief backoff for transient errors
    if (errMsg.includes('503') || errMsg.includes('429')) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    try {
      const resultJson = await callGeminiApi(apiKey, modelId, normalizedParts, startTime);
      const rawText = resultJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = cleanJsonResponse(rawText);
      const parsedData = JSON.parse(cleaned);

      return {
        success: true,
        data: parsedData,
        rawText,
        model: modelId,
        fallbackUsed,
        metrics: {
          latencyMs: Date.now() - startTime,
          promptTokens: resultJson.usageMetadata?.promptTokenCount,
          completionTokens: resultJson.usageMetadata?.candidatesTokenCount,
        },
      };
    } catch (fallbackErr: any) {
      const fallbackError = fallbackErr?.message || String(fallbackErr);
      return {
        success: false,
        error: `Primary model (${PRIMARY_MODEL}) failed: [${primaryError}]. Fallback (${FALLBACK_MODEL}) failed: [${fallbackError}]`,
        metrics: { latencyMs: Date.now() - startTime },
      };
    }
  }
}