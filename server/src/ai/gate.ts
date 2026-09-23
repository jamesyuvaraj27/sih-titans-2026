/**
 * THE QUALITY GATE — eight deterministic checks, no LLM involved.
 *
 * This is the difference between "we prompted an LLM for quiz questions" and
 * "we built an assessment engine". A generator without a rejection rate is not
 * an assessment engine, and the rejection reasons are shown in the UI on
 * purpose: a trainer who can see *why* ten of thirty-four candidates were
 * thrown away trusts the twenty-four that survived.
 *
 * Target rejection rate is 15–45%. Below 15% the gate is too loose; above 45%
 * the generation prompt is bad. Both are bugs, in different files.
 */
import { cosine, embed } from './embedding.js';

export interface CandidateItem {
  stem: string;
  options: string[];
  correctIndex: number;
  rationaleCorrect: string;
  distractorReasons: string[];
  bloom: string;
  sourceQuote: string;
}

export interface GateResult {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
}

const ABSOLUTES = /\b(all of the above|none of the above|both a and b|any of the above|always|never)\b/i;

export function runGate(item: CandidateItem, chunkText: string): GateResult[] {
  const results: GateResult[] = [];
  const key = item.options[item.correctIndex] ?? '';
  const distractors = item.options.filter((_, i) => i !== item.correctIndex);
  const add = (code: string, label: string, passed: boolean, detail: string) =>
    results.push({ code, label, passed, detail });

  // G7 first — everything else assumes a well-formed item
  const unique = new Set(item.options.map((o) => o.trim().toLowerCase()));
  add('G7', 'Four distinct options',
    item.options.length === 4 && unique.size === 4 && item.correctIndex >= 0 && item.correctIndex < 4,
    `${item.options.length} options, ${unique.size} distinct, key index ${item.correctIndex}`);

  // G1 — the "longest answer is correct" tell
  const meanLen = item.options.reduce((a, o) => a + o.length, 0) / Math.max(item.options.length, 1);
  add('G1', 'Key is not conspicuously longest',
    key.length <= 1.25 * meanLen || key.length <= 24,
    `key ${key.length} chars vs mean ${meanLen.toFixed(0)} (limit ${(1.25 * meanLen).toFixed(0)})`);

  // G2 — absolutes and catch-all options destroy discrimination
  const offending = item.options.filter((o) => ABSOLUTES.test(o));
  add('G2', 'No absolutes or catch-all options', offending.length === 0,
    offending.length ? `found: ${offending.join(' | ')}` : 'none');

  // G3 — distractors must not be paraphrases of each other or of the key
  let maxPair = 0; let pairDetail = 'n/a';
  for (let i = 0; i < item.options.length; i++) {
    for (let j = i + 1; j < item.options.length; j++) {
      const sim = cosine(embed(item.options[i]!), embed(item.options[j]!));
      if (sim > maxPair) { maxPair = sim; pairDetail = `options ${i + 1}/${j + 1} at ${sim.toFixed(2)}`; }
    }
  }
  add('G3', 'Options are mutually distinct', maxPair < 0.93, `max pairwise similarity ${maxPair.toFixed(2)} (${pairDetail})`);

  // G4 — a distractor has to be in the plausible band: too far and nobody picks
  // it, too close and it is arguably also correct
  const sims = distractors.map((d) => cosine(embed(key), embed(d)));
  const implausible = sims.filter((s) => s < 0.12).length;
  add('G4', 'Distractors are plausible', implausible === 0,
    `key↔distractor similarity ${sims.map((s) => s.toFixed(2)).join(', ')} (floor 0.12)`);

  // G5 — the stem must not contain the answer
  const keyTokens = key.toLowerCase().split(/\W+/).filter((t) => t.length > 5);
  const leaked = keyTokens.filter((t) => item.stem.toLowerCase().includes(t));
  add('G5', 'Stem does not leak the key', leaked.length < Math.max(2, keyTokens.length * 0.6),
    leaked.length ? `shared long tokens: ${leaked.slice(0, 4).join(', ')}` : 'no leak');

  // G6 — THE GROUNDEDNESS GATE. sourceQuote must be verbatim in the chunk and
  // the key must be semantically supported by it. This is what makes
  // hallucination mechanically detectable rather than a matter of opinion.
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const quoteFound = item.sourceQuote.length > 12 && norm(chunkText).includes(norm(item.sourceQuote));
  const keySupport = cosine(embed(key), embed(item.sourceQuote || chunkText));
  add('G6', 'Grounded in the source', quoteFound && keySupport > 0.10,
    quoteFound
      ? `quote found verbatim; key↔quote support ${keySupport.toFixed(2)}`
      : 'sourceQuote is not a verbatim substring of the cited chunk');

  // G8 — stem length sanity
  const words = item.stem.trim().split(/\s+/).length;
  add('G8', 'Stem length is workable', words >= 6 && words <= 60, `${words} words`);

  return results;
}

export const gatePassed = (rs: GateResult[]) => rs.every((r) => r.passed);
export const gateFailures = (rs: GateResult[]) => rs.filter((r) => !r.passed);

/**
 * Cold-start difficulty. Heuristic on purpose — the honest position is that
 * real difficulty needs response data. Once an item has ≥200 responses this is
 * replaced by a 2PL IRT estimate and BOTH are kept, so the drift between the
 * predicted and the observed difficulty is visible. That comparison is a far
 * better slide than any single number.
 */
const BLOOM_WEIGHT: Record<string, number> = {
  REMEMBER: 0.1, UNDERSTAND: 0.3, APPLY: 0.55, ANALYZE: 0.75, EVALUATE: 0.9, CREATE: 1.0,
};

export function estimateDifficulty(item: CandidateItem): { score: number; band: 'EASY' | 'MEDIUM' | 'HARD' } {
  const key = item.options[item.correctIndex] ?? '';
  const distractors = item.options.filter((_, i) => i !== item.correctIndex);
  const sims = distractors.map((d) => cosine(embed(key), embed(d)));
  const meanSim = sims.length ? sims.reduce((a, b) => a + b, 0) / sims.length : 0;

  const words = item.stem.split(/\s+/);
  const longWords = words.filter((w) => w.length > 8).length / Math.max(words.length, 1);
  const numeric = /\d/.test(item.stem) || item.options.some((o) => /\d/.test(o)) ? 1 : 0;

  const score =
    0.30 * (BLOOM_WEIGHT[item.bloom.toUpperCase()] ?? 0.4) +
    0.25 * meanSim +           // closer distractors → harder
    0.20 * Math.min(1, longWords * 3) +
    0.15 * Math.min(1, words.length / 45) +
    0.10 * numeric;

  return { score, band: score < 0.33 ? 'EASY' : score < 0.58 ? 'MEDIUM' : 'HARD' };
}
