-- A85.1: additive optimistic revision and persistent HTTP idempotency.
ALTER TABLE "canonical_assessment_attempts"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "canonical_api_idempotency_keys" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "response" JSONB,
  "responseStatus" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "canonical_api_idempotency_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canonical_api_idempotency_keys_user_route_key_key" UNIQUE ("userId", "route", "key")
);

CREATE INDEX "canonical_api_idempotency_keys_expiresAt_idx"
  ON "canonical_api_idempotency_keys"("expiresAt");
