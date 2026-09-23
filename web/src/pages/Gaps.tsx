import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Gap } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DOMAIN_NAME, hours, num } from '../lib/format.js';
import { Alert, Card, CardHeader, EmptyState, Select, Spinner, Td, Th } from '../components/ui.js';
import { GapSeverityChip } from '../components/competency.js';

type SortKey = 'severity' | 'gap' | 'estHours' | 'nameEn';

export function Gaps() {
  const { data, loading, error } = useAsync<Gap[]>(() => api('/officials/me/gaps'));
  const [domain, setDomain] = useState('ALL');
  const [band, setBand] = useState('ALL');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'severity', dir: 'desc' });

  const rows = useMemo(() => {
    let r = data ?? [];
    if (domain !== 'ALL') r = r.filter((g) => g.domain === domain);
    if (band !== 'ALL') r = r.filter((g) => g.severityBand === band);
    return [...r].sort((a, b) => {
      const k = sort.key;
      const va = a[k]; const vb = b[k];
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [data, domain, band, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const sortOf = (key: SortKey) => (sort.key === key ? sort.dir : null);

  if (loading && !data) return <Spinner label="Comparing your record against your role profile" />;
  if (error) return <Alert tone="critical" title="Could not load gap analysis">{error}</Alert>;

  const totalHours = rows.reduce((a, g) => a + g.estHours, 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-ink">Skill gaps</h1>
        <p className="mt-1 max-w-3xl text-[14px] text-muted">
          A gap is the distance between the level your role profile requires and the level your evidence
          supports. Severity is <span className="tnum font-medium text-ink">gap × criticality × urgency</span> —
          arithmetic, not a model, so you can argue with the ranking.
        </p>
      </header>

      <Card>
        <CardHeader
          title={`${rows.length} open gaps · about ${hours(totalHours)} of learning`}
          subtitle="Urgency rises when a survey or activity in the next 90 days needs the competency."
          action={
            <div className="flex w-full flex-wrap gap-2">
              <label className="sr-only" htmlFor="domain-filter">Filter by domain</label>
              <Select id="domain-filter" value={domain} onChange={(e) => setDomain(e.target.value)} className="min-h-[36px] flex-1 text-[13px] sm:w-auto sm:flex-none">
                <option value="ALL">All domains</option>
                {Object.entries(DOMAIN_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <label className="sr-only" htmlFor="band-filter">Filter by severity</label>
              <Select id="band-filter" value={band} onChange={(e) => setBand(e.target.value)} className="min-h-[36px] flex-1 text-[13px] sm:w-auto sm:flex-none">
                <option value="ALL">All severities</option>
                <option value="CRITICAL">Critical only</option>
                <option value="MODERATE">Moderate only</option>
                <option value="MINOR">Minor only</option>
              </Select>
            </div>
          }
        />

        {rows.length === 0 ? (
          <EmptyState title="No gaps match these filters">
            Try widening the domain or severity filter, or take a diagnostic to establish evidence where confidence is low.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">
                Open competency gaps against your role profile, sorted by {sort.key} {sort.dir === 'desc' ? 'descending' : 'ascending'}
              </caption>
              <thead>
                <tr>
                  <Th sort={sortOf('nameEn')} onSort={() => toggle('nameEn')}>Competency</Th>
                  <Th align="center">Current</Th>
                  <Th align="center">Target</Th>
                  <Th align="right" sort={sortOf('gap')} onSort={() => toggle('gap')}>Gap</Th>
                  <Th align="center">Criticality</Th>
                  <Th align="right">Urgency</Th>
                  <Th align="right" sort={sortOf('severity')} onSort={() => toggle('severity')}>Severity</Th>
                  <Th align="right" sort={sortOf('estHours')} onSort={() => toggle('estHours')}>Effort</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.competencyId} className="align-top">
                    <Td>
                      <Link to={`/competency/${g.competencyId}`} className="font-medium text-primary hover:underline">
                        {g.nameEn}
                      </Link>
                      <span className="mt-0.5 block text-[12px] text-muted">{g.rationale}</span>
                      {g.urgencyReason.map((r) => (
                        <span key={r} className="mt-1 block text-[12px] font-medium text-moderate">{r}</span>
                      ))}
                      {g.confidence < 0.4 && (
                        <span className="mt-1 block text-[12px] text-moderate">
                          Low confidence ({num(g.confidence * 100)}%) — a diagnostic would firm this up
                        </span>
                      )}
                    </Td>
                    <Td align="center">L{g.currentLevel}<span className="block text-[11px] text-subtle tnum">{num(g.currentScore, 0)}</span></Td>
                    <Td align="center">L{g.targetLevel}</Td>
                    <Td align="right">{g.gap}</Td>
                    <Td align="center">{g.criticality}/3</Td>
                    <Td align="right">×{num(g.urgency, 1)}</Td>
                    <Td align="right">
                      <span className="flex items-center justify-end gap-2">
                        <span className="font-semibold">{num(g.severity, 1)}</span>
                        <GapSeverityChip band={g.severityBand} />
                      </span>
                    </Td>
                    <Td align="right">{hours(g.estHours)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
