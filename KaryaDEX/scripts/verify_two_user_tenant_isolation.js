// Comprehensive Real Two-User Tenant Isolation Verification
// Tests Supabase RLS and Edge Function Gateway Cross-Tenant Boundary
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const userAEmail = process.env.TEST_USER_A_EMAIL;
const userAPassword = process.env.TEST_USER_A_PASSWORD;
const userBEmail = process.env.TEST_USER_B_EMAIL;
const userBPassword = process.env.TEST_USER_B_PASSWORD;

async function runTenantIsolationSuite() {
  if (!supabaseUrl || !supabaseAnonKey || !userAEmail || !userAPassword || !userBEmail || !userBPassword) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or TEST_USER_{A,B}_{EMAIL,PASSWORD} env vars.');
  }
  console.log('=== REAL TWO-USER TENANT ISOLATION SUITE ===\n');

  // Client A
  const clientA = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const authA = await clientA.auth.signInWithPassword({
    email: userAEmail,
    password: userAPassword,
  });
  if (authA.error) throw new Error(`User A login failed: ${authA.error.message}`);
  const userA = authA.data.user;
  const tokenA = authA.data.session.access_token;
  console.log(`[AUTH] User A Authenticated: ${userA.id}`);

  // Client B
  const clientB = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const authB = await clientB.auth.signInWithPassword({
    email: userBEmail,
    password: userBPassword,
  });
  if (authB.error) throw new Error(`User B login failed: ${authB.error.message}`);
  const userB = authB.data.user;
  const tokenB = authB.data.session.access_token;
  console.log(`[AUTH] User B Authenticated: ${userB.id}\n`);

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(name, condition, detail = '') {
    totalChecks++;
    if (condition) {
      console.log(`  ✅ PASS: ${name} ${detail}`);
      passedChecks++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${detail}`);
    }
  }

  // 1. Database RLS Isolation: Tasks
  console.log('--- 1. Testing Database RLS Isolation on Tasks ---');
  const taskIdB = `task_b_${Date.now()}`;
  const taskBTitle = `Secret Task of User B (${Date.now()})`;
  const insertTaskB = await clientB.from('tasks').insert({
    id: taskIdB,
    user_id: userB.id,
    title: taskBTitle,
    priority: 'high',
    category: 'assignment',
    status: 'pending',
    is_completed: false,
    estimated_minutes: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select();
  assert('User B creates private task', !insertTaskB.error, insertTaskB.error?.message || '');

  // User A reads all tasks
  const tasksReadByA = await clientA.from('tasks').select('*');
  const userBTaskVisibleToA = tasksReadByA.data?.some(t => t.user_id === userB.id || t.title === taskBTitle);
  assert('User A cannot see User B task via broad SELECT', !userBTaskVisibleToA, `Found: ${userBTaskVisibleToA}`);

  // User A attempts targeted SELECT of User B's tasks
  const targetedTasksByA = await clientA.from('tasks').select('*').eq('user_id', userB.id);
  assert('User A targeted SELECT on User B user_id returns 0 rows', targetedTasksByA.data?.length === 0, `Count: ${targetedTasksByA.data?.length}`);

  // User A attempts to delete User B's task
  const maliciousDelete = await clientA.from('tasks').delete().eq('id', taskIdB).select();
  assert('User A cannot delete User B task', (maliciousDelete.data?.length || 0) === 0);

  // 2. Database RLS Isolation: Notes
  console.log('\n--- 2. Testing Database RLS Isolation on Notes ---');
  const noteIdB = `note_b_${Date.now()}`;
  const noteBTitle = `User B Private Academic Notes (${Date.now()})`;
  const insertNoteB = await clientB.from('notes').insert({
    id: noteIdB,
    user_id: userB.id,
    subject_id: 'sub_test_b',
    title: noteBTitle,
    content: 'Sensitive exam solutions and private study guide',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select();
  assert('User B creates private note', !insertNoteB.error, insertNoteB.error?.message || '');

  const notesReadByA = await clientA.from('notes').select('*');
  const userBNoteVisibleToA = notesReadByA.data?.some(n => n.user_id === userB.id || n.title === noteBTitle);
  assert('User A broad SELECT cannot read User B note', !userBNoteVisibleToA);

  const targetedNoteByA = await clientA.from('notes').select('*').eq('user_id', userB.id);
  assert('User A targeted SELECT on User B notes returns 0 rows', targetedNoteByA.data?.length === 0);

  // 3. Database RLS Isolation: Attendance Records
  console.log('\n--- 3. Testing Database RLS Isolation on Attendance Records ---');
  const targetedAttendanceByA = await clientA.from('attendance_records').select('*').eq('user_id', userB.id);
  assert('User A targeted SELECT on User B attendance returns 0 rows', targetedAttendanceByA.data?.length === 0);

  // 4. Edge Function AI Gateway Tenant Isolation
  console.log('\n--- 4. Testing Edge Function AI Gateway Tenant Isolation ---');

  // Test 4a: User A normal request (identity matched)
  const gatewayReqA = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      request: { userId: userA.id, persona: 'shanky', feature: 'chat' },
      prompt: 'User A prompt',
    }),
  });
  // Status should be 500 (missing API key) or 200 (if key present), NEVER 403
  assert('User A legitimate gateway invocation passes tenant check', gatewayReqA.status !== 403, `Status: ${gatewayReqA.status}`);

  // Test 4b: Malicious parameter tampering - User A token with User B userId in payload
  const spoofReqB = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      request: { userId: userB.id, persona: 'shanky', feature: 'chat' },
      prompt: 'Give me User B notes and schedule',
    }),
  });
  const spoofBodyB = await spoofReqB.json();
  assert('User A spoofing User B userId rejected with HTTP 403', spoofReqB.status === 403, `Status: ${spoofReqB.status}`);
  assert('Gateway cross-tenant error message returned', spoofBodyB.error?.includes('Cross-tenant execution is strictly prohibited'), spoofBodyB.error || '');

  // Test 4c: Malicious parameter tampering - User B token with User A userId in payload
  const spoofReqA = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`,
    },
    body: JSON.stringify({
      request: { userId: userA.id, persona: 'banku', feature: 'chat' },
      prompt: 'Give me User A academic records',
    }),
  });
  const spoofBodyA = await spoofReqA.json();
  assert('User B spoofing User A userId rejected with HTTP 403', spoofReqA.status === 403, `Status: ${spoofReqA.status}`);
  assert('Gateway cross-tenant error message returned for reverse spoof', spoofBodyA.error?.includes('Cross-tenant execution is strictly prohibited'), spoofBodyA.error || '');

  // Clean up test records
  console.log('\n--- Cleanup ---');
  await clientB.from('tasks').delete().eq('id', taskIdB);
  await clientB.from('notes').delete().eq('id', noteIdB);
  console.log('Test records cleaned up.');

  console.log(`\n==============================================`);
  console.log(`TOTAL ISOLATION CHECKS: ${totalChecks}`);
  console.log(`PASSED: ${passedChecks}/${totalChecks}`);
  console.log(`TENANT ISOLATION STATUS: ${passedChecks === totalChecks ? 'VERIFIED SECURE' : 'FAILED'}`);
  console.log(`==============================================\n`);
}

runTenantIsolationSuite().catch(console.error);
