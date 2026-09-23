import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { fmtDate, mins, num, pct } from '../lib/format.js';
import { Alert, Badge, Card, CardHeader, Select, Spinner, Td, Th } from '../components/ui.js';
import { ChartFrame } from '../components/ChartFrame.js';

interface Effectiveness {
  courseId: string; name: string; provider: string; tpacFlagged: boolean;
  durationMins: number; completionRate: number; completions: number;
  meanQuality: number | null; liftPerHour: number | null;
  competencyIds: string[]; flag: string | null;
}

export function AdminEffectiveness() {
  const { data, loading, error } = useAsync<Effectiveness[]>(() => api('/admin/effectiveness'));
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const rows = useMemo(
    () => (data ?? []).filter((r) => (onlyFlagged ? !!r.flag : true)),
    [data, onlyFlagged],
  );

  if (loading && !data) return <Spinner label="Correlating completions with competency lift" />;
  if (error) return <Alert tone="critical" title="Could not load training effectiveness">{error}</Alert>;

  const flagged = (data ?? []).filter((r) => r.flag === 'HIGH_COMPLETION_LOW_LIFT');
  const withData = (data ?? []).filter((r) => r.meanQuality !== null);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-ink">Training effectiveness</h1>
        <p className="mt-1 max-w-3xl text-[14px] text-muted">
          Completion rate is not effectiveness. The interesting course is the one everybody finishes that
          produces no measurable capability — that is where a training budget disappears.
        </p>
      </header>

      {flagged.length > 0 && (
        <Alert tone="warning" title={`${flagged.length} course${flagged.length === 1 ? '' : 's'} show high completion but low competency lift`}>
          {flagged.slice(0, 3).map((f) => f.name).join('; ')}
          {flagged.length > 3 ? ` and ${flagged.length - 3} more.` : '.'} Worth a content review before the next cycle.
        </Alert>
      )}

      <ChartFrame
        title="Completion rate against measured lift"
        insight={
          withData.length
            ? `${withData.length} courses have completion evidence. ${flagged.length} of them combine a completion rate above 70% with a mean quality below 0.62 — high attendance, low capability.`
            : 'No completion evidence recorded yet.'
        }
        minHeight={300}
        action={
          <>
            <label className="sr-only" htmlFor="flagged">Filter</label>
            <Select id="flagged" value={onlyFlagged ? 'flagged' : 'all'} onChange={(e) => setOnlyFlagged(e.target.value === 'flagged')}
              className="min-h-[36px] w-auto text-[13px]">
              <option value="all">All courses</option>
              <option value="flagged">Flagged only</option>
            </Select>
          </>
        }
        chart={
          <ul className="space-y-2">
            {rows.slice(0, 12).map((r) => (
              <li key={r.courseId}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate text-ink">{r.name}</span>
                  <span className="tnum shrink-0 text-muted">
                    {pct(r.completionRate * 100)} completed
                    {r.meanQuality !== null && ` · quality ${num(r.meanQuality, 2)}`}
                  </span>
                </div>
                <div className="mt-1 flex gap-1">
                  <div className="h-2.5 flex-1 overflow-hidden rounded bg-surface" title="Completion rate">
                    <div className="h-full rounded bg-primary" style={{ width: `${r.completionRate * 100}%` }} />
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded bg-surface" title="Mean evidence quality">
                    <div className="h-full rounded"
                      style={{
                        width: `${(r.meanQuality ?? 0) * 100}%`,
                        background: r.flag === 'HIGH_COMPLETION_LOW_LIFT' ? 'var(--critical)' : 'var(--minor)',
                      }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        }
        table={
          <table className="w-full border-collapse">
            <caption className="sr-only">Course completion rate, recorded completions, mean evidence quality and lift per hour</caption>
            <thead>
              <tr>
                <Th>Course</Th><Th>Provider</Th><Th align="right">Duration</Th>
                <Th align="right">Completion rate</Th><Th align="right">Records</Th>
                <Th align="right">Mean quality</Th><Th align="right">Lift / hour</Th><Th>Flag</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.courseId}>
                  <Td>{r.name}{r.tpacFlagged && <Badge tone="primary">TPAC</Badge>}</Td>
                  <Td>{r.provider}</Td>
                  <Td align="right">{mins(r.durationMins)}</Td>
                  <Td align="right">{pct(r.completionRate * 100)}</Td>
                  <Td align="right">{r.completions}</Td>
                  <Td align="right">{r.meanQuality === null ? '—' : num(r.meanQuality, 2)}</Td>
                  <Td align="right">{r.liftPerHour === null ? '—' : num(r.liftPerHour, 1)}</Td>
                  <Td>
                    {r.flag === 'HIGH_COMPLETION_LOW_LIFT' && (
                      <Badge tone="critical" icon={<AlertTriangle size={11} aria-hidden="true" />}>high completion, low lift</Badge>
                    )}
                    {r.flag === 'LOW_COMPLETION' && <Badge tone="moderate">low completion</Badge>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />
    </div>
  );
}

interface AuditRow {
  id: string; actorId: string | null; action: string;
  subjectType: string; subjectId: string; at: string; meta: Record<string, unknown>;
}

export function AdminAudit() {
  const { data, loading, error } = useAsync<AuditRow[]>(() => api('/audit'));
  if (loading && !data) return <Spinner label="Reading the audit log" />;
  if (error) return <Alert tone="critical" title="Could not read the audit log">{error}</Alert>;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-ink">Audit log</h1>
        <p className="mt-1 max-w-3xl text-[14px] text-muted">
          Every read of another official’s record, every generation run, every review decision and every
          assessment submission. Combined with the append-only evidence ledger, this is what makes a
          competency record defensible rather than merely plausible.
        </p>
      </header>

      <Alert tone="info" title="Prototype scope">
        Hash-chained tamper detection over these events is designed but not built — it is P2. What is built
        and enforced today is the append-only guarantee on the evidence ledger itself, in PostgreSQL: a
        <code className="mx-1">DELETE</code> or a substantive <code className="mx-1">UPDATE</code> on
        <code className="mx-1">Evidence</code> is refused by the database, not by application code.
      </Alert>

      <Card>
        <CardHeader title={`${(data ?? []).length} most recent events`} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">Recent audit events</caption>
            <thead><tr><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Subject</Th><Th>Detail</Th></tr></thead>
            <tbody>
              {(data ?? []).map((e) => (
                <tr key={e.id}>
                  <Td>{fmtDate(e.at)}<span className="block text-[11px] text-subtle tnum">{new Date(e.at).toLocaleTimeString('en-IN')}</span></Td>
                  <Td className="text-muted">{e.actorId ?? 'system'}</Td>
                  <Td><Badge tone="neutral">{e.action}</Badge></Td>
                  <Td className="text-muted">{e.subjectType} · {e.subjectId}</Td>
                  <Td className="max-w-[280px] truncate text-subtle">{JSON.stringify(e.meta)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
