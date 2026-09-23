import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink, Lock, Target } from 'lucide-react';
import { api, type PathStep } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { hours, mins } from '../lib/format.js';
import { Alert, Badge, Card, CardHeader, EmptyState, Spinner } from '../components/ui.js';

/**
 * The learning path is produced by a topological sort over the prerequisite
 * graph, not by an LLM. Each step therefore carries a `why` that is true by
 * construction rather than generated after the fact.
 */
export function Path() {
  const { data, loading, error } = useAsync<PathStep[]>(() => api('/officials/me/path'));

  if (loading && !data) return <Spinner label="Ordering your learning path" />;
  if (error) return <Alert tone="critical" title="Could not build a learning path">{error}</Alert>;

  const steps = data ?? [];
  const totalHours = steps.reduce((a, s) => a + s.estHours, 0);
  const prereqs = steps.filter((s) => s.isPrerequisite).length;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-ink">Learning path</h1>
        <p className="mt-1 max-w-3xl text-[14px] text-muted">
          Ordered by prerequisite first, then by gap severity, then by quickest win, then by how many other
          competencies the step unblocks. No step can appear before something it depends on — that is
          guaranteed by the sort, not by a prompt.
        </p>
      </header>

      {steps.length === 0 ? (
        <Card>
          <EmptyState title="Nothing to schedule">
            Every competency your role requires is already evidenced at its target level.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Steps</p>
              <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{steps.length}</p>
              <p className="mt-1 text-[12px] text-muted">{prereqs} are prerequisites you do not yet hold</p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Estimated effort</p>
              <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{hours(totalHours)}</p>
              <p className="mt-1 text-[12px] text-muted">sum of per-competency estimates</p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Course sources</p>
              <p className="mt-1 text-[16px] font-semibold text-ink">iGOT Karmayogi + NSSTA / TPAC</p>
              <p className="mt-1 text-[12px] text-muted">retrieved through the Sunbird-contract client</p>
            </Card>
          </div>

          <Card>
            <CardHeader title="Your sequence" subtitle="Each step states why it is where it is." />
            <ol className="divide-y divide-border">
              {steps.map((s) => (
                <li key={s.competencyId} className="flex gap-3 px-4 py-4">
                  <span
                    aria-hidden="true"
                    className="tnum mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-[12px] font-semibold text-ink"
                  >
                    {s.order}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/competency/${s.competencyId}`} className="text-[15px] font-semibold text-primary hover:underline">
                        {s.nameEn}
                      </Link>
                      {s.isPrerequisite
                        ? <Badge tone="neutral" icon={<Lock size={11} aria-hidden="true" />}>Prerequisite</Badge>
                        : <Badge tone="primary" icon={<Target size={11} aria-hidden="true" />}>Role target</Badge>}
                      <Badge tone="neutral">L{s.fromLevel} → L{s.toLevel}</Badge>
                      <Badge tone="neutral">{hours(s.estHours)}</Badge>
                    </div>

                    <p className="mt-1 text-[13px] text-muted">{s.why}</p>
                    {s.unlocks.length > 0 && (
                      <p className="mt-1 text-[12px] text-subtle">Unblocks: {s.unlocks.join(', ')}</p>
                    )}

                    {s.courses.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {s.courses.map((c) => (
                          <li key={c.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                            <BookOpen size={13} className="shrink-0 text-subtle" aria-hidden="true" />
                            <span className={c.primary ? 'font-medium text-ink' : 'text-muted'}>{c.name}</span>
                            <Badge tone="neutral">{c.provider}</Badge>
                            {c.tpacFlagged && <Badge tone="primary">TPAC</Badge>}
                            <span className="tnum text-[12px] text-subtle">{mins(c.durationMins)}</span>
                            {c.primary && <Badge tone="success">recommended</Badge>}
                            {c.url && (
                              <a href={c.url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                                Enrol on iGOT <ExternalLink size={11} aria-hidden="true" />
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <p className="border-t border-border bg-surface px-4 py-3 text-[12px] text-muted">
              Enrolment calls go out in the Sunbird API contract that iGOT Karmayogi runs on — the same request
              and response shapes, so moving from the fixture client to a production iGOT instance is a base
              URL and an API key. Estimated effort is {hours(totalHours)} across {steps.length} steps.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
