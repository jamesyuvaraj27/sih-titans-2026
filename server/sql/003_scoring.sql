-- ════════════════════════════════════════════════════════════════════════
--  COMPETENCY SCORING
--
--  A score is a pure function of (official, competency, as-of date) over the
--  evidence ledger. It is never stored. Passing a past date rewinds the whole
--  system — that is the time-travel demo, and it costs nothing because the
--  date is already a parameter.
--
--    raw   = Σ  weight(kind) · quality · decay · relevance
--    decay = 2 ^ ( − months_elapsed / half_life )
--    score = 100 · ( 1 − e^(−raw / κ) )          κ = 1.6, saturating
--
--  κ was calibrated against the seeded ledger so that the level boundaries
--  mean something a training officer would recognise:
--    one recent, well-scored assessment            → mid L2   (~47)
--    two independent strong pieces of evidence     → L3       (~71)
--    four                                          → L4       (~92)
--  Change κ and you move every level boundary in the system at once, so
--  change it deliberately and re-run tests/acceptance.ts.
--
--  The saturating exponential is deliberate: linear summation lets someone
--  farm a high score from twenty shallow course completions. Here the 20th
--  completion adds almost nothing while the first real assessment adds a lot.
--
--  NO LLM IS INVOLVED AT ANY POINT IN THIS FILE. That is the entire claim.
-- ════════════════════════════════════════════════════════════════════════

-- Evidence-kind weights. Self-declaration is deliberately near-worthless.
CREATE OR REPLACE FUNCTION evidence_weight(k text) RETURNS double precision AS $$
  SELECT CASE k
    WHEN 'ASSESSMENT'        THEN 1.00
    WHEN 'PROJECT_ARTIFACT'  THEN 0.90
    WHEN 'COURSE_COMPLETION' THEN 0.60
    WHEN 'ATTESTATION'       THEN 0.40
    WHEN 'PRIOR_TRAINING'    THEN 0.35
    WHEN 'SELF_DECLARATION'  THEN 0.15
    ELSE 0.0 END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION score_to_level(s double precision) RETURNS int AS $$
  SELECT CASE
    WHEN s >= 88 THEN 4
    WHEN s >= 70 THEN 3
    WHEN s >= 45 THEN 2
    WHEN s >= 20 THEN 1
    ELSE 0 END;
$$ LANGUAGE sql IMMUTABLE;

-- ── Relevance map ──────────────────────────────────────────────────────
-- How much does evidence recorded against competency `source` count towards
-- competency `target`?
--   • the competency itself                      → 1.00
--   • a competency that SUBSUMES the target      → 0.6 ^ hops
--   • an ADJACENT competency (either direction)  → edge weight × 0.40
-- Where several paths exist, the strongest wins.
CREATE OR REPLACE FUNCTION competency_relevance()
RETURNS TABLE(source_id text, target_id text, relevance double precision) AS $$
  WITH RECURSIVE subsumes AS (
    SELECT e."fromId" AS source_id, e."toId" AS target_id, 0.6::double precision AS rel, 1 AS depth
    FROM "CompetencyEdge" e WHERE e.kind = 'SUBSUMES'
    UNION ALL
    SELECT s.source_id, e."toId", s.rel * 0.6, s.depth + 1
    FROM subsumes s
    JOIN "CompetencyEdge" e ON e."fromId" = s.target_id AND e.kind = 'SUBSUMES'
    WHERE s.depth < 5
  ),
  all_rel AS (
    SELECT c.id, c.id, 1.0::double precision FROM "Competency" c
    UNION ALL
    SELECT source_id, target_id, rel FROM subsumes
    UNION ALL
    SELECT e."fromId", e."toId", e.weight * 0.4 FROM "CompetencyEdge" e WHERE e.kind = 'ADJACENT'
    UNION ALL
    SELECT e."toId", e."fromId", e.weight * 0.4 FROM "CompetencyEdge" e WHERE e.kind = 'ADJACENT'
  )
  SELECT a.column1, a.column2, MAX(a.column3)
  FROM all_rel a(column1, column2, column3)
  GROUP BY a.column1, a.column2;
$$ LANGUAGE sql STABLE;

-- ── The whole profile for one official, as of a date ───────────────────
-- One query for all competencies. The dashboard calls this once.
CREATE OR REPLACE FUNCTION compute_scores_for_official(
  p_official_id text,
  p_as_of timestamptz DEFAULT now()
)
RETURNS TABLE(
  competency_id  text,
  score          double precision,
  level          int,
  confidence     double precision,
  evidence_count int
) AS $$
  WITH rel AS (SELECT * FROM competency_relevance()),
  contrib AS (
    SELECT
      r.target_id,
      ev.id                                                        AS evidence_id,
      ev.kind::text                                                AS kind,
      evidence_weight(ev.kind::text) * ev.quality * r.relevance
        * power(2.0, - (EXTRACT(EPOCH FROM (p_as_of - ev."occurredAt")) / 2629800.0)
                     / GREATEST(c."decayHalfLifeMonths", 1))       AS contribution,
      power(2.0, - (EXTRACT(EPOCH FROM (p_as_of - ev."occurredAt")) / 2629800.0)
                 / GREATEST(c."decayHalfLifeMonths", 1))           AS decay
    FROM "Evidence" ev
    JOIN rel r          ON r.source_id = ev."competencyId"
    JOIN "Competency" c ON c.id = r.target_id
    WHERE ev."officialId" = p_official_id
      AND ev."supersededById" IS NULL
      AND ev."occurredAt" <= p_as_of
  ),
  agg AS (
    SELECT
      target_id,
      SUM(contribution)                                    AS raw,
      SUM(decay)                                           AS decay_mass,
      COUNT(DISTINCT kind)                                 AS kind_variety,
      COUNT(*)                                             AS n,
      BOOL_OR(kind = 'ASSESSMENT')                         AS has_assessment
    FROM contrib GROUP BY target_id
  )
  SELECT
    c.id,
    COALESCE(100.0 * (1 - exp(- GREATEST(a.raw, 0) / 1.6)), 0.0),
    score_to_level(COALESCE(100.0 * (1 - exp(- GREATEST(a.raw, 0) / 1.6)), 0.0)),
    COALESCE(
      LEAST(1.0, a.kind_variety / 2.0)
      * LEAST(1.0, a.decay_mass / 1.2)
      * (0.6 + 0.4 * (CASE WHEN a.has_assessment THEN 1 ELSE 0 END)), 0.0),
    COALESCE(a.n, 0)::int
  FROM "Competency" c
  LEFT JOIN agg a ON a.target_id = c.id;
$$ LANGUAGE sql STABLE;

-- Single competency — a thin wrapper so callers never re-implement the maths.
CREATE OR REPLACE FUNCTION compute_competency_score(
  p_official_id text,
  p_competency_id text,
  p_as_of timestamptz DEFAULT now()
)
RETURNS TABLE(score double precision, level int, confidence double precision, evidence_count int) AS $$
  SELECT s.score, s.level, s.confidence, s.evidence_count
  FROM compute_scores_for_official(p_official_id, p_as_of) s
  WHERE s.competency_id = p_competency_id;
$$ LANGUAGE sql STABLE;

-- ── Per-evidence contribution, for the ledger drill-down ───────────────
-- This is what makes the score explainable: the UI shows exactly these rows
-- and they sum, through the saturating curve, to the number on the card.
CREATE OR REPLACE FUNCTION explain_competency_score(
  p_official_id text,
  p_competency_id text,
  p_as_of timestamptz DEFAULT now()
)
RETURNS TABLE(
  evidence_id   text,
  source_competency text,
  kind          text,
  summary       text,
  occurred_at   timestamptz,
  quality       double precision,
  weight        double precision,
  relevance     double precision,
  decay         double precision,
  contribution  double precision
) AS $$
  WITH rel AS (SELECT * FROM competency_relevance() WHERE target_id = p_competency_id)
  SELECT
    ev.id,
    ev."competencyId",
    ev.kind::text,
    ev.summary,
    ev."occurredAt",
    ev.quality,
    evidence_weight(ev.kind::text),
    r.relevance,
    power(2.0, - (EXTRACT(EPOCH FROM (p_as_of - ev."occurredAt")) / 2629800.0)
               / GREATEST(c."decayHalfLifeMonths", 1)),
    evidence_weight(ev.kind::text) * ev.quality * r.relevance
      * power(2.0, - (EXTRACT(EPOCH FROM (p_as_of - ev."occurredAt")) / 2629800.0)
                   / GREATEST(c."decayHalfLifeMonths", 1))
  FROM "Evidence" ev
  JOIN rel r          ON r.source_id = ev."competencyId"
  JOIN "Competency" c ON c.id = p_competency_id
  WHERE ev."officialId" = p_official_id
    AND ev."supersededById" IS NULL
    AND ev."occurredAt" <= p_as_of
  ORDER BY 10 DESC;
$$ LANGUAGE sql STABLE;
