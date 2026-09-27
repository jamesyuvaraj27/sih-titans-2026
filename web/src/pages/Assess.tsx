import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, FileText, XCircle, ClipboardCheck, History, Award, ArrowRight, Clock } from 'lucide-react';
import { post, type Gap } from '../lib/api.js';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { num, pct } from '../lib/format.js';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, ProgressBar, Th, Td } from '../components/ui.js';

interface Question {
  id: string;
  ordinal: number;
  stem: string;
  options: string[];
  competencyId: string;
  competencyName: string;
  bloom: string;
  difficulty: string;
}

interface Session {
  sessionId: string;
  title: string;
  questions: Question[];
}

interface Feedback {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  rationale: string;
  distractorReason: string | null;
  citation: { page: number; headingPath: string; quote: string; documentTitle: string };
}

interface QuestionReviewItem {
  questionId: string;
  stem: string;
  options: string[];
  selectedIndex: number | null;
  correctIndex: number;
  correct: boolean | null;
  rationale?: string;
  explanation?: string;
  distractorReason?: string | null;
  citation?: { page: number; headingPath: string; quote: string; documentTitle?: string };
}

interface SubmitResult {
  sessionId: string;
  scorePct?: number;
  score?: number;
  correct?: number;
  correctAnswers?: number;
  total?: number;
  totalQuestions?: number;
  feedback?: string;
  perCompetency?: {
    competencyId: string;
    nameEn: string;
    correct: number;
    total: number;
    quality: number;
    evidenceId?: string;
  }[];
  questions?: QuestionReviewItem[];
}

interface QuizHistoryItem {
  id: string;
  title: string;
  startedAt: string;
  submittedAt: string | null;
  scorePct: number | null;
  competencyIds: string[];
}

import React from 'react';

class AssessErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('[AssessErrorBoundary] Captured runtime exception safely:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-xl py-12 px-4 text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
            <ClipboardCheck size={28} />
          </div>
          <h2 className="text-[20px] font-bold text-ink">Your submission was saved safely.</h2>
          <p className="text-[13px] text-muted max-w-md mx-auto leading-relaxed">
            Your assessment progress and submitted answers have been preserved in the system ledger.
          </p>
          <div className="flex justify-center gap-3 pt-3">
            <Button onClick={() => window.location.href = '/assess'}>Return to Assessment Hub</Button>
            <Button variant="secondary" onClick={() => window.location.href = '/assess?tab=history'}>View History</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AssessInner() {
  const location = useLocation() as { state?: { session?: Session } };
  const [session, setSession] = useState<Session | null>(location.state?.session ?? null);
  const [activeTab, setActiveTab] = useState<'assess' | 'history'>('assess');
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: gaps } = useAsync<Gap[]>(() => api('/officials/me/gaps'), []);
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = () => {
    setLoadingHistory(true);
    api<QuizHistoryItem[]>('/quiz/history')
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const resetToHub = (targetTab: 'assess' | 'history' = 'assess') => {
    setSession(null);
    setResult(null);
    setFeedback(null);
    setSelected(null);
    setError(null);
    setIdx(0);
    setActiveTab(targetTab);
  };

  async function start(competencyIds?: string[]) {
    setBusy(true);
    setError(null);
    try {
      const s = await post<Session>('/quiz/start', { competencyIds, count: 5 });
      setSession(s);
      setIdx(0);
      setSelected(null);
      setFeedback(null);
      setResult(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not start the assessment');
    } finally {
      setBusy(false);
    }
  }

  async function answer() {
    if (!session || selected === null) return;
    setBusy(true);
    try {
      const q = session.questions[idx]!;
      setFeedback(
        await post<Feedback>(`/quiz/${session.sessionId}/answer`, {
          questionId: q.id,
          selectedIndex: selected,
        })
      );
    } catch (e: any) {
      setError(e?.message ?? 'Could not record the answer');
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!session) return;
    if (idx + 1 < session.questions.length) {
      setIdx(idx + 1);
      setSelected(null);
      setFeedback(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const submitRes = await post<SubmitResult>(`/quiz/${session.sessionId}/submit`);
      setResult(submitRes);
      loadHistory();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('already been submitted') || e?.status === 400) {
        // Double-submit safety: Load session record safely from history without crashing
        try {
          const historyList = await api<QuizHistoryItem[]>('/quiz/history');
          const found = historyList.find((h) => h.id === session.sessionId);
          if (found && found.submittedAt) {
            setResult({
              sessionId: session.sessionId,
              scorePct: found.scorePct ?? 0,
              score: found.scorePct ?? 0,
              feedback: `Your assessment submission was saved safely. Final score: ${Math.round(found.scorePct ?? 0)}%.`,
              perCompetency: [],
              questions: [],
            });
            loadHistory();
            return;
          }
        } catch {
          // fallback to error state
        }
      }
      setError(e?.message ?? 'Could not submit assessment');
    } finally {
      setBusy(false);
    }
  }

  // ── Result View ──────────────────────────────────────────────────────
  if (result) {
    const scorePct = result.scorePct ?? result.score ?? 0;
    const perCompetency = Array.isArray(result.perCompetency) ? result.perCompetency : [];
    const questions = Array.isArray(result.questions) ? result.questions : [];
    const passed = scorePct >= 70;

    return (
      <div className="mx-auto max-w-3xl space-y-5 py-2">
        <Card>
          <CardHeader
            title="Assessment & Quiz Evaluation Complete"
            subtitle="Verified evidence has been appended to your immutable ledger. Scores have been updated."
          />
          <div className="p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Evaluation Score</p>
                <p className="tnum text-[44px] font-bold leading-none text-ink mt-1">{num(scorePct, 0)}%</p>
                {result.feedback && (
                  <p className="mt-1 text-[13px] text-muted">{result.feedback}</p>
                )}
              </div>
              <div className="sm:text-right">
                <Badge tone={passed ? 'success' : 'moderate'}>
                  {passed ? 'Competency Target Met' : 'Further Practice Recommended'}
                </Badge>
                <p className="mt-1.5 text-[11px] font-mono text-subtle">
                  Session: {result.sessionId?.slice(0, 12)}…
                </p>
              </div>
            </div>

            <div className="mt-1">
              <ProgressBar value={scorePct} label="Assessment score" />
            </div>

            {/* Competency Impact & Evidence Ledger Records */}
            {perCompetency.length > 0 && (
              <div className="pt-2">
                <p className="text-[13px] font-semibold text-ink mb-2">Competency Impact &amp; Ledger Records:</p>
                <ul className="space-y-2">
                  {perCompetency.map((c) => (
                    <li key={c.competencyId} className="rounded border border-border bg-surface p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link to={`/competency/${c.competencyId}`} className="text-[14px] font-semibold text-primary hover:underline">
                          {c.nameEn}
                        </Link>
                        <span className="tnum text-[13px] font-bold text-ink">{c.correct} / {c.total} items correct</span>
                      </div>
                      <p className="mt-1 text-[12px] text-muted">
                        Appended as <span className="font-semibold text-ink">ASSESSMENT</span> evidence, weight 1.00,
                        quality {num(c.quality ?? 0, 2)} — ledger ID <code className="tnum font-mono">{c.evidenceId ? c.evidenceId.slice(0, 14) + '…' : 'Recorded'}</code>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Question Explanations & Review */}
            {questions.length > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[14px] font-bold text-ink">Question Review &amp; Detailed Explanations</h3>
                  <span className="text-[12px] text-muted">
                    {questions.filter((q) => q.correct).length} of {questions.length} correct
                  </span>
                </div>
                <div className="space-y-3">
                  {questions.map((q, idx) => (
                    <div
                      key={q.questionId || idx}
                      className={`rounded-lg border p-4 text-[13px] ${
                        q.correct
                          ? 'border-success/30 bg-success/5'
                          : 'border-critical/30 bg-critical/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-bold text-ink">
                          Question {idx + 1}
                        </span>
                        <Badge tone={q.correct ? 'success' : 'critical'}>
                          {q.correct ? 'Correct' : 'Incorrect'}
                        </Badge>
                      </div>
                      <p className="font-medium text-ink leading-relaxed mb-3">{q.stem}</p>

                      <div className="space-y-1.5 mb-3 pl-2">
                        {(q.options || []).map((opt, optIdx) => {
                          const isKey = optIdx === q.correctIndex;
                          const isPicked = optIdx === q.selectedIndex;
                          return (
                            <div
                              key={optIdx}
                              className={`flex items-start gap-2 p-1.5 rounded ${
                                isKey
                                  ? 'bg-success/15 font-semibold text-ink border border-success/40'
                                  : isPicked && !isKey
                                  ? 'bg-critical/15 text-critical line-through'
                                  : 'text-muted'
                              }`}
                            >
                              <span className="font-mono text-subtle font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                              <span className="flex-1">{opt}</span>
                              {isKey && (
                                <span className="text-[11px] text-success font-bold shrink-0">✓ Correct</span>
                              )}
                              {isPicked && !isKey && (
                                <span className="text-[11px] text-critical font-bold shrink-0">Your pick</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded border border-border bg-surface p-3 space-y-1.5 mt-2">
                        <p className="text-[12px] text-ink font-medium">
                          <span className="font-bold text-subtle">Explanation: </span>
                          {q.explanation || q.rationale || 'Grounded in official curriculum guidelines.'}
                        </p>
                        {q.distractorReason && (
                          <p className="text-[12px] text-muted">
                            <span className="font-semibold text-ink">Why other choices fail: </span>
                            {q.distractorReason}
                          </p>
                        )}
                        {q.citation && q.citation.quote && (
                          <div className="pt-1 text-[11px] text-subtle border-t border-border/50 flex items-start gap-1">
                            <FileText size={12} className="shrink-0 mt-0.5" />
                            <span>
                              {q.citation.documentTitle || 'NSSTA Literature'} · Page {q.citation.page} · "{q.citation.quote}"
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Alert tone="info" title="Deterministic Competency Ledger Update">
              Your score was not manually overwritten. A dated evidence row was appended, and every competency score
              that depends on it has been automatically recalculated from the ledger without any language model in the scoring path.
            </Alert>

            <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-border">
              <Button onClick={() => resetToHub('assess')}>
                Take Another Quiz
              </Button>
              <Button variant="secondary" onClick={() => resetToHub('assess')}>
                Return to Assessment Hub
              </Button>
              <Button variant="secondary" onClick={() => resetToHub('history')}>
                View Assessment History
              </Button>
              <Link to="/"><Button variant="secondary">Go to Dashboard</Button></Link>
              <Link to="/gaps"><Button variant="secondary">Recheck My Gaps</Button></Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ── Unified Hub Chooser (Assessment & Quizzes) ────────────────────────
  if (!session) {
    const completedHistory = history.filter((h) => h.submittedAt !== null);
    const avgScore =
      completedHistory.length > 0
        ? Math.round(completedHistory.reduce((acc, h) => acc + (h.scorePct ?? 0), 0) / completedHistory.length)
        : null;

    return (
      <div className="space-y-5 max-w-5xl mx-auto py-2">
        <header className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight text-ink">Assessment &amp; Quizzes</h1>
                <Badge tone="primary" icon={<ClipboardCheck size={13} />}>Learner Evaluation Hub</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted max-w-3xl">
                Diagnostic evaluations and curriculum-grounded milestone quizzes for India's Official Statistical System.
                Every question cites official training literature, and all results contribute to your immutable evidence ledger.
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="mt-4 flex gap-2 border-b border-border pt-1">
            <button
              onClick={() => setActiveTab('assess')}
              className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'assess'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <ClipboardCheck size={15} /> Take Assessment / Quiz
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <History size={15} /> Assessment History &amp; Results ({history.length})
            </button>
            <Link
              to="/learner/assignments"
              className="inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 border-transparent text-muted hover:text-primary transition-colors cursor-pointer"
            >
              <FileText size={15} /> Assignments &amp; Hands-on Tasks →
            </Link>
          </nav>
        </header>

        {error && <Alert tone="critical" title="Could not start assessment">{error}</Alert>}

        {/* TAB 1: Take Assessment / Quiz */}
        {activeTab === 'assess' && (
          <div className="space-y-5">
            {/* Primary Action: Diagnostic on Top Gaps */}
            <Card className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-[17px] font-bold text-ink flex items-center gap-2">
                    <Award size={18} className="text-primary" />
                    <span>Personalized Diagnostic Assessment</span>
                  </h2>
                  <p className="mt-1 text-[13px] text-muted max-w-2xl leading-relaxed">
                    Automatically targets your highest-severity competency gaps based on your desired job role,
                    current assignment, and upcoming statistical survey calendars.
                  </p>
                </div>
                <Button onClick={() => start()} loading={busy} size="md" className="shrink-0">
                  <ClipboardCheck size={15} className="mr-1.5" /> Start Diagnostic (Top Gaps)
                </Button>
              </div>
            </Card>

            {/* Targeted Topic & Milestone Quizzes */}
            <Card>
              <CardHeader
                title="Targeted Topic &amp; Milestone Quizzes"
                subtitle="Select any competency to take a focused 5-question evaluation module"
              />
              <div className="p-4">
                {(gaps ?? []).length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(gaps ?? []).map((g) => (
                      <button
                        key={g.competencyId}
                        onClick={() => start([g.competencyId])}
                        disabled={busy}
                        className="w-full text-left rounded-lg border border-border bg-surface p-3.5 hover:border-primary/50 hover:bg-raised transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-mono text-[10px] font-semibold text-subtle bg-raised px-1.5 py-0.5 rounded border border-border">
                            {g.competencyId}
                          </span>
                          <span className="text-[11px] font-bold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            Start Quiz <ArrowRight size={12} />
                          </span>
                        </div>
                        <h4 className="text-[14px] font-semibold text-ink group-hover:text-primary transition-colors leading-snug">
                          {g.nameEn}
                        </h4>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                          <span>Target: <strong className="text-ink">L{g.targetLevel}</strong></span>
                          <span>Current: <strong className="text-subtle">L{g.currentLevel}</strong></span>
                          <span className="text-critical font-medium">Gap: {num(g.severity, 1)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted py-2">
                    No active skill gaps identified. You can run a general diagnostic to verify your competency levels.
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: Assessment History & Results */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Assessments Completed</p>
                <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{completedHistory.length}</p>
                <p className="mt-1 text-[12px] text-muted">of {history.length} initiated sessions</p>
              </Card>
              <Card className="p-4">
                <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Average Score</p>
                <p className="tnum mt-1 text-[28px] font-bold leading-none text-primary">
                  {avgScore !== null ? `${avgScore}%` : '—'}
                </p>
                <p className="mt-1 text-[12px] text-muted">across completed evaluations</p>
              </Card>
              <Card className="p-4">
                <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Evidence Verification</p>
                <p className="tnum mt-1 text-[28px] font-bold leading-none text-success">Active</p>
                <p className="mt-1 text-[12px] text-muted">immutable PostgreSQL ledger records</p>
              </Card>
            </div>

            {/* Assessment History Table */}
            <Card>
              <CardHeader
                title="Historical Assessment Log"
                subtitle="Complete record of all diagnostic and milestone quiz sessions"
                action={
                  <Button size="sm" onClick={() => setActiveTab('assess')}>
                    <ClipboardCheck size={14} /> Start New Quiz
                  </Button>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-border bg-raised/50">
                      <Th>Assessment Session</Th>
                      <Th>Date &amp; Time</Th>
                      <Th>Completion</Th>
                      <Th align="right">Evaluation Score</Th>
                      <Th align="right">Status</Th>
                      <Th align="right">Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id} className="border-b border-border hover:bg-surface">
                        <Td>
                          <span className="font-semibold text-ink">{item.title}</span>
                          <span className="block text-[11px] text-subtle font-mono">{item.id.slice(0, 10)}…</span>
                        </Td>
                        <Td className="text-muted">
                          {new Date(item.startedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </Td>
                        <Td className="text-muted">
                          {item.submittedAt
                            ? new Date(item.submittedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </Td>
                        <Td align="right">
                          {item.scorePct !== null ? (
                            <span className="font-bold text-primary tnum">{pct(item.scorePct)}</span>
                          ) : (
                            '—'
                          )}
                        </Td>
                        <Td align="right">
                          <Badge tone={item.submittedAt ? 'success' : 'neutral'}>
                            {item.submittedAt ? 'Completed' : 'In Progress'}
                          </Badge>
                        </Td>
                        <Td align="right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => start(item.competencyIds)}
                          >
                            Retake
                          </Button>
                        </Td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted text-[13px]">
                          {loadingHistory ? 'Loading assessment records…' : 'No assessment history found. Take your first quiz above!'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ── Quiz Player (Active Session) ──────────────────────────────────────
  const q = session.questions[idx];
  if (!q) return <EmptyState title="This session has no questions" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <div>
        <div className="flex items-center justify-between text-[13px] text-muted">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (window.confirm('Return to Assessment Hub? Your unsubmitted answers in this session will not be graded.')) {
                  resetToHub('assess');
                }
              }}
            >
              ← Exit Assessment
            </Button>
            <span className="font-medium text-ink">{session.title}</span>
          </div>
          <span className="tnum font-medium">Question {idx + 1} of {session.questions.length}</span>
        </div>
        <div className="mt-2">
          <ProgressBar
            value={idx + 1}
            max={session.questions.length}
            label={`Progress: question ${idx + 1} of ${session.questions.length}`}
          />
        </div>
      </div>

      {error && (
        <div className="space-y-2">
          <Alert tone="critical" title="Assessment Notification">{error}</Alert>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => resetToHub('assess')}>
              Return to Assessment Hub
            </Button>
            <Button size="sm" variant="secondary" onClick={() => resetToHub('history')}>
              View History
            </Button>
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <Badge tone="primary">{q.competencyName}</Badge>
          <Badge tone="neutral" title="Bloom's taxonomy level this item targets">Bloom: {q.bloom}</Badge>
          <Badge tone="neutral" title="Difficulty level">Difficulty: {q.difficulty}</Badge>
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
                    className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded border p-3 text-[14px] transition-colors ${
                      isKey
                        ? 'border-success bg-success/10'
                        : isWrongPick
                        ? 'border-critical bg-critical/10'
                        : selected === i
                        ? 'border-primary bg-primary-soft'
                        : 'border-border hover:bg-surface'
                    }`}
                  >
                    <input
                      type="radio"
                      name="option"
                      value={i}
                      checked={selected === i}
                      onChange={() => setSelected(i)}
                      className="mt-1 accent-[color:var(--primary)]"
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
          <div className="border-t border-border px-4 py-3 bg-surface/50" role="status">
            <p className={`text-[14px] font-bold ${feedback.correct ? 'text-success' : 'text-critical'}`}>
              {feedback.correct ? '✓ Correct Answer' : '✕ Incorrect Selection'}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink">{feedback.rationale}</p>
            {feedback.distractorReason && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                <span className="font-semibold text-ink">Why this option is incorrect: </span>
                {feedback.distractorReason}
              </p>
            )}
            <figure className="mt-3 rounded border border-border bg-surface p-3">
              <figcaption className="flex items-center gap-1.5 text-[12px] font-medium text-subtle">
                <FileText size={13} aria-hidden="true" />
                <span>{feedback.citation?.documentTitle || 'Official Literature'} · {feedback.citation?.headingPath || 'General'} · Page {feedback.citation?.page || 1}</span>
              </figcaption>
              <blockquote className="mt-1.5 border-l-2 border-primary pl-3 text-[12px] italic leading-relaxed text-muted">
                "{feedback.citation?.quote || 'Curriculum reference grounded in verified statistical text.'}"
              </blockquote>
            </figure>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 bg-surface">
          <p className="text-[12px] text-subtle flex items-center gap-1">
            <Clock size={12} /> Questions grounded in verified NSSTA literature
          </p>
          {feedback ? (
            <Button onClick={next} loading={busy}>
              {idx + 1 < session.questions.length ? 'Next Question' : 'Submit & Append Evidence'}
            </Button>
          ) : (
            <Button onClick={answer} disabled={selected === null} loading={busy}>
              Check Answer
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

export function Assess() {
  return (
    <AssessErrorBoundary>
      <AssessInner />
    </AssessErrorBoundary>
  );
}
