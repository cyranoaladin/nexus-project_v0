-- Companion to 20260913220000: validates the 4 NOT VALID constraints added
-- there, in a separate transaction/migration so validation runs under
-- ShareUpdateExclusiveLock instead of AccessExclusiveLock — safe against a
-- production-sized table without blocking concurrent reads/writes.

ALTER TABLE "eaf_preparation_reports" VALIDATE CONSTRAINT "eaf_preparation_reports_studentId_fkey";
ALTER TABLE "eaf_preparation_reports" VALIDATE CONSTRAINT "eaf_preparation_reports_coachId_fkey";
ALTER TABLE "session_reports" VALIDATE CONSTRAINT "session_reports_studentId_fkey";
ALTER TABLE "session_reports" VALIDATE CONSTRAINT "session_reports_coachId_fkey";
