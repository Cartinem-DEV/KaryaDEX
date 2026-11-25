// supabase/functions/ai-gateway/index.ts
/**
 * KaryaDEX — Secure AI Gateway Edge Function (Phase 12 Production)
 *
 * Runs exclusively in Supabase Edge Runtime.
 * Enforces JWT authentication, user tenant boundary, rate limiting,
 * and routes to Google Gemini (3.8 Flash / 3.7 Flash) and Mistral (ministral-8b-2512)
 * using server-side secrets only. Model keys are NEVER sent to the client.
 */

// Ambient Deno and module declarations for Supabase Edge Runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
    set?(key: string, value: string): void;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// @ts-ignore: Deno ESM import resolved at runtime by Supabase Edge Runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';
    const mistralApiKey = Deno.env.get('MISTRAL_API_KEY') || '';

    // 1. Verify User Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse & Validate Payload
    const body = await req.json();
    const { request, prompt, schemaDescription, mediaBase64, mimeType, contents, parts: bodyParts } = body;

    if (!request || !prompt) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload: missing request or prompt.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tenant boundary check: user can only execute requests for their own authenticated ID
    if (request.userId && request.userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Cross-tenant execution is strictly prohibited.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2b. Server-Side Daily AI Quota Check (Rate-limit abuse control)
    const today = new Date().toISOString().split('T')[0];
    const MAX_DAILY_REQUESTS = 50;

    const { data: usageRow } = await supabase
      .from('ai_usage_counters')
      .select('request_count, token_count')
      .eq('user_id', user.id)
      .eq('usage_date', today)
      .maybeSingle();

    const currentCount = usageRow?.request_count || 0;
    if (currentCount >= MAX_DAILY_REQUESTS) {
      return new Response(
        JSON.stringify({
          error: `Daily AI quota of ${MAX_DAILY_REQUESTS} requests reached for today. Resets tomorrow.`,
          code: 'QUOTA_EXCEEDED',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recordServerUsage = async (tokens = 0) => {
      try {
        await supabase.from('ai_usage_counters').upsert({
          user_id: user.id,
          usage_date: today,
          request_count: currentCount + 1,
          token_count: (usageRow?.token_count || 0) + tokens,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,usage_date' });
      } catch (err) {
        console.error('Failed to update server usage counter:', err);
      }
    };

    let initialMimeType = mimeType;
    let initialMediaBase64 = mediaBase64;
    if (typeof initialMediaBase64 === 'string' && initialMediaBase64.includes(',')) {
      const match = initialMediaBase64.split(',')[0].match(/^data:([^;]+)/i);
      if (match && match[1] && !initialMimeType) {
        initialMimeType = match[1];
      }
    }

    const isMultimodal = Boolean(initialMediaBase64 && (initialMimeType || mimeType));
    const persona = isMultimodal || request.persona === 'banku' ? 'banku' : 'shanky';

    // 3. Route to Provider
    if (persona === 'banku') {
      if (!geminiApiKey) {
        return new Response(
          JSON.stringify({ error: 'Server configuration error: Gemini API key missing.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Banku Primary: Gemini 3.8 Flash
      let modelId = 'gemini-3.8-flash';
      let fallbackUsed = false;

      /**
       * Normalizes Gemini parts defensively:
       * - Handles both inlineData and inline_data
       * - If inline_data.data or inlineData.data contains a comma (,), strip everything before and including the comma (data.split(',')[1])
       * - Strip whitespace (\s) from the data string
       */
      const normalizePartsForGemini = (rawParts: any[]): any[] => {
        return rawParts.map((part: any) => {
          if (!part || typeof part !== 'object') return part;

          const inline = part.inlineData || part.inline_data;
          if (inline && typeof inline.data === 'string') {
            let data = inline.data;
            let mime = inline.mimeType || inline.mime_type || initialMimeType || mimeType || 'application/pdf';

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
      };

      const callGemini = async (model: string) => {
        const rawParts: any[] = [];
        if (bodyParts && Array.isArray(bodyParts)) {
          rawParts.push(...bodyParts);
        } else if (contents?.[0]?.parts && Array.isArray(contents[0].parts)) {
          rawParts.push(...contents[0].parts);
        } else {
          if (isMultimodal) {
            let data = initialMediaBase64;
            if (typeof data === 'string' && data.includes(',')) {
              data = data.split(',')[1];
            }
            if (typeof data === 'string') {
              data = data.replace(/\s/g, '');
            }

            rawParts.push({
              inlineData: {
                mimeType: initialMimeType || mimeType,
                data,
              },
            });
          }
          rawParts.push({ text: schemaDescription ? `${prompt}\n\nSchema: ${schemaDescription}` : prompt });
        }

        const normalizedParts = normalizePartsForGemini(rawParts);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiApiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: normalizedParts }],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        });

        if (geminiRes.ok) {
          return await geminiRes.json();
        }

        const errText = await geminiRes.text();
        throw new Error(`Gemini status ${geminiRes.status}: ${errText}`);
      };

      let resultJson: any;
      let primaryError: string | null = null;
      try {
        resultJson = await callGemini(modelId);
      } catch (err: any) {
        primaryError = err?.message || String(err);
        console.error(`Gemini primary (${modelId}) failed:`, primaryError);

        // If primaryOnly requested by test harness, do not mask with fallback
        if (request.primaryOnly) {
          throw new Error(`Primary model (${modelId}) failed: ${primaryError}`);
        }

        // Check if primary error is non-retryable (permanent auth/config/bad request)
        const isNonRetryable = primaryError.includes('401') ||
          primaryError.includes('403') ||
          primaryError.includes('API_KEY') ||
          primaryError.includes('INVALID_ARGUMENT') ||
          primaryError.includes('API key not valid');

        if (isNonRetryable) {
          throw new Error(`Primary model (${modelId}) non-retryable error: ${primaryError}`);
        }

        // Retryable fallback to Gemini 3.7 Flash (e.g. 429, 500, 502, 503, 504)
        fallbackUsed = true;
        modelId = 'gemini-3.7-flash';

        // Brief backoff if transient cluster capacity spike
        if (primaryError.includes('503') || primaryError.includes('429')) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        try {
          resultJson = await callGemini(modelId);
        } catch (fallbackErr: any) {
          throw new Error(`Primary model (gemini-3.8-flash) failed: [${primaryError}]. Fallback (${modelId}) failed: [${fallbackErr?.message || fallbackErr}]`);
        }
      }

      const rawText = resultJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsedData = JSON.parse(cleaned);

      await recordServerUsage(resultJson.usageMetadata?.totalTokenCount || 0);

      return new Response(
        JSON.stringify({
          success: true,
          persona: 'banku',
          provider: 'gemini',
          model: modelId,
          fallbackUsed,
          data: parsedData,
          rawText,
          metrics: {
            latencyMs: Date.now() - startTime,
            promptTokens: resultJson.usageMetadata?.promptTokenCount,
            completionTokens: resultJson.usageMetadata?.candidatesTokenCount,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Shanky: Mistral Ministral 3 8B (ministral-8b-2512)
      // Independent quota pool from Google.
      if (!mistralApiKey) {
        return new Response(
          JSON.stringify({ error: 'Server configuration error: Mistral API key missing.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const modelId = 'ministral-8b-2512';
      const messages = [
        {
          role: 'system',
          content: schemaDescription
            ? `You are Shanky, college AI assistant. Respond strictly in valid JSON matching:\n${schemaDescription}`
            : 'You are Shanky, college AI assistant.',
        },
        { role: 'user', content: prompt },
      ];

      const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mistralApiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature: 0.3,
          max_tokens: 2048,
          response_format: { type: 'json_object' },
        }),
      });

      if (!mistralRes.ok) {
        const errText = await mistralRes.text();
        const status = mistralRes.status;
        if (status === 429) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Shanky is temporarily rate-limited. Please try again shortly.',
              metrics: { latencyMs: Date.now() - startTime },
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: `Shanky temporarily unavailable (${status}).`,
            metrics: { latencyMs: Date.now() - startTime },
          }),
          { status: status >= 500 ? 503 : status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const mistralData = await mistralRes.json();
      const rawText = mistralData.choices?.[0]?.message?.content || '';
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsedData = JSON.parse(cleaned);

      await recordServerUsage(mistralData.usage?.total_tokens || 0);

      return new Response(
        JSON.stringify({
          success: true,
          persona: 'shanky',
          provider: 'mistral',
          model: modelId,
          fallbackUsed: false,
          data: parsedData,
          rawText,
          metrics: {
            latencyMs: Date.now() - startTime,
            promptTokens: mistralData.usage?.prompt_tokens,
            completionTokens: mistralData.usage?.completion_tokens,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Internal server error in AI gateway',
        metrics: { latencyMs: Date.now() - startTime },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
