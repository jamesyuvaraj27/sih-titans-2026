import { useState, useEffect } from 'react';
import {
  FlaskConical, ArrowLeft, CheckCircle2, Clock, Play, Activity
} from 'lucide-react';
import { LABS } from '../data/labsData.js';
import { Card, CardHeader, Button, Badge } from '../components/ui.js';
import { CentralTendencyLab } from '../components/lab/CentralTendencyLab.js';
import { StandardDeviationLab } from '../components/lab/StandardDeviationLab.js';
import { DataVisualizationLab } from '../components/lab/DataVisualizationLab.js';
import { BasicDataAnalysisLab } from '../components/lab/BasicDataAnalysisLab.js';

type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

interface LabProgress {
  status: ProgressStatus;
  completedAt?: string;
}

const STORAGE_KEY = 'statintel_virtuallab_progress';

function loadProgress(): Record<string, LabProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: Record<string, LabProgress>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Local storage disabled or full
  }
}

export function VirtualLab() {
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [progress, setProgress] = useState<Record<string, LabProgress>>({});

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  function handleStartLab(labId: string) {
    setActiveLabId(labId);
    setProgress((prev) => {
      const current = prev[labId];
      if (current?.status === 'completed') return prev;
      const next = { ...prev, [labId]: { status: 'in_progress' as ProgressStatus } };
      saveProgress(next);
      return next;
    });
  }

  function handleCompleteLab(labId: string) {
    setProgress((prev) => {
      const next = {
        ...prev,
        [labId]: { status: 'completed' as ProgressStatus, completedAt: new Date().toISOString() },
      };
      saveProgress(next);
      return next;
    });
  }

  const activeLab = LABS.find((l) => l.id === activeLabId);

  const categories = ['ALL', 'Descriptive Statistics', 'Dispersion & Variation', 'Visual Analytics', 'Exploratory Analysis'];

  const filteredLabs = LABS.filter((l) => {
    if (selectedCategory !== 'ALL' && l.category !== selectedCategory) return false;
    return true;
  });

  const completedCount = LABS.filter((l) => progress[l.id]?.status === 'completed').length;
  const inProgressCount = LABS.filter((l) => progress[l.id]?.status === 'in_progress').length;
  const percentComplete = Math.round((completedCount / LABS.length) * 100);

  // ── Render Active Lab View ────────────────────────────────────────────────
  if (activeLab) {
    const labProgress = progress[activeLab.id]?.status || 'not_started';

    return (
      <div className="mx-auto max-w-5xl space-y-6 py-2">
        {/* Top Navigation & Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setActiveLabId(null)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to Virtual Labs
          </button>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-subtle px-2 py-0.5 rounded bg-raised border border-border">
              {activeLab.competencyCode}
            </span>
            <Badge tone={activeLab.difficulty === 'Beginner' ? 'primary' : 'moderate'}>
              {activeLab.difficulty}
            </Badge>
            <Badge tone={labProgress === 'completed' ? 'success' : labProgress === 'in_progress' ? 'moderate' : 'neutral'}>
              {labProgress === 'completed' ? 'Completed' : labProgress === 'in_progress' ? 'In Progress' : 'Not Started'}
            </Badge>
          </div>
        </div>

        {/* Lab Header */}
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-xs">
              <FlaskConical size={20} />
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-ink tracking-tight">{activeLab.title}</h1>
              <p className="text-[13px] text-muted">{activeLab.subtitle}</p>
            </div>
          </div>
          <p className="mt-2 text-[13px] text-muted leading-relaxed">
            <strong>Learning Objective:</strong> {activeLab.learningObjective}
          </p>
        </div>

        {/* Experiment Area */}
        {activeLab.id === 'mean-median-mode' && (
          <CentralTendencyLab lab={activeLab} onComplete={() => handleCompleteLab(activeLab.id)} />
        )}

        {activeLab.id === 'standard-deviation' && (
          <StandardDeviationLab lab={activeLab} onComplete={() => handleCompleteLab(activeLab.id)} />
        )}

        {activeLab.id === 'data-visualization' && (
          <DataVisualizationLab lab={activeLab} onComplete={() => handleCompleteLab(activeLab.id)} />
        )}

        {activeLab.id === 'basic-data-analysis' && (
          <BasicDataAnalysisLab lab={activeLab} onComplete={() => handleCompleteLab(activeLab.id)} />
        )}
      </div>
    );
  }

  // ── Render Virtual Lab Dashboard / Home ───────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2">
      {/* Header */}
      <header className="border-b border-border pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
                <FlaskConical size={20} />
              </div>
              <h1 className="text-[24px] font-bold tracking-tight text-ink">
                STATINTEL Virtual Lab
              </h1>
              <Badge tone="primary">
                <Activity size={12} className="mr-1" />
                Hands-on Labs
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Interactive statistical simulations and empirical data experiments for official statistics and analysis.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-2.5">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-subtle">Lab Progress</p>
              <p className="text-[15px] font-bold text-ink">
                {completedCount} <span className="text-[12px] font-normal text-muted">Completed</span> · {inProgressCount} <span className="text-[12px] font-normal text-muted">In Progress</span>
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary-soft border border-primary/20 flex items-center justify-center text-[12px] font-bold text-primary">
              {percentComplete}%
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-raised border border-border">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </header>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`shrink-0 rounded-full border px-3.5 py-1 text-[12px] font-medium transition-colors cursor-pointer ${
              selectedCategory === cat
                ? 'border-primary bg-primary-soft text-primary font-semibold'
                : 'border-border bg-surface text-ink hover:bg-raised'
            }`}
          >
            {cat === 'ALL' ? 'All Experiments' : cat}
          </button>
        ))}
      </div>

      {/* Available Labs Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {filteredLabs.map((lab) => {
          const labProgress = progress[lab.id]?.status || 'not_started';
          const isCompleted = labProgress === 'completed';
          const isInProgress = labProgress === 'in_progress';

          return (
            <Card
              key={lab.id}
              className={`flex flex-col justify-between transition-all hover:border-primary/50 shadow-xs ${
                isCompleted ? 'border-success/30' : ''
              }`}
            >
              <div>
                <CardHeader
                  title={
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-ink text-[16px]">{lab.title}</span>
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded border border-success/25">
                          <CheckCircle2 size={13} /> Completed
                        </span>
                      )}
                    </div>
                  }
                  subtitle={lab.subtitle}
                />

                <div className="p-4 sm:p-5 space-y-3">
                  <p className="text-[13px] text-muted leading-relaxed">
                    {lab.description}
                  </p>

                  <div className="rounded border border-border/80 bg-raised/40 p-3 text-[12px] text-ink">
                    <p className="font-semibold text-subtle text-[11px] uppercase tracking-wider mb-1">
                      Learning Objective:
                    </p>
                    <p className="text-muted leading-snug">{lab.learningObjective}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="font-mono text-[11px] font-semibold text-subtle px-2 py-0.5 rounded bg-raised border border-border">
                      {lab.competencyCode}
                    </span>
                    <Badge tone={lab.difficulty === 'Beginner' ? 'primary' : 'moderate'}>
                      {lab.difficulty}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-[11px] text-subtle">
                      <Clock size={12} /> ~{lab.estimatedMinutes} mins
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border p-4 bg-raised/20 flex items-center justify-between">
                <span className="text-[12px] font-medium text-subtle">
                  {isCompleted
                    ? 'Experiment verified'
                    : isInProgress
                    ? 'In Progress'
                    : 'Not started'}
                </span>

                <Button
                  onClick={() => handleStartLab(lab.id)}
                  variant={isCompleted ? 'secondary' : 'primary'}
                  size="sm"
                >
                  <Play size={14} className="mr-1" />
                  {isCompleted ? 'Review Lab' : isInProgress ? 'Continue Lab' : 'Start Lab'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
