import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ExternalLink,
  Lock,
  Target,
  Check,
  Clock,
  ArrowRight,
  ArrowDown,
  Layers,
  Compass,
  PlayCircle,
  RotateCcw,
  GitBranch,
} from 'lucide-react';
import { api, post, type PathStep, type CourseProgressMap } from '../lib/api.js';
import { hours, mins } from '../lib/format.js';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, MetricCard, Spinner } from '../components/ui.js';

interface StageData {
  stageNum: 1 | 2 | 3;
  title: string;
  subtitle: string;
  steps: PathStep[];
  totalHours: number;
  completedCount: number;
  inProgressCount: number;
  totalCount: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

function getItemKey(step: PathStep): string {
  return step.courses[0]?.id || `comp_${step.competencyId}`;
}

function getItemStatus(
  step: PathStep,
  progress: CourseProgressMap
): 'not_started' | 'in_progress' | 'completed' {
  const key = getItemKey(step);
  return progress[key]?.status || 'not_started';
}

function partitionStepsIntoStages(steps: PathStep[], progress: CourseProgressMap): StageData[] {
  if (steps.length === 0) return [];

  // Partition topologically sorted steps into 3 natural pedagogical stages:
  // Stage 1: Foundation & Prerequisites (first ~1/3)
  // Stage 2: Core Methodology & Applied Tools (middle ~1/3)
  // Stage 3: Advanced Specialization & Target Role Mastery (final ~1/3)
  const n = steps.length;
  const count1 = Math.max(1, Math.ceil(n / 3));
  const count2 = Math.max(1, Math.ceil((n - count1) / 2));

  const s1Steps = steps.slice(0, count1);
  const s2Steps = steps.slice(count1, count1 + count2);
  const s3Steps = steps.slice(count1 + count2);

  const buildStage = (
    stageNum: 1 | 2 | 3,
    title: string,
    subtitle: string,
    stageSteps: PathStep[]
  ): StageData => {
    let completedCount = 0;
    let inProgressCount = 0;
    let totalHours = 0;

    for (const step of stageSteps) {
      totalHours += step.estHours;
      const st = getItemStatus(step, progress);
      if (st === 'completed') completedCount++;
      else if (st === 'in_progress') inProgressCount++;
    }

    const totalCount = stageSteps.length;
    let status: 'not_started' | 'in_progress' | 'completed' = 'not_started';
    if (totalCount > 0 && completedCount === totalCount) {
      status = 'completed';
    } else if (completedCount > 0 || inProgressCount > 0) {
      status = 'in_progress';
    }

    return {
      stageNum,
      title,
      subtitle,
      steps: stageSteps,
      totalHours,
      completedCount,
      inProgressCount,
      totalCount,
      status,
    };
  };

  return [
    buildStage(
      1,
      'Stage 1: Foundation & Prerequisites',
      'Core statistical principles, baseline data hygiene, and prerequisite skills',
      s1Steps
    ),
    buildStage(
      2,
      'Stage 2: Core Methodology & Applied Tools',
      'Intermediate inference, official sampling methods, and analytical programming',
      s2Steps
    ),
    buildStage(
      3,
      'Stage 3: Advanced Specialization & Role Mastery',
      'Advanced estimation, specialized survey frameworks, and final role targets',
      s3Steps
    ),
  ];
}

export function Path() {
  const [steps, setSteps] = useState<PathStep[]>([]);
  const [progress, setProgress] = useState<CourseProgressMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<PathStep | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  // Fetch learning path and persisted course progress
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pathData, progressData] = await Promise.all([
        api<PathStep[]>('/officials/me/path'),
        api<CourseProgressMap>('/officials/me/courses/progress').catch(() => ({})),
      ]);
      setSteps(pathData || []);
      setProgress(progressData || {});
    } catch (err: any) {
      setError(err?.message || 'Could not load your learning path');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async (
    step: PathStep,
    newStatus: 'not_started' | 'in_progress' | 'completed'
  ) => {
    const key = getItemKey(step);
    setUpdatingKey(key);

    // Optimistic UI update
    const previous = progress[key];
    setProgress((prev) => ({
      ...prev,
      [key]: {
        status: newStatus,
        progressPct: newStatus === 'completed' ? 100 : newStatus === 'in_progress' ? 50 : 0,
        updatedAt: new Date().toISOString(),
        completedAt: newStatus === 'completed' ? new Date().toISOString() : null,
      },
    }));

    try {
      await post(`/officials/me/courses/${encodeURIComponent(key)}/progress`, {
        status: newStatus,
        competencyId: step.competencyId,
      });
    } catch (err) {
      console.error('Failed to persist progress:', err);
      // Rollback on error
      setProgress((prev) => {
        const copy = { ...prev };
        if (previous) copy[key] = previous;
        else delete copy[key];
        return copy;
      });
    } finally {
      setUpdatingKey(null);
    }
  };

  if (loading && steps.length === 0) {
    return <Spinner label="Generating your interactive 3-stage learning path..." />;
  }

  if (error && steps.length === 0) {
    return (
      <Alert tone="critical" title="Could not build a learning path">
        {error}
      </Alert>
    );
  }

  const stages = partitionStepsIntoStages(steps, progress);
  const totalHours = steps.reduce((a, s) => a + s.estHours, 0);
  const prereqs = steps.filter((s) => s.isPrerequisite).length;

  const totalCompleted = steps.filter((s) => getItemStatus(s, progress) === 'completed').length;
  const overallPct = steps.length > 0 ? Math.round((totalCompleted / steps.length) * 100) : 100;

  // Path progression connection flags
  const isStage1Completed = stages[0]?.status === 'completed';
  const isStage2Completed = stages[1]?.status === 'completed';
  const isStage3Completed = stages[2]?.status === 'completed';

  // Determine current active stage and next uncompleted course
  const currentStage = stages.find((st) => st.status !== 'completed') || stages[stages.length - 1];
  const nextUncompletedStep = steps.find((s) => getItemStatus(s, progress) !== 'completed');

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Header */}
      <header className="border-b border-[#E5E7EB] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">Learning Path</h1>
              <span className="rounded border border-[#0284C7]/30 bg-[#F0F9FF] px-2 py-0.5 text-[11px] font-semibold text-[#0284C7]">
                3-Stage Prerequisite Progression
              </span>
            </div>
            <p className="mt-1 text-[13px] text-[#6B7280] max-w-3xl leading-relaxed">
              Topologically sorted by prerequisite first, gap severity, and downstream unblocking impact. Follow the
              structured progression across <strong>Stage 1</strong>, <strong>Stage 2</strong>, and <strong>Stage 3</strong>. Completed
              milestones turn the connecting path <strong>BLUE</strong> as you advance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/graph"
              className="inline-flex items-center gap-1.5 rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#111827] hover:bg-[#F8FAFC] transition-colors"
            >
              <GitBranch size={13} className="text-[#0284C7]" /> Skill Dependency Graph
            </Link>
            <span className="rounded bg-white border border-[#E5E7EB] px-3 py-1.5 text-[12px] font-semibold text-[#111827]">
              Progress: <span className="text-[#0284C7]">{totalCompleted} / {steps.length} ({overallPct}%)</span>
            </span>
          </div>
        </div>
      </header>

      {steps.length === 0 ? (
        <Card>
          <EmptyState title="All Competencies Satisfied">
            Every competency your role requires is already evidenced at or above its target level. No pending prerequisite
            or gap to schedule.
          </EmptyState>
        </Card>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              title="Curriculum Steps"
              value={`${steps.length} Steps`}
              subtext={`${prereqs} foundational prerequisites required`}
              icon={<Layers size={20} />}
            />
            <MetricCard
              title="Estimated Effort"
              value={hours(totalHours)}
              subtext="Sum of per-competency coursework & practice"
              icon={<Clock size={20} />}
            />
            <MetricCard
              title="Integrated LMS"
              value="iGOT + NSSTA"
              subtext="Curated via Sunbird Government LMS Contract"
              icon={<BookOpen size={20} />}
            />
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              HIGH-LEVEL 3-STAGE PROGRESSION GRAPH & PIPELINE
              STAGE 1 ━━━► STAGE 2 ━━━► STAGE 3
              ══════════════════════════════════════════════════════════════════ */}
          <Card className="p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-4 border-b border-[#E5E7EB] pb-3">
              <div>
                <h2 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                  <Compass size={17} className="text-[#0284C7]" />
                  <span>3-Stage Prerequisite Progression Pipeline</span>
                </h2>
                <p className="text-[12px] text-[#6B7280]">
                  Connections progressively illuminate in <strong className="text-[#0284C7]">BLUE</strong> as each stage is completed.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="flex items-center gap-1 text-[#6B7280]">
                  <span className="inline-block h-2 w-2 rounded-full border border-[#D1D5DB] bg-white"></span> Unfinished
                </span>
                <span className="flex items-center gap-1 font-semibold text-[#0284C7]">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0284C7]"></span> Completed (Blue)
                </span>
              </div>
            </div>

            {/* Pipeline Visual Bar */}
            <div className="py-3 px-2">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
                {/* Stage 1 Node */}
                <div className="flex flex-col items-center text-center w-full md:w-56 shrink-0">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-500 select-none shadow-sm ${
                      isStage1Completed
                        ? 'border-[#0284C7] bg-[#0284C7] text-white shadow-[#0284C7]/20 shadow-md'
                        : stages[0]?.status === 'in_progress'
                        ? 'border-[#0284C7] bg-[#F0F9FF] text-[#0284C7]'
                        : 'border-[#D1D5DB] bg-white text-[#6B7280]'
                    }`}
                  >
                    {isStage1Completed ? (
                      <Check size={22} strokeWidth={3} aria-label="Stage 1 Completed" />
                    ) : (
                      <span className="text-[16px] font-bold">1</span>
                    )}
                  </div>
                  <h3 className="mt-2 text-[14px] font-bold text-[#111827]">STAGE 1</h3>
                  <p className="text-[12px] font-medium text-[#6B7280]">Foundation &amp; Prereqs</p>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        isStage1Completed
                          ? 'bg-[#0284C7] text-white'
                          : stages[0]?.status === 'in_progress'
                          ? 'bg-[#F0F9FF] text-[#0284C7] border border-[#0284C7]/30'
                          : 'bg-[#F3F4F6] text-[#6B7280]'
                      }`}
                    >
                      {isStage1Completed
                        ? '✓ Completed'
                        : `${stages[0]?.completedCount || 0} / ${stages[0]?.totalCount || 0} items`}
                    </span>
                  </div>
                </div>

                {/* Connector Line: Stage 1 ━━━► Stage 2 */}
                <div className="flex-1 w-full md:w-auto flex items-center justify-center px-2 py-2 md:py-0">
                  <div className="relative w-full flex items-center">
                    {/* Background inactive line */}
                    <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                      {/* Active Blue progress line */}
                      <div
                        className="h-full bg-[#0284C7] transition-all duration-700 ease-in-out"
                        style={{
                          width: isStage1Completed
                            ? '100%'
                            : `${Math.round(((stages[0]?.completedCount || 0) / Math.max(1, stages[0]?.totalCount || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    {/* Arrowhead */}
                    <div
                      className={`absolute right-0 translate-x-1 flex items-center justify-center transition-colors duration-500 ${
                        isStage1Completed ? 'text-[#0284C7]' : 'text-[#9CA3AF]'
                      }`}
                    >
                      <ArrowRight size={18} strokeWidth={isStage1Completed ? 3 : 2} />
                    </div>
                  </div>
                </div>

                {/* Stage 2 Node */}
                <div className="flex flex-col items-center text-center w-full md:w-56 shrink-0">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-500 select-none shadow-sm ${
                      isStage2Completed
                        ? 'border-[#0284C7] bg-[#0284C7] text-white shadow-[#0284C7]/20 shadow-md'
                        : stages[1]?.status === 'in_progress'
                        ? 'border-[#0284C7] bg-[#F0F9FF] text-[#0284C7]'
                        : 'border-[#D1D5DB] bg-white text-[#6B7280]'
                    }`}
                  >
                    {isStage2Completed ? (
                      <Check size={22} strokeWidth={3} aria-label="Stage 2 Completed" />
                    ) : (
                      <span className="text-[16px] font-bold">2</span>
                    )}
                  </div>
                  <h3 className="mt-2 text-[14px] font-bold text-[#111827]">STAGE 2</h3>
                  <p className="text-[12px] font-medium text-[#6B7280]">Core Methodology</p>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        isStage2Completed
                          ? 'bg-[#0284C7] text-white'
                          : stages[1]?.status === 'in_progress'
                          ? 'bg-[#F0F9FF] text-[#0284C7] border border-[#0284C7]/30'
                          : 'bg-[#F3F4F6] text-[#6B7280]'
                      }`}
                    >
                      {isStage2Completed
                        ? '✓ Completed'
                        : `${stages[1]?.completedCount || 0} / ${stages[1]?.totalCount || 0} items`}
                    </span>
                  </div>
                </div>

                {/* Connector Line: Stage 2 ━━━► Stage 3 */}
                <div className="flex-1 w-full md:w-auto flex items-center justify-center px-2 py-2 md:py-0">
                  <div className="relative w-full flex items-center">
                    {/* Background inactive line */}
                    <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                      {/* Active Blue progress line */}
                      <div
                        className="h-full bg-[#0284C7] transition-all duration-700 ease-in-out"
                        style={{
                          width: isStage2Completed
                            ? '100%'
                            : isStage1Completed
                            ? `${Math.round(((stages[1]?.completedCount || 0) / Math.max(1, stages[1]?.totalCount || 1)) * 100)}%`
                            : '0%',
                        }}
                      />
                    </div>
                    {/* Arrowhead */}
                    <div
                      className={`absolute right-0 translate-x-1 flex items-center justify-center transition-colors duration-500 ${
                        isStage2Completed ? 'text-[#0284C7]' : 'text-[#9CA3AF]'
                      }`}
                    >
                      <ArrowRight size={18} strokeWidth={isStage2Completed ? 3 : 2} />
                    </div>
                  </div>
                </div>

                {/* Stage 3 Node */}
                <div className="flex flex-col items-center text-center w-full md:w-56 shrink-0">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-500 select-none shadow-sm ${
                      isStage3Completed
                        ? 'border-[#0284C7] bg-[#0284C7] text-white shadow-[#0284C7]/20 shadow-md'
                        : stages[2]?.status === 'in_progress'
                        ? 'border-[#0284C7] bg-[#F0F9FF] text-[#0284C7]'
                        : 'border-[#D1D5DB] bg-white text-[#6B7280]'
                    }`}
                  >
                    {isStage3Completed ? (
                      <Check size={22} strokeWidth={3} aria-label="Stage 3 Completed" />
                    ) : (
                      <span className="text-[16px] font-bold">3</span>
                    )}
                  </div>
                  <h3 className="mt-2 text-[14px] font-bold text-[#111827]">STAGE 3</h3>
                  <p className="text-[12px] font-medium text-[#6B7280]">Advanced Role Mastery</p>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        isStage3Completed
                          ? 'bg-[#0284C7] text-white'
                          : stages[2]?.status === 'in_progress'
                          ? 'bg-[#F0F9FF] text-[#0284C7] border border-[#0284C7]/30'
                          : 'bg-[#F3F4F6] text-[#6B7280]'
                      }`}
                    >
                      {isStage3Completed
                        ? '✓ Completed'
                        : `${stages[2]?.completedCount || 0} / ${stages[2]?.totalCount || 0} items`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* ══════════════════════════════════════════════════════════════════
              "WHERE AM I?" ORIENTATION PANEL
              ══════════════════════════════════════════════════════════════════ */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 border-l-4 border-l-[#0284C7] bg-white">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0284C7]">Where am I?</p>
              <p className="mt-1 text-[14px] font-bold text-[#111827]">
                {isStage3Completed
                  ? 'Curriculum Completed!'
                  : `${currentStage?.title.split(':')[0] || 'Stage 1'}`}
              </p>
              <p className="mt-1 text-[12px] text-[#6B7280] leading-snug">
                {isStage3Completed
                  ? 'All 3 stages successfully mastered'
                  : currentStage?.subtitle || 'Focusing on core requirements'}
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-l-[#0284C7]/70 bg-white">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0284C7]">What have I completed?</p>
              <p className="mt-1 text-[14px] font-bold text-[#111827]">
                {totalCompleted} of {steps.length} Courses
              </p>
              <p className="mt-1 text-[12px] text-[#6B7280] leading-snug">
                {overallPct}% verified progress persisted in ledger
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-l-[#0284C7]/40 bg-white">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0284C7]">What should I learn next?</p>
              <p className="mt-1 text-[14px] font-bold text-[#111827] truncate">
                {nextUncompletedStep ? nextUncompletedStep.nameEn : 'All completed!'}
              </p>
              <p className="mt-1 text-[12px] text-[#6B7280] leading-snug truncate">
                {nextUncompletedStep
                  ? `${nextUncompletedStep.courses[0]?.provider || 'iGOT'} • ${hours(nextUncompletedStep.estHours)}`
                  : 'Ready for role assessment'}
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-l-[#0284C7]/20 bg-white">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0284C7]">What comes after that?</p>
              <p className="mt-1 text-[14px] font-bold text-[#111827] truncate">
                {nextUncompletedStep?.unlocks?.length
                  ? `Unlocks ${nextUncompletedStep.unlocks[0]}`
                  : isStage1Completed && !isStage2Completed
                  ? 'Stage 2 Core Methodology'
                  : isStage2Completed && !isStage3Completed
                  ? 'Stage 3 Advanced Role Target'
                  : 'Role Competency Certification'}
              </p>
              <p className="mt-1 text-[12px] text-[#6B7280] leading-snug">
                {nextUncompletedStep?.unlocks?.length
                  ? `Unblocks downstream prerequisites`
                  : 'Target role requirements fulfilled'}
              </p>
            </Card>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              INTERACTIVE 3-STAGE GRAPH & COURSE COLUMNS
              STAGE 1 │ STAGE 2 │ STAGE 3
              ══════════════════════════════════════════════════════════════════ */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-[16px] font-bold text-[#111827] flex items-center gap-2">
                  <span>Interactive Course &amp; Prerequisite Progression Graph</span>
                </h2>
                <p className="text-[12px] text-[#6B7280]">
                  Click any course card to inspect syllabus details, start training, or mark complete.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#6B7280]">
                  Showing all 3 stages simultaneously
                </span>
              </div>
            </div>

            {/* 3 Stage Grid (Horizontal on Desktop, Stacked on Mobile) */}
            <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4 relative">
              {stages.map((st, stageIdx) => {
                const isStageComplete = st.status === 'completed';
                const isStageActive = currentStage?.stageNum === st.stageNum;

                return (
                  <div key={st.stageNum} className="flex flex-col relative">
                    {/* Stage Container Card */}
                    <Card
                      className={`flex-1 flex flex-col p-4 transition-all duration-300 ${
                        isStageComplete
                          ? 'border-[#0284C7]/50 shadow-sm'
                          : isStageActive
                          ? 'border-[#0284C7] ring-1 ring-[#0284C7]/20 shadow-sm'
                          : 'border-[#E5E7EB] opacity-95'
                      }`}
                    >
                      {/* Stage Column Header */}
                      <div className="border-b border-[#E5E7EB] pb-3 mb-4">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                              isStageComplete
                                ? 'bg-[#0284C7] text-white'
                                : isStageActive
                                ? 'bg-[#F0F9FF] text-[#0284C7] border border-[#0284C7]/30'
                                : 'bg-[#F3F4F6] text-[#6B7280]'
                            }`}
                          >
                            STAGE {st.stageNum}
                          </span>
                          <span className="text-[12px] font-bold text-[#111827]">
                            {st.completedCount} / {st.totalCount} completed
                          </span>
                        </div>

                        <h3 className="mt-2 text-[15px] font-bold text-[#111827] leading-snug">
                          {st.title.replace(/^Stage \d+:\s*/, '')}
                        </h3>
                        <p className="mt-1 text-[12px] text-[#6B7280] leading-relaxed">
                          {st.subtitle}
                        </p>

                        {/* Stage Progress Bar */}
                        <div className="mt-3 h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0284C7] transition-all duration-500"
                            style={{
                              width: `${st.totalCount > 0 ? Math.round((st.completedCount / st.totalCount) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Course / Learning Item Nodes */}
                      <div className="space-y-4 flex-1">
                        {st.steps.map((step, idx) => {
                          const itemKey = getItemKey(step);
                          const itemStatus = getItemStatus(step, progress);
                          const isCompleted = itemStatus === 'completed';
                          const isInProgress = itemStatus === 'in_progress';
                          const isUpdating = updatingKey === itemKey;
                          const primaryCourse = step.courses[0];
                          const hasNextItem = idx < st.steps.length - 1;

                          return (
                            <div key={step.competencyId} className="relative">
                              {/* Vertical Connecting Line to Next Course within Stage */}
                              {hasNextItem && (
                                <div
                                  className={`absolute left-[15px] top-[32px] w-[2px] h-[calc(100%+8px)] z-0 transition-colors duration-500 ${
                                    isCompleted ? 'bg-[#0284C7]' : 'bg-[#E5E7EB]'
                                  }`}
                                  aria-hidden="true"
                                />
                              )}

                              <div className="relative z-10 flex items-start gap-3">
                                {/* Node Status Circle */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateStatus(
                                      step,
                                      isCompleted ? 'not_started' : 'completed'
                                    )
                                  }
                                  title={
                                    isCompleted
                                      ? 'Mark incomplete'
                                      : isInProgress
                                      ? 'Mark completed'
                                      : 'Start course'
                                  }
                                  className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[#0284C7] ${
                                    isCompleted
                                      ? 'border-[#0284C7] bg-[#0284C7] text-white shadow-sm'
                                      : isInProgress
                                      ? 'border-[#0284C7] bg-[#F0F9FF] text-[#0284C7]'
                                      : 'border-[#D1D5DB] bg-white text-[#6B7280] hover:border-[#9CA3AF]'
                                  }`}
                                >
                                  {isCompleted ? (
                                    <Check size={16} strokeWidth={3} />
                                  ) : isInProgress ? (
                                    <span className="text-[12px] font-bold">◐</span>
                                  ) : (
                                    <span className="text-[12px] font-semibold">{step.order}</span>
                                  )}
                                </button>

                                {/* Course Card */}
                                <div
                                  className={`min-w-0 flex-1 rounded-lg border p-3 bg-white transition-all duration-200 ${
                                    isCompleted
                                      ? 'border-[#0284C7]/40 bg-[#F0F9FF]/20'
                                      : isInProgress
                                      ? 'border-[#0284C7] bg-white shadow-sm'
                                      : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {step.isPrerequisite ? (
                                        <Badge tone="neutral" icon={<Lock size={10} aria-hidden="true" />}>
                                          Prerequisite
                                        </Badge>
                                      ) : (
                                        <Badge tone="primary" icon={<Target size={10} aria-hidden="true" />}>
                                          Role Target
                                        </Badge>
                                      )}
                                      <span className="text-[11px] font-semibold text-[#6B7280]">
                                        L{step.fromLevel} → L{step.toLevel}
                                      </span>
                                    </div>

                                    {/* Status Badge */}
                                    <span
                                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-bold ${
                                        isCompleted
                                          ? 'bg-[#0284C7] text-white'
                                          : isInProgress
                                          ? 'bg-[#F0F9FF] text-[#0284C7] border border-[#0284C7]/30'
                                          : 'bg-[#F3F4F6] text-[#6B7280]'
                                      }`}
                                    >
                                      {isCompleted ? '✓ Completed' : isInProgress ? '◐ In Progress' : '○ Not Started'}
                                    </span>
                                  </div>

                                  {/* Course Title */}
                                  <div className="mt-1">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedStep(step)}
                                      className="text-left font-bold text-[13.5px] text-[#111827] hover:text-[#0284C7] transition-colors leading-snug cursor-pointer"
                                    >
                                      {primaryCourse?.name || step.nameEn}
                                    </button>
                                  </div>

                                  {/* Competency mapping */}
                                  <p className="mt-0.5 text-[11.5px] text-[#6B7280]">
                                    Skill: <strong className="text-[#111827]">{step.nameEn}</strong> ({step.competencyId})
                                  </p>

                                  {/* Provider & Duration */}
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#6B7280]">
                                    <span className="rounded bg-[#F8FAFC] border border-[#E5E7EB] px-1.5 py-0.5 font-medium text-[#111827]">
                                      {primaryCourse?.provider || 'iGOT Karmayogi'}
                                    </span>
                                    <span className="flex items-center gap-1 text-[#6B7280]">
                                      <Clock size={11} /> {hours(step.estHours)}
                                    </span>
                                    {primaryCourse?.tpacFlagged && (
                                      <span className="rounded bg-[#0284C7]/10 text-[#0284C7] px-1.5 py-0.5 font-semibold">
                                        TPAC
                                      </span>
                                    )}
                                  </div>

                                  {/* Unblocks note */}
                                  {step.unlocks.length > 0 && (
                                    <p className="mt-2 text-[11px] text-[#6B7280] leading-snug">
                                      <strong className="text-[#111827]">Unblocks:</strong> {step.unlocks.join(', ')}
                                    </p>
                                  )}

                                  {/* Action Buttons */}
                                  <div className="mt-3 pt-2.5 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                      {isCompleted ? (
                                        <button
                                          type="button"
                                          disabled={isUpdating}
                                          onClick={() => handleUpdateStatus(step, 'not_started')}
                                          className="text-[11px] font-semibold text-[#6B7280] hover:text-[#111827] inline-flex items-center gap-1 cursor-pointer"
                                        >
                                          <RotateCcw size={11} /> Reset
                                        </button>
                                      ) : isInProgress ? (
                                        <Button
                                          size="sm"
                                          variant="primary"
                                          loading={isUpdating}
                                          onClick={() => handleUpdateStatus(step, 'completed')}
                                          className="text-[11px] py-1 h-7"
                                        >
                                          <Check size={12} className="mr-0.5" /> Mark Complete
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          loading={isUpdating}
                                          onClick={() => handleUpdateStatus(step, 'in_progress')}
                                          className="text-[11px] py-1 h-7"
                                        >
                                          <PlayCircle size={12} className="mr-0.5 text-[#0284C7]" /> Start Course
                                        </Button>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => setSelectedStep(step)}
                                      className="text-[11px] font-semibold text-[#0284C7] hover:underline cursor-pointer"
                                    >
                                      Syllabus &rarr;
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    {/* Mobile Downward Connector between Stages */}
                    {stageIdx < stages.length - 1 && (
                      <div className="lg:hidden flex flex-col items-center py-2" aria-hidden="true">
                        <div
                          className={`w-[3px] h-6 transition-colors duration-500 ${
                            stageIdx === 0 && isStage1Completed
                              ? 'bg-[#0284C7]'
                              : stageIdx === 1 && isStage2Completed
                              ? 'bg-[#0284C7]'
                              : 'bg-[#E5E7EB]'
                          }`}
                        />
                        <div
                          className={`-mt-1 transition-colors duration-500 ${
                            stageIdx === 0 && isStage1Completed
                              ? 'text-[#0284C7]'
                              : stageIdx === 1 && isStage2Completed
                              ? 'text-[#0284C7]'
                              : 'text-[#9CA3AF]'
                          }`}
                        >
                          <ArrowDown size={18} strokeWidth={3} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              FULL TOPOLOGICAL SEQUENCE & PREREQUISITE LEDGER
              ══════════════════════════════════════════════════════════════════ */}
          <Card>
            <CardHeader
              title="Topological Prerequisite Sequence"
              subtitle="Ordered sequence with exact dependency justification and Sunbird LMS mappings."
            />
            <ol className="divide-y divide-[#E5E7EB]">
              {steps.map((s) => {
                const itemStatus = getItemStatus(s, progress);
                const isCompleted = itemStatus === 'completed';

                return (
                  <li key={s.competencyId} className="flex gap-3 px-4 py-4 hover:bg-[#F8FAFC]/50 transition-colors">
                    <span
                      aria-hidden="true"
                      className={`tnum mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors ${
                        isCompleted
                          ? 'border-[#0284C7] bg-[#0284C7] text-white'
                          : 'border-[#D1D5DB] bg-white text-[#111827]'
                      }`}
                    >
                      {isCompleted ? <Check size={14} strokeWidth={3} /> : s.order}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/competency/${s.competencyId}`}
                          className="text-[15px] font-semibold text-[#0284C7] hover:underline"
                        >
                          {s.nameEn}
                        </Link>
                        {s.isPrerequisite ? (
                          <Badge tone="neutral" icon={<Lock size={11} aria-hidden="true" />}>
                            Prerequisite
                          </Badge>
                        ) : (
                          <Badge tone="primary" icon={<Target size={11} aria-hidden="true" />}>
                            Role Target
                          </Badge>
                        )}
                        <Badge tone="neutral">L{s.fromLevel} → L{s.toLevel}</Badge>
                        <Badge tone="neutral">{hours(s.estHours)}</Badge>
                        {isCompleted && (
                          <span className="rounded bg-[#0284C7] px-2 py-0.5 text-[11px] font-bold text-white">
                            ✓ Completed
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-[13px] text-[#6B7280]">{s.why}</p>
                      {s.unlocks.length > 0 && (
                        <p className="mt-1 text-[12px] text-[#9CA3AF]">
                          Unblocks: {s.unlocks.join(', ')}
                        </p>
                      )}

                      {s.courses.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {s.courses.map((c) => (
                            <li key={c.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                              <BookOpen size={13} className="shrink-0 text-[#9CA3AF]" aria-hidden="true" />
                              <span className={c.primary ? 'font-medium text-[#111827]' : 'text-[#6B7280]'}>
                                {c.name}
                              </span>
                              <Badge tone="neutral">{c.provider}</Badge>
                              {c.tpacFlagged && <Badge tone="primary">TPAC</Badge>}
                              <span className="tnum text-[12px] text-[#9CA3AF]">{mins(c.durationMins)}</span>
                              {c.primary && <Badge tone="success">recommended</Badge>}
                              {c.url && (
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0284C7] hover:underline"
                                >
                                  Enrol on iGOT <ExternalLink size={11} aria-hidden="true" />
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="border-t border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-[12px] text-[#6B7280]">
              Enrolment calls go out in the Sunbird API contract that iGOT Karmayogi runs on — the same request
              and response shapes, so moving from the fixture client to a production iGOT instance is a base
              URL and an API key. Estimated effort is {hours(totalHours)} across {steps.length} steps.
            </div>
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          COURSE DETAILS & SYLLABUS MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {selectedStep && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedStep(null)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase text-[#9CA3AF]">
                  {getItemKey(selectedStep)}
                </span>
                <h3 className="text-[18px] font-bold text-[#111827]">
                  {selectedStep.courses[0]?.name || selectedStep.nameEn}
                </h3>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  Mapped to Competency: <strong className="text-[#111827]">{selectedStep.nameEn}</strong> ({selectedStep.competencyId})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStep(null)}
                aria-label="Close modal"
                className="text-[#6B7280] hover:text-[#111827] cursor-pointer p-1 text-[18px] rounded"
              >
                ✕
              </button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary">{selectedStep.courses[0]?.provider || 'iGOT Karmayogi'}</Badge>
              <Badge tone="neutral">Target Level: L{selectedStep.toLevel}</Badge>
              <Badge tone="neutral">{hours(selectedStep.estHours)} effort</Badge>
              {selectedStep.isPrerequisite ? (
                <Badge tone="neutral">Prerequisite</Badge>
              ) : (
                <Badge tone="primary">Role Target</Badge>
              )}
            </div>

            {/* Why & Details */}
            <div className="space-y-3 text-[13px] text-[#4B5563]">
              <div className="rounded border border-[#E5E7EB] bg-[#F8FAFC] p-3 space-y-1">
                <p className="font-semibold text-[#111827]">Prerequisite Rationale:</p>
                <p className="text-[12px] text-[#6B7280]">{selectedStep.why}</p>
                {selectedStep.unlocks.length > 0 && (
                  <p className="text-[12px] text-[#0284C7] font-medium pt-1">
                    Directly unblocks: {selectedStep.unlocks.join(', ')}
                  </p>
                )}
              </div>

              {/* Standardized Government Curriculum Units */}
              <div className="rounded border border-[#E5E7EB] bg-white p-3 space-y-1.5">
                <p className="font-semibold text-[#111827]">Curriculum Units &amp; Learning Objectives:</p>
                <ul className="list-disc pl-4 space-y-1 text-[12px] text-[#6B7280]">
                  <li>Unit 1: Foundational theory, statutory standards, and administrative guidelines</li>
                  <li>Unit 2: Applied data tabulations, statistical protocols, and practical exercises</li>
                  <li>Unit 3: Real-world case studies from NSSO, CSO, and state statistical directorates</li>
                  <li>Unit 4: Milestone evaluation quiz &amp; immutable evidence verification</li>
                </ul>
              </div>

              {/* Integration Status */}
              <div className="rounded border border-[#0284C7]/20 bg-[#F0F9FF] p-2.5 text-[12px] text-[#111827]">
                <strong>Government LMS Integration:</strong> Enrolment telemetry syncs directly with iGOT Karmayogi /
                NSSTA TPAC learning records.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E5E7EB]">
              <div>
                {selectedStep.courses[0]?.url && (
                  <a
                    href={selectedStep.courses[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0284C7] hover:underline"
                  >
                    Open on iGOT Portal <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                {getItemStatus(selectedStep, progress) === 'completed' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      handleUpdateStatus(selectedStep, 'not_started');
                      setSelectedStep(null);
                    }}
                  >
                    <RotateCcw size={13} className="mr-1" /> Mark Incomplete
                  </Button>
                ) : (
                  <>
                    {getItemStatus(selectedStep, progress) === 'not_started' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          handleUpdateStatus(selectedStep, 'in_progress');
                          setSelectedStep(null);
                        }}
                      >
                        <PlayCircle size={13} className="mr-1 text-[#0284C7]" /> Start Course
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        handleUpdateStatus(selectedStep, 'completed');
                        setSelectedStep(null);
                      }}
                    >
                      <Check size={13} className="mr-1" /> Mark Complete
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelectedStep(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
