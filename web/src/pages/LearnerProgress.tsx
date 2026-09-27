import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ClipboardCheck, ArrowRight } from 'lucide-react';
import { api, type Profile } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { num, pct } from '../lib/format.js';
import { Card, CardHeader, Badge, Spinner } from '../components/ui.js';

interface QuizHistoryItem {
  id: string;
  title: string;
  startedAt: string;
  submittedAt: string | null;
  scorePct: number | null;
  competencyIds: string[];
}

export function LearnerProgress() {
  const { data: profile, loading: profileLoading } = useAsync<Profile>(() => api('/officials/me/profile'), []);
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    api<QuizHistoryItem[]>('/quiz/history')
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  if (profileLoading && !profile) return <Spinner label="Loading your learning progression..." />;

  const metCount = profile?.domains.reduce((a, d) => a + d.metCount, 0) ?? 0;
  const totalRequired = profile?.domains.reduce((a, d) => a + d.requiredCount, 0) ?? 0;
  const evidenceTotal = profile?.evidenceTotal ?? 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      <header className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-ink">Progress &amp; Continuous Learning</h1>
              <span className="rounded border border-primary/30 bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                Continuous Learning Loop
              </span>
            </div>
            <p className="mt-1 text-[13px] text-muted max-w-3xl">
              Track your competency evolution over time. Every score is verified through dated evidence from assessments,
              course completions, and virtual lab practice sessions.
            </p>
          </div>
          <Link
            to="/assess"
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-[13px] font-medium text-white hover:bg-primary-hover transition-colors"
          >
            <ClipboardCheck size={14} /> Take Milestone Quiz
          </Link>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Role Requirements Met</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">
            {metCount}
            <span className="text-[16px] font-medium text-subtle"> / {totalRequired}</span>
          </p>
          <p className="mt-1 text-[12px] text-muted">competencies verified at or above target</p>
        </Card>

        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Evidence on Ledger</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{num(evidenceTotal)}</p>
          <p className="mt-1 text-[12px] text-muted">immutable verification records</p>
        </Card>

        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Assessments Completed</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{history.length}</p>
          <p className="mt-1 text-[12px] text-muted">diagnostic and milestone evaluations</p>
        </Card>

        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Continuous Loop Status</p>
          <p className="tnum mt-1 text-[20px] font-bold text-primary">Active Loop</p>
          <p className="mt-1 text-[12px] text-muted">adaptive recalculation enabled</p>
        </Card>
      </div>

      {/* The 7-step Continuous Learning Loop Diagram */}
      <Card className="p-5 border-primary/20 bg-surface">
        <div className="flex items-center justify-between mb-3 border-b border-border pb-3">
          <h2 className="text-[15px] font-bold text-ink flex items-center gap-2">
            <RefreshCw size={17} className="text-primary" />
            <span>The STATINTEL Continuous Adaptive Learning Loop</span>
          </h2>
          <Badge tone="primary">SIH26101 Core Architecture</Badge>
        </div>
        <p className="text-[13px] text-muted leading-relaxed mb-4">
          Learning in STATINTEL is not a one-time event. Scores decay naturally over time to reflect skill retention,
          prompting periodic diagnostics and updated training recommendations.
        </p>

        <div className="grid gap-2 sm:grid-cols-7 text-[12px]">
          <div className="rounded border border-border bg-raised p-2.5 flex flex-col justify-between">
            <span className="font-bold text-primary">1. Assess</span>
            <span className="text-muted text-[11px] mt-1">Take diagnostic quiz</span>
          </div>
          <div className="rounded border border-border bg-raised p-2.5 flex flex-col justify-between">
            <span className="font-bold text-ink">2. Score</span>
            <span className="text-muted text-[11px] mt-1">Ledger updates</span>
          </div>
          <div className="rounded border border-critical/30 bg-critical/10 p-2.5 flex flex-col justify-between">
            <span className="font-bold text-critical">3. Gap Analysis</span>
            <span className="text-muted text-[11px] mt-1">Identify shortages</span>
          </div>
          <div className="rounded border border-primary/30 bg-primary-soft p-2.5 flex flex-col justify-between">
            <span className="font-bold text-primary">4. Recommend</span>
            <span className="text-muted text-[11px] mt-1">iGOT &amp; NSSTA modules</span>
          </div>
          <div className="rounded border border-border bg-raised p-2.5 flex flex-col justify-between">
            <span className="font-bold text-ink">5. Practice</span>
            <span className="text-muted text-[11px] mt-1">Virtual Labs hands-on</span>
          </div>
          <div className="rounded border border-border bg-raised p-2.5 flex flex-col justify-between">
            <span className="font-bold text-ink">6. Quiz</span>
            <span className="text-muted text-[11px] mt-1">Verify new capability</span>
          </div>
          <div className="rounded border border-success/30 bg-success/10 p-2.5 flex flex-col justify-between">
            <span className="font-bold text-success">7. Lift</span>
            <span className="text-muted text-[11px] mt-1">Updated Competency</span>
          </div>
        </div>
      </Card>

      {/* Assessment History Table */}
      <Card>
        <CardHeader
          title="Recent Assessment &amp; Quiz History"
          subtitle="Your recorded evaluation sessions and measured score outcomes"
          action={
            <Link to="/assess" className="text-[12px] font-medium text-primary hover:underline flex items-center gap-1">
              Start new assessment <ArrowRight size={13} />
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-raised/50">
                <th className="px-4 py-2.5 text-left font-semibold text-ink">Assessment Title</th>
                <th className="px-4 py-2.5 text-left font-semibold text-ink">Date Started</th>
                <th className="px-4 py-2.5 text-left font-semibold text-ink">Completed</th>
                <th className="px-4 py-2.5 text-right font-semibold text-ink">Score</th>
                <th className="px-4 py-2.5 text-right font-semibold text-ink">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-b border-border hover:bg-surface">
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">{item.title}</span>
                    <span className="block text-[11px] text-subtle font-mono">{item.id.slice(0, 12)}…</span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(item.startedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {item.submittedAt
                      ? new Date(item.submittedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.scorePct !== null ? (
                      <span className="font-bold text-primary tnum">{pct(item.scorePct)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge tone={item.submittedAt ? 'success' : 'neutral'}>
                      {item.submittedAt ? 'Completed' : 'In Progress'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {history.length === 0 && !loadingHistory && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-muted">
                    No assessments taken yet. Use the "Take Milestone Quiz" button above to evaluate your competencies.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
