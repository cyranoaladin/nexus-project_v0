-- Companion to 20260913230000: validates the 12 NOT VALID constraints
-- added there, in a separate transaction/migration so validation runs
-- under ShareUpdateExclusiveLock — a lock mode that, per Postgres's own
-- documented locking semantics, does not block concurrent reads/writes
-- regardless of table size (credit_transactions, sessions in particular).
-- The specific duration numbers this reasoning was checked against (see
-- 20260913230000) came from a synthetic 200k-row disposable-Postgres
-- measurement, not a production-sized sanitized clone — still rehearse
-- against one before deploying to production.

ALTER TABLE "credit_transactions" VALIDATE CONSTRAINT "credit_transactions_studentId_fkey";
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_studentId_fkey";
ALTER TABLE "progression_history" VALIDATE CONSTRAINT "progression_history_studentId_fkey";
ALTER TABLE "trajectories" VALIDATE CONSTRAINT "trajectories_studentId_fkey";
ALTER TABLE "pedagogical_reports" VALIDATE CONSTRAINT "pedagogical_reports_studentId_fkey";
ALTER TABLE "generated_pedagogical_reports" VALIDATE CONSTRAINT "generated_pedagogical_reports_studentId_fkey";
ALTER TABLE "student_reports" VALIDATE CONSTRAINT "student_reports_studentId_fkey";
ALTER TABLE "stage_bilans" VALIDATE CONSTRAINT "stage_bilans_studentId_fkey";
ALTER TABLE "candidate_diagnostics" VALIDATE CONSTRAINT "candidate_diagnostics_studentId_fkey";
ALTER TABLE "candidate_diagnostic_consents" VALIDATE CONSTRAINT "candidate_diagnostic_consents_studentId_fkey";
ALTER TABLE "subscription_requests" VALIDATE CONSTRAINT "subscription_requests_studentId_fkey";
ALTER TABLE "copy_submissions" VALIDATE CONSTRAINT "copy_submissions_studentId_fkey";
