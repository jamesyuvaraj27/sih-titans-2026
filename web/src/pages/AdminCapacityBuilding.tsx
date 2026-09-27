import { useState } from 'react';
import { Sparkles, ShieldCheck, Cpu, TrendingUp, RefreshCw } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { num, DOMAIN_NAME } from '../lib/format.js';
import { Alert, Badge, Button, Card, CardHeader, Spinner, Td, Th } from '../components/ui.js';

interface CapacityData {
  totalOfficials: number;
  totalGapsIdentified: number;
  criticalGapsCount: number;
  topShortages: {
    competencyId: string;
    nameEn: string;
    domain: string;
    gapCount: number;
    severityScore: number;
    isEmerging: boolean;
  }[];
  emergingSkillsSummary: {
    cluster: string;
    demandLevel: 'High' | 'Critical' | 'Moderate';
    rationale: string;
    keyCompetencies: string[];
  }[];
  departmentDemand: {
    departmentId: string;
    departmentName: string;
    officialsCount: number;
    unmetRequirementsCount: number;
  }[];
  executiveBriefing: string;
  methodologyNote: string;
  aiExecution: {
    provider: string;
    sovereign: boolean;
    latencyMs: number;
    fallbackUsed: boolean;
    reason?: string;
  };
}

export function AdminCapacityBuilding() {
  const [simulateFallback, setSimulateFallback] = useState(false);
  const { data, loading, error, reload } = useAsync<CapacityData>(
    () => api(`/admin/capacity-building${simulateFallback ? '?simulate=true' : ''}`),
    [simulateFallback],
  );

  if (loading && !data) return <Spinner label="Synthesizing workforce capacity intelligence..." />;
  if (error) return <Alert tone="critical" title="Could not load capacity building analytics">{error}</Alert>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold tracking-tight text-ink">Future Skills &amp; Capacity Building</h1>
            <Badge tone="primary" icon={<Sparkles size={12} />}>SIH26101 Predictive Engine</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-[14px] text-muted">
            Predictive workforce intelligence analyzing statistical competency shortages, emerging technology requirements,
            and capacity building demands across all operational departments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={simulateFallback ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setSimulateFallback(!simulateFallback)}
            title="Toggle between Primary AI Provider and Local Deterministic Engine"
          >
            {simulateFallback ? 'Simulating Local Engine' : 'Test Fallback Mode'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => reload()}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </header>

      {/* KPI Overview */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Workforce in Scope</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{num(data.totalOfficials)}</p>
          <p className="mt-1 text-[12px] text-muted">officials across all central &amp; state cadres</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Identified Competency Gaps</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-primary">{num(data.totalGapsIdentified)}</p>
          <p className="mt-1 text-[12px] text-muted">unmet target levels against role requirements</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Critical Priority Shortages</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-critical">{data.criticalGapsCount}</p>
          <p className="mt-1 text-[12px] text-muted">immediate capacity building required</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Emerging Technology Clusters</p>
          <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">{data.emergingSkillsSummary.length}</p>
          <p className="mt-1 text-[12px] text-muted">future national statistical priorities</p>
        </Card>
      </div>

      {/* AI Executive Briefing */}
      <Card className="overflow-hidden border-primary/20 bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary-soft/40 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h2 className="text-[14px] font-semibold text-ink">AI Executive Capacity Briefing</h2>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 rounded bg-surface px-2 py-0.5 font-medium border border-border text-ink">
              <Cpu size={12} className="text-primary" />
              Engine: {data.aiExecution.provider}
            </span>
            {data.aiExecution.fallbackUsed && (
              <span className="rounded bg-moderate/15 border border-moderate/30 px-2 py-0.5 font-medium text-moderate">
                Fallback Active ({data.aiExecution.reason || 'Local Rules'})
              </span>
            )}
            <span className="rounded bg-surface px-2 py-0.5 text-subtle border border-border">
              {data.aiExecution.latencyMs} ms
            </span>
          </div>
        </div>
        <div className="p-4 text-[13px] leading-relaxed text-ink space-y-2">
          {data.executiveBriefing.split('\n\n').map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      </Card>

      {/* Emerging Skill Clusters */}
      <div>
        <h2 className="text-[16px] font-bold text-ink mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          Emerging Competency Areas &amp; Future Skill Requirements
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {data.emergingSkillsSummary.map((cluster) => (
            <Card key={cluster.cluster} className="p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[14px] font-semibold text-ink">{cluster.cluster}</h3>
                  <Badge
                    tone={
                      cluster.demandLevel === 'Critical'
                        ? 'critical'
                        : cluster.demandLevel === 'High'
                        ? 'moderate'
                        : 'neutral'
                    }
                  >
                    {cluster.demandLevel} Demand
                  </Badge>
                </div>
                <p className="mt-2 text-[12px] text-muted leading-relaxed">{cluster.rationale}</p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border flex flex-wrap gap-1.5">
                {cluster.keyCompetencies.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex rounded bg-raised px-2 py-0.5 text-[11px] font-medium text-ink border border-border"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Shortages Table */}
        <Card>
          <CardHeader
            title="Workforce Competency Shortages"
            subtitle="Prioritized by gap breadth and role criticality"
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-raised/50">
                  <Th>Competency</Th>
                  <Th>Domain</Th>
                  <Th align="right">Gap Count</Th>
                  <Th align="right">Severity</Th>
                </tr>
              </thead>
              <tbody>
                {data.topShortages.map((s) => (
                  <tr key={s.competencyId} className="border-b border-border hover:bg-surface">
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-ink">{s.nameEn}</span>
                        {s.isEmerging && (
                          <span className="rounded bg-primary-soft text-primary border border-primary/20 px-1 text-[10px] font-semibold">
                            Emerging
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{DOMAIN_NAME[s.domain] || s.domain}</Badge>
                    </Td>
                    <Td align="right">
                      <span className="tnum font-medium text-ink">{s.gapCount}</span>
                    </Td>
                    <Td align="right">
                      <span
                        className={`tnum font-bold ${
                          s.severityScore >= 6 ? 'text-critical' : s.severityScore >= 4 ? 'text-moderate' : 'text-ink'
                        }`}
                      >
                        {s.severityScore}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Departmental Training Demand */}
        <Card>
          <CardHeader
            title="Departmental Training Demand"
            subtitle="Distribution of unmet competencies by division"
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-raised/50">
                  <Th>Department</Th>
                  <Th align="right">Staff</Th>
                  <Th align="right">Unmet Needs</Th>
                  <Th align="right">Capacity Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.departmentDemand.map((d) => (
                  <tr key={d.departmentId} className="border-b border-border hover:bg-surface">
                    <Td>
                      <span className="font-medium text-ink">{d.departmentName}</span>
                    </Td>
                    <Td align="right">
                      <span className="tnum text-muted">{d.officialsCount}</span>
                    </Td>
                    <Td align="right">
                      <span className="tnum font-semibold text-critical">{d.unmetRequirementsCount}</span>
                    </Td>
                    <Td align="right">
                      <Badge tone={d.unmetRequirementsCount > 8 ? 'critical' : 'moderate'}>
                        {d.unmetRequirementsCount > 8 ? 'High Priority' : 'Active Training'}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Methodology and Governance Note */}
      <Card className="bg-raised/40 p-4 border-border">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" />
          <div className="text-[12px] text-muted space-y-1">
            <p className="font-semibold text-ink">SIH26101 Methodology &amp; Data Integrity Guarantee:</p>
            <p>{data.methodologyNote}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
