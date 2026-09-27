import { prisma } from '../../lib/db.js';
import { ingestDocument, generateForDocument } from '../mcq/service.js';
import { submit } from '../quiz/service.js';
import { audit } from '../../middleware/auth.js';

export interface CreateAssignmentInput {
  title: string;
  description?: string;
  instructions?: string;
  competencyId?: string;
  courseId?: string;
  difficulty?: string;
  questionCount?: number;
  content?: string;
  file?: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  };
  isPersonal?: boolean;
  provider?: 'default' | 'mock' | 'gemini' | 'ollama';
}

/** Check for video upload/format to reject gracefully without faking video understanding */
export function isVideoFormat(mimeType: string, filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    mimeType.startsWith('video/') ||
    lower.endsWith('.mp4') ||
    lower.endsWith('.avi') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.mkv') ||
    lower.endsWith('.webm')
  );
}

/**
 * Create a new learning assignment for a Learner (personal self-directed)
 * or Trainer (curriculum-aligned).
 */
export async function createAssignment(
  creatorId: string,
  canonicalRole: 'LEARNER' | 'TRAINER' | 'ADMINISTRATOR',
  input: CreateAssignmentInput
) {
  const title = input.title.trim();
  if (!title) throw new Error('Assignment title is required');

  // Validate question count (3 to 25)
  const questionCount = Math.min(25, Math.max(3, Number(input.questionCount) || 5));

  // Check video format
  if (input.file && isVideoFormat(input.file.mimetype, input.file.originalname)) {
    throw new Error(
      'Video processing is not configured yet. Please upload PDF, PPTX, DOCX, or TXT documents or paste text directly.'
    );
  }

  // Handle learning material: direct text or uploaded file
  let docBuffer: Buffer;
  let filename: string;
  let mimeType: string;

  if (input.file) {
    docBuffer = input.file.buffer;
    filename = input.file.originalname;
    mimeType = input.file.mimetype;
  } else if (input.content && input.content.trim()) {
    const cleanContent = input.content.trim();
    if (cleanContent.length < 40) {
      throw new Error('Learning material text is too short. Please provide at least a few sentences (40+ characters).');
    }
    docBuffer = Buffer.from(cleanContent, 'utf8');
    filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.txt`;
    mimeType = 'text/plain';
  } else {
    throw new Error('Please provide learning material either by typing/pasting text or uploading a document (PDF, PPTX, DOCX, TXT).');
  }

  // Ingest document into chunks and lexical competency tags
  const ingestRes = await ingestDocument({
    buffer: docBuffer,
    filename,
    mimeType,
    title: `${title} — Material`,
    uploadedById: creatorId,
  });

  // Determine competency: user choice or top tagged competency from ingested document
  let competencyId = input.competencyId;
  if (!competencyId && ingestRes.tagged.length > 0) {
    competencyId = ingestRes.tagged[0]?.competencyId;
  }
  if (!competencyId) {
    const defaultComp = await prisma.competency.findFirst({ select: { id: true } });
    competencyId = defaultComp?.id;
  }

  const isPersonal = canonicalRole === 'LEARNER' || input.isPersonal === true;

  // Create Assignment record
  const assignment = await prisma.assignment.create({
    data: {
      title,
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      competencyId: competencyId || null,
      courseId: input.courseId || null,
      difficulty: input.difficulty || 'MEDIUM',
      questionCount,
      content: input.content?.trim() || null,
      documentId: ingestRes.documentId,
      creatorId,
      assignedToId: isPersonal ? creatorId : null,
      isPersonal,
      status: 'NOT_STARTED',
    },
    include: {
      competency: { select: { id: true, nameEn: true, area: true } },
      course: { select: { id: true, name: true, provider: true } },
      document: { select: { id: true, title: true, pages: true, filename: true } },
    },
  });

  // Generate grounded AI MCQs for this document
  const genSummary = await generateForDocument(ingestRes.documentId, {
    target: questionCount,
    competencyIds: competencyId ? [competencyId] : undefined,
    providerOverride: input.provider === 'default' ? undefined : input.provider,
  });

  // If learner personal assignment, auto-approve the candidate questions for instant attempt
  if (isPersonal) {
    await prisma.questionItem.updateMany({
      where: { documentId: ingestRes.documentId, status: 'CANDIDATE' },
      data: { status: 'APPROVED', reviewedById: creatorId },
    });
  }

  // Fetch the generated questions for preview
  const questions = await prisma.questionItem.findMany({
    where: { documentId: ingestRes.documentId },
    select: {
      id: true,
      stem: true,
      options: true,
      correctIndex: true,
      rationaleCorrect: true,
      distractorReasons: true,
      bloom: true,
      difficulty: true,
      status: true,
      sourceQuote: true,
      page: true,
      headingPath: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  audit(creatorId, 'assignment.create', 'Assignment', assignment.id, {
    isPersonal,
    questionCount,
    generated: genSummary.candidates,
    accepted: genSummary.accepted,
  });

  return {
    assignment,
    generationSummary: genSummary,
    questions,
  };
}

/**
 * Publish a Trainer assignment to specific learners or all learners
 */
export async function publishTrainerAssignment(
  trainerId: string,
  assignmentId: string,
  opts: { assignTo: 'all' | string[]; feedback?: string }
) {
  let master = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { document: true },
  });

  if (!master) {
    const doc = await prisma.document.findUnique({
      where: { id: assignmentId },
      include: { chunks: { include: { competencies: true } } },
    });
    if (doc) {
      master = await prisma.assignment.findFirst({
        where: { documentId: doc.id, isPersonal: false },
        include: { document: true },
      });
      if (!master) {
        const primaryCompId = doc.chunks.flatMap((c) => c.competencies).map((cc) => cc.competencyId)[0];
        const approvedCount = await prisma.questionItem.count({
          where: { documentId: doc.id, status: 'APPROVED' },
        });
        master = await prisma.assignment.create({
          data: {
            title: `${doc.title} Assessment`,
            description: `Curriculum-grounded assessment module for ${doc.title}`,
            instructions: 'Review official NSSTA guidance and complete all questions.',
            competencyId: primaryCompId,
            questionCount: Math.max(4, Math.min(10, approvedCount || 5)),
            documentId: doc.id,
            creatorId: trainerId,
            isPersonal: false,
            status: 'NOT_STARTED',
          },
          include: { document: true },
        });
      }
    }
  }

  if (!master) {
    throw new Error('Assignment or assessment document not found');
  }

  if (master.creatorId !== trainerId && master.isPersonal) {
    throw new Error('Not authorized to publish this personal assignment');
  }

  // Ensure candidate questions for this document are approved
  if (master.documentId) {
    await prisma.questionItem.updateMany({
      where: { documentId: master.documentId, status: 'CANDIDATE' },
      data: { status: 'APPROVED', reviewedById: trainerId },
    });
  }

  // Determine assignees
  let targetOfficialIds: string[] = [];
  if (opts.assignTo === 'all') {
    const learners = await prisma.official.findMany({
      where: { role: 'LEARNER' },
      select: { id: true },
    });
    targetOfficialIds = learners.map((l) => l.id);
  } else if (Array.isArray(opts.assignTo)) {
    targetOfficialIds = opts.assignTo;
  }

  if (targetOfficialIds.length === 0) {
    throw new Error('No learners selected for assignment');
  }

  let createdCount = 0;
  for (const learnerId of targetOfficialIds) {
    const existing = await prisma.assignment.findFirst({
      where: {
        documentId: master.documentId,
        assignedToId: learnerId,
        isPersonal: false,
      },
    });

    if (!existing) {
      await prisma.assignment.create({
        data: {
          title: master.title,
          description: master.description,
          instructions: master.instructions,
          competencyId: master.competencyId,
          courseId: master.courseId,
          difficulty: master.difficulty,
          questionCount: master.questionCount,
          content: master.content,
          documentId: master.documentId,
          creatorId: trainerId,
          assignedToId: learnerId,
          isPersonal: false,
          status: 'NOT_STARTED',
        },
      });
      createdCount++;
    }
  }

  // Mark master as published
  await prisma.assignment.update({
    where: { id: master.id },
    data: { status: 'PUBLISHED' as any },
  });

  audit(trainerId, 'assignment.publish', 'Assignment', master.id, {
    assignedToCount: targetOfficialIds.length,
    newAssignmentsCreated: createdCount,
  });

  return {
    assignmentId: master.id,
    assignedCount: targetOfficialIds.length,
    newAssignmentsCreated: createdCount,
  };
}

/**
 * Start a Quiz session for an Assignment
 */
export async function startAssignmentSession(officialId: string, assignmentId: string) {
  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      competency: { select: { id: true, nameEn: true } },
      document: true,
    },
  });

  // RBAC check: only assignee or creator can take this quiz
  if (assignment.assignedToId !== officialId && assignment.creatorId !== officialId) {
    const err: any = new Error('Not authorized to attempt this assignment quiz');
    err.status = 403;
    throw err;
  }

  if (!assignment.documentId) {
    const err: any = new Error('No learning material or questions found for this assignment');
    err.status = 400;
    throw err;
  }

  // Find questions generated for this document
  let pool = await prisma.questionItem.findMany({
    where: {
      documentId: assignment.documentId,
      status: 'APPROVED',
    },
    include: { competency: { select: { nameEn: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // If approved pool is small, also include candidate items from this exact document
  if (pool.length < assignment.questionCount) {
    const candidates = await prisma.questionItem.findMany({
      where: {
        documentId: assignment.documentId,
        id: { notIn: pool.map((p) => p.id) },
      },
      include: { competency: { select: { nameEn: true } } },
      take: assignment.questionCount - pool.length,
    });
    // Auto-approve candidates for this session
    if (candidates.length > 0) {
      await prisma.questionItem.updateMany({
        where: { id: { in: candidates.map((c) => c.id) } },
        data: { status: 'APPROVED', reviewedById: officialId },
      });
      pool = [...pool, ...candidates];
    }
  }

  if (pool.length === 0) {
    throw new Error('No questions have been generated for this assignment yet. Please generate questions first.');
  }

  const chosen = pool.slice(0, assignment.questionCount);
  const title = `Assignment: ${assignment.title}`;

  const session = await prisma.quizSession.create({
    data: {
      officialId,
      title,
      competencyIds: assignment.competencyId ? [assignment.competencyId] : [],
      responses: {
        create: chosen.map((q, i) => ({ questionId: q.id, ordinal: i + 1 })),
      },
    },
  });

  // Link quiz session to assignment and update status
  await prisma.assignment.update({
    where: { id: assignment.id },
    data: {
      quizSessionId: session.id,
      status: 'IN_PROGRESS',
    },
  });

  audit(officialId, 'assignment.start_quiz', 'Assignment', assignment.id, { sessionId: session.id });

  return {
    assignmentId: assignment.id,
    sessionId: session.id,
    title,
    questions: chosen.map((q, i) => ({
      id: q.id,
      ordinal: i + 1,
      stem: q.stem,
      options: q.options,
      competencyId: q.competencyId,
      competencyName: q.competency?.nameEn || 'General',
      bloom: q.bloom,
      difficulty: q.difficulty,
      sourceQuote: q.sourceQuote,
      page: q.page,
      headingPath: q.headingPath,
    })),
  };
}

/**
 * Submit an assignment quiz attempt and record verified assessment evidence
 */
export async function submitAssignmentQuiz(officialId: string, assignmentId: string, sessionId: string) {
  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
  });

  if (assignment.assignedToId !== officialId && assignment.creatorId !== officialId) {
    const err: any = new Error('Not authorized to submit this assignment');
    err.status = 403;
    throw err;
  }

  // Submit through existing evidence ledger pipeline
  const submitRes = await submit(sessionId);

  // Update assignment status and record final evaluation score
  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      status: 'COMPLETED',
      scorePct: submitRes.scorePct,
      submittedAt: new Date(),
    },
    include: {
      competency: { select: { id: true, nameEn: true } },
    },
  });

  audit(officialId, 'assignment.submit_quiz', 'Assignment', assignmentId, {
    sessionId,
    scorePct: submitRes.scorePct,
  });

  return {
    ...submitRes,
    assignment: updated,
  };
}

/**
 * List assignments for a Learner:
 * - Personal self-directed practice assignments
 * - Assigned trainer quizzes/tasks
 * - Completed history
 */
export async function listLearnerAssignments(learnerId: string) {
  const all = await prisma.assignment.findMany({
    where: { assignedToId: learnerId },
    include: {
      competency: { select: { id: true, nameEn: true, area: true } },
      course: { select: { id: true, name: true, provider: true } },
      document: { select: { id: true, title: true, filename: true, pages: true } },
      creator: { select: { id: true, nameEn: true, designation: true } },
      quizSession: {
        select: {
          id: true,
          startedAt: true,
          submittedAt: true,
          scorePct: true,
          responses: {
            select: {
              id: true,
              correct: true,
              selectedIndex: true,
              question: {
                select: {
                  id: true,
                  stem: true,
                  options: true,
                  correctIndex: true,
                  rationaleCorrect: true,
                  sourceQuote: true,
                  page: true,
                  headingPath: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    personal: all.filter((a) => a.isPersonal),
    assigned: all.filter((a) => !a.isPersonal),
    completed: all.filter((a) => a.status === 'COMPLETED'),
    all,
  };
}

/**
 * List assignments for a Trainer:
 * - Assignments created by the trainer
 * - Learner attempt records and evaluation scores
 */
export async function listTrainerAssignments(trainerId: string) {
  const masterList = await prisma.assignment.findMany({
    where: { creatorId: trainerId, isPersonal: false },
    include: {
      competency: { select: { id: true, nameEn: true, area: true } },
      course: { select: { id: true, name: true } },
      document: {
        select: {
          id: true,
          title: true,
          filename: true,
          _count: { select: { questions: true, chunks: true } },
        },
      },
      assignedTo: {
        select: {
          id: true,
          nameEn: true,
          designation: true,
          cadre: true,
          department: { select: { nameEn: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate high-level trainer stats
  const totalAssigned = masterList.length;
  const completed = masterList.filter((a) => a.status === 'COMPLETED');
  const avgScore =
    completed.length > 0
      ? Math.round(completed.reduce((acc, a) => acc + (a.scorePct || 0), 0) / completed.length)
      : null;

  return {
    assignments: masterList,
    stats: {
      totalAssigned,
      completedCount: completed.length,
      pendingCount: totalAssigned - completed.length,
      averageScore: avgScore,
    },
  };
}

/**
 * Provide Trainer feedback on a learner's submitted assignment
 */
export async function reviewAssignmentSubmission(
  trainerId: string,
  assignmentId: string,
  feedback: string
) {
  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
  });

  if (assignment.creatorId !== trainerId) {
    throw new Error('Not authorized to review this assignment');
  }

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      feedback: feedback.trim(),
      status: 'REVIEWED',
    },
  });

  audit(trainerId, 'assignment.review', 'Assignment', assignmentId, { feedbackLength: feedback.length });

  return updated;
}

/**
 * Get detailed assignment view (with RBAC enforcement)
 */
export async function getAssignmentDetail(
  userId: string,
  canonicalRole: 'LEARNER' | 'TRAINER' | 'ADMINISTRATOR',
  assignmentId: string
) {
  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      competency: true,
      course: true,
      document: {
        select: {
          id: true,
          title: true,
          filename: true,
          mimeType: true,
          pages: true,
          chunks: { select: { id: true, ordinal: true, text: true, page: true, headingPath: true } },
        },
      },
      creator: { select: { id: true, nameEn: true, designation: true } },
      assignedTo: { select: { id: true, nameEn: true, designation: true, cadre: true } },
      quizSession: {
        include: {
          responses: {
            include: {
              question: true,
            },
            orderBy: { ordinal: 'asc' },
          },
        },
      },
    },
  });

  // Enforce privacy & RBAC:
  // If Learner: must be creator or assignee
  if (canonicalRole === 'LEARNER') {
    if (assignment.assignedToId !== userId && assignment.creatorId !== userId) {
      throw new Error('Access denied: You do not have permission to view this assignment.');
    }
  }

  // If Trainer: must be creator, assignee, or administrator
  if (canonicalRole === 'TRAINER') {
    if (assignment.creatorId !== userId && assignment.assignedToId !== userId) {
      throw new Error('Access denied: Not your created or assigned assignment.');
    }
  }

  // Load questions belonging to this assignment's document
  const questions = assignment.documentId
    ? await prisma.questionItem.findMany({
        where: { documentId: assignment.documentId },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  return {
    assignment,
    questions,
  };
}

/**
 * Administrator Assignment Analytics across the organization
 */
export async function getAdminAssignmentAnalytics() {
  const [total, completed, inProgress, notStarted, completedItems, allAssignments] = await Promise.all([
    prisma.assignment.count(),
    prisma.assignment.count({ where: { status: 'COMPLETED' } }),
    prisma.assignment.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.assignment.count({ where: { status: 'NOT_STARTED' } }),
    prisma.assignment.findMany({
      where: { status: 'COMPLETED', scorePct: { not: null } },
      select: { scorePct: true, competencyId: true },
    }),
    prisma.assignment.findMany({
      where: { status: 'COMPLETED' },
      include: {
        assignedTo: { select: { nameEn: true, designation: true, department: { select: { nameEn: true } } } },
        competency: { select: { id: true, nameEn: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 15,
    }),
  ]);

  const avgScore =
    completedItems.length > 0
      ? Math.round(completedItems.reduce((acc, a) => acc + (a.scorePct || 0), 0) / completedItems.length)
      : 0;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Breakdown by competency
  const compMap = new Map<string, { count: number; totalScore: number }>();
  for (const c of completedItems) {
    if (!c.competencyId) continue;
    const cur = compMap.get(c.competencyId) ?? { count: 0, totalScore: 0 };
    cur.count += 1;
    cur.totalScore += c.scorePct || 0;
    compMap.set(c.competencyId, cur);
  }

  const competencies = await prisma.competency.findMany({
    where: { id: { in: Array.from(compMap.keys()) } },
    select: { id: true, nameEn: true, domain: true },
  });

  const byCompetency = competencies.map((comp) => {
    const stats = compMap.get(comp.id) ?? { count: 0, totalScore: 0 };
    return {
      competencyId: comp.id,
      nameEn: comp.nameEn,
      domain: comp.domain,
      completedCount: stats.count,
      avgScorePct: stats.count > 0 ? Math.round(stats.totalScore / stats.count) : 0,
    };
  }).sort((a, b) => b.completedCount - a.completedCount);

  return {
    totalAssignments: total,
    completedAssignments: completed,
    inProgressAssignments: inProgress,
    notStartedAssignments: notStarted,
    completionRate,
    averageScorePct: avgScore,
    byCompetency,
    recentSubmissions: allAssignments.map((a) => ({
      id: a.id,
      title: a.title,
      officialName: a.assignedTo?.nameEn || 'Official',
      designation: a.assignedTo?.designation || 'Staff',
      department: a.assignedTo?.department?.nameEn || 'HQ',
      competencyName: a.competency?.nameEn || 'Statistical Core',
      scorePct: a.scorePct,
      submittedAt: a.submittedAt,
    })),
  };
}
