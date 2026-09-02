-- Additive M1 lineage: APPLY runs can reference the exact sealed DRY_RUN they consume.
-- Enforcement that every APPLY must carry this link is activated after all four workers write it.

ALTER TABLE "aria_data_migration_runs"
  ADD COLUMN "prerequisiteRunId" TEXT;

ALTER TABLE "aria_data_migration_runs"
  ADD CONSTRAINT "aria_data_migration_runs_prerequisiteRunId_fkey"
  FOREIGN KEY ("prerequisiteRunId")
  REFERENCES "aria_data_migration_runs"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE INDEX "aria_data_migration_runs_prerequisiteRunId_idx"
  ON "aria_data_migration_runs"("prerequisiteRunId");
