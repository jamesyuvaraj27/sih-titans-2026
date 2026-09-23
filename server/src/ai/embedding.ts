/**
 * Local lexical hashing embedding — 64 dimensions.
 *
 * DESIGN DECISION (ADR-002): the prototype never sends text to a hosted
 * embedding API. Two reasons, both of which are answers you want in the
 * jury Q&A:
 *
 *   1. Sovereignty. "No official's profile and no uploaded departmental
 *      material ever leaves the machine" is either true or it isn't, and
 *      a hosted embedding call makes it false.
 *   2. Demo stability. Competency tagging is on the critical path of the
 *      12-step demo. A network call there is a network call that can fail
 *      in front of a jury.
 *
 * What this is: a signed hashing vectoriser (the "hashing trick") over
 * lemma-ish tokens, sublinear term weighting, L2-normalised. Cosine
 * similarity between two texts therefore measures weighted token overlap.
 * That is genuinely enough to map "stratified sample allocation" to
 * STAT.SAMP.STRAT, and it is fully explainable — you can print the tokens
 * that drove the match, which we do in the tagging response.
 *
 * What it is NOT: a semantic model. It will not match "prices went up" to
 * "inflation". Upgrading to a real sentence encoder is a swap of this one
 * function; the interface and the 64-dim column stay. That is the P1 task.
 */

export const EMBED_DIMS = 64;

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'be', 'been',
  'with', 'that', 'this', 'these', 'those', 'it', 'its', 'as', 'at', 'by', 'from', 'can',
  'will', 'which', 'their', 'they', 'has', 'have', 'had', 'was', 'were', 'not', 'but',
  'each', 'other', 'such', 'when', 'where', 'how', 'what', 'who', 'all', 'any', 'may',
  'must', 'should', 'would', 'also', 'into', 'than', 'then', 'there', 'here', 'over',
  'under', 'more', 'most', 'some', 'about', 'using', 'used', 'use', 'given', 'own',
]);

/** Crude but stable normalisation. Deliberately not a real stemmer. */
function normaliseToken(t: string): string {
  let s = t.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]/g, '');
  if (s.length > 4) {
    if (s.endsWith('ies')) s = s.slice(0, -3) + 'y';
    else if (s.endsWith('ing')) s = s.slice(0, -3);
    else if (s.endsWith('ed')) s = s.slice(0, -2);
    else if (s.endsWith('es')) s = s.slice(0, -2);
    else if (s.endsWith('s')) s = s.slice(0, -1);
  }
  return s;
}

export function tokenise(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normaliseToken)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/** FNV-1a → [bucket, sign] */
function hashToken(t: string): [number, number] {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return [h % EMBED_DIMS, (h >>> 31) & 1 ? 1 : -1];
}

export function embed(text: string): number[] {
  const v = new Array<number>(EMBED_DIMS).fill(0);
  const counts = new Map<string, number>();
  for (const t of tokenise(text)) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const [tok, n] of counts) {
    const [bucket, sign] = hashToken(tok);
    // sublinear term frequency — one word repeated 40 times is not 40x the signal
    v[bucket]! += sign * (1 + Math.log(n));
  }
  const norm = Math.hypot(...v);
  return norm === 0 ? v : v.map((x) => x / norm);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!;
  return dot; // both vectors are already L2-normalised
}

/** Tokens shared by two texts — used to explain why a chunk matched a competency. */
export function sharedTerms(a: string, b: string, limit = 6): string[] {
  const setB = new Set(tokenise(b));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokenise(a)) {
    if (setB.has(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length >= limit) break;
    }
  }
  return out;
}
