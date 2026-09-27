import React, { useState, useEffect, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  ListChecks,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import {
  api,
  getToken,
  post,
  type AssignmentItem,
  type GenerationSummary,
  type QuestionItem,
  type TrainerAssignmentsResponse,
} from '../lib/api.js';
import { num, pct } from '../lib/format.js';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Spinner, Td, Th } from '../components/ui.js';

interface Ingest {
  documentId: string;
  pages: number;
  chunks: number;
  tagged: { competencyId: string; nameEn: string; chunks: number; terms: string[] }[];
}

interface TrainerOverview {
  documentsCount: number;
  totalChunksCount: number;
  questionsTotal: number;
  questionsCandidate: number;
  questionsApproved: number;
  questionsRejected: number;
  activeLearnersCount: number;
  recentSessions: {
    id: string;
    officialName: string;
    startedAt: string;
    submittedAt: string | null;
    scorePct: number | null;
  }[];
}

interface DocumentItem {
  id: string;
  title: string;
  mimeType: string;
  createdAt: string;
  uploadedBy: { nameEn: string };
  _count: { chunks: number; questions: number };
}

type TrainerTab = 'overview' | 'assignments' | 'materials' | 'generate' | 'review' | 'assessments' | 'results';

function formatDateTime(raw?: string | null): string {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export class TrainerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('[TrainerErrorBoundary] Runtime exception caught safely:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl py-12 px-4 space-y-4">
          <div className="rounded-lg border border-critical/30 bg-surface p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-critical/10 text-critical font-bold text-[18px]">
                !
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-ink">Trainer Dashboard Notice</h3>
                <p className="text-[13px] text-muted">
                  A rendering error was caught safely. Your data and previous changes remain preserved.
                </p>
              </div>
            </div>
            {this.state.error?.message && (
              <div className="rounded bg-raised p-3 text-[12px] font-mono text-critical overflow-x-auto">
                {String(this.state.error.message)}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
                Retry View
              </Button>
              <Button variant="secondary" onClick={() => { window.location.href = '/trainer?tab=overview'; }}>
                Return to Overview
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

class TabErrorBoundary extends React.Component<
  { children: React.ReactNode; tabName: string; onReset?: () => void },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error(`[TabErrorBoundary:${this.props.tabName}] Error caught:`, error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 space-y-3 border border-critical/20 rounded-lg bg-surface">
          <div className="flex items-center gap-2 text-critical font-bold text-[15px]">
            <span>Error rendering {this.props.tabName} section</span>
          </div>
          <p className="text-[13px] text-muted">
            The error was intercepted safely so your session is not interrupted.
          </p>
          {this.state.error?.message && (
            <p className="text-[12px] font-mono text-critical bg-raised p-2 rounded">
              {String(this.state.error.message)}
            </p>
          )}
          <Button
            size="sm"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
          >
            Retry Section
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function TrainerInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as TrainerTab) || 'overview';

  const setTab = (tab: TrainerTab) => {
    setSearchParams({ tab });
  };

  // Upload & Generation state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(20);
  const [provider, setProvider] = useState<'default' | 'mock' | 'gemini' | 'ollama'>('default');

  const [overview, setOverview] = useState<TrainerOverview | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  // Trainer Assignments State
  const [trainerAssignmentsData, setTrainerAssignmentsData] = useState<TrainerAssignmentsResponse | null>(null);
  const [competencyList, setCompetencyList] = useState<{ id: string; nameEn: string; domain: string }[]>([]);
  const [courseList, setCourseList] = useState<{ id: string; name: string; provider: string }[]>([]);

  // Create Assignment Form State
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assignCompId, setAssignCompId] = useState('');
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assignDifficulty, setAssignDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [assignCount, setAssignCount] = useState<number>(5);
  const [assignCustomCount, setAssignCustomCount] = useState<string>('');
  const [assignContentMode, setAssignContentMode] = useState<'file' | 'text'>('file');
  const [assignText, setAssignText] = useState('');
  const [assignFile, setAssignFile] = useState<File | null>(null);
  const [assignVideoWarning, setAssignVideoWarning] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignCreatedSummary, setAssignCreatedSummary] = useState<any | null>(null);

  // Publishing State
  const [publishModalAssignment, setPublishModalAssignment] = useState<AssignmentItem | null>(null);
  const [publishScope, setPublishScope] = useState<'all' | 'custom'>('all');
  const [publishing, setPublishing] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);

  // Feedback State
  const [feedbackModalAssignment, setFeedbackModalAssignment] = useState<AssignmentItem | null>(null);
  const [trainerFeedbackText, setTrainerFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [ingest, setIngest] = useState<Ingest | null>(null);
  const [summary, setSummary] = useState<GenerationSummary | null>(null);
  const [items, setItems] = useState<QuestionItem[] | null>(null);
  const [filter, setFilter] = useState<'CANDIDATE' | 'REJECTED' | 'APPROVED'>('CANDIDATE');
  const [busy, setBusy] = useState<null | 'upload' | 'generate' | 'loading'>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [ov, docs, tAssignments, comps, crs] = await Promise.all([
        api<TrainerOverview>('/trainer/overview').catch(() => null),
        api<DocumentItem[]>('/documents').catch(() => []),
        api<TrainerAssignmentsResponse>('/assignments/trainer').catch(() => null),
        api<{ id: string; nameEn: string; domain: string }[]>('/ontology/competencies').catch(() => []),
        api<{ id: string; name: string; provider: string }[]>('/ontology/courses').catch(() => []),
      ]);
      if (ov) setOverview(ov);
      if (Array.isArray(docs)) {
        setDocuments(docs);
        if (docs.length > 0 && !selectedDocId) {
          setSelectedDocId(docs[0]?.id || '');
        }
      }
      if (tAssignments) setTrainerAssignmentsData(tAssignments);
      setCompetencyList(Array.isArray(comps) ? comps : []);
      if (comps && comps.length > 0 && !assignCompId) setAssignCompId(comps[0]?.id || '');
      setCourseList(Array.isArray(crs) ? crs : []);
    } catch (e: any) {
      // Non-fatal if initial load fails
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      api<QuestionItem[]>(`/documents/${selectedDocId}/questions`)
        .then(setItems)
        .catch(() => {});
    }
  }, [selectedDocId]);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
  }

  async function upload() {
    if (!file) return;
    setBusy('upload');
    setError(null);
    setSummary(null);
    setItems(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title || file.name);
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Upload failed');
      setIngest(body);
      setSelectedDocId(body.documentId);
      await loadData();
      setTab('generate');
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    const docId = ingest?.documentId || selectedDocId;
    if (!docId) return;
    setBusy('generate');
    setError(null);
    try {
      const s = await post<GenerationSummary>(`/documents/${docId}/generate`, {
        target,
        ...(provider === 'default' ? {} : { provider }),
      });
      setSummary(s);
      const qs = await api<QuestionItem[]>(`/documents/${docId}/questions`);
      setItems(qs);
      await loadData();
      setTab('review');
    } catch (e: any) {
      setError(e?.message ?? 'Generation failed');
    } finally {
      setBusy(null);
    }
  }

  async function review(id: string, action: 'approve' | 'reject') {
    const docId = ingest?.documentId || selectedDocId;
    await post(`/questions/${id}/review`, { action });
    if (docId) {
      const qs = await api<QuestionItem[]>(`/documents/${docId}/questions`);
      setItems(qs);
      loadData();
    }
  }

  const shown = (items ?? []).filter((q) => q.status === filter);
  const counts = {
    CANDIDATE: (items ?? []).filter((q) => q.status === 'CANDIDATE').length,
    APPROVED: (items ?? []).filter((q) => q.status === 'APPROVED').length,
    REJECTED: (items ?? []).filter((q) => q.status === 'REJECTED').length,
  };

  return (
    <div className="space-y-5">
      <header className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-ink">Trainer Hub &amp; Assessment Engine</h1>
              <Badge tone="primary" icon={<GraduationCap size={13} />}>SIH26101 Faculty Suite</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-[13px] text-muted">
              National Statistical Systems Training Academy (NSSTA) · Curriculum ingestion, deterministic 8-gate MCQ generation,
              assessment authoring, and learner evaluation.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => loadData()}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>

        {/* Tab Navigation */}
        <nav className="mt-4 flex flex-wrap gap-1 border-b border-border pt-1">
          <button
            onClick={() => setTab('overview')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              currentTab === 'overview'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Layers size={15} /> Overview &amp; Analytics
          </button>
          <button
            onClick={() => setTab('assignments')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              currentTab === 'assignments'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <FileText size={15} /> Assignments &amp; Publishing ({trainerAssignmentsData?.assignments?.length ?? 0})
          </button>
          <button
            onClick={() => setTab('materials')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              currentTab === 'materials'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <BookOpen size={15} /> Learning Materials ({documents.length})
          </button>
          <button
            onClick={() => setTab('generate')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              currentTab === 'generate'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Sparkles size={15} /> AI Assessment Engine
          </button>
          <button
            onClick={() => setTab('review')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              currentTab === 'review'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <ListChecks size={15} /> Question Bank ({counts.CANDIDATE} Pending)
          </button>
          <button
            onClick={() => setTab('assessments')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              currentTab === 'assessments'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <ClipboardCheck size={15} /> Assessments
          </button>
          <button
            onClick={() => setTab('results')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              currentTab === 'results'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <GraduationCap size={15} /> Assessment Results
          </button>
        </nav>
      </header>

      {error && <Alert tone="critical" title="Operation failed">{error}</Alert>}

      <TabErrorBoundary tabName={currentTab} onReset={() => loadData()}>
      {/* ── TAB 1: OVERVIEW ── */}
      {currentTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Training Materials</p>
                <BookOpen size={16} className="text-primary" />
              </div>
              <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">
                {overview?.documentsCount ?? documents.length}
              </p>
              <p className="mt-1 text-[12px] text-muted">
                {num(overview?.totalChunksCount ?? 0)} semantic knowledge chunks indexed
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Questions in Bank</p>
                <Sparkles size={16} className="text-primary" />
              </div>
              <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">
                {overview?.questionsTotal ?? 0}
              </p>
              <p className="mt-1 text-[12px] text-muted">
                <span className="text-success font-semibold">{overview?.questionsApproved ?? 0} approved</span> ·{' '}
                <span className="text-moderate font-semibold">{overview?.questionsCandidate ?? 0} review</span>
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Active Learners</p>
                <Users size={16} className="text-primary" />
              </div>
              <p className="tnum mt-1 text-[28px] font-bold leading-none text-ink">
                {overview?.activeLearnersCount ?? 0}
              </p>
              <p className="mt-1 text-[12px] text-muted">officials taking diagnostics &amp; training</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Quality Gate Standard</p>
                <CheckCircle2 size={16} className="text-success" />
              </div>
              <p className="tnum mt-1 text-[28px] font-bold leading-none text-success">8 Gates</p>
              <p className="mt-1 text-[12px] text-muted">plausibility, distractor balance, answer leakage</p>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Curriculum Content Status"
                subtitle="Indexed training materials available for assessment generation"
                action={
                  <Button size="sm" onClick={() => setTab('materials')}>
                    <Plus size={14} /> Upload New
                  </Button>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-border bg-raised/50">
                      <Th>Document Title</Th>
                      <Th align="right">Chunks</Th>
                      <Th align="right">Questions</Th>
                      <Th align="right">Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.slice(0, 5).map((d) => (
                      <tr key={d.id} className="border-b border-border hover:bg-surface">
                        <Td>
                          <span className="font-medium text-ink">{d.title}</span>
                          <span className="block text-[11px] text-subtle font-mono">
                            {new Date(d.createdAt).toLocaleDateString('en-IN')}
                          </span>
                        </Td>
                        <Td align="right">{d._count.chunks}</Td>
                        <Td align="right">
                          <span className="font-semibold text-primary">{d._count.questions}</span>
                        </Td>
                        <Td align="right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedDocId(d.id);
                              setTab('generate');
                            }}
                          >
                            Generate
                          </Button>
                        </Td>
                      </tr>
                    ))}
                    {documents.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-muted text-[13px]">
                          No training materials uploaded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Recent Learner Assessment Activity"
                subtitle="Latest quiz submissions and diagnostics across divisions"
                action={
                  <button
                    onClick={() => setTab('results')}
                    className="text-[12px] font-medium text-primary hover:underline cursor-pointer"
                  >
                    View all results →
                  </button>
                }
              />
              <div className="p-4 space-y-2.5">
                {(overview?.recentSessions ?? []).slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between border-b border-border/50 pb-2 text-[13px]">
                    <div>
                      <p className="font-medium text-ink">{s.officialName}</p>
                      <p className="text-[11px] text-subtle font-mono">
                        Started: {new Date(s.startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      {s.scorePct !== null ? (
                        <span className="font-bold text-primary tnum">{pct(s.scorePct)}</span>
                      ) : (
                        <Badge tone="neutral">In Progress</Badge>
                      )}
                    </div>
                  </div>
                ))}
                {(!overview?.recentSessions || overview.recentSessions.length === 0) && (
                  <p className="text-center py-4 text-muted text-[13px]">No learner assessment sessions yet.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB: ASSIGNMENTS & PUBLISHING ── */}
      {currentTab === 'assignments' && (
        <div className="space-y-6">
          {/* Top Actions & KPI Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-bold text-ink">Curriculum Assignments &amp; AI Publishing</h2>
              <p className="text-[13px] text-muted">
                Synthesize AI assessments from training documents, assign them to learners, and review evaluated submissions.
              </p>
            </div>
            <Button onClick={() => setShowCreateAssignment(!showCreateAssignment)}>
              <Plus size={15} className="mr-1.5" /> {showCreateAssignment ? 'Hide Assignment Creator' : 'Create New Assignment'}
            </Button>
          </div>

          {publishSuccessMsg && (
            <Alert tone="success" title="Assignment Published">
              {publishSuccessMsg}
            </Alert>
          )}

          {/* Trainer KPI Summary */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Assigned Instances</p>
              <p className="tnum mt-1 text-[26px] font-bold text-ink">
                {trainerAssignmentsData?.stats?.totalAssigned ?? 0}
              </p>
              <p className="text-[12px] text-muted">across registered learners</p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Completed Submissions</p>
              <p className="tnum mt-1 text-[26px] font-bold text-success">
                {trainerAssignmentsData?.stats?.completedCount ?? 0}
              </p>
              <p className="text-[12px] text-muted">evaluated quizzes</p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Pending Submissions</p>
              <p className="tnum mt-1 text-[26px] font-bold text-primary">
                {trainerAssignmentsData?.stats?.pendingCount ?? 0}
              </p>
              <p className="text-[12px] text-muted">attempts in progress</p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Average Score</p>
              <p className="tnum mt-1 text-[26px] font-bold text-ink">
                {trainerAssignmentsData?.stats?.averageScore !== null && trainerAssignmentsData?.stats?.averageScore !== undefined
                  ? `${trainerAssignmentsData.stats.averageScore}%`
                  : '—'}
              </p>
              <p className="text-[12px] text-muted">across evaluated submissions</p>
            </Card>
          </div>

          {/* Assignment Creation Form */}
          {showCreateAssignment && (
            <Card className="border border-primary/30">
              <CardHeader
                title="Create Curriculum Assignment &amp; AI Quiz"
                subtitle="Upload literature or write study materials to generate an assessment grounded strictly in the source text."
              />
              <div className="p-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Assignment Title *" htmlFor="tr-assign-title">
                    <Input
                      id="tr-assign-title"
                      value={assignTitle}
                      onChange={(e) => setAssignTitle(e.target.value)}
                      placeholder="e.g. Introduction to Survey Sampling"
                    />
                  </Field>

                  <Field label="Target Competency / Skill *" htmlFor="tr-assign-comp">
                    <Select
                      id="tr-assign-comp"
                      value={assignCompId}
                      onChange={(e) => setAssignCompId(e.target.value)}
                    >
                      {competencyList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameEn} ({c.domain})
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Related Course (Optional)" htmlFor="tr-assign-course">
                    <Select
                      id="tr-assign-course"
                      value={assignCourseId}
                      onChange={(e) => setAssignCourseId(e.target.value)}
                    >
                      <option value="">None / General Module</option>
                      {courseList.map((crs) => (
                        <option key={crs.id} value={crs.id}>
                          {crs.name} ({crs.provider})
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Difficulty Level" htmlFor="tr-assign-diff">
                    <Select
                      id="tr-assign-diff"
                      value={assignDifficulty}
                      onChange={(e) => setAssignDifficulty(e.target.value as any)}
                    >
                      <option value="EASY">Easy (Foundational)</option>
                      <option value="MEDIUM">Medium (Intermediate)</option>
                      <option value="HARD">Hard (Advanced / Evaluative)</option>
                    </Select>
                  </Field>

                  <Field label="Number of Questions *" htmlFor="tr-assign-count">
                    <Select
                      id="tr-assign-count"
                      value={assignCustomCount ? 'custom' : assignCount}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setAssignCustomCount('10');
                        } else {
                          setAssignCustomCount('');
                          setAssignCount(Number(e.target.value));
                        }
                      }}
                    >
                      <option value="5">5 questions</option>
                      <option value="10">10 questions</option>
                      <option value="15">15 questions</option>
                      <option value="20">20 questions</option>
                      <option value="25">25 questions</option>
                      <option value="custom">Custom count...</option>
                    </Select>
                    {assignCustomCount && (
                      <Input
                        type="number"
                        min={3}
                        max={25}
                        className="mt-2"
                        value={assignCustomCount}
                        onChange={(e) => setAssignCustomCount(e.target.value)}
                        placeholder="Count (3–25)"
                      />
                    )}
                  </Field>
                </div>

                <Field label="Description / Learning Objective" htmlFor="tr-assign-desc">
                  <Input
                    id="tr-assign-desc"
                    value={assignDesc}
                    onChange={(e) => setAssignDesc(e.target.value)}
                    placeholder="e.g. Master survey sampling fundamentals and multi-stage stratification"
                  />
                </Field>

                <Field label="Instructions for Learners" htmlFor="tr-assign-inst">
                  <Input
                    id="tr-assign-inst"
                    value={assignInstructions}
                    onChange={(e) => setAssignInstructions(e.target.value)}
                    placeholder="e.g. Complete this diagnostic quiz prior to Session 3 on NSS field surveys"
                  />
                </Field>

                {/* Content Input Mode */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-ink">Learning Material Source *</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAssignContentMode('file')}
                        className={`px-3 py-1.5 text-[12px] font-semibold rounded transition-colors cursor-pointer ${
                          assignContentMode === 'file'
                            ? 'bg-primary text-white'
                            : 'bg-surface border border-border text-muted hover:text-ink'
                        }`}
                      >
                        <Upload size={13} className="inline mr-1" /> Upload Document
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignContentMode('text')}
                        className={`px-3 py-1.5 text-[12px] font-semibold rounded transition-colors cursor-pointer ${
                          assignContentMode === 'text'
                            ? 'bg-primary text-white'
                            : 'bg-surface border border-border text-muted hover:text-ink'
                        }`}
                      >
                        <FileText size={13} className="inline mr-1" /> Type / Paste Text
                      </button>
                    </div>
                  </div>

                  {assignContentMode === 'file' ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border-2 border-dashed border-border bg-surface p-5 text-center">
                        <Upload size={22} className="mx-auto text-subtle mb-1.5" />
                        <p className="text-[13px] font-medium text-ink">Select curriculum literature file</p>
                        <p className="text-[12px] text-muted">Supported formats: PDF, PPTX, DOCX, TXT</p>
                        <input
                          type="file"
                          accept=".pdf,.pptx,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,video/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            setAssignFile(f);
                            setAssignVideoWarning(null);
                            if (f) {
                              const nameLower = f.name.toLowerCase();
                              if (
                                f.type.startsWith('video/') ||
                                nameLower.endsWith('.mp4') ||
                                nameLower.endsWith('.avi') ||
                                nameLower.endsWith('.mov') ||
                                nameLower.endsWith('.mkv') ||
                                nameLower.endsWith('.webm')
                              ) {
                                setAssignVideoWarning(
                                  'Video processing is not configured yet. STATINTEL does not fabricate video transcripts. Please upload PDF, PPTX, DOCX, or TXT documents or paste text directly.'
                                );
                              } else if (!assignTitle) {
                                setAssignTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
                              }
                            }
                          }}
                          className="mt-3 block w-full text-[12px] text-muted file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[12px] file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover cursor-pointer"
                        />
                      </div>
                      {assignVideoWarning && (
                        <Alert tone="critical" title="Video Format Detected">
                          {assignVideoWarning}
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <div>
                      <textarea
                        rows={6}
                        value={assignText}
                        onChange={(e) => setAssignText(e.target.value)}
                        placeholder="Type or paste the official curriculum guidelines or training text here (at least 40 characters)..."
                        className="w-full rounded-md border border-border bg-white px-3 py-2 text-[13px] font-sans leading-relaxed text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowCreateAssignment(false)}>
                    Cancel
                  </Button>
                  <Button
                    loading={assignBusy}
                    onClick={async () => {
                      if (!assignTitle.trim()) {
                        setError('Please provide an assignment title');
                        return;
                      }
                      if (assignContentMode === 'text' && assignText.trim().length < 40) {
                        setError('Please provide at least 40 characters of learning material');
                        return;
                      }
                      if (assignContentMode === 'file' && !assignFile) {
                        setError('Please select a file to upload');
                        return;
                      }
                      if (assignContentMode === 'file' && assignVideoWarning) {
                        setError(assignVideoWarning);
                        return;
                      }

                      setAssignBusy(true);
                      setError(null);
                      try {
                        const finalCount = assignCustomCount
                          ? Math.min(25, Math.max(3, parseInt(assignCustomCount, 10)))
                          : assignCount;

                        const form = new FormData();
                        form.append('title', assignTitle.trim());
                        if (assignDesc) form.append('description', assignDesc.trim());
                        if (assignInstructions) form.append('instructions', assignInstructions.trim());
                        if (assignCompId) form.append('competencyId', assignCompId);
                        if (assignCourseId) form.append('courseId', assignCourseId);
                        form.append('difficulty', assignDifficulty);
                        form.append('questionCount', String(finalCount));
                        form.append('isPersonal', 'false');

                        if (assignContentMode === 'file' && assignFile) {
                          form.append('file', assignFile);
                        } else {
                          form.append('content', assignText.trim());
                        }

                        const res = await fetch('/api/assignments', {
                          method: 'POST',
                          headers: { authorization: `Bearer ${getToken()}` },
                          body: form,
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error || 'Failed to create assignment');

                        setAssignCreatedSummary(json);
                        await loadData();
                      } catch (err: any) {
                        setError(err?.message || 'Failed to create assignment');
                      } finally {
                        setAssignBusy(false);
                      }
                    }}
                  >
                    <Sparkles size={15} className="mr-1.5" /> Generate AI Quiz &amp; Save Assignment
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Generated Preview & Publish Trigger */}
          {assignCreatedSummary && (
            <Card className="border border-success/40 bg-success/5 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-success" />
                  <h3 className="text-[16px] font-bold text-ink">
                    Assignment Created &amp; {assignCreatedSummary.questions?.length} MCQs Generated
                  </h3>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setPublishModalAssignment(assignCreatedSummary.assignment);
                  }}
                >
                  <Send size={14} className="mr-1.5" /> Publish to Learners Now →
                </Button>
              </div>
              <p className="text-[13px] text-muted">
                Questions are synthesized strictly from "{assignCreatedSummary.assignment.title}". Click Publish to assign
                to all learners or a specific cohort.
              </p>
            </Card>
          )}

          {/* Master Assignment Instances & Learner Submissions Table */}
          <Card>
            <CardHeader
              title="Learner Assignment Submissions &amp; Status"
              subtitle="Track attempt progress, evaluation scores, and provide feedback across learners"
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-raised/50">
                    <Th>Learner</Th>
                    <Th>Assignment Title</Th>
                    <Th>Competency</Th>
                    <Th>Status</Th>
                    <Th align="right">Score</Th>
                    <Th align="right">Completed Date</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {(trainerAssignmentsData?.assignments ?? []).map((a) => (
                    <tr key={a.id} className="border-b border-border hover:bg-surface">
                      <Td>
                        <span className="font-semibold text-ink">{a.assignedTo?.nameEn || 'All Learners'}</span>
                        <span className="block text-[11px] text-subtle">
                          {a.assignedTo?.designation || 'Staff'} · {a.assignedTo?.department?.nameEn || 'MoSPI'}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-medium text-ink">{a.title}</span>
                      </Td>
                      <Td>{a.competency?.nameEn || 'Statistical Core'}</Td>
                      <Td>
                        <Badge tone={a.status === 'COMPLETED' ? 'success' : a.status === 'IN_PROGRESS' ? 'primary' : 'neutral'}>
                          {a.status === 'COMPLETED' ? 'Completed' : a.status === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'}
                        </Badge>
                      </Td>
                      <Td align="right">
                        {a.scorePct !== null ? (
                          <span className="font-bold text-success tnum">{num(a.scorePct, 0)}%</span>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td align="right" className="text-muted">
                        {formatDateTime(a.submittedAt)}
                      </Td>
                      <Td align="right">
                        {a.status === 'COMPLETED' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setFeedbackModalAssignment(a);
                              setTrainerFeedbackText(a.feedback || '');
                            }}
                          >
                            {a.feedback ? 'Edit Feedback' : 'Give Feedback'}
                          </Button>
                        ) : (
                          <span className="text-[11px] text-subtle">Awaiting attempt</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                  {(!trainerAssignmentsData?.assignments || trainerAssignmentsData.assignments.length === 0) && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-muted text-[13px]">
                        No curriculum assignments published yet. Click "Create New Assignment" above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 2: LEARNING MATERIALS ── */}
      {currentTab === 'materials' && (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader title="Upload Curriculum Material" subtitle="PDF, PPTX, DOCX, TXT or MD up to 25 MB" />
              <div className="space-y-3 p-4">
                <Field label="File" htmlFor="file" required>
                  <input
                    id="file"
                    type="file"
                    onChange={onPick}
                    accept=".pdf,.pptx,.docx,.txt,.md"
                    className="block w-full text-[13px] text-muted file:mr-3 file:min-h-[36px] file:cursor-pointer file:rounded file:border file:border-border-strong file:bg-surface file:px-3 file:text-[13px] file:font-medium file:text-ink"
                  />
                </Field>
                <Field label="Document Title" htmlFor="title" hint="Citation title displayed alongside generated questions.">
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Stratified Sampling (NSSTA Handbook)"
                  />
                </Field>
                <Button onClick={upload} disabled={!file} loading={busy === 'upload'} className="w-full">
                  <Upload size={16} aria-hidden="true" /> Extract and Tag Chunks
                </Button>
              </div>
            </Card>

            {ingest && (
              <Card>
                <CardHeader
                  title="Tagging Diagnostics"
                  subtitle={`${ingest.pages} pages → ${ingest.chunks} chunks indexed`}
                />
                <div className="p-4 space-y-2">
                  <p className="text-[12px] text-muted">
                    Competencies tagged automatically via sovereign local lexical hashing:
                  </p>
                  <ul className="space-y-1.5 mt-2">
                    {ingest.tagged.slice(0, 5).map((t) => (
                      <li key={t.competencyId} className="rounded border border-border p-2 text-[12px]">
                        <div className="flex justify-between font-medium text-ink">
                          <span>{t.nameEn}</span>
                          <span className="text-primary">{t.chunks} chunks</span>
                        </div>
                        <p className="text-[11px] text-subtle mt-0.5">Matched terms: {t.terms.join(', ')}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader
              title="Curriculum Library"
              subtitle="All training materials uploaded and available in STATINTEL"
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-raised/50">
                    <Th>Title</Th>
                    <Th>Uploaded By</Th>
                    <Th align="right">Chunks</Th>
                    <Th align="right">Questions</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id} className="border-b border-border hover:bg-surface">
                      <Td>
                        <span className="font-semibold text-ink">{d.title}</span>
                        <span className="block text-[11px] text-subtle font-mono">
                          {d.mimeType} · {new Date(d.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </Td>
                      <Td>{d.uploadedBy?.nameEn || 'Faculty'}</Td>
                      <Td align="right">{d._count.chunks}</Td>
                      <Td align="right">
                        <span className="font-bold text-primary">{d._count.questions}</span>
                      </Td>
                      <Td align="right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedDocId(d.id);
                            setTab('generate');
                          }}
                        >
                          Generate AI MCQs
                        </Button>
                      </Td>
                    </tr>
                  ))}
                  {documents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted text-[13px]">
                        No materials uploaded yet. Use the upload form on the left.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 3: GENERATE ── */}
      {currentTab === 'generate' && (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader title="AI Assessment Generation" subtitle="Deterministic 8-gate MCQ synthesis" />
              <div className="space-y-3 p-4">
                <Field label="Source Material" htmlFor="docSelect">
                  <Select
                    id="docSelect"
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                  >
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} ({d._count.chunks} chunks)
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Target Accepted Questions"
                  htmlFor="target"
                  hint="Generates ~1.6× candidates to accommodate deterministic quality gate rejections."
                >
                  <Input
                    id="target"
                    type="number"
                    min={4}
                    max={60}
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value))}
                  />
                </Field>

                <Field
                  label="AI Assessment Generator"
                  htmlFor="provider"
                  hint="Primary Gemini with automatic fallback to offline deterministic generator."
                >
                  <Select
                    id="provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as any)}
                  >
                    <option value="default">Production Default (Gemini + Local Fallback)</option>
                    <option value="gemini">Gemini Hosted API</option>
                    <option value="mock">Offline Template Generator</option>
                    <option value="ollama">Ollama (Local Sovereign Model)</option>
                  </Select>
                </Field>

                <Button
                  onClick={generate}
                  disabled={!selectedDocId}
                  loading={busy === 'generate'}
                  className="w-full"
                >
                  <Sparkles size={16} /> Run Assessment Generation
                </Button>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            {busy === 'generate' && (
              <Card>
                <Spinner label="Executing AI generation and running 8 deterministic quality gates..." />
              </Card>
            )}

            {summary && (
              <Card>
                <CardHeader
                  title="Quality Gate Report"
                  subtitle={`${summary.candidates} candidates generated in ${num(summary.elapsedMs)} ms · ${summary.provider}${summary.sovereign ? ' · Sovereign' : ''}`}
                  action={
                    summary.generationMode === 'FALLBACK' || summary.provider === 'fallback' || summary.provider === 'mock' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
                        <AlertTriangle size={13} />
                        AI generation unavailable. Using STATINTEL local fallback.
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-success/10 border border-success/30 text-success text-[11px] font-semibold">
                        <Sparkles size={13} />
                        Generated with AI
                      </span>
                    )
                  }
                />
                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  <div className="rounded border border-success/30 bg-success/10 p-3">
                    <p className="text-[12px] font-medium text-subtle">Accepted for Review</p>
                    <p className="tnum mt-1 text-[26px] font-bold text-success">{summary.accepted}</p>
                  </div>
                  <div className="rounded border border-critical/30 bg-critical/10 p-3">
                    <p className="text-[12px] font-medium text-subtle">Rejected by Gates</p>
                    <p className="tnum mt-1 text-[26px] font-bold text-critical">{summary.rejected}</p>
                  </div>
                  <div className="rounded border border-border bg-raised p-3">
                    <p className="text-[12px] font-medium text-subtle">Rejection Rate</p>
                    <p className="tnum mt-1 text-[26px] font-bold text-ink">{pct(summary.rejectionRate * 100)}</p>
                    <p className="text-[11px] text-subtle mt-0.5">Healthy range: 15–45%</p>
                  </div>
                </div>

                {summary.byReason.length > 0 && (
                  <div className="border-t border-border p-4">
                    <p className="text-[13px] font-semibold text-ink flex items-center gap-1.5 mb-2">
                      <ShieldAlert size={15} className="text-primary" /> Failed Quality Gate Breakdown:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {summary.byReason.map((r) => (
                        <Badge key={r.code} tone="neutral">
                          {r.code}: {r.label} ({r.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-4 border-t border-border flex justify-end">
                  <Button size="sm" onClick={() => setTab('review')}>
                    Proceed to Question Review →
                  </Button>
                </div>
              </Card>
            )}

            {!summary && busy !== 'generate' && (
              <Card>
                <EmptyState title="Select a Document and Generate">
                  Choose a curriculum document and target count on the left to synthesize new MCQ questions grounded strictly in the official source text.
                </EmptyState>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: REVIEW & QUESTION BANK ── */}
      {currentTab === 'review' && (
        <Card>
          <CardHeader
            title="Question Bank Review"
            subtitle="Only approved items can be served to learners in diagnostic or milestone quizzes"
            action={
              <div className="flex items-center gap-2">
                {documents.length > 0 && (
                  <Select
                    id="doc-selector"
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="min-h-[36px] w-auto text-[13px]"
                  >
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} ({d._count?.questions ?? 0} Qs)
                      </option>
                    ))}
                  </Select>
                )}
                <Filter size={14} className="text-subtle" />
                <Select
                  id="status-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="min-h-[36px] w-auto text-[13px]"
                >
                  <option value="CANDIDATE">Awaiting Review ({counts.CANDIDATE})</option>
                  <option value="APPROVED">Approved ({counts.APPROVED})</option>
                  <option value="REJECTED">Gate Rejected ({counts.REJECTED})</option>
                </Select>
                {selectedDocId && counts.APPROVED > 0 && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const doc = documents.find((d) => d.id === selectedDocId);
                      setPublishModalAssignment({
                        id: selectedDocId,
                        title: doc ? `${doc.title} Assessment` : 'Curriculum Assessment',
                        questionCount: counts.APPROVED,
                      } as any);
                    }}
                  >
                    <Send size={13} /> Publish Assessment
                  </Button>
                )}
              </div>
            }
          />

          {shown.length === 0 ? (
            <EmptyState title="No questions in this filter">
              {filter === 'CANDIDATE'
                ? 'All candidate questions have been approved or rejected.'
                : 'No items found matching this filter.'}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((q) => (
                <li key={q.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="primary">{q.competency?.nameEn || 'Curriculum Competency'}</Badge>
                    <Badge tone="neutral">{q.bloom || 'REMEMBER'}</Badge>
                    <Badge tone="neutral">Difficulty: {q.difficulty || 'MEDIUM'}</Badge>
                    <Badge tone="neutral">Page {q.page || 1}</Badge>
                  </div>

                  <p className="text-[15px] font-semibold text-ink leading-relaxed">{q.stem}</p>

                  <ol className="space-y-1.5 pl-2">
                    {(q.options || []).map((opt, i) => (
                      <li
                        key={i}
                        className={`flex items-start gap-2 text-[13px] rounded p-1.5 ${
                          i === q.correctIndex
                            ? 'bg-success/10 font-semibold text-ink border border-success/30'
                            : 'text-muted'
                        }`}
                      >
                        <span className="font-mono text-subtle">{String.fromCharCode(65 + i)}.</span>
                        <span className="flex-1">{opt}</span>
                        {i === q.correctIndex && (
                          <span className="flex items-center gap-1 text-[11px] text-success font-semibold shrink-0">
                            <CheckCircle2 size={14} /> Correct Option
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>

                  <div className="rounded border border-border bg-surface p-3 text-[12px]">
                    <div className="flex items-center gap-1.5 font-medium text-subtle mb-1">
                      <FileText size={13} /> Source Citation · {q.headingPath || 'General'} · Page {q.page || 1}
                    </div>
                    <blockquote className="border-l-2 border-primary pl-2.5 italic text-muted text-[12px] leading-relaxed">
                      "{q.sourceQuote || 'Curriculum reference grounded in verified statistical text.'}"
                    </blockquote>
                  </div>

                  {q.status === 'CANDIDATE' && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => review(q.id, 'approve')}>
                        <CheckCircle2 size={14} /> Approve Question
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => review(q.id, 'reject')}>
                        <XCircle size={14} /> Reject Candidate
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ── TAB 5: ASSESSMENTS ── */}
      {currentTab === 'assessments' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Curriculum-Aligned Assessments"
              subtitle="Manage and inspect assessments created from official statistical learning materials"
            />
            <div className="p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="rounded-lg border border-border bg-surface p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary-soft px-2 py-0.5 rounded">
                          {doc.mimeType?.split('/')[1]?.toUpperCase() || 'DOCUMENT'}
                        </span>
                        <Badge tone="success">Active Assessment</Badge>
                      </div>
                      <h4 className="mt-2 text-[14px] font-semibold text-ink leading-snug">{doc.title} Assessment Module</h4>
                      <p className="mt-1 text-[12px] text-muted line-clamp-2">
                        Automated evaluation module grounded in {doc._count?.chunks ?? 0} indexed curriculum chunks.
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-[11px] text-subtle font-mono">
                        <span>{doc._count?.questions ?? 0} Total Items</span>
                        <span>•</span>
                        <span>Pass: 70%</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => { setSelectedDocId(doc.id); setTab('review'); }}
                        >
                          <ListChecks size={13} /> Review
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => { setSelectedDocId(doc.id); setTab('generate'); }}
                        >
                          <Sparkles size={13} /> Add MCQs
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setPublishModalAssignment({
                            id: doc.id,
                            title: `${doc.title} Assessment`,
                            questionCount: doc._count?.questions ?? 5,
                          } as any);
                        }}
                      >
                        <Send size={13} /> Publish to Learners
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {documents.length === 0 && (
                <EmptyState
                  title="No learning materials uploaded"
                  action={
                    <Button onClick={() => setTab('materials')}>
                      <Upload size={14} /> Upload Learning Material
                    </Button>
                  }
                >
                  Upload statistical handbooks or curriculum guidelines in the Learning Materials tab to create grounded assessments.
                </EmptyState>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 6: RESULTS ── */}
      {currentTab === 'results' && (
        <Card>
          <CardHeader
            title="Learner Assessment Submissions"
            subtitle="Diagnostic and milestone quiz evaluations across registered officials"
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-raised/50">
                  <Th>Learner</Th>
                  <Th>Session ID</Th>
                  <Th>Started At</Th>
                  <Th>Completed At</Th>
                  <Th align="right">Evaluation Score</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {(overview?.recentSessions ?? []).map((s) => (
                  <tr key={s.id} className="border-b border-border hover:bg-surface">
                    <Td>
                      <span className="font-semibold text-ink">{s.officialName || 'Official'}</span>
                    </Td>
                    <Td className="font-mono text-[11px] text-subtle">
                      {s.id ? (s.id.length > 8 ? s.id.slice(0, 8) + '...' : s.id) : '—'}
                    </Td>
                    <Td className="text-muted">
                      {formatDateTime(s.startedAt)}
                    </Td>
                    <Td className="text-muted">
                      {s.submittedAt ? formatDateTime(s.submittedAt) : '—'}
                    </Td>
                    <Td align="right">
                      {s.scorePct !== null && s.scorePct !== undefined ? (
                        <span className="font-bold text-primary tnum">{pct(s.scorePct)}</span>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td align="right">
                      <Badge tone={s.submittedAt ? 'success' : 'neutral'}>
                        {s.submittedAt ? 'Completed' : 'In Progress'}
                      </Badge>
                    </Td>
                  </tr>
                ))}
                {(!overview?.recentSessions || overview.recentSessions.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-muted text-[13px]">
                      No learner assessment records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </TabErrorBoundary>

      {/* Global Publishing Modal */}
      {publishModalAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-[16px] font-bold text-ink">Publish Assignment to Learners</h3>
              <button
                onClick={() => setPublishModalAssignment(null)}
                className="text-subtle hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-[13px]">
              <p className="text-muted">
                Assignment: <strong className="text-ink">{publishModalAssignment.title}</strong>
              </p>
              <p className="text-muted">
                Questions: <strong className="text-ink">{publishModalAssignment.questionCount} items</strong>
              </p>

              <Field label="Assignee Target" htmlFor="publish-target">
                <Select
                  id="publish-target"
                  value={publishScope}
                  onChange={(e) => setPublishScope(e.target.value as any)}
                >
                  <option value="all">All Registered Learners (Full Cohort)</option>
                </Select>
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setPublishModalAssignment(null)}>
                Cancel
              </Button>
              <Button
                loading={publishing}
                onClick={async () => {
                  setPublishing(true);
                  try {
                    const res = await post<{ assignedCount: number }>(
                      `/assignments/${publishModalAssignment.id}/publish`,
                      { assignTo: publishScope }
                    );
                    setPublishSuccessMsg(
                      `Assignment successfully published to ${res.assignedCount} learners! They can now access and attempt it.`
                    );
                    setPublishModalAssignment(null);
                    setAssignCreatedSummary(null);
                    setShowCreateAssignment(false);
                    await loadData();
                  } catch (err: any) {
                    setError(err?.message || 'Publish failed');
                  } finally {
                    setPublishing(false);
                  }
                }}
              >
                <Send size={14} className="mr-1.5" /> Confirm &amp; Publish
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Global Feedback Modal */}
      {feedbackModalAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-[16px] font-bold text-ink">Review &amp; Provide Feedback</h3>
              <button
                onClick={() => setFeedbackModalAssignment(null)}
                className="text-subtle hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-[13px]">
              <p className="text-muted">
                Learner:{' '}
                <strong className="text-ink">
                  {feedbackModalAssignment.assignedTo?.nameEn} (
                  {feedbackModalAssignment.assignedTo?.designation})
                </strong>
              </p>
              <p className="text-muted">
                Evaluation Score:{' '}
                <strong className="text-success text-[15px]">
                  {feedbackModalAssignment.scorePct !== null ? `${feedbackModalAssignment.scorePct}%` : '—'}
                </strong>
              </p>
              <Field label="Personalized Trainer Feedback" htmlFor="tr-feedback-text">
                <textarea
                  id="tr-feedback-text"
                  rows={4}
                  value={trainerFeedbackText}
                  onChange={(e) => setTrainerFeedbackText(e.target.value)}
                  placeholder="e.g. Good performance on stratified sampling concepts. Recommend practicing survey weights in Python."
                  className="w-full rounded-md border border-border p-2.5 text-[13px] text-ink"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setFeedbackModalAssignment(null)}>
                Cancel
              </Button>
              <Button
                loading={submittingFeedback}
                onClick={async () => {
                  if (!trainerFeedbackText.trim()) return;
                  setSubmittingFeedback(true);
                  try {
                    await post(`/assignments/${feedbackModalAssignment.id}/feedback`, {
                      feedback: trainerFeedbackText.trim(),
                    });
                    setFeedbackModalAssignment(null);
                    setTrainerFeedbackText('');
                    await loadData();
                  } catch (err: any) {
                    setError(err?.message || 'Could not save feedback');
                  } finally {
                    setSubmittingFeedback(false);
                  }
                }}
              >
                Save Feedback
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function Trainer() {
  return (
    <TrainerErrorBoundary>
      <TrainerInner />
    </TrainerErrorBoundary>
  );
}
