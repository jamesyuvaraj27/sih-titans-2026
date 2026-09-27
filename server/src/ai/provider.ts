/**
 * LLM provider abstraction — generation only.
 *
 * Embeddings are deliberately NOT part of this interface: they are always
 * local (see ai/embedding.ts). That keeps "no official's data leaves the
 * machine" true regardless of which generator is configured, and keeps the
 * competency-tagging step — which is on the critical path of the demo — free
 * of network calls.
 *
 *   mock    deterministic, offline, no key. The demo fallback, and the default.
 *   gemini  Gemini free tier. What you run in the finale when Wi-Fi behaves.
 *   ollama  a local model over HTTP. The sovereignty / air-gapped answer.
 */
import { env } from '../lib/env.js';
import { buildMcqPrompt, type GenerationContext } from './prompts.js';
import type { CandidateItem } from './gate.js';
import { cosine, embed } from './embedding.js';
import { splitSentences } from './extract.js';

export interface AiProvider {
  readonly name: string;
  readonly sovereign: boolean;
  generateMcqs(ctx: GenerationContext): Promise<CandidateItem[]>;
}

// ── JSON coaxing ─────────────────────────────────────────────────────────
function parseQuestions(raw: string): CandidateItem[] {
  if (!raw || typeof raw !== 'string') return [];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? raw).trim();

  let parsed: any = null;
  const startArr = body.indexOf('[');
  const endArr = body.lastIndexOf(']');
  const startObj = body.indexOf('{');
  const endObj = body.lastIndexOf('}');

  try {
    if (startArr >= 0 && endArr > startArr && (startObj < 0 || startArr < startObj)) {
      parsed = JSON.parse(body.slice(startArr, endArr + 1));
    } else if (startObj >= 0 && endObj > startObj) {
      parsed = JSON.parse(body.slice(startObj, endObj + 1));
    } else {
      parsed = JSON.parse(body);
    }
  } catch {
    try {
      parsed = JSON.parse(body);
    } catch {
      return [];
    }
  }

  const list = Array.isArray(parsed?.questions)
    ? parsed.questions
    : Array.isArray(parsed)
    ? parsed
    : [];

  return list
    .filter((q: any) => q && typeof q.stem === 'string' && Array.isArray(q.options) && q.options.length >= 2)
    .map((q: any) => {
      let options = q.options.map((o: any) => String(o).trim());
      while (options.length < 4) {
        options.push(`Statistical alternative option ${options.length + 1}`);
      }
      if (options.length > 4) options = options.slice(0, 4);

      let correctIndex = Number(q.correctIndex ?? q.correct_index ?? 0);
      if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;

      return {
        stem: String(q.stem).trim(),
        options,
        correctIndex,
        rationaleCorrect: String(q.rationaleCorrect ?? q.rationale_correct ?? q.explanation ?? 'Grounded in official curriculum guidelines.').trim(),
        distractorReasons: (q.distractorReasons ?? q.distractor_reasons ?? []).map((x: any) => String(x)),
        bloom: String(q.bloom ?? 'UNDERSTAND').toUpperCase(),
        sourceQuote: String(q.sourceQuote ?? q.source_quote ?? '').trim(),
      };
    });
}

// ── Grounded Deterministic Fallback MCQ Generator ─────────────────────────
export function generateDeterministicFallbackMcqs(ctx: GenerationContext, fallbackPool: string[] = []): CandidateItem[] {
  const chunk = ctx.chunkText || '';
  const rawLines = chunk.split(/[\r\n]+/).map((s) => s.trim()).filter((s) => s.length > 15);
  const rawSentences = splitSentences(chunk).map((s) => s.trim()).filter((s) => s.length > 15);
  const pool = Array.from(new Set([...rawSentences, ...rawLines]))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.split(' ').length >= 4);

  const out: CandidateItem[] = [];
  const targetCount = Math.max(1, ctx.count || 5);

  const domainDistractors = [
    'Applying unweighted simple aggregation across non-homogeneous domains',
    'Selecting sample units using non-random convenience sampling',
    'Assuming zero non-response error across all survey strata',
    'Eliminating sampling variance through single-unit clusters',
    'Applying uniform fixed weighting irrespective of population changes',
    'Treating circular systematic sampling as simple random sampling with replacement',
    'Directly replacing missing administrative registers without imputation',
    'Overwriting original audit trails during preliminary data validation',
    'Reporting unadjusted estimates without standard error calculations',
    'Excluding remote frame units without post-stratification adjustments',
  ];

  for (let i = 0; i < pool.length && out.length < targetCount; i++) {
    const statement = pool[i]!;
    const words = statement.split(' ');
    if (words.length < 5) continue;

    // Pattern A: Definition ("X is / refers to Y")
    const defMatch = statement.match(/^([^,.]+?)\s+(is defined as|is|are|refers to|denotes|represents)\s+(.+)$/i);
    let stem = '';
    let key = '';

    if (defMatch && defMatch[1] && defMatch[3] && defMatch[1].length < 60) {
      const subject = defMatch[1].trim();
      const verb = defMatch[2]!.trim();
      const predicate = defMatch[3]!.trim().replace(/[.;]$/, '');
      stem = `In the context of ${ctx.competencyName}, which of the following accurately describes ${subject}?`;
      key = `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${predicate}`;
    } else {
      // Pattern B: Sentence completion / cloze
      const cut = Math.max(4, Math.round(words.length * 0.45));
      const head = words.slice(0, cut).join(' ');
      const tail = words.slice(cut).join(' ').replace(/[.;]$/, '');
      if (tail.length < 5) continue;
      stem = `According to the source text on ${ctx.headingPath || ctx.competencyName}, complete the guideline: “${head} …”`;
      key = tail;
    }

    if (key.length > 150) {
      key = key.slice(0, 145) + '…';
    }

    // Candidate distractors
    const candidateDistractors: string[] = [];
    for (const other of pool) {
      if (candidateDistractors.length >= 3) break;
      if (other === statement) continue;
      const otherWords = other.split(' ');
      const otherCut = Math.max(4, Math.round(otherWords.length * 0.45));
      const otherTail = otherWords.slice(otherCut).join(' ').replace(/[.;]$/, '');
      if (otherTail.length >= 6 && otherTail !== key && !candidateDistractors.includes(otherTail)) {
        candidateDistractors.push(otherTail.slice(0, 150));
      }
    }

    if (candidateDistractors.length < 3 && fallbackPool.length) {
      for (const p of fallbackPool) {
        if (candidateDistractors.length >= 3) break;
        if (p === statement || p === key || candidateDistractors.includes(p)) continue;
        candidateDistractors.push(p.slice(0, 150));
      }
    }

    for (const d of domainDistractors) {
      if (candidateDistractors.length >= 3) break;
      if (!candidateDistractors.includes(d) && d !== key) {
        candidateDistractors.push(d);
      }
    }

    // Distribute correct option across indexes (0, 1, 2, 3)
    const correctIndex = out.length % 4;
    const options: string[] = [];
    let dIdx = 0;
    for (let pos = 0; pos < 4; pos++) {
      if (pos === correctIndex) {
        options.push(key);
      } else {
        options.push(candidateDistractors[dIdx++] || `Alternative statistical method ${pos + 1}`);
      }
    }

    out.push({
      stem,
      options,
      correctIndex,
      rationaleCorrect: `Official curriculum guideline states: “${statement.trim()}” — option ${String.fromCharCode(65 + correctIndex)} reflects this directly.`,
      distractorReasons: options.map((opt, idx) =>
        idx === correctIndex
          ? 'Correct key substantiated by cited learning text.'
          : `Distractor ${idx + 1}: Not supported by the quoted passage in this section.`
      ),
      bloom: ctx.bloom || 'UNDERSTAND',
      sourceQuote: statement.trim(),
    });
  }

  return out;
}

// ── Gemini ───────────────────────────────────────────────────────────────
class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  readonly sovereign = false;

  async generateMcqs(ctx: GenerationContext): Promise<CandidateItem[]> {
    if (!env.geminiApiKey || process.env.SIMULATE_AI_FALLBACK === 'true') {
      console.info('[gemini] API key missing or fallback simulated -> using deterministic fallback');
      return generateDeterministicFallbackMcqs(ctx);
    }

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const model = new GoogleGenerativeAI(env.geminiApiKey).getGenerativeModel({
        model: env.geminiModel,
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
      });

      // 9-second timeout promise to avoid hanging forever
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API call timed out after 9000ms')), 9000)
      );

      const res = await Promise.race([model.generateContent(buildMcqPrompt(ctx)), timeoutPromise]);
      const questions = parseQuestions(res.response.text());
      if (questions.length > 0) {
        return questions;
      }
      console.warn('[gemini] parseQuestions returned 0 items -> seamlessly falling back to deterministic generator');
      return generateDeterministicFallbackMcqs(ctx);
    } catch (e: any) {
      console.warn('[gemini] API call failed -> seamlessly using deterministic fallback:', e?.message || e);
      return generateDeterministicFallbackMcqs(ctx);
    }
  }
}

// ── Ollama (local / air-gapped) ──────────────────────────────────────────
class OllamaProvider implements AiProvider {
  readonly name = 'ollama';
  readonly sovereign = true;
  async generateMcqs(ctx: GenerationContext): Promise<CandidateItem[]> {
    try {
      const res = await fetch(`${env.ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: env.ollamaModel,
          prompt: buildMcqPrompt(ctx),
          format: 'json',
          stream: false,
          options: { temperature: 0.7 },
        }),
      });
      if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
      const data = (await res.json()) as { response?: string };
      const questions = parseQuestions(data.response ?? '');
      if (questions.length > 0) return questions;
      return generateDeterministicFallbackMcqs(ctx);
    } catch (e: any) {
      console.warn('[ollama] call failed -> using deterministic fallback:', e?.message || e);
      return generateDeterministicFallbackMcqs(ctx);
    }
  }
}

// ── Mock (deterministic, offline) ────────────────────────────────────────
class MockProvider implements AiProvider {
  readonly name = 'mock';
  readonly sovereign = true;
  private pool: string[] = [];

  setDistractorPool(sentences: string[]) {
    this.pool = sentences;
  }

  async generateMcqs(ctx: GenerationContext): Promise<CandidateItem[]> {
    return generateDeterministicFallbackMcqs(ctx, this.pool);
  }
}

let cached: AiProvider | null = null;

export function getProvider(override?: string): AiProvider {
  const want = override ?? env.aiProvider;
  if (cached && cached.name === want) return cached;
  cached =
    want === 'gemini' && env.geminiApiKey ? new GeminiProvider()
    : want === 'ollama' ? new OllamaProvider()
    : new MockProvider();
  if (want === 'gemini' && !env.geminiApiKey) {
    console.warn('[ai] AI_PROVIDER=gemini but GEMINI_API_KEY is empty — using mock/fallback');
  }
  return cached;
}

export const isMock = (p: AiProvider): p is MockProvider => p.name === 'mock';
export { MockProvider };
