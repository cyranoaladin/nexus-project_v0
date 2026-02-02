-- CreateTable: Add cron execution tracking table
-- This prevents duplicate cron job executions (e.g., monthly credit allocation running twice)
--
-- MEDIUM PRIORITY: Prevents duplicate cron runs (INV-CRON-1, INV-CRON-2)
-- Context: Monthly allocation can run twice if cron triggers overlap
-- Risk without tracking: Double credit allocation → financial loss

-- Step 1: Create cron_executions table
CREATE TABLE "cron_executions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "jobName" TEXT NOT NULL,
  "executionKey" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "error" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Create unique index on (jobName, executionKey)
-- This ensures a specific job execution (e.g., "monthly-allocation" for "2026-02") can only run once
CREATE UNIQUE INDEX "cron_executions_job_key"
ON "cron_executions" ("jobName", "executionKey");

-- Step 3: Create index on status for querying running/failed jobs
CREATE INDEX "cron_executions_status_idx"
ON "cron_executions" ("status");

-- Step 4: Create index on startedAt for cleanup/monitoring queries
CREATE INDEX "cron_executions_startedAt_idx"
ON "cron_executions" ("startedAt");
