/**
 * Generation prompts. Versioned here, never inlined at a call site, so that a
 * change to how questions are asked is a reviewable diff.
 *
 * Two details in this prompt do more work than all the others:
 *
 *   • the empty-array escape hatch — a model that is allowed to refuse
 *     produces far less garbage than one that must return ten questions from
 *     a title slide;
 *   • sourceQuote must be VERBATIM — which turns hallucination from a matter
 *     of judgement into a string comparison (gate G6).
 */

export const PROMPT_VERSION = 'mcq-v1.2';

export const BLOOM_DEFINITIONS: Record<string, string> = {
  REMEMBER: 'recall of a definition, term or stated fact',
  UNDERSTAND: 'explanation of an idea or concept in the learner’s own terms',
  APPLY: 'use of a method or rule in a concrete situation',
  ANALYZE: 'comparison, contrast, or breaking a concept into parts',
  EVALUATE: 'judging between options against stated criteria',
};

/** Statistical terms that must survive translation intact. */
export const DO_NOT_TRANSLATE = [
  'CPI', 'WPI', 'GDP', 'GVA', 'NSS', 'NSSO', 'PLFS', 'ASI', 'HCES', 'SDG', 'SDMX', 'DDI',
  'GSBPM', 'sampling frame', 'stratum', 'strata', 'deflator', 'base year', 'design effect',
  'MoSPI', 'NSSTA', 'iGOT', 'Karmayogi',
];

export interface GenerationContext {
  chunkText: string;
  headingPath: string;
  page: number;
  competencyId: string;
  competencyName: string;
  levelAnchor: string;
  bloom: string;
  count: number;
  language: string;
}

export function buildMcqPrompt(c: GenerationContext): string {
  return `You are an assessment designer for India's official statistical system.

SOURCE MATERIAL (this is the ONLY permitted basis for the question):
---
${c.chunkText}
---
Source locator: ${c.headingPath || '(untitled section)'} · page ${c.page}
Competency assessed: ${c.competencyId} — ${c.competencyName}
Level anchor being tested: ${c.levelAnchor}
Bloom's level required: ${c.bloom} (${BLOOM_DEFINITIONS[c.bloom] ?? 'recall'})

Write ${c.count} multiple-choice questions. Rules, all mandatory:
1. The correct answer must be verifiable from the source material above. If the
   source does not contain enough to write a question at this Bloom's level,
   return an empty array. Do not invent content.
2. Exactly four options. Exactly one correct.
3. Distractors must be wrong for a specific, nameable reason — a common
   misconception, a plausible confusion with an adjacent concept, or a
   characteristic calculation error. Distractors must share domain context and subject
   vocabulary with the topic so they represent plausible alternative statistical techniques. Never nonsense options.
4. Options must be of similar length and grammatically parallel.
5. Never use "All of the above", "None of the above", "Both A and B".
6. Use Indian statistical context where the source permits (NSS rounds, CPI,
   PLFS, ASI, Economic Census) — never invent figures.
7. Write in ${c.language}. Keep these terms untranslated: ${DO_NOT_TRANSLATE.join(', ')}.

Return ONLY JSON, matching exactly:
{"questions":[{"stem":"...","options":["...","...","...","..."],"correctIndex":0,
"rationaleCorrect":"why the key is right, citing the source",
"distractorReasons":["misconception each distractor represents","...","..."],
"bloom":"${c.bloom}",
"sourceQuote":"the exact sentence(s) from the SOURCE MATERIAL that justify the key — must appear verbatim above"}]}`;
}
