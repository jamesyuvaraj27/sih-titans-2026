# STATINTEL

**AI-Enabled Competency & Learning Intelligence Platform for India's Official Statistical System**
SIH 2026 · Team TITANS · Problem Statement SIH26101 (MoSPI · iGOT Karmayogi & NSSTA TPAC).

> Every competency score in this system is **computed, never stored** — derived on demand
> from an append-only ledger of dated, weighted, decaying evidence. Any score can be
> replayed, explained and audited down to the individual assessment item that produced it,
> and **no language model is ever in the scoring path.**

---

## Run it

Prerequisites: **Node 20+** and **PostgreSQL 16 with the `pgvector` extension**.
No Docker required, no API key required — the prototype runs fully offline.

```bash
# 1 · database  (Docker is the easy route; a local Postgres works identically)
docker compose up -d          # postgres + pgvector on :5432

# 2 · API
cd server
cp .env.example .env          # defaults already point at the compose database
npm install
npm run db:reset              # schema + SQL functions + deterministic seed
npm run dev                   # http://localhost:4000/api/health

# 3 · web  (second terminal)
cd web
npm install
npm run dev                   # http://localhost:5173
```

### Demo accounts — password `demo1234`

| Email | Role | What it shows |
|---|---|---|
| `anitha@mospi.gov.in` | Learner | The whole learner journey. Senior Statistical Officer: strong in the field, weak on the modern data toolchain. |
| `rajesh@nssta.gov.in` | Manager / trainer | Upload material, generate questions, review the gate's rejects. |
| `admin@mospi.gov.in` | Super admin | Workforce coverage across all departments, succession risk, training effectiveness. |
| `dept@ap.gov.in` | Dept admin | The same view, scoped to one department — the RBAC story. |
| `auditor@cag.gov.in` | Auditor | Read-only across the whole system, plus the audit log. |

### Verify it

```bash
cd server && npm test        # 65 assertions over the full 12-step demo workflow
```

The tests run over real HTTP against a real database. If they are green, the demo works.
They also assert the things that are easy to claim and hard to prove — that the ledger
arithmetic reproduces the displayed score by hand, that no learning-path step precedes its
own prerequisite, that every generated question quotes its source verbatim, and that a
learner cannot read another official's record.

`npm run db:reset` restores the exact demo state at any time. Do that before rehearsing.

---

## The 12-step workflow this is built around

1. Official signs in → 2. dashboard shows the competency profile → 3. opens a competency →
4. **the Evidence Ledger explains the score** → 5. a trainer uploads training material →
6. AI generates MCQs → 7. the trainer reviews them → 8. the official takes the assessment →
9. new evidence is appended → 10. the score updates → 11. gap analysis updates →
12. the learning path updates.

Nothing ships that risks this loop. See `docs/DEMO-SCRIPT.md`.

---

## What is built (P0, complete)

| | |
|---|---|
| **Authentication + RBAC** | JWT behind an OIDC-ready seam. Five roles, enforced at the route *and* at the record level. |
| **Competency ontology** | 60 leaf competencies across the four domains named in the problem statement, 79 typed edges, 10 MoSPI/NSSTA role profiles, 53 iGOT/NSSTA/TPAC courses, GSBPM tagging. |
| **Evidence ledger** | Append-only, enforced by a PostgreSQL trigger — not by application code. |
| **Scoring engine** | A SQL function. Weighted, time-decayed, relevance-propagated, saturating. Score *and* confidence. Time-travel by parameter. |
| **Gap analysis** | `gap × criticality × urgency`, where urgency is driven by a real survey/activity calendar. |
| **Learning path** | Recursive prerequisite closure + topological sort with a deterministic tie-break. Not an LLM. |
| **MCQ pipeline** | Ingest (PDF/PPTX/DOCX/TXT) → chunk with page locators → local competency tagging → generate → **eight-gate quality filter** → difficulty estimate → trainer review. |
| **Trainer review** | Accept/reject with the source span side by side, and every gate result visible — including for the rejects. |
| **Learner dashboard** | Radar, KPIs, ranked gaps, the ledger, the ladder, the path. |
| **Admin dashboards** | Workforce coverage against role requirements, officials × competencies heatmap, succession risk, training effectiveness, audit log. |

## What is deliberately not built yet

**P1:** Graph-RAG assistant · Sunbird HTTP adapter (the interface and contract are designed; the
prototype uses a seeded catalogue) · Hindi localisation · Bhashini.
**P2:** workforce forecasting · scenario simulation · offline sync · hash-chained audit
verification · QTI/xAPI/SCORM export.

Naming these out loud is deliberate. A jury respects a stated boundary far more than a vague
claim of completeness, and every item above is a sentence you can defend.

---

## Architecture

```
React + Vite + TS + Tailwind          Node 20 + Express + TS + Prisma       PostgreSQL 16
  (Vercel)                              (Render / Oracle Cloud Free)          (Neon) + pgvector
  ├ design tokens, WCAG 2.1 AA          ├ auth · RBAC · audit                 ├ app tables
  ├ charts with table fallbacks         ├ ledger writes                       ├ competency graph
  └ 12 screens                          ├ scoring / gaps / path (SQL)         ├ evidence ledger
                                        ├ ingest · MCQ · gate                 └ vector(64) chunks
                                        └ iGOT client (Sunbird contract)
```

Generation goes through an `AiProvider` seam with three interchangeable implementations —
`gemini` (hosted), `ollama` (local, air-gapped) and `mock` (deterministic, offline, the
default). **Embeddings are always local**, so no official's profile and no uploaded
departmental material ever leaves the machine, whichever generator is configured.

Full reasoning, including the decisions that were made *against* the implementation plan and
why, is in `docs/DECISIONS.md`. Read `CLAUDE.md` before changing anything.

---

## Repository

```
statintel/
├── CLAUDE.md                  agent + contributor constitution — read first
├── docker-compose.yml         postgres + pgvector
├── docs/
│   ├── DECISIONS.md           ADRs, including where this departs from the plan
│   ├── DEMO-SCRIPT.md         the five-minute run, beat by beat
│   └── JURY-QA.md             the questions that will be asked, and the answers
├── server/
│   ├── prisma/schema.prisma
│   ├── sql/                   002 = the append-only trigger, 003 = the scoring engine
│   ├── samples/               a five-page NSSTA-style PDF that exercises the pipeline
│   ├── src/
│   │   ├── ai/                embedding · extract · gate · prompts · provider
│   │   ├── modules/           competency · mcq · quiz · admin
│   │   ├── seed/ontology.ts   THE ASSET — 60 competencies, 79 edges, 10 roles
│   │   └── routes.ts
│   └── tests/acceptance.ts    the 12-step workflow, over HTTP
└── web/
    └── src/
        ├── design/tokens.css  every contrast ratio measured, not eyeballed
        ├── components/        ChartFrame (chart ⇄ table), EvidenceLedgerTable, …
        └── pages/             12 screens
```

---

## Before the finale — the honest to-do list

1. **Ground the ontology in real documents.** Role titles, cadre names and course names in
   `server/src/seed/ontology.ts` are modelled on MoSPI vocabulary but not yet traced to
   published sources. Replace them from the NSSTA training calendars and the ISS
   Probationary Training reference manual on mospi.gov.in. A MoSPI judge recognises their
   own vocabulary instantly — and notices when it is invented. This is the single
   highest-severity risk in the project.
2. **Verify the SIH 2026 dates** on sih.gov.in rather than relying on secondary sources.
3. **Get a Gemini key into `.env`** and rehearse with it, with `mock` proven as the fallback.
4. **Run an accessibility pass** with axe and record a keyboard-only walkthrough.
