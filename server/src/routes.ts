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
import { handleLearnerChat } from './modules/chat/service.js';
import { getTranslationStatus } from './modules/translation/service.js';
import { explainLabExperiment } from './modules/lab/service.js';
import { getLearnerFutureSkills } from './modules/futureSkills/service.js';
import { getPersonalizedRecommendations } from './modules/recommendations/service.js';
import { getOidcStatus, getOidcAuthorizationUrl, processOidcCallback } from './modules/auth/oidc.js';
import { getTrainerOverview } from './modules/trainer/service.js';
import { getWorkforceCapacityBuilding } from './modules/admin/capacityService.js';
import {
  getWorkforceDataset,
  getOfficialAnalyticsDetail,
  exportWorkforceDatasetCsv,
  getWorkforceAnalytics,
} from './modules/admin/workforceAnalytics.js';
import {
  createAssignment,
  publishTrainerAssignment,
  startAssignmentSession,
  submitAssignmentQuiz,
  listLearnerAssignments,
  listTrainerAssignments,
  reviewAssignmentSubmission,
  getAssignmentDetail,
  getAdminAssignmentAnalytics,
} from './modules/assignment/service.js';
import { normalizeRole } from './middleware/auth.js';

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

api.get('/auth/sso/status', (_req, res) => {
  res.json(getOidcStatus());
});

api.get('/auth/sso/login', (_req, res) => {
  const result = getOidcAuthorizationUrl();
  if (!result.configured) {
    return res.status(501).json({
      error: 'OIDC_NOT_CONFIGURED',
      message: result.message,
      guidance: getOidcStatus().guidance,
    });
  }
  res.redirect(result.url!);
});

api.get('/auth/sso/callback', wrap(async (req, res) => {
  const code = req.query.code;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code from IdP' });
  }
  const result = await processOidcCallback(code);
  res.json(result);
}));

api.post('/auth/register', wrap(async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    currentJobRole: z.string().trim().min(1, 'Current job role is required'),
    desiredJobRole: z.string().trim().min(1, 'Desired next job role is required'),
    skills: z.array(z.string().trim()).min(1, 'Please select or enter at least one skill'),
    academic: z.object({
      highestQualification: z.string().trim().min(1, 'Highest qualification is required'),
      degree: z.string().trim().min(1, 'Degree / course is required'),
      specialization: z.string().trim().optional().default(''),
      institution: z.string().trim().min(1, 'Institution / university is required'),
      graduationYear: z.string().trim().min(1, 'Graduation year is required'),
      academicScore: z.string().trim().optional().default(''),
    }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join('. ');
    return res.status(400).json({ error: errorMsg });
  }

  const { name, email, password, currentJobRole, desiredJobRole, skills, academic } = parsed.data;

  const existing = await prisma.official.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const defaultDept = (await prisma.department.findFirst({
    where: { id: 'DEPT.MOSPI.HQ' },
  })) || (await prisma.department.findFirst());

  const defaultRoleProfile = (await prisma.roleProfile.findFirst({
    where: { id: 'ROLE.JSO' },
  })) || (await prisma.roleProfile.findFirst());

  if (!defaultDept || !defaultRoleProfile) {
    return res.status(500).json({ error: 'Default department or role profile not configured in system' });
  }

  // Security: New registrations are ALWAYS assigned the safe default LEARNER role.
  // Privileged roles (SUPER_ADMIN, DEPT_ADMIN, AUDITOR, MANAGER) cannot be self-assigned.
  const official = await prisma.official.create({
    data: {
      employeeCode: `EMP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      role: 'LEARNER',
      nameEn: name,
      designation: currentJobRole,
      departmentId: defaultDept.id,
      roleProfileId: defaultRoleProfile.id,
      dateOfJoining: new Date(),
      qualifications: {
        skills,
        currentJobRole,
        desiredJobRole,
        academic: {
          highestQualification: academic.highestQualification,
          degree: academic.degree,
          specialization: academic.specialization || '',
          institution: academic.institution,
          graduationYear: academic.graduationYear,
          academicScore: academic.academicScore || '',
        },
      },
    },
  });

  audit(official.id, 'auth.register', 'Official', official.id, {
    currentJobRole,
    desiredJobRole,
    highestQualification: academic.highestQualification,
    skillsCount: skills.length,
  });

  res.status(201).json({
    ok: true,
    message: 'Registration successful. Please log in with your credentials.',
    official: {
      id: official.id,
      nameEn: official.nameEn,
      email: official.email,
      role: official.role,
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
    qualifications: official.qualifications,
    department: { id: official.department.id, nameEn: official.department.nameEn },
    roleProfile: { id: official.roleProfile.id, titleEn: official.roleProfile.titleEn, cadre: official.roleProfile.cadre },
  });
}));

api.post('/auth/language', requireAuth, wrap(async (req, res) => {
  const schema = z.object({ language: z.enum(['en', 'hi', 'te']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Supported languages are en, hi, te' });
  }
  await prisma.official.update({
    where: { id: req.session!.sub },
    data: { preferredLang: parsed.data.language },
  });
  res.json({ ok: true, language: parsed.data.language });
}));

api.get('/translation/status', (_req, res) => {
  res.json(getTranslationStatus());
});

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

api.get('/ontology/courses', requireAuth, wrap(async (_req, res) => {
  res.json(await prisma.course.findMany({
    select: { id: true, name: true, provider: true, level: true, durationMins: true },
    orderBy: [{ provider: 'asc' }, { name: 'asc' }],
  }));
}));

api.get('/officials/:id/skill-graph', requireAuth, wrap(async (req, res) => {
  const id = targetId(req);
  if (!(await assertCanView(req, res, id))) return;
  const domain = req.query.domain ? String(req.query.domain) : undefined;
  const asOf = asOfParam(req);

  const [official, allCompetencies, allEdges, scores, gaps, courseLinks] = await Promise.all([
    prisma.official.findUniqueOrThrow({
      where: { id },
      include: { roleProfile: { include: { requirements: true } } },
    }),
    prisma.competency.findMany(),
    prisma.competencyEdge.findMany({
      where: { kind: 'REQUIRES' },
    }),
    scoresFor(id, asOf),
    gapsFor(id, asOf),
    prisma.courseCompetency.findMany({
      include: { course: true },
    }),
  ]);

  const scoreMap = new Map(scores.map((s) => [s.competencyId, s]));
  const gapMap = new Map(gaps.map((g) => [g.competencyId, g]));
  const reqMap = new Map(official.roleProfile.requirements.map((r) => [r.competencyId, r]));

  const coursesByComp = new Map<string, any[]>();
  for (const cl of courseLinks) {
    if (!coursesByComp.has(cl.competencyId)) coursesByComp.set(cl.competencyId, []);
    coursesByComp.get(cl.competencyId)!.push({
      id: cl.course.id,
      name: cl.course.name,
      provider: cl.course.provider,
      durationMins: cl.course.durationMins,
      url: cl.course.url,
      completionRate: cl.course.completionRate,
      tpacFlagged: cl.course.tpacFlagged,
    });
  }

  const nodes = allCompetencies.map((c) => {
    const s = scoreMap.get(c.id);
    const g = gapMap.get(c.id);
    const req = reqMap.get(c.id);
    const courses = coursesByComp.get(c.id) || [];

    const currentLevel = s?.level ?? 0;
    const currentScore = s?.score ?? 0;
    const confidence = s?.confidence ?? 0;
    const targetLevel = req?.targetLevel ?? null;
    const isTargetMet = targetLevel !== null ? currentLevel >= targetLevel : currentLevel >= 2;
    const status: 'not_started' | 'in_progress' | 'completed' = isTargetMet
      ? 'completed'
      : currentScore > 0 || currentLevel > 0
      ? 'in_progress'
      : 'not_started';

    return {
      id: c.id,
      nameEn: c.nameEn,
      nameHi: c.nameHi,
      domain: c.domain,
      area: c.area,
      description: c.description,
      estHours: c.estHours,
      levelAnchors: c.levelAnchors,
      currentLevel,
      currentScore,
      confidence,
      targetLevel,
      criticality: req?.criticality ?? null,
      gap: g?.gap ?? (req && s ? Math.max(0, req.targetLevel - s.level) : 0),
      severity: g?.severity ?? null,
      severityBand: g?.severityBand ?? null,
      status,
      courses,
    };
  });

  const edges = allEdges.map((e) => ({
    fromId: e.fromId,
    toId: e.toId,
    kind: e.kind,
    weight: e.weight,
    minFromLevel: e.minFromLevel,
  }));

  res.json({
    nodes: domain && domain !== 'ALL' ? nodes.filter((n) => n.domain === domain) : nodes,
    edges,
    domains: ['STAT', 'TECH', 'GOVN', 'BEHV'],
  });
}));


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

api.get('/officials/:id/courses/progress', requireAuth, wrap(async (req, res) => {
  const id = targetId(req);
  if (!(await assertCanView(req, res, id))) return;
  const official = await prisma.official.findUnique({
    where: { id },
    select: { qualifications: true },
  });
  const quals = (official?.qualifications && typeof official.qualifications === 'object' && !Array.isArray(official.qualifications))
    ? (official.qualifications as Record<string, any>)
    : {};
  const progress: Record<string, { status: 'not_started' | 'in_progress' | 'completed'; progressPct: number; updatedAt?: string; completedAt?: string | null }> =
    quals.courseProgress || {};

  res.json(progress);
}));

const CourseProgressUpdateSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed']),
  progressPct: z.number().min(0).max(100).optional(),
});

api.post('/officials/:id/courses/:courseId/progress', requireAuth, wrap(async (req, res) => {
  const id = targetId(req);
  if (!(await assertCanView(req, res, id))) return;
  const { courseId } = req.params;
  const parsed = CourseProgressUpdateSchema.parse(req.body);

  const official = await prisma.official.findUnique({
    where: { id },
    select: { qualifications: true },
  });
  let quals = (official?.qualifications && typeof official.qualifications === 'object' && !Array.isArray(official.qualifications))
    ? (official.qualifications as Record<string, any>)
    : {};
  const existingProgress = quals.courseProgress || {};
  const now = new Date().toISOString();

  const status = parsed.status;
  const progressPct = parsed.progressPct ?? (status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0);

  const updatedItem = {
    status,
    progressPct,
    updatedAt: now,
    completedAt: status === 'completed' ? (existingProgress[courseId]?.completedAt || now) : null,
  };

  const newQuals = {
    ...quals,
    courseProgress: {
      ...existingProgress,
      [courseId]: updatedItem,
    },
  };

  await prisma.official.update({
    where: { id },
    data: { qualifications: newQuals },
  });

  res.json({ success: true, courseId, ...updatedItem });
}));


// ═══════════════════════════ learner learning assistant ═══════════════════════════

const ChatInputSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'model']),
    content: z.string().max(2000),
  })).optional(),
  simulateFallback: z.boolean().optional(),
});

api.post('/learner/chat', requireAuth, requireRole('LEARNER'), wrap(async (req, res) => {
  const parsed = ChatInputSchema.parse(req.body);
  const simulateFallback = parsed.simulateFallback || req.headers['x-simulate-fallback'] === 'true';
  const result = await handleLearnerChat(req.session!.sub, parsed.message, parsed.history, { simulateFallback });
  res.json(result);
}));

const LabExplainSchema = z.object({
  labId: z.string(),
  dataset: z.any().optional(),
  results: z.any().optional(),
  mode: z.enum(['result_explanation', 'hint', 'error_explanation']).optional(),
  questionContext: z.object({
    question: z.string(),
    selectedOption: z.string().optional(),
    correctOption: z.string().optional(),
  }).optional(),
  simulateFallback: z.boolean().optional(),
});

api.post('/learner/lab/explain', requireAuth, requireRole('LEARNER'), wrap(async (req, res) => {
  const parsed = LabExplainSchema.parse(req.body);
  const simulateFallback = parsed.simulateFallback || req.headers['x-simulate-fallback'] === 'true';
  const result = await explainLabExperiment({ ...parsed, simulateFallback });
  res.json(result);
}));

api.get('/learner/future-skills', requireAuth, requireRole('LEARNER'), wrap(async (req, res) => {
  const simulateFallback = req.query.simulate === 'true' || req.headers['x-simulate-fallback'] === 'true';
  const result = await getLearnerFutureSkills(req.session!.sub, { simulateFallback });
  res.json(result);
}));

api.get('/learner/recommendations', requireAuth, requireRole('LEARNER'), wrap(async (req, res) => {
  const simulateFallback = req.query.simulate === 'true' || req.headers['x-simulate-fallback'] === 'true';
  const result = await getPersonalizedRecommendations(req.session!.sub, { simulateFallback });
  res.json(result);
}));

// ═══════════════════════════ trainer & documents ═══════════════════════════

const TRAINER_ROLES = ['TRAINER', 'ADMINISTRATOR'] as const;

api.get('/trainer/overview', requireAuth, requireRole(...TRAINER_ROLES), wrap(async (_req, res) => {
  res.json(await getTrainerOverview());
}));

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

// ═══════════════════════════ assignments & AI quizzes ═══════════════════════════

api.post('/assignments', requireAuth, upload.single('file'), wrap(async (req, res) => {
  const file = req.file
    ? { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype }
    : undefined;

  const result = await createAssignment(req.session.sub, normalizeRole(req.session.role), {
    title: String(req.body.title || ''),
    description: req.body.description ? String(req.body.description) : undefined,
    instructions: req.body.instructions ? String(req.body.instructions) : undefined,
    competencyId: req.body.competencyId ? String(req.body.competencyId) : undefined,
    courseId: req.body.courseId ? String(req.body.courseId) : undefined,
    difficulty: req.body.difficulty ? String(req.body.difficulty) : 'MEDIUM',
    questionCount: req.body.questionCount ? Number(req.body.questionCount) : 5,
    content: req.body.content ? String(req.body.content) : undefined,
    file,
    isPersonal: req.body.isPersonal !== undefined ? String(req.body.isPersonal) === 'true' : undefined,
    provider: req.body.provider ? String(req.body.provider) as any : undefined,
  });

  res.json(result);
}));

api.get('/assignments/my', requireAuth, wrap(async (req, res) => {
  res.json(await listLearnerAssignments(req.session.sub));
}));

api.get('/assignments/trainer', requireAuth, requireRole(...TRAINER_ROLES), wrap(async (req, res) => {
  res.json(await listTrainerAssignments(req.session.sub));
}));

api.post('/assignments/:id/publish', requireAuth, requireRole(...TRAINER_ROLES), wrap(async (req, res) => {
  const body = z.object({
    assignTo: z.union([z.literal('all'), z.array(z.string())]),
    feedback: z.string().optional(),
  }).parse(req.body);
  res.json(await publishTrainerAssignment(req.session.sub, String(req.params.id), body));
}));

api.get('/assignments/:id', requireAuth, wrap(async (req, res) => {
  try {
    const detail = await getAssignmentDetail(req.session.sub, normalizeRole(req.session.role), String(req.params.id));
    res.json(detail);
  } catch (err: any) {
    if (err.message?.includes('Access denied')) {
      return res.status(403).json({ error: err.message });
    }
    throw err;
  }
}));

api.post('/assignments/:id/quiz/start', requireAuth, wrap(async (req, res) => {
  res.json(await startAssignmentSession(req.session.sub, String(req.params.id)));
}));

api.post('/assignments/:id/quiz/submit', requireAuth, wrap(async (req, res) => {
  const body = z.object({ sessionId: z.string() }).parse(req.body);
  res.json(await submitAssignmentQuiz(req.session.sub, String(req.params.id), body.sessionId));
}));

api.post('/assignments/:id/feedback', requireAuth, requireRole(...TRAINER_ROLES), wrap(async (req, res) => {
  const body = z.object({ feedback: z.string() }).parse(req.body);
  res.json(await reviewAssignmentSubmission(req.session.sub, String(req.params.id), body.feedback));
}));

// ═══════════════════════════ admin ═══════════════════════════

const ADMIN_ROLES = ['ADMINISTRATOR'] as const;

api.get('/admin/assignments/analytics', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (_req, res) => {
  res.json(await getAdminAssignmentAnalytics());
}));

api.get('/admin/workforce', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (req, res) => {
  const scope = req.query.departmentId ? String(req.query.departmentId) : null;
  audit(req.session.sub, 'workforce.view', 'Department', scope ?? 'ALL', {});
  res.json(await workforceView({ departmentId: scope }));
}));

api.get('/admin/workforce/dataset', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (req, res) => {
  const dataset = await getWorkforceDataset(req.query);
  audit(req.session.sub, 'workforce.dataset.view', 'WorkforceDataset', 'ALL', {
    page: dataset.page,
    total: dataset.total,
  });
  res.json(dataset);
}));

api.get('/admin/workforce/official/:id', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (req, res) => {
  const officialDetail = await getOfficialAnalyticsDetail(req.params.id);
  audit(req.session.sub, 'workforce.official.inspect', 'Official', req.params.id, {});
  res.json(officialDetail);
}));

api.get('/admin/workforce/export.csv', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (req, res) => {
  const csvContent = await exportWorkforceDatasetCsv(req.query);
  audit(req.session.sub, 'workforce.export.csv', 'WorkforceDataset', 'CSV', {});
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="mospi-workforce-analytics.csv"');
  res.send(csvContent);
}));

api.get('/admin/analytics', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (req, res) => {
  const analytics = await getWorkforceAnalytics({
    departmentId: req.query.departmentId ? String(req.query.departmentId) : undefined,
    designation: req.query.designation ? String(req.query.designation) : undefined,
    domain: req.query.domain ? String(req.query.domain) : undefined,
  });
  audit(req.session.sub, 'workforce.analytics.view', 'WorkforceAnalytics', 'ALL', {});
  res.json(analytics);
}));

api.get('/admin/effectiveness', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (_req, res) => {
  res.json(await trainingEffectiveness());
}));

api.get('/admin/capacity-building', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (req, res) => {
  const simulate = req.query.simulate === 'true' || req.headers['x-simulate-fallback'] === 'true';
  const result = await getWorkforceCapacityBuilding({ simulateFallback: simulate });
  res.json({
    ...result.data,
    aiExecution: {
      provider: result.source === 'gemini' ? 'Gemini 2.5 Flash' : 'STATINTEL Deterministic Engine',
      sovereign: result.source === 'fallback',
      latencyMs: result.executionTimeMs,
      fallbackUsed: result.source === 'fallback',
      reason: result.source === 'fallback' ? 'Local Deterministic Fallback' : undefined,
    },
  });
}));

api.get('/admin/calendar', requireAuth, wrap(async (_req, res) => {
  res.json(await prisma.surveyCalendarEntry.findMany({ orderBy: { startsOn: 'asc' } }));
}));

api.get('/admin/departments', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (_req, res) => {
  res.json(await prisma.department.findMany({ orderBy: { nameEn: 'asc' } }));
}));

api.get('/audit', requireAuth, requireRole(...ADMIN_ROLES), wrap(async (req, res) => {
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
