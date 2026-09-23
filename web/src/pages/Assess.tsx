import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import { post, type Gap } from '../lib/api.js';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { num } from '../lib/format.js';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, ProgressBar } from '../components/ui.js';

interface Question {
  id: string; ordinal: number; stem: string; options: string[];
  competencyId: string; competencyName: string; bloom: string; difficulty: string;
}
interface Session { sessionId: string; title: string; questions: Question[] }
interface Feedback {
  questionId: string; correct: boolean; correctIndex: number; rationale: string;
  distractorReason: string | null;
  citation: { page: number; headingPath: string; quote: string; documentTitle: string };
}
interface SubmitResult {
  sessionId: string; scorePct: number;
  perCompetency: { competencyId: string; nameEn: string; correct: number; total: number; quality: number; evidenceId: string }[];
}

export function Assess() {
  const location = useLocation() as { state?: { session?: Session } };
  const [session, setSession] = useState<Session | null>(location.state?.session ?? null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: gaps } = useAsync<Gap[]>(() => api('/officials/me/gaps'), []);

  async function start(competencyIds?: string[]) {
    setBusy(true); setError(null);
    try {
      const s = await post<Session>('/quiz/start', { competencyIds, count: 5 });
      setSession(s); setIdx(0); setSelected(null); setFeedback(null); setResult(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not start the assessment');
    } finally { setBusy(false); }
  }

  async function answer() {
    if (!session || selected === null) return;
    setBusy(true);
    try {
      const q = session.questions[idx]!;
      setFeedback(await post<Feedback>(`/quiz/${session.sessionId}/answer`, { questionId: q.id, selectedIndex: selected }));
    } catch (e: any) { setError(e?.message ?? 'Could not record the answer'); }
    finally { setBusy(false); }
  }

  async function next() {
    if (!session) return;
    if (idx + 1 < session.questions.length) {
      setIdx(idx + 1); setSelected(null); setFeedback(null); return;
    }
    setBusy(true);
    try { setResult(await post<SubmitResult>(`/quiz/${session.sessionId}/submit`)); }
    catch (e: any) { setError(e?.message ?? 'Could not submit'); }
    finally { setBusy(false); }
  }

  // ── result ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader title="Assessment complete" subtitle="Evidence has been appended to your ledger. It cannot be edited or deleted." />
          <div className="p-4">
            <p className="tnum text-[40px] font-bold leading-none text-ink">{num(result.scorePct, 0)}%</p>
            <div className="mt-3"><ProgressBar value={result.scorePct} label="Assessment score" /></div>

            <ul className="mt-5 space-y-2">
              {result.perCompetency.map((c) => (
                <li key={c.competencyId} className="rounded border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link to={`/competency/${c.competencyId}`} className="text-[14px] font-medium text-primary hover:underline">
                      {c.nameEn}
                    </Link>
                    <span className="tnum text-[13px] text-ink">{c.correct} / {c.total} correct</span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    Appended as <span className="font-medium text-ink">ASSESSMENT</span> evidence, weight 1.00,
                    quality {num(c.quality, 2)} — evidence id <code className="tnum">{c.evidenceId.slice(0, 12)}…</code>
                  </p>
                </li>
              ))}
            </ul>

            <Alert tone="info" title="What just happened">
              Your score was not written anywhere. A dated evidence row was appended, and every competency
              score that depends on it will now be recomputed from the ledger the next time it is read —
              including on the dashboard, the gap analysis and your learning path.
            </Alert>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/"><Button>See the updated dashboard</Button></Link>
              <Link to="/gaps"><Button variant="secondary">Recheck my gaps</Button></Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ── chooser ─────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">Assessment</h1>
          <p className="mt-1 max-w-3xl text-[14px] text-muted">
            Questions come only from material a trainer has reviewed and approved. Each one cites the page
            it was generated from, so you can check the source of anything you get wrong.
          </p>
        </header>

        {error && <Alert tone="critical" title="Could not start">{error}</Alert>}

        <Card>
          <CardHeader title="Start a diagnostic" subtitle="Aimed at your most severe gaps by default." />
          <div className="p-4">
            <Button onClick={() => start()} loading={busy}>Diagnostic on my top gaps</Button>
            {(gaps ?? []).length > 0 && (
              <>
                <p className="mt-5 text-[13px] font-medium text-ink">Or target one competency</p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(gaps ?? []).slice(0, 8).map((g) => (
                    <li key={g.competencyId}>
                      <button
                        onClick={() => start([g.competencyId])}
                        className="w-full cursor-pointer rounded border border-border p-3 text-left hover:bg-surface"
                      >
                        <span className="block text-[14px] font-medium text-ink">{g.nameEn}</span>
                        <span className="block text-[12px] text-muted">L{g.currentLevel} → L{g.targetLevel} · severity {num(g.severity, 1)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ── player ──────────────────────────────────────────────────────────
  const q = session.questions[idx];
  if (!q) return <EmptyState title="This session has no questions" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <div className="flex items-center justify-between text-[13px] text-muted">
          <span>{session.title}</span>
          <span className="tnum">Question {idx + 1} of {session.questions.length}</span>
        </div>
        <div className="mt-2"><ProgressBar value={idx} max={session.questions.length} label={`Progress: question ${idx + 1} of ${session.questions.length}`} /></div>
      </div>

      {error && <Alert tone="critical" title="Something went wrong">{error}</Alert>}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <Badge tone="primary">{q.competencyName}</Badge>
          <Badge tone="neutral" title="Bloom's taxonomy level this item targets">{q.bloom}</Badge>
          <Badge tone="neutral" title="Predicted difficulty from the cold-start heuristic">{q.difficulty}</Badge>
        </div>

        <fieldset className="p-4" disabled={!!feedback}>
          <legend className="text-[16px] font-medium leading-relaxed text-ink">{q.stem}</legend>

          <ul className="mt-4 space-y-2">
            {q.options.map((opt, i) => {
              const isKey = feedback && i === feedback.correctIndex;
              const isWrongPick = feedback && i === selected && !feedback.correct;
              return (
                <li key={i}>
                  <label
                    className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded border p-3 text-[14px] ${
                      isKey ? 'border-success bg-success/10'
                      : isWrongPick ? 'border-critical bg-critical/10'
                      : selected === i ? 'border-primary bg-primary-soft'
                      : 'border-border hover:bg-surface'
                    }`}
                  >
                    <input
                      type="radio" name="option" value={i} checked={selected === i}
                      onChange={() => setSelected(i)} className="mt-1 accent-[color:var(--primary)]"
                    />
                    <span className="flex-1 text-ink">
                      <span className="mr-1.5 font-semibold text-subtle">{String.fromCharCode(65 + i)}.</span>
                      {opt}
                    </span>
                    {isKey && <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" aria-label="Correct answer" />}
                    {isWrongPick && <XCircle size={17} className="mt-0.5 shrink-0 text-critical" aria-label="Your answer, incorrect" />}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        {feedback && (
          <div className="border-t border-border px-4 py-3" role="status">
            <p className={`text-[14px] font-semibold ${feedback.correct ? 'text-success' : 'text-critical'}`}>
              {feedback.correct ? 'Correct' : 'Not correct'}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink">{feedback.rationale}</p>
            {feedback.distractorReason && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                <span className="font-medium text-ink">Why that option is wrong: </span>{feedback.distractorReason}
              </p>
            )}
            <figure className="mt-3 rounded border border-border bg-surface p-3">
              <figcaption className="flex items-center gap-1.5 text-[12px] font-medium text-subtle">
                <FileText size={13} aria-hidden="true" />
                {feedback.citation.documentTitle} · {feedback.citation.headingPath || 'untitled section'} · page {feedback.citation.page}
              </figcaption>
              <blockquote className="mt-1.5 border-l-2 border-primary pl-3 text-[13px] italic leading-relaxed text-muted">
                {feedback.citation.quote}
              </blockquote>
            </figure>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-[12px] text-subtle">Every question cites the page it came from.</p>
          {feedback
            ? <Button onClick={next} loading={busy}>{idx + 1 < session.questions.length ? 'Next question' : 'Submit assessment'}</Button>
            : <Button onClick={answer} disabled={selected === null} loading={busy}>Check answer</Button>}
        </div>
      </Card>
    </div>
  );
}
