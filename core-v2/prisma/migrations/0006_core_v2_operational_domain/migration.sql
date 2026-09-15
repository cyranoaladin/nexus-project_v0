-- Core v2 operational domain (go-live mission §T/§U/§Z).
--
-- Part 1 is the DDL Prisma generated for the schema changes
-- (`prisma migrate diff --from-url <db at 0005> --to-schema-datamodel`).
-- Part 2 is the SQL Prisma's DSL cannot express: race-safe partial unique
-- indexes, case-insensitive email uniqueness, the append-only audit trigger,
-- and the database identity generation bump. Runs against a Core v2
-- database only ever populated by tests/CI so far — no legacy row can
-- pre-violate any constraint added here.

-- ────────────────────────────────────────────────────────────────────────────
-- Part 1 — generated DDL
-- ────────────────────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- AlterEnum
BEGIN;
CREATE TYPE "StudentAcademicYearEnrollmentStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'WITHDRAWN');
ALTER TABLE "public"."student_academic_year_enrollments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "student_academic_year_enrollments" ALTER COLUMN "status" TYPE "StudentAcademicYearEnrollmentStatus_new" USING ("status"::text::"StudentAcademicYearEnrollmentStatus_new");
ALTER TYPE "StudentAcademicYearEnrollmentStatus" RENAME TO "StudentAcademicYearEnrollmentStatus_old";
ALTER TYPE "StudentAcademicYearEnrollmentStatus_new" RENAME TO "StudentAcademicYearEnrollmentStatus";
DROP TYPE "public"."StudentAcademicYearEnrollmentStatus_old";
ALTER TABLE "student_academic_year_enrollments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "planning_series_v2" ALTER COLUMN "timezone" DROP DEFAULT;

-- AlterTable
ALTER TABLE "student_academic_year_enrollments" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION';

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_userId_idx" ON "invitations"("userId");

-- CreateIndex
CREATE INDEX "audit_events_subjectType_subjectId_createdAt_idx" ON "audit_events"("subjectType", "subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_correlationId_idx" ON "audit_events"("correlationId");

-- CreateIndex
CREATE INDEX "audit_events_actorUserId_createdAt_idx" ON "audit_events"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- Part 2 — invariants beyond Prisma's DSL
-- ────────────────────────────────────────────────────────────────────────────

-- §T: at most one CURRENT academic year, race-safe. Two concurrent
-- transactions promoting different years both pass any application
-- pre-check; exactly one commits, the other fails on this index.
CREATE UNIQUE INDEX "academic_years_single_current_key"
  ON "academic_years" ("status")
  WHERE "status" = 'CURRENT';

-- §T: at most one primary contact per household, race-safe.
CREATE UNIQUE INDEX "household_parents_primary_contact_key"
  ON "household_parents" ("householdId")
  WHERE "isPrimaryContact" = true;

-- §W: at most one open (not consumed, not revoked) invitation per user.
-- Concurrent resends: each revokes the prior open row, then inserts — the
-- second inserter collides here and is rolled back deterministically.
CREATE UNIQUE INDEX "invitations_open_user_key"
  ON "invitations" ("userId")
  WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL;

-- §T: DB-level case-insensitive email uniqueness, independent of the
-- application-side normalization (belt and braces).
CREATE UNIQUE INDEX "users_email_ci_key"
  ON "users" (lower("email"))
  WHERE "email" IS NOT NULL;

-- §Z: audit history is append-only for every application path. TRUNCATE is
-- deliberately not blocked: it is not reachable through any service, and
-- the disposable test database reset relies on it.
CREATE FUNCTION core_v2_audit_events_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only (attempted %)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "audit_events_immutable"
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION core_v2_audit_events_immutable();

-- Database identity generation: 2 -> 3. lib/core-v2/client.ts refuses any
-- database not at exactly this generation, so a client built from this
-- schema can never run against a database still at the foundation shape.
UPDATE "core_v2_database_identity" SET "schemaGeneration" = 3 WHERE "id" = 1;
