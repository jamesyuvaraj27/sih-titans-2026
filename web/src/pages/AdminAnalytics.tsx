import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Users,
  Grid3x3,
  BookOpen,
  Building,
  ExternalLink,
} from 'lucide-react';
import {
  api,
  type WorkforceAnalyticsResponse,
  type TrainingDemandItem,
} from '../lib/api.js';
import { Card, CardHeader, Badge, Select, Spinner, Alert } from '../components/ui.js';
import { DOMAIN_NAME, mins } from '../lib/format.js';

export function AdminAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'demand';

  const [data, setData] = useState<WorkforceAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [domainFilter, setDomainFilter] = useState('ALL');
  const [selectedDemand, setSelectedDemand] = useState<TrainingDemandItem | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    designation: string;
    competencyName: string;
    meanGap: number | null;
    meanScore: number | null;
    officers: number;
  } | null>(null);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (domainFilter !== 'ALL') params.set('domain', domainFilter);

      const res = await api<WorkforceAnalyticsResponse>(`/admin/analytics?${params.toString()}`);
      setData(res);
      if (res.trainingDemand.length > 0 && !selectedDemand) {
        setSelectedDemand(res.trainingDemand[0] ?? null);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load workforce analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [domainFilter]);

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  if (loading && !data) {
    return <Spinner label="Analyzing workforce competency demand & designation readiness..." />;
  }

  if (error) {
    return <Alert tone="critical" title="Could not load analytics">{error}</Alert>;
  }

  if (!data) return null;

  // Heatmap color logic
  const getCellColor = (gap: number | null) => {
    if (gap === null) return '#F8FAFC'; // no requirement
    if (gap <= 0.2) return '#D1FAE5'; // met target
    if (gap <= 0.7) return '#FEF3C7'; // minor gap
    if (gap <= 1.3) return '#FED7AA'; // moderate gap
    if (gap <= 2.0) return '#FECACA'; // significant gap
    return '#F87171'; // critical gap
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <header className="border-b border-[#E5E7EB] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">
                Workforce Competency &amp; Demand Intelligence
              </h1>
              <span className="rounded border border-[#0284C7]/30 bg-[#F0F9FF] px-2 py-0.5 text-[11px] font-semibold text-[#0284C7]">
                Executive Analytics
              </span>
            </div>
            <p className="mt-1 text-[13px] text-[#6B7280] max-w-3xl leading-relaxed">
              Evidence-based workforce analytics derived from official role requirements, competency scores, and statutory survey deadlines.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin/workforce-data"
              className="inline-flex items-center gap-1.5 rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-medium text-[#111827] hover:bg-[#F8FAFC] transition-colors"
            >
              View Underlying CSV Records &rarr;
            </Link>
          </div>
        </div>

        {/* Analytics Navigation Tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[#E5E7EB] pt-3">
          {[
            { id: 'demand', label: 'Training Demand Graph', icon: <TrendingUp size={15} /> },
            { id: 'readiness', label: 'Readiness by Designation', icon: <Users size={15} /> },
            { id: 'gaps', label: 'Skill-Gap Heatmap', icon: <Grid3x3 size={15} /> },
            { id: 'coverage', label: 'Training / Course Coverage', icon: <BookOpen size={15} /> },
            { id: 'overview', label: 'Workforce Overview', icon: <Building size={15} /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#0284C7] text-white shadow-sm'
                    : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F8FAFC] hover:text-[#111827]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: TRAINING DEMAND GRAPH
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'demand' && (
        <div className="space-y-6">
          {/* Top KPI Metrics */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Highest Demand Skill
              </p>
              <p className="text-[18px] font-bold text-[#0284C7] truncate mt-1">
                {data.overview.topPrioritySkill?.nameEn || '—'}
              </p>
              <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                {data.overview.topPrioritySkill?.officersAffected || 0} officers affected ({data.overview.topPrioritySkill?.shareAffected || 0}%)
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Total Capability Shortfalls
              </p>
              <p className="text-[26px] font-bold text-[#111827] mt-1">{data.overview.totalShortfalls}</p>
              <p className="text-[11.5px] text-[#6B7280] mt-0.5">Sum of unmet role requirements</p>
            </Card>

            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Critical Shortages
              </p>
              <p className="text-[26px] font-bold text-red-600 mt-1">{data.overview.criticalShortagesCount}</p>
              <p className="text-[11.5px] text-[#6B7280] mt-0.5">Competencies with mean gap ≥ 1.5</p>
            </Card>

            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Course Commissioning Rate
              </p>
              <p className="text-[26px] font-bold text-emerald-600 mt-1">{data.courseCoverage.coveragePct}%</p>
              <p className="text-[11.5px] text-[#6B7280] mt-0.5">Skills with mapped iGOT/NSSTA courses</p>
            </Card>
          </div>

          {/* Training Demand Chart & Detail Inspector */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Chart Area (3 columns) */}
            <Card className="lg:col-span-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3 mb-4">
                <div>
                  <h2 className="text-[15px] font-bold text-[#111827]">
                    Workforce Training Demand (Commissioning Queue)
                  </h2>
                  <p className="text-[12px] text-[#6B7280]">
                    Officers with an open gap below role benchmark. Darker red indicates acute shortfall.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] text-[#6B7280]">Domain:</span>
                  <Select
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(e.target.value)}
                    className="text-[12px] py-0.5"
                  >
                    <option value="ALL">All Domains</option>
                    <option value="TECH">Technology (TECH)</option>
                    <option value="STAT">Statistical (STAT)</option>
                    <option value="GOVN">Governance (GOVN)</option>
                    <option value="BEHV">Behavioral (BEHV)</option>
                  </Select>
                </div>
              </div>

              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.trainingDemand.slice(0, 10)}
                    layout="vertical"
                    margin={{ left: 16, right: 30, top: 10, bottom: 10 }}
                  >
                    <CartesianGrid horizontal={false} stroke="#E2E8F0" />
                    <XAxis
                      type="number"
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="nameEn"
                      width={160}
                      tick={{ fill: '#111827', fontSize: 11.5 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#F1F5F9' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length && payload[0]) {
                          const item = payload[0].payload as TrainingDemandItem;
                          return (
                            <div className="rounded border border-[#E5E7EB] bg-white p-3 shadow-lg text-[12px] space-y-1">
                              <p className="font-bold text-[#111827]">{item.nameEn}</p>
                              <p className="text-[#64748B]">Domain: {DOMAIN_NAME[item.domain] || item.domain}</p>
                              <p className="text-[#0284C7] font-semibold">
                                {item.officersAffected} of {item.totalRequired} officers affected ({item.shareAffected}%)
                              </p>
                              <p className="text-amber-700">Mean Gap: -{item.meanGap} levels</p>
                              {item.isUrgent && (
                                <p className="text-red-600 font-bold">⚡ Survey Calendar Commitment</p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="officersAffected"
                      radius={[0, 4, 4, 0]}
                      animationDuration={500}
                      onClick={(e) => setSelectedDemand(e as any)}
                      cursor="pointer"
                    >
                      {data.trainingDemand.slice(0, 10).map((d) => (
                        <Cell
                          key={d.competencyId}
                          fill={
                            d.meanGap >= 1.5
                              ? '#EF4444'
                              : d.meanGap >= 1.0
                              ? '#F59E0B'
                              : '#0284C7'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[11px] text-[#6B7280] mt-2 italic text-center">
                Click any bar or demand card to inspect Cadre distribution and mapped courses on iGOT &amp; NSSTA.
              </p>
            </Card>

            {/* Selected Demand Detail Inspector (2 columns) */}
            <Card className="lg:col-span-2 p-5 space-y-4">
              <div className="border-b border-[#E5E7EB] pb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                  Demand Detail Inspector
                </span>
                <h3 className="text-[17px] font-bold text-[#111827] mt-0.5">
                  {selectedDemand?.nameEn || 'Select a competency'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone="primary">{DOMAIN_NAME[selectedDemand?.domain || ''] || selectedDemand?.domain}</Badge>
                  {selectedDemand?.isUrgent && <Badge tone="critical">Survey Urgent</Badge>}
                </div>
              </div>

              {selectedDemand ? (
                <div className="space-y-4 text-[12.5px]">
                  {/* Key Stats */}
                  <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] p-3 rounded border border-[#E5E7EB]">
                    <div>
                      <span className="text-[11px] text-[#6B7280]">Personnel Affected</span>
                      <p className="text-[17px] font-bold text-[#111827]">
                        {selectedDemand.officersAffected} / {selectedDemand.totalRequired}
                      </p>
                      <p className="text-[11px] text-[#0284C7] font-semibold">{selectedDemand.shareAffected}% of cadre</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#6B7280]">Mean Capability Gap</span>
                      <p className="text-[17px] font-bold text-amber-700">
                        -{selectedDemand.meanGap} levels
                      </p>
                      <p className="text-[11px] text-[#6B7280]">Average level deficit</p>
                    </div>
                  </div>

                  {/* Cadre Breakdown */}
                  <div>
                    <h4 className="font-bold text-[13px] text-[#111827] mb-1.5">
                      Demand by Designation / Cadre
                    </h4>
                    {selectedDemand.affectedDesignations.length === 0 ? (
                      <p className="text-[12px] text-[#6B7280]">No open gaps in active scope.</p>
                    ) : (
                      <div className="space-y-1.5 border border-[#E5E7EB] rounded p-2 max-h-36 overflow-y-auto">
                        {selectedDemand.affectedDesignations.map((des) => (
                          <div
                            key={des.designation}
                            className="flex items-center justify-between text-[12px] border-b border-[#F1F5F9] pb-1 last:border-0"
                          >
                            <span className="font-medium text-[#111827] truncate max-w-[160px]">
                              {des.designation}
                            </span>
                            <span className="font-mono text-[#64748B]">
                              <strong>{des.count}</strong> officers (gap -{des.meanGap})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ready Training Solutions */}
                  <div>
                    <h4 className="font-bold text-[13px] text-[#111827] mb-1.5 flex items-center justify-between">
                      <span>Ready Training Solutions ({selectedDemand.courses.length})</span>
                      <span className="text-[11px] font-normal text-[#64748B]">iGOT &amp; NSSTA</span>
                    </h4>

                    {selectedDemand.courses.length === 0 ? (
                      <div className="rounded border border-amber-200 bg-amber-50 p-2.5 text-[11.5px] text-amber-900">
                        ⚠️ <strong>Curriculum Deficit:</strong> No mapped training courses found on iGOT or NSSTA. Recommended for new course commissioning by TPAC.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedDemand.courses.map((c) => (
                          <div
                            key={c.id}
                            className="rounded border border-[#E5E7EB] bg-white p-2.5 flex items-center justify-between gap-2"
                          >
                            <div>
                              <p className="font-semibold text-[#111827] text-[12px]">{c.name}</p>
                              <p className="text-[11px] text-[#64748B]">
                                {c.provider} &bull; {mins(c.durationMins)}
                              </p>
                            </div>
                            {c.url && (
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-[#0284C7] hover:underline"
                              >
                                Open <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: READINESS BY DESIGNATION
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'readiness' && (
        <div className="space-y-6">
          <Card className="p-5">
            <CardHeader
              title="Cadre Readiness Aggregation"
              subtitle="Calculated as: (Evidenced Levels ÷ Required Target Levels) × 100 for each official, aggregated across designations."
            />

            <div className="mt-4 space-y-4">
              {data.readinessByDesignation.map((des) => (
                <div key={des.designation} className="rounded-lg border border-[#E5E7EB] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-[15px] text-[#111827]">{des.designation}</h3>
                      <p className="text-[12px] text-[#6B7280]">
                        {des.officersCount} statistical officer{des.officersCount === 1 ? '' : 's'} &bull;{' '}
                        {des.requirementsMet} of {des.requirementsAssigned} total requirements evidenced
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[20px] font-bold text-[#111827] tabular-nums">
                        {des.meanReadiness}%
                      </span>
                      <span className="block text-[11px] text-[#6B7280]">
                        Spread: {des.minReadiness}% - {des.maxReadiness}%
                      </span>
                    </div>
                  </div>

                  {/* Readiness Progress Bar */}
                  <div className="w-full h-3 rounded-full bg-[#E5E7EB] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        des.meanReadiness >= 80
                          ? 'bg-emerald-600'
                          : des.meanReadiness >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${des.meanReadiness}%` }}
                    />
                  </div>

                  {/* Bottom Insight Row */}
                  <div className="flex flex-wrap items-center justify-between text-[12px] pt-1 border-t border-[#F1F5F9]">
                    <div className="flex items-center gap-1.5 text-[#6B7280]">
                      <span>Primary Shortfall:</span>
                      {des.topGap ? (
                        <span className="font-semibold text-red-600">
                          {des.topGap.nameEn} (mean gap: -{des.topGap.meanGap} across {des.topGap.officersAffected} officers)
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-700">All Requirements Met ✓</span>
                      )}
                    </div>

                    <span className="font-semibold text-[#0284C7]">
                      Status: {des.readinessStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: SKILL-GAP HEATMAP (DESIGNATION X COMPETENCY)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'gaps' && (
        <div className="space-y-6">
          <Card className="p-5">
            <CardHeader
              title="Designation × Competency Skill-Gap Heatmap"
              subtitle="Mean gap by designation and competency. Darker red indicates a wider capability shortfall across that cadre."
              action={
                <div className="flex items-center gap-2 text-[11.5px] text-[#6B7280]">
                  <span>Met</span>
                  <span className="h-3 w-4 rounded-sm bg-[#D1FAE5] inline-block border border-[#A7F3D0]" />
                  <span className="h-3 w-4 rounded-sm bg-[#FEF3C7] inline-block border border-[#FDE68A]" />
                  <span className="h-3 w-4 rounded-sm bg-[#FED7AA] inline-block border border-[#FDBA74]" />
                  <span className="h-3 w-4 rounded-sm bg-[#FECACA] inline-block border border-[#FCA5A5]" />
                  <span className="h-3 w-4 rounded-sm bg-[#F87171] inline-block border border-[#EF4444]" />
                  <span>Critical Deficit</span>
                </div>
              }
            />

            {/* Matrix View */}
            <div className="overflow-x-auto mt-4 pb-2">
              <table className="border-separate border-spacing-1 text-[11.5px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-bold text-[#64748B]">
                      Competency
                    </th>
                    {data.heatmap.designations.map((d) => (
                      <th key={d} className="px-1 py-1 align-bottom">
                        <div
                          className="mx-auto h-36 w-6 whitespace-nowrap text-left font-semibold text-[#111827]"
                          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                        >
                          {d}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.heatmap.competencies.map((comp) => (
                    <tr key={comp.id}>
                      <th className="sticky left-0 z-10 whitespace-nowrap bg-white pr-3 text-left font-medium text-[#111827]">
                        <span className="truncate max-w-[200px] inline-block">{comp.name}</span>
                      </th>
                      {data.heatmap.designations.map((des) => {
                        const cell = data.heatmap.cells.find(
                          (c) => c.designation === des && c.competencyId === comp.id,
                        );
                        return (
                          <td key={`${des}|${comp.id}`} className="p-0">
                            <div
                              onMouseEnter={() =>
                                setHoveredCell(
                                  cell
                                    ? {
                                        designation: des,
                                        competencyName: comp.name,
                                        meanGap: cell.meanGap,
                                        meanScore: cell.meanScore,
                                        officers: cell.officers,
                                      }
                                    : null,
                                )
                              }
                              onMouseLeave={() => setHoveredCell(null)}
                              className="h-6 w-9 cursor-pointer rounded-sm border border-black/5 transition hover:scale-110 hover:shadow"
                              style={{
                                background: getCellColor(cell?.meanGap ?? null),
                              }}
                              title={
                                cell
                                  ? `${des} &bull; ${comp.name}\nMean Gap: -${cell.meanGap} (Score: ${cell.meanScore}%) across ${cell.officers} officer(s)`
                                  : `${des} &bull; ${comp.name}\nNo requirement`
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hover Tooltip Footnote */}
            <div className="mt-3 p-2.5 rounded bg-[#F8FAFC] border border-[#E5E7EB] text-[12.5px] text-[#111827]">
              {hoveredCell ? (
                <span>
                  <strong>{hoveredCell.designation}</strong> &bull;{' '}
                  <span className="text-[#0284C7] font-semibold">{hoveredCell.competencyName}</span>:{' '}
                  {hoveredCell.meanGap !== null ? (
                    <>
                      Mean gap deficit of <strong>-{hoveredCell.meanGap} levels</strong> (Average score:{' '}
                      <strong>{hoveredCell.meanScore}%</strong>) across{' '}
                      <strong>{hoveredCell.officers}</strong> officer{hoveredCell.officers === 1 ? '' : 's'}.
                    </>
                  ) : (
                    'No role requirement assigned for this cadre.'
                  )}
                </span>
              ) : (
                <span className="text-[#6B7280] italic">
                  Hover over any heatmap cell to inspect the exact gap deficit, verified score, and affected headcount.
                </span>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: TRAINING / COURSE COVERAGE
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'coverage' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Mapped Curriculum
              </p>
              <p className="text-[26px] font-bold text-[#111827] mt-1">
                {data.courseCoverage.coveredCount} / {data.courseCoverage.totalCompetencies}
              </p>
              <p className="text-[11.5px] text-emerald-700 font-semibold mt-0.5">
                {data.courseCoverage.coveragePct}% catalog coverage
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Uncovered Competencies
              </p>
              <p className="text-[26px] font-bold text-amber-700 mt-1">
                {data.courseCoverage.uncoveredCount}
              </p>
              <p className="text-[11.5px] text-[#6B7280] mt-0.5">Skills without existing courses</p>
            </Card>

            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Active LMS Courses
              </p>
              <p className="text-[26px] font-bold text-[#0284C7] mt-1">{data.courseCoverage.totalCourses}</p>
              <p className="text-[11.5px] text-[#6B7280] mt-0.5">iGOT Karmayogi &amp; NSSTA modules</p>
            </Card>
          </div>

          {/* Actionable Uncovered Demands (Where Training Budget Must Go) */}
          <Card className="p-5">
            <CardHeader
              title="Urgent Curriculum Gaps (High Demand Skills Lacking Training Solutions)"
              subtitle="These competencies have identified workforce shortages but ZERO mapped courses in the catalog. NSSTA Training Advisory Committee should prioritize commissioning modules here."
            />

            <div className="mt-4 space-y-3">
              {data.courseCoverage.uncoveredHighDemand.length === 0 ? (
                <p className="text-[13px] text-emerald-700 font-semibold p-4 bg-emerald-50 rounded border border-emerald-200">
                  All high-demand workforce competencies currently have mapped courses available on iGOT or NSSTA.
                </p>
              ) : (
                data.courseCoverage.uncoveredHighDemand.map((d) => (
                  <div
                    key={d.competencyId}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-amber-200 bg-amber-50/60"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[14px] text-[#111827]">{d.nameEn}</span>
                        <Badge tone="primary">{d.domain}</Badge>
                        {d.isUrgent && <Badge tone="critical">Survey Priority</Badge>}
                      </div>
                      <p className="text-[12px] text-[#6B7280] mt-0.5">
                        Area: {d.area} &bull; Affects {d.officersAffected} officers (Mean deficit: -{d.meanGap} levels)
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] font-bold text-red-600 bg-white px-2 py-1 rounded border border-red-200">
                        0 Courses Mapped
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 5: WORKFORCE OVERVIEW
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Cadre Summary */}
            <Card className="p-5">
              <CardHeader
                title="Cadre Distribution &amp; Readiness"
                subtitle="Readiness score broken down by professional civil service cadre."
              />
              <div className="mt-3 space-y-3">
                {data.overview.cadreSummary.map((c) => (
                  <div key={c.cadre} className="p-3 rounded border border-[#E5E7EB] bg-[#F8FAFC]">
                    <div className="flex items-center justify-between text-[13px] mb-1.5">
                      <span className="font-semibold text-[#111827]">{c.cadre}</span>
                      <span className="font-bold text-[#0284C7]">{c.meanReadiness}% Readiness</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                      <div className="h-full rounded-full bg-[#0284C7]" style={{ width: `${c.meanReadiness}%` }} />
                    </div>
                    <p className="text-[11px] text-[#6B7280] mt-1">{c.count} registered personnel</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Department Summary */}
            <Card className="p-5">
              <CardHeader
                title="Departmental Division Breakdown"
                subtitle="Personnel headcount and average capability rating by MoSPI directorate."
              />
              <div className="mt-3 space-y-3">
                {data.overview.departmentSummary.map((d) => (
                  <div key={d.departmentId} className="p-3 rounded border border-[#E5E7EB] bg-[#F8FAFC]">
                    <div className="flex items-center justify-between text-[13px] mb-1.5">
                      <span className="font-semibold text-[#111827]">{d.departmentName}</span>
                      <span className="font-bold text-[#0284C7]">{d.meanReadiness}% Readiness</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                      <div className="h-full rounded-full bg-[#0284C7]" style={{ width: `${d.meanReadiness}%` }} />
                    </div>
                    <p className="text-[11px] text-[#6B7280] mt-1">{d.count} registered personnel</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
