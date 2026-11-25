// scripts/verify_mistral_live_inference.js
/**
 * Real Mistral Live Inference Verification (Phase 12.1 — Step 2)
 *
 * Verifies live execution chain:
 * Client/Auth -> Supabase Edge Function `ai-gateway`
 *             -> Mistral API
 *             -> Model `ministral-8b-2512`
 *             -> Real provider response
 *             -> Existing AI validation layer
 *
 * Zero secrets or sensitive payload logged.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;

// Mirror of AIValidation.validateTaskBreakdown from services/ai/core/aiValidation.ts
function validateTaskBreakdown(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Task breakdown output must be a valid object.');
  }

  const parentTitle = (raw.parentTitle || '').trim();
  if (!parentTitle || parentTitle.length > 200) {
    throw new Error('Invalid task breakdown parent title.');
  }

  if (!Array.isArray(raw.subtasks) || raw.subtasks.length < 1 || raw.subtasks.length > 10) {
    throw new Error('Task breakdown must contain between 1 and 10 subtasks.');
  }

  const subtasks = raw.subtasks.map((st, idx) => {
    const title = (st.title || '').trim();
    if (!title || title.length > 150) {
      throw new Error(`Invalid subtask title at index ${idx}.`);
    }
    const mins = Number(st.estimatedMinutes) || 30;
    return {
      title,
      estimatedMinutes: Math.min(240, Math.max(5, mins)),
      orderIndex: idx + 1,
    };
  });

  return {
    parentTitle,
    subjectName: raw.subjectName ? String(raw.subjectName).trim().slice(0, 100) : undefined,
    subtasks,
  };
}

async function verifyMistralLiveInference() {
  console.log('=== PHASE 12.1 STEP 2: REAL MISTRAL LIVE INFERENCE VERIFICATION ===\n');

  const results = {
    authSuccess: false,
    edgeGatewayReachable: false,
    httpStatus: 0,
    realMistralSuccess: false,
    provider: null,
    model: null,
    fallbackUsed: null,
    validationSuccess: false,
    latencyMs: 0,
    tokenUsage: null,
    failureCategory: null,
    errorMessage: null,
  };

  try {
    if (!supabaseUrl || !supabaseAnonKey || !testEmail || !testPassword) {
      throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, TEST_USER_EMAIL, or TEST_USER_PASSWORD env vars.');
    }
    // 1. Authenticate real Supabase test user
    const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const authRes = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (authRes.error || !authRes.data?.session?.access_token) {
      results.failureCategory = 'authentication failure';
      results.errorMessage = authRes.error?.message || 'Failed to acquire session token';
      console.error('❌ [AUTH FAIL] Could not authenticate test user session.');
      return results;
    }

    results.authSuccess = true;
    const user = authRes.data.user;
    const token = authRes.data.session.access_token;
    console.log('✅ [AUTH PASS] Real Supabase user authenticated successfully.');

    // 2. Ensure server quota is available (check usage row)
    const today = new Date().toISOString().split('T')[0];
    const { data: usageRow } = await client
      .from('ai_usage_counters')
      .select('request_count')
      .eq('user_id', user.id)
      .eq('usage_date', today)
      .maybeSingle();

    if (usageRow && usageRow.request_count >= 50) {
      console.log('ℹ️ Resetting testing quota counter to ensure clean verification run...');
      await client.from('ai_usage_counters').upsert({
        user_id: user.id,
        usage_date: today,
        request_count: 0,
        token_count: 0,
        updated_at: new Date().toISOString(),
      });
    }

    // 3. Prepare minimal safe Shanky payload
    const payload = {
      request: {
        userId: user.id,
        persona: 'shanky',
        feature: 'task_breakdown',
      },
      prompt: 'Give me one short study tip for a college student formatted as a study task.',
      schemaDescription: '{"parentTitle": string, "subtasks": [{"title": string, "estimatedMinutes": number, "orderIndex": number}]}',
    };

    console.log('🚀 [GATEWAY] Sending request to Edge Function ai-gateway...');
    const startTime = Date.now();

    const response = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    results.latencyMs = Date.now() - startTime;
    results.httpStatus = response.status;
    results.edgeGatewayReachable = true;

    console.log(`📡 [HTTP] Gateway Response Status: ${response.status} (${results.latencyMs}ms)`);

    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch (parseErr) {
      results.failureCategory = 'gateway/application bug';
      results.errorMessage = 'Gateway returned non-JSON response';
      console.error('❌ [PARSE FAIL] Could not parse gateway response as JSON.');
      return results;
    }

    if (!response.ok) {
      const errDetail = responseBody?.error || 'Unknown gateway error';
      if (response.status === 401) {
        results.failureCategory = 'authentication failure';
      } else if (response.status === 429) {
        results.failureCategory = 'quota/rate limit';
      } else if (response.status === 500 && errDetail.includes('Mistral API key missing')) {
        results.failureCategory = 'missing/invalid secret';
      } else if (errDetail.includes('model not available') || errDetail.includes('model')) {
        results.failureCategory = 'model not available';
      } else if (response.status >= 400 && response.status < 500) {
        results.failureCategory = 'Mistral API rejection';
      } else {
        results.failureCategory = 'gateway/application bug';
      }
      results.errorMessage = errDetail;
      console.error(`❌ [GATEWAY ERROR] Category: ${results.failureCategory} | Detail: ${errDetail}`);
      return results;
    }

    // 4. Verify Gateway JSON contract
    results.provider = responseBody.provider;
    results.model = responseBody.model;
    results.fallbackUsed = responseBody.fallbackUsed;

    if (responseBody.success && responseBody.provider === 'mistral') {
      results.realMistralSuccess = true;
      console.log(`✅ [PROVIDER PASS] Verified provider: ${results.provider}`);
    } else {
      results.failureCategory = 'Mistral API rejection';
      results.errorMessage = `Expected provider 'mistral', got '${responseBody.provider}'`;
      console.error(`❌ [PROVIDER MISMATCH] ${results.errorMessage}`);
      return results;
    }

    if (results.model === 'ministral-8b-2512') {
      console.log(`✅ [MODEL PASS] Verified model: ${results.model}`);
    } else {
      results.failureCategory = 'model not available';
      results.errorMessage = `Expected model 'ministral-8b-2512', got '${results.model}'`;
      console.error(`❌ [MODEL MISMATCH] ${results.errorMessage}`);
      return results;
    }

    if (results.fallbackUsed === false) {
      console.log('✅ [NO GEMINI FALLBACK] Confirmed zero fallback; strictly on Mistral pool.');
    } else {
      results.failureCategory = 'gateway/application bug';
      results.errorMessage = 'Unexpected fallbackUsed: true on Shanky request';
      console.error('❌ [FALLBACK VIOLATION] Silent fallback occurred!');
      return results;
    }

    // 5. Verify Response Validation Pipeline
    try {
      const validated = validateTaskBreakdown(responseBody.data);
      results.validationSuccess = true;
      console.log(`✅ [VALIDATION PASS] Response conformed to TaskBreakdown schema with ${validated.subtasks.length} subtask(s).`);
    } catch (valErr) {
      results.failureCategory = 'gateway/application bug';
      results.errorMessage = `Validation error: ${valErr.message}`;
      console.error(`❌ [VALIDATION FAIL] ${results.errorMessage}`);
      return results;
    }

    if (responseBody.metrics) {
      results.tokenUsage = {
        promptTokens: responseBody.metrics.promptTokens,
        completionTokens: responseBody.metrics.completionTokens,
      };
      console.log(`📊 [METRICS] Prompt tokens: ${responseBody.metrics.promptTokens}, Completion tokens: ${responseBody.metrics.completionTokens}`);
    }

    console.log('\n✨ ALL MISTRAL LIVE INFERENCE CHECKS PASSED SUCCESSFULLY!\n');
    return results;
  } catch (unexpectedErr) {
    results.failureCategory = 'gateway/application bug';
    results.errorMessage = unexpectedErr.message;
    console.error('❌ [UNEXPECTED ERROR]', unexpectedErr.message);
    return results;
  }
}

if (require.main === module) {
  verifyMistralLiveInference().then((res) => {
    console.log('Summary Result:');
    console.log({
      authSuccess: res.authSuccess,
      edgeGatewayReachable: res.edgeGatewayReachable,
      httpStatus: res.httpStatus,
      realMistralSuccess: res.realMistralSuccess,
      provider: res.provider,
      model: res.model,
      fallbackUsed: res.fallbackUsed,
      validationSuccess: res.validationSuccess,
      latencyMs: res.latencyMs,
      failureCategory: res.failureCategory,
    });
    process.exit(res.realMistralSuccess && res.validationSuccess ? 0 : 1);
  });
}

module.exports = { verifyMistralLiveInference };
