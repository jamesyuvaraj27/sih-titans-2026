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

export interface GenerationSummary {
  documentId: string; provider: string; sovereign: boolean; promptVersion: string;
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
