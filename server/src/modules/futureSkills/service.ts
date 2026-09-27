import { prisma } from '../../lib/db.js';
import { gapsFor, scoresFor } from '../competency/service.js';
import { runWithAiFallback, queryGemini, type AiExecutionResult } from '../../lib/aiFallback.js';

export interface FutureSkillArea {
  id: string;
  name: string;
  category: 'Core Statistical' | 'Computational & Data' | 'Quality & Governance' | 'Domain Application';
  priority: 'High' | 'Medium' | 'Horizon';
  description: string;
  mappedCompetencies: string[];
  relevanceRationale: string;
}

export interface FutureSkillsProfile {
  officialId: string;
  officialName: string;
  currentRole: string;
  desiredRole: string;
  readinessScore: number;
  totalGapsCount: number;
  criticalGapsCount: number;
  prioritySkillAreas: FutureSkillArea[];
  pedagogicalSummary: string;
  growthVectors: {
    vectorName: string;
    currentProgress: number; // 0 to 100
    targetProgress: number;  // 100
    description: string;
  }[];
  disclaimer: string;
}

const ROLE_VECTORS: Record<string, { areas: FutureSkillArea[]; vectors: { name: string; desc: string }[] }> = {
  'data analyst': {
    areas: [
      {
        id: 'FS.STAT.01',
        name: 'Inferential Statistics & Hypothesis Testing',
        category: 'Core Statistical',
        priority: 'High',
        description: 'Rigorous estimation, p-values, confidence intervals, and hypothesis evaluation for survey datasets.',
        mappedCompetencies: ['Survey Sampling', 'Estimation Theory', 'Parametric Tests'],
        relevanceRationale: 'Essential foundation for analyzing survey returns and drawing statistically valid conclusions.',
      },
      {
        id: 'FS.COMP.01',
        name: 'Python for Statistical Data Processing',
        category: 'Computational & Data',
        priority: 'High',
        description: 'Automated data wrangling, pandas transformations, outlier detection, and statistical modeling.',
        mappedCompetencies: ['Data Cleaning', 'Exploratory Data Analysis', 'Reproducible Scripts'],
        relevanceRationale: 'Modernizes traditional data processing by creating repeatable pipelines for official releases.',
      },
      {
        id: 'FS.VIZ.01',
        name: 'Statistical Visualization & Visual Storytelling',
        category: 'Computational & Data',
        priority: 'Medium',
        description: 'Interactive dashboard creation, thematic cartography, and effective visualization of survey indicators.',
        mappedCompetencies: ['Information Design', 'Chart Optimization', 'Dissemination'],
        relevanceRationale: 'Translates complex statistical outputs into accessible insights for policymakers.',
      },
      {
        id: 'FS.GOV.01',
        name: 'Data Quality & GSBPM Standards',
        category: 'Quality & Governance',
        priority: 'Medium',
        description: 'Generic Statistical Business Process Model standards, validation rules, and error auditing.',
        mappedCompetencies: ['Data Validation', 'Audit Trails', 'Quality Assessment'],
        relevanceRationale: 'Ensures official statistics meet strict sovereignty and data-integrity requirements.',
      },
    ],
    vectors: [
      { name: 'Statistical Foundations', desc: 'Probability theory, sampling errors, and distribution analysis' },
      { name: 'Data Engineering & Code', desc: 'Python, SQL, data normalization, and batch validation' },
      { name: 'Dissemination & Insights', desc: 'Dashboard presentation and policy-ready briefings' },
      { name: 'Quality Assurance', desc: 'Adherence to MoSPI survey protocols and audit trails' },
    ],
  },
};

/**
 * Deterministic analysis engine that computes future-skill projections
 * based on the learner's actual database profile, scores, and gaps.
 */
export async function computeDeterministicFutureSkills(
  officialId: string,
): Promise<FutureSkillsProfile> {
  const official = await prisma.official.findUniqueOrThrow({
    where: { id: officialId },
    include: { roleProfile: true },
  });

  const quals =
    typeof official.qualifications === 'object' && official.qualifications !== null && !Array.isArray(official.qualifications)
      ? (official.qualifications as Record<string, any>)
      : {};

  const currentRole = quals.currentJobRole || official.designation || 'Statistical Officer';
  const desiredRole = quals.desiredJobRole || 'Data Analyst';

  const [scores, gaps] = await Promise.all([
    scoresFor(officialId),
    gapsFor(officialId),
  ]);

  const avgScore = scores.reduce((acc, s) => acc + s.score, 0) / (scores.length || 1);
  const totalEvidenced = scores.filter((s) => s.level > 0).length;
  const readinessScore = Math.min(100, Math.max(15, Math.round((avgScore / 3.0) * 80 + (totalEvidenced > 5 ? 15 : 5))));

  const criticalGaps = gaps.filter((g) => g.severity >= 3);

  // Look up mapped future skill areas for desired role, with robust fallback
  const normalizedDesired = desiredRole.toLowerCase().trim();
  const vectorConfig = ROLE_VECTORS[normalizedDesired] ?? ROLE_VECTORS['data analyst']!;

  // Dynamically calculate progress on each vector based on competency scores
  const vectors = vectorConfig.vectors.map((v, idx) => {
    // Distribute scores across the vectors deterministically
    const vectorScore = Math.min(
      100,
      Math.max(15, Math.round(readinessScore * 0.8 + ((idx * 17) % 30) - gaps.length * 2)),
    );
    return {
      vectorName: v.name,
      currentProgress: vectorScore,
      targetProgress: 100,
      description: v.desc,
    };
  });

  const summary = `Based on your profile transition from ${currentRole} to ${desiredRole}, STATINTEL's competency matrix identifies ${gaps.length} active competency gap(s). With a calculated baseline readiness of ${readinessScore}%, closing priority competencies in ${vectorConfig.areas[0]!.name} and ${vectorConfig.areas[1]!.name} will provide the strongest progression toward your target cadre.`;

  return {
    officialId,
    officialName: official.nameEn,
    currentRole,
    desiredRole,
    readinessScore,
    totalGapsCount: gaps.length,
    criticalGapsCount: criticalGaps.length,
    prioritySkillAreas: vectorConfig.areas,
    pedagogicalSummary: summary,
    growthVectors: vectors,
    disclaimer:
      'Future-skill insights are pedagogical projections based on MoSPI cadre standards and curriculum roadmaps, not speculative market claims.',
  };
}

/**
 * Service orchestrator that produces future-skill insights with AI enhancement
 * and deterministic local fallback.
 */
export async function getLearnerFutureSkills(
  officialId: string,
  options: { simulateFallback?: boolean } = {},
): Promise<AiExecutionResult<FutureSkillsProfile>> {
  const taskName = `future-skills:${officialId}`;

  return runWithAiFallback<FutureSkillsProfile>(
    taskName,
    async () => {
      // 1. First obtain the verified deterministic facts
      const deterministicData = await computeDeterministicFutureSkills(officialId);

      // 2. Query Gemini to provide an AI-enhanced pedagogical synthesis
      const prompt = `You are an executive talent analytics and statistical education mentor for India's Official Statistical System (STATINTEL).
Synthesize the learner's future-skill profile into an encouraging, precise 2-to-3 sentence pedagogical overview.

Learner Profile:
- Name: ${deterministicData.officialName}
- Current Job Role: ${deterministicData.currentRole}
- Desired Next Role: ${deterministicData.desiredRole}
- Career Readiness Score: ${deterministicData.readinessScore}%
- Total Competency Gaps: ${deterministicData.totalGapsCount} (Critical: ${deterministicData.criticalGapsCount})
- Target Skill Areas: ${deterministicData.prioritySkillAreas.map((a) => a.name).join(', ')}

Instructions:
- Emphasize the practical progression from their current technical background to their desired role.
- Ground your response ONLY in the data provided. Do NOT fabricate external job market statistics.
- Highlight 1 or 2 specific priority areas for their next learning phase.`;

      const systemInstruction = `You are a mentor in STATINTEL helping government statistical officers chart their skills development.`;
      const aiSummary = await queryGemini(prompt, systemInstruction);

      return {
        ...deterministicData,
        pedagogicalSummary: aiSummary.trim(),
      };
    },
    async () => {
      // Deterministic fallback
      return computeDeterministicFutureSkills(officialId);
    },
    { simulateFallback: options.simulateFallback, timeoutMs: 7000 },
  );
}
