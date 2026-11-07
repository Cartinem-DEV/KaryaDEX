// src/providers/mistral.ts — Mistral provider (ministral-8b-2512)

import type { Env } from '../types';

export interface MistralResponse {
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

export interface MistralError {
  success: false;
  error: string;
  metrics: {
    latencyMs: number;
  };
}

export type MistralResult = MistralResponse | MistralError;

const MODEL = 'ministral-8b-2512';

export async function callMistral(
  env: Env,
  prompt: string,
  schemaDescription: string,
  startTime: number
): Promise<MistralResult> {
  const apiKey = env.MISTRAL_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'Server configuration error: Mistral API key missing.',
      metrics: { latencyMs: Date.now() - startTime },
    };
  }

  const messages = [
    {
      role: 'system',
      content: schemaDescription
        ? `You are Shanky, college AI assistant. Respond strictly in valid JSON matching:\n${schemaDescription}`
        : 'You are Shanky, college AI assistant.',
    },
    { role: 'user', content: prompt },
  ];

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const status = response.status;
    if (status === 429) {
      return {
        success: false,
        error: 'Shanky is temporarily rate-limited. Please try again shortly.',
        metrics: { latencyMs: Date.now() - startTime },
      };
    }
    return {
      success: false,
      error: `Shanky temporarily unavailable (${status}).`,
      metrics: { latencyMs: Date.now() - startTime },
    };
  }

  const mistralData: any = await response.json();
  const rawText = mistralData.choices?.[0]?.message?.content || '';
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const parsedData = JSON.parse(cleaned);

  return {
    success: true,
    data: parsedData,
    rawText,
    model: MODEL,
    fallbackUsed: false,
    metrics: {
      latencyMs: Date.now() - startTime,
      promptTokens: mistralData.usage?.prompt_tokens,
      completionTokens: mistralData.usage?.completion_tokens,
    },
  };
}