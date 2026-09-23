# Architecture decisions

Each entry states what was decided, what it costs, and **what would make it wrong** — which
is the part a jury actually probes. Three of these depart from the written implementation
plan; those are marked and justified rather than quietly changed.

---

## ADR-001 · A single Node service, not Node + Python  ⟵ departs from the plan

**Plan said:** hybrid — Express for the app, FastAPI for ingestion, embeddings, MCQ
generation and RAG.
**Decided:** one Node/TypeScript service for the prototype.

**Why.** The prototype directive puts working demo and stability above architectural
completeness, and asks for the simpler implementation where functionality is unchanged. Every
P0 capability is reachable in TypeScript: PDF text with page numbers (`unpdf`), DOCX
(`mammoth`), PPTX (`unzipper` + slide XML), embeddings (local, ADR-002), generation (HTTP to
Gemini or Ollama). The Python ecosystem was needed for three things — `faster-whisper` for
video, `sentence-transformers` for a real sentence encoder, and IRT calibration — and all
three are P1 or P2.

**What it buys.** One runtime, one deploy, one process to restart in front of a jury. On free
hosting that is the difference between one cold start and two.

**What would make it wrong.** Video ingestion becoming P0, or the embedding upgrade in
ADR-002 landing before the finale. Both are additive: the `AiProvider` seam and the
`embed()` function are the only two places a Python service would attach.

---

## ADR-002 · Embeddings are local and lexical, always

**Decided:** a signed hashing vectoriser (the "hashing trick") over lemma-ish tokens, 64
dimensions, L2-normalised, in `server/src/ai/embedding.ts`. No hosted embedding API, in any
configuration.

**Why.** Two reasons, both of which are answers you want in the jury Q&A.

1. **Sovereignty.** "No official's profile and no uploaded departmental material ever leaves
   the machine" is either true or it is not, and a single hosted embedding call makes it
   false. Keeping embeddings local means the claim holds even when generation is pointed at
   Gemini.
2. **Demo stability.** Competency tagging sits on the critical path of the 12-step workflow.
   A network call there is a network call that can fail in front of a jury.

**What it costs.** It measures weighted token overlap, not meaning. It maps *"stratified
sample allocation"* to `STAT.SAMP.STRAT` correctly; it will not map *"prices went up"* to
inflation. That limitation is stated in the code and should be stated out loud.

**What it buys beyond privacy.** Explainability. The tagging response returns the actual
terms that drove each match, and the trainer screen renders them. A sentence encoder would
be more accurate and completely opaque.

**Upgrade path.** Replace one function. The interface, the 64-dimension column and every
caller stay as they are. That is the P1 task.

---

## ADR-003 · The competency graph lives in PostgreSQL  ⟵ departs from the research doc

**Decided:** two tables (`Competency`, `CompetencyEdge`) and recursive CTEs. No Neo4j.

**Why.** The ontology is 60 nodes and 79 edges. `compute_scores_for_official` — which walks
the full relevance map and aggregates the whole ledger — runs in **2.7 ms**. A second
database would add a deployment, a backup story, a failure mode and a security review, for no
measurable gain.

**What would make it wrong.** Roughly 10⁶ nodes with six-hop traversal, or a genuine need for
graph algorithms at scale (PageRank, community detection). If the national skill-graph vision
is ever built across ministries, that is the migration point. Saying *this* — with the node
count and the measured latency — is a better answer than any choice of database.

---

## ADR-004 · Scores are computed, never stored

**Decided:** `compute_scores_for_official(official_id, as_of)` is a SQL function over the
evidence ledger. `CompetencyScoreCache` exists but is a cache and may be truncated at any
time without data loss.

```
raw   = Σ  weight(kind) · quality · relevance · decay
decay = 2 ^ ( − months_elapsed / half_life )
score = 100 · ( 1 − e^(−raw / 1.6) )
```

**Why the saturating exponential.** Linear summation lets an official farm a high score from
twenty shallow course completions. Here the twentieth completion adds almost nothing while the
first real assessment adds a lot. Diminishing returns is the correct pedagogical model and it
is one line of SQL.

**Why κ = 1.6.** Calibrated against the seeded ledger so the level boundaries mean something a
training officer would recognise: one recent well-scored assessment ≈ mid-L2, two independent
strong pieces of evidence ≈ L3, four ≈ L4. Changing κ moves every level boundary in the
system at once — change it deliberately and re-run the acceptance tests.

**Why `as_of` is a parameter.** Because it costs nothing and it is the proof. Passing a past
date rewinds the whole system, which is exactly what an auditor would do. The time-travel
slider is not a gimmick bolted on for the demo; it is the parameter that was already there.

**Confidence is separate from score, and always shown.** A score of 72 at confidence 0.31 is
not the same claim as 72 at confidence 0.95. Low confidence renders as
*"take a diagnostic to confirm"*, which closes the loop back into the product.

---

## ADR-005 · Append-only is enforced by the database, not the application

**Decided:** a `BEFORE UPDATE OR DELETE` trigger on `Evidence` that raises on any delete and
on any update except a one-way `supersededById` set.

**Why.** The entire claim of the product is that a competency record is auditable. A claim
that rests on *"our code doesn't do that"* is not auditable. A claim that rests on *"the
database refuses"* is. You can demonstrate it in psql in ten seconds:

```sql
DELETE FROM "Evidence" WHERE "officialId" = 'off_anitha';
-- ERROR: Evidence is append-only: DELETE is not permitted (id=…)
UPDATE "Evidence" SET quality = 1.0 WHERE "officialId" = 'off_anitha';
-- ERROR: Evidence is append-only: the only permitted update is setting supersededById
```

Corrections insert a new row and point the old one at it — itself a write that leaves a
trace. `TRUNCATE` bypasses row triggers, which is why re-seeding works and an application
delete does not.

---

## ADR-006 · No language model in the scoring path, ever

**Decided:** LLMs generate questions, rationales and prose. They never produce a competency
score, a level, a gap severity or a learning-path ordering.

**Why.** These are the outputs that carry consequences — training eligibility, and eventually
an input to APAR. "What if the AI hallucinates someone's competency?" has to be answerable
with *"it structurally cannot"*, not *"we prompt carefully"*. Scoring is SQL, gap severity is
arithmetic, path ordering is a topological sort. The acceptance suite asserts this.

---

## ADR-007 · The quality gate is deterministic and its rejects are visible

**Decided:** eight checks in `server/src/ai/gate.ts`, no LLM involved, with rejected
candidates persisted along with their reasons and surfaced in the trainer UI.

| | |
|---|---|
| G1 | key is not conspicuously the longest option |
| G2 | no "all/none of the above", no absolutes |
| G3 | options are mutually distinct (pairwise cosine < 0.93) |
| G4 | distractors are plausible, not random (cosine floor) |
| G5 | the stem does not leak the key |
| G6 | **grounded** — `sourceQuote` is a verbatim substring of the cited chunk, and the key is supported by it |
| G7 | exactly four distinct options, valid key index |
| G8 | stem length between 6 and 60 words |

**G6 is the important one.** Requiring the model to return a verbatim quote turns
hallucination from a matter of judgement into a string comparison. A question that cannot
point at the sentence that justifies it does not enter the bank.

**Target rejection rate is 15–45%**, and the UI says whether the run landed in that band.
Below 15% the gate is too loose; above 45% the prompt is bad. Both are bugs, in different
files. A generator without a rejection rate is not an assessment engine — showing the rejects
is what makes that argument on screen instead of on a slide.

**Difficulty is a stated heuristic.** Bloom level, distractor proximity, lexical complexity,
length, numeric reasoning. The honest position is that real difficulty needs response data;
once an item has ≥200 responses, a 2PL IRT estimate replaces the heuristic and *both* are
kept, so predicted-versus-observed drift is visible. That comparison is a far better slide
than any single number. (P2.)

---

## ADR-008 · iGOT integration is built to the Sunbird contract

**Decided:** the course catalogue and enrolment surface are modelled on Sunbird's API shapes
(`do_` identifiers, `content/v1/search`-style request and response envelopes), served in the
prototype from a seeded catalogue.

**Why.** There is no public third-party iGOT Karmayogi API — no sandbox, no key a student
team can request. Claiming an integration you do not have is the fastest way to lose a jury.
But iGOT runs on **Sunbird**, the open-source MeitY/EkStep stack, whose APIs *are* documented
and open. So the honest and stronger position is: we implemented against the contract iGOT
runs on, and switching to a live instance is a base URL and an API key.

**Prototype status.** The catalogue is seeded and served locally; the HTTP adapter and the
dual-implementation contract tests are P1. Say exactly that. Do not imply more.

---

## ADR-009 · Authentication is OIDC-ready, not a SaaS identity provider

**Decided:** Express + `jose` RS256 JWTs behind an `AuthProvider` seam.

**Why.** A foreign SaaS identity provider is the wrong answer for a government internal
system and a judge will say so. The line is: authentication is an OIDC provider
configuration — pointing this at NIC's e-Pramaan or a departmental Keycloak is an environment
variable and a client registration, not a rewrite.

**Two independent authorisation layers.** A route-level role gate, and a record-level
`canViewOfficial` check. A single-layer answer sounds naive; two layers is what you say when
asked how a manager is stopped from reading another division's records.

---

## ADR-010 · Design system: measured, not eyeballed

**Decided:** institutional clarity — flat, structural, high density, quiet motion. Semantic
tokens only; no raw hex in components.

Specific decisions worth defending:

- **One typeface, Noto Sans, plus the per-locale Noto Indic faces.** A second display family
  would have no Indic coverage, so the moment a user switches to Tamil the visual hierarchy
  would silently collapse to a fallback. Hierarchy comes from weight and size. It is the only
  choice that survives 22 languages.
- **Indic line-height is 1.65, not 1.5** — matras and vowel signs clip at 1.5.
- **Tabular figures on every number** in a table, axis or score. Proportional figures make
  columns jitter and it reads as amateur.
- **Every contrast ratio in `tokens.css` was computed.** The amber focus ring failed the first
  check at 2.15:1 on white, which is why it has a dark inner ring — the GOV.UK technique.
  Ship the amber ring alone and you fail the non-text contrast requirement.
- **Every chart has a "View as table" toggle** rendering a real sortable `<table>`, and an
  `aria-label` stating the chart's *insight* rather than its title.
- **Colour never carries meaning alone.** Severity chips carry an icon and a word; heatmap
  cells carry the level in text and in their accessible name.
- **No tricolour pastiche.** A saffron/white/green header reads as amateur, not patriotic.

One non-obvious bug worth recording, because it will recur: `sr-only` text is absolutely
positioned, so without a positioned ancestor its containing block is the viewport — a
screen-reader label on a cell 1,600 px into a horizontally scrolled table pushes the **whole
page** 1,600 px wide. That is how you get a mysterious horizontal scrollbar on a page whose
every visible element fits. `.card { position: relative }` contains it.

---

## ADR-011 · Aggregates suppress below five people

**Decided:** any coverage figure computed from fewer than five officials is suppressed
(`K_ANONYMITY = 5`), and the UI says how many were suppressed and why.

**Why.** Without it, a "department view" in a small division is a way to read one person's
record through an aggregate. It is a small detail, and government people in the room notice
it.
