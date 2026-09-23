import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Profile } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { DOMAIN_NAME, levelLabel } from '../lib/format.js';
import { Alert, Card, CardHeader, Select, Spinner, Td, Th } from '../components/ui.js';
import { ChartFrame } from '../components/ChartFrame.js';

interface GraphData {
  nodes: { id: string; nameEn: string; domain: string; area: string; estHours: number }[];
  edges: { fromId: string; toId: string; kind: string; weight: number }[];
}

const PROF_VAR = ['--prof-0', '--prof-1', '--prof-2', '--prof-3', '--prof-4'];

const COL_W = 210;
const ROW_H = 46;

/**
 * Prerequisite DAG, laid out by longest-path depth. Rendered as SVG rather than
 * pulled in from a graph library: at this node count a layered layout is thirty
 * lines of code, and hand-rolling it means every node is a real, focusable link
 * with an accessible name — which a canvas-based graph library would not give.
 */
export function Graph() {
  const { data, loading, error } = useAsync<GraphData>(() => api('/ontology/graph'));
  const { data: profile } = useAsync<Profile>(() => api('/officials/me/profile'));
  const [domain, setDomain] = useState('STAT');

  const levelOf = useMemo(
    () => new Map((profile?.competencies ?? []).map((c) => [c.competencyId, c.level])),
    [profile],
  );

  const layout = useMemo(() => {
    if (!data) return null;
    const nodes = data.nodes.filter((n) => n.domain === domain);
    const ids = new Set(nodes.map((n) => n.id));
    const edges = data.edges.filter((e) => e.kind === 'REQUIRES' && ids.has(e.fromId) && ids.has(e.toId));

    // longest-path depth, iterated to a fixed point (the graph is small and acyclic)
    const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    for (let pass = 0; pass < nodes.length; pass++) {
      let changed = false;
      for (const e of edges) {
        const want = (depth.get(e.fromId) ?? 0) + 1;
        if (want > (depth.get(e.toId) ?? 0)) { depth.set(e.toId, want); changed = true; }
      }
      if (!changed) break;
    }

    const columns = new Map<number, string[]>();
    for (const n of [...nodes].sort((a, b) => a.nameEn.localeCompare(b.nameEn))) {
      const d = depth.get(n.id) ?? 0;
      if (!columns.has(d)) columns.set(d, []);
      columns.get(d)!.push(n.id);
    }

    const pos = new Map<string, { x: number; y: number }>();
    for (const [d, col] of columns) {
      col.forEach((id, i) => pos.set(id, { x: 20 + d * COL_W, y: 26 + i * ROW_H }));
    }

    const width = 40 + (Math.max(...columns.keys()) + 1) * COL_W;
    const height = 52 + Math.max(...[...columns.values()].map((c) => c.length)) * ROW_H;
    return { nodes, edges, pos, width, height, maxDepth: Math.max(...columns.keys()) };
  }, [data, domain]);

  if (loading && !data) return <Spinner label="Loading the competency map" />;
  if (error) return <Alert tone="critical" title="Could not load the competency map">{error}</Alert>;
  if (!data || !layout) return null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">Competency map</h1>
          <p className="mt-1 max-w-3xl text-[14px] text-muted">
            Arrows run from a prerequisite to what it unlocks. This graph is what orders your learning path
            and what propagates a gap: if you lack Sampling Fundamentals, everything downstream of it is
            unreachable regardless of how many courses you complete.
          </p>
        </div>
        <div>
          <label className="sr-only" htmlFor="graph-domain">Domain</label>
          <Select id="graph-domain" value={domain} onChange={(e) => setDomain(e.target.value)} className="min-h-[36px] w-auto text-[13px]">
            {Object.entries(DOMAIN_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      </header>

      <ChartFrame
        title={`${DOMAIN_NAME[domain]} prerequisite graph`}
        insight={`${layout.nodes.length} competencies in ${layout.maxDepth + 1} prerequisite layers, ${layout.edges.length} dependencies. Node fill shows your current level.`}
        minHeight={layout.height + 8}
        chart={
          <div className="overflow-x-auto">
            <svg width={layout.width} height={layout.height} role="presentation" className="max-w-none">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" />
                </marker>
              </defs>
              {layout.edges.map((e) => {
                const a = layout.pos.get(e.fromId); const b = layout.pos.get(e.toId);
                if (!a || !b) return null;
                const x1 = a.x + COL_W - 66; const y1 = a.y + 11;
                const x2 = b.x - 4; const y2 = b.y + 11;
                const mid = (x1 + x2) / 2;
                return (
                  <path
                    key={`${e.fromId}-${e.toId}`}
                    d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                    fill="none" stroke="var(--border-strong)" strokeWidth={1.2} markerEnd="url(#arrow)"
                  />
                );
              })}
              {layout.nodes.map((n) => {
                const p = layout.pos.get(n.id);
                if (!p) return null;
                const lvl = levelOf.get(n.id) ?? 0;
                return (
                  <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
                    <a href={`/competency/${n.id}`} aria-label={`${n.nameEn}, your level: ${levelLabel(lvl)}`}>
                      <rect
                        width={COL_W - 70} height={22} rx={4}
                        fill={`var(${PROF_VAR[Math.max(0, Math.min(4, lvl))]})`}
                        stroke="var(--border-strong)" strokeWidth={1}
                      />
                      <text
                        x={8} y={15} fontSize={11}
                        fill={lvl >= 3 ? '#fff' : 'var(--text)'}
                      >
                        {n.nameEn.length > 24 ? `${n.nameEn.slice(0, 23)}…` : n.nameEn}
                      </text>
                    </a>
                  </g>
                );
              })}
            </svg>
          </div>
        }
        table={
          <table className="w-full border-collapse">
            <caption className="sr-only">Competencies in this domain with their prerequisites and your current level</caption>
            <thead><tr><Th>Competency</Th><Th>Area</Th><Th>Requires</Th><Th align="right">Your level</Th></tr></thead>
            <tbody>
              {layout.nodes.map((n) => (
                <tr key={n.id}>
                  <Td><Link to={`/competency/${n.id}`} className="font-medium text-primary hover:underline">{n.nameEn}</Link></Td>
                  <Td className="text-muted">{n.area}</Td>
                  <Td className="text-muted">
                    {layout.edges.filter((e) => e.toId === n.id)
                      .map((e) => layout.nodes.find((x) => x.id === e.fromId)?.nameEn ?? e.fromId)
                      .join(', ') || '—'}
                  </Td>
                  <Td align="right">{levelLabel(levelOf.get(n.id) ?? 0)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />

      <Card>
        <CardHeader title="How the graph is used" />
        <ul className="space-y-2 p-4 text-[13px] leading-relaxed text-muted">
          <li><span className="font-medium text-ink">Prerequisite closure.</span> A single recursive query walks REQUIRES edges backwards from your targets and keeps only what you do not already hold.</li>
          <li><span className="font-medium text-ink">Ordering.</span> The induced subgraph is topologically sorted, with ties broken by severity, then quickest win, then how many other competencies the step unblocks.</li>
          <li><span className="font-medium text-ink">Evidence propagation.</span> SUBSUMES edges let mastery of an advanced competency count partially towards the simpler one it contains; ADJACENT edges let a related skill transfer at a stated weight. Both appear as the relevance column in the evidence ledger.</li>
          <li><span className="font-medium text-ink">Why PostgreSQL, not a graph database.</span> Around 60 nodes and 79 edges. A recursive CTE resolves this in single-digit milliseconds. A second database would add a deployment, a backup story and a security review for no measurable gain — that changes at roughly a million nodes with six-hop traversal.</li>
        </ul>
      </Card>
    </div>
  );
}
