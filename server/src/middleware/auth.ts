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

/** Role gate. Order matters only for readability — membership is a set test. */
export function requireRole(...roles: SystemRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({
        error: 'Not permitted for your role',
        detail: `Requires one of: ${roles.join(', ')}. You are ${req.session.role}.`,
      });
    }
    next();
  };
}

/**
 * Can the caller see this official's competency data?
 *   own data                      → always
 *   MANAGER                       → direct reports
 *   DEPT_ADMIN                    → own department
 *   SUPER_ADMIN / AUDITOR         → everyone
 * This is the second of the two layers; the first is the route-level role gate.
 */
export async function canViewOfficial(session: Session, officialId: string): Promise<boolean> {
  if (session.sub === officialId) return true;
  if (session.role === 'SUPER_ADMIN' || session.role === 'AUDITOR') return true;
  const target = await prisma.official.findUnique({
    where: { id: officialId },
    select: { departmentId: true, managerId: true },
  });
  if (!target) return false;
  if (session.role === 'DEPT_ADMIN') return target.departmentId === session.departmentId;
  if (session.role === 'MANAGER') return target.managerId === session.sub;
  return false;
}

export function audit(actorId: string | null, action: string, subjectType: string, subjectId: string, meta: object = {}) {
  // fire-and-forget: an audit write must never fail a user-facing request,
  // but it must also never be silently skipped — failures are logged loudly.
  void prisma.auditEvent
    .create({ data: { actorId, action, subjectType, subjectId, meta: meta as object } })
    .catch((e) => console.error('[audit] write failed', { action, subjectType, subjectId }, e));
}
