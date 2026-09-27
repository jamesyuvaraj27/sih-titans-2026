/** Indian digit grouping everywhere — 1,23,456 not 123,456. */
export const nf = new Intl.NumberFormat('en-IN');
export const num = (n: number, digits = 0) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

export const pct = (x: number, digits = 0) => `${num(x, digits)}%`;

export const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtDate = (iso: string | Date) => dateFmt.format(typeof iso === 'string' ? new Date(iso) : iso);

export function monthsAgo(iso: string): string {
  const months = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (months < 1) return 'this month';
  if (months < 12) return `${Math.round(months)} months ago`;
  const y = months / 12;
  return `${y < 1.5 ? '1 year' : `${Math.round(y)} years`} ago`;
}

export const LEVEL_NAME = ['Not evidenced', 'Awareness', 'Guided', 'Independent', 'Expert'] as const;
export const levelLabel = (l: number) => (l === 0 ? 'Not evidenced' : `L${l} ${LEVEL_NAME[l]}`);

export const DOMAIN_NAME: Record<string, string> = {
  STAT: 'Statistical',
  TECH: 'Technical',
  GOVN: 'Digital Governance',
  BEHV: 'Behavioural & Managerial',
};

export const EVIDENCE_LABEL: Record<string, string> = {
  ASSESSMENT: 'Assessment',
  PROJECT_ARTIFACT: 'Project artefact',
  COURSE_COMPLETION: 'Course completion',
  ATTESTATION: 'Supervisor attestation',
  PRIOR_TRAINING: 'Prior training',
  SELF_DECLARATION: 'Self-declaration',
};

export const hours = (h: number) => (h >= 1 ? `${num(h)} h` : `${Math.round(h * 60)} min`);
export const mins = (m: number) => (m >= 60 ? `${num(m / 60, m % 60 ? 1 : 0)} h` : `${m} min`);

/**
 * Confidence is deliberately never hidden. A score of 72 at confidence 0.31 is
 * not the same claim as a score of 72 at confidence 0.95, and pretending
 * otherwise is exactly the failure mode this product exists to fix.
 */
export function confidenceLabel(c: number): { text: string; tone: 'high' | 'medium' | 'low' } {
  if (c >= 0.7) return { text: 'High confidence', tone: 'high' };
  if (c >= 0.4) return { text: 'Medium confidence', tone: 'medium' };
  return { text: 'Low confidence — take a diagnostic to confirm', tone: 'low' };
}

export type CanonicalRole = 'LEARNER' | 'TRAINER' | 'ADMINISTRATOR';

export function normalizeRole(role: string | null | undefined): CanonicalRole {
  if (!role) return 'LEARNER';
  const upper = String(role).toUpperCase().trim();
  if (upper === 'LEARNER') return 'LEARNER';
  if (upper === 'TRAINER' || upper === 'MANAGER') return 'TRAINER';
  return 'ADMINISTRATOR'; // DEPT_ADMIN, SUPER_ADMIN, AUDITOR, ADMINISTRATOR
}

export const ROLE_LABELS: Record<string, string> = {
  LEARNER: 'Learner',
  TRAINER: 'Trainer',
  MANAGER: 'Trainer',
  ADMINISTRATOR: 'Administrator',
  DEPT_ADMIN: 'Administrator',
  SUPER_ADMIN: 'Administrator',
  AUDITOR: 'Administrator',
};

export const roleLabel = (role: string | null | undefined): string => {
  const norm = normalizeRole(role);
  if (norm === 'LEARNER') return 'Learner';
  if (norm === 'TRAINER') return 'Trainer';
  return 'Administrator';
};

