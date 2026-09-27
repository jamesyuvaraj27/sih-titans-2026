import { prisma } from '../../lib/db.js';

export interface TrainerOverview {
  documentsCount: number;
  totalChunksCount: number;
  questionsTotal: number;
  questionsCandidate: number;
  questionsApproved: number;
  questionsRejected: number;
  activeLearnersCount: number;
  recentSessions: {
    id: string;
    officialName: string;
    startedAt: string;
    submittedAt: string | null;
    scorePct: number | null;
  }[];
}

export async function getTrainerOverview(): Promise<TrainerOverview> {
  const [documentsCount, chunksCount, questions, learnersCount, recentSessions] = await Promise.all([
    prisma.document.count(),
    prisma.chunk.count(),
    prisma.questionItem.findMany({ select: { status: true } }),
    prisma.official.count({ where: { role: 'LEARNER' } }),
    prisma.quizSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: {
        official: { select: { nameEn: true } },
      },
    }),
  ]);

  const counts = {
    CANDIDATE: 0,
    APPROVED: 0,
    REJECTED: 0,
  };

  for (const q of questions) {
    if (q.status in counts) {
      counts[q.status as keyof typeof counts]++;
    }
  }

  return {
    documentsCount,
    totalChunksCount: chunksCount,
    questionsTotal: questions.length,
    questionsCandidate: counts.CANDIDATE,
    questionsApproved: counts.APPROVED,
    questionsRejected: counts.REJECTED,
    activeLearnersCount: learnersCount,
    recentSessions: recentSessions.map((s) => ({
      id: s.id,
      officialName: s.official?.nameEn || 'Official',
      startedAt: s.startedAt.toISOString(),
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      scorePct: s.scorePct,
    })),
  };
}
