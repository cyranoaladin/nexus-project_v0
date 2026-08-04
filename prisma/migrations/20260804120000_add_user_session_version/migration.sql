-- Deployment order (production execution is outside this change set):
-- 1. Back up and run the read-only preflight.
-- 2. Apply this additive migration before activating the new code.
-- 3. Verify the column, its default, and historical User cohorts.
-- 4. Activate the code and require legacy JWT holders to authenticate again.
-- 5. For an application rollback, keep this unused additive column in place.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;
