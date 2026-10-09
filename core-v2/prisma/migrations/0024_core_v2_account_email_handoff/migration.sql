-- Add a durable encrypted account-mail handoff without changing old ARIA rows.
-- The payload constraint expands its accepted domain; no table/column/data is removed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TYPE "CoreV2JobType" ADD VALUE IF NOT EXISTS 'ACCOUNT_EMAIL_HANDOFF';
ALTER TABLE "core_v2_job_outbox"
  DROP CONSTRAINT "core_v2_job_outbox_payload_check",
  ADD CONSTRAINT "core_v2_job_outbox_payload_check" CHECK (
    jsonb_typeof("payload") = 'object' AND CASE
      WHEN "jobType"::text = 'RECOVER_ARIA_TURN' THEN
        "payload"->>'schemaVersion' = '1'
        AND jsonb_typeof("payload"->'turnId') = 'string'
      WHEN "jobType"::text = 'ACCOUNT_EMAIL_HANDOFF' THEN
        "aggregateType" = 'ACCOUNT_EMAIL_HANDOFF'
        AND char_length("aggregateId") BETWEEN 1 AND 128
        AND "payload" ?& ARRAY['schemaVersion', 'keyVersion', 'iv', 'tag', 'ciphertext']
        AND "payload" - ARRAY['schemaVersion', 'keyVersion', 'iv', 'tag', 'ciphertext'] = '{}'::jsonb
        AND "payload"->>'schemaVersion' = 'account-email-handoff/v1'
        AND jsonb_typeof("payload"->'keyVersion') = 'string'
        AND "payload"->>'keyVersion' ~ '^[A-Za-z0-9_.-]{1,32}$'
        AND jsonb_typeof("payload"->'iv') = 'string'
        AND "payload"->>'iv' ~ '^[A-Za-z0-9_-]{16}$'
        AND jsonb_typeof("payload"->'tag') = 'string'
        AND "payload"->>'tag' ~ '^[A-Za-z0-9_-]{22}$'
        AND jsonb_typeof("payload"->'ciphertext') = 'string'
        AND char_length("payload"->>'ciphertext') BETWEEN 1 AND 16384
        AND "payload"->>'ciphertext' ~ '^[A-Za-z0-9_-]+$'
      ELSE false
    END
  ) NOT VALID;
ALTER TABLE "core_v2_job_outbox" VALIDATE CONSTRAINT "core_v2_job_outbox_payload_check";
COMMIT;
