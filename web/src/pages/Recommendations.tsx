import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, ShieldCheck, BookOpen, FlaskConical, Clock, Award,
  ExternalLink, RefreshCw, ChevronRight, ArrowUpRight
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, Button, Badge } from '../components/ui.js';
import { useTranslation } from '../lib/i18n/index.js';

interface RecommendedCourseItem {
  id: string;
  name: string;
  provider: string;
  durationMins: number;
  level: string;
  url: string | null;
  completionRate: number;
  addressesCompetency: string;
  competencyId: string;
  severity: number;
  whyRecommended: string;
}

interface RecommendedLabItem {
  labId: string;
  title: string;
  difficulty: string;
  estimatedMinutes: number;
  addressesConcept: string;
  route: string;
  whyRecommended: string;
}

interface RecommendationsData {
  data: {
    learner: {
      officialId: string;
      name: string;
      currentRole: string;
      desiredRole: string;
      skills: string[];
    };
    topGapsSummary: {
      totalGaps: number;
      topGapNames: string[];
    };
    recommendedCourses: RecommendedCourseItem[];
    recommendedLabs: RecommendedLabItem[];
    overallRationale: string;
    actionPlan: string[];
  };
  source: 'gemini' | 'fallback';
  notice: string;
  executionTimeMs: number;
}

export function Recommendations() {
  const { t } = useTranslation();
  const [data, setData] = useState<RecommendationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulateFallback, setSimulateFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async (simulate = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<RecommendationsData>(`/learner/recommendations${simulate ? '?simulate=true' : ''}`);
      setData(res);
    } catch {
      setError('Unable to load personalized recommendations. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations(simulateFallback);
  }, [simulateFallback]);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-primary" />
        <span className="ml-2 text-sm text-subtle">Generating personalized curriculum recommendations...</span>
      </div>
    );
  }

  const rec = data?.data;
  const isAi = data?.source === 'gemini';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-ink">
              {t('recommendations.title', 'Personalized Learning Recommendations')}
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
              'recommendations.subtitle',
              'Curated courses, practical lab exercises, and targeted learning modules mapped directly to your verified competency gaps.',
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
            onClick={() => fetchRecommendations(simulateFallback)}
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

      {/* Learner Context Card */}
      <div className="rounded-lg border border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Learner Profile</p>
            <p className="text-[14px] font-bold text-ink">{rec?.learner.name}</p>
          </div>
          <div className="h-7 w-[1px] bg-border hidden sm:block"></div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Career Transition</p>
            <p className="text-[13px] font-medium text-ink">
              {rec?.learner.currentRole} <span className="text-primary font-bold">→</span> {rec?.learner.desiredRole}
            </p>
          </div>
          <div className="h-7 w-[1px] bg-border hidden sm:block"></div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Verified Gaps</p>
            <p className="text-[13px] font-semibold text-critical">
              {rec?.topGapsSummary.totalGaps} Areas Requiring Evidence
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to="/gaps"
            className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Review Skill Gaps</span>
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* Pedagogical Rationale Card */}
      <Card className="border-primary/20 overflow-hidden">
        <div className="bg-primary-soft/40 border-b border-primary/20 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h3 className="text-[14px] font-bold text-ink">
              {t('recommendations.whyRecommended', 'Why this is recommended for you')}
            </h3>
          </div>
          <span className="text-[11px] font-medium text-primary bg-primary-soft px-2 py-0.5 rounded border border-primary/20">
            {data?.notice}
          </span>
        </div>
        <div className="p-5">
          <p className="text-[14px] leading-relaxed text-ink">
            {rec?.overallRationale}
          </p>

          <div className="mt-4 pt-3.5 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle mb-2">
              Suggested 3-Step Next Actions:
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {rec?.actionPlan.map((action, idx) => (
                <div
                  key={idx}
                  className="rounded border border-border/80 bg-surface p-2.5 text-[12px] flex items-start gap-2"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary-soft text-primary font-bold text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="text-ink leading-snug">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Continuous Learning Loop Banner */}
      <div className="rounded-lg border border-primary/20 bg-surface p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
          <RefreshCw size={13} /> SIH26101 Continuous Adaptive Learning Cycle
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-ink">
          <span className="rounded bg-raised border border-border px-2 py-1">1. Diagnostic Assessment</span>
          <span className="text-subtle font-bold">→</span>
          <span className="rounded bg-raised border border-border px-2 py-1">2. Competency Score Ledger</span>
          <span className="text-subtle font-bold">→</span>
          <span className="rounded bg-critical/10 text-critical border border-critical/20 px-2 py-1">3. Automated Skill Gap</span>
          <span className="text-subtle font-bold">→</span>
          <span className="rounded bg-primary-soft text-primary border border-primary/20 px-2 py-1 font-semibold">4. Personalized Recommendation</span>
          <span className="text-subtle font-bold">→</span>
          <span className="rounded bg-raised border border-border px-2 py-1">5. iGOT / NSSTA Training &amp; Virtual Lab</span>
          <span className="text-subtle font-bold">→</span>
          <span className="rounded bg-raised border border-border px-2 py-1">6. Verification Milestone Quiz</span>
          <span className="text-subtle font-bold">→</span>
          <span className="rounded bg-success/10 text-success border border-success/20 px-2 py-1 font-semibold">7. Updated Competency Profile</span>
        </div>
      </div>

      {/* iGOT & NSSTA Integration Architecture */}
      <div className="rounded-lg border border-border bg-raised/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            <h3 className="text-[13px] font-bold text-ink">iGOT Karmayogi &amp; NSSTA TPAC Integration Architecture</h3>
          </div>
          <span className="rounded border border-primary/30 bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
            Prototype / Integration-Ready Sandbox Catalogue
          </span>
        </div>
        <p className="text-[12px] text-muted leading-relaxed">
          <strong>Architecture:</strong> STATINTEL → Integration Adapter → iGOT / NSSTA API → Course Modules &amp; Training Programmes → Webhook Attestation → Competency Score Update.
          (Note: Connected to verified local prototype catalogue. Live government production endpoints require department network clearance).
        </p>
      </div>

      {/* Recommended Catalog Courses */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-ink flex items-center gap-2">
              <BookOpen size={18} className="text-primary" />
              <span>{t('recommendations.topCourses', 'Recommended Catalog Courses')}</span>
            </h2>
            <p className="text-[12px] text-muted">
              Distinguished course modules and TPAC programmes mapped to your verified competency gaps.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {rec?.recommendedCourses.map((course) => {
            const isIgot = course.provider?.toUpperCase().includes('IGOT');
            return (
              <Card key={course.id} className="p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-[10px] font-bold text-subtle bg-raised px-2 py-0.5 rounded border border-border">
                      {course.id}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${
                        isIgot
                          ? 'bg-primary-soft text-primary border-primary/25'
                          : 'bg-raised text-ink border-border'
                      }`}>
                        {isIgot ? 'iGOT Course Module' : 'NSSTA TPAC Programme'}
                      </span>
                      <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-subtle border border-border">
                        Integration-Ready
                      </span>
                      <Badge tone="neutral">{course.level}</Badge>
                    </div>
                  </div>

                  <h3 className="text-[16px] font-bold text-ink leading-snug">{course.name}</h3>

                  <div className="mt-3 rounded bg-surface/90 border border-border p-2.5 text-[12px]">
                    <p className="font-semibold text-primary text-[11px] uppercase tracking-wider mb-0.5">
                      Bridges Gap:
                    </p>
                    <p className="text-ink font-medium">{course.addressesCompetency}</p>
                    <p className="text-subtle text-[11px] mt-1">{course.whyRecommended}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[12px] text-subtle">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {Math.round(course.durationMins / 60)} hrs
                    </span>
                    <span className="flex items-center gap-1">
                      <Award size={12} /> {Math.round(course.completionRate * 100)}% Pass
                    </span>
                  </div>

                  {course.url ? (
                    <a
                      href={course.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover transition-colors"
                    >
                      <span>View on {course.provider}</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-xs text-subtle font-medium italic">
                      NSSTA In-Person / TPAC Nominated
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recommended Hands-on Virtual Labs */}
      <div>
        <div className="mb-3">
          <h2 className="text-[17px] font-bold text-ink flex items-center gap-2">
            <FlaskConical size={18} className="text-primary" />
            <span>{t('recommendations.recommendedLabs', 'Recommended Hands-on Labs')}</span>
          </h2>
          <p className="text-[12px] text-muted">
            Interactive virtual experiments to practice core statistical analysis concepts safely in your browser.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {rec?.recommendedLabs.map((lab) => (
            <Card key={lab.labId} className="p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge tone={lab.difficulty === 'Beginner' ? 'success' : 'primary'}>
                    {lab.difficulty}
                  </Badge>
                  <span className="flex items-center gap-1 text-[11px] text-subtle">
                    <Clock size={11} /> {lab.estimatedMinutes} mins
                  </span>
                </div>

                <h3 className="text-[15px] font-bold text-ink">{lab.title}</h3>
                <p className="text-[12px] font-medium text-primary mt-1">{lab.addressesConcept}</p>
                <p className="mt-2 text-[12px] text-muted leading-relaxed">{lab.whyRecommended}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-border">
                <Link
                  to={lab.route}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded bg-surface border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft transition-colors"
                >
                  <span>Launch Virtual Lab</span>
                  <ArrowUpRight size={13} />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
