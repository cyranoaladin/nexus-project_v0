-- Core v2 password reset (go-live mission §AL/§AT — ACCOUNT flows).
--
-- Part 1 is the DDL Prisma generated for the schema change: invitations carry
-- a purpose (ACTIVATION | PASSWORD_RESET).
-- Part 2: the "one open token per user" partial unique index becomes
-- per (user, purpose) — an open activation and an open reset may coexist,
-- two open resets may not — and the identity generation bump. Existing rows
-- (tests/CI only) default to ACTIVATION, which is what they all were.

-- ────────────────────────────────────────────────────────────────────────────
-- Part 1 — generated DDL
-- ────────────────────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "InvitationPurpose" AS ENUM ('ACTIVATION', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "purpose" "InvitationPurpose" NOT NULL DEFAULT 'ACTIVATION';

-- ────────────────────────────────────────────────────────────────────────────
-- Part 2 — open-token uniqueness per purpose, identity bump
-- ────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS "invitations_open_user_key";

CREATE UNIQUE INDEX "invitations_open_user_purpose_key"
  ON "invitations" ("userId", "purpose")
  WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL;

-- Identity generation: a client expecting generation 4 must refuse this database.
UPDATE "core_v2_database_identity" SET "schemaGeneration" = 5 WHERE "id" = 1;
