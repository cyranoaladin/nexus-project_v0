-- Core v1 is the sole credential authority under CORE_V2_AUTH_MODE=V1_ONLY.
-- Core v2 stores only a link to the v1 identity, the provisioning state of that
-- link and non-secret saga data. Additive and forward-only: no existing table,
-- column, row or constraint semantic is removed. The job-outbox payload check
-- only EXPANDS its accepted domain with the new job type.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TYPE "CoreV2JobType" ADD VALUE IF NOT EXISTS 'ACCOUNT_V1_PROVISIONING';

CREATE TYPE "AccountProvisioningState" AS ENUM (
  'REQUESTED', 'V1_ISSUE_PENDING', 'SENT', 'V1_ACTIVATED', 'CORE_PROVISIONED',
  'DELIVERY_FAILED', 'PROVISIONING_RETRY', 'EXPIRED', 'CANCELLED'
);

CREATE TABLE "account_v1_provisioning" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "v1UserId" TEXT,
  "state" "AccountProvisioningState" NOT NULL DEFAULT 'REQUESTED',
  "generation" INTEGER NOT NULL DEFAULT 1,
  "invitationExpiresAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "requestedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "account_v1_provisioning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_v1_provisioning_userId_key" ON "account_v1_provisioning" ("userId");
CREATE UNIQUE INDEX "account_v1_provisioning_v1UserId_key" ON "account_v1_provisioning" ("v1UserId");
CREATE INDEX "account_v1_provisioning_state_idx" ON "account_v1_provisioning" ("state");

ALTER TABLE "account_v1_provisioning"
  ADD CONSTRAINT "account_v1_provisioning_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "account_v1_provisioning"
  ADD CONSTRAINT "account_v1_provisioning_generation_check" CHECK ("generation" >= 1),
  -- An error is a short upper-case code, never free text: nothing sensitive fits.
  ADD CONSTRAINT "account_v1_provisioning_error_code_check"
    CHECK ("lastErrorCode" IS NULL OR "lastErrorCode" ~ '^[A-Z0-9_]{1,64}$'),
  ADD CONSTRAINT "account_v1_provisioning_v1_user_id_check"
    CHECK ("v1UserId" IS NULL OR "v1UserId" ~ '^[A-Za-z0-9_-]{1,128}$'),
  -- A state that claims v1 knows the account must carry the link.
  ADD CONSTRAINT "account_v1_provisioning_link_state_check" CHECK (
    "state" NOT IN ('SENT', 'V1_ACTIVATED', 'CORE_PROVISIONED') OR "v1UserId" IS NOT NULL
  ),
  ADD CONSTRAINT "account_v1_provisioning_sent_expiry_check" CHECK (
    "state" <> 'SENT' OR "invitationExpiresAt" IS NOT NULL
  );

-- The v1 link never changes once set, a provisioned account never leaves that
-- state, and the request counter never goes backwards.
CREATE OR REPLACE FUNCTION account_v1_provisioning_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."userId" <> OLD."userId" THEN
    RAISE EXCEPTION 'ACCOUNT_V1_PROVISIONING_USER_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF OLD."v1UserId" IS NOT NULL AND NEW."v1UserId" IS DISTINCT FROM OLD."v1UserId" THEN
    RAISE EXCEPTION 'ACCOUNT_V1_LINK_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF OLD."state" = 'CORE_PROVISIONED' AND NEW."state" <> OLD."state" THEN
    RAISE EXCEPTION 'ACCOUNT_V1_PROVISIONED_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW."generation" < OLD."generation" THEN
    RAISE EXCEPTION 'ACCOUNT_V1_GENERATION_MONOTONIC' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER account_v1_provisioning_guard
BEFORE UPDATE ON "account_v1_provisioning"
FOR EACH ROW EXECUTE FUNCTION account_v1_provisioning_guard();

ALTER TABLE "core_v2_job_outbox"
  DROP CONSTRAINT "core_v2_job_outbox_payload_check",
  ADD CONSTRAINT "core_v2_job_outbox_payload_check" CHECK (COALESCE(
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
      -- Saga driver: a closed, non-secret key set. No token, hash, password or
      -- e-mail address can be stored in these rows, whatever the writer does.
      WHEN "jobType"::text = 'ACCOUNT_V1_PROVISIONING' THEN
        "aggregateType" = 'ACCOUNT_V1_PROVISIONING'
        AND char_length("aggregateId") BETWEEN 1 AND 128
        AND "payload" ?& ARRAY['schemaVersion', 'userId', 'generation', 'kind']
        AND "payload" - ARRAY['schemaVersion', 'userId', 'generation', 'kind'] = '{}'::jsonb
        AND "payload"->>'schemaVersion' = 'account-v1-provisioning/v1'
        AND jsonb_typeof("payload"->'userId') = 'string'
        AND "payload"->>'userId' = "aggregateId"
        AND jsonb_typeof("payload"->'generation') = 'number'
        AND "payload"->>'generation' ~ '^[1-9][0-9]{0,8}$'
        AND "payload"->>'kind' IN ('ADVANCE', 'REVOKE')
      ELSE false
    END
  , false)) NOT VALID;
ALTER TABLE "core_v2_job_outbox" VALIDATE CONSTRAINT "core_v2_job_outbox_payload_check";
COMMIT;
