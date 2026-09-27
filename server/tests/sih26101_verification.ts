import { z } from 'zod';

const BASE = 'http://localhost:4000/api';

let passed = 0;
let failed = 0;
const logs: string[] = [];

function assert(desc: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    logs.push(`  [PASS] ${desc}${detail ? ` -> ${detail}` : ''}`);
  } else {
    failed++;
    logs.push(`  [FAIL] ${desc}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function call(path: string, opts: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = { ...(opts.headers as any) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body && typeof opts.body === 'string') headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function login(email: string) {
  const res = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'demo1234' }),
  });
  if (res.status !== 200) throw new Error(`Login failed for ${email}`);
  return res.json.token as string;
}

async function run() {
  console.log('==================================================');
  console.log('STATINTEL — SIH26101 COMPREHENSIVE ROLE & FEATURE VERIFICATION');
  console.log('==================================================\n');

  // 1. Authenticate the 3 canonical roles
  const learnerToken = await login('vinaykumarbade2007@gmail.com');
  const trainerToken = await login('rajesh@nssta.gov.in');
  const adminToken = await login('admin@mospi.gov.in');
  const deptAdminToken = await login('dept@ap.gov.in');
  const auditorToken = await login('auditor@cag.gov.in');

  assert('Learner account authenticated', !!learnerToken);
  assert('Trainer account authenticated', !!trainerToken);
  assert('Administrator (HQ) authenticated', !!adminToken);
  assert('Administrator (Department) authenticated', !!deptAdminToken);
  assert('Administrator (Audit) authenticated', !!auditorToken);

  // 2. Profile and Identity for Learner
  const learnerMe = await call('/auth/me', { token: learnerToken });
  assert('Learner profile accessible', learnerMe.status === 200);
  assert('Learner name is Vinay Kumar Bade', learnerMe.json?.nameEn === 'Vinay Kumar Bade');

  // 3. Strict 3-Role RBAC Enforcement
  // Route: /api/trainer/overview
  const trTrainer = await call('/trainer/overview', { token: trainerToken });
  assert('Trainer can access /trainer/overview', trTrainer.status === 200, `Docs: ${trTrainer.json?.documentsCount}`);

  const trAdmin = await call('/trainer/overview', { token: adminToken });
  assert('Administrator can access /trainer/overview', trAdmin.status === 200);

  const trLearner = await call('/trainer/overview', { token: learnerToken });
  assert('Learner is blocked from /trainer/overview (403)', trLearner.status === 403, trLearner.json?.detail);

  // Route: /api/admin/capacity-building
  const capAdmin = await call('/admin/capacity-building', { token: adminToken });
  assert('Administrator can access /admin/capacity-building', capAdmin.status === 200, `Officials: ${capAdmin.json?.totalOfficials}`);

  const capTrainer = await call('/admin/capacity-building', { token: trainerToken });
  assert('Trainer is blocked from /admin/capacity-building (403)', capTrainer.status === 403, capTrainer.json?.detail);

  const capLearner = await call('/admin/capacity-building', { token: learnerToken });
  assert('Learner is blocked from /admin/capacity-building (403)', capLearner.status === 403, capLearner.json?.detail);

  // Route: /api/admin/workforce
  const wfAdmin = await call('/admin/workforce', { token: adminToken });
  assert('Administrator can access /admin/workforce', wfAdmin.status === 200, `Coverage rows: ${wfAdmin.json?.coverage?.length}`);

  const wfTrainer = await call('/admin/workforce', { token: trainerToken });
  assert('Trainer is blocked from /admin/workforce (403)', wfTrainer.status === 403, wfTrainer.json?.detail);

  const wfLearner = await call('/admin/workforce', { token: learnerToken });
  assert('Learner is blocked from /admin/workforce (403)', wfLearner.status === 403, wfLearner.json?.detail);

  // Route: /api/audit
  const auditAdmin = await call('/audit', { token: adminToken });
  assert('Administrator can access /audit', auditAdmin.status === 200, `Audit events: ${auditAdmin.json?.length}`);

  const auditDeptAdmin = await call('/audit', { token: deptAdminToken });
  assert('Department Administrator can access /audit', auditDeptAdmin.status === 200);

  const auditAuditor = await call('/audit', { token: auditorToken });
  assert('Auditor Administrator can access /audit', auditAuditor.status === 200);

  const auditTrainer = await call('/audit', { token: trainerToken });
  assert('Trainer is blocked from /audit (403)', auditTrainer.status === 403, auditTrainer.json?.detail);

  const auditLearner = await call('/audit', { token: learnerToken });
  assert('Learner is blocked from /audit (403)', auditLearner.status === 403, auditLearner.json?.detail);

  // Route: Learner-only endpoints
  const chatLearner = await call('/learner/chat', {
    method: 'POST',
    token: learnerToken,
    body: JSON.stringify({ message: 'Explain mean vs median', simulateFallback: true }),
  });
  assert('Learner can access /learner/chat (with deterministic fallback)', chatLearner.status === 200 && chatLearner.json?.source === 'local');

  const chatTrainer = await call('/learner/chat', {
    method: 'POST',
    token: trainerToken,
    body: JSON.stringify({ message: 'Hello' }),
  });
  assert('Trainer is blocked from /learner/chat (403)', chatTrainer.status === 403, chatTrainer.json?.detail);

  const chatAdmin = await call('/learner/chat', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({ message: 'Hello' }),
  });
  assert('Administrator is blocked from /learner/chat (403)', chatAdmin.status === 403, chatAdmin.json?.detail);

  // 4. Fallback Robustness Checks
  const labFallback = await call('/learner/lab/explain', {
    method: 'POST',
    token: learnerToken,
    body: JSON.stringify({ labId: 'mean-median-mode', simulateFallback: true }),
  });
  assert('Virtual Lab explanation works with fallback', labFallback.status === 200 && labFallback.json?.source === 'fallback');

  const recFallback = await call('/learner/recommendations?simulate=true', { token: learnerToken });
  assert('Recommendations work with deterministic fallback', recFallback.status === 200 && recFallback.json?.source === 'fallback');

  const capFallback = await call('/admin/capacity-building?simulate=true', { token: adminToken });
  assert('Admin Capacity Building works with deterministic fallback', capFallback.status === 200 && capFallback.json?.aiExecution?.fallbackUsed);

  // 5. OIDC / SSO status
  const ssoStatus = await call('/auth/sso/status');
  assert('OIDC SSO status endpoint active', ssoStatus.status === 200 && ssoStatus.json?.guidance?.standard?.includes('OpenID Connect'));

  // 6. Translation status
  const transStatus = await call('/translation/status');
  assert('Multilingual architecture status active', transStatus.status === 200 && transStatus.json?.supportedLanguages?.length === 3);

  // Print Summary
  console.log(logs.join('\n'));
  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error('Fatal error during verification:', e);
  process.exit(1);
});
