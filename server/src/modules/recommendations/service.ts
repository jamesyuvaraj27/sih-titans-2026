import { prisma } from '../../lib/db.js';
import { gapsFor, scoresFor } from '../competency/service.js';
import { runWithAiFallback, queryGemini, type AiExecutionResult } from '../../lib/aiFallback.js';

export interface RecommendedCourseItem {
  id: string;
  name: string;
  provider: string;
  durationMins: number;
  level: string;
  url: string | null;
  completionRate: number;
  addressesCompetency: string;
  competencyId: string;
  severity: number;
  whyRecommended: string;
}

export interface RecommendedLabItem {
  labId: string;
  title: string;
  difficulty: string;
  estimatedMinutes: number;
  addressesConcept: string;
  route: string;
  whyRecommended: string;
}

export interface RecommendationsPayload {
  learner: {
    officialId: string;
    name: string;
    currentRole: string;
    desiredRole: string;
    skills: string[];
  };
  topGapsSummary: {
    totalGaps: number;
    topGapNames: string[];
  };
  recommendedCourses: RecommendedCourseItem[];
  recommendedLabs: RecommendedLabItem[];
  overallRationale: string;
  actionPlan: string[];
}

/**
 * Deterministic recommendation engine that connects real learner gaps
 * to actual database courses and relevant hands-on virtual labs.
 */
export async function computeDeterministicRecommendations(
  officialId: string,
): Promise<RecommendationsPayload> {
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
  const skillsList: string[] = Array.isArray(quals.skills) ? quals.skills : [];

  const [gaps, scores] = await Promise.all([
    gapsFor(officialId),
    scoresFor(officialId),
  ]);

  const topGaps = gaps.slice(0, 5);
  const gapIds = topGaps.map((g) => g.competencyId);

  // Query real courses linked to these exact gaps
  const courseLinks = await prisma.courseCompetency.findMany({
    where: { competencyId: { in: gapIds } },
    include: { course: true, competency: true },
    take: 10,
  });

  // Deduplicate courses and map rationale
  const seenCourses = new Set<string>();
  const recommendedCourses: RecommendedCourseItem[] = [];

  for (const link of courseLinks) {
    if (seenCourses.has(link.courseId)) continue;
    seenCourses.add(link.courseId);

    const matchingGap = topGaps.find((g) => g.competencyId === link.competencyId);

    recommendedCourses.push({
      id: link.course.id,
      name: link.course.name,
      provider: link.course.provider,
      durationMins: link.course.durationMins,
      level: link.course.level,
      url: link.course.url,
      completionRate: link.course.completionRate,
      addressesCompetency: link.competency.nameEn,
      competencyId: link.competency.id,
      severity: matchingGap?.severity ?? 1,
      whyRecommended: `Directly bridges your priority competency gap in "${link.competency.nameEn}" (Target: Level ${link.targetLevel}).`,
    });

    if (recommendedCourses.length >= 4) break;
  }

  // If few specific courses were found for top gaps, grab general high-quality courses
  if (recommendedCourses.length < 2) {
    const generalCourses = await prisma.course.findMany({
      take: 3,
      include: { competencies: { include: { competency: true } } },
    });
    for (const c of generalCourses) {
      if (seenCourses.has(c.id)) continue;
      seenCourses.add(c.id);
      recommendedCourses.push({
        id: c.id,
        name: c.name,
        provider: c.provider,
        durationMins: c.durationMins,
        level: c.level,
        url: c.url,
        completionRate: c.completionRate,
        addressesCompetency: c.competencies[0]?.competency.nameEn || 'Core Methodology',
        competencyId: c.competencies[0]?.competencyId || 'GENERAL',
        severity: 2,
        whyRecommended: 'Foundational official statistical methodology curriculum.',
      });
      if (recommendedCourses.length >= 3) break;
    }
  }

  // Map to relevant Virtual Labs
  const recommendedLabs: RecommendedLabItem[] = [
    {
      labId: 'mean-median-mode',
      title: 'Mean, Median & Mode Lab',
      difficulty: 'Beginner',
      estimatedMinutes: 15,
      addressesConcept: 'Central Tendency & Outlier Resistance',
      route: '/learner/virtual-lab?lab=mean-median-mode',
      whyRecommended: 'Hands-on practice understanding how extreme values distort arithmetic averages in survey data.',
    },
    {
      labId: 'standard-deviation',
      title: 'Standard Deviation Lab',
      difficulty: 'Intermediate',
      estimatedMinutes: 20,
      addressesConcept: 'Variance, Degrees of Freedom & Bessel Correction',
      route: '/learner/virtual-lab?lab=standard-deviation',
      whyRecommended: 'Essential for understanding sample versus population dispersion in national sample surveys.',
    },
    {
      labId: 'data-visualization',
      title: 'Data Visualization Lab',
      difficulty: 'Beginner',
      estimatedMinutes: 15,
      addressesConcept: 'Chart Fit & Visual Presentation',
      route: '/learner/virtual-lab?lab=data-visualization',
      whyRecommended: 'Learn to select appropriate visualizations for continuous indicators versus categorical returns.',
    },
  ];

  const topGapNames = topGaps.map((g) => g.nameEn);
  const skillsKnownStr = skillsList.length > 0 ? skillsList.join(', ') : 'Software engineering';

  const deterministicRationale = `Because your career pathway is transitioning from ${currentRole} to ${desiredRole}, closing your verified gaps in ${topGapNames.slice(0, 2).join(' and ')} is critical. Your existing technical foundation in ${skillsKnownStr} gives you a head start for automated data analysis, while the recommended courses and virtual lab exercises provide the necessary official statistical grounding.`;

  const actionPlan = [
    `Complete catalog course: "${recommendedCourses[0]?.name || 'Statistical Methodology'}"`,
    `Execute experiment in "${recommendedLabs[0]?.title}" to verify practical application`,
    `Take the Competency Assessment to record evidence and update your official score ledger`,
  ];

  return {
    learner: {
      officialId,
      name: official.nameEn,
      currentRole,
      desiredRole,
      skills: skillsList,
    },
    topGapsSummary: {
      totalGaps: gaps.length,
      topGapNames,
    },
    recommendedCourses,
    recommendedLabs,
    overallRationale: deterministicRationale,
    actionPlan,
  };
}

/**
 * Service orchestrator that produces personalized learning recommendations
 * with AI enhancement and deterministic fallback.
 */
export async function getPersonalizedRecommendations(
  officialId: string,
  options: { simulateFallback?: boolean } = {},
): Promise<AiExecutionResult<RecommendationsPayload>> {
  const taskName = `recommendations:${officialId}`;

  return runWithAiFallback<RecommendationsPayload>(
    taskName,
    async () => {
      // 1. Compute verified deterministic recommendation facts
      const deterministicData = await computeDeterministicRecommendations(officialId);

      // 2. Query Gemini for a natural-language contextual rationale
      const prompt = `You are a personalized learning advisor for an officer in India's Official Statistical System (STATINTEL).
Explain in 2 to 3 sentences why this tailored curriculum is recommended for this learner.

Learner Profile:
- Name: ${deterministicData.learner.name}
- Current Job Role: ${deterministicData.learner.currentRole}
- Target Next Role: ${deterministicData.learner.desiredRole}
- Known Skills: ${deterministicData.learner.skills.join(', ')}
- Priority Gaps: ${deterministicData.topGapsSummary.topGapNames.slice(0, 3).join(', ')}

Recommended Courses:
${deterministicData.recommendedCourses.map((c) => `- ${c.name} (${c.provider}, ${c.level})`).join('\n')}

Recommended Virtual Labs:
${deterministicData.recommendedLabs.map((l) => `- ${l.title} (${l.addressesConcept})`).join('\n')}

Instructions:
- Connect their current technical skillset with their target role.
- Ground your rationale strictly on the actual recommended items provided.
- Keep the tone encouraging, professional, and practical.`;

      const systemInstruction = `You are an encouraging, precise learning path mentor for government statistics professionals.`;
      const aiRationale = await queryGemini(prompt, systemInstruction);

      return {
        ...deterministicData,
        overallRationale: aiRationale.trim(),
      };
    },
    async () => {
      // Deterministic fallback
      return computeDeterministicRecommendations(officialId);
    },
    { simulateFallback: options.simulateFallback, timeoutMs: 7000 },
  );
}
