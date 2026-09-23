import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ExternalLink, History, Lock, Unlock } from 'lucide-react';
import { api, post, type CompetencyDetail as Detail } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DOMAIN_NAME, fmtDate, levelLabel, mins, num } from '../lib/format.js';
import { Alert, Badge, Button, Card, CardHeader, Spinner, Td, Th } from '../components/ui.js';
import { EvidenceLedgerTable, LevelBadge, ScoreWithConfidence } from '../components/competency.js';

export function CompetencyDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [months, setMonths] = useState(0);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const qs = months === 0 ? '' : `?asOf=${encodeURIComponent(new Date(Date.now() - months * 30.44 * 86400_000).toISOString())}`;
  const { data, loading, error } = useAsync<Detail>(() => api(`/officials/me/competency/${id}${qs}`), [id, qs]);

  async function startDiagnostic() {
    setStarting(true);
    setErr(null);
    try {
      const session = await post('/quiz/start', { competencyIds: [id], count: 5 });
      navigate('/assess', { state: { session } });
    } catch (e: any) {
      setErr(e?.message ?? 'Could not start a diagnostic');
    } finally {
      setStarting(false);
    }
  }

  if (loading && !data) return <Spinner label="Replaying the evidence ledger" />;
  if (error) return <Alert tone="critical" title="Could not load this competency">{error}</Alert>;
  if (!data) return null;

  const { competency: c, score, requirement, ledger } = data;
  const anchors = c.levelAnchors ?? {};

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-[13px]">
        <ol className="flex flex-wrap items-center gap-1.5 text-muted">
          <li><Link to="/" className="hover:text-ink hover:underline">Dashboard</Link></li>
          <li aria-hidden="true">/</li>
          <li>{DOMAIN_NAME[c.domain] ?? c.domain}</li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-ink">{c.nameEn}</li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button size="sm" variant="ghost" onClick={() => navigate(-1)} className="mb-1 -ml-2">
            <ArrowLeft size={14} aria-hidden="true" />Back
          </Button>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">
            {c.nameEn}
            {c.nameHi && <span lang="hi" className="ml-2 text-[16px] font-medium text-muted">{c.nameHi}</span>}
          </h1>
          <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-muted">{c.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{DOMAIN_NAME[c.domain] ?? c.domain} · {c.area}</Badge>
            <Badge tone="neutral" title="Half-life used for time decay of evidence on this competency">
              decay half-life {c.decayHalfLifeMonths} months
            </Badge>
            {c.gsbpmPhases.length > 0 && (
              <Badge tone="primary" title="UNECE Generic Statistical Business Process Model sub-processes">
                GSBPM {c.gsbpmPhases.join(', ')}
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={startDiagnostic} loading={starting}>Take a diagnostic</Button>
      </div>

      {err && <Alert tone="critical" title="Could not start a diagnostic">{err}</Alert>}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Current score</p>
            <div className="mt-2">
              <ScoreWithConfidence
                score={score.score} level={score.level}
                confidence={score.confidence} target={requirement?.targetLevel ?? null}
              />
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <label htmlFor="detail-asof" className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
                <History size={14} aria-hidden="true" />Replay as of
              </label>
              <input
                id="detail-asof" type="range" min={0} max={48} value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="mt-1.5 h-2 w-full cursor-pointer accent-[color:var(--primary)]"
                aria-valuetext={months === 0 ? 'today' : `${months} months ago`}
              />
              <p className="tnum mt-1 text-[12px] text-muted">
                {months === 0 ? 'Today' : `${fmtDate(data.asOf)} — ${months} months ago`}
              </p>
            </div>
          </Card>

          {requirement && (
            <Card className="p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Why your role needs this</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{requirement.rationale}</p>
              <p className="mt-2 text-[12px] text-muted">
                Target <span className="font-semibold text-ink">L{requirement.targetLevel}</span> ·
                criticality <span className="font-semibold text-ink">{requirement.criticality}/3</span>
              </p>
            </Card>
          )}

          <Card>
            <CardHeader title="Proficiency ladder" subtitle="Behavioural anchors, not adjectives" />
            <ol className="p-2">
              {[1, 2, 3, 4].map((l) => (
                <li
                  key={l}
                  className={`rounded p-2 ${score.level === l ? 'bg-primary-soft' : ''}`}
                  aria-current={score.level === l ? 'step' : undefined}
                >
                  <p className="text-[12px] font-semibold text-ink">
                    {levelLabel(l)}{score.level === l && <span className="ml-1.5 text-primary">· you are here</span>}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{anchors[`L${l}`]}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Evidence ledger"
              subtitle={`${ledger.length} dated records. This table is the entire justification for the score — check the arithmetic.`}
            />
            <EvidenceLedgerTable ledger={ledger} score={score.score} />
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Prerequisites" subtitle="Must be held before this competency can be reached" />
              {data.prerequisites.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-muted">None — this is a foundation competency.</p>
              ) : (
                <ul className="p-2">
                  {data.prerequisites.map((p) => (
                    <li key={p.id}>
                      <Link to={`/competency/${p.id}`} className="flex items-center gap-2 rounded px-2 py-2 hover:bg-surface">
                        {p.currentLevel >= p.minLevel
                          ? <Unlock size={14} className="shrink-0 text-success" aria-label="Satisfied" />
                          : <Lock size={14} className="shrink-0 text-moderate" aria-label="Not yet satisfied" />}
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.nameEn}</span>
                        <span className="shrink-0 text-[12px] text-subtle">needs L{p.minLevel} · you L{p.currentLevel}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Related competencies" subtitle="Transferable skill, weighted — evidence here partly counts there" />
              {data.adjacent.length === 0 && data.unlocks.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-muted">No adjacency recorded.</p>
              ) : (
                <ul className="p-2">
                  {data.adjacent.map((a) => (
                    <li key={a.id}>
                      <Link to={`/competency/${a.id}`} className="flex items-center gap-2 rounded px-2 py-2 hover:bg-surface">
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{a.nameEn}</span>
                        <Badge tone="neutral">{num(a.weight * 100)}% transfer</Badge>
                      </Link>
                    </li>
                  ))}
                  {data.unlocks.map((u) => (
                    <li key={u.id}>
                      <Link to={`/competency/${u.id}`} className="flex items-center gap-2 rounded px-2 py-2 hover:bg-surface">
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{u.nameEn}</span>
                        <Badge tone="primary">unlocked by this</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Training that builds this competency"
              subtitle="Retrieved through the iGOT client. Course records follow the Sunbird content contract."
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <caption className="sr-only">Courses mapped to this competency, with provider, duration and observed completion rate</caption>
                <thead>
                  <tr><Th>Course</Th><Th>Provider</Th><Th align="right">Duration</Th><Th align="right">Completion rate</Th><Th /></tr>
                </thead>
                <tbody>
                  {data.courses.map((course) => (
                    <tr key={course.id}>
                      <Td>
                        <span className="flex items-center gap-1.5">
                          <BookOpen size={13} className="shrink-0 text-subtle" aria-hidden="true" />
                          {course.name}
                        </span>
                        {course.tpacFlagged && <Badge tone="primary">TPAC recommended</Badge>}
                      </Td>
                      <Td><Badge tone="neutral">{course.provider}</Badge></Td>
                      <Td align="right">{mins(course.durationMins)}</Td>
                      <Td align="right">{num(course.completionRate * 100)}%</Td>
                      <Td align="right">
                        {course.url && (
                          <a href={course.url} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                            Open <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        )}
                      </Td>
                    </tr>
                  ))}
                  {data.courses.length === 0 && (
                    <tr><Td className="text-muted">No course in the catalogue is tagged to this competency yet — this is exactly the curriculum gap an administrator wants to see.</Td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <p className="pb-2 text-[12px] text-subtle">
        <LevelBadge level={score.level} /> · computed from {score.evidenceCount} evidence records at{' '}
        {fmtDate(data.asOf)}. No language model contributed to this score.
      </p>
    </div>
  );
}
