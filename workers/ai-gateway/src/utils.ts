// src/utils.ts — Helpers: CORS, error responses, data URL parsing, Gemini part normalization

import type { AIGatewayError, AIGatewayResponse } from './types';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-email-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function corsResponse(body: string | object, status: number = 200): Response {
  const responseBody = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(responseBody, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function errorResponse(error: string, code: string | undefined, status: number, latencyMs: number): Response {
  const body: AIGatewayError = {
    success: false,
    error,
    code,
    metrics: { latencyMs },
  };
  return corsResponse(body, status);
}

export function handleOptions(): Response {
  return new Response('ok', { headers: corsHeaders });
}

export function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  if (!dataUrl || !dataUrl.includes(',')) {
    return null;
  }
  const [header, data] = dataUrl.split(',', 2);
  const match = header.match(/^data:([^;]+)(?:;base64)?/i);
  if (!match || !match[1]) {
    return null;
  }
  return { mimeType: match[1], data: data.replace(/\s/g, '') };
}

export function normalizeGeminiParts(rawParts: any[], fallbackMimeType?: string): any[] {
  return rawParts.map((part: any) => {
    if (!part || typeof part !== 'object') return part;

    const inline = part.inlineData || part.inline_data;
    if (inline && typeof inline.data === 'string') {
      let data = inline.data;
      let mime = inline.mimeType || inline.mime_type || fallbackMimeType || 'application/pdf';

      // If inline_data.data or inlineData.data contains a comma (,), strip everything before and including the comma
      if (data.includes(',')) {
        const prefix = data.split(',')[0];
        const match = prefix.match(/^data:([^;]+)/i);
        if (match && match[1] && (!inline.mimeType && !inline.mime_type)) {
          mime = match[1];
        }
        data = data.split(',')[1];
      }

      // Strip whitespace (\s) from the data string
      data = data.replace(/\s/g, '');

      const { inline_data, ...rest } = part;
      return {
        ...rest,
        inlineData: {
          mimeType: mime,
          data,
        },
      };
    }

    return part;
  });
}

export function extractMediaFromRequest(body: any): { mediaBase64: string | undefined; mimeType: string | undefined; isMultimodal: boolean } {
  let mediaBase64 = body.mediaBase64;
  let mimeType = body.mimeType;

  // Auto-detect mimeType from data URL if present
  if (mediaBase64 && typeof mediaBase64 === 'string' && mediaBase64.includes(',')) {
    const parsed = parseDataUrl(mediaBase64);
    if (parsed && !mimeType) {
      mimeType = parsed.mimeType;
      mediaBase64 = parsed.data;
    }
  }

  const isMultimodal = Boolean(mediaBase64 && mimeType);
  return { mediaBase64, mimeType, isMultimodal };
}

export function buildGeminiParts(
  body: any,
  isMultimodal: boolean,
  mimeType: string | undefined,
  mediaBase64: string | undefined,
  schemaDescription: string,
  prompt: string
): any[] {
  const rawParts: any[] = [];

  // Use parts from body if provided
  if (body.parts && Array.isArray(body.parts)) {
    rawParts.push(...body.parts);
  } else if (body.contents?.[0]?.parts && Array.isArray(body.contents[0].parts)) {
    rawParts.push(...body.contents[0].parts);
  } else {
    // Build from media + prompt
    if (isMultimodal) {
      let data = mediaBase64 || '';
      if (typeof data === 'string' && data.includes(',')) {
        data = data.split(',')[1];
      }
      if (typeof data === 'string') {
        data = data.replace(/\s/g, '');
      }

      rawParts.push({
        inlineData: {
          mimeType: mimeType,
          data,
        },
      });
    }
    rawParts.push({ text: schemaDescription ? `${prompt}\n\nSchema: ${schemaDescription}` : prompt });
  }

  return rawParts;
}

export function cleanJsonResponse(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function isRetryableError(errorMessage: string): boolean {
  const nonRetryablePatterns = [
    '401',
    '403',
    'API_KEY',
    'INVALID_ARGUMENT',
    'API key not valid',
    'permission denied',
    'unauthorized',
  ];
  return !nonRetryablePatterns.some(pattern => errorMessage.includes(pattern));
}

export function getRetryableStatus(errorMessage: string): number {
  if (errorMessage.includes('429') || errorMessage.includes('503') || errorMessage.includes('502') || errorMessage.includes('504')) {
    return 429; // Rate limited or service unavailable
  }
  return 500;
}