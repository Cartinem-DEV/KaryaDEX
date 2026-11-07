// Verification of Server-Side AI Quota Counters and Controlled Limit Rejection
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qimdcbseltdvxdzmdzwb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWRjYnNlbHRkdnhkem1kendiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExODI2OTMsImV4cCI6MjEwNjc1ODY5M30.k65MFDeF0F-0gKnphwI4-F4Sgn73I4K4OMWZN6a71ow';

async function runQuotaVerification() {
  console.log('=== REAL SERVER-SIDE AI QUOTA BEHAVIOR SUITE ===\n');

  const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const auth = await client.auth.signInWithPassword({
    email: 'student_1791451540538@gmail.com',
    password: 'Password123!Secure',
  });
  if (auth.error) throw new Error(`Auth failed: ${auth.error.message}`);
  const user = auth.data.user;
  const token = auth.data.session.access_token;
  const today = new Date().toISOString().split('T')[0];

  console.log(`[AUTH] Authenticated User: ${user.id}`);
  console.log(`[DATE] Usage Date: ${today}`);

  let passed = 0;
  let total = 0;
  function assert(name, cond, info = '') {
    total++;
    if (cond) {
      console.log(`  ✅ PASS: ${name} ${info}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${info}`);
    }
  }

  // 1. Initial State: Set counter to 0
  console.log('\n--- 1. Resetting Counter to Normal (0 requests) ---');
  const upsertNormal = await client.from('ai_usage_counters').upsert({
    user_id: user.id,
    usage_date: today,
    request_count: 0,
    token_count: 0,
    updated_at: new Date().toISOString(),
  });
  assert('Reset counter to 0 succeeded', !upsertNormal.error, upsertNormal.error?.message || '');

  // Gateway invocation below limit
  const normalRes = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      request: { userId: user.id, persona: 'shanky', feature: 'chat' },
      prompt: 'Hello under quota limit',
    }),
  });
  assert('Under quota: Request is NOT rate-limited (status != 429)', normalRes.status !== 429, `Status: ${normalRes.status}`);

  // 2. Controlled Limit Scenario: Set counter to MAX_DAILY_REQUESTS (50)
  console.log('\n--- 2. Simulating Quota Exhaustion (50 requests) ---');
  const upsertExhausted = await client.from('ai_usage_counters').upsert({
    user_id: user.id,
    usage_date: today,
    request_count: 50,
    token_count: 12500,
    updated_at: new Date().toISOString(),
  });
  assert('Set counter to 50 succeeded', !upsertExhausted.error, upsertExhausted.error?.message || '');

  // Gateway invocation AT limit
  const limitRes = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      request: { userId: user.id, persona: 'shanky', feature: 'chat' },
      prompt: 'Hello when quota exceeded',
    }),
  });
  const limitBody = await limitRes.json();
  assert('At limit: Gateway rejects with HTTP 429', limitRes.status === 429, `Status: ${limitRes.status}`);
  assert('Gateway returns code QUOTA_EXCEEDED', limitBody.code === 'QUOTA_EXCEEDED', `Code: ${limitBody.code}`);
  assert('Gateway returns descriptive message', limitBody.error?.includes('Daily AI quota of 50 requests reached'), limitBody.error || '');

  // 3. Reset Counter back to clean state
  console.log('\n--- 3. Clean Up Counter ---');
  const cleanUp = await client.from('ai_usage_counters').upsert({
    user_id: user.id,
    usage_date: today,
    request_count: 0,
    token_count: 0,
    updated_at: new Date().toISOString(),
  });
  assert('Clean up counter succeeded', !cleanUp.error);

  console.log(`\n==============================================`);
  console.log(`TOTAL SERVER QUOTA CHECKS: ${total}`);
  console.log(`PASSED: ${passed}/${total}`);
  console.log(`SERVER QUOTA STATUS: ${passed === total ? 'VERIFIED ENFORCED' : 'FAILED'}`);
  console.log(`==============================================\n`);
}

runQuotaVerification().catch(console.error);
