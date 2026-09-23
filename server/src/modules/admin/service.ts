import { prisma } from '../../lib/db.js';
import { scoresFor } from '../competency/service.js';

/** Aggregate views suppress any cell computed from fewer than this many people. */
export const K_ANONYMITY = 5;

export interface WorkforceCell { officialId: string; competencyId: string; level: number; score: number }

export interface WorkforceView {
  officials: { id: string; nameEn: string; designation: string; departmentId: string; roleProfileId: string; retiresInYears: number | null }[];
  competencies: { id: string; nameEn: string; domain: string }[];
  cells: WorkforceCell[];
  coverage: {
    competencyId: string; nameEn: string; domain: string;
    required: number; atOrAbove: number; coveragePct: number;
    targetLevel: number; suppressed: boolean;
  }[];
  succession: { competencyId: string; nameEn: string; holders: number; retiringWithin3Years: number }[];
  departmentId: string | null;
  totalOfficials: number;
}

/**
 * The workforce heatmap and the coverage table behind it.
 *
 * Coverage is defined against role requirements, not against the whole
 * ontology: "62% of the officials whose role requires SQL at L2 or above
 * actually have it" is a sentence a department head can act on. "The average
 * SQL score is 41" is not.
 */
export async function workforceView(opts: { departmentId?: string | null }): Promise<WorkforceView> {
  const officials = await prisma.official.findMany({
    where: opts.departmentId ? { departmentId: opts.departmentId } : {},
    select: {
      id: true, nameEn: true, designation: true, departmentId: true,
      roleProfileId: true, dateOfBirth: true,
    },
    orderBy: { nameEn: 'asc' },
  });

  const [competencies, requirements] = await Promise.all([
    prisma.competency.findMany({ select: { id: true, nameEn: true, domain: true }, orderBy: [{ domain: 'asc' }, { id: 'asc' }] }),
    prisma.roleRequirement.findMany(),
  ]);

  const reqByRole = new Map<string, typeof requirements>();
  for (const r of requirements) {
    if (!reqByRole.has(r.roleProfileId)) reqByRole.set(r.roleProfileId, []);
    reqByRole.get(r.roleProfileId)!.push(r);
  }

  const cells: WorkforceCell[] = [];
  const scoreIndex = new Map<string, Map<string, number>>();
  for (const o of officials) {
    const rows = await scoresFor(o.id);
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(r.competencyId, r.level);
      if (r.evidenceCount > 0) {
        cells.push({ officialId: o.id, competencyId: r.competencyId, level: r.level, score: r.score });
      }
    }
    scoreIndex.set(o.id, m);
  }

  // coverage against role requirements
  const agg = new Map<string, { required: number; met: number; targetSum: number }>();
  for (const o of officials) {
    for (const req of reqByRole.get(o.roleProfileId) ?? []) {
      const e = agg.get(req.competencyId) ?? { required: 0, met: 0, targetSum: 0 };
      e.required += 1;
      e.targetSum += req.targetLevel;
      if ((scoreIndex.get(o.id)?.get(req.competencyId) ?? 0) >= req.targetLevel) e.met += 1;
      agg.set(req.competencyId, e);
    }
  }

  const compBy = new Map(competencies.map((c) => [c.id, c]));
  const coverage = [...agg.entries()]
    .map(([competencyId, v]) => {
      const c = compBy.get(competencyId)!;
      const suppressed = v.required < K_ANONYMITY;
      return {
        competencyId, nameEn: c.nameEn, domain: c.domain,
        required: v.required,
        atOrAbove: suppressed ? 0 : v.met,
        coveragePct: suppressed ? 0 : (100 * v.met) / v.required,
        targetLevel: Math.round(v.targetSum / v.required),
        suppressed,
      };
    })
    .sort((a, b) => a.coveragePct - b.coveragePct);

  // succession risk: who holds a competency at L3+, and how many of them retire soon
  const now = new Date();
  const retiresIn = (dob: Date | null) =>
    dob ? Math.round(((dob.getFullYear() + 60) - now.getFullYear()) * 10) / 10 : null;

  const succession = coverage
    .filter((c) => !c.suppressed)
    .map((c) => {
      // "capable" = at or above L2 (can do the work with light supervision).
      // L3+ would be the stricter reading, but at L3 the holder counts are so
      // small that the ratio stops being informative.
      const holders = officials.filter((o) => (scoreIndex.get(o.id)?.get(c.competencyId) ?? 0) >= 2);
      return {
        competencyId: c.competencyId, nameEn: c.nameEn,
        holders: holders.length,
        retiringWithin3Years: holders.filter((o) => {
          const y = retiresIn(o.dateOfBirth);
          return y !== null && y <= 3;
        }).length,
      };
    })
    .filter((s) => s.holders > 0 && s.retiringWithin3Years > 0)
    .sort((a, b) => b.retiringWithin3Years / b.holders - a.retiringWithin3Years / a.holders);

  return {
    officials: officials.map((o) => ({
      id: o.id, nameEn: o.nameEn, designation: o.designation,
      departmentId: o.departmentId, roleProfileId: o.roleProfileId,
      retiresInYears: retiresIn(o.dateOfBirth),
    })),
    competencies,
    cells,
    coverage,
    succession,
    departmentId: opts.departmentId ?? null,
    totalOfficials: officials.length,
  };
}

/**
 * Training effectiveness: completion rate against measured competency lift.
 * A course with high completion and low lift is the interesting finding — it
 * is where a training budget is being spent without producing capability.
 */
export async function trainingEffectiveness() {
  const courses = await prisma.course.findMany({ include: { competencies: true } });
  const evidence = await prisma.evidence.findMany({
    where: { kind: 'COURSE_COMPLETION' },
    select: { sourceRef: true, quality: true, competencyId: true },
  });

  const byCourse = new Map<string, { n: number; q: number }>();
  for (const e of evidence) {
    const c = byCourse.get(e.sourceRef) ?? { n: 0, q: 0 };
    c.n += 1;
    c.q += e.quality;
    byCourse.set(e.sourceRef, c);
  }

  return courses
    .map((c) => {
      const stat = byCourse.get(c.id);
      const meanQuality = stat && stat.n ? stat.q / stat.n : null;
      // lift per hour is the number that justifies or kills a course
      const liftPerHour = meanQuality !== null ? (meanQuality * 100) / (c.durationMins / 60) : null;
      return {
        courseId: c.id, name: c.name, provider: c.provider, tpacFlagged: c.tpacFlagged,
        durationMins: c.durationMins,
        completionRate: c.completionRate,
        completions: stat?.n ?? 0,
        meanQuality,
        liftPerHour,
        competencyIds: c.competencies.map((x) => x.competencyId),
        flag:
          stat && stat.n >= 3 && c.completionRate > 0.7 && meanQuality !== null && meanQuality < 0.62
            ? 'HIGH_COMPLETION_LOW_LIFT'
            : c.completionRate < 0.45
              ? 'LOW_COMPLETION'
              : null,
      };
    })
    .sort((a, b) => (b.completions ?? 0) - (a.completions ?? 0));
}
