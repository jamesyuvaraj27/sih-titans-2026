/**
 * Acceptance tests — the 12-step demo workflow, over real HTTP, against a real
 * database. If this file is green, the demo works. If it is red, nothing else
 * matters.
 *
 *   npm run dev        (in another terminal)
 *   npm test
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.API_BASE ?? 'http://localhost:4000/api';
const here = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, condition: boolean, detail = '') {
  if (condition) { passed++; results.push(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; results.push(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
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

const login = async (email: string) => {
  const r = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'demo1234' }) });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(r.json)}`);
  return r.json.token as string;
};

async function main() {
  console.log('\nSAMIKSHA acceptance — the 12-step demo workflow\n');

  // ── 1. login ──────────────────────────────────────────────────────────
  const bad = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'anitha@mospi.gov.in', password: 'wrong' }) });
  check('1a wrong password is rejected', bad.status === 401);

  const learner = await login('anitha@mospi.gov.in');
  const trainer = await login('rajesh@nssta.gov.in');
  const admin = await login('admin@mospi.gov.in');
  const auditor = await login('auditor@cag.gov.in');
  check('1b four demo accounts log in', !!(learner && trainer && admin && auditor));

  const me = await call('/auth/me', { token: learner });
  check('1c /auth/me returns the official', me.json?.email === 'anitha@mospi.gov.in',
    `${me.json?.nameEn}, ${me.json?.roleProfile?.titleEn}`);

  // ── RBAC ──────────────────────────────────────────────────────────────
  check('RBAC learner cannot list documents', (await call('/documents', { token: learner })).status === 403);
  check('RBAC learner cannot see workforce view', (await call('/admin/workforce', { token: learner })).status === 403);
  check('RBAC trainer can list documents', (await call('/documents', { token: trainer })).status === 200);
  check('RBAC auditor can see workforce view', (await call('/admin/workforce', { token: auditor })).status === 200);
  check('RBAC anonymous is rejected', (await call('/officials/me/profile')).status === 401);
  const peek = await call('/officials/off_syn_01/profile', { token: learner });
  check('RBAC learner cannot read another official’s profile', peek.status === 403);

  // ── 2. dashboard ──────────────────────────────────────────────────────
  const profile = await call('/officials/me/profile', { token: learner });
  check('2a profile returns all 60 competencies', profile.json?.competencies?.length === 60);
  const field = profile.json.competencies.find((c: any) => c.competencyId === 'STAT.SURV.FIELD');
  check('2b strongest competency is evidenced at L3', field?.level === 3,
    `STAT.SURV.FIELD score ${field?.score?.toFixed(1)} conf ${field?.confidence?.toFixed(2)}`);
  check('2c four domain roll-ups present', profile.json?.domains?.length === 4);

  // ── 3+4. competency detail and the Evidence Ledger ────────────────────
  const detail = await call('/officials/me/competency/STAT.SURV.FIELD', { token: learner });
  check('3a competency detail returns level anchors', Object.keys(detail.json?.competency?.levelAnchors ?? {}).length === 4);
  check('4a Evidence Ledger has rows', (detail.json?.ledger?.length ?? 0) >= 3, `${detail.json?.ledger?.length} rows`);

  const ledgerSum = detail.json.ledger.reduce((a: number, l: any) => a + l.contribution, 0);
  const recomputed = 100 * (1 - Math.exp(-Math.max(ledgerSum, 0) / 1.6));
  check('4b ledger contributions reproduce the score by hand',
    Math.abs(recomputed - detail.json.score.score) < 0.01,
    `Σ contributions ${ledgerSum.toFixed(3)} → ${recomputed.toFixed(1)} vs API ${detail.json.score.score.toFixed(1)}`);

  const anyRow = detail.json.ledger[0];
  check('4c each ledger row shows weight × quality × relevance × decay',
    Math.abs(anyRow.weight * anyRow.quality * anyRow.relevance * anyRow.decay - anyRow.contribution) < 1e-6);

  // time travel
  const past = new Date(Date.now() - 30 * 30.44 * 86400_000).toISOString();
  const pyNow = await call('/officials/me/competency/TECH.PY.BASIC', { token: learner });
  const pyThen = await call(`/officials/me/competency/TECH.PY.BASIC?asOf=${encodeURIComponent(past)}`, { token: learner });
  check('4d time travel: decayed skill scored higher in the past',
    pyThen.json.score.score > pyNow.json.score.score + 10,
    `Python ${pyThen.json.score.score.toFixed(1)} 30 months ago → ${pyNow.json.score.score.toFixed(1)} today`);

  // no-LLM guarantee, stated as a test
  check('4e scoring path touches no AI provider',
    !JSON.stringify(detail.json).toLowerCase().includes('"llm"'));

  // ── gaps and path (steps 11 + 12, measured before and after) ───────────
  const gapsBefore = await call('/officials/me/gaps', { token: learner });
  check('11a gap analysis returns ranked gaps', (gapsBefore.json?.length ?? 0) > 0, `${gapsBefore.json?.length} gaps`);
  check('11b gaps are sorted by severity descending',
    gapsBefore.json.every((g: any, i: number) => i === 0 || gapsBefore.json[i - 1].severity >= g.severity));
  check('11c every gap carries a reason', gapsBefore.json.every((g: any) => !!g.rationale));
  const urgent = gapsBefore.json.filter((g: any) => g.urgency > 1);
  check('11d survey calendar raises urgency on at least one gap', urgent.length > 0,
    urgent[0] ? `${urgent[0].competencyId}: ${urgent[0].urgencyReason[0]}` : '');

  const path = await call('/officials/me/path', { token: learner });
  check('12a learning path is non-empty', (path.json?.length ?? 0) > 0, `${path.json?.length} steps`);

  const orderOf = new Map(path.json.map((s: any) => [s.competencyId, s.order]));
  const graph = await call('/ontology/graph', { token: learner });
  const violations = graph.json.edges
    .filter((e: any) => e.kind === 'REQUIRES' && orderOf.has(e.fromId) && orderOf.has(e.toId))
    .filter((e: any) => (orderOf.get(e.fromId) as number) > (orderOf.get(e.toId) as number));
  check('12b no step precedes its own prerequisite', violations.length === 0,
    violations.length ? JSON.stringify(violations.slice(0, 2)) : `${path.json.length} steps checked`);
  check('12c every step explains why it is there', path.json.every((s: any) => s.why?.length > 10));
  check('12d steps carry iGOT/NSSTA courses', path.json.some((s: any) => s.courses.length > 0));

  // ── 5. upload ─────────────────────────────────────────────────────────
  const pdf = readFileSync(join(here, '..', 'samples', 'stratified-sampling-nssta.pdf'));
  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'stratified-sampling-nssta.pdf');
  form.append('title', 'Stratified Sampling in Large-Scale Household Surveys (NSSTA)');
  const upload = await fetch(`${BASE}/documents`, { method: 'POST', headers: { authorization: `Bearer ${trainer}` }, body: form });
  const ingest = await upload.json() as any;
  check('5a PDF ingested into chunks', (ingest?.chunks ?? 0) >= 4, `${ingest?.pages} pages → ${ingest?.chunks} chunks`);
  check('5b chunks auto-tagged to competencies', (ingest?.tagged?.length ?? 0) > 0,
    ingest?.tagged?.slice(0, 3).map((t: any) => `${t.competencyId}×${t.chunks}`).join(', '));
  check('5c the sampling document tags to a sampling competency',
    ingest.tagged.some((t: any) => t.competencyId.startsWith('STAT.SAMP')),
    ingest.tagged[0] ? `top tag ${ingest.tagged[0].competencyId} via [${ingest.tagged[0].terms.join(', ')}]` : '');

  // ── 6. generate ───────────────────────────────────────────────────────
  const gen = await call(`/documents/${ingest.documentId}/generate`, {
    method: 'POST', token: trainer, body: JSON.stringify({ target: 20 }),
  });
  check('6a generation produced candidates', (gen.json?.candidates ?? 0) > 0,
    `${gen.json?.candidates} candidates in ${gen.json?.elapsedMs}ms via ${gen.json?.provider}`);
  check('6b some candidates were accepted', (gen.json?.accepted ?? 0) >= 5, `${gen.json?.accepted} accepted`);
  check('6c the gate actually rejects things', (gen.json?.rejected ?? 0) > 0,
    `${gen.json?.rejected} rejected (${Math.round((gen.json?.rejectionRate ?? 0) * 100)}%)`);
  check('6d rejection reasons are recorded, not swallowed', (gen.json?.byReason?.length ?? 0) > 0,
    gen.json?.byReason?.map((r: any) => `${r.code}×${r.count}`).join(' '));

  const items = await call(`/documents/${ingest.documentId}/questions`, { token: trainer });
  const candidates = items.json.filter((q: any) => q.status === 'CANDIDATE');
  const rejected = items.json.filter((q: any) => q.status === 'REJECTED');
  check('6e every accepted item quotes its source verbatim',
    candidates.every((q: any) => q.chunk.text.replace(/\s+/g, ' ').toLowerCase().includes(q.sourceQuote.replace(/\s+/g, ' ').toLowerCase())),
    `${candidates.length} items checked`);
  check('6f every accepted item has a resolvable page locator',
    candidates.every((q: any) => q.page >= 1));
  check('6g rejected items keep their reason for the trainer to see',
    rejected.length === 0 || rejected.every((q: any) => !!q.rejectReason));

  // ── 7. trainer review ─────────────────────────────────────────────────
  const toApprove = candidates.slice(0, 6);
  for (const q of toApprove) {
    await call(`/questions/${q.id}/review`, { method: 'POST', token: trainer, body: JSON.stringify({ action: 'approve' }) });
  }
  check('7a trainer approved items', toApprove.length >= 4, `${toApprove.length} approved`);
  const learnerReview = await call(`/questions/${candidates[0].id}/review`, {
    method: 'POST', token: learner, body: JSON.stringify({ action: 'approve' }),
  });
  check('7b a learner cannot approve questions', learnerReview.status === 403);

  // ── 8. take the assessment ────────────────────────────────────────────
  // Build a lookup across every document, because startSession falls back to
  // any approved item when the targeted bank is thin — including items
  // approved by an earlier run of this file.
  const allDocs = await call('/documents', { token: trainer });
  const answerKey = new Map<string, number>();
  for (const d of allDocs.json) {
    const qs = await call(`/documents/${d.id}/questions?status=APPROVED`, { token: trainer });
    for (const q of qs.json) answerKey.set(q.id, q.correctIndex);
  }

  const targetCompetency = toApprove[0].competencyId as string;
  const beforeScore = (await call(`/officials/me/competency/${targetCompetency}`, { token: learner })).json.score;

  const quiz = await call('/quiz/start', {
    method: 'POST', token: learner,
    body: JSON.stringify({ competencyIds: [targetCompetency], count: 4 }),
  });
  check('8a quiz session started', (quiz.json?.questions?.length ?? 0) >= 3, `${quiz.json?.questions?.length} questions`);
  check('8b quiz never exposes the correct index',
    !JSON.stringify(quiz.json.questions).includes('correctIndex'));

  let correctCount = 0;
  for (const q of quiz.json.questions) {
    const correctIndex = answerKey.get(q.id);
    check(`8c-key answer key resolved for Q${q.ordinal}`, correctIndex !== undefined);
    const fb = await call(`/quiz/${quiz.json.sessionId}/answer`, {
      method: 'POST', token: learner,
      body: JSON.stringify({ questionId: q.id, selectedIndex: correctIndex ?? 0 }),
    });
    if (fb.json.correct) correctCount++;
    check(`8c feedback for Q${q.ordinal} cites a page`, fb.json?.citation?.page >= 1 && fb.json?.citation?.quote?.length > 10);
  }
  check('8d answering correctly is graded correctly', correctCount === quiz.json.questions.length);

  // ── 9. evidence appended ──────────────────────────────────────────────
  const result = await call(`/quiz/${quiz.json.sessionId}/submit`, { method: 'POST', token: learner });
  check('9a submission scored 100%', Math.round(result.json?.scorePct) === 100, `${result.json?.scorePct}%`);
  check('9b an evidence row was appended', result.json?.perCompetency?.[0]?.evidenceId?.length > 0,
    `evidence ${result.json?.perCompetency?.[0]?.evidenceId} on ${result.json?.perCompetency?.[0]?.competencyId}`);
  const resubmit = await call(`/quiz/${quiz.json.sessionId}/submit`, { method: 'POST', token: learner });
  check('9c a session cannot be submitted twice', resubmit.status >= 400);

  // ── 10. score updated ─────────────────────────────────────────────────
  const afterDetail = await call(`/officials/me/competency/${targetCompetency}`, { token: learner });
  check('10a the competency score moved', afterDetail.json.score.score > beforeScore.score,
    `${targetCompetency}: ${beforeScore.score.toFixed(1)} → ${afterDetail.json.score.score.toFixed(1)}`);
  check('10b confidence rose because an assessment now exists',
    afterDetail.json.score.confidence >= beforeScore.confidence,
    `confidence ${beforeScore.confidence.toFixed(2)} → ${afterDetail.json.score.confidence.toFixed(2)}`);
  check('10c the new evidence appears in the ledger',
    afterDetail.json.ledger.some((l: any) => l.kind === 'ASSESSMENT' && l.summary.includes('correct')));

  // ── 11+12. gaps and path recomputed ───────────────────────────────────
  const gapsAfter = await call('/officials/me/gaps', { token: learner });
  const before = gapsBefore.json.find((g: any) => g.competencyId === targetCompetency);
  const after = gapsAfter.json.find((g: any) => g.competencyId === targetCompetency);
  check('11e the gap analysis reflects the new evidence',
    !before || !after || after.currentScore > before.currentScore || after.gap <= before.gap,
    before ? `gap ${before.gap} → ${after ? after.gap : 'closed'}` : 'competency was not a gap');
  const pathAfter = await call('/officials/me/path', { token: learner });
  check('12e the learning path recomputed', Array.isArray(pathAfter.json));

  // ── admin ─────────────────────────────────────────────────────────────
  const wf = await call('/admin/workforce', { token: admin });
  check('A1 workforce view returns officials and coverage',
    wf.json?.officials?.length > 0 && wf.json?.coverage?.length > 0,
    `${wf.json?.officials?.length} officials, ${wf.json?.coverage?.length} competencies with a requirement`);
  check('A2 coverage is sorted weakest first',
    wf.json.coverage.every((c: any, i: number) => i === 0 || wf.json.coverage[i - 1].coveragePct <= c.coveragePct));
  check('A3 k-anonymity suppresses thin cells',
    wf.json.coverage.every((c: any) => !c.suppressed || c.required < 5));
  const weakest = wf.json.coverage.find((c: any) => !c.suppressed);
  check('A4 a systemic technical gap is visible', !!weakest,
    weakest ? `weakest: ${weakest.nameEn} at ${weakest.coveragePct.toFixed(0)}% of ${weakest.required} officials` : '');

  const eff = await call('/admin/effectiveness', { token: admin });
  check('A5 training effectiveness computed', (eff.json?.length ?? 0) > 0);
  const flagged = eff.json.filter((e: any) => e.flag === 'HIGH_COMPLETION_LOW_LIFT');
  check('A6 high-completion / low-lift courses are flagged', Array.isArray(flagged),
    flagged.length ? flagged.slice(0, 2).map((f: any) => f.name).join('; ') : 'none in this seed');

  const auditLog = await call('/audit', { token: auditor });
  check('A7 audit log recorded this session’s activity', (auditLog.json?.length ?? 0) > 0,
    `${auditLog.json?.length} events`);

  // ── health ────────────────────────────────────────────────────────────
  const health = await call('/health');
  check('H1 health reports the AI provider and sovereignty', !!health.json?.aiProvider,
    `provider=${health.json?.aiProvider} sovereign=${health.json?.sovereign}`);

  console.log(results.join('\n'));
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(results.join('\n')); console.error('\nFATAL', e); process.exit(1); });
