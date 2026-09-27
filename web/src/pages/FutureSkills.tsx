import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, ShieldCheck, Compass,
  FlaskConical, AlertCircle, RefreshCw, ChevronRight
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, CardHeader, Button, Badge } from '../components/ui.js';
import { useTranslation } from '../lib/i18n/index.js';

interface FutureSkillArea {
  id: string;
  name: string;
  category: string;
  priority: 'High' | 'Medium' | 'Horizon';
  description: string;
  mappedCompetencies: string[];
  relevanceRationale: string;
}

interface FutureSkillsData {
  data: {
    officialId: string;
    officialName: string;
    currentRole: string;
    desiredRole: string;
    readinessScore: number;
    totalGapsCount: number;
    criticalGapsCount: number;
    prioritySkillAreas: FutureSkillArea[];
    pedagogicalSummary: string;
    growthVectors: {
      vectorName: string;
      currentProgress: number;
      targetProgress: number;
      description: string;
    }[];
    disclaimer: string;
  };
  source: 'gemini' | 'fallback';
  notice: string;
  executionTimeMs: number;
}

export function FutureSkills() {
  const { t } = useTranslation();
  const [data, setData] = useState<FutureSkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulateFallback, setSimulateFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFutureSkills = async (simulate = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<FutureSkillsData>(`/learner/future-skills${simulate ? '?simulate=true' : ''}`);
      setData(res);
    } catch {
      setError('Unable to load future-skill insights. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFutureSkills(simulateFallback);
  }, [simulateFallback]);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-primary" />
        <span className="ml-2 text-sm text-subtle">Generating future-skill analysis...</span>
      </div>
    );
  }

  const profile = data?.data;
  const isAi = data?.source === 'gemini';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-ink">
              {t('futureSkills.title', 'Predictive Future-Skill Insights')}
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                isAi
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-surface border-border text-subtle'
              }`}
            >
              {isAi ? (
                <>
                  <Sparkles size={11} className="text-primary" /> Gemini AI-Enhanced
                </>
              ) : (
                <>
                  <ShieldCheck size={11} className="text-subtle" /> STATINTEL Built-in Engine
                </>
              )}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted max-w-2xl">
            {t(
              'futureSkills.subtitle',
              'Data-driven skill trajectories and learning priorities based on your current role, desired transition, and competency gaps.',
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSimulateFallback(!simulateFallback)}
            className="text-[12px] border border-border"
          >
            {simulateFallback ? 'Use Live AI' : 'Simulate Local Fallback'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fetchFutureSkills(simulateFallback)}
            disabled={loading}
          >
            <RefreshCw size={13} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-critical/30 bg-critical/10 p-3 text-xs text-critical">
          {error}
        </div>
      )}

      {/* Official Disclaimer Banner */}
      <div className="rounded-lg border border-border bg-surface p-3.5 flex items-start gap-2.5 text-[12px] text-subtle">
        <AlertCircle size={16} className="shrink-0 text-primary mt-0.5" />
        <p className="leading-relaxed">
          <strong>Official Methodology Note:</strong> {profile?.disclaimer || t('futureSkills.disclaimer')}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Current Job Role</p>
          <p className="text-[18px] font-bold text-ink mt-1 truncate">{profile?.currentRole}</p>
          <p className="text-[11px] text-muted mt-0.5">Verified official profile</p>
        </Card>

        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Target Next Role</p>
          <p className="text-[18px] font-bold text-primary mt-1 truncate">{profile?.desiredRole}</p>
          <p className="text-[11px] text-muted mt-0.5">Career pathway goal</p>
        </Card>

        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Cadre Readiness Score</p>
          <p className="text-[24px] font-bold text-ink mt-0.5 font-mono">{profile?.readinessScore}%</p>
          <p className="text-[11px] text-muted">Baseline competency index</p>
        </Card>

        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Active Competency Gaps</p>
          <p className="text-[24px] font-bold text-critical mt-0.5 font-mono">{profile?.totalGapsCount}</p>
          <p className="text-[11px] text-muted">{profile?.criticalGapsCount} critical priority</p>
        </Card>
      </div>

      {/* Pedagogical Synthesis */}
      <Card className="overflow-hidden border-primary/20">
        <div className="bg-primary-soft/40 border-b border-primary/20 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-primary" />
            <h3 className="text-[15px] font-bold text-ink">Pedagogical Career Transition Overview</h3>
          </div>
          <span className="text-[11px] font-medium text-primary bg-primary-soft px-2.5 py-0.5 rounded border border-primary/20">
            {data?.notice}
          </span>
        </div>
        <div className="p-5">
          <p className="text-[14px] leading-relaxed text-ink">
            {profile?.pedagogicalSummary}
          </p>

          <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-3 items-center justify-between">
            <span className="text-[12px] text-muted">
              Ready to take action on these insights?
            </span>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/gaps"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline bg-surface border border-border px-3 py-1.5 rounded"
              >
                <span>View Skill Gaps</span>
                <ChevronRight size={13} />
              </Link>
              <Link
                to="/learner/virtual-lab"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-hover px-3 py-1.5 rounded transition-colors"
              >
                <FlaskConical size={13} />
                <span>Practice in Virtual Lab</span>
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* Priority Skill Areas */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-ink">
            {t('futureSkills.priorityAreas', 'Priority Future Skill Areas')}
          </h2>
          <span className="text-[12px] text-subtle">
            Mapped to {profile?.desiredRole} requirements
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {profile?.prioritySkillAreas.map((area) => (
            <Card key={area.id} className="p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-[11px] font-bold text-subtle bg-raised px-2 py-0.5 rounded border border-border">
                    {area.id}
                  </span>
                  <Badge tone={area.priority === 'High' ? 'critical' : 'primary'}>
                    {area.priority} Priority
                  </Badge>
                </div>

                <h3 className="text-[15px] font-bold text-ink">{area.name}</h3>
                <p className="mt-1 text-[13px] text-muted leading-relaxed">{area.description}</p>

                <div className="mt-3.5 rounded bg-raised/40 border border-border p-2.5 text-[12px]">
                  <p className="font-semibold text-ink text-[11px] uppercase tracking-wider mb-1">
                    Relevance Rationale:
                  </p>
                  <p className="text-subtle">{area.relevanceRationale}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {area.mappedCompetencies.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded bg-raised text-subtle text-[11px] font-medium"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-primary">{area.category}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Growth Vectors */}
      <Card>
        <CardHeader
          title={t('futureSkills.growthVectors', 'Competency Growth Vectors')}
          subtitle="Progress distribution across critical competency clusters for official statistics."
        />
        <div className="p-5 space-y-5">
          {profile?.growthVectors.map((v) => (
            <div key={v.vectorName} className="space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-semibold text-ink">{v.vectorName}</span>
                <span className="font-mono text-[12px] font-semibold text-subtle">
                  {v.currentProgress}% / 100%
                </span>
              </div>
              <div className="h-2.5 w-full rounded bg-raised overflow-hidden border border-border/60">
                <div
                  className="h-full rounded bg-primary transition-all duration-500"
                  style={{ width: `${v.currentProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-subtle">{v.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
