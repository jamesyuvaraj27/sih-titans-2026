const TOKEN_KEY = 'samiksha.token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly detail?: unknown) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (opts.body && typeof opts.body === 'string') headers['content-type'] = 'application/json';

  const res = await fetch(`/api${path}`, { ...opts, headers });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { error: text }; }

  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status, body?.detail);
  }
  return body as T;
}

export const post = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

// ── shared types (mirrors the server) ────────────────────────────────────

export interface Me {
  id: string; nameEn: string; nameHi: string | null; email: string;
  role: 'LEARNER' | 'MANAGER' | 'DEPT_ADMIN' | 'SUPER_ADMIN' | 'AUDITOR';
  designation: string; cadre: string | null; employeeCode: string; preferredLang: string;
  department: { id: string; nameEn: string };
  roleProfile: { id: string; titleEn: string; cadre: string };
  qualifications?: any;
}

export interface ScoreRow {
  competencyId: string; score: number; level: number; confidence: number; evidenceCount: number;
  nameEn: string; nameHi: string | null; domain: string; area: string;
  targetLevel: number | null; criticality: number | null; required: boolean;
}

export interface Profile {
  official: { id: string; nameEn: string; nameHi: string | null; designation: string; employeeCode: string; department: string; roleProfile: { id: string; titleEn: string } };
  asOf: string;
  domains: { domain: string; currentMean: number; targetMean: number; requiredCount: number; metCount: number }[];
  competencies: ScoreRow[];
  evidenceTotal: number;
}

export interface LedgerLine {
  evidenceId: string; sourceCompetency: string; kind: string; summary: string;
  occurredAt: string; quality: number; weight: number; relevance: number; decay: number; contribution: number;
}

export interface CompetencyDetail {
  competency: {
    id: string; nameEn: string; nameHi: string | null; domain: string; area: string;
    description: string; gsbpmPhases: string[]; decayHalfLifeMonths: number; estHours: number;
    levelAnchors: Record<string, string>;
  };
  score: { competencyId: string; score: number; level: number; confidence: number; evidenceCount: number };
  asOf: string;
  requirement: { targetLevel: number; criticality: number; rationale: string } | null;
  ledger: LedgerLine[];
  prerequisites: { id: string; nameEn: string; minLevel: number; currentLevel: number }[];
  unlocks: { id: string; nameEn: string }[];
  adjacent: { id: string; nameEn: string; weight: number; currentLevel: number }[];
  courses: { id: string; name: string; provider: string; durationMins: number; url: string | null; completionRate: number; tpacFlagged: boolean }[];
}

export interface Gap {
  competencyId: string; nameEn: string; domain: string; area: string;
  currentLevel: number; currentScore: number; confidence: number;
  targetLevel: number; criticality: number; rationale: string;
  gap: number; urgency: number; urgencyReason: string[];
  severity: number; severityBand: 'CRITICAL' | 'MODERATE' | 'MINOR';
  estHours: number;
}

export interface PathStep {
  order: number; competencyId: string; nameEn: string; domain: string;
  fromLevel: number; toLevel: number; isPrerequisite: boolean;
  unlocks: string[]; why: string; estHours: number;
  courses: { id: string; name: string; provider: string; durationMins: number; url: string | null; primary: boolean; tpacFlagged: boolean }[];
}

export interface CourseProgressRecord {
  status: 'not_started' | 'in_progress' | 'completed';
  progressPct: number;
  updatedAt?: string;
  completedAt?: string | null;
}

export type CourseProgressMap = Record<string, CourseProgressRecord>;

export interface SkillGraphNode {
  id: string;
  nameEn: string;
  nameHi: string | null;
  domain: string;
  area: string;
  description: string;
  estHours: number;
  levelAnchors?: Record<string, string>;
  currentLevel: number;
  currentScore: number;
  confidence: number;
  targetLevel: number | null;
  criticality: number | null;
  gap: number;
  severity: number | null;
  severityBand: 'CRITICAL' | 'MODERATE' | 'MINOR' | null;
  status: 'not_started' | 'in_progress' | 'completed';
  courses: {
    id: string;
    name: string;
    provider: string;
    durationMins: number;
    url: string | null;
    completionRate: number;
    tpacFlagged: boolean;
  }[];
}

export interface SkillGraphEdge {
  fromId: string;
  toId: string;
  kind: string;
  weight: number;
  minFromLevel: number;
}

export interface SkillGraphData {
  nodes: SkillGraphNode[];
  edges: SkillGraphEdge[];
  domains: string[];
}



export interface GenerationSummary {
  documentId: string; provider: string; sovereign: boolean; promptVersion: string;
  generationMode?: 'AI' | 'FALLBACK';
  notice?: string;
  candidates: number; accepted: number; rejected: number;
  rejectionRate: number; rejectionRateHealthy: boolean;
  byReason: { code: string; label: string; count: number }[];
  elapsedMs: number;
}

export interface QuestionItem {
  id: string; stem: string; options: string[]; correctIndex: number;
  rationaleCorrect: string; distractorReasons: string[]; bloom: string;
  sourceQuote: string; page: number; headingPath: string;
  difficulty: string; difficultyScore: number; status: 'CANDIDATE' | 'REJECTED' | 'APPROVED';
  gateResults: { code: string; label: string; passed: boolean; detail: string }[];
  rejectReason: string | null; competencyId: string;
  competency: { nameEn: string; domain: string };
  chunk: { text: string };
}

export interface WorkforceView {
  officials: { id: string; nameEn: string; designation: string; departmentId: string; roleProfileId: string; retiresInYears: number | null }[];
  competencies: { id: string; nameEn: string; domain: string }[];
  cells: { officialId: string; competencyId: string; level: number; score: number }[];
  coverage: { competencyId: string; nameEn: string; domain: string; required: number; atOrAbove: number; coveragePct: number; targetLevel: number; suppressed: boolean }[];
  succession: { competencyId: string; nameEn: string; holders: number; retiringWithin3Years: number }[];
  departmentId: string | null;
  totalOfficials: number;
}

export interface WorkforceRecord {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  designation: string;
  cadre: string | null;
  departmentId: string;
  departmentName: string;
  roleProfileId: string;
  roleTitle: string;
  dateOfJoining: string;
  experienceYears: number;
  dateOfBirth: string | null;
  retiresInYears: number | null;
  readinessScore: number;
  readinessStatus: 'READY' | 'DEVELOPING' | 'CRITICAL';
  requirementsCount: number;
  requirementsMetCount: number;
  gapCount: number;
  topGap: {
    competencyId: string;
    nameEn: string;
    domain: string;
    gap: number;
    severity: number;
  } | null;
  qualifications: any;
}

export interface WorkforceDatasetResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  records: WorkforceRecord[];
  filters: {
    departments: { id: string; name: string }[];
    designations: string[];
    cadres: string[];
  };
}

export interface OfficialAnalyticsDetail {
  official: {
    id: string;
    employeeCode: string;
    name: string;
    email: string;
    designation: string;
    cadre: string | null;
    departmentId: string;
    departmentName: string;
    roleProfileId: string;
    roleTitle: string;
    dateOfJoining: string;
    dateOfBirth: string | null;
    qualifications: any;
    readinessScore: number;
  };
  requirements: {
    competencyId: string;
    nameEn: string;
    domain: string;
    area: string;
    targetLevel: number;
    currentLevel: number;
    currentScore: number;
    criticality: number;
    rationale: string;
    isMet: boolean;
    gap: number;
    severity: number;
    urgency: number;
  }[];
  recentEvidence: {
    id: string;
    kind: string;
    competencyId: string;
    competencyName: string;
    occurredAt: string;
    quality: number;
    summary: string;
  }[];
  recentSessions: {
    id: string;
    title: string;
    startedAt: string;
    submittedAt: string | null;
    scorePct: number | null;
  }[];
}

export interface TrainingDemandItem {
  competencyId: string;
  nameEn: string;
  domain: string;
  area: string;
  totalRequired: number;
  officersAffected: number;
  shareAffected: number;
  meanGap: number;
  meanScore: number;
  isUrgent: boolean;
  coursesCount: number;
  courses: {
    id: string;
    name: string;
    provider: string;
    durationMins: number;
    url: string | null;
  }[];
  affectedDesignations: {
    designation: string;
    count: number;
    meanGap: number;
  }[];
}

export interface ReadinessDesignationItem {
  designation: string;
  officersCount: number;
  meanReadiness: number;
  minReadiness: number;
  maxReadiness: number;
  readinessStatus: 'READY' | 'DEVELOPING' | 'CRITICAL';
  requirementsAssigned: number;
  requirementsMet: number;
  topGap: {
    competencyId: string;
    nameEn: string;
    meanGap: number;
    officersAffected: number;
  } | null;
  officers: {
    id: string;
    name: string;
    email: string;
    readiness: number;
  }[];
}

export interface HeatmapData {
  designations: string[];
  competencies: { id: string; name: string; domain: string }[];
  cells: {
    designation: string;
    competencyId: string;
    competencyName: string;
    domain: string;
    meanGap: number | null;
    meanScore: number | null;
    officers: number;
  }[];
}

export interface WorkforceAnalyticsResponse {
  overview: {
    totalOfficials: number;
    meanReadiness: number;
    totalShortfalls: number;
    criticalShortagesCount: number;
    topPrioritySkill: TrainingDemandItem | null;
    cadreSummary: { cadre: string; count: number; meanReadiness: number }[];
    departmentSummary: { departmentId: string; departmentName: string; count: number; meanReadiness: number }[];
  };
  trainingDemand: TrainingDemandItem[];
  demandedDomains: { domain: string; officersAffected: number; meanGap: number }[];
  readinessByDesignation: ReadinessDesignationItem[];
  heatmap: HeatmapData;
  courseCoverage: {
    totalCompetencies: number;
    coveredCount: number;
    uncoveredCount: number;
    coveragePct: number;
    uncoveredHighDemand: TrainingDemandItem[];
    totalCourses: number;
  };
}

export interface AssignmentItem {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  competencyId: string | null;
  courseId: string | null;
  difficulty: string;
  questionCount: number;
  content: string | null;
  documentId: string | null;
  creatorId: string;
  assignedToId: string | null;
  isPersonal: boolean;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'REVIEWED' | 'COMPLETED' | 'PUBLISHED';
  scorePct: number | null;
  quizSessionId: string | null;
  feedback: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  competency?: { id: string; nameEn: string; area?: string };
  course?: { id: string; name: string; provider?: string };
  document?: { id: string; title: string; filename?: string; pages?: number };
  creator?: { id: string; nameEn: string; designation?: string };
  assignedTo?: { id: string; nameEn: string; designation?: string; cadre?: string | null; department?: { nameEn: string } };
  quizSession?: {
    id: string;
    startedAt: string;
    submittedAt: string | null;
    scorePct: number | null;
    responses: {
      id: string;
      correct: boolean | null;
      selectedIndex: number | null;
      question: {
        id: string;
        stem: string;
        options: string[];
        correctIndex: number;
        rationaleCorrect: string;
        sourceQuote: string;
        page: number;
        headingPath: string;
      };
    }[];
  };
}

export interface LearnerAssignmentsResponse {
  personal: AssignmentItem[];
  assigned: AssignmentItem[];
  completed: AssignmentItem[];
  all: AssignmentItem[];
}

export interface TrainerAssignmentsResponse {
  assignments: AssignmentItem[];
  stats: {
    totalAssigned: number;
    completedCount: number;
    pendingCount: number;
    averageScore: number | null;
  };
}

export interface AdminAssignmentAnalyticsResponse {
  totalAssignments: number;
  completedAssignments: number;
  inProgressAssignments: number;
  notStartedAssignments: number;
  completionRate: number;
  averageScorePct: number;
  byCompetency: {
    competencyId: string;
    nameEn: string;
    domain: string;
    completedCount: number;
    avgScorePct: number;
  }[];
  recentSubmissions: {
    id: string;
    title: string;
    officialName: string;
    designation: string;
    department: string;
    competencyName: string;
    scorePct: number | null;
    submittedAt: string | null;
  }[];
}

