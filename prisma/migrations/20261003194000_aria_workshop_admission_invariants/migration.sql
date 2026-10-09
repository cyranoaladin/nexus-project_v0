BEGIN;
ALTER TABLE aria_workshop_sessions ADD COLUMN "admissionRevision" integer NOT NULL DEFAULT 0;
ALTER TABLE aria_workshop_sessions ADD CONSTRAINT aria_workshop_admission_revision_nonnegative CHECK ("admissionRevision" >= 0);
-- Additive guards: no historical rows are changed or deleted.
-- All attendee statuses still occupy a place, preserving existing semantics.
CREATE OR REPLACE FUNCTION aria_workshop_guard_admission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE workshop_capacity integer; workshop_status text; occupied bigint;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW."sessionId" = OLD."sessionId" THEN RETURN NEW; END IF;
 SELECT capacity, status::text INTO workshop_capacity, workshop_status
 FROM aria_workshop_sessions WHERE id=NEW."sessionId" FOR NO KEY UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF; -- Existing foreign key reports a missing session.
 IF workshop_status <> 'SCHEDULED' THEN
  RAISE EXCEPTION 'ARIA_WORKSHOP_NOT_SCHEDULED' USING ERRCODE='23514', CONSTRAINT='aria_workshop_admission_status';
 END IF;
 -- Real MVCC write: stale REPEATABLE READ writers must abort, not count an old snapshot.
 UPDATE aria_workshop_sessions SET "admissionRevision"="admissionRevision"+1 WHERE id=NEW."sessionId";
 SELECT COUNT(*) INTO occupied FROM aria_workshop_attendees
 WHERE "sessionId"=NEW."sessionId" AND id<>NEW.id;
 IF workshop_capacity IS NOT NULL AND occupied >= workshop_capacity THEN
  RAISE EXCEPTION 'ARIA_WORKSHOP_FULL' USING ERRCODE='23514', CONSTRAINT='aria_workshop_admission_capacity';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aria_workshop_admission_guard BEFORE INSERT OR UPDATE OF "sessionId"
 ON aria_workshop_attendees FOR EACH ROW EXECUTE FUNCTION aria_workshop_guard_admission();

CREATE OR REPLACE FUNCTION aria_workshop_guard_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE occupied bigint;
BEGIN
 -- Historical over-capacity rows remain usable for unrelated updates.
 IF TG_OP='UPDATE' AND NEW.capacity IS NOT DISTINCT FROM OLD.capacity THEN RETURN NEW; END IF;
 IF NEW.capacity IS NOT NULL AND NEW.capacity < 1 THEN
  RAISE EXCEPTION 'ARIA_WORKSHOP_CAPACITY_INVALID' USING ERRCODE='23514', CONSTRAINT='aria_workshop_capacity_positive';
 END IF;
 IF TG_OP='UPDATE' AND NEW.capacity IS NOT NULL THEN
  SELECT COUNT(*) INTO occupied FROM aria_workshop_attendees WHERE "sessionId"=NEW.id;
  IF occupied > NEW.capacity THEN
   RAISE EXCEPTION 'ARIA_WORKSHOP_CAPACITY_BELOW_ATTENDANCE' USING ERRCODE='23514', CONSTRAINT='aria_workshop_capacity_existing_attendance';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aria_workshop_capacity_guard BEFORE INSERT OR UPDATE OF capacity
 ON aria_workshop_sessions FOR EACH ROW EXECUTE FUNCTION aria_workshop_guard_capacity();

COMMIT;
