import { prisma } from '../../lib/db.js';

export const LEVEL_LABEL = ['Not evidenced', 'L1 Awareness', 'L2 Guided', 'L3 Independent', 'L4 Expert'] as const;

export interface ScoreRow {
  competencyId: string;
  score: number;
  level: number;
  confidence: number;
  evidenceCount: number;
}

export interface CompetencyMeta {
  id: string; domain: string; area: string; nameEn: string; nameHi: string | null;
  description: string; gsbpmPhases: string[]; decayHalfLifeMonths: number; estHours: number;
  levelAnchors: Record<string, string>;
}

/** The one call the dashboard makes. All 60 competencies, one query, ~3ms. */
export async function scoresFor(officialId: string, asOf?: Date): Promise<ScoreRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    { competency_id: string; score: number; level: number; confidence: number; evidence_count: number }[]
  >(
    `SELECT * FROM compute_scores_for_official($1, COALESCE($2::timestamptz, now()))`,
    officialId,
    asOf ? asOf.toISOString() : null,
  );
  return rows.map((r) => ({
    competencyId: r.competency_id,
    score: Number(r.score),
    level: Number(r.level),
    confidence: Number(r.confidence),
    evidenceCount: Number(r.evidence_count),
  }));
}

export interface LedgerLine {
  evidenceId: string; sourceCompetency: string; kind: string; summary: string;
  occurredAt: string; quality: number; weight: number; relevance: number;
  decay: number; contribution: number;
}

/**
 * The Evidence Ledger drill-down. These rows are the entire justification for
 * a score — the UI renders them verbatim and the arithmetic is reproducible
 * by hand from the columns shown.
 */
export async function explainScore(officialId: string, competencyId: string, asOf?: Date): Promise<LedgerLine[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM explain_competency_score($1, $2, COALESCE($3::timestamptz, now()))`,
    officialId, competencyId, asOf ? asOf.toISOString() : null,
  );
  return rows.map((r) => ({
    evidenceId: r.evidence_id,
    sourceCompetency: r.source_competency,
    kind: r.kind,
    summary: r.summary,
    occurredAt: new Date(r.occurred_at).toISOString(),
    quality: Number(r.quality),
    weight: Number(r.weight),
    relevance: Number(r.relevance),
    decay: Number(r.decay),
    contribution: Number(r.contribution),
  }));
}

// ── gap analysis ─────────────────────────────────────────────────────────

export type Severity = 'CRITICAL' | 'MODERATE' | 'MINOR';

export interface Gap {
  competencyId: string; nameEn: string; domain: string; area: string;
  currentLevel: number; currentScore: number; confidence: number;
  targetLevel: number; criticality: number; rationale: string;
  gap: number; urgency: number; urgencyReason: string[];
  severity: number; severityBand: Severity;
  estHours: number;
}

/**
 * severity = gap × criticality × urgency
 *   urgency = 1.0
 *           + 0.5 if a calendar activity in the next 90 days needs this competency
 *           + 0.3 if the competency is flagged emerging (AI/ML, cloud, big data)
 * Bands: ≥6 CRITICAL, 3–5.99 MODERATE, >0 MINOR.
 *
 * Deliberately arithmetic and not a model: a training officer has to be able to
 * argue with the ranking, and you cannot argue with a black box.
 */
const EMERGING = /^TECH\.(ML|BIGDATA|CLOUD|API)|^GOVN\.(DPI|CLOUD)/;

export async function gapsFor(officialId: string, asOf?: Date): Promise<Gap[]> {
  const official = await prisma.official.findUniqueOrThrow({
    where: { id: officialId },
    select: { roleProfileId: true },
  });
  const [scores, requirements, calendar, competencies] = await Promise.all([
    scoresFor(officialId, asOf),
    prisma.roleRequirement.findMany({ where: { roleProfileId: official.roleProfileId } }),
    prisma.surveyCalendarEntry.findMany({
      where: { startsOn: { lte: new Date(Date.now() + 90 * 86400_000) }, endsOn: { gte: new Date() } },
    }),
    prisma.competency.findMany(),
  ]);

  const scoreBy = new Map(scores.map((s) => [s.competencyId, s]));
  const compBy = new Map(competencies.map((c) => [c.id, c]));
  const urgentBy = new Map<string, string[]>();
  for (const entry of calendar) {
    for (const cid of entry.competencyIds) {
      if (!urgentBy.has(cid)) urgentBy.set(cid, []);
      urgentBy.get(cid)!.push(entry.name);
    }
  }

  const out: Gap[] = [];
  for (const req of requirements) {
    const s = scoreBy.get(req.competencyId);
    const c = compBy.get(req.competencyId);
    if (!s || !c) continue;
    const gap = Math.max(0, req.targetLevel - s.level);
    if (gap === 0) continue;

    const reasons: string[] = [];
    let urgency = 1.0;
    const activities = urgentBy.get(req.competencyId);
    if (activities?.length) {
      urgency += 0.5;
      reasons.push(`Needed within 90 days: ${activities.join('; ')}`);
    }
    if (EMERGING.test(req.competencyId)) {
      urgency += 0.3;
      reasons.push('Flagged as an emerging technology competency');
    }

    const severity = gap * req.criticality * urgency;
    out.push({
      competencyId: req.competencyId,
      nameEn: c.nameEn, domain: c.domain, area: c.area,
      currentLevel: s.level, currentScore: s.score, confidence: s.confidence,
      targetLevel: req.targetLevel, criticality: req.criticality, rationale: req.rationale,
      gap, urgency, urgencyReason: reasons,
      severity,
      severityBand: severity >= 6 ? 'CRITICAL' : severity >= 3 ? 'MODERATE' : 'MINOR',
      estHours: c.estHours,
    });
  }
  return out.sort((a, b) => b.severity - a.severity);
}

// ── learning path ────────────────────────────────────────────────────────

export interface PathStep {
  order: number;
  competencyId: string; nameEn: string; domain: string;
  fromLevel: number; toLevel: number;
  isPrerequisite: boolean;
  unlocks: string[];
  why: string;
  estHours: number;
  courses: { id: string; name: string; provider: string; durationMins: number; url: string | null; primary: boolean; tpacFlagged: boolean }[];
}

/**
 * Not an LLM. A graph algorithm, deliberately — the ordering has to be
 * deterministic and defensible.
 *
 *  1. walk REQUIRES edges backwards from each target, keeping any prerequisite
 *     the official has not yet reached (one recursive CTE, depth-capped)
 *  2. topologically sort the induced subgraph
 *  3. break ties by severity, then by estimated hours, then by how many other
 *     nodes the step unblocks
 *  4. attach up to 3 courses per node, one marked primary
 */
export async function pathFor(officialId: string, targetIds?: string[], asOf?: Date): Promise<PathStep[]> {
  const gaps = await gapsFor(officialId, asOf);
  const targets = targetIds?.length ? gaps.filter((g) => targetIds.includes(g.competencyId)) : gaps;
  if (targets.length === 0) return [];

  const scores = new Map((await scoresFor(officialId, asOf)).map((s) => [s.competencyId, s]));
  const targetSet = new Set(targets.map((t) => t.competencyId));

  // 1. unmet prerequisite closure
  const closure = await prisma.$queryRawUnsafe<{ competency_id: string; depth: number; min_level: number }[]>(
    `WITH RECURSIVE closure AS (
       SELECT e."fromId" AS competency_id, 1 AS depth, e."minFromLevel" AS min_level
       FROM "CompetencyEdge" e
       WHERE e."toId" = ANY($1::text[]) AND e.kind = 'REQUIRES'
       UNION
       SELECT e."fromId", cl.depth + 1, e."minFromLevel"
       FROM closure cl
       JOIN "CompetencyEdge" e ON e."toId" = cl.competency_id AND e.kind = 'REQUIRES'
       WHERE cl.depth < 8
     )
     SELECT competency_id, MIN(depth)::int AS depth, MAX(min_level)::int AS min_level
     FROM closure GROUP BY competency_id`,
    Array.from(targetSet),
  );

  const nodes = new Map<string, { toLevel: number; isPrereq: boolean }>();
  for (const t of targets) nodes.set(t.competencyId, { toLevel: t.targetLevel, isPrereq: false });
  for (const p of closure) {
    const cur = scores.get(p.competency_id)?.level ?? 0;
    if (cur >= p.min_level) continue; // already satisfied — not part of the path
    const existing = nodes.get(p.competency_id);
    nodes.set(p.competency_id, {
      toLevel: Math.max(existing?.toLevel ?? 0, p.min_level),
      isPrereq: existing ? existing.isPrereq : true,
    });
  }
  if (nodes.size === 0) return [];

  const ids = Array.from(nodes.keys());
  const [edges, comps, courseLinks] = await Promise.all([
    prisma.competencyEdge.findMany({
      where: { kind: 'REQUIRES', fromId: { in: ids }, toId: { in: ids } },
    }),
    prisma.competency.findMany({ where: { id: { in: ids } } }),
    prisma.courseCompetency.findMany({
      where: { competencyId: { in: ids } },
      include: { course: true },
    }),
  ]);
  const compBy = new Map(comps.map((c) => [c.id, c]));
  const sevBy = new Map(gaps.map((g) => [g.competencyId, g.severity]));

  // 2 + 3. Kahn's algorithm with a deterministic tie-break
  const indeg = new Map(ids.map((id) => [id, 0]));
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  const unlockCount = new Map(ids.map((id) => [id, 0]));
  for (const e of edges) {
    adj.get(e.fromId)!.push(e.toId);
    indeg.set(e.toId, (indeg.get(e.toId) ?? 0) + 1);
    unlockCount.set(e.fromId, (unlockCount.get(e.fromId) ?? 0) + 1);
  }

  const rank = (id: string) => {
    const sev = sevBy.get(id) ?? 0;
    const hours = compBy.get(id)?.estHours ?? 99;
    const unlocks = unlockCount.get(id) ?? 0;
    return [-sev, hours, -unlocks] as const;
  };
  const cmp = (a: string, b: string) => {
    const ra = rank(a), rb = rank(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2] || a.localeCompare(b);
  };

  const ready = ids.filter((id) => (indeg.get(id) ?? 0) === 0).sort(cmp);
  const ordered: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    ordered.push(id);
    for (const next of adj.get(id) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 1) - 1);
      if ((indeg.get(next) ?? 0) === 0) {
        ready.push(next);
        ready.sort(cmp);
      }
    }
  }
  // cycle guard: anything left unordered is appended rather than dropped, and
  // logged — a cycle is an ontology bug, not a reason to lose a step silently.
  const missing = ids.filter((id) => !ordered.includes(id));
  if (missing.length) {
    console.warn('[path] REQUIRES cycle detected, appending unordered nodes:', missing);
    ordered.push(...missing.sort(cmp));
  }

  // 4. courses
  const coursesBy = new Map<string, typeof courseLinks>();
  for (const cl of courseLinks) {
    if (!coursesBy.has(cl.competencyId)) coursesBy.set(cl.competencyId, []);
    coursesBy.get(cl.competencyId)!.push(cl);
  }

  return ordered.map((id, i) => {
    const node = nodes.get(id)!;
    const c = compBy.get(id)!;
    const cur = scores.get(id)?.level ?? 0;
    const unlocked = (adj.get(id) ?? []).map((x) => compBy.get(x)?.nameEn ?? x);
    const links = (coursesBy.get(id) ?? [])
      .sort((a, b) => {
        const la = Math.abs((a.targetLevel ?? 2) - node.toLevel) - Math.abs((b.targetLevel ?? 2) - node.toLevel);
        return la || b.course.completionRate - a.course.completionRate;
      })
      .slice(0, 3);
    return {
      order: i + 1,
      competencyId: id, nameEn: c.nameEn, domain: c.domain,
      fromLevel: cur, toLevel: node.toLevel,
      isPrerequisite: node.isPrereq,
      unlocks: unlocked,
      why: node.isPrereq
        ? `Prerequisite. ${unlocked.length ? `Unblocks ${unlocked.join(', ')}.` : 'Required before the target competency.'}`
        : `Required at L${node.toLevel} by your role profile.`,
      estHours: c.estHours,
      courses: links.map((l, j) => ({
        id: l.course.id, name: l.course.name, provider: l.course.provider,
        durationMins: l.course.durationMins, url: l.course.url,
        tpacFlagged: l.course.tpacFlagged, primary: j === 0,
      })),
    };
  });
}
