import { useState, useEffect, type ChangeEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  FileText,
  GraduationCap,
  History,
  ListChecks,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  api,
  getToken,
  post,
  type AssignmentItem,
  type Gap,
  type LearnerAssignmentsResponse,
} from '../lib/api.js';
import { num, pct } from '../lib/format.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  ProgressBar,
  Select,
  Td,
  Th,
} from '../components/ui.js';

interface QuestionFeedback {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  rationale: string;
  distractorReason: string | null;
  citation: { page: number; headingPath: string; quote: string; documentTitle: string };
}

interface ActiveSessionQuestion {
  id: string;
  ordinal: number;
  stem: string;
  options: string[];
  competencyId: string;
  competencyName: string;
  bloom: string;
  difficulty: string;
  sourceQuote?: string;
  page?: number;
  headingPath?: string;
}

interface ActiveQuizState {
  assignmentId: string;
  assignmentTitle: string;
  sessionId: string;
  questions: ActiveSessionQuestion[];
}

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

export function LearnerAssignments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'assignments';
  const [activeTab, setActiveTab] = useState<'assignments' | 'create' | 'personal' | 'assigned' | 'history'>(
    initialTab as any
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LearnerAssignmentsResponse | null>(null);

  // Competency options and courses for creation form
  const [competencies, setCompetencies] = useState<{ id: string; nameEn: string; domain: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string; provider: string }[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);

  // Creation Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [competencyId, setCompetencyId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [customCount, setCustomCount] = useState<string>('');
  const [contentMode, setContentMode] = useState<'text' | 'file'>('text');
  const [contentText, setContentText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoWarning, setVideoWarning] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<any | null>(null);

  // Active Quiz State
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuizState | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [questionFeedback, setQuestionFeedback] = useState<QuestionFeedback | null>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<any | null>(null);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const res = await api<LearnerAssignmentsResponse>('/assignments/my');
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Could not load assignments');
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const [comps, crs, g] = await Promise.all([
        api<{ id: string; nameEn: string; domain: string }[]>('/ontology/competencies').catch(() => []),
        api<{ id: string; name: string; provider: string }[]>('/ontology/courses').catch(() => []),
        api<Gap[]>('/officials/me/gaps').catch(() => []),
      ]);
      setCompetencies(comps);
      setCourses(crs);
      setGaps(g);
      if (g.length > 0 && !competencyId) {
        setCompetencyId(g[0]?.competencyId || '');
      } else if (comps.length > 0 && !competencyId) {
        setCompetencyId(comps[0]?.id || '');
      }
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    loadAssignments();
    loadMetadata();
  }, []);

  const handleTabChange = (tab: 'assignments' | 'create' | 'personal' | 'assigned' | 'history') => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setError(null);
    setQuizResult(null);
    setActiveQuiz(null);
  };

  // Handle file selection and detect video formats
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setSelectedFile(f);
    setVideoWarning(null);

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
        setVideoWarning(
          'Video processing is not configured yet. STATINTEL does not fabricate video transcripts. Please upload PDF, PPTX, DOCX, or TXT documents or paste text directly.'
        );
      } else if (!title) {
        setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
      }
    }
  };

  // Create Assignment Action
  const handleCreateAssignment = async () => {
    if (!title.trim()) {
      setError('Please provide an assignment title.');
      return;
    }
    if (contentMode === 'text' && contentText.trim().length < 40) {
      setError('Please provide at least a few sentences (40+ characters) of learning material.');
      return;
    }
    if (contentMode === 'file' && !selectedFile) {
      setError('Please choose a document file to upload.');
      return;
    }
    if (contentMode === 'file' && videoWarning) {
      setError(videoWarning);
      return;
    }

    setCreating(true);
    setError(null);
    setCreatedSummary(null);

    try {
      const finalCount = customCount ? Math.min(25, Math.max(3, parseInt(customCount, 10))) : questionCount;
      const form = new FormData();
      form.append('title', title.trim());
      if (description) form.append('description', description.trim());
      if (competencyId) form.append('competencyId', competencyId);
      if (courseId) form.append('courseId', courseId);
      form.append('difficulty', difficulty);
      form.append('questionCount', String(finalCount));
      form.append('isPersonal', 'true');

      if (contentMode === 'file' && selectedFile) {
        form.append('file', selectedFile);
      } else {
        form.append('content', contentText.trim());
      }

      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { authorization: `Bearer ${getToken()}` },
        body: form,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create assignment');

      setCreatedSummary(json);
      await loadAssignments();
    } catch (err: any) {
      setError(err?.message || 'Failed to create assignment and generate AI quiz');
    } finally {
      setCreating(false);
    }
  };

  // Start Assignment Quiz
  const handleStartQuiz = async (assignment: AssignmentItem) => {
    setLoading(true);
    setError(null);
    try {
      const res = await post<{
        assignmentId: string;
        sessionId: string;
        title: string;
        questions: ActiveSessionQuestion[];
      }>(`/assignments/${assignment.id}/quiz/start`);

      setActiveQuiz({
        assignmentId: res.assignmentId,
        assignmentTitle: assignment.title,
        sessionId: res.sessionId,
        questions: res.questions,
      });
      setCurrentIdx(0);
      setSelectedOption(null);
      setQuestionFeedback(null);
      setQuizResult(null);
    } catch (err: any) {
      setError(err?.message || 'Could not start quiz session');
    } finally {
      setLoading(false);
    }
  };

  // Submit Answer to current question
  const handleAnswerCurrentQuestion = async () => {
    if (!activeQuiz || selectedOption === null) return;
    setLoading(true);
    try {
      const q = activeQuiz.questions[currentIdx]!;
      const fb = await post<QuestionFeedback>(`/quiz/${activeQuiz.sessionId}/answer`, {
        questionId: q.id,
        selectedIndex: selectedOption,
      });
      setQuestionFeedback(fb);
    } catch (e: any) {
      setError(e?.message || 'Failed to record answer');
    } finally {
      setLoading(false);
    }
  };

  // Proceed to next question or submit quiz
  const handleNextOrSubmit = async () => {
    if (!activeQuiz) return;

    if (currentIdx + 1 < activeQuiz.questions.length) {
      setCurrentIdx(currentIdx + 1);
      setSelectedOption(null);
      setQuestionFeedback(null);
      return;
    }

    // Submit quiz
    setSubmittingQuiz(true);
    setError(null);
    try {
      const result = await post<any>(`/assignments/${activeQuiz.assignmentId}/quiz/submit`, {
        sessionId: activeQuiz.sessionId,
      });
      setQuizResult(result);
      await loadAssignments();
    } catch (e: any) {
      setError(e?.message || 'Could not submit quiz');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW: Quiz Result & Continuous Learning Loop
  // ══════════════════════════════════════════════════════════════════════════
  if (quizResult) {
    const passed = (quizResult.scorePct ?? 0) >= 70;
    return (
      <div className="mx-auto max-w-3xl space-y-5 py-4">
        <Card className="border border-border">
          <CardHeader
            title="Assignment Evaluation Complete"
            subtitle="Verified evidence appended to your immutable ledger. Scores and skill gaps recalculated."
          />
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Evaluation Score</p>
                <p className="tnum text-[46px] font-bold leading-none text-ink mt-1">
                  {num(quizResult.scorePct, 0)}%
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  Completed on {formatDateTime(new Date().toISOString())}
                </p>
              </div>
              <div className="sm:text-right">
                <Badge tone={passed ? 'success' : 'moderate'}>
                  {passed ? 'Competency Target Met' : 'Further Practice Recommended'}
                </Badge>
                <p className="mt-2 text-[12px] text-subtle font-mono">
                  Session ID: {quizResult.sessionId?.slice(0, 14)}…
                </p>
              </div>
            </div>

            <div>
              <ProgressBar value={quizResult.scorePct ?? 0} label="Assessment score" />
            </div>

            {/* Competency ledger evidence */}
            <div className="space-y-3">
              <h3 className="text-[14px] font-bold text-ink">Competency Evidence Ledger Impact:</h3>
              {(quizResult.perCompetency ?? []).map((c: any) => (
                <div key={c.competencyId} className="rounded-lg border border-border bg-surface p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/competency/${c.competencyId}`}
                      className="text-[14px] font-bold text-primary hover:underline"
                    >
                      {c.nameEn}
                    </Link>
                    <span className="tnum text-[13px] font-bold text-ink">
                      {c.correct} / {c.total} items correct ({pct(c.quality * 100)})
                    </span>
                  </div>
                  <p className="text-[12px] text-muted leading-relaxed">
                    Appended as <strong className="text-ink">ASSESSMENT</strong> evidence, quality{' '}
                    <strong className="text-ink">{num(c.quality, 2)}</strong> — Immutable Ledger ID:{' '}
                    <code className="font-mono text-subtle bg-raised px-1 py-0.5 rounded">
                      {c.evidenceId?.slice(0, 16)}…
                    </code>
                  </p>
                </div>
              ))}
            </div>

            <Alert tone="info" title="Continuous Learning Loop Activated">
              Your new assessment evidence immediately updates your competency profile. Any skill gap associated with
              this competency has been refreshed without manual administrative intervention.
            </Alert>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
              <Button
                onClick={() => {
                  setQuizResult(null);
                  setActiveQuiz(null);
                  handleTabChange('assignments');
                }}
              >
                Back to Assignments
              </Button>
              <Link to="/gaps">
                <Button variant="secondary">View Updated Skill Gaps</Button>
              </Link>
              <Link to="/graph">
                <Button variant="secondary">Skill Dependency Graph</Button>
              </Link>
              <Link to="/">
                <Button variant="secondary">Dashboard</Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW: Interactive Quiz Session Player
  // ══════════════════════════════════════════════════════════════════════════
  if (activeQuiz) {
    const q = activeQuiz.questions[currentIdx]!;
    const isLast = currentIdx === activeQuiz.questions.length - 1;
    const progress = Math.round(((currentIdx + (questionFeedback ? 1 : 0)) / activeQuiz.questions.length) * 100);

    return (
      <div className="mx-auto max-w-3xl space-y-4 py-4">
        {/* Quiz Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Interactive AI Quiz</span>
            <h1 className="text-[18px] font-bold text-ink">{activeQuiz.assignmentTitle}</h1>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (confirm('Are you sure you want to exit the quiz?')) {
                setActiveQuiz(null);
              }
            }}
          >
            Exit Quiz
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[12px] text-muted">
            <span>
              Question <strong className="text-ink">{currentIdx + 1}</strong> of {activeQuiz.questions.length}
            </span>
            <span>{progress}% Completed</span>
          </div>
          <ProgressBar value={progress} label="Quiz progress" />
        </div>

        {/* Question Card */}
        <Card className="p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{q.competencyName}</Badge>
            <Badge tone="neutral">{q.bloom}</Badge>
            <Badge tone="neutral">Difficulty: {q.difficulty}</Badge>
          </div>

          <h2 className="text-[16px] font-bold text-ink leading-relaxed">{q.stem}</h2>

          {/* Options */}
          <div className="space-y-2.5">
            {q.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              let optionStyle = 'border-border bg-surface text-ink hover:border-primary/50 hover:bg-raised';

              if (questionFeedback) {
                if (i === questionFeedback.correctIndex) {
                  optionStyle = 'border-success bg-success/10 text-ink font-semibold ring-1 ring-success';
                } else if (isSelected && !questionFeedback.correct) {
                  optionStyle = 'border-critical bg-critical/10 text-ink line-through';
                } else {
                  optionStyle = 'border-border/60 bg-surface/50 text-subtle opacity-70';
                }
              } else if (isSelected) {
                optionStyle = 'border-primary bg-primary-soft text-primary font-semibold ring-1 ring-primary';
              }

              return (
                <button
                  key={i}
                  disabled={questionFeedback !== null || loading}
                  onClick={() => setSelectedOption(i)}
                  className={`w-full text-left rounded-lg border p-3.5 text-[14px] transition-all flex items-start gap-3 cursor-pointer disabled:cursor-default ${optionStyle}`}
                >
                  <span className="font-mono font-bold text-subtle shrink-0">{String.fromCharCode(65 + i)}.</span>
                  <span className="flex-1">{opt}</span>
                  {questionFeedback && i === questionFeedback.correctIndex && (
                    <CheckCircle2 size={18} className="text-success shrink-0" />
                  )}
                  {questionFeedback && isSelected && !questionFeedback.correct && (
                    <XCircle size={18} className="text-critical shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback & Source Citation after answering */}
          {questionFeedback && (
            <div
              className={`rounded-lg border p-4 space-y-3 ${
                questionFeedback.correct ? 'border-success/30 bg-success/5' : 'border-critical/30 bg-critical/5'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-[14px]">
                {questionFeedback.correct ? (
                  <>
                    <CheckCircle2 size={16} className="text-success" />
                    <span className="text-success">Correct Answer!</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} className="text-critical" />
                    <span className="text-critical">Incorrect Option Selected</span>
                  </>
                )}
              </div>

              <p className="text-[13px] text-ink leading-relaxed">
                <strong>Explanation:</strong> {questionFeedback.rationale}
              </p>

              {questionFeedback.distractorReason && (
                <p className="text-[12px] text-muted">
                  <strong>Why your choice was incorrect:</strong> {questionFeedback.distractorReason}
                </p>
              )}

              {/* Source Citation */}
              <div className="rounded border border-border bg-surface p-3 text-[12px] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-subtle">
                  <FileText size={13} />
                  <span>
                    Official Grounding: {questionFeedback.citation.documentTitle} · Page{' '}
                    {questionFeedback.citation.page}
                  </span>
                </div>
                <blockquote className="border-l-2 border-primary pl-2.5 italic text-muted text-[12px] leading-relaxed">
                  "{questionFeedback.citation.quote}"
                </blockquote>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-[12px] text-subtle">
              {selectedOption === null && !questionFeedback && 'Select an option to check answer'}
            </span>

            <div className="flex gap-2">
              {!questionFeedback ? (
                <Button onClick={handleAnswerCurrentQuestion} disabled={selectedOption === null || loading}>
                  Confirm Answer
                </Button>
              ) : (
                <Button onClick={handleNextOrSubmit} loading={submittingQuiz}>
                  {isLast ? (
                    <>
                      <FileCheck size={16} className="mr-1.5" /> Submit &amp; Record Results
                    </>
                  ) : (
                    <>
                      Next Question <ArrowRight size={15} className="ml-1.5" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW: Main Learner Assignments Hub
  // ══════════════════════════════════════════════════════════════════════════
  const totalCount = data?.all.length || 0;
  const personalCount = data?.personal.length || 0;
  const assignedCount = data?.assigned.length || 0;
  const completedCount = data?.completed.length || 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Header */}
      <header className="border-b border-border pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-ink">Assignments &amp; Hands-on Practice</h1>
              <Badge tone="primary" icon={<Sparkles size={13} />}>
                AI-Grounded Learning Tasks
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted max-w-3xl">
              Turn your notes, curriculum guidelines, or uploaded training material into personalized diagnostic quizzes.
              Every question is grounded strictly in source content, and submitted results update your verified competency
              evidence ledger.
            </p>
          </div>

          <Button onClick={() => handleTabChange('create')}>
            <Plus size={15} className="mr-1.5" /> Create Personal Assignment
          </Button>
        </div>

        {/* Navigation Tabs */}
        <nav className="mt-5 flex gap-2 border-b border-border pt-1 overflow-x-auto">
          <button
            onClick={() => handleTabChange('assignments')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'assignments'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <ListChecks size={15} /> All Assignments ({totalCount})
          </button>
          <button
            onClick={() => handleTabChange('create')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'create'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Plus size={15} /> Create Learning Assignment
          </button>
          <button
            onClick={() => handleTabChange('personal')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'personal'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Sparkles size={15} /> My Generated Quizzes ({personalCount})
          </button>
          <button
            onClick={() => handleTabChange('assigned')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'assigned'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <GraduationCap size={15} /> Assigned Trainer Quizzes ({assignedCount})
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'history'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <History size={15} /> Quiz History &amp; Evidence ({completedCount})
          </button>
        </nav>
      </header>

      {error && (
        <Alert tone="critical" title="Notice">
          {error}
        </Alert>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: ALL ASSIGNMENTS OVERVIEW
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Total Tasks</p>
              <p className="tnum mt-1 text-[28px] font-bold text-ink">{totalCount}</p>
              <p className="text-[12px] text-muted">learning assignments</p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Personal Practice</p>
              <p className="tnum mt-1 text-[28px] font-bold text-primary">{personalCount}</p>
              <p className="text-[12px] text-muted">self-directed quizzes</p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Trainer Assigned</p>
              <p className="tnum mt-1 text-[28px] font-bold text-ink">{assignedCount}</p>
              <p className="text-[12px] text-muted">curriculum evaluations</p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Completed</p>
              <p className="tnum mt-1 text-[28px] font-bold text-success">{completedCount}</p>
              <p className="text-[12px] text-muted">evidence recorded</p>
            </Card>
          </div>

          {/* Assignments List */}
          <Card>
            <CardHeader
              title="Available Learning Assignments"
              subtitle="Select any personal practice quiz or trainer-assigned task to attempt"
            />
            <div className="divide-y divide-border">
              {(data?.all ?? []).map((assignment) => {
                const isCompleted = assignment.status === 'COMPLETED';
                return (
                  <div
                    key={assignment.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-surface transition-colors"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={assignment.isPersonal ? 'primary' : 'neutral'}>
                          {assignment.isPersonal ? 'Personal Practice' : 'Trainer Assigned'}
                        </Badge>
                        {assignment.competency && (
                          <Badge tone="neutral">{assignment.competency.nameEn}</Badge>
                        )}
                        <Badge tone="neutral">Difficulty: {assignment.difficulty}</Badge>
                        <Badge tone={isCompleted ? 'success' : 'moderate'}>
                          {assignment.status === 'COMPLETED'
                            ? 'Completed'
                            : assignment.status === 'IN_PROGRESS'
                            ? 'In Progress'
                            : 'Not Started'}
                        </Badge>
                      </div>

                      <h3 className="text-[16px] font-bold text-ink leading-snug">{assignment.title}</h3>

                      {assignment.description && (
                        <p className="text-[13px] text-muted line-clamp-2">{assignment.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[12px] text-subtle pt-1 font-mono">
                        <span>{assignment.questionCount} Questions</span>
                        <span>•</span>
                        <span>
                          {assignment.document?.title || 'Direct Learning Material'}
                        </span>
                        {!assignment.isPersonal && assignment.creator && (
                          <>
                            <span>•</span>
                            <span>Assigned by {assignment.creator.nameEn}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                      {isCompleted && assignment.scorePct !== null && (
                        <div className="text-right">
                          <span className="text-[11px] font-semibold text-subtle uppercase">Score</span>
                          <p className="tnum text-[20px] font-bold text-success leading-tight">
                            {num(assignment.scorePct, 0)}%
                          </p>
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant={isCompleted ? 'secondary' : 'primary'}
                        onClick={() => handleStartQuiz(assignment)}
                      >
                        {isCompleted ? (
                          <>
                            <RefreshCw size={13} className="mr-1.5" /> Retake Quiz
                          </>
                        ) : (
                          <>
                            <ClipboardCheck size={14} className="mr-1.5" /> Start Quiz
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {(!data?.all || data.all.length === 0) && !loading && (
                <EmptyState
                  title="No assignments found"
                  action={
                    <Button onClick={() => handleTabChange('create')}>
                      <Plus size={14} /> Create Your First Assignment
                    </Button>
                  }
                >
                  Create a self-directed practice task from your notes or wait for your trainer to assign one.
                </EmptyState>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: CREATE PERSONAL LEARNING ASSIGNMENT (Section B)
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Create Learning Assignment &amp; AI Quiz"
              subtitle="Paste your study notes or upload official literature. STATINTEL will synthesize an assessment grounded 100% in your text."
            />
            <div className="p-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Assignment Title *"
                  htmlFor="assignment-title"
                  hint="e.g. Python Data Cleaning Practice, Survey Stratification Notes"
                >
                  <Input
                    id="assignment-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter descriptive title"
                  />
                </Field>

                <Field
                  label="Target Competency / Skill *"
                  htmlFor="competency-select"
                  hint="Links assessment results to your skill graph"
                >
                  <Select
                    id="competency-select"
                    value={competencyId}
                    onChange={(e) => setCompetencyId(e.target.value)}
                  >
                    {gaps.length > 0 && (
                      <optgroup label="Your Active Skill Gaps (High Priority)">
                        {gaps.map((g) => (
                          <option key={g.competencyId} value={g.competencyId}>
                            {g.nameEn} (Gap: {num(g.severity, 1)})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="All Statistical &amp; Technical Competencies">
                      {competencies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameEn} ({c.domain})
                        </option>
                      ))}
                    </optgroup>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Related Course (Optional)" htmlFor="course-select">
                  <Select id="course-select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                    <option value="">None / Self-study</option>
                    {courses.map((crs) => (
                      <option key={crs.id} value={crs.id}>
                        {crs.name} ({crs.provider})
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Difficulty Level" htmlFor="difficulty-select">
                  <Select
                    id="difficulty-select"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                  >
                    <option value="EASY">Easy (Foundational)</option>
                    <option value="MEDIUM">Medium (Intermediate Practice)</option>
                    <option value="HARD">Hard (Advanced / Evaluative)</option>
                  </Select>
                </Field>

                <Field
                  label="Number of Questions *"
                  htmlFor="question-count-select"
                  hint="Validated backend range: 3 to 25 items"
                >
                  <Select
                    id="question-count-select"
                    value={customCount ? 'custom' : questionCount}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setCustomCount('10');
                      } else {
                        setCustomCount('');
                        setQuestionCount(Number(e.target.value));
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
                  {customCount && (
                    <Input
                      type="number"
                      min={3}
                      max={25}
                      className="mt-2"
                      value={customCount}
                      onChange={(e) => setCustomCount(e.target.value)}
                      placeholder="Count (3–25)"
                    />
                  )}
                </Field>
              </div>

              <Field
                label="Learning Objective / Description (Optional)"
                htmlFor="assignment-desc"
                hint="What do you aim to master through this exercise?"
              >
                <Input
                  id="assignment-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Master handling missing data and stratified survey weights in Python"
                />
              </Field>

              {/* Source Content Input Switch */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-ink">Learning Material Source *</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setContentMode('text')}
                      className={`px-3 py-1.5 text-[12px] font-semibold rounded transition-colors cursor-pointer ${
                        contentMode === 'text'
                          ? 'bg-primary text-white'
                          : 'bg-surface border border-border text-muted hover:text-ink'
                      }`}
                    >
                      <FileText size={13} className="inline mr-1" /> Type / Paste Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentMode('file')}
                      className={`px-3 py-1.5 text-[12px] font-semibold rounded transition-colors cursor-pointer ${
                        contentMode === 'file'
                          ? 'bg-primary text-white'
                          : 'bg-surface border border-border text-muted hover:text-ink'
                      }`}
                    >
                      <Upload size={13} className="inline mr-1" /> Upload Document
                    </button>
                  </div>
                </div>

                {contentMode === 'text' ? (
                  <div>
                    <textarea
                      rows={7}
                      value={contentText}
                      onChange={(e) => setContentText(e.target.value)}
                      placeholder="Type or paste your training notes, handbook excerpts, or survey methodology documentation here (minimum 40 characters)..."
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-[13px] font-sans leading-relaxed text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex items-center justify-between text-[11px] text-subtle mt-1">
                      <span>Grounded synthesis requires sufficient context</span>
                      <span>{contentText.length} characters</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border-2 border-dashed border-border bg-surface p-6 text-center">
                      <Upload size={24} className="mx-auto text-subtle mb-2" />
                      <p className="text-[13px] font-medium text-ink">Choose a statistical document file</p>
                      <p className="text-[12px] text-muted mt-1">Supported formats: PDF, PPTX, DOCX, TXT</p>
                      <input
                        type="file"
                        accept=".pdf,.pptx,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,video/*"
                        onChange={handleFileChange}
                        className="mt-3 block w-full text-[12px] text-muted file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[12px] file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover cursor-pointer"
                      />
                    </div>

                    {videoWarning && (
                      <Alert tone="critical" title="Video Format Detected">
                        {videoWarning}
                      </Alert>
                    )}
                  </div>
                )}
              </div>

              {/* Action Trigger */}
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-[12px] text-muted">
                  Questions are generated deterministically and pass 8 pedagogical quality gates.
                </p>
                <Button onClick={handleCreateAssignment} loading={creating}>
                  <Sparkles size={15} className="mr-1.5" /> Generate AI Quiz &amp; Save Task
                </Button>
              </div>
            </div>
          </Card>

          {/* Generated Preview */}
          {createdSummary && (
            <Card className="border border-success/40 bg-success/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-success" />
                  <h3 className="text-[16px] font-bold text-ink">
                    AI Quiz Generated Successfully ({createdSummary.questions?.length} Questions)
                  </h3>
                </div>
                <Button size="sm" onClick={() => handleStartQuiz(createdSummary.assignment)}>
                  <ClipboardCheck size={14} className="mr-1.5" /> Start Quiz Now →
                </Button>
              </div>
              <p className="text-[13px] text-muted">
                Your private assignment <strong>"{createdSummary.assignment.title}"</strong> is ready. Only you can attempt
                this quiz.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: MY GENERATED QUIZZES (Personal Practice)
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'personal' && (
        <Card>
          <CardHeader
            title="My Generated Quizzes (Private Practice)"
            subtitle="Self-directed assignments created from your personal study notes and materials"
          />
          <div className="divide-y divide-border">
            {(data?.personal ?? []).map((assignment) => (
              <div
                key={assignment.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-surface transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone="primary">Personal Practice</Badge>
                    {assignment.competency && (
                      <Badge tone="neutral">{assignment.competency.nameEn}</Badge>
                    )}
                    <Badge tone={assignment.status === 'COMPLETED' ? 'success' : 'neutral'}>
                      {assignment.status}
                    </Badge>
                  </div>
                  <h4 className="mt-1 text-[15px] font-bold text-ink">{assignment.title}</h4>
                  <p className="text-[12px] text-muted">
                    {assignment.questionCount} Questions · {new Date(assignment.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {assignment.scorePct !== null && (
                    <span className="tnum text-[16px] font-bold text-success">{num(assignment.scorePct, 0)}%</span>
                  )}
                  <Button size="sm" onClick={() => handleStartQuiz(assignment)}>
                    {assignment.status === 'COMPLETED' ? 'Retake' : 'Start Quiz'}
                  </Button>
                </div>
              </div>
            ))}

            {(!data?.personal || data.personal.length === 0) && (
              <EmptyState
                title="No personal quizzes created yet"
                action={
                  <Button onClick={() => handleTabChange('create')}>
                    <Plus size={14} /> Create Learning Assignment
                  </Button>
                }
              >
                Create your first personal practice quiz by uploading materials or pasting text.
              </EmptyState>
            )}
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: ASSIGNED TRAINER QUIZZES
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'assigned' && (
        <Card>
          <CardHeader
            title="Assigned Trainer Quizzes"
            subtitle="Curriculum evaluations assigned to you by faculty or department trainers"
          />
          <div className="divide-y divide-border">
            {(data?.assigned ?? []).map((assignment) => (
              <div
                key={assignment.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-surface transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">Trainer Assigned</Badge>
                    {assignment.competency && (
                      <Badge tone="neutral">{assignment.competency.nameEn}</Badge>
                    )}
                    <Badge tone={assignment.status === 'COMPLETED' ? 'success' : 'moderate'}>
                      {assignment.status}
                    </Badge>
                  </div>
                  <h4 className="mt-1 text-[15px] font-bold text-ink">{assignment.title}</h4>
                  <p className="text-[12px] text-muted">
                    Assigned by {assignment.creator?.nameEn || 'Faculty Trainer'} · {assignment.questionCount} Questions
                  </p>
                  {assignment.feedback && (
                    <p className="mt-1.5 text-[12px] text-primary bg-primary-soft p-2 rounded border border-primary/20">
                      <strong>Trainer Feedback:</strong> {assignment.feedback}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {assignment.scorePct !== null && (
                    <span className="tnum text-[16px] font-bold text-success">{num(assignment.scorePct, 0)}%</span>
                  )}
                  <Button size="sm" onClick={() => handleStartQuiz(assignment)}>
                    {assignment.status === 'COMPLETED' ? 'Retake' : 'Start Quiz'}
                  </Button>
                </div>
              </div>
            ))}

            {(!data?.assigned || data.assigned.length === 0) && (
              <EmptyState title="No trainer assignments pending">
                You have no pending assignments assigned by faculty trainers at this time.
              </EmptyState>
            )}
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5: QUIZ HISTORY & RESULTS
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader
            title="Quiz History &amp; Verified Evidence"
            subtitle="Completed learning assignments contributing to your immutable evidence ledger"
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-raised/50">
                  <Th>Assignment Title</Th>
                  <Th>Type</Th>
                  <Th>Competency</Th>
                  <Th>Completed At</Th>
                  <Th align="right">Evaluation Score</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {(data?.completed ?? []).map((a) => (
                  <tr key={a.id} className="border-b border-border hover:bg-surface">
                    <Td>
                      <span className="font-semibold text-ink">{a.title}</span>
                    </Td>
                    <Td>
                      <Badge tone={a.isPersonal ? 'primary' : 'neutral'}>
                        {a.isPersonal ? 'Personal' : 'Trainer'}
                      </Badge>
                    </Td>
                    <Td>{a.competency?.nameEn || 'General'}</Td>
                    <Td className="text-muted">
                      {formatDateTime(a.submittedAt)}
                    </Td>
                    <Td align="right">
                      <span className="font-bold text-success tnum">{num(a.scorePct ?? 0, 0)}%</span>
                    </Td>
                    <Td align="right">
                      <Button size="sm" variant="secondary" onClick={() => handleStartQuiz(a)}>
                        Retake
                      </Button>
                    </Td>
                  </tr>
                ))}
                {(!data?.completed || data.completed.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-muted text-[13px]">
                      No completed quiz history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
