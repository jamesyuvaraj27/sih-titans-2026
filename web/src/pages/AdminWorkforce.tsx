import { useMemo, useState } from 'react';
import { AlertTriangle, EyeOff } from 'lucide-react';
import { api, type WorkforceView } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DOMAIN_NAME, levelLabel, num, pct } from '../lib/format.js';
import { Alert, Badge, Card, CardHeader, Select, Spinner, Td, Th } from '../components/ui.js';
import { ChartFrame } from '../components/ChartFrame.js';

const PROF_VAR = ['--prof-0', '--prof-1', '--prof-2', '--prof-3', '--prof-4'];

/**
 * The heatmap is a CSS grid of buttons, not a charting-library heatmap.
 * A library heatmap at 49 × 40 is neither keyboard navigable nor screen-reader
 * legible, and it is slower. A grid of real elements is both, and it sorts.
 */
export function AdminWorkforce() {
  const { data, loading, error } = useAsync<WorkforceView>(() => api('/admin/workforce'));
  const [domain, setDomain] = useState('ALL');

  const competencies = useMemo(() => {
    if (!data) return [];
    const withData = new Set(data.cells.map((c) => c.competencyId));
    return data.competencies
      .filter((c) => withData.has(c.id))
      .filter((c) => domain === 'ALL' || c.domain === domain);
  }, [data, domain]);

  const cellIndex = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data?.cells ?? []) m.set(`${c.officialId}|${c.competencyId}`, c.level);
    return m;
  }, [data]);

  if (loading && !data) return <Spinner label="Computing the workforce view" />;
  if (error) return <Alert tone="critical" title="Could not load the workforce view">{error}</Alert>;
  if (!data) return null;

  const visible = data.coverage.filter((c) => !c.suppressed);
  const suppressed = data.coverage.filter((c) => c.suppressed).length;
  const weakest = visible.slice(0, 8);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">Workforce competency</h1>
          <p className="mt-1 max-w-3xl text-[14px] text-muted">
            Coverage is measured against role requirements, not against the whole ontology. “62% of the
            officials whose role requires SQL at L2 actually have it” is actionable; an average score is not.
          </p>
        </div>
        <div>
          <label className="sr-only" htmlFor="domain">Filter by domain</label>
          <Select id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} className="min-h-[36px] w-auto text-[13px]">
            <option value="ALL">All domains</option>
            {Object.entries(DOMAIN_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Officials in scope</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{num(data.totalOfficials)}</p>
          <p className="mt-1 text-[12px] text-muted">{data.departmentId ? `scoped to ${data.departmentId}` : 'all departments'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Weakest coverage</p>
          <p className="mt-1 truncate text-[17px] font-semibold text-critical">{weakest[0]?.nameEn ?? '—'}</p>
          <p className="mt-1 text-[12px] text-muted">
            {weakest[0] ? `${pct(weakest[0].coveragePct)} of ${weakest[0].required} officials who need it` : ''}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Competencies below 50%</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-moderate">
            {visible.filter((c) => c.coveragePct < 50).length}
          </p>
          <p className="mt-1 text-[12px] text-muted">of {visible.length} with a role requirement</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Succession risk</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{data.succession.length}</p>
          <p className="mt-1 text-[12px] text-muted">competencies where a capable holder retires within 3 years</p>
        </Card>
      </div>

      <ChartFrame
        title="Competency coverage against role requirements"
        insight={
          weakest[0]
            ? `${visible.filter((c) => c.coveragePct < 50).length} of ${visible.length} competencies with a role requirement are held by fewer than half the officials who need them. Weakest is ${weakest[0].nameEn} at ${pct(weakest[0].coveragePct)} of ${weakest[0].required} officials.`
            : 'No role requirements are mapped in this scope.'
        }
        minHeight={320}
        chart={
          <ul className="space-y-2">
            {weakest.map((c) => (
              <li key={c.competencyId}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate text-ink">{c.nameEn}</span>
                  <span className="tnum shrink-0 text-muted">
                    {c.atOrAbove}/{c.required} · {pct(c.coveragePct)}
                  </span>
                </div>
                <div className="mt-1 h-2.5 w-full overflow-hidden rounded bg-surface">
                  <div
                    className="h-full rounded bg-primary"
                    style={{
                      width: `${Math.max(2, c.coveragePct)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        }
        table={
          <table className="w-full border-collapse">
            <caption className="sr-only">Competency coverage: officials meeting the role target, out of those whose role requires it</caption>
            <thead>
              <tr><Th>Competency</Th><Th>Domain</Th><Th align="center">Target</Th><Th align="right">Meeting target</Th><Th align="right">Required by</Th><Th align="right">Coverage</Th></tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.competencyId}>
                  <Td>{c.nameEn}</Td>
                  <Td>{DOMAIN_NAME[c.domain] ?? c.domain}</Td>
                  <Td align="center">L{c.targetLevel}</Td>
                  <Td align="right">{c.atOrAbove}</Td>
                  <Td align="right">{c.required}</Td>
                  <Td align="right">{pct(c.coveragePct)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />

      {suppressed > 0 && (
        <Alert tone="info" title="Some cells are suppressed">
          <span className="inline-flex items-center gap-1.5">
            <EyeOff size={13} aria-hidden="true" />
            {suppressed} competencies are required by fewer than 5 officials in this scope and are suppressed,
            so an aggregate view cannot be used to identify an individual.
          </span>
        </Alert>
      )}

      {data.succession.length > 0 && (
        <Card>
          <CardHeader
            title="Succession risk"
            subtitle="Competencies held at L2 or above by people who reach superannuation within three years."
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">Succession risk by competency</caption>
              <thead><tr><Th>Competency</Th><Th align="right">Capable holders</Th><Th align="right">Retiring within 3 years</Th><Th align="right">Share at risk</Th></tr></thead>
              <tbody>
                {data.succession.slice(0, 10).map((s) => (
                  <tr key={s.competencyId}>
                    <Td>{s.nameEn}</Td>
                    <Td align="right">{s.holders}</Td>
                    <Td align="right">{s.retiringWithin3Years}</Td>
                    <Td align="right">
                      <span className="inline-flex items-center gap-1.5">
                        {pct((s.retiringWithin3Years / s.holders) * 100)}
                        {s.retiringWithin3Years / s.holders >= 0.5 && (
                          <Badge tone="critical" icon={<AlertTriangle size={11} aria-hidden="true" />}>at risk</Badge>
                        )}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="min-w-0 overflow-hidden">
        <CardHeader
          title="Officials × competencies"
          subtitle={`${data.officials.length} officials × ${competencies.length} competencies. Colour carries the level, and so does the cell's accessible name — never colour alone.`}
        />
        <div className="w-full overflow-auto p-4" style={{ maxHeight: 520 }}>
          <table className="border-collapse">
            <caption className="sr-only">Heatmap of competency level per official. Each cell states the level.</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 border-b border-border bg-raised px-2 py-1 text-left text-[11px] font-semibold uppercase text-subtle">
                  Official
                </th>
                {competencies.map((c) => (
                  <th key={c.id} scope="col" className="border-b border-border px-0.5 py-1 align-bottom">
                    <span className="block h-[110px] w-5 whitespace-nowrap text-[11px] text-subtle"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                      {c.nameEn}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.officials.map((o) => (
                <tr key={o.id}>
                  <th scope="row" className="sticky left-0 z-10 max-w-[190px] truncate border-b border-border bg-raised px-2 py-1 text-left text-[12px] font-normal text-ink">
                    {o.nameEn}
                    <span className="block truncate text-[10px] text-subtle">{o.designation}</span>
                  </th>
                  {competencies.map((c) => {
                    const lvl = cellIndex.get(`${o.id}|${c.id}`) ?? 0;
                    return (
                      <td key={c.id} className="border border-border p-0">
                        <span
                          title={`${o.nameEn} — ${c.nameEn}: ${levelLabel(lvl)}`}
                          className="relative block h-5 w-5 text-center text-[9px] leading-5"
                          style={{
                            background: `var(${PROF_VAR[Math.max(0, Math.min(4, lvl))]})`,
                            color: lvl >= 3 ? '#fff' : 'var(--text-muted)',
                          }}
                        >
                          <span aria-hidden="true">{lvl || ''}</span>
                          <span className="sr-only">{o.nameEn}, {c.nameEn}: {levelLabel(lvl)}</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5 text-[12px] text-muted">
          <span>Level scale:</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm border border-border-strong"
                style={{ background: `var(${PROF_VAR[l]})` }} />
              {levelLabel(l)}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
