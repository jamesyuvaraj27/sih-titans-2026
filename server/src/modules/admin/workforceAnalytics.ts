import { prisma } from '../../lib/db.js';
import { scoresFor, gapsFor } from '../competency/service.js';

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

export interface WorkforceDatasetResult {
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

/**
 * Deterministically computes workforce dataset records with true evidence-based readiness & gaps.
 */
export async function getWorkforceDataset(query: {
  search?: string;
  departmentId?: string;
  designation?: string;
  cadre?: string;
  readinessStatus?: string;
  sort?: string;
  dir?: string;
  page?: number | string;
  limit?: number | string;
}): Promise<WorkforceDatasetResult> {
  const [officials, departments, competencies, requirements] = await Promise.all([
    prisma.official.findMany({
      include: {
        department: true,
        roleProfile: {
          include: { requirements: { include: { competency: true } } },
        },
      },
      orderBy: { nameEn: 'asc' },
    }),
    prisma.department.findMany({ select: { id: true, nameEn: true }, orderBy: { nameEn: 'asc' } }),
    prisma.competency.findMany({ select: { id: true, nameEn: true, domain: true } }),
    prisma.roleRequirement.findMany(),
  ]);

  const compMap = new Map(competencies.map((c) => [c.id, c]));
  const now = new Date();

  // Evaluate scores for all officials
  const records: WorkforceRecord[] = await Promise.all(
    officials.map(async (o) => {
      const scores = await scoresFor(o.id);
      const scoreMap = new Map(scores.map((s) => [s.competencyId, s]));

      const roleReqs = o.roleProfile?.requirements ?? [];
      let totalReqLevels = 0;
      let metLevels = 0;
      let metCount = 0;
      let gapCount = 0;

      let maxGapVal = -1;
      let topGapObj: WorkforceRecord['topGap'] = null;

      for (const req of roleReqs) {
        totalReqLevels += req.targetLevel;
        const s = scoreMap.get(req.competencyId);
        const curLevel = s?.level ?? 0;
        metLevels += Math.min(req.targetLevel, curLevel);

        if (curLevel >= req.targetLevel) {
          metCount += 1;
        } else {
          gapCount += 1;
          const gapVal = req.targetLevel - curLevel;
          const severity = gapVal * req.criticality;
          if (severity > maxGapVal) {
            maxGapVal = severity;
            const c = compMap.get(req.competencyId);
            topGapObj = {
              competencyId: req.competencyId,
              nameEn: c?.nameEn ?? req.competencyId,
              domain: c?.domain ?? 'STAT',
              gap: gapVal,
              severity,
            };
          }
        }
      }

      // Readiness score formula (explainable percentage of required target levels evidenced)
      const readinessScore = totalReqLevels > 0 ? Math.round((metLevels / totalReqLevels) * 100) : 100;
      const readinessStatus: WorkforceRecord['readinessStatus'] =
        readinessScore >= 80 ? 'READY' : readinessScore >= 50 ? 'DEVELOPING' : 'CRITICAL';

      // Experience in years
      const doj = new Date(o.dateOfJoining);
      const experienceYears = Math.max(0, Math.round(((now.getTime() - doj.getTime()) / (365.25 * 86400_000)) * 10) / 10);

      // Retirement horizon in years
      const dob = o.dateOfBirth ? new Date(o.dateOfBirth) : null;
      const retiresInYears = dob
        ? Math.max(0, Math.round(((dob.getFullYear() + 60) - now.getFullYear()) * 10) / 10)
        : null;

      return {
        id: o.id,
        employeeCode: o.employeeCode,
        name: o.nameEn,
        email: o.email,
        designation: o.designation,
        cadre: o.cadre,
        departmentId: o.departmentId,
        departmentName: o.department.nameEn,
        roleProfileId: o.roleProfileId,
        roleTitle: o.roleProfile.titleEn,
        dateOfJoining: o.dateOfJoining ? o.dateOfJoining.toISOString().split('T')[0]! : '',
        experienceYears,
        dateOfBirth: o.dateOfBirth ? (o.dateOfBirth.toISOString().split('T')[0] ?? null) : null,
        retiresInYears,
        readinessScore,
        readinessStatus,
        requirementsCount: roleReqs.length,
        requirementsMetCount: metCount,
        gapCount,
        topGap: topGapObj,
        qualifications: o.qualifications,
      };
    }),
  );

  // Extract distinct filter options
  const distinctDesignations = Array.from(new Set(records.map((r) => r.designation).filter(Boolean))).sort();
  const distinctCadres = Array.from(new Set(records.map((r) => r.cadre).filter(Boolean))) as string[];
  distinctCadres.sort();

  // Apply filters
  let filtered = records;

  if (query.search) {
    const s = query.search.toLowerCase().trim();
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s) ||
        r.employeeCode.toLowerCase().includes(s) ||
        r.designation.toLowerCase().includes(s) ||
        r.departmentName.toLowerCase().includes(s),
    );
  }

  if (query.departmentId && query.departmentId !== 'ALL') {
    filtered = filtered.filter((r) => r.departmentId === query.departmentId);
  }

  if (query.designation && query.designation !== 'ALL') {
    filtered = filtered.filter((r) => r.designation === query.designation);
  }

  if (query.cadre && query.cadre !== 'ALL') {
    filtered = filtered.filter((r) => r.cadre === query.cadre);
  }

  if (query.readinessStatus && query.readinessStatus !== 'ALL') {
    filtered = filtered.filter((r) => r.readinessStatus === query.readinessStatus);
  }

  // Sort
  const sortKey = query.sort || 'name';
  const sortDir = query.dir === 'desc' ? -1 : 1;

  filtered.sort((a: any, b: any) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (typeof va === 'string' && typeof vb === 'string') {
      return va.localeCompare(vb) * sortDir;
    }
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * sortDir;
    }
    return 0;
  });

  // Pagination
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  return {
    total,
    page,
    limit,
    totalPages,
    records: paginated,
    filters: {
      departments: departments.map((d) => ({ id: d.id, name: d.nameEn })),
      designations: distinctDesignations,
      cadres: distinctCadres,
    },
  };
}

/**
 * Returns complete deep inspection for a single official record.
 */
export async function getOfficialAnalyticsDetail(officialId: string) {
  const official = await prisma.official.findUniqueOrThrow({
    where: { id: officialId },
    include: {
      department: true,
      roleProfile: {
        include: {
          requirements: {
            include: { competency: true },
          },
        },
      },
      evidence: {
        orderBy: { occurredAt: 'desc' },
        take: 30,
        include: { competency: true },
      },
      sessions: {
        orderBy: { startedAt: 'desc' },
        take: 10,
      },
    },
  });

  const [scores, gaps] = await Promise.all([
    scoresFor(officialId),
    gapsFor(officialId),
  ]);

  const scoreMap = new Map(scores.map((s) => [s.competencyId, s]));
  const gapMap = new Map(gaps.map((g) => [g.competencyId, g]));

  const requirements = official.roleProfile.requirements.map((req) => {
    const s = scoreMap.get(req.competencyId);
    const g = gapMap.get(req.competencyId);
    const curLevel = s?.level ?? 0;
    const curScore = s?.score ?? 0;
    const isMet = curLevel >= req.targetLevel;

    return {
      competencyId: req.competencyId,
      nameEn: req.competency.nameEn,
      domain: req.competency.domain,
      area: req.competency.area,
      targetLevel: req.targetLevel,
      currentLevel: curLevel,
      currentScore: curScore,
      criticality: req.criticality,
      rationale: req.rationale,
      isMet,
      gap: g?.gap ?? Math.max(0, req.targetLevel - curLevel),
      severity: g?.severity ?? 0,
      urgency: g?.urgency ?? 1,
    };
  });

  const totalReqLevels = requirements.reduce((acc, r) => acc + r.targetLevel, 0);
  const metLevels = requirements.reduce((acc, r) => acc + Math.min(r.targetLevel, r.currentLevel), 0);
  const readinessScore = totalReqLevels > 0 ? Math.round((metLevels / totalReqLevels) * 100) : 100;

  return {
    official: {
      id: official.id,
      employeeCode: official.employeeCode,
      name: official.nameEn,
      email: official.email,
      designation: official.designation,
      cadre: official.cadre,
      departmentId: official.departmentId,
      departmentName: official.department.nameEn,
      roleProfileId: official.roleProfileId,
      roleTitle: official.roleProfile.titleEn,
      dateOfJoining: official.dateOfJoining.toISOString().split('T')[0],
      dateOfBirth: official.dateOfBirth ? official.dateOfBirth.toISOString().split('T')[0] : null,
      qualifications: official.qualifications,
      readinessScore,
    },
    requirements,
    recentEvidence: official.evidence.map((e) => ({
      id: e.id,
      kind: e.kind,
      competencyId: e.competencyId,
      competencyName: e.competency.nameEn,
      occurredAt: e.occurredAt.toISOString(),
      quality: e.quality,
      summary: e.summary,
    })),
    recentSessions: official.sessions.map((s) => ({
      id: s.id,
      title: s.title,
      startedAt: s.startedAt.toISOString(),
      submittedAt: s.submittedAt?.toISOString() ?? null,
      scorePct: s.scorePct,
    })),
  };
}

/**
 * Generates an Excel-compatible CSV export of the workforce dataset.
 */
export async function exportWorkforceDatasetCsv(query?: any): Promise<string> {
  const result = await getWorkforceDataset({ ...query, page: 1, limit: 1000 });
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const headers = [
    'employee_code',
    'officer_name',
    'email',
    'designation',
    'cadre',
    'department',
    'experience_years',
    'readiness_percent',
    'readiness_status',
    'requirements_count',
    'requirements_met_count',
    'open_gaps_count',
    'top_gap_competency',
    'top_gap_severity',
  ];

  const rows = result.records.map((r) =>
    [
      r.employeeCode,
      r.name,
      r.email,
      r.designation,
      r.cadre ?? 'N/A',
      r.departmentName,
      r.experienceYears,
      r.readinessScore,
      r.readinessStatus,
      r.requirementsCount,
      r.requirementsMetCount,
      r.gapCount,
      r.topGap?.nameEn ?? 'None (Target Met)',
      r.topGap?.severity ?? 0,
    ]
      .map(esc)
      .join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Computes complete Administrator Workforce Analytics:
 * - Workforce Overview
 * - Training Demand Graph data
 * - Readiness by Designation
 * - Skill-Gap Heatmap
 * - Course / Training Coverage
 */
export async function getWorkforceAnalytics(opts: {
  departmentId?: string;
  designation?: string;
  domain?: string;
} = {}) {
  const [officials, competencies, requirements, courses, courseComps, calendarEntries] = await Promise.all([
    prisma.official.findMany({
      include: {
        department: true,
        roleProfile: {
          include: { requirements: { include: { competency: true } } },
        },
      },
    }),
    prisma.competency.findMany({
      select: { id: true, nameEn: true, domain: true, area: true },
      orderBy: [{ domain: 'asc' }, { id: 'asc' }],
    }),
    prisma.roleRequirement.findMany({
      include: { competency: true },
    }),
    prisma.course.findMany({
      include: { competencies: true },
    }),
    prisma.courseCompetency.findMany({
      include: { course: true },
    }),
    prisma.surveyCalendarEntry.findMany(),
  ]);

  const compMap = new Map(competencies.map((c) => [c.id, c]));

  // Index courses by competencyId
  const coursesByComp = new Map<string, typeof courseComps>();
  for (const cc of courseComps) {
    if (!coursesByComp.has(cc.competencyId)) coursesByComp.set(cc.competencyId, []);
    coursesByComp.get(cc.competencyId)!.push(cc);
  }

  // Pre-evaluate scores for all officials
  const officialScores = new Map<string, Map<string, { level: number; score: number }>>();
  const officialReadiness = new Map<string, number>();

  for (const o of officials) {
    const sList = await scoresFor(o.id);
    const m = new Map<string, { level: number; score: number }>();
    for (const s of sList) {
      m.set(s.competencyId, { level: s.level, score: s.score });
    }
    officialScores.set(o.id, m);

    // Compute official readiness
    const reqs = o.roleProfile?.requirements ?? [];
    let tot = 0;
    let met = 0;
    for (const req of reqs) {
      tot += req.targetLevel;
      const curLevel = m.get(req.competencyId)?.level ?? 0;
      met += Math.min(req.targetLevel, curLevel);
    }
    officialReadiness.set(o.id, tot > 0 ? Math.round((met / tot) * 100) : 100);
  }

  // Filter officials by department/designation if requested
  const inScopeOfficials = officials.filter((o) => {
    if (opts.departmentId && opts.departmentId !== 'ALL' && o.departmentId !== opts.departmentId) return false;
    if (opts.designation && opts.designation !== 'ALL' && o.designation !== opts.designation) return false;
    return true;
  });

  // 1. OVERVIEW
  const totalOfficials = inScopeOfficials.length;
  const allReadinessValues = inScopeOfficials.map((o) => officialReadiness.get(o.id) ?? 0);
  const meanReadiness =
    totalOfficials > 0 ? Math.round(allReadinessValues.reduce((a, b) => a + b, 0) / totalOfficials) : 0;

  // Cadre breakdown
  const cadreAcc = new Map<string, { count: number; readinessSum: number }>();
  for (const o of inScopeOfficials) {
    const c = o.cadre || 'General Cadre';
    const entry = cadreAcc.get(c) ?? { count: 0, readinessSum: 0 };
    entry.count += 1;
    entry.readinessSum += officialReadiness.get(o.id) ?? 0;
    cadreAcc.set(c, entry);
  }
  const cadreSummary = Array.from(cadreAcc.entries()).map(([cadre, data]) => ({
    cadre,
    count: data.count,
    meanReadiness: Math.round(data.readinessSum / data.count),
  }));

  // Department breakdown
  const deptAcc = new Map<string, { name: string; count: number; readinessSum: number }>();
  for (const o of inScopeOfficials) {
    const dId = o.departmentId;
    const entry = deptAcc.get(dId) ?? { name: o.department.nameEn, count: 0, readinessSum: 0 };
    entry.count += 1;
    entry.readinessSum += officialReadiness.get(o.id) ?? 0;
    deptAcc.set(dId, entry);
  }
  const departmentSummary = Array.from(deptAcc.entries()).map(([departmentId, data]) => ({
    departmentId,
    departmentName: data.name,
    count: data.count,
    meanReadiness: Math.round(data.readinessSum / data.count),
  }));

  // 2. TRAINING DEMAND
  // Aggregate demand by competency across officials needing it
  const demandAcc = new Map<
    string,
    {
      competencyId: string;
      totalRequired: number;
      officersAffected: number;
      gapSum: number;
      scoreSum: number;
      designationsAffected: Map<string, { count: number; gapSum: number }>;
    }
  >();

  for (const o of inScopeOfficials) {
    const reqs = o.roleProfile?.requirements ?? [];
    const sMap = officialScores.get(o.id);

    for (const req of reqs) {
      const entry = demandAcc.get(req.competencyId) ?? {
        competencyId: req.competencyId,
        totalRequired: 0,
        officersAffected: 0,
        gapSum: 0,
        scoreSum: 0,
        designationsAffected: new Map(),
      };

      entry.totalRequired += 1;
      const curLevel = sMap?.get(req.competencyId)?.level ?? 0;
      const curScore = sMap?.get(req.competencyId)?.score ?? 0;
      entry.scoreSum += curScore;

      if (curLevel < req.targetLevel) {
        const gapVal = req.targetLevel - curLevel;
        entry.officersAffected += 1;
        entry.gapSum += gapVal;

        const desEntry = entry.designationsAffected.get(o.designation) ?? { count: 0, gapSum: 0 };
        desEntry.count += 1;
        desEntry.gapSum += gapVal;
        entry.designationsAffected.set(o.designation, desEntry);
      }

      demandAcc.set(req.competencyId, entry);
    }
  }

  // Survey calendar urgency index
  const calendarUrgentComps = new Set<string>();
  for (const cal of calendarEntries) {
    for (const cid of cal.competencyIds) calendarUrgentComps.add(cid);
  }

  let trainingDemand = Array.from(demandAcc.values())
    .map((d) => {
      const c = compMap.get(d.competencyId);
      const mapped = coursesByComp.get(d.competencyId) || [];
      const meanGap = d.officersAffected > 0 ? Number((d.gapSum / d.officersAffected).toFixed(1)) : 0;
      const meanScore = d.totalRequired > 0 ? Number((d.scoreSum / d.totalRequired).toFixed(1)) : 0;
      const shareAffected = d.totalRequired > 0 ? Math.round((d.officersAffected / d.totalRequired) * 100) : 0;
      const isUrgent = calendarUrgentComps.has(d.competencyId);

      const desList = Array.from(d.designationsAffected.entries()).map(([des, val]) => ({
        designation: des,
        count: val.count,
        meanGap: Number((val.gapSum / val.count).toFixed(1)),
      }));
      desList.sort((a, b) => b.count - a.count);

      return {
        competencyId: d.competencyId,
        nameEn: c?.nameEn ?? d.competencyId,
        domain: c?.domain ?? 'STAT',
        area: c?.area ?? 'General',
        totalRequired: d.totalRequired,
        officersAffected: d.officersAffected,
        shareAffected,
        meanGap,
        meanScore,
        isUrgent,
        coursesCount: mapped.length,
        courses: mapped.map((m) => ({
          id: m.course.id,
          name: m.course.name,
          provider: m.course.provider,
          durationMins: m.course.durationMins,
          url: m.course.url,
        })),
        affectedDesignations: desList,
      };
    })
    .sort((a, b) => b.officersAffected - a.officersAffected || b.meanGap - a.meanGap);

  if (opts.domain && opts.domain !== 'ALL') {
    trainingDemand = trainingDemand.filter((t) => t.domain === opts.domain);
  }

  // Demanded Domains
  const domainDemandAcc = new Map<string, { domain: string; totalGaps: number; officersAffected: number; sumGap: number; count: number }>();
  for (const td of trainingDemand) {
    const entry = domainDemandAcc.get(td.domain) ?? { domain: td.domain, totalGaps: 0, officersAffected: 0, sumGap: 0, count: 0 };
    entry.totalGaps += td.officersAffected;
    entry.officersAffected += td.officersAffected;
    entry.sumGap += td.meanGap;
    entry.count += 1;
    domainDemandAcc.set(td.domain, entry);
  }
  const demandedDomains = Array.from(domainDemandAcc.values()).map((d) => ({
    domain: d.domain,
    officersAffected: d.officersAffected,
    meanGap: d.count > 0 ? Number((d.sumGap / d.count).toFixed(1)) : 0,
  }));

  // 3. READINESS BY DESIGNATION
  type InScopeOfficial = (typeof inScopeOfficials)[number];
  const desAcc = new Map<
    string,
    {
      designation: string;
      officers: InScopeOfficial[];
      readinessSum: number;
      readinessList: number[];
      reqsTotal: number;
      reqsMet: number;
      gapsAcc: Map<string, { gapSum: number; count: number }>;
    }
  >();

  for (const o of inScopeOfficials) {
    const entry = desAcc.get(o.designation) ?? {
      designation: o.designation,
      officers: [] as InScopeOfficial[],
      readinessSum: 0,
      readinessList: [] as number[],
      reqsTotal: 0,
      reqsMet: 0,
      gapsAcc: new Map(),
    };

    entry.officers.push(o);
    const rScore = officialReadiness.get(o.id) ?? 0;
    entry.readinessSum += rScore;
    entry.readinessList.push(rScore);

    const reqs = o.roleProfile?.requirements ?? [];
    const sMap = officialScores.get(o.id);
    for (const req of reqs) {
      entry.reqsTotal += 1;
      const curLevel = sMap?.get(req.competencyId)?.level ?? 0;
      if (curLevel >= req.targetLevel) {
        entry.reqsMet += 1;
      } else {
        const gapVal = req.targetLevel - curLevel;
        const gEntry = entry.gapsAcc.get(req.competencyId) ?? { gapSum: 0, count: 0 };
        gEntry.gapSum += gapVal;
        gEntry.count += 1;
        entry.gapsAcc.set(req.competencyId, gEntry);
      }
    }

    desAcc.set(o.designation, entry);
  }

  const readinessByDesignation = Array.from(desAcc.values())
    .map((d) => {
      const meanR = d.officers.length > 0 ? Math.round(d.readinessSum / d.officers.length) : 0;
      const minR = Math.min(...d.readinessList);
      const maxR = Math.max(...d.readinessList);

      // Top gap in this designation
      let topGapObj: { competencyId: string; nameEn: string; meanGap: number; officersAffected: number } | null = null;
      let maxGapCount = -1;
      for (const [cid, val] of d.gapsAcc) {
        if (val.count > maxGapCount) {
          maxGapCount = val.count;
          const c = compMap.get(cid);
          topGapObj = {
            competencyId: cid,
            nameEn: c?.nameEn ?? cid,
            meanGap: Number((val.gapSum / val.count).toFixed(1)),
            officersAffected: val.count,
          };
        }
      }

      return {
        designation: d.designation,
        officersCount: d.officers.length,
        meanReadiness: meanR,
        minReadiness: minR,
        maxReadiness: maxR,
        readinessStatus: meanR >= 80 ? ('READY' as const) : meanR >= 50 ? ('DEVELOPING' as const) : ('CRITICAL' as const),
        requirementsAssigned: d.reqsTotal,
        requirementsMet: d.reqsMet,
        topGap: topGapObj,
        officers: d.officers.map((o) => ({
          id: o.id,
          name: o.nameEn,
          email: o.email,
          readiness: officialReadiness.get(o.id) ?? 0,
        })),
      };
    })
    .sort((a, b) => a.meanReadiness - b.meanReadiness);

  // 4. SKILL-GAP HEATMAP (Designation x Competency Mean-Gap Matrix)
  const allDesignations = Array.from(new Set(inScopeOfficials.map((o) => o.designation))).sort();
  const requiredCompIds = new Set(requirements.map((r) => r.competencyId));
  const activeCompetencies = competencies.filter((c) => requiredCompIds.has(c.id));

  // Cell accumulator: `${designation}|${competencyId}`
  const cellAcc = new Map<string, { gapSum: number; scoreSum: number; count: number; officers: number }>();
  for (const o of inScopeOfficials) {
    const reqs = o.roleProfile?.requirements ?? [];
    const sMap = officialScores.get(o.id);
    for (const req of reqs) {
      const k = `${o.designation}|${req.competencyId}`;
      const entry = cellAcc.get(k) ?? { gapSum: 0, scoreSum: 0, count: 0, officers: 0 };
      const curLevel = sMap?.get(req.competencyId)?.level ?? 0;
      const curScore = sMap?.get(req.competencyId)?.score ?? 0;
      const gapVal = Math.max(0, req.targetLevel - curLevel);
      entry.gapSum += gapVal;
      entry.scoreSum += curScore;
      entry.count += 1;
      entry.officers += 1;
      cellAcc.set(k, entry);
    }
  }

  const heatmapCells: {
    designation: string;
    competencyId: string;
    competencyName: string;
    domain: string;
    meanGap: number | null;
    meanScore: number | null;
    officers: number;
  }[] = [];

  for (const des of allDesignations) {
    for (const c of activeCompetencies) {
      const a = cellAcc.get(`${des}|${c.id}`);
      heatmapCells.push({
        designation: des,
        competencyId: c.id,
        competencyName: c.nameEn,
        domain: c.domain,
        meanGap: a ? Number((a.gapSum / a.count).toFixed(1)) : null,
        meanScore: a ? Number((a.scoreSum / a.count).toFixed(1)) : null,
        officers: a ? a.officers : 0,
      });
    }
  }

  // 5. TRAINING / COURSE COVERAGE
  const totalCompCount = competencies.length;
  const coveredComps = competencies.filter((c) => (coursesByComp.get(c.id)?.length || 0) > 0);
  const uncoveredComps = competencies.filter((c) => (coursesByComp.get(c.id)?.length || 0) === 0);

  const uncoveredDemands = trainingDemand.filter((t) => t.coursesCount === 0 && t.officersAffected > 0);

  return {
    overview: {
      totalOfficials,
      meanReadiness,
      totalShortfalls: trainingDemand.reduce((acc, t) => acc + t.officersAffected, 0),
      criticalShortagesCount: trainingDemand.filter((t) => t.meanGap >= 1.5).length,
      topPrioritySkill: trainingDemand[0] ?? null,
      cadreSummary,
      departmentSummary,
    },
    trainingDemand: trainingDemand.slice(0, 20),
    demandedDomains,
    readinessByDesignation,
    heatmap: {
      designations: allDesignations,
      competencies: activeCompetencies.map((c) => ({ id: c.id, name: c.nameEn, domain: c.domain })),
      cells: heatmapCells,
    },
    courseCoverage: {
      totalCompetencies: totalCompCount,
      coveredCount: coveredComps.length,
      uncoveredCount: uncoveredComps.length,
      coveragePct: Math.round((coveredComps.length / totalCompCount) * 100),
      uncoveredHighDemand: uncoveredDemands.slice(0, 8),
      totalCourses: courses.length,
    },
  };
}
