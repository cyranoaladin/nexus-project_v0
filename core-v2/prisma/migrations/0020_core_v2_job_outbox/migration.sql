-- Generic, minimal Core v2 job outbox. The first job type is the ARIA turn
-- watchdog; recovery never carries message content or personal data.
CREATE TYPE "CoreV2JobType" AS ENUM ('RECOVER_ARIA_TURN');
CREATE TYPE "CoreV2JobStatus" AS ENUM ('PENDING', 'LEASED', 'RETRY_SCHEDULED', 'COMPLETED', 'FAILED_FINAL');

CREATE TABLE "core_v2_job_outbox" (
  "id" TEXT NOT NULL,
  "jobType" "CoreV2JobType" NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "CoreV2JobStatus" NOT NULL DEFAULT 'PENDING',
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "core_v2_job_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "core_v2_job_outbox_idempotencyKey_key" ON "core_v2_job_outbox" ("idempotencyKey");
CREATE INDEX "core_v2_job_outbox_status_availableAt_idx" ON "core_v2_job_outbox" ("status", "availableAt");
CREATE INDEX "core_v2_job_outbox_status_leaseExpiresAt_idx" ON "core_v2_job_outbox" ("status", "leaseExpiresAt");
CREATE INDEX "core_v2_job_outbox_aggregateType_aggregateId_idx" ON "core_v2_job_outbox" ("aggregateType", "aggregateId");

ALTER TABLE "core_v2_job_outbox"
  ADD CONSTRAINT "core_v2_job_outbox_attempt_count_check"
    CHECK ("attemptCount" >= 0),
  ADD CONSTRAINT "core_v2_job_outbox_payload_check"
    CHECK (
      jsonb_typeof("payload") = 'object'
      AND "payload"->>'schemaVersion' = '1'
      AND jsonb_typeof("payload"->'turnId') = 'string'
    ),
  ADD CONSTRAINT "core_v2_job_outbox_last_error_check"
    CHECK ("lastError" IS NULL OR char_length("lastError") <= 512),
  ADD CONSTRAINT "core_v2_job_outbox_lease_shape_check"
    CHECK (
      ("status" = 'LEASED' AND "leaseOwner" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL)
      OR
      ("status" <> 'LEASED' AND "leaseOwner" IS NULL AND "leaseExpiresAt" IS NULL)
    ),
  ADD CONSTRAINT "core_v2_job_outbox_completed_shape_check"
    CHECK (
      ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL)
      OR
      ("status" <> 'COMPLETED' AND "completedAt" IS NULL)
    );

CREATE OR REPLACE FUNCTION core_v2_job_outbox_terminal_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" IN ('COMPLETED', 'FAILED_FINAL') AND NEW."status" <> OLD."status" THEN
    RAISE EXCEPTION 'CORE_V2_JOB_TERMINAL_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER core_v2_job_outbox_terminal_guard
BEFORE UPDATE OF "status" ON "core_v2_job_outbox"
FOR EACH ROW EXECUTE FUNCTION core_v2_job_outbox_terminal_guard();
