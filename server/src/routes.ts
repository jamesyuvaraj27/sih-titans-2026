import { Router } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './lib/db.js';
import { signSession } from './lib/auth.js';
import { attachSession, audit, canViewOfficial, requireAuth, requireRole } from './middleware/auth.js';
import { explainScore, gapsFor, LEVEL_LABEL, pathFor, scoresFor } from './modules/competency/service.js';
import { generateForDocument, ingestDocument } from './modules/mcq/service.js';
import { answer, startSession, submit } from './modules/quiz/service.js';
import { trainingEffectiveness, workforceView } from './modules/admin/service.js';
import { getProvider } from './ai/provider.js';

export const api = Router();
api.use(attachSession);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const wrap = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res)).catch(next);

const asOfParam = (req: any): Date | undefined => {
  const raw = req.query.asOf;
  if (!raw) return undefined;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/** Resolve ":id" — "me" always means the caller, so the UI never needs the id. */
const targetId = (req: any): string => (req.params.id === 'me' ? req.session.sub : req.params.id);

async function assertCanView(req: any, res: any, id: string): Promise<boolean> {
  if (await canViewOfficial(req.session, id)) return true;
  res.status(403).json({ error: 'You are not permitted to view this official’s record' });
  return false;
}

// ═══════════════════════════ auth ═══════════════════════════

api.post('/auth/login', wrap(async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const official = await prisma.official.findUnique({ where: { email: body.email.toLowerCase() } });
  if (!official || !(await bcrypt.compare(body.password, official.passwordHash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  const token = await signSession({
    sub: official.id, role: official.role,
    departmentId: official.departmentId, name: official.nameEn,
  });
  audit(official.id, 'auth.login', 'Official', official.id, {});
  res.json({
    token,
    official: {
      id: official.id, nameEn: official.nameEn, nameHi: official.nameHi,
      email: official.email, role: official.role, designation: official.designation,
      departmentId: official.departmentId, roleProfileId: official.roleProfileId,
      preferredLang: official.preferredLang,
    },
  });
}));

api.get('/auth/me', requireAuth, wrap(async (req, res) => {
  const official = await prisma.official.findUniqueOrThrow({
    where: { id: req.session.sub },
    include: { department: true, roleProfile: true },
  });
  res.json({
    id: official.id, nameEn: official.nameEn, nameHi: official.nameHi, email: official.email,
    role: official.role, designation: official.designation, cadre: official.cadre,
    employeeCode: official.employeeCode, preferredLang: official.preferredLang,
    department: { id: official.department.id, nameEn: official.department.nameEn },
    roleProfile: { id: official.roleProfile.id, titleEn: official.roleProfile.titleEn, cadre: official.roleProfile.cadre },
  });
}));

// ═══════════════════════════ ontology ═══════════════════════════

api.get('/ontology/competencies', requireAuth, wrap(async (_req, res) => {
  res.json(await prisma.competency.findMany({
    select: {
      id: true, domain: true, area: true, nameEn: true, nameHi: true, description: true,
      gsbpmPhases: true, decayHalfLifeMonths: true, estHours: true, levelAnchors: true,
    },
    orderBy: [{ domain: 'asc' }, { area: 'asc' }, { id: 'asc' }],
  }));
}));

api.get('/ontology/graph', requireAuth, wrap(async (_req, res) => {
  const [nodes, edges] = await Promise.all([
    prisma.competency.findMany({ select: { id: true, nameEn: true, domain: true, area: true, estHours: true } }),
    prisma.competencyEdge.findMany({ select: { fromId: true, toId: true, kind: true, weight: true } }),
  ]);
  res.json({ nodes, edges });
}));

api.get('/ontology/levels', requireAuth, (_req, res) => res.json({ labels: LEVEL_LABEL }));

// ═══════════════════════════ competency profile ═══════════════════════════

api.get('/officials/:id/profile', requireAuth, wrap(async (req, res) => {
  const id = targetId(req);
  if (!(await assertCanView(req, res, id))) return;
  const asOf = asOfParam(req);

  const [official, scores, competencies, requirements] = await Promise.all([
    prisma.official.findUniqueOrThrow({
      where: { id },
      include: { department: true, roleProfile: { include: { requirements: true } } },
    }),
    scoresFor(id, asOf),
    prisma.competency.findMany(),
    prisma.roleRequirement.findMany(),
  ]);

  const reqBy = new Map(
    requirements.filter((r) => r.roleProfileId === official.roleProfileId).map((r) => [r.competencyId, r]),
  );
  const compBy = new Map(competencies.map((c) => [c.id, c]));
  const rows = scores.map((s) => {
    const c = compBy.get(s.competencyId)!;
    const r = reqBy.get(s.competencyId);
    return {
      ...s,
      nameEn: c.nameEn, nameHi: c.nameHi, domain: c.domain, area: c.area,
      targetLevel: r?.targetLevel ?? null, criticality: r?.criticality ?? null,
      required: !!r,
    };
  });

  const domains = ['STAT', 'TECH', 'GOVN', 'BEHV'].map((d) => {
    const req = rows.filter((r) => r.domain === d && r.required);
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    return {
      domain: d,
      currentMean: mean(req.map((r) => r.level)),
      targetMean: mean(req.map((r) => r.targetLevel ?? 0)),
      requiredCount: req.length,
      metCount: req.filter((r) => r.level >= (r.targetLevel ?? 0)).length,
    };
  });

  audit(req.session.sub, 'profile.view', 'Official', id, { asOf: asOf?.toISOString() ?? null });

  res.json({
    official: {
      id: official.id, nameEn: official.nameEn, nameHi: official.nameHi,
      designation: official.designation, employeeCode: official.employeeCode,
      department: official.department.nameEn,
      roleProfile: { id: official.roleProfile.id, titleEn: official.roleProfile.titleEn },
    },
    asOf: (asOf ?? new Date()).toISOString(),
    domains,
    competencies: rows,
    evidenceTotal: rows.reduce((a, r) => a + r.evidenceCount, 0),
  });
}));

api.get('/officials/:id/competency/:cid', requireAuth, wrap(async (req, res) => {
  const id = targetId(req);
  if (!(await assertCanView(req, res, id))) return;
  const cid = String(req.params.cid);
  const asOf = asOfParam(req);

  const [competency, scores, ledger, edges, courses, requirement] = await Promise.all([
    prisma.competency.findUniqueOrThrow({ where: { id: cid } }),
    scoresFor(id, asOf),
    explainScore(id, cid, asOf),
    prisma.competencyEdge.findMany({
      where: { OR: [{ fromId: cid }, { toId: cid }] },
      include: { from: { select: { id: true, nameEn: true } }, to: { select: { id: true, nameEn: true } } },
    }),
    prisma.courseCompetency.findMany({ where: { competencyId: cid }, include: { course: true } }),
    prisma.official.findUniqueOrThrow({ where: { id }, select: { roleProfileId: true } })
      .then((o) => prisma.roleRequirement.findFirst({ where: { roleProfileId: o.roleProfileId, competencyId: cid } })),
  ]);

  const score = scores.find((s) => s.competencyId === cid) ?? { competencyId: cid, score: 0, level: 0, confidence: 0, evidenceCount: 0 };
  const levelOf = new Map(scores.map((s) => [s.competencyId, s.level]));

  audit(req.session.sub, 'competency.view', 'Competency', cid, { officialId: id });

  res.json({
    competency: {
      id: competency.id, nameEn: competency.nameEn, nameHi: competency.nameHi,
      domain: competency.domain, area: competency.area, description: competency.description,
      gsbpmPhases: competency.gsbpmPhases, decayHalfLifeMonths: competency.decayHalfLifeMonths,
      estHours: competency.estHours, levelAnchors: competency.levelAnchors,
    },
    score,
    asOf: (asOf ?? new Date()).toISOString(),
    requirement: requirement && { targetLevel: requirement.targetLevel, criticality: requirement.criticality, rationale: requirement.rationale },
    ledger,
    prerequisites: edges.filter((e) => e.kind === 'REQUIRES' && e.toId === cid)
      .map((e) => ({ id: e.fromId, nameEn: e.from.nameEn, minLevel: e.minFromLevel, currentLevel: levelOf.get(e.fromId) ?? 0 })),
    unlocks: edges.filter((e) => e.kind === 'REQUIRES' && e.fromId === cid)
      .map((e) => ({ id: e.toId, nameEn: e.to.nameEn })),
    adjacent: edges.filter((e) => e.kind === 'ADJACENT')
      .map((e) => {
        const other = e.fromId === cid ? e.to : e.from;
        return { id: other.id, nameEn: other.nameEn, weight: e.weight, currentLevel: levelOf.get(other.id) ?? 0 };
      }),
    courses: courses.map((cc) => ({
      id: cc.course.id, name: cc.course.name, provider: cc.course.provider,
      durationMins: cc.course.durationMins, url: cc.course.url,
      completionRate: cc.course.completionRate, tpacFlagged: cc.course.tpacFlagged,
    })),
  });
}));

api.get('/officials/:id/gaps', requireAuth, wrap(async (req, res) => {
  const id = targetId(req);
  if (!(await assertCanView(req, res, id))) return;
  res.json(await gapsFor(id, asOfParam(req)));
}));

api.get('/officials/:id/path', requireAuth, wrap(async (req, res) => {
  const id = targetId(req);
  if (!(await assertCanView(req, res, id))) return;
  const targets = req.query.targets ? String(req.query.targets).split(',').filter(Boolean) : undefined;
  res.json(await pathFor(id, targets, asOfParam(req)));
}));

// ═══════════════════════════ documents & generation ═══════════════════════════

const TRAINER_ROLES = ['MANAGER', 'DEPT_ADMIN', 'SUPER_ADMIN'] as const;

api.get('/documents', requireAuth, requireRole(...TRAINER_ROLES), wrap(async (_req, res) => {
  res.json(await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { nameEn: true } },
      _count: { select: { chunks: true, questions: true } },
    },
  }));
}));

api.post('/documents', requireAuth, requireRole(...TRAINER_ROLES), upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file was uploaded' });
  const result = await ingestDocument({
    buffer: req.file.buffer,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    title: String(req.body.title || req.file.originalname),
    uploadedById: req.session.sub,
  });
  audit(req.session.sub, 'document.ingest', 'Document', result.documentId, { chunks: result.chunks });
  res.json(result);
}));

api.post('/documents/:id/generate', requireAuth, requireRole(...TRAINER_ROLES), wrap(async (req, res) => {
  const body = z.object({
    target: z.number().int().min(4).max(60).optional(),
    competencyIds: z.array(z.string()).optional(),
    language: z.string().optional(),
    provider: z.enum(['mock', 'gemini', 'ollama']).optional(),
  }).parse(req.body ?? {});
  const summary = await generateForDocument(String(req.params.id), {
    target: body.target, competencyIds: body.competencyIds,
    language: body.language, providerOverride: body.provider,
  });
  audit(req.session.sub, 'document.generate', 'Document', String(req.params.id), summary as any);
  res.json(summary);
}));

api.get('/documents/:id/questions', requireAuth, requireRole(...TRAINER_ROLES), wrap(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const items = await prisma.questionItem.findMany({
    where: { documentId: String(req.params.id), ...(status ? { status: status as any } : {}) },
    include: { competency: { select: { nameEn: true, domain: true } }, chunk: { select: { text: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  });
  res.json(items);
}));

api.post('/questions/:id/review', requireAuth, requireRole(...TRAINER_ROLES), wrap(async (req, res) => {
  const body = z.object({
    action: z.enum(['approve', 'reject']),
    stem: z.string().optional(),
    options: z.array(z.string()).length(4).optional(),
    correctIndex: z.number().int().min(0).max(3).optional(),
    reason: z.string().optional(),
  }).parse(req.body);

  const item = await prisma.questionItem.update({
    where: { id: String(req.params.id) },
    data: {
      status: body.action === 'approve' ? 'APPROVED' : 'REJECTED',
      reviewedById: req.session.sub,
      ...(body.stem ? { stem: body.stem } : {}),
      ...(body.options ? { options: body.options } : {}),
      ...(body.correctIndex !== undefined ? { correctIndex: body.correctIndex } : {}),
      ...(body.action === 'reject' ? { rejectReason: body.reason ?? 'Rejected by trainer' } : {}),
    },
  });
  audit(req.session.sub, `question.${body.action}`, 'QuestionItem', item.id, {});
  res.json(item);
}));

// ═══════════════════════════ quiz ═══════════════════════════

api.post('/quiz/start', requireAuth, wrap(async (req, res) => {
  const body = z.object({
    competencyIds: z.array(z.string()).optional(),
    count: z.number().int().min(3).max(25).optional(),
    title: z.string().optional(),
  }).parse(req.body ?? {});
  res.json(await startSession(req.session.sub, body));
}));

api.post('/quiz/:sessionId/answer', requireAuth, wrap(async (req, res) => {
  const body = z.object({ questionId: z.string(), selectedIndex: z.number().int().min(0).max(3) }).parse(req.body);
  const session = await prisma.quizSession.findUniqueOrThrow({ where: { id: String(req.params.sessionId) } });
  if (session.officialId !== req.session.sub) return res.status(403).json({ error: 'Not your session' });
  res.json(await answer(session.id, body.questionId, body.selectedIndex));
}));

api.post('/quiz/:sessionId/submit', requireAuth, wrap(async (req, res) => {
  const session = await prisma.quizSession.findUniqueOrThrow({ where: { id: String(req.params.sessionId) } });
  if (session.officialId !== req.session.sub) return res.status(403).json({ error: 'Not your session' });
  const result = await submit(session.id);
  audit(req.session.sub, 'quiz.submit', 'QuizSession', session.id, { scorePct: result.scorePct });
  res.json(result);
}));

api.get('/quiz/history', requireAuth, wrap(async (req, res) => {
  res.json(await prisma.quizSession.findMany({
    where: { officialId: req.session.sub },
    orderBy: { startedAt: 'desc' },
    take: 20,
    select: { id: true, title: true, startedAt: true, submittedAt: true, scorePct: true, competencyIds: true },
  }));
}));

// ═══════════════════════════ admin ═══════════════════════════

const ADMIN_ROLES = ['DEPT_ADMIN', 'SUPER_ADMIN', 'AUDITOR'] as const;

api.get('/admin/workforce', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (req, res) => {
  // a DEPT_ADMIN is scoped to their own department; SUPER_ADMIN and AUDITOR are not
  const scope = req.session.role === 'DEPT_ADMIN'
    ? req.session.departmentId
    : (req.query.departmentId ? String(req.query.departmentId) : null);
  audit(req.session.sub, 'workforce.view', 'Department', scope ?? 'ALL', {});
  res.json(await workforceView({ departmentId: scope }));
}));

api.get('/admin/effectiveness', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (_req, res) => {
  res.json(await trainingEffectiveness());
}));

api.get('/admin/calendar', requireAuth, wrap(async (_req, res) => {
  res.json(await prisma.surveyCalendarEntry.findMany({ orderBy: { startsOn: 'asc' } }));
}));

api.get('/admin/departments', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (_req, res) => {
  res.json(await prisma.department.findMany({ orderBy: { nameEn: 'asc' } }));
}));

api.get('/audit', requireAuth, requireRole('SUPER_ADMIN', 'AUDITOR', 'DEPT_ADMIN'), wrap(async (req, res) => {
  res.json(await prisma.auditEvent.findMany({
    where: req.query.subjectId ? { subjectId: String(req.query.subjectId) } : {},
    orderBy: { at: 'desc' },
    take: 200,
  }));
}));

// ═══════════════════════════ meta ═══════════════════════════

api.get('/health', wrap(async (_req, res) => {
  const provider = getProvider();
  const [competencies, evidence] = await Promise.all([prisma.competency.count(), prisma.evidence.count()]);
  res.json({
    ok: true,
    aiProvider: provider.name,
    sovereign: provider.sovereign,
    embeddings: 'local (lexical hashing, 64d) — no text leaves this machine',
    competencies,
    evidence,
  });
}));
