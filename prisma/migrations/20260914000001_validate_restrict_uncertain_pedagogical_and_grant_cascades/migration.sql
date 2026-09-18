-- Companion to 20260914000000: validates the 6 NOT VALID constraints added
-- there, in a separate transaction/migration so validation runs under
-- ShareUpdateExclusiveLock instead of AccessExclusiveLock.

ALTER TABLE "entitlements" VALIDATE CONSTRAINT "entitlements_userId_fkey";
ALTER TABLE "maths_progress" VALIDATE CONSTRAINT "maths_progress_userId_fkey";
ALTER TABLE "nsi_practice_progress" VALIDATE CONSTRAINT "nsi_practice_progress_userId_fkey";
ALTER TABLE "eam_progress" VALIDATE CONSTRAINT "eam_progress_user_id_fkey";
ALTER TABLE "projection_history" VALIDATE CONSTRAINT "projection_history_studentId_fkey";
ALTER TABLE "survival_progress" VALIDATE CONSTRAINT "survival_progress_studentId_fkey";
