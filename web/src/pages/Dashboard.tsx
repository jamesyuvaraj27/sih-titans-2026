import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Legend, Tooltip,
} from 'recharts';
import { ArrowRight, History, RotateCcw } from 'lucide-react';
import { api, type Gap, type Profile } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DOMAIN_NAME, fmtDate, num } from '../lib/format.js';
import { Alert, Button, Card, CardHeader, EmptyState, Spinner, Td, Th } from '../components/ui.js';
import { ChartFrame } from '../components/ChartFrame.js';
import { CompetencyRow, GapSeverityChip } from '../components/competency.js';

/**
 * The time-travel control. It is not a gimmick: `asOf` is already a parameter
 * of the scoring function, so rewinding the entire dashboard costs one query
 * string. It is the clearest possible demonstration that scores are computed
 * from dated evidence rather than stored.
 */
function TimeTravel({ months, onChange }: { months: number; onChange: (m: number) => void }) {
  const asOf = new Date(Date.now() - months * 30.44 * 86400_000);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="asof" className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        <History size={15} aria-hidden="true" />
        Score as of
      </label>
      <input
        id="asof"
        type="range"
        min={0}
        max={48}
        step={1}
        value={months}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-56 cursor-pointer accent-[color:var(--primary)]"
        aria-valuetext={months === 0 ? 'today' : `${months} months ago, ${fmtDate(asOf)}`}
      />
      <span className="tnum text-[13px] font-medium text-ink">
        {months === 0 ? 'Today' : `${fmtDate(asOf)} · ${months} months ago`}
      </span>
      {months > 0 && (
        <Button size="sm" variant="ghost" onClick={() => onChange(0)}>
          <RotateCcw size={14} aria-hidden="true" />Back to today
        </Button>
      )}
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [months, setMonths] = useState(0);
  const qs = months === 0 ? '' : `?asOf=${encodeURIComponent(new Date(Date.now() - months * 30.44 * 86400_000).toISOString())}`;

  const { data: profile, loading, error } = useAsync<Profile>(() => api(`/officials/me/profile${qs}`), [qs]);
  const { data: gaps } = useAsync<Gap[]>(() => api(`/officials/me/gaps${qs}`), [qs]);

  const radar = useMemo(() => (profile?.domains ?? []).map((d) => ({
    domain: DOMAIN_NAME[d.domain]?.split(' ')[0] ?? d.domain,
    current: Number(d.currentMean.toFixed(2)),
    target: Number(d.targetMean.toFixed(2)),
  })), [profile]);

  const required = useMemo(
    () => (profile?.competencies ?? []).filter((c) => c.required).sort((a, b) => a.domain.localeCompare(b.domain) || b.score - a.score),
    [profile],
  );

  if (loading && !profile) return <Spinner label="Computing your competency profile" />;
  if (error) return <Alert tone="critical" title="Could not load your profile">{error}</Alert>;
  if (!profile) return null;

  const met = profile.domains.reduce((a, d) => a + d.metCount, 0);
  const total = profile.domains.reduce((a, d) => a + d.requiredCount, 0);
  const critical = (gaps ?? []).filter((g) => g.severityBand === 'CRITICAL');

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">
            {profile.official.nameEn}
            {profile.official.nameHi && <span lang="hi" className="ml-2 text-[16px] font-medium text-muted">{profile.official.nameHi}</span>}
          </h1>
          <p className="text-[13px] text-muted">
            {profile.official.designation} · {profile.official.department} · role profile{' '}
            <span className="font-medium text-ink">{profile.official.roleProfile.titleEn}</span>
          </p>
        </div>
        <TimeTravel months={months} onChange={setMonths} />
      </header>

      {months > 0 && (
        <Alert tone="warning" title={`Viewing your record as it stood on ${fmtDate(profile.asOf)}`}>
          Nothing has been changed. Every score on this page has been recomputed from the evidence that
          existed on that date, with time decay applied to that date — which is what an auditor would do.
        </Alert>
      )}

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Role requirements met</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{met}<span className="text-[16px] font-medium text-subtle"> / {total}</span></p>
          <p className="mt-1 text-[12px] text-muted">competencies at or above the level your role requires</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Critical gaps</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-critical">{critical.length}</p>
          <p className="mt-1 text-[12px] text-muted">gap × criticality × urgency ≥ 6</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Evidence on file</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{num(profile.evidenceTotal)}</p>
          <p className="mt-1 text-[12px] text-muted">dated records behind every score on this page</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Next action</p>
          {critical[0] ? (
            <>
              <p className="mt-1 truncate text-[16px] font-semibold text-ink">{critical[0].nameEn}</p>
              <Link to="/path" className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                Open your learning path <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <p className="mt-1 text-[13px] text-muted">No critical gaps. Keep evidence current.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <ChartFrame
          title="Competency profile by domain"
          insight={
            radar.length
              ? `Your four domains average L${num(radar.reduce((a, r) => a + r.current, 0) / radar.length, 1)} against a role target of L${num(radar.reduce((a, r) => a + r.target, 0) / radar.length, 1)}. The widest gap is ${[...radar].sort((a, b) => (b.target - b.current) - (a.target - a.current))[0]?.domain}.`
              : 'No role requirements are mapped yet.'
          }
          chart={
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="domain" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 4]} tickCount={5} tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} />
                <Radar name="Role target" dataKey="target" stroke="var(--text-subtle)" fill="var(--text-subtle)" fillOpacity={0.12} strokeDasharray="4 3" />
                <Radar name="Current level" dataKey="current" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.32} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--text)' }}
                  formatter={(v: any, n: any) => [`L${Number(v).toFixed(2)}`, n]}
                />
              </RadarChart>
            </ResponsiveContainer>
          }
          table={
            <table className="w-full border-collapse">
              <caption className="sr-only">Mean current level against mean role target, by competency domain</caption>
              <thead><tr><Th>Domain</Th><Th align="right">Current (mean level)</Th><Th align="right">Target</Th><Th align="right">Met</Th></tr></thead>
              <tbody>
                {(profile.domains ?? []).map((d) => (
                  <tr key={d.domain}>
                    <Td>{DOMAIN_NAME[d.domain] ?? d.domain}</Td>
                    <Td align="right">L{num(d.currentMean, 2)}</Td>
                    <Td align="right">L{num(d.targetMean, 2)}</Td>
                    <Td align="right">{d.metCount} / {d.requiredCount}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        />

        <Card>
          <CardHeader
            title="Most severe gaps"
            subtitle="Ranked by gap × criticality × urgency. Every ranking factor is shown, none is inferred."
            action={<Button size="sm" variant="secondary" onClick={() => navigate('/gaps')}>All gaps</Button>}
          />
          {(gaps ?? []).length === 0 ? (
            <EmptyState title="No gaps against your role profile">
              Every competency your role requires is evidenced at or above its target level.
            </EmptyState>
          ) : (
            <ul>
              {(gaps ?? []).slice(0, 6).map((g) => (
                <li key={g.competencyId}>
                  <Link
                    to={`/competency/${g.competencyId}`}
                    className="flex items-start gap-3 border-b border-border px-4 py-3 hover:bg-surface"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-medium text-ink">{g.nameEn}</span>
                        <GapSeverityChip band={g.severityBand} />
                      </span>
                      <span className="mt-0.5 block text-[12px] text-muted">
                        L{g.currentLevel} → L{g.targetLevel} · {g.rationale}
                      </span>
                      {g.urgencyReason.map((r) => (
                        <span key={r} className="mt-1 block text-[12px] font-medium text-moderate">{r}</span>
                      ))}
                    </span>
                    <span className="tnum shrink-0 text-right text-[13px] text-subtle">
                      severity<br /><span className="text-[15px] font-semibold text-ink">{num(g.severity, 1)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Competencies required by your role"
          subtitle={`${required.length} competencies mapped to ${profile.official.roleProfile.titleEn}. Select one to see the evidence behind its score.`}
        />
        <div className="grid md:grid-cols-2">
          {required.map((c) => (
            <CompetencyRow
              key={c.competencyId}
              nameEn={c.nameEn}
              area={`${DOMAIN_NAME[c.domain] ?? c.domain} · ${c.area}`}
              level={c.level}
              target={c.targetLevel}
              score={c.score}
              confidence={c.confidence}
              onClick={() => navigate(`/competency/${c.competencyId}`)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
