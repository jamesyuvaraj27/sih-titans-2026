# STATINTEL — agent context

AI-Enabled Competency & Learning Intelligence Platform for India's Official
Statistical System (MoSPI), SIH 2026, team TITANS.

**This is a PROTOTYPE optimised for a live jury demo.** Priority order for every
decision: working demo > stability > explainability > jury impact > dev speed >
architectural completeness. A partially implemented advanced feature is worse
than a fully implemented core feature.

## The 12-step demo workflow — nothing may break this

1. Official logs in → 2. Dashboard shows competency profile → 3. Opens a
competency → 4. Evidence Ledger explains the score → 5. Uploads training
material → 6. AI generates MCQs → 7. Trainer reviews them → 8. Official takes
the assessment → 9. New evidence is appended → 10. Score updates → 11. Gap
analysis updates → 12. Learning path updates.

If a change risks this loop, it does not ship.

## Non-negotiables

- `Evidence` is APPEND-ONLY. Enforced by Postgres rules, not just code.
  Corrections insert a new row and set `supersededById`. Never UPDATE, never DELETE.
- Competency scores are COMPUTED by `compute_competency_score()`, never stored
  as a column. The `CompetencyScoreCache` table is a cache and may be dropped
  at any time without data loss.
- **No LLM call may ever produce a competency score.** LLMs write questions and
  prose only. If you find an LLM in the scoring path, that is a bug.
- Every generated MCQ carries a resolvable source locator and a `sourceQuote`
  that is a verbatim substring of its chunk. Enforced by gate G6.
- The graph lives in PostgreSQL. Do not propose Neo4j.
- Never render a score, level, recommendation or gap without its reason.
- No raw hex in components. Only tokens from `web/src/design/tokens.css`.
- Every chart ships with a "View as table" toggle and an aria-label stating its
  insight, not its title.
- TypeScript strict everywhere. Conventional commits. No secrets in code.

## Architecture (prototype)

Single Node/Express + TypeScript API, React + Vite + TS + Tailwind frontend,
PostgreSQL + Prisma + pgvector. **No separate Python service in the prototype** —
see docs/ADR-001-node-only.md. AI access is behind `AiProvider`, so Gemini,
Ollama (sovereign/offline) and a deterministic Mock are interchangeable.

## Scope discipline

P0 (built): auth, RBAC, ontology, evidence ledger, scoring, gap analysis,
learning path, MCQ pipeline, trainer review, learner dashboard, admin dashboard.

P1 (not yet): Graph-RAG assistant, knowledge-graph visualisation, Sunbird
adapter, Hindi localisation, Bhashini.

P2 (do not start): forecasting, scenario simulation, offline sync, hash-chained
audit verification UI, QTI/xAPI/SCORM export, further languages.

Do not implement P1 or P2 work while any P0 acceptance test is failing.
