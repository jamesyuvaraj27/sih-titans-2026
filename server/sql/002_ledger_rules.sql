-- ════════════════════════════════════════════════════════════════════════
--  THE EVIDENCE LEDGER IS APPEND-ONLY.
--
--  This is enforced in the database, not in application code, because the
--  whole claim of the product is that a competency score is auditable. A
--  claim that rests on "our code doesn't do that" is not auditable; a claim
--  that rests on "the database refuses" is.
--
--  Corrections are made by INSERTing a new row and pointing the old row's
--  supersededById at it — which is itself a write that leaves a trace.
--  The one permitted UPDATE is setting supersededById on a row that does
--  not yet have one (see the trigger below); it can never be un-set or
--  re-pointed, and no other column can be touched.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION evidence_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Evidence is append-only: DELETE is not permitted (id=%)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- only a one-way supersede is allowed
    IF OLD."supersededById" IS NOT NULL THEN
      RAISE EXCEPTION 'Evidence % is already superseded and is immutable', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW."supersededById" IS NULL THEN
      RAISE EXCEPTION 'Evidence is append-only: the only permitted update is setting supersededById'
        USING ERRCODE = 'check_violation';
    END IF;
    IF ROW(NEW.id, NEW."officialId", NEW."competencyId", NEW.kind, NEW.quality,
           NEW."occurredAt", NEW."recordedAt", NEW."sourceType", NEW."sourceRef",
           NEW.summary, NEW.payload)
       IS DISTINCT FROM
       ROW(OLD.id, OLD."officialId", OLD."competencyId", OLD.kind, OLD.quality,
           OLD."occurredAt", OLD."recordedAt", OLD."sourceType", OLD."sourceRef",
           OLD.summary, OLD.payload) THEN
      RAISE EXCEPTION 'Evidence is append-only: no column other than supersededById may change'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS evidence_append_only ON "Evidence";
CREATE TRIGGER evidence_append_only
  BEFORE UPDATE OR DELETE ON "Evidence"
  FOR EACH ROW EXECUTE FUNCTION evidence_guard();
