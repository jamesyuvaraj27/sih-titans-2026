import type { NextFunction, Request, Response } from 'express';
import { verifySession, type Session, type SystemRole } from '../lib/auth.js';
import { prisma } from '../lib/db.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.session = await verifySession(header.slice(7));
    } catch {
      /* invalid token → treated as anonymous; requireAuth will reject */
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session) return res.status(401).json({ error: 'Authentication required' });
  next();
}

export type CanonicalRole = 'LEARNER' | 'TRAINER' | 'ADMINISTRATOR';

export function normalizeRole(role: string): CanonicalRole {
  const upper = String(role).toUpperCase().trim();
  if (upper === 'LEARNER') return 'LEARNER';
  if (upper === 'TRAINER' || upper === 'MANAGER') return 'TRAINER';
  return 'ADMINISTRATOR'; // DEPT_ADMIN, SUPER_ADMIN, AUDITOR, ADMINISTRATOR
}

export function roleDisplay(role: string): string {
  const norm = normalizeRole(role);
  if (norm === 'LEARNER') return 'Learner';
  if (norm === 'TRAINER') return 'Trainer';
  return 'Administrator';
}

/** Role gate enforcing SIH26101 canonical application roles: LEARNER, TRAINER, ADMINISTRATOR. */
export function requireRole(...roles: (SystemRole | CanonicalRole | string)[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) return res.status(401).json({ error: 'Authentication required' });

    const userCanonical = normalizeRole(req.session.role);
    const allowedCanonicals = new Set(roles.map((r) => normalizeRole(String(r))));
    const exactMatch = roles.includes(req.session.role as any);

    if (!allowedCanonicals.has(userCanonical) && !exactMatch) {
      const friendlyAllowed = Array.from(allowedCanonicals).map(roleDisplay);
      return res.status(403).json({
        error: 'Not permitted for your role',
        detail: `Requires one of: ${friendlyAllowed.join(', ')}. You are ${roleDisplay(req.session.role)}.`,
      });
    }
    next();
  };
}

/**
 * Can the caller see this official's competency data?
 *   own data                      → always
 *   ADMINISTRATOR                 → full workforce visibility
 *   TRAINER                       → direct reports / trainees
 *   LEARNER                       → own data only
 */
export async function canViewOfficial(session: Session, officialId: string): Promise<boolean> {
  if (session.sub === officialId) return true;
  const canonical = normalizeRole(session.role);
  if (canonical === 'ADMINISTRATOR') return true;
  if (canonical === 'TRAINER') {
    const target = await prisma.official.findUnique({
      where: { id: officialId },
      select: { managerId: true },
    });
    return target?.managerId === session.sub;
  }
  return false;
}

export function audit(actorId: string | null, action: string, subjectType: string, subjectId: string, meta: object = {}) {
  // fire-and-forget: an audit write must never fail a user-facing request,
  // but it must also never be silently skipped — failures are logged loudly.
  void prisma.auditEvent
    .create({ data: { actorId, action, subjectType, subjectId, meta: meta as object } })
    .catch((e) => console.error('[audit] write failed', { action, subjectType, subjectId }, e));
}
