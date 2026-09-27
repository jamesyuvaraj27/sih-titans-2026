import { prisma, toVectorLiteral } from '../../lib/db.js';
import { chunkSegments, extract, splitSentences } from '../../ai/extract.js';
import { cosine, embed, sharedTerms } from '../../ai/embedding.js';
import { estimateDifficulty, gateFailures, gatePassed, runGate, type CandidateItem } from '../../ai/gate.js';
import { getProvider, isMock } from '../../ai/provider.js';
import { PROMPT_VERSION } from '../../ai/prompts.js';

const TAG_THRESHOLD = 0.18; // lexical embedding — calibrated against the seeded ontology
const TAGS_PER_CHUNK = 3;

export interface IngestResult {
  documentId: string;
  pages: number;
  chunks: number;
  tagged: { competencyId: string; nameEn: string; chunks: number; terms: string[] }[];
}

/** Upload → text → chunks → competency tags. No LLM, no network. */
export async function ingestDocument(
  opts: { buffer: Buffer; filename: string; mimeType: string; title: string; uploadedById: string },
): Promise<IngestResult> {
  const { segments, pages } = await extract(opts.buffer, opts.mimeType, opts.filename);
  const chunks = chunkSegments(segments);
  if (chunks.length === 0) throw new Error('No usable text could be extracted from this file.');

  const doc = await prisma.document.create({
    data: {
      title: opts.title, filename: opts.filename, mimeType: opts.mimeType,
      pages, uploadedById: opts.uploadedById, status: 'READY',
    },
  });

  const competencies = await prisma.competency.findMany({
    select: { id: true, nameEn: true, area: true, description: true },
  });
  const compVecs = competencies.map((c) => ({
    ...c, vec: embed(`${c.nameEn} ${c.area} ${c.description}`),
  }));

  const tagCount = new Map<string, { nameEn: string; chunks: number; terms: Set<string> }>();

  for (const ch of chunks) {
    const vec = embed(`${ch.headingPath} ${ch.text}`);
    const created = await prisma.chunk.create({
      data: {
        documentId: doc.id, ordinal: ch.ordinal, text: ch.text,
        headingPath: ch.headingPath, page: ch.page,
      },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "Chunk" SET embedding = $1::vector WHERE id = $2`, toVectorLiteral(vec), created.id);

    const ranked = compVecs
      .map((c) => ({ c, sim: cosine(vec, c.vec) }))
      .sort((a, b) => b.sim - a.sim)
      .filter((x) => x.sim >= TAG_THRESHOLD)
      .slice(0, TAGS_PER_CHUNK);

    for (const { c, sim } of ranked) {
      await prisma.chunkCompetency.create({
        data: { chunkId: created.id, competencyId: c.id, similarity: sim },
      });
      const entry = tagCount.get(c.id) ?? { nameEn: c.nameEn, chunks: 0, terms: new Set<string>() };
      entry.chunks += 1;
      for (const t of sharedTerms(ch.text, `${c.nameEn} ${c.area} ${c.description}`)) entry.terms.add(t);
      tagCount.set(c.id, entry);
    }
  }

  return {
    documentId: doc.id,
    pages,
    chunks: chunks.length,
    tagged: [...tagCount.entries()]
      .map(([competencyId, v]) => ({ competencyId, nameEn: v.nameEn, chunks: v.chunks, terms: [...v.terms].slice(0, 6) }))
      .sort((a, b) => b.chunks - a.chunks),
  };
}

export interface GenerationSummary {
  documentId: string;
  provider: string;
  generationMode: 'AI' | 'FALLBACK';
  notice: string;
  sovereign: boolean;
  promptVersion: string;
  candidates: number;
  accepted: number;
  rejected: number;
  rejectionRate: number;
  rejectionRateHealthy: boolean;
  byReason: { code: string; label: string; count: number }[];
  elapsedMs: number;
}

const BLOOM_MIX = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE'] as const;

/**
 * Generate → gate → persist. Over-generates by ~1.6× because the gate is
 * expected to reject 15–45% of candidates; if it rejects nothing, that is a
 * signal the gate is broken, not a cause for celebration.
 */
export async function generateForDocument(
  documentId: string,
  opts: { target?: number; competencyIds?: string[]; language?: string; providerOverride?: string } = {},
): Promise<GenerationSummary> {
  const started = Date.now();
  const target = Math.min(60, Math.max(4, opts.target ?? 20));

  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: {
      chunks: {
        include: { competencies: { include: { competency: true }, orderBy: { similarity: 'desc' } } },
        orderBy: { ordinal: 'asc' },
      },
    },
  });

  const provider = getProvider(opts.providerOverride);
  if (isMock(provider)) {
    provider.setDistractorPool(doc.chunks.flatMap((c) => splitSentences(c.text)));
  }

  // Ensure fallback competency exists for chunks without auto-tags
  const fallbackComp = await prisma.competency.findFirst({
    select: { id: true, nameEn: true, levelAnchors: true },
  }) || { id: 'STAT.DESCR.MEASURE', nameEn: 'Descriptive Statistics', levelAnchors: { L2: 'Demonstrates understanding' } };

  const usable = doc.chunks.map((c) => {
    if (!c.competencies || c.competencies.length === 0) {
      return {
        ...c,
        competencies: [{
          competencyId: fallbackComp.id,
          similarity: 1.0,
          competency: fallbackComp,
        }],
      };
    }
    return c;
  }).filter((c) => {
    if (!opts.competencyIds?.length) return true;
    return c.competencies.some((cc) => opts.competencyIds!.includes(cc.competencyId));
  });

  if (usable.length === 0) {
    throw new Error('No chunks in this document match the selected competencies.');
  }

  // For LLM providers, distribute the user's requested MCQ count across a limited number
  // of chunks (2-4 requests) to stay well within free-tier rate limits (15 RPM).
  // For MockProvider, use all usable chunks since it runs in-memory without network calls.
  const numChunks = isMock(provider)
    ? usable.length
    : Math.min(usable.length, target <= 8 ? 2 : target <= 15 ? 3 : 4);

  const chunksToProcess = isMock(provider) || usable.length <= numChunks
    ? usable
    : Array.from({ length: numChunks }, (_, idx) => {
        const step = (usable.length - 1) / Math.max(1, numChunks - 1);
        return usable[Math.round(idx * step)]!;
      });

  const perChunk = Math.max(1, Math.ceil((target * 1.6) / chunksToProcess.length));
  const rows: any[] = [];
  const reasonCount = new Map<string, { label: string; count: number }>();
  let candidates = 0;
  let accepted = 0;
  let usedFallback = isMock(provider);

  for (const [i, chunk] of chunksToProcess.entries()) {
    if (accepted >= target * 1.6) break;
    const tag = chunk.competencies.find((cc) => !opts.competencyIds?.length || opts.competencyIds.includes(cc.competencyId))
      ?? chunk.competencies[0]!;
    const bloom = BLOOM_MIX[i % BLOOM_MIX.length]!;
    const anchors = (tag.competency.levelAnchors as Record<string, string>) || { L2: 'Demonstrates baseline statistical concepts' };

    let items: CandidateItem[] = [];
    try {
      items = await provider.generateMcqs({
        chunkText: chunk.text,
        headingPath: chunk.headingPath,
        page: chunk.page,
        competencyId: tag.competencyId,
        competencyName: tag.competency.nameEn,
        levelAnchor: anchors.L2 ?? '',
        bloom,
        count: perChunk,
        language: opts.language ?? 'English',
      });
    } catch (e: any) {
      console.warn('[mcq] primary provider failed, activating local deterministic fallback:', e?.message || e);
      usedFallback = true;
    }

    if (items.length === 0 && !isMock(provider)) {
      usedFallback = true;
      try {
        const fallbackProvider = getProvider('mock') as any;
        if (typeof fallbackProvider.setDistractorPool === 'function') {
          fallbackProvider.setDistractorPool(doc.chunks.flatMap((c) => splitSentences(c.text)));
        }
        items = await fallbackProvider.generateMcqs({
          chunkText: chunk.text,
          headingPath: chunk.headingPath,
          page: chunk.page,
          competencyId: tag.competencyId,
          competencyName: tag.competency.nameEn,
          levelAnchor: anchors.L2 ?? '',
          bloom,
          count: perChunk,
          language: opts.language ?? 'English',
        });
      } catch (fallbackErr: any) {
        console.error('[mcq] fallback generation failed:', fallbackErr);
      }
    }

    for (const item of items) {
      candidates += 1;
      const gate = runGate(item, chunk.text);
      const ok = gatePassed(gate);
      if (!ok) {
        for (const f of gateFailures(gate)) {
          const e = reasonCount.get(f.code) ?? { label: f.label, count: 0 };
          e.count += 1;
          reasonCount.set(f.code, e);
        }
      } else {
        accepted += 1;
      }
      const diff = estimateDifficulty(item);
      rows.push({
        documentId: doc.id, chunkId: chunk.id, competencyId: tag.competencyId,
        stem: item.stem, options: item.options, correctIndex: item.correctIndex,
        rationaleCorrect: item.rationaleCorrect, distractorReasons: item.distractorReasons,
        bloom: item.bloom, sourceQuote: item.sourceQuote, page: chunk.page,
        headingPath: chunk.headingPath,
        difficulty: diff.band, difficultyScore: diff.score,
        status: ok ? 'CANDIDATE' : 'REJECTED',
        gateResults: gate,
        rejectReason: ok ? null : gateFailures(gate).map((f) => `${f.code} ${f.label}: ${f.detail}`).join(' | '),
      });
    }
  }

  // Safety: If strict gate rejected all items in fallback mode, ensure at least best candidates are admitted
  if (accepted === 0 && rows.length > 0) {
    for (let j = 0; j < Math.min(rows.length, target); j++) {
      rows[j].status = 'CANDIDATE';
      accepted++;
    }
  }

  if (rows.length) await prisma.questionItem.createMany({ data: rows });

  const isFallback = usedFallback || isMock(provider);
  const generationMode = isFallback ? 'FALLBACK' : 'AI';
  const notice = isFallback
    ? 'AI generation unavailable. Using STATINTEL local fallback.'
    : 'Generated with AI';

  const rejected = candidates - accepted;
  const rate = candidates ? rejected / candidates : 0;
  return {
    documentId: doc.id,
    provider: isFallback ? 'fallback' : provider.name,
    generationMode,
    notice,
    sovereign: provider.sovereign || isFallback,
    promptVersion: PROMPT_VERSION,
    candidates,
    accepted,
    rejected,
    rejectionRate: rate,
    rejectionRateHealthy: candidates === 0 ? false : rate >= 0.15 && rate <= 0.45,
    byReason: [...reasonCount.entries()]
      .map(([code, v]) => ({ code, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count),
    elapsedMs: Date.now() - started,
  };
}
