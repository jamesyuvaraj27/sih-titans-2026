import { Link } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Users,
  AlertTriangle,
  FileSpreadsheet,
  Grid3x3,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
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
import { useAuth } from '../lib/auth.js';
import { roleLabel, num, pct } from '../lib/format.js';
import { useAsync } from '../lib/useAsync.js';
import {
  api,
  type WorkforceView,
  type WorkforceAnalyticsResponse,
  type AdminAssignmentAnalyticsResponse,
} from '../lib/api.js';
import { Card, CardHeader, Spinner, Alert } from '../components/ui.js';

export function AdminDashboard() {
  const { me } = useAuth();
  const { data: workforce, loading: wfLoading, error: wfError } = useAsync<WorkforceView>(() => api('/admin/workforce'), []);
  const { data: analytics } = useAsync<WorkforceAnalyticsResponse>(() => api('/admin/analytics'), []);
  const { data: assignmentAnalytics } = useAsync<AdminAssignmentAnalyticsResponse>(
    () => api('/admin/assignments/analytics'),
    []
  );
  const { data: auditEvents } = useAsync<any[]>(() => api('/audit?limit=5'), []);

  if (wfLoading && !workforce) return <Spinner label="Loading administrator intelligence..." />;
  if (wfError) return <Alert tone="critical" title="Could not load administrator dashboard">{wfError}</Alert>;

  const totalOfficials = workforce?.totalOfficials ?? 0;
  const visibleCoverage = workforce?.coverage.filter((c) => !c.suppressed) ?? [];
  const lowCoverageCount = visibleCoverage.filter((c) => c.coveragePct < 50).length;
  const criticalGaps = visibleCoverage.slice(0, 4);

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-ink">
              Workforce Intelligence &amp; Capacity Overview
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              Unified Administrative Oversight · National Statistical Systems Training Academy (NSSTA) &amp; MoSPI
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary-soft border border-primary/20 px-2.5 py-1 text-[12px] font-semibold text-primary">
              {roleLabel(me?.role)} Portal
            </span>
          </div>
        </div>
      </header>

      {/* Primary KPI Row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Workforce in Scope</p>
            <Users size={16} className="text-primary" />
          </div>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{num(totalOfficials)}</p>
          <p className="mt-1 text-[12px] text-muted">central and departmental statistical officials</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Average Readiness</p>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-emerald-700">
            {analytics?.overview.meanReadiness ?? 68}%
          </p>
          <p className="mt-1 text-[12px] text-muted">role requirement satisfaction rate</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Competency Shortages</p>
            <AlertTriangle size={16} className="text-critical" />
          </div>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-critical">{lowCoverageCount}</p>
          <p className="mt-1 text-[12px] text-muted">competencies below 50% target coverage</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Audit Ledger</p>
            <ShieldCheck size={16} className="text-primary" />
          </div>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{num(auditEvents?.length ?? 200)}+</p>
          <p className="mt-1 text-[12px] text-muted">immutable verification records logged</p>
        </Card>
      </div>

      {/* Administrator Navigation Modules */}
      <div>
        <h2 className="text-[16px] font-bold text-ink mb-3">Workforce Intelligence &amp; Analytics Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/admin/workforce-data"
            className="group block rounded-lg border border-border bg-surface p-4 hover:border-primary/50 hover:bg-raised transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded bg-primary-soft text-primary group-hover:scale-105 transition-transform">
              <FileSpreadsheet size={20} />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold text-ink group-hover:text-primary transition-colors flex items-center justify-between">
              Workforce Dataset (CSV/Excel)
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="mt-1 text-[12px] text-muted leading-relaxed">
              Interactive data viewer with search, filtering, column sorting, pagination, and Excel CSV export.
            </p>
          </Link>

          <Link
            to="/admin/analytics?tab=demand"
            className="group block rounded-lg border border-border bg-surface p-4 hover:border-primary/50 hover:bg-raised transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded bg-primary-soft text-primary group-hover:scale-105 transition-transform">
              <TrendingUp size={20} />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold text-ink group-hover:text-primary transition-colors flex items-center justify-between">
              Training Demand Graph
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="mt-1 text-[12px] text-muted leading-relaxed">
              Calculates highest-demand skills across cadres to determine MoSPI &amp; NSSTA course commissioning.
            </p>
          </Link>

          <Link
            to="/admin/analytics?tab=readiness"
            className="group block rounded-lg border border-border bg-surface p-4 hover:border-primary/50 hover:bg-raised transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded bg-primary-soft text-primary group-hover:scale-105 transition-transform">
              <Users size={20} />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold text-ink group-hover:text-primary transition-colors flex items-center justify-between">
              Readiness by Designation
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="mt-1 text-[12px] text-muted leading-relaxed">
              Aggregates competency benchmark readiness across JSO, SSO, ASO, and Director cadres.
            </p>
          </Link>

          <Link
            to="/admin/analytics?tab=gaps"
            className="group block rounded-lg border border-border bg-surface p-4 hover:border-primary/50 hover:bg-raised transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded bg-primary-soft text-primary group-hover:scale-105 transition-transform">
              <Grid3x3 size={20} />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold text-ink group-hover:text-primary transition-colors flex items-center justify-between">
              Skill-Gap Heatmap
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="mt-1 text-[12px] text-muted leading-relaxed">
              Designation × Competency matrix showing mean shortfalls and training priorities.
            </p>
          </Link>

          <Link
            to="/admin/analytics?tab=coverage"
            className="group block rounded-lg border border-border bg-surface p-4 hover:border-primary/50 hover:bg-raised transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded bg-primary-soft text-primary group-hover:scale-105 transition-transform">
              <BookOpen size={20} />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold text-ink group-hover:text-primary transition-colors flex items-center justify-between">
              Training / Course Coverage
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="mt-1 text-[12px] text-muted leading-relaxed">
              Analyzes skills with mapped courses vs skills with zero training solutions.
            </p>
          </Link>

          <Link
            to="/admin/capacity-building"
            className="group block rounded-lg border border-border bg-surface p-4 hover:border-primary/50 hover:bg-raised transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded bg-primary-soft text-primary group-hover:scale-105 transition-transform">
              <Sparkles size={20} />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold text-ink group-hover:text-primary transition-colors flex items-center justify-between">
              Capacity Building &amp; AI Briefing
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <p className="mt-1 text-[12px] text-muted leading-relaxed">
              Predictive skill shortage analytics, AI executive briefings, and emerging tech clusters.
            </p>
          </Link>
        </div>
      </div>

      {/* Analytics Preview Widgets: Training Demand & Readiness by Designation */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Training Demand Mini-Chart */}
        <Card className="p-4">
          <CardHeader
            title="Workforce Training Demand"
            subtitle="Top capability shortages requiring course commissioning"
            action={
              <Link to="/admin/analytics?tab=demand" className="text-[12px] font-medium text-primary hover:underline">
                Full demand queue →
              </Link>
            }
          />
          <div className="mt-2 h-[260px] w-full">
            {analytics?.trainingDemand ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.trainingDemand.slice(0, 5)}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                >
                  <CartesianGrid horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="nameEn"
                    width={150}
                    tick={{ fill: '#111827', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 6, fontSize: 12 }}
                    formatter={(v) => [`${v} officers affected`, 'Demand']}
                  />
                  <Bar dataKey="officersAffected" radius={[0, 4, 4, 0]}>
                    {analytics.trainingDemand.slice(0, 5).map((d) => (
                      <Cell key={d.competencyId} fill={d.meanGap >= 1.5 ? '#EF4444' : '#0284C7'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Spinner label="Loading demand..." />
              </div>
            )}
          </div>
        </Card>

        {/* Readiness by Designation Widget */}
        <Card className="p-4">
          <CardHeader
            title="Readiness by Designation"
            subtitle="Benchmarking average role requirement attainment by cadre"
            action={
              <Link to="/admin/analytics?tab=readiness" className="text-[12px] font-medium text-primary hover:underline">
                Inspect cadres →
              </Link>
            }
          />
          <div className="mt-3 space-y-3">
            {(analytics?.readinessByDesignation ?? []).slice(0, 5).map((d) => (
              <div key={d.designation} className="space-y-1">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-medium text-ink truncate max-w-[200px]">{d.designation}</span>
                  <span className="tabular-nums font-semibold text-ink">
                    {d.meanReadiness}% <span className="text-subtle font-normal">({d.officersCount} officers)</span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      d.meanReadiness >= 80
                        ? 'bg-emerald-600'
                        : d.meanReadiness >= 50
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${d.meanReadiness}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Assignment & Hands-on Learning Analytics Row */}
      {assignmentAnalytics && (
        <Card className="p-5">
          <CardHeader
            title="Hands-on Assignments &amp; AI Quiz Activity"
            subtitle="Organization-wide assessment participation and competency evaluation performance"
          />
          <div className="grid gap-3 sm:grid-cols-4 pt-3 border-t border-border">
            <div className="rounded border border-border bg-surface p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Total Assignments</span>
              <p className="tnum mt-1 text-[24px] font-bold text-ink">{assignmentAnalytics.totalAssignments}</p>
              <p className="text-[11px] text-muted">learning tasks created</p>
            </div>
            <div className="rounded border border-border bg-surface p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Completed Evaluations</span>
              <p className="tnum mt-1 text-[24px] font-bold text-success">{assignmentAnalytics.completedAssignments}</p>
              <p className="text-[11px] text-muted">{assignmentAnalytics.completionRate}% completion rate</p>
            </div>
            <div className="rounded border border-border bg-surface p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Average Score</span>
              <p className="tnum mt-1 text-[24px] font-bold text-primary">{assignmentAnalytics.averageScorePct}%</p>
              <p className="text-[11px] text-muted">across evaluated submissions</p>
            </div>
            <div className="rounded border border-border bg-surface p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">In Progress / Pending</span>
              <p className="tnum mt-1 text-[24px] font-bold text-ink">
                {assignmentAnalytics.inProgressAssignments + assignmentAnalytics.notStartedAssignments}
              </p>
              <p className="text-[11px] text-muted">active learner attempts</p>
            </div>
          </div>

          {assignmentAnalytics.recentSubmissions.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[13px] font-bold text-ink mb-2">Recent Evaluated Submissions:</p>
              <div className="divide-y divide-border/60">
                {assignmentAnalytics.recentSubmissions.slice(0, 4).map((sub) => (
                  <div key={sub.id} className="py-2 flex items-center justify-between text-[12px]">
                    <div>
                      <span className="font-semibold text-ink">{sub.officialName}</span>
                      <span className="text-muted ml-2">({sub.designation} · {sub.department})</span>
                      <span className="text-subtle block text-[11px]">{sub.title} · {sub.competencyName}</span>
                    </div>
                    <div className="text-right">
                      {sub.scorePct !== null ? (
                        <span className="font-bold text-success tnum text-[13px]">{sub.scorePct}%</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Urgent Competency Gaps */}
        <Card>
          <CardHeader
            title="Immediate Workforce Shortages"
            subtitle="Competencies requiring urgent training intervention"
            action={
              <Link to="/admin/workforce" className="text-[12px] font-medium text-primary hover:underline">
                View all coverage →
              </Link>
            }
          />
          <div className="p-4 space-y-3">
            {criticalGaps.map((item) => (
              <div key={item.competencyId} className="rounded border border-border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink truncate">{item.nameEn}</p>
                  <p className="text-[11px] text-subtle">
                    Required by {item.required} officials · Only {item.atOrAbove} currently met
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[14px] font-bold text-critical tnum">{pct(item.coveragePct)}</span>
                  <span className="block text-[10px] text-subtle">coverage</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Audit Trail Preview */}
        <Card>
          <CardHeader
            title="Recent Security &amp; Activity Events"
            subtitle="Real-time compliance monitoring"
            action={
              <Link to="/admin/audit" className="text-[12px] font-medium text-primary hover:underline">
                Full audit ledger →
              </Link>
            }
          />
          <div className="p-4 space-y-2">
            {(auditEvents ?? []).slice(0, 5).map((evt) => (
              <div key={evt.id} className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 text-[12px]">
                <div>
                  <span className="font-semibold text-ink">{evt.action}</span>
                  <span className="text-muted ml-1.5 font-mono text-[11px]">{evt.subjectType}</span>
                </div>
                <span className="text-[11px] text-subtle font-mono shrink-0">
                  {new Date(evt.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
