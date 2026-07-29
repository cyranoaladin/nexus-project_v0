-- Canonical free-assessment request persistence.
--
-- This migration is additive for legacy Assessment, Bilan and report data.
-- Existing report artifacts are deliberately classified as NEXUS (the private
-- internal audience) because their former schema did not prove a public
-- audience. Existing notification recipients are backfilled from their user id.

CREATE TYPE "BilanAccountVerificationState" AS ENUM (
  'UNVERIFIED',
  'VERIFICATION_PENDING',
  'VERIFIED'
);

CREATE TYPE "BilanRequestStatus" AS ENUM (
  'NEW',
  'READY_FOR_ASSESSMENT',
  'ASSESSMENT_IN_PROGRESS',
  'ASSESSMENT_SUBMITTED',
  'SCORED',
  'REVIEW_PENDING',
  'PUBLISHED',
  'HUMAN_FOLLOWUP_REQUIRED',
  'TECHNICAL_ACTION_REQUIRED',
  'CANCELLED'
);

CREATE TYPE "BilanRequestActor" AS ENUM (
  'SYSTEM',
  'PARENT_FLOW',
  'WORKER',
  'ASSISTANTE',
  'COACH',
  'ADMIN'
);

CREATE TYPE "BilanRequestEventType" AS ENUM (
  'REQUEST_CREATED',
  'ACCOUNT_VERIFICATION_REQUESTED',
  'ACCOUNT_VERIFIED',
  'CHILD_SELECTED',
  'CHILD_CREATED',
  'ASSESSMENT_STARTED',
  'ASSESSMENT_AUTOSAVE_CHECKPOINTED',
  'ASSESSMENT_SUBMITTED',
  'ASSESSMENT_SCORED',
  'ASSESSMENT_SCORING_FAILED',
  'REPORT_READY_FOR_REVIEW',
  'REPORT_APPROVED',
  'REPORT_REJECTED',
  'REPORT_PUBLISHED',
  'HUMAN_FOLLOWUP_REQUIRED',
  'TECHNICAL_ACTION_REQUIRED',
  'NOTIFICATION_DELIVERY_FAILED',
  'REQUEST_CANCELLED'
);

CREATE TYPE "BilanAcquisitionChannel" AS ENUM (
  'WEBSITE',
  'WHATSAPP',
  'PHONE',
  'EMAIL',
  'REFERRAL',
  'CAMPAIGN',
  'OTHER'
);

CREATE TYPE "ReportAudience" AS ENUM ('STUDENT', 'PARENT', 'NEXUS');

ALTER TYPE "CanonicalNotificationEventType"
  ADD VALUE IF NOT EXISTS 'BILAN_REQUEST_CREATED';
ALTER TYPE "CanonicalNotificationEventType"
  ADD VALUE IF NOT EXISTS 'ASSESSMENT_SUBMITTED';
ALTER TYPE "CanonicalNotificationEventType"
  ADD VALUE IF NOT EXISTS 'TECHNICAL_ACTION_REQUIRED';
ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'EMAIL';

CREATE TABLE "canonical_bilan_requests" (
  "id" TEXT NOT NULL,
  "parentUserId" TEXT,
  "studentId" TEXT,
  "canonicalAttemptId" TEXT,
  "provisionalChildFirstName" VARCHAR(80),
  "provisionalChildLastName" VARCHAR(80),
  "provisionalChildSchoolName" VARCHAR(160),
  "subject" "Subject" NOT NULL,
  "gradeLevel" "GradeLevel" NOT NULL,
  "schoolYear" VARCHAR(20) NOT NULL,
  "academicTrack" "AcademicTrack",
  "speciality" "Subject",
  "mainNeed" VARCHAR(500) NOT NULL,
  "message" VARCHAR(1000),
  "campaignKey" VARCHAR(160),
  "offerKey" VARCHAR(160),
  "sourcePath" VARCHAR(300),
  "acquisitionChannel" "BilanAcquisitionChannel" NOT NULL DEFAULT 'WEBSITE',
  "acquisitionMetadata" JSONB,
  "consent" BOOLEAN NOT NULL,
  "consentVersion" VARCHAR(80) NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "status" "BilanRequestStatus" NOT NULL DEFAULT 'NEW',
  "accountVerificationState" "BilanAccountVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
  "assignedCoachId" TEXT,
  "submissionHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),

  CONSTRAINT "canonical_bilan_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canonical_bilan_requests_consent_check" CHECK ("consent" IS TRUE)
);

CREATE TABLE "canonical_bilan_request_events" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "type" "BilanRequestEventType" NOT NULL,
  "actor" "BilanRequestActor" NOT NULL,
  "correlationId" VARCHAR(160) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "canonical_bilan_request_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_bilan_flow_sessions" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "canonical_bilan_flow_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_bilan_magic_links" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "parentUserId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "canonical_bilan_magic_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "canonical_bilan_requests_canonicalAttemptId_key"
  ON "canonical_bilan_requests"("canonicalAttemptId");
CREATE UNIQUE INDEX "canonical_bilan_requests_submissionHash_key"
  ON "canonical_bilan_requests"("submissionHash");
CREATE INDEX "canonical_bilan_requests_parentUserId_createdAt_idx"
  ON "canonical_bilan_requests"("parentUserId", "createdAt");
CREATE INDEX "canonical_bilan_requests_studentId_createdAt_idx"
  ON "canonical_bilan_requests"("studentId", "createdAt");
CREATE INDEX "canonical_bilan_requests_assignedCoachId_status_lastActivit_idx"
  ON "canonical_bilan_requests"("assignedCoachId", "status", "lastActivityAt");
CREATE INDEX "canonical_bilan_requests_status_lastActivityAt_idx"
  ON "canonical_bilan_requests"("status", "lastActivityAt");
CREATE INDEX "canonical_bilan_requests_subject_gradeLevel_schoolYear_idx"
  ON "canonical_bilan_requests"("subject", "gradeLevel", "schoolYear");

CREATE INDEX "canonical_bilan_request_events_requestId_occurredAt_idx"
  ON "canonical_bilan_request_events"("requestId", "occurredAt");
CREATE INDEX "canonical_bilan_request_events_requestId_type_occurredAt_idx"
  ON "canonical_bilan_request_events"("requestId", "type", "occurredAt");

CREATE UNIQUE INDEX "canonical_bilan_flow_sessions_tokenHash_key"
  ON "canonical_bilan_flow_sessions"("tokenHash");
CREATE INDEX "canonical_bilan_flow_sessions_requestId_expiresAt_idx"
  ON "canonical_bilan_flow_sessions"("requestId", "expiresAt");
CREATE INDEX "canonical_bilan_flow_sessions_expiresAt_revokedAt_idx"
  ON "canonical_bilan_flow_sessions"("expiresAt", "revokedAt");

CREATE UNIQUE INDEX "canonical_bilan_magic_links_tokenHash_key"
  ON "canonical_bilan_magic_links"("tokenHash");
CREATE INDEX "canonical_bilan_magic_links_requestId_expiresAt_idx"
  ON "canonical_bilan_magic_links"("requestId", "expiresAt");
CREATE INDEX "canonical_bilan_magic_links_parentUserId_createdAt_idx"
  ON "canonical_bilan_magic_links"("parentUserId", "createdAt");
CREATE INDEX "canonical_bilan_magic_links_expiresAt_consumedAt_revokedAt_idx"
  ON "canonical_bilan_magic_links"("expiresAt", "consumedAt", "revokedAt");

ALTER TABLE "canonical_bilan_requests"
  ADD CONSTRAINT "canonical_bilan_requests_parentUserId_fkey"
  FOREIGN KEY ("parentUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_bilan_requests"
  ADD CONSTRAINT "canonical_bilan_requests_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_bilan_requests"
  ADD CONSTRAINT "canonical_bilan_requests_canonicalAttemptId_fkey"
  FOREIGN KEY ("canonicalAttemptId") REFERENCES "canonical_assessment_attempts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_bilan_requests"
  ADD CONSTRAINT "canonical_bilan_requests_assignedCoachId_fkey"
  FOREIGN KEY ("assignedCoachId") REFERENCES "coach_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "canonical_bilan_request_events"
  ADD CONSTRAINT "canonical_bilan_request_events_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "canonical_bilan_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canonical_bilan_flow_sessions"
  ADD CONSTRAINT "canonical_bilan_flow_sessions_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "canonical_bilan_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canonical_bilan_magic_links"
  ADD CONSTRAINT "canonical_bilan_magic_links_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "canonical_bilan_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canonical_bilan_magic_links"
  ADD CONSTRAINT "canonical_bilan_magic_links_parentUserId_fkey"
  FOREIGN KEY ("parentUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Historical report artifacts did not carry an audience. NEXUS is the only
-- safe backfill because it cannot expose content to a parent or student.
ALTER TABLE "canonical_report_artifacts"
  ADD COLUMN "audience" "ReportAudience";
UPDATE "canonical_report_artifacts"
  SET "audience" = 'NEXUS'
  WHERE "audience" IS NULL;
ALTER TABLE "canonical_report_artifacts"
  ALTER COLUMN "audience" SET DEFAULT 'NEXUS',
  ALTER COLUMN "audience" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "canonical_report_artifacts"
    GROUP BY "assessmentAttemptId", "audience"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'duplicate canonical report artifacts require an explicit audience audit before migration';
  END IF;
END
$$;

CREATE UNIQUE INDEX "canonical_report_artifacts_assessmentAttemptId_audience_key"
  ON "canonical_report_artifacts"("assessmentAttemptId", "audience");

-- The pre-existing composite foreign key is the database guarantee that a
-- published revision belongs to the same artifact. Because the audience is
-- owned by that artifact, a Nexus revision cannot be published by a Parent
-- artifact (or vice versa).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'canonical_report_artifacts_current_revision_same_artifact_fkey'
      AND conrelid = 'canonical_report_artifacts'::regclass
  ) THEN
    RAISE EXCEPTION
      'canonical_report_artifacts_current_revision_same_artifact_fkey is required';
  END IF;
END
$$;

-- "Active" is intentionally defined as "not explicitly revoked". PostgreSQL
-- partial-index predicates cannot safely use now(), and an expired timestamp
-- alone must not make two concurrent family links authoritative. Historical
-- terminal rows are marked revoked before the stronger unique index is built.
UPDATE "canonical_parent_student_links"
SET
  "revokedAt" = COALESCE("revokedAt", "expiresAt", "updatedAt", CURRENT_TIMESTAMP),
  "revokedReason" = COALESCE("revokedReason", 'Canonical link closed before non-revoked uniqueness')
WHERE "revokedAt" IS NULL
  AND "state" IN ('REVOKED', 'EXPIRED');

DROP INDEX "canonical_parent_student_links_one_active_idx";
CREATE UNIQUE INDEX "canonical_parent_student_links_one_active_idx"
  ON "canonical_parent_student_links"("parentUserId", "studentId")
  WHERE "revokedAt" IS NULL;

-- Generalize notification destinations without losing existing user rows.
ALTER TABLE "canonical_notification_outbox"
  ADD COLUMN "recipientKey" TEXT,
  ADD COLUMN "recipientAddress" TEXT;

UPDATE "canonical_notification_outbox"
  SET "recipientKey" = 'user:' || "recipientUserId"
  WHERE "recipientKey" IS NULL;

ALTER TABLE "canonical_notification_outbox"
  ALTER COLUMN "recipientKey" SET NOT NULL,
  ALTER COLUMN "recipientUserId" DROP NOT NULL;

ALTER TABLE "canonical_notification_outbox"
  ADD CONSTRAINT "canonical_notification_outbox_recipient_key_check"
  CHECK (BTRIM("recipientKey") <> ''),
  ADD CONSTRAINT "canonical_notification_outbox_destination_check"
  CHECK (
    (
      "channel"::text = 'EMAIL'
      AND "recipientAddress" IS NOT NULL
      AND BTRIM("recipientAddress") <> ''
    )
    OR (
      "channel"::text = 'WHATSAPP'
      AND "recipientUserId" IS NOT NULL
    )
  );

DROP INDEX "canonical_notification_outbox_eventType_sourceEventKey_recipientUserId_key";
CREATE UNIQUE INDEX "canonical_notification_outbox_eventType_sourceEventKey_reci_key"
  ON "canonical_notification_outbox"("eventType", "sourceEventKey", "recipientKey");
