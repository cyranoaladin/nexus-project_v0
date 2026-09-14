-- Companion to 20260913220000: validates the 4 NOT VALID constraints added
-- there, in a separate transaction/migration so validation runs under
-- ShareUpdateExclusiveLock — a lock mode that, per Postgres's own documented
-- locking semantics, does not block concurrent reads/writes regardless of
-- table size. The specific duration numbers this reasoning was checked
-- against (see 20260913230000/230001) came from a synthetic 200k-row
-- disposable-Postgres measurement, not a production-sized sanitized clone —
-- still rehearse against one before deploying to production.

ALTER TABLE "eaf_preparation_reports" VALIDATE CONSTRAINT "eaf_preparation_reports_studentId_fkey";
ALTER TABLE "eaf_preparation_reports" VALIDATE CONSTRAINT "eaf_preparation_reports_coachId_fkey";
ALTER TABLE "session_reports" VALIDATE CONSTRAINT "session_reports_studentId_fkey";
ALTER TABLE "session_reports" VALIDATE CONSTRAINT "session_reports_coachId_fkey";
