import { prisma } from '../../lib/db.js';
import { gapsFor } from '../competency/service.js';

/**
 * Assessment → evidence → score. This is step 8→9→10 of the demo, and the only
 * place in the system that writes ASSESSMENT evidence.
 *
 * One rule governs everything here: an item only counts towards the competency
 * it was generated against, and only if a trainer approved it. An unreviewed
 * question can never move a competency record.
 */

export interface QuizQuestion {
  id: string; ordinal: number; stem: string; options: string[];
  competencyId: string; competencyName: string; bloom: string; difficulty: string;
}

export async function startSession(
  officialId: string,
  opts: { competencyIds?: string[]; count?: number; title?: string } = {},
): Promise<{ sessionId: string; title: string; questions: QuizQuestion[] }> {
  const count = Math.min(25, Math.max(3, opts.count ?? 5));

  let competencyIds = opts.competencyIds ?? [];
  if (competencyIds.length === 0) {
    // default: the three most severe gaps, so the diagnostic is aimed at
    // what the official actually needs rather than at whatever is in the bank
    const gaps = await gapsFor(officialId);
    competencyIds = gaps.slice(0, 3).map((g) => g.competencyId);
  }

  let pool = await prisma.questionItem.findMany({
    where: { status: 'APPROVED', competencyId: { in: competencyIds } },
    include: { competency: { select: { nameEn: true } } },
    orderBy: { createdAt: 'desc' },
    take: count * 4,
  });

  // fall back to any approved item rather than showing an empty quiz
  if (pool.length < count) {
    const extra = await prisma.questionItem.findMany({
      where: { status: 'APPROVED', id: { notIn: pool.map((p) => p.id) } },
      include: { competency: { select: { nameEn: true } } },
      orderBy: { createdAt: 'desc' },
      take: count * 2,
    });
    pool = [...pool, ...extra];
  }
  if (pool.length === 0) {
    throw new Error('No approved questions are available yet. Generate and approve some in the Trainer workspace first.');
  }

  // easy → hard, so a struggling learner is not hit with the hardest item first
  const rank = { EASY: 0, MEDIUM: 1, HARD: 2 } as Record<string, number>;
  const chosen = pool
    .slice(0, count)
    .sort((a, b) => (rank[a.difficulty] ?? 1) - (rank[b.difficulty] ?? 1));

  const names = await prisma.competency.findMany({
    where: { id: { in: [...new Set(chosen.map((c) => c.competencyId))] } },
    select: { nameEn: true },
  });
  const title = opts.title ?? `Diagnostic — ${names.map((n) => n.nameEn).slice(0, 3).join(', ')}`;

  const session = await prisma.quizSession.create({
    data: {
      officialId, title,
      competencyIds: [...new Set(chosen.map((c) => c.competencyId))],
      responses: { create: chosen.map((q, i) => ({ questionId: q.id, ordinal: i + 1 })) },
    },
  });

  return {
    sessionId: session.id,
    title,
    questions: chosen.map((q, i) => ({
      id: q.id, ordinal: i + 1, stem: q.stem, options: q.options,
      competencyId: q.competencyId, competencyName: q.competency.nameEn,
      bloom: q.bloom, difficulty: q.difficulty,
    })),
  };
}

export interface AnswerFeedback {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  rationale: string;
  distractorReason: string | null;
  citation: { page: number; headingPath: string; quote: string; documentTitle: string };
}

export async function answer(sessionId: string, questionId: string, selectedIndex: number): Promise<AnswerFeedback> {
  const q = await prisma.questionItem.findUniqueOrThrow({
    where: { id: questionId },
    include: { document: { select: { title: true } } },
  });
  const correct = selectedIndex === q.correctIndex;
  await prisma.itemResponse.update({
    where: { sessionId_questionId: { sessionId, questionId } },
    data: { selectedIndex, correct, answeredAt: new Date() },
  });
  return {
    questionId,
    correct,
    correctIndex: q.correctIndex,
    rationale: q.rationaleCorrect,
    distractorReason: correct ? null : (q.distractorReasons[Math.max(0, selectedIndex - (selectedIndex > q.correctIndex ? 1 : 0))] ?? null),
    citation: {
      page: q.page, headingPath: q.headingPath, quote: q.sourceQuote,
      documentTitle: q.document.title,
    },
  };
}

export interface SubmitResult {
  sessionId: string;
  scorePct: number;
  perCompetency: { competencyId: string; nameEn: string; correct: number; total: number; quality: number; evidenceId: string }[];
}

/**
 * Submitting writes one ASSESSMENT evidence row per competency covered, with
 * quality = proportion correct. It is an INSERT — the ledger has no other verb.
 */
export async function submit(sessionId: string): Promise<SubmitResult> {
  const session = await prisma.quizSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { responses: { include: { question: { include: { competency: true } } } } },
  });
  if (session.submittedAt) throw new Error('This session has already been submitted.');

  const answered = session.responses.filter((r) => r.selectedIndex !== null);
  const totalCorrect = answered.filter((r) => r.correct).length;
  const scorePct = answered.length ? (100 * totalCorrect) / answered.length : 0;

  const byComp = new Map<string, { nameEn: string; correct: number; total: number }>();
  for (const r of answered) {
    const cid = r.question.competencyId;
    const e = byComp.get(cid) ?? { nameEn: r.question.competency.nameEn, correct: 0, total: 0 };
    e.total += 1;
    if (r.correct) e.correct += 1;
    byComp.set(cid, e);
  }

  const perCompetency: SubmitResult['perCompetency'] = [];
  for (const [competencyId, v] of byComp) {
    const quality = v.total ? v.correct / v.total : 0;
    const ev = await prisma.evidence.create({
      data: {
        officialId: session.officialId,
        competencyId,
        kind: 'ASSESSMENT',
        quality,
        occurredAt: new Date(),
        sourceType: 'quiz',
        sourceRef: session.id,
        summary: `${session.title} — ${v.correct}/${v.total} correct (${Math.round(quality * 100)}%)`,
        payload: { sessionId: session.id, correct: v.correct, total: v.total },
      },
    });
    perCompetency.push({ competencyId, nameEn: v.nameEn, correct: v.correct, total: v.total, quality, evidenceId: ev.id });
  }

  await prisma.quizSession.update({
    where: { id: sessionId },
    data: { submittedAt: new Date(), scorePct },
  });

  return { sessionId, scorePct, perCompetency };
}
