/**
 * Deterministic seed. Running it twice produces the same database, which
 * matters: the demo script in docs/DEMO-SCRIPT.md references specific
 * numbers on specific screens.
 */
import bcrypt from 'bcryptjs';
import { prisma, toVectorLiteral } from '../lib/db.js';
import { embed } from '../ai/embedding.js';
import { COMPETENCIES, EDGES, ROLES, COURSES, CALENDAR } from './ontology.js';

// ── deterministic PRNG (mulberry32) ─────────────────────────────────────
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260908);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000);
const daysAhead = (d: number) => new Date(Date.now() + d * 86400_000);

const DEPARTMENTS = [
  { id: 'DEPT.MOSPI.HQ', nameEn: 'MoSPI Headquarters, New Delhi', kind: 'MoSPI-HQ', state: 'Delhi' },
  { id: 'DEPT.NSSO.FOD', nameEn: 'NSSO Field Operations Division — Guntur Region', kind: 'NSSO-FOD', state: 'Andhra Pradesh' },
  { id: 'DEPT.DES.AP', nameEn: 'Directorate of Economics & Statistics, Andhra Pradesh', kind: 'DES-State', state: 'Andhra Pradesh' },
  { id: 'DEPT.NSSTA', nameEn: 'National Statistical Systems Training Academy', kind: 'NSSTA', state: 'Uttar Pradesh' },
  { id: 'DEPT.PRICE', nameEn: 'Price Statistics Division, MoSPI', kind: 'MoSPI-HQ', state: 'Delhi' },
];

const FIRST = ['Anitha', 'Rajesh', 'Sunita', 'Vikram', 'Priya', 'Arun', 'Meera', 'Kiran', 'Deepa', 'Sanjay',
  'Lakshmi', 'Ramesh', 'Kavya', 'Naveen', 'Shalini', 'Pradeep', 'Divya', 'Manoj', 'Swathi', 'Harish',
  'Nandini', 'Girish', 'Rekha', 'Suresh', 'Anjali', 'Mohan', 'Padma', 'Vijay', 'Latha', 'Ashok'];
const LAST = ['Rao', 'Sharma', 'Reddy', 'Nair', 'Iyer', 'Kumar', 'Patel', 'Das', 'Menon', 'Verma',
  'Chowdhury', 'Pillai', 'Joshi', 'Bhat', 'Naidu', 'Mishra', 'Gowda', 'Sinha'];

async function main() {
  console.log('› clearing');
  // order matters — FKs
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "ItemResponse","QuizSession","QuestionItem","ChunkCompetency","Chunk","Document",
      "CompetencyScoreCache","AuditEvent","SurveyCalendarEntry","CourseCompetency","Course",
      "RoleRequirement","CompetencyEdge" RESTART IDENTITY CASCADE;`);
  // Evidence has an append-only trigger on DELETE — TRUNCATE bypasses row triggers,
  // which is exactly why reseeding is possible and an application DELETE is not.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Evidence" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Official" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "RoleProfile","Competency","Department" CASCADE;`);

  console.log('› departments');
  await prisma.department.createMany({ data: DEPARTMENTS });

  console.log(`› ${COMPETENCIES.length} competencies`);
  await prisma.competency.createMany({
    data: COMPETENCIES.map((c) => ({
      id: c.id, domain: c.domain, area: c.area, nameEn: c.nameEn, nameHi: c.nameHi ?? null,
      description: c.description, gsbpmPhases: c.gsbpm ?? [], decayHalfLifeMonths: c.halfLife,
      estHours: c.estHours,
      levelAnchors: { L1: c.anchors[0], L2: c.anchors[1], L3: c.anchors[2], L4: c.anchors[3] },
    })),
  });
  for (const c of COMPETENCIES) {
    const v = embed(`${c.nameEn} ${c.area} ${c.description}`);
    await prisma.$executeRawUnsafe(
      `UPDATE "Competency" SET embedding = $1::vector WHERE id = $2`, toVectorLiteral(v), c.id);
  }

  console.log(`› ${EDGES.length} edges`);
  await prisma.competencyEdge.createMany({
    data: EDGES.map(([fromId, toId, kind, weight, minFromLevel]) => ({
      fromId, toId, kind, weight: weight ?? 1.0, minFromLevel: minFromLevel ?? 2,
    })),
    skipDuplicates: true,
  });

  console.log(`› ${ROLES.length} role profiles`);
  for (const r of ROLES) {
    await prisma.roleProfile.create({
      data: {
        id: r.id, titleEn: r.titleEn, cadre: r.cadre, description: r.description,
        requirements: {
          create: r.requires.map(([competencyId, targetLevel, criticality, rationale]) => ({
            competencyId, targetLevel, criticality, rationale,
          })),
        },
      },
    });
  }

  console.log(`› ${COURSES.length} courses`);
  for (const [id, name, provider, durationMins, level, comps, completionRate, tpac] of COURSES) {
    await prisma.course.create({
      data: {
        id, name, provider, durationMins, level, completionRate, tpacFlagged: tpac,
        description: `${provider} course covering ${comps.join(', ')}.`,
        url: provider === 'iGOT' ? `https://portal.igotkarmayogi.gov.in/app/toc/${id}/overview` : null,
        competencies: { create: comps.map((competencyId) => ({ competencyId, targetLevel: level === 'L3' ? 3 : 2 })) },
      },
    });
  }

  console.log('› calendar');
  await prisma.surveyCalendarEntry.createMany({
    data: CALENDAR.map(([name, owner, inDays, dur, competencyIds, headcount]) => ({
      name, owner, startsOn: daysAhead(inDays), endsOn: daysAhead(inDays + dur), competencyIds, headcount,
      notes: `${headcount} officials engaged. Competencies required: ${competencyIds.join(', ')}.`,
    })),
  });

  // ── people ────────────────────────────────────────────────────────────
  const pw = await bcrypt.hash('demo1234', 8);
  console.log('› officials');

  const named = await prisma.official.create({
    data: {
      id: 'off_anitha', employeeCode: 'SSS/AP/2011/0417', email: 'anitha@mospi.gov.in',
      passwordHash: pw, role: 'LEARNER', nameEn: 'Anitha Rao', nameHi: 'अनीता राव',
      designation: 'Senior Statistical Officer', cadre: 'Subordinate Statistical Service',
      departmentId: 'DEPT.NSSO.FOD', roleProfileId: 'ROLE.SSO',
      dateOfBirth: new Date('1986-03-14'), dateOfJoining: new Date('2011-07-01'),
      qualifications: [{ degree: 'M.Sc.', subject: 'Statistics', year: 2010, institution: 'Andhra University' }],
      preferredLang: 'en',
    },
  });

  const trainer = await prisma.official.create({
    data: {
      id: 'off_rajesh', employeeCode: 'ISS/2009/0088', email: 'rajesh@nssta.gov.in',
      passwordHash: pw, role: 'MANAGER', nameEn: 'Rajesh Sharma',
      designation: 'Faculty (Survey Methodology)', cadre: 'Indian Statistical Service',
      departmentId: 'DEPT.NSSTA', roleProfileId: 'ROLE.TRAINER',
      dateOfBirth: new Date('1978-11-02'), dateOfJoining: new Date('2009-09-15'),
      qualifications: [{ degree: 'Ph.D.', subject: 'Statistics', year: 2008, institution: 'ISI Kolkata' }],
    },
  });

  await prisma.official.create({
    data: {
      id: 'off_admin', employeeCode: 'ISS/2006/0031', email: 'admin@mospi.gov.in',
      passwordHash: pw, role: 'SUPER_ADMIN', nameEn: 'Sunita Menon',
      designation: 'Deputy Director (Capacity Building)', cadre: 'Indian Statistical Service',
      departmentId: 'DEPT.MOSPI.HQ', roleProfileId: 'ROLE.DD',
      dateOfBirth: new Date('1975-06-21'), dateOfJoining: new Date('2006-08-01'),
    },
  });

  await prisma.official.create({
    data: {
      id: 'off_deptadmin', employeeCode: 'SSS/AP/2008/0203', email: 'dept@ap.gov.in',
      passwordHash: pw, role: 'DEPT_ADMIN', nameEn: 'Prakash Naidu',
      designation: 'Joint Director, DES Andhra Pradesh', cadre: 'State Statistical Service',
      departmentId: 'DEPT.DES.AP', roleProfileId: 'ROLE.ASO',
      dateOfBirth: new Date('1972-09-08'), dateOfJoining: new Date('2008-02-11'),
    },
  });

  await prisma.official.create({
    data: {
      id: 'off_auditor', employeeCode: 'CAG/AUD/2019/0007', email: 'auditor@cag.gov.in',
      passwordHash: pw, role: 'AUDITOR', nameEn: 'V. Ramamurthy',
      designation: 'Audit Officer', cadre: 'Indian Audit and Accounts Service',
      departmentId: 'DEPT.MOSPI.HQ', roleProfileId: 'ROLE.DD',
      dateOfJoining: new Date('2019-04-01'),
    },
  });

  await prisma.official.update({ where: { id: named.id }, data: { managerId: trainer.id } });

  // synthetic cohort for the workforce heatmap
  const roleIds = ROLES.map((r) => r.id);
  const cohort: { id: string; roleProfileId: string }[] = [];
  for (let i = 0; i < 44; i++) {
    const roleProfileId = i < 14 ? 'ROLE.JSO' : i < 24 ? 'ROLE.SSO' : i < 32 ? 'ROLE.ASO' : pick(roleIds);
    const nameEn = `${pick(FIRST)} ${pick(LAST)}`;
    const dept = i < 20 ? 'DEPT.NSSO.FOD' : i < 32 ? 'DEPT.DES.AP' : i < 38 ? 'DEPT.MOSPI.HQ' : pick(['DEPT.NSSTA', 'DEPT.PRICE']);
    const id = `off_syn_${i.toString().padStart(2, '0')}`;
    const birthYear = 1966 + Math.floor(rand() * 32); // some near retirement, deliberately
    cohort.push({ id, roleProfileId });
    await prisma.official.create({
      data: {
        id, employeeCode: `SSS/SYN/${2000 + Math.floor(rand() * 22)}/${(1000 + i).toString()}`,
        email: `${id}@mospi.gov.in`, passwordHash: pw, role: 'LEARNER', nameEn,
        designation: ROLES.find((r) => r.id === roleProfileId)!.titleEn,
        departmentId: dept, roleProfileId,
        dateOfBirth: new Date(`${birthYear}-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`),
        dateOfJoining: new Date(`${Math.min(2024, birthYear + 24)}-06-01`),
        managerId: null,
      },
    });
  }

  // ── the evidence ledger ───────────────────────────────────────────────
  console.log('› evidence ledger');
  type Ev = {
    officialId: string; competencyId: string; kind: any; quality: number;
    occurredAt: Date; sourceType: string; sourceRef: string; summary: string; payload?: any;
  };
  const evidence: Ev[] = [];

  const courseFor = (cid: string) => COURSES.find(([, , , , , comps]) => comps.includes(cid));

  /** Hand-crafted so the demo tells a story. See docs/DEMO-SCRIPT.md. */
  const anithaStory: [string, Ev['kind'], number, number, string][] = [
    // competency, kind, quality, daysAgo, summary
    ['STAT.SURV.FIELD', 'ASSESSMENT', 0.92, 95, 'NSSTA field supervision assessment — 92%'],
    ['STAT.SURV.FIELD', 'PROJECT_ARTIFACT', 0.88, 160, 'Supervised HCES sub-round in Guntur district; scrutiny report accepted'],
    ['STAT.SURV.FIELD', 'COURSE_COMPLETION', 0.8, 640, 'Completed: Field Operations and Enumerator Supervision (NSSTA)'],
    ['STAT.SAMP.BASIC', 'COURSE_COMPLETION', 0.85, 1450, 'Completed: Introduction to Sampling Methods (iGOT)'],
    ['STAT.SAMP.BASIC', 'PROJECT_ARTIFACT', 0.82, 175, 'Verified the HCES sampling frame for 41 villages before selection'],
    ['STAT.SAMP.BASIC', 'ATTESTATION', 0.75, 260, 'Supervisor attestation: applies the selection protocol correctly without guidance'],
    ['STAT.SAMP.SRS', 'ASSESSMENT', 0.81, 1400, 'Sampling fundamentals assessment — 81%'],
    ['STAT.SAMP.STRAT', 'COURSE_COMPLETION', 0.78, 420, 'Completed: Stratified and Multistage Sampling Designs (NSSTA)'],
    ['STAT.SAMP.STRAT', 'ASSESSMENT', 0.74, 400, 'Stratified sampling assessment — 74%'],
    ['STAT.SAMP.CLUSTER', 'COURSE_COMPLETION', 0.7, 420, 'Completed: Stratified and Multistage Sampling Designs (NSSTA)'],
    ['STAT.SURV.QUEST', 'ATTESTATION', 0.7, 300, 'Supervisor attestation: independently reviewed HCES schedule translations'],
    ['STAT.FOUND.DESC', 'COURSE_COMPLETION', 0.9, 1800, 'Completed: Foundations of Statistics for Government Officials (iGOT)'],
    ['STAT.FOUND.PROB', 'PRIOR_TRAINING', 0.75, 3000, 'M.Sc. Statistics coursework — probability and distribution theory'],
    ['STAT.FOUND.INFER', 'PRIOR_TRAINING', 0.7, 3000, 'M.Sc. Statistics coursework — inference'],
    ['TECH.SPREAD', 'ASSESSMENT', 0.86, 210, 'Spreadsheet analysis assessment — 86%'],
    ['TECH.SPREAD', 'PROJECT_ARTIFACT', 0.8, 120, 'Built the division monthly returns workbook now used by 11 offices'],
    ['TECH.SPREAD', 'ASSESSMENT', 0.9, 40, 'Spreadsheet analysis reassessment — 90%'],
    ['STAT.SAMP.STRAT', 'PROJECT_ARTIFACT', 0.72, 310, 'Implemented the stratum allocation for the district HCES sub-sample'],
    ['GOVN.CONFID', 'ASSESSMENT', 0.78, 190, 'Confidentiality and disclosure control assessment — 78%'],
    ['BEHV.LEAD', 'ATTESTATION', 0.8, 85, 'Supervisor attestation: runs the field team independently'],
    ['BEHV.LEAD', 'COURSE_COMPLETION', 0.76, 330, 'Completed: Leading Teams in Government (iGOT)'],
    // the decay story — Python learned once, three years ago, never used since
    ['TECH.PY.BASIC', 'COURSE_COMPLETION', 0.82, 1080, 'Completed: Python Programming Foundations (iGOT)'],
    ['TECH.PY.BASIC', 'ASSESSMENT', 0.68, 1050, 'Python fundamentals assessment — 68%'],
    // weak/absent: TECH.PY.DATA, TECH.SQL, STAT.DQ, STAT.SAMP.WEIGHT, STAT.SURV.NONRESP
    ['STAT.SAMP.WEIGHT', 'SELF_DECLARATION', 0.6, 200, 'Self-declared: familiar with design weights'],
    ['STAT.DQ', 'COURSE_COMPLETION', 0.6, 900, 'Completed: Data Quality Assurance Framework (iGOT)'],
    ['GOVN.PRIVACY', 'COURSE_COMPLETION', 0.9, 150, 'Completed: DPDP Act 2023 (iGOT) — mandatory module'],
    ['GOVN.CONFID', 'COURSE_COMPLETION', 0.8, 500, 'Completed: Statistical Confidentiality and Disclosure Control (NSSTA)'],
    ['GOVN.CYBER', 'COURSE_COMPLETION', 0.85, 120, 'Completed: Cyber Security Awareness (iGOT) — mandatory module'],
    ['BEHV.COMM', 'ATTESTATION', 0.75, 240, 'Supervisor attestation: drafting quality consistently good'],
    ['BEHV.LEAD', 'PROJECT_ARTIFACT', 0.72, 180, 'Led a 9-enumerator team through the HCES sub-round'],
    ['BEHV.PRESENT', 'SELF_DECLARATION', 0.5, 400, 'Self-declared: presents division results at monthly review'],
  ];
  for (const [competencyId, kind, quality, ago, summary] of anithaStory) {
    const c = courseFor(competencyId);
    evidence.push({
      officialId: 'off_anitha', competencyId, kind, quality, occurredAt: daysAgo(ago),
      sourceType: kind === 'COURSE_COMPLETION' ? (c?.[2] === 'iGOT' ? 'igot' : 'nssta') : kind.toLowerCase(),
      sourceRef: kind === 'COURSE_COMPLETION' ? (c?.[0] ?? 'unknown') : `seed:${competencyId}:${ago}`,
      summary,
    });
  }

  // trainer + admin: competent in their own roles
  for (const [officialId, roleId] of [['off_rajesh', 'ROLE.TRAINER'], ['off_admin', 'ROLE.DD']] as const) {
    const role = ROLES.find((r) => r.id === roleId)!;
    for (const [competencyId, target] of role.requires) {
      evidence.push({
        officialId, competencyId, kind: 'ASSESSMENT', quality: 0.78 + rand() * 0.18,
        occurredAt: daysAgo(60 + Math.floor(rand() * 500)),
        sourceType: 'assessment', sourceRef: `seed:${officialId}:${competencyId}`,
        summary: `Competency assessment at L${target} — passed`,
      });
      evidence.push({
        officialId, competencyId, kind: 'COURSE_COMPLETION', quality: 0.7 + rand() * 0.25,
        occurredAt: daysAgo(300 + Math.floor(rand() * 900)),
        sourceType: 'nssta', sourceRef: courseFor(competencyId)?.[0] ?? 'seed',
        summary: `Completed: ${courseFor(competencyId)?.[1] ?? 'departmental training'}`,
      });
    }
  }

  // cohort: partial coverage of their own role, with deliberate systemic holes
  // (TECH.* is thin everywhere — that is the finding the admin dashboard surfaces)
  const KINDS = ['COURSE_COMPLETION', 'ASSESSMENT', 'ATTESTATION', 'PRIOR_TRAINING', 'SELF_DECLARATION'] as const;
  for (const { id, roleProfileId } of cohort) {
    const role = ROLES.find((r) => r.id === roleProfileId)!;
    for (const [competencyId] of role.requires) {
      const isTech = competencyId.startsWith('TECH.');
      const isAdvancedTech = /TECH\.(ML|BIGDATA|CLOUD|PY\.DATA|SQL)/.test(competencyId);
      // coverage probability — the systemic gap is engineered here, not faked in the UI
      const p = isAdvancedTech ? 0.22 : isTech ? 0.55 : 0.8;
      const n = rand() < p ? 1 + Math.floor(rand() * 3) : 0;
      for (let k = 0; k < n; k++) {
        const kind = rand() < 0.35 ? 'ASSESSMENT' : pick(KINDS);
        evidence.push({
          officialId: id, competencyId, kind, quality: 0.45 + rand() * 0.5,
          occurredAt: daysAgo(30 + Math.floor(rand() * 1600)),
          sourceType: kind === 'COURSE_COMPLETION' ? 'igot' : 'seed',
          sourceRef: courseFor(competencyId)?.[0] ?? `seed:${id}:${competencyId}:${k}`,
          summary: kind === 'COURSE_COMPLETION'
            ? `Completed: ${courseFor(competencyId)?.[1] ?? 'departmental training'}`
            : `${kind.replace('_', ' ').toLowerCase()} recorded for ${competencyId}`,
        });
      }
    }
  }

  // chunked insert — createMany with 3k+ rows in one statement is fine but noisy
  for (let i = 0; i < evidence.length; i += 500) {
    await prisma.evidence.createMany({ data: evidence.slice(i, i + 500) });
  }

  const counts = {
    competencies: await prisma.competency.count(),
    edges: await prisma.competencyEdge.count(),
    roles: await prisma.roleProfile.count(),
    courses: await prisma.course.count(),
    officials: await prisma.official.count(),
    evidence: await prisma.evidence.count(),
  };
  console.log('✓ seeded', counts);
  console.log('\n  demo logins (password: demo1234)');
  console.log('    anitha@mospi.gov.in   LEARNER     — the demo persona');
  console.log('    rajesh@nssta.gov.in   MANAGER     — trainer: upload + review');
  console.log('    admin@mospi.gov.in    SUPER_ADMIN — workforce dashboard, all departments');
  console.log('    dept@ap.gov.in        DEPT_ADMIN  — scoped to AP state DES only');
  console.log('    auditor@cag.gov.in    AUDITOR     — read-only, everything\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
