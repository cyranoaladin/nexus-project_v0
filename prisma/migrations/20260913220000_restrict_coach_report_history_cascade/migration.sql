-- Zero-debt go-live audit, finding DELETE-4 (found while building the
-- exhaustive FK inventory for #273): `DELETE /api/assistante/coaches/manage/[id]`
-- deletes a CoachProfile directly (`tx.coachProfile.delete(...)`), which is
-- a live, currently-reachable delete path independent of the 11 Restrict
-- constraints added by 20260913200000 (those only fire for relations
-- pointed at directly from User/Student, not this CoachProfile-first path).
-- `eaf_preparation_reports` and `session_reports` both hold real,
-- independent pedagogical write-up content (rubric text, session summary,
-- progress notes, recommendations) tied to a coach and/or student via
-- coachId/studentId, and were still ON DELETE CASCADE on both sides —
-- meaning a coach or student with prior reports on file, but zero
-- SessionBooking/CoachStudentAssignment rows left, would still pass the
-- existing guard and then silently lose that report history.
--
-- Changes all 4 remaining FKs (eaf_preparation_reports.{studentId,coachId},
-- session_reports.{studentId,coachId}) from CASCADE to RESTRICT.
-- session_reports.sessionId -> SessionBooking stays CASCADE: a
-- SessionReport has no independent meaning once its own SessionBooking is
-- deleted, which is a distinct, intentional dependent-child relationship.
--
-- Pure behavior-change migration: does not touch any existing row or
-- column, only the ON DELETE action of already-existing foreign keys —
-- safe to apply against any current data.
--
-- Operational lock impact: each ADD CONSTRAINT below is NOT VALID (skips
-- the existing-row scan, near-instant, brief AccessExclusiveLock — same as
-- DROP CONSTRAINT already takes); the following migration
-- (20260913220001) validates all 4 in a separate transaction under
-- ShareUpdateExclusiveLock, which does not block concurrent reads/writes.
-- Measured on a real disposable Postgres: see 20260913210000's comment for
-- the methodology and numbers (45ms AccessExclusiveLock scan avoided per
-- constraint at 200k rows; 58ms ShareUpdateExclusiveLock validation
-- instead). `prisma migrate deploy` runs one migration.sql per
-- transaction, so NOT VALID and VALIDATE CONSTRAINT must be in separate
-- migration files to get the weaker lock in production.

-- DropForeignKey
ALTER TABLE "eaf_preparation_reports" DROP CONSTRAINT "eaf_preparation_reports_studentId_fkey";
ALTER TABLE "eaf_preparation_reports" DROP CONSTRAINT "eaf_preparation_reports_coachId_fkey";
ALTER TABLE "session_reports" DROP CONSTRAINT "session_reports_studentId_fkey";
ALTER TABLE "session_reports" DROP CONSTRAINT "session_reports_coachId_fkey";

-- AddForeignKey (NOT VALID; validated by the following migration)
ALTER TABLE "eaf_preparation_reports" ADD CONSTRAINT "eaf_preparation_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "eaf_preparation_reports" ADD CONSTRAINT "eaf_preparation_reports_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
