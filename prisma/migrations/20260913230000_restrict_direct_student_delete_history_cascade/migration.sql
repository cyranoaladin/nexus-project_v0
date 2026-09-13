-- Zero-debt go-live audit, finding DELETE-5 (found while building the
-- exhaustive FK inventory for #273): `DELETE /api/admin/users` can target
-- a STUDENT's own user row directly (not just a parent's), which cascades
-- User->Student (students_userId_fkey, Cascade — unchanged, that relation
-- is the student's own account and is meant to go with it) and then
-- Student's own children. 12 of those children still held real,
-- independent history and were still ON DELETE CASCADE: real billing
-- (credit_transactions), real session records (sessions), real academic
-- progress (progression_history, trajectories), real reports
-- (pedagogical_reports, generated_pedagogical_reports, student_reports,
-- stage_bilans), real diagnostic/compliance records (candidate_diagnostics,
-- candidate_diagnostic_consents), a real billing request record
-- (subscription_requests), and real submitted student work
-- (copy_submissions) — none of which are covered by any Restrict
-- constraint from 20260913200000 or 20260913210000.
--
-- Proven reachable: __tests__/db/admin-users-delete-restrict.db.test.ts's
-- very first test already deletes a STUDENT's own user row directly
-- (`DELETE(deleteRequest(studentUser.id))`), and was already correctly
-- expecting a 409 there only because `subscriptions_studentId_fkey`
-- happened to be Restrict — the other 12 relations audited here were not
-- protected by any constraint on that same reachable path.
--
-- Left as CASCADE (reviewed, not overlooked): re-derivable caches/gamified
-- or high-volume signal data with no independent audit/financial/reporting
-- value — aria_activity_attempts, aria_cockpit_profiles, aria_feedbacks,
-- aria_learning_profiles, aria_workshop_attendees, student_badges,
-- survival_progress, projection_history, aria_conversation_turns (its
-- subjectStudentId FK is a denormalized mirror of the composite key on
-- AriaConversation, whose own studentId FK is already Restrict, so it is
-- unreachable in practice once any conversation exists).
--
-- Pure behavior-change migration: does not touch any existing row or
-- column, only the ON DELETE action of already-existing foreign keys —
-- safe to apply against any current data.
--
-- Operational lock impact — the one migration in this batch most likely to
-- touch a genuinely large table (credit_transactions, sessions): each ADD
-- CONSTRAINT below is NOT VALID (skips the existing-row scan, near-instant,
-- brief AccessExclusiveLock — same as DROP CONSTRAINT already takes); the
-- following migration (20260913230001) validates all 12 in a separate
-- transaction under ShareUpdateExclusiveLock, which does not block
-- concurrent reads/writes. Measured on a real disposable Postgres seeded
-- with 200k synthetic credit_transactions rows: plain ADD CONSTRAINT (no
-- NOT VALID) held AccessExclusiveLock for its full 45ms scan (confirmed via
-- a concurrent pg_locks read while the ALTER was held open in a
-- transaction); a standalone VALIDATE CONSTRAINT took 58ms holding only
-- ShareUpdateExclusiveLock (also confirmed via pg_locks). `prisma migrate
-- deploy` runs one migration.sql per transaction, so NOT VALID and VALIDATE
-- CONSTRAINT must be in separate migration files to get the weaker lock in
-- production — putting both in this same file would hold
-- AccessExclusiveLock for the whole transaction regardless.

ALTER TABLE "credit_transactions" DROP CONSTRAINT "credit_transactions_studentId_fkey";
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_studentId_fkey";
ALTER TABLE "progression_history" DROP CONSTRAINT "progression_history_studentId_fkey";
ALTER TABLE "trajectories" DROP CONSTRAINT "trajectories_studentId_fkey";
ALTER TABLE "pedagogical_reports" DROP CONSTRAINT "pedagogical_reports_studentId_fkey";
ALTER TABLE "generated_pedagogical_reports" DROP CONSTRAINT "generated_pedagogical_reports_studentId_fkey";
ALTER TABLE "student_reports" DROP CONSTRAINT "student_reports_studentId_fkey";
ALTER TABLE "stage_bilans" DROP CONSTRAINT "stage_bilans_studentId_fkey";
ALTER TABLE "candidate_diagnostics" DROP CONSTRAINT "candidate_diagnostics_studentId_fkey";
ALTER TABLE "candidate_diagnostic_consents" DROP CONSTRAINT "candidate_diagnostic_consents_studentId_fkey";
ALTER TABLE "subscription_requests" DROP CONSTRAINT "subscription_requests_studentId_fkey";
ALTER TABLE "copy_submissions" DROP CONSTRAINT "copy_submissions_studentId_fkey";

ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "progression_history" ADD CONSTRAINT "progression_history_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "trajectories" ADD CONSTRAINT "trajectories_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "pedagogical_reports" ADD CONSTRAINT "pedagogical_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "generated_pedagogical_reports" ADD CONSTRAINT "generated_pedagogical_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "student_reports" ADD CONSTRAINT "student_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "stage_bilans" ADD CONSTRAINT "stage_bilans_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "candidate_diagnostics" ADD CONSTRAINT "candidate_diagnostics_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "candidate_diagnostic_consents" ADD CONSTRAINT "candidate_diagnostic_consents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "copy_submissions" ADD CONSTRAINT "copy_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
