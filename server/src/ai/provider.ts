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
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(body.slice(start, end + 1));
    const list = Array.isArray(parsed?.questions) ? parsed.questions : [];
    return list
      .filter((q: any) => q && typeof q.stem === 'string' && Array.isArray(q.options))
      .map((q: any) => ({
        stem: String(q.stem).trim(),
        options: q.options.map((o: any) => String(o).trim()),
        correctIndex: Number(q.correctIndex ?? q.correct_index ?? 0),
        rationaleCorrect: String(q.rationaleCorrect ?? q.rationale_correct ?? ''),
        distractorReasons: (q.distractorReasons ?? q.distractor_reasons ?? []).map((x: any) => String(x)),
        bloom: String(q.bloom ?? 'UNDERSTAND').toUpperCase(),
        sourceQuote: String(q.sourceQuote ?? q.source_quote ?? ''),
      }));
  } catch {
    return [];
  }
}

// ── Gemini ───────────────────────────────────────────────────────────────
class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  readonly sovereign = false;
  async generateMcqs(ctx: GenerationContext): Promise<CandidateItem[]> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const model = new GoogleGenerativeAI(env.geminiApiKey).getGenerativeModel({
      model: env.geminiModel,
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
    });
    const res = await model.generateContent(buildMcqPrompt(ctx));
    return parseQuestions(res.response.text());
  }
}

// ── Ollama (local / air-gapped) ──────────────────────────────────────────
class OllamaProvider implements AiProvider {
  readonly name = 'ollama';
  readonly sovereign = true;
  async generateMcqs(ctx: GenerationContext): Promise<CandidateItem[]> {
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
    return parseQuestions(data.response ?? '');
  }
}

// ── Mock (deterministic, offline) ────────────────────────────────────────
/**
 * A cloze generator, not a language model — and labelled as such everywhere it
 * surfaces. It exists so that the 12-step demo runs with the network cable out.
 *
 * Method: take a sentence from the chunk, split it at a clause boundary, use
 * the tail as the key, and select distractors from other sentences in the same
 * document ranked by embedding similarity to the key — near-duplicates excluded,
 * mid-band preferred. That is a real distractor-selection technique, which is
 * why the output survives the same gate the LLM output goes through.
 */
class MockProvider implements AiProvider {
  readonly name = 'mock';
  readonly sovereign = true;
  private pool: string[] = [];

  /** Called by the pipeline before generation so distractors can come from the whole document. */
  setDistractorPool(sentences: string[]) {
    this.pool = sentences;
  }

  async generateMcqs(ctx: GenerationContext): Promise<CandidateItem[]> {
    const sentences = splitSentences(ctx.chunkText).filter((s) => s.split(/\s+/).length >= 12);
    const out: CandidateItem[] = [];

    for (const sentence of sentences.slice(0, ctx.count)) {
      const words = sentence.replace(/\s+/g, ' ').trim().split(' ');
      const cut = Math.max(5, Math.round(words.length * 0.45));
      const head = words.slice(0, cut).join(' ');
      const key = words.slice(cut).join(' ').replace(/[.;]$/, '');
      if (key.split(' ').length < 4 || key.length > 160) continue;

      const keyVec = embed(key);
      const candidates = (this.pool.length ? this.pool : sentences)
        .filter((s) => s !== sentence)
        .map((s) => {
          const w = s.replace(/\s+/g, ' ').trim().split(' ');
          const c = Math.max(5, Math.round(w.length * 0.45));
          return w.slice(c).join(' ').replace(/[.;]$/, '');
        })
        .filter((t) => t.split(' ').length >= 4 && t.length <= 180 && t !== key)
        .map((t) => ({ t, sim: cosine(keyVec, embed(t)) }))
        .filter((x) => x.sim < 0.9)
        // prefer length-matched, mid-similarity tails: plausible but clearly wrong
        .sort((a, b) => {
          const la = Math.abs(a.t.length - key.length) / 60 - a.sim;
          const lb = Math.abs(b.t.length - key.length) / 60 - b.sim;
          return la - lb;
        });

      const distractors: string[] = [];
      for (const c of candidates) {
        if (distractors.length >= 3) break;
        if (distractors.some((d) => cosine(embed(d), embed(c.t)) > 0.85)) continue;
        distractors.push(c.t);
      }
      if (distractors.length < 3) continue;

      const options = [key, ...distractors];
      out.push({
        stem: `In the context of ${ctx.competencyName}, complete the statement from ${ctx.headingPath || 'the source material'}: “${head} …”`,
        options,
        correctIndex: 0,
        rationaleCorrect: `The source states: “${sentence.trim()}” — option A completes it exactly as written on page ${ctx.page}.`,
        distractorReasons: distractors.map(
          (_, i) => `Drawn from a different passage of the same document; plausible in register but not what this section states (distractor ${i + 1}).`,
        ),
        bloom: ctx.bloom,
        sourceQuote: sentence.trim(),
      });
    }
    return out;
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
    console.warn('[ai] AI_PROVIDER=gemini but GEMINI_API_KEY is empty — falling back to mock');
  }
  return cached;
}

export const isMock = (p: AiProvider): p is MockProvider => p.name === 'mock';
export { MockProvider };
