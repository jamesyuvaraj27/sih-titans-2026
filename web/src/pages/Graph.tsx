import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Lock,
  Unlock,
  Compass,
  BookOpen,
  ExternalLink,
  Layers,
  ArrowRight,
  ArrowDown,
  ChevronRight,
  Route,
  ClipboardCheck,
} from 'lucide-react';
import {
  api,
  type SkillGraphData,
  type SkillGraphNode,
} from '../lib/api.js';
import { DOMAIN_NAME, levelLabel, hours, mins } from '../lib/format.js';
import { Alert, Badge, Button, Card, CardHeader, MetricCard, Spinner, Th, Td } from '../components/ui.js';

const COL_W = 260;
const ROW_H = 110;
const GAP_X = 80;
const GAP_Y = 24;

export function Graph() {
  const [data, setData] = useState<SkillGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState<string>('TECH');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'CANVAS' | 'STACKED'>('CANVAS');

  // Load skill graph with legitimate competency & learner data from backend
  const loadGraph = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api<SkillGraphData>('/officials/me/skill-graph');
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Could not load skill dependency graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  // Filter nodes and edges based on selected domain
  const { filteredNodes, filteredEdges, nodeMap } = useMemo(() => {
    if (!data) return { filteredNodes: [], filteredEdges: [], nodeMap: new Map<string, SkillGraphNode>() };

    const nodes = domain === 'ALL' ? data.nodes : data.nodes.filter((n) => n.domain === domain);
    const nMap = new Map(nodes.map((n) => [n.id, n]));
    const ids = new Set(nodes.map((n) => n.id));

    // Keep edges where both fromId and toId are in active nodes
    const edges = data.edges.filter(
      (e) => e.kind === 'REQUIRES' && ids.has(e.fromId) && ids.has(e.toId)
    );

    return { filteredNodes: nodes, filteredEdges: edges, nodeMap: nMap };
  }, [data, domain]);

  // Compute incoming and outgoing dependencies for each node
  const { incomingMap, outgoingMap } = useMemo(() => {
    const inc = new Map<string, string[]>();
    const out = new Map<string, string[]>();

    for (const n of filteredNodes) {
      inc.set(n.id, []);
      out.set(n.id, []);
    }

    for (const e of filteredEdges) {
      if (inc.has(e.toId)) inc.get(e.toId)!.push(e.fromId);
      if (out.has(e.fromId)) out.get(e.fromId)!.push(e.toId);
    }

    return { incomingMap: inc, outgoingMap: out };
  }, [filteredNodes, filteredEdges]);

  // DAG Longest-path Layer & Stage Calculation
  const layout = useMemo(() => {
    if (filteredNodes.length === 0) return null;

    // 1. Longest-path depth (topological layer)
    const depth = new Map<string, number>(filteredNodes.map((n) => [n.id, 0]));
    for (let pass = 0; pass < filteredNodes.length; pass++) {
      let changed = false;
      for (const e of filteredEdges) {
        const want = (depth.get(e.fromId) ?? 0) + 1;
        if (want > (depth.get(e.toId) ?? 0)) {
          depth.set(e.toId, want);
          changed = true;
        }
      }
      if (!changed) break;
    }

    // 2. Group nodes into stage columns by depth
    const maxDepth = Math.max(...depth.values(), 0);
    const columns = new Map<number, string[]>();
    for (let d = 0; d <= maxDepth; d++) {
      columns.set(d, []);
    }

    // Sort nodes within each column by name for determinism
    const sorted = [...filteredNodes].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
    for (const n of sorted) {
      const d = depth.get(n.id) ?? 0;
      columns.get(d)!.push(n.id);
    }

    // 3. Compute (x, y) coordinates for each node
    const pos = new Map<string, { x: number; y: number; col: number; row: number }>();
    const colWidth = COL_W;
    const rowHeight = ROW_H;

    for (const [d, colIds] of columns) {
      colIds.forEach((id, i) => {
        pos.set(id, {
          x: 32 + d * (colWidth + GAP_X),
          y: 72 + i * (rowHeight + GAP_Y),
          col: d,
          row: i,
        });
      });
    }

    const totalWidth = 64 + (maxDepth + 1) * (colWidth + GAP_X);
    const maxRows = Math.max(...Array.from(columns.values()).map((c) => c.length), 1);
    const totalHeight = 100 + maxRows * (rowHeight + GAP_Y);

    // 4. Compute Stage statistics
    const stages = Array.from(columns.entries()).map(([d, colIds]) => {
      const stageNodes = colIds.map((id) => nodeMap.get(id)!).filter(Boolean);
      const targetMetCount = stageNodes.filter(
        (n) => n.targetLevel !== null && n.currentLevel >= n.targetLevel
      ).length;
      const totalCount = stageNodes.length;
      const isCompleted = totalCount > 0 && targetMetCount === totalCount;
      const isInProgress = targetMetCount > 0 && !isCompleted;

      const stageLabels: Record<number, { title: string; subtitle: string }> = {
        0: { title: 'Foundational Prerequisites', subtitle: 'Entry skills & baseline toolkits' },
        1: { title: 'Core Methodology', subtitle: 'Intermediate analysis & workflows' },
        2: { title: 'Applied Techniques', subtitle: 'Practical estimation & frameworks' },
        3: { title: 'Specialized Systems', subtitle: 'Advanced modeling & infrastructure' },
        4: { title: 'Sectoral & Target Mastery', subtitle: 'Official releases & role targets' },
        5: { title: 'Mastery & Synthesis', subtitle: 'Expert peer review & standards' },
      };

      const meta = stageLabels[d] || {
        title: `Stage ${d + 1} Competencies`,
        subtitle: 'Downstream specialization',
      };

      return {
        stageNum: d + 1,
        depth: d,
        title: meta.title,
        subtitle: meta.subtitle,
        nodeIds: colIds,
        targetMetCount,
        totalCount,
        isCompleted,
        isInProgress,
        x: 32 + d * (colWidth + GAP_X),
        width: colWidth,
      };
    });

    return {
      depth,
      columns,
      pos,
      width: Math.max(totalWidth, 800),
      height: Math.max(totalHeight, 480),
      maxDepth,
      stages,
    };
  }, [filteredNodes, filteredEdges, nodeMap]);

  // Hover & Active Dependency Highlight Calculation
  // Supports mouse hover on desktop and tap on touch/mobile
  const activeNodeId = hoveredNodeId;

  const { activePrereqSet, activeDependentSet } = useMemo(() => {
    if (!activeNodeId) return { activePrereqSet: new Set<string>(), activeDependentSet: new Set<string>() };
    return {
      activePrereqSet: new Set(incomingMap.get(activeNodeId) || []),
      activeDependentSet: new Set(outgoingMap.get(activeNodeId) || []),
    };
  }, [activeNodeId, incomingMap, outgoingMap]);

  if (loading && !data) return <Spinner label="Analyzing skill dependency graph..." />;
  if (error) return <Alert tone="critical" title="Could not load skill graph">{error}</Alert>;
  if (!data || !layout) return null;

  // Selected node details for modal inspection
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : null;
  const selectedPrereqIds = selectedNodeId ? incomingMap.get(selectedNodeId) || [] : [];
  const selectedUnlockIds = selectedNodeId ? outgoingMap.get(selectedNodeId) || [] : [];

  // Summary Metrics based on actual learner competency scores
  const totalSkills = filteredNodes.length;
  const targetMetSkills = filteredNodes.filter(
    (n) => n.targetLevel !== null && n.currentLevel >= n.targetLevel
  ).length;
  const inProgressSkills = filteredNodes.filter(
    (n) => n.currentLevel > 0 && (n.targetLevel === null || n.currentLevel < n.targetLevel)
  ).length;
  const unevidencedSkills = filteredNodes.filter((n) => n.currentLevel === 0).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Dynamic SVG stroke animation style */}
      <style>{`
        @keyframes flowDash {
          to { stroke-dashoffset: -18; }
        }
        .animate-flow-dash {
          stroke-dasharray: 6 3;
          animation: flowDash 0.8s linear infinite;
        }
      `}</style>

      {/* Page Header */}
      <header className="border-b border-[#E5E7EB] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">
                Skill Dependency Graph
              </h1>
              <span className="rounded border border-[#0284C7]/30 bg-[#F0F9FF] px-2 py-0.5 text-[11px] font-semibold text-[#0284C7]">
                Interactive Prerequisite Explorer
              </span>
            </div>
            <p className="mt-1 text-[13px] text-[#6B7280] max-w-3xl leading-relaxed">
              Explore prerequisite chains across STATINTEL competencies. Hover your cursor over any skill to immediately
              illuminate its connected upstream prerequisites and downstream dependents in <strong className="text-[#0284C7]">BLUE</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/path"
              className="inline-flex items-center gap-1.5 rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-medium text-[#111827] hover:bg-[#F8FAFC] transition-colors"
            >
              <Route size={14} className="text-[#0284C7]" /> Learning Path Sequence
            </Link>
          </div>
        </div>

        {/* Domain Filter Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB] pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-medium text-[#6B7280] mr-1">Curriculum Domain:</span>
            {[
              { id: 'TECH', label: 'Technology & Computing (TECH)' },
              { id: 'STAT', label: 'Statistical Methodology (STAT)' },
              { id: 'GOVN', label: 'Governance & Privacy (GOVN)' },
              { id: 'BEHV', label: 'Behavioral Skills (BEHV)' },
              { id: 'ALL', label: 'All Domains (Cross-Domain)' },
            ].map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={domain === tab.id ? 'primary' : 'secondary'}
                onClick={() => {
                  setDomain(tab.id);
                  setSelectedNodeId(null);
                  setHoveredNodeId(null);
                }}
                className="text-[12px] py-1"
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Canvas / Stacked View toggle for responsive testing */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMobileView('CANVAS')}
              className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                mobileView === 'CANVAS'
                  ? 'bg-[#0284C7] text-white'
                  : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F8FAFC]'
              }`}
            >
              Graph Canvas
            </button>
            <button
              type="button"
              onClick={() => setMobileView('STACKED')}
              className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                mobileView === 'STACKED'
                  ? 'bg-[#0284C7] text-white'
                  : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F8FAFC]'
              }`}
            >
              Layered List
            </button>
          </div>
        </div>
      </header>

      {/* KPI Cards based on actual learner competency scores */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Curriculum Competencies"
          value={totalSkills}
          subtext={`Structured into ${layout.stages.length} dependency layers`}
          icon={<Layers size={20} />}
        />
        <MetricCard
          title="Role Target Met"
          value={`${targetMetSkills} / ${totalSkills}`}
          subtext="Evidenced at or above role requirement"
          icon={<Check size={20} />}
        />
        <MetricCard
          title="In Progress / Developing"
          value={inProgressSkills}
          subtext="Evidenced at foundation (L1 - L2)"
          icon={<Compass size={20} />}
        />
        <MetricCard
          title="Unevidenced / Pending"
          value={unevidencedSkills}
          subtext="No evidence recorded yet (L0)"
          icon={<Lock size={20} />}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          STAGE PROGRESSION PIPELINE BAR
          ══════════════════════════════════════════════════════════════════ */}
      <Card className="p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4 border-b border-[#E5E7EB] pb-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
              <Compass size={17} className="text-[#0284C7]" />
              <span>Multi-Stage Dependency Progression</span>
            </h2>
            <p className="text-[12px] text-[#6B7280]">
              Calculated automatically using DAG longest-path topological relaxation from statutory prerequisite rules.
            </p>
          </div>
        </div>

        {/* Pipeline Progression Nodes */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center min-w-max px-2 py-1">
            {layout.stages.map((st, idx) => {
              const hasNext = idx < layout.stages.length - 1;

              return (
                <div key={st.stageNum} className="flex items-center">
                  {/* Stage Node */}
                  <div className="flex flex-col items-center text-center w-40 shrink-0">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-300 select-none shadow-sm ${
                        st.isCompleted
                          ? 'border-[#0284C7] bg-[#F0F9FF] text-[#0284C7]'
                          : 'border-[#D1D5DB] bg-white text-[#6B7280]'
                      }`}
                    >
                      <span className="text-[14px] font-bold">{st.stageNum}</span>
                    </div>
                    <p className="mt-2 text-[12px] font-bold text-[#111827] uppercase tracking-wide">
                      Stage {st.stageNum}
                    </p>
                    <p className="text-[11px] font-medium text-[#6B7280] truncate max-w-[150px]">
                      {st.title}
                    </p>
                    <span className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold bg-[#F3F4F6] text-[#6B7280]">
                      {st.targetMetCount} / {st.totalCount} at target
                    </span>
                  </div>

                  {/* Inter-Stage Connector Line */}
                  {hasNext && (
                    <div className="w-16 md:w-24 shrink-0 flex items-center px-1">
                      <div className="relative w-full flex items-center">
                        <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full" />
                        <div className="absolute right-0 translate-x-1 flex items-center justify-center text-[#9CA3AF]">
                          <ArrowRight size={16} strokeWidth={2} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          MAIN GRAPH AREA: CANVAS VS STACKED
          ══════════════════════════════════════════════════════════════════ */}
      {mobileView === 'CANVAS' ? (
        <Card className="overflow-hidden border-[#E5E7EB] bg-white">
          <CardHeader
            title={`${DOMAIN_NAME[domain] || domain} Prerequisite Graph Canvas`}
            subtitle="Hover any skill card to illuminate its connected prerequisite & dependent paths in BLUE."
            action={
              <div className="flex flex-wrap items-center gap-4 text-[12px]">
                {/* Updated Legend as explicitly required */}
                <div className="flex items-center gap-3 border-r border-[#E5E7EB] pr-4">
                  <span className="flex items-center gap-1.5 font-bold text-[#0284C7]">
                    <span className="h-2 w-5 rounded bg-[#0284C7] inline-block animate-pulse"></span>
                    Blue = Selected Skill &amp; Dependency Path
                  </span>
                  <span className="flex items-center gap-1.5 text-[#64748B]">
                    <span className="h-2 w-5 rounded bg-[#CBD5E1] inline-block"></span>
                    Grey = Other Dependencies
                  </span>
                </div>

                {/* Learner Proficiency Legend */}
                <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                  <span>L0: Not Evidenced</span>
                  <span>•</span>
                  <span>L1: Awareness</span>
                  <span>•</span>
                  <span>L2: Guided</span>
                  <span>•</span>
                  <span>L3: Independent</span>
                  <span>•</span>
                  <span className="font-semibold text-emerald-700">Target Met ✓</span>
                </div>
              </div>
            }
          />

          {/* SVG + HTML Hybrid Canvas */}
          <div
            className="overflow-x-auto overflow-y-auto max-h-[750px] p-4 bg-[#FAFAFA]/50 relative select-none"
            onClick={() => {
              // Clicking empty canvas background clears active highlight
              setHoveredNodeId(null);
            }}
          >
            <div
              className="relative"
              style={{
                width: layout.width,
                height: layout.height,
              }}
            >
              {/* Stage Column Background Boundaries & Headers */}
              {layout.stages.map((st) => (
                <div
                  key={st.stageNum}
                  className="absolute top-0 bottom-0 rounded-lg border border-dashed border-[#E2E8F0] bg-white/70 pointer-events-none p-3"
                  style={{
                    left: st.x - 12,
                    width: st.width + 24,
                  }}
                >
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5 mb-2">
                    <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                      Stage {st.stageNum}
                    </span>
                    <span className="text-[10.5px] font-semibold text-[#0284C7]">
                      {st.totalCount} skills
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-[#111827] truncate">{st.title}</p>
                </div>
              ))}

              {/* Background SVG for Dependency Edges */}
              <svg
                width={layout.width}
                height={layout.height}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 1 }}
              >
                <defs>
                  {/* Inactive Neutral Grey Arrowhead */}
                  <marker
                    id="arrow-inactive"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94A3B8" />
                  </marker>

                  {/* Active Vibrant Blue Arrowhead for Hovered Dependencies */}
                  <marker
                    id="arrow-blue"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#0284C7" />
                  </marker>
                </defs>

                {/* Render All Dependency Edges */}
                {filteredEdges.map((e) => {
                  const fromPos = layout.pos.get(e.fromId);
                  const toPos = layout.pos.get(e.toId);
                  if (!fromPos || !toPos) return null;

                  // Blue highlighting condition:
                  // The edge is directly connected to the active/hovered node:
                  // 1. Incoming prerequisite edge (e.toId === activeNodeId)
                  // 2. Outgoing downstream edge (e.fromId === activeNodeId)
                  const isEdgeActive =
                    activeNodeId !== null &&
                    (e.fromId === activeNodeId || e.toId === activeNodeId);

                  // Connect from right-center of source card to left-center of target card
                  const x1 = fromPos.x + COL_W;
                  const y1 = fromPos.y + ROW_H / 2;
                  const x2 = toPos.x;
                  const y2 = toPos.y + ROW_H / 2;

                  const dx = Math.max((x2 - x1) / 2, 30);
                  const dPath = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                  return (
                    <g key={`${e.fromId}->${e.toId}`}>
                      {/* Subtle cyan glow backdrop when edge is active */}
                      {isEdgeActive && (
                        <path
                          d={dPath}
                          fill="none"
                          stroke="#BAE6FD"
                          strokeWidth={6}
                          strokeLinecap="round"
                          opacity={0.7}
                        />
                      )}

                      {/* Main Dependency Connector Line */}
                      <path
                        d={dPath}
                        fill="none"
                        stroke={isEdgeActive ? '#0284C7' : '#CBD5E1'}
                        strokeWidth={isEdgeActive ? 2.8 : 1.4}
                        opacity={isEdgeActive ? 1 : activeNodeId !== null ? 0.35 : 0.85}
                        className={isEdgeActive ? 'animate-flow-dash' : 'transition-colors duration-200'}
                        markerEnd={isEdgeActive ? 'url(#arrow-blue)' : 'url(#arrow-inactive)'}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Foreground Interactive HTML Skill Cards */}
              <div className="absolute inset-0" style={{ zIndex: 2 }}>
                {filteredNodes.map((n) => {
                  const p = layout.pos.get(n.id);
                  if (!p) return null;

                  const isHovered = activeNodeId === n.id;
                  const isPrereqOfHovered = activePrereqSet.has(n.id);
                  const isDependentOfHovered = activeDependentSet.has(n.id);

                  // Actual learner proficiency derived from legitimate competency evidence
                  const currentLevel = n.currentLevel ?? 0;
                  const targetLevel = n.targetLevel ?? null;
                  const isTargetMet = targetLevel !== null && currentLevel >= targetLevel;

                  const incoming = incomingMap.get(n.id) || [];
                  const outgoing = outgoingMap.get(n.id) || [];

                  return (
                    <div
                      key={n.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        // For touch devices, tap sets the hover highlight
                        // Tapping the selected skill again clears the highlight
                        if (hoveredNodeId === n.id) {
                          setHoveredNodeId(null);
                        } else {
                          setHoveredNodeId(n.id);
                        }
                      }}
                      onMouseEnter={() => setHoveredNodeId(n.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      style={{
                        position: 'absolute',
                        left: p.x,
                        top: p.y,
                        width: COL_W,
                        height: ROW_H,
                      }}
                      className={`group rounded-lg border p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer text-left shadow-sm ${
                        isHovered
                          ? 'border-[#0284C7] ring-2 ring-[#0284C7]/40 bg-[#F0F9FF] shadow-lg scale-[1.02] z-30'
                          : isPrereqOfHovered
                          ? 'border-[#0284C7]/80 ring-1 ring-[#0284C7]/20 bg-white shadow-md z-20'
                          : isDependentOfHovered
                          ? 'border-[#0284C7]/80 ring-1 ring-[#0284C7]/20 bg-white shadow-md z-20'
                          : activeNodeId !== null
                          ? 'border-[#E2E8F0] bg-white opacity-50 hover:opacity-100'
                          : 'border-[#CBD5E1] bg-white hover:border-[#0284C7] hover:shadow'
                      }`}
                    >
                      {/* Top Row: Competency ID + Learner Proficiency Badge */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {isHovered ? (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0284C7] text-white text-[10px] font-bold">
                              ★
                            </span>
                          ) : isPrereqOfHovered ? (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F0F9FF] text-[#0284C7] border border-[#0284C7] text-[10px] font-bold" title="Prerequisite of hovered skill">
                              ↑
                            </span>
                          ) : isDependentOfHovered ? (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F0F9FF] text-[#0284C7] border border-[#0284C7] text-[10px] font-bold" title="Downstream dependent of hovered skill">
                              ↓
                            </span>
                          ) : (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold">
                              L{currentLevel}
                            </span>
                          )}

                          <span className="font-mono text-[10px] font-semibold text-[#64748B]">
                            {n.id}
                          </span>
                        </div>

                        {/* Legitimate Learner Proficiency Status (read from competency evidence) */}
                        {isTargetMet ? (
                          <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[9.5px] font-bold">
                            L{currentLevel} Target Met ✓
                          </span>
                        ) : targetLevel !== null ? (
                          <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[9.5px] font-bold">
                            L{currentLevel} / L{targetLevel}
                          </span>
                        ) : (
                          <span className="rounded bg-slate-50 text-slate-700 border border-slate-200 px-1.5 py-0.5 text-[9.5px] font-bold">
                            L{currentLevel}
                          </span>
                        )}
                      </div>

                      {/* Middle: Skill Name */}
                      <div>
                        <h4
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNodeId(n.id);
                          }}
                          className={`font-bold text-[13px] leading-tight transition-colors line-clamp-2 ${
                            isHovered ? 'text-[#0284C7]' : 'text-[#111827] group-hover:text-[#0284C7]'
                          }`}
                        >
                          {n.nameEn}
                        </h4>
                      </div>

                      {/* Bottom Row: Dynamic dependency relationship pill */}
                      <div className="flex items-center justify-between text-[10.5px] text-[#64748B] pt-1 border-t border-[#F1F5F9]">
                        {isHovered ? (
                          <span className="font-bold text-[#0284C7]">
                            {incoming.length} prereq &bull; {outgoing.length} unlocks
                          </span>
                        ) : isPrereqOfHovered ? (
                          <span className="font-semibold text-[#0284C7]">
                            Required Prerequisite &uarr;
                          </span>
                        ) : isDependentOfHovered ? (
                          <span className="font-semibold text-[#0284C7]">
                            Unlocked Dependent &darr;
                          </span>
                        ) : (
                          <span className="text-[#64748B]">
                            {incoming.length > 0 ? `${incoming.length} prereqs` : 'Foundational'}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNodeId(n.id);
                          }}
                          className="text-[#0284C7] font-semibold hover:underline cursor-pointer"
                        >
                          Inspect &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           LAYERED LIST VIEW (STACKED FOR MOBILE / TABLET)
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {layout.stages.map((st, idx) => (
            <div key={st.stageNum} className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0284C7] text-white text-[11px] font-bold">
                    {st.stageNum}
                  </span>
                  <h3 className="font-bold text-[15px] text-[#111827]">
                    Stage {st.stageNum}: {st.title}
                  </h3>
                </div>
                <span className="text-[12px] font-semibold text-[#0284C7]">
                  {st.targetMetCount} / {st.totalCount} at target level
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {st.nodeIds.map((id) => {
                  const n = nodeMap.get(id);
                  if (!n) return null;
                  const isHovered = activeNodeId === n.id;
                  const isPrereqOfHovered = activePrereqSet.has(n.id);
                  const isDependentOfHovered = activeDependentSet.has(n.id);
                  const incoming = incomingMap.get(n.id) || [];
                  const outgoing = outgoingMap.get(n.id) || [];

                  const currentLevel = n.currentLevel ?? 0;
                  const targetLevel = n.targetLevel ?? null;
                  const isTargetMet = targetLevel !== null && currentLevel >= targetLevel;

                  return (
                    <Card
                      key={n.id}
                      onClick={() => {
                        // Tapping the selected skill again clears the highlight
                        if (hoveredNodeId === n.id) {
                          setHoveredNodeId(null);
                        } else {
                          setHoveredNodeId(n.id);
                        }
                      }}
                      className={`p-3.5 flex flex-col justify-between cursor-pointer transition-colors ${
                        isHovered
                          ? 'border-[#0284C7] ring-1 ring-[#0284C7]/30 bg-[#F0F9FF]'
                          : isPrereqOfHovered || isDependentOfHovered
                          ? 'border-[#0284C7]/60 bg-white shadow-sm'
                          : 'border-[#E5E7EB] hover:border-[#0284C7]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-mono text-[10px] font-semibold text-[#64748B]">{n.id}</span>
                          {isTargetMet ? (
                            <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[9.5px] font-bold">
                              L{currentLevel} Target Met ✓
                            </span>
                          ) : (
                            <span className="rounded bg-slate-50 text-slate-700 border border-slate-200 px-1.5 py-0.5 text-[9.5px] font-bold">
                              Level L{currentLevel} {targetLevel ? `/ L${targetLevel}` : ''}
                            </span>
                          )}
                        </div>
                        <h4
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNodeId(n.id);
                          }}
                          className="font-bold text-[14px] text-[#111827] hover:text-[#0284C7] cursor-pointer"
                        >
                          {n.nameEn}
                        </h4>
                        <p className="mt-1 text-[12px] text-[#6B7280] line-clamp-2">{n.description}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-[#64748B]">
                        <span className="text-[#0284C7] font-semibold">
                          {incoming.length} prereq &bull; {outgoing.length} unlock
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNodeId(n.id);
                          }}
                          className="text-[#0284C7] font-semibold hover:underline"
                        >
                          View Details &rarr;
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Connecting Down Arrow to Next Stage */}
              {idx < layout.stages.length - 1 && (
                <div className="flex flex-col items-center py-2" aria-hidden="true">
                  <div className="w-[2px] h-6 bg-[#E5E7EB]" />
                  <div className="-mt-1 text-[#94A3B8]">
                    <ArrowDown size={18} strokeWidth={2} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SKILL DETAILS SLIDE-OVER DRAWER / MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {selectedNode && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedNodeId(null)}
        >
          <div
            className="w-full max-w-xl rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                    {selectedNode.id}
                  </span>
                  <Badge tone="primary">{DOMAIN_NAME[selectedNode.domain] || selectedNode.domain}</Badge>
                  <Badge tone="neutral">{selectedNode.area}</Badge>
                </div>
                <h3 className="mt-1 text-[18px] font-bold text-[#111827]">{selectedNode.nameEn}</h3>
                <p className="mt-1 text-[12px] text-[#6B7280]">{selectedNode.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                aria-label="Close modal"
                className="text-[#64748B] hover:text-[#111827] cursor-pointer p-1 text-[18px] rounded"
              >
                ✕
              </button>
            </div>

            {/* Current Evaluated Status from legitimate competency evidence */}
            <div className="grid gap-3 sm:grid-cols-3 bg-[#F8FAFC] rounded-lg p-3 border border-[#E5E7EB]">
              <div>
                <span className="text-[11px] font-semibold uppercase text-[#64748B]">Evaluated Proficiency</span>
                <p className="text-[18px] font-bold text-[#111827]">
                  {Math.round(selectedNode.currentScore)}%
                  <span className="text-[12px] font-normal text-[#64748B]"> ({levelLabel(selectedNode.currentLevel)})</span>
                </p>
                <p className="text-[11px] text-[#64748B]">Evidence Confidence: {Math.round(selectedNode.confidence * 100)}%</p>
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase text-[#64748B]">Role Target</span>
                <p className="text-[18px] font-bold text-[#111827]">
                  {selectedNode.targetLevel ? `L${selectedNode.targetLevel}` : 'Baseline'}
                </p>
                <p className="text-[11px] text-[#64748B]">
                  {selectedNode.gap > 0 ? `Gap: ${selectedNode.gap} levels to target` : 'Requirement Evidenced ✓'}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase text-[#64748B]">Estimated Effort</span>
                <p className="text-[18px] font-bold text-[#111827]">{hours(selectedNode.estHours)}</p>
                <p className="text-[11px] text-[#64748B]">Integrated LMS duration</p>
              </div>
            </div>

            {/* Dependency Status: Prerequisites Required First */}
            <div className="space-y-2">
              <h4 className="text-[13px] font-bold text-[#111827] flex items-center gap-1.5">
                <Lock size={14} className="text-[#0284C7]" />
                <span>Prerequisites (Required Before Learning This Skill):</span>
              </h4>

              {selectedPrereqIds.length === 0 ? (
                <div className="rounded border border-[#E5E7EB] bg-white p-2.5 text-[12px] text-[#64748B]">
                  ✓ Foundational entry competency: No upstream prerequisites required.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedPrereqIds.map((pid) => {
                    const prereqNode = nodeMap.get(pid);
                    const isPrereqSatisfied = (prereqNode?.currentLevel ?? 0) >= 1;

                    return (
                      <div
                        key={pid}
                        className={`flex items-center justify-between rounded border p-2.5 text-[12px] transition-colors ${
                          isPrereqSatisfied
                            ? 'border-[#0284C7]/40 bg-[#F0F9FF]/40 text-[#0284C7]'
                            : 'border-[#E2E8F0] bg-[#FFFBEB] text-[#92400E]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                              isPrereqSatisfied ? 'bg-[#0284C7] text-white' : 'border border-[#F59E0B] text-[#92400E]'
                            }`}
                          >
                            {isPrereqSatisfied ? <Check size={11} strokeWidth={3} /> : '!'}
                          </span>
                          <span className="font-semibold">{prereqNode?.nameEn || pid}</span>
                        </div>
                        <span className="text-[11px] font-bold">
                          {isPrereqSatisfied ? `Evidenced (L${prereqNode?.currentLevel})` : 'Development Needed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Downstream Unlocks */}
            <div className="space-y-2">
              <h4 className="text-[13px] font-bold text-[#111827] flex items-center gap-1.5">
                <Unlock size={14} className="text-[#0284C7]" />
                <span>Skills Unlocked by Mastering This Competency:</span>
              </h4>

              {selectedUnlockIds.length === 0 ? (
                <p className="text-[12px] text-[#64748B]">
                  Terminal role target for this curriculum branch.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedUnlockIds.map((uid) => {
                    const unlockNode = nodeMap.get(uid);
                    return (
                      <button
                        key={uid}
                        type="button"
                        onClick={() => setSelectedNodeId(uid)}
                        className="inline-flex items-center gap-1 rounded border border-[#E5E7EB] bg-[#F8FAFC] hover:bg-[#F1F5F9] px-2.5 py-1 text-[11.5px] font-medium text-[#111827] cursor-pointer"
                      >
                        <span>{unlockNode?.nameEn || uid}</span>
                        <ChevronRight size={12} className="text-[#0284C7]" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recommended Courses from Government LMS (iGOT / NSSTA) */}
            <div className="space-y-2">
              <h4 className="text-[13px] font-bold text-[#111827] flex items-center gap-1.5">
                <BookOpen size={14} className="text-[#0284C7]" />
                <span>Recommended Courses for This Skill:</span>
              </h4>

              {selectedNode.courses.length === 0 ? (
                <p className="text-[12px] text-[#6B7280]">
                  Official self-directed syllabus and practical exercises available on the platform.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {selectedNode.courses.map((co) => (
                    <div
                      key={co.id}
                      className="rounded border border-[#E5E7EB] bg-white p-2.5 flex items-center justify-between gap-2 text-[12px]"
                    >
                      <div>
                        <p className="font-semibold text-[#111827]">{co.name}</p>
                        <p className="text-[11px] text-[#64748B]">
                          Provider: <strong>{co.provider}</strong> &bull; Duration: {mins(co.durationMins)}
                        </p>
                      </div>
                      {co.url && (
                        <a
                          href={co.url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#0284C7] hover:underline"
                        >
                          iGOT <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E5E7EB]">
              <div className="flex items-center gap-3">
                <Link
                  to={`/competency/${selectedNode.id}`}
                  className="text-[12px] font-semibold text-[#0284C7] hover:underline"
                >
                  View Evidence Ledger &rarr;
                </Link>
                <Link
                  to="/assess"
                  className="text-[12px] font-semibold text-[#64748B] hover:text-[#111827] inline-flex items-center gap-1"
                >
                  <ClipboardCheck size={12} /> Take Assessment
                </Link>
              </div>

              <Button variant="secondary" size="sm" onClick={() => setSelectedNodeId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DETAILED COMPETENCY & PREREQUISITE TABLE
          ══════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader
          title={`${DOMAIN_NAME[domain] || domain} Competency & Prerequisite Table`}
          subtitle="Tabular listing of competencies, required incoming prerequisites, and your verified score."
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">Competencies with prerequisites and levels</caption>
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
                <Th>Competency</Th>
                <Th>Area</Th>
                <Th>Prerequisite Dependencies</Th>
                <Th>Target</Th>
                <Th align="right">Verified Proficiency</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {filteredNodes.map((n) => {
                const incoming = incomingMap.get(n.id) || [];
                const currentLevel = n.currentLevel ?? 0;
                const targetLevel = n.targetLevel ?? null;
                const isTargetMet = targetLevel !== null && currentLevel >= targetLevel;

                return (
                  <tr key={n.id} className="hover:bg-[#F8FAFC]/60 transition-colors">
                    <Td>
                      <button
                        type="button"
                        onClick={() => setSelectedNodeId(n.id)}
                        className="font-medium text-[#0284C7] hover:underline text-left cursor-pointer"
                      >
                        {n.nameEn}
                      </button>
                      <div className="font-mono text-[10.5px] text-[#64748B]">{n.id}</div>
                    </Td>
                    <Td className="text-[#6B7280]">{n.area}</Td>
                    <Td className="text-[#6B7280]">
                      {incoming.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {incoming.map((pid) => (
                            <span
                              key={pid}
                              className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[11px] font-medium text-[#334155]"
                            >
                              {nodeMap.get(pid)?.nameEn || pid}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#94A3B8]">None (Foundational)</span>
                      )}
                    </Td>
                    <Td className="text-[#111827] font-semibold">
                      {n.targetLevel ? `L${n.targetLevel}` : '—'}
                    </Td>
                    <Td align="right">
                      {isTargetMet ? (
                        <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold">
                          L{currentLevel} Target Met ✓
                        </span>
                      ) : targetLevel !== null ? (
                        <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[11px] font-bold">
                          L{currentLevel} / L{targetLevel}
                        </span>
                      ) : (
                        <span className="rounded bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 text-[11px] font-bold">
                          L{currentLevel} ({levelLabel(currentLevel)})
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pedagogical Reference Card */}
      <Card>
        <CardHeader title="How the Skill Dependency Graph Works in STATINTEL" />
        <ul className="space-y-2 p-4 text-[13px] leading-relaxed text-[#6B7280]">
          <li>
            <strong className="text-[#111827]">Interactive Dependency Highlighting:</strong> Moving the cursor over any
            skill illuminates its full prerequisite tree (incoming) and unlocked capabilities (downstream) in{' '}
            <span className="font-semibold text-[#0284C7]">BLUE</span> with dynamic line flow animation.
          </li>
          <li>
            <strong className="text-[#111827]">Prerequisite DAG Closure:</strong> The system enforces directed acyclic
            prerequisite constraints from India&apos;s Official Statistical System ontology.
          </li>
          <li>
            <strong className="text-[#111827]">Learner Proficiency Grounding:</strong> Learner levels ($L0$ to $L4$) are
            evaluated strictly from dated, verified training and assessment evidence on the immutable evidence ledger,
            completely decoupled from graph hover interactions.
          </li>
          <li>
            <strong className="text-[#111827]">Course Mappings:</strong> Skills map directly to Sunbird iGOT Karmayogi and
            NSSTA TPAC training courses. Learners can seamlessly launch courses or assess competency gaps.
          </li>
        </ul>
      </Card>
    </div>
  );
}
