-- Canonical assessment engine v1.
--
-- This migration is additive. It preserves every legacy assessment, canonical
-- attempt, score and report row. New normalized responses are authoritative
-- only for attempts linked to a canonical assignment.

CREATE TYPE "CanonicalAssessmentAssignmentStatus" AS ENUM (
  'DRAFT', 'ASSIGNED', 'AVAILABLE', 'CLOSED', 'REVOKED'
);
CREATE TYPE "CanonicalAssessmentResponseType" AS ENUM (
  'AUTOMATIC_QCM', 'MANUAL_SHORT_RESPONSE'
);
CREATE TYPE "CanonicalAssessmentAutomaticOutcome" AS ENUM (
  'AUTOMATIC_CORRECT', 'INCORRECT', 'TECHNICALLY_INVALID'
);
CREATE TYPE "CanonicalManualReviewStatus" AS ENUM (
  'PENDING', 'CLAIMED', 'COMPLETED'
);
CREATE TYPE "CanonicalScoreResultKind" AS ENUM ('PROVISIONAL', 'FINAL');
CREATE TYPE "CanonicalCalibrationStatus" AS ENUM (
  'PENDING_POLICY_VALIDATION', 'PROVISIONAL', 'FINAL'
);
CREATE TYPE "AssessmentIdempotencyScope" AS ENUM (
  'CREATE_ASSIGNMENT',
  'START_ATTEMPT',
  'AUTOSAVE_RESPONSE',
  'SUBMIT_ATTEMPT',
  'CLAIM_MANUAL_REVIEW',
  'COMPLETE_MANUAL_REVIEW',
  'SCORE_ATTEMPT',
  'GENERATE_REPORT',
  'APPROVE_REPORT',
  'PUBLISH_REPORT',
  'REVOKE_REPORT'
);
CREATE TYPE "AssessmentIdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
CREATE TYPE "AssessmentAuditEventType" AS ENUM (
  'ASSIGNMENT_CREATED',
  'ASSIGNMENT_REVOKED',
  'ATTEMPT_STARTED',
  'RESPONSE_AUTOSAVED',
  'ATTEMPT_SUBMITTED',
  'ATTEMPT_CANCELLED',
  'MANUAL_REVIEW_CLAIMED',
  'MANUAL_REVIEW_RELEASED',
  'MANUAL_REVIEW_COMPLETED',
  'MANUAL_REVIEW_REVISED',
  'SCORE_PROVISIONAL_CREATED',
  'SCORE_FINAL_CREATED',
  'SCORING_FAILED',
  'REPORT_GENERATED',
  'REPORT_APPROVED',
  'REPORT_PUBLISHED',
  'REPORT_REVOKED'
);
CREATE TYPE "ReportPublicationStatus" AS ENUM ('PUBLISHED', 'REVOKED');

CREATE UNIQUE INDEX "canonical_bilan_requests_id_student_key"
  ON "canonical_bilan_requests"("id", "studentId");

CREATE TABLE "canonical_assessment_assignments" (
  "id" TEXT NOT NULL,
  "bilanRequestId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "definitionVersion" TEXT NOT NULL,
  "definitionChecksum" TEXT NOT NULL,
  "manifestVersion" INTEGER NOT NULL,
  "manifestChecksum" TEXT NOT NULL,
  "moduleCatalogVersion" TEXT NOT NULL,
  "moduleCatalogChecksum" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3) NOT NULL,
  "opensAt" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3),
  "status" "CanonicalAssessmentAssignmentStatus" NOT NULL DEFAULT 'DRAFT',
  "maxAttempts" INTEGER NOT NULL DEFAULT 1,
  "assignedByUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "idempotencyRequestHash" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "canonical_assessment_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canonical_assessment_assignments_attempt_policy_check"
    CHECK ("maxAttempts" BETWEEN 1 AND 10),
  CONSTRAINT "canonical_assessment_assignments_window_check"
    CHECK ("dueAt" IS NULL OR "dueAt" > "opensAt"),
  CONSTRAINT "canonical_assessment_assignments_hashes_check"
    CHECK (
      "definitionChecksum" ~ '^sha256:[a-f0-9]{64}$'
      AND "manifestChecksum" ~ '^sha256:[a-f0-9]{64}$'
      AND "moduleCatalogChecksum" ~ '^sha256:[a-f0-9]{64}$'
      AND "idempotencyRequestHash" ~ '^sha256:[a-f0-9]{64}$'
    ),
  CONSTRAINT "canonical_assessment_assignments_terminal_state_check"
    CHECK (
      (
        "status" = 'REVOKED'
        AND "revokedAt" IS NOT NULL
        AND "revocationReason" IS NOT NULL
        AND BTRIM("revocationReason") <> ''
      )
      OR (
        "status" <> 'REVOKED'
        AND "revokedAt" IS NULL
        AND "revocationReason" IS NULL
      )
    ),
  CONSTRAINT "canonical_assessment_assignments_closed_state_check"
    CHECK (
      ("status" = 'CLOSED' AND "closedAt" IS NOT NULL)
      OR ("status" <> 'CLOSED' AND "closedAt" IS NULL)
    )
);

CREATE UNIQUE INDEX "canonical_assessment_assignments_idempotencyKey_key"
  ON "canonical_assessment_assignments"("idempotencyKey");
CREATE UNIQUE INDEX "canonical_assessment_assignments_id_studentId_key"
  ON "canonical_assessment_assignments"("id", "studentId");
CREATE INDEX "canonical_assessment_assignments_bilanRequestId_status_open_idx"
  ON "canonical_assessment_assignments"("bilanRequestId", "status", "opensAt");
CREATE INDEX "canonical_assessment_assignments_studentId_status_opensAt_idx"
  ON "canonical_assessment_assignments"("studentId", "status", "opensAt");
CREATE INDEX "canonical_assessment_assignments_definitionId_definitionVer_idx"
  ON "canonical_assessment_assignments"(
    "definitionId", "definitionVersion", "definitionChecksum"
  );

ALTER TABLE "canonical_assessment_assignments"
  ADD CONSTRAINT "canonical_assessment_assignments_request_student_fkey"
  FOREIGN KEY ("bilanRequestId", "studentId")
  REFERENCES "canonical_bilan_requests"("id", "studentId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_assessment_assignments"
  ADD CONSTRAINT "canonical_assessment_assignments_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_assessment_assignments"
  ADD CONSTRAINT "canonical_assessment_assignments_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION canonical_bilans_guard_assignment_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical assessment assignments cannot be deleted';
  END IF;
  IF OLD."status" <> NEW."status" AND NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" IN ('ASSIGNED', 'REVOKED'))
    OR (OLD."status" = 'ASSIGNED' AND NEW."status" IN ('AVAILABLE', 'CLOSED', 'REVOKED'))
    OR (OLD."status" = 'AVAILABLE' AND NEW."status" IN ('CLOSED', 'REVOKED'))
  ) THEN
    RAISE EXCEPTION 'illegal canonical assessment assignment transition: % -> %',
      OLD."status", NEW."status";
  END IF;
  IF OLD."status" <> 'DRAFT' AND (
    NEW."bilanRequestId" IS DISTINCT FROM OLD."bilanRequestId"
    OR NEW."studentId" IS DISTINCT FROM OLD."studentId"
    OR NEW."definitionId" IS DISTINCT FROM OLD."definitionId"
    OR NEW."moduleId" IS DISTINCT FROM OLD."moduleId"
    OR NEW."definitionVersion" IS DISTINCT FROM OLD."definitionVersion"
    OR NEW."definitionChecksum" IS DISTINCT FROM OLD."definitionChecksum"
    OR NEW."manifestVersion" IS DISTINCT FROM OLD."manifestVersion"
    OR NEW."manifestChecksum" IS DISTINCT FROM OLD."manifestChecksum"
    OR NEW."moduleCatalogVersion" IS DISTINCT FROM OLD."moduleCatalogVersion"
    OR NEW."moduleCatalogChecksum" IS DISTINCT FROM OLD."moduleCatalogChecksum"
    OR NEW."resolvedAt" IS DISTINCT FROM OLD."resolvedAt"
    OR NEW."assignedByUserId" IS DISTINCT FROM OLD."assignedByUserId"
    OR NEW."maxAttempts" IS DISTINCT FROM OLD."maxAttempts"
  ) THEN
    RAISE EXCEPTION 'canonical assessment assignment provenance is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "canonical_assessment_assignments_lifecycle_guard"
  BEFORE UPDATE OR DELETE ON "canonical_assessment_assignments"
  FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_assignment_mutation();

ALTER TABLE "canonical_assessment_attempts"
  ADD COLUMN "assignmentId" TEXT,
  ADD COLUMN "attemptNumber" INTEGER,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastAutosavedAt" TIMESTAMP(3),
  ADD COLUMN "sealedAt" TIMESTAMP(3),
  ADD COLUMN "submissionHash" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT;

ALTER TABLE "canonical_assessment_attempts"
  ADD CONSTRAINT "canonical_assessment_attempts_engine_fields_check"
  CHECK (
    ("attemptNumber" IS NULL OR "attemptNumber" > 0)
    AND ("version" >= 0)
    AND (
      "submissionHash" IS NULL
      OR "submissionHash" ~ '^sha256:[a-f0-9]{64}$'
    )
    AND (
      ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL
        AND "cancellationReason" IS NOT NULL
        AND BTRIM("cancellationReason") <> '')
      OR ("status" <> 'CANCELLED' AND "cancelledAt" IS NULL
        AND "cancellationReason" IS NULL)
    )
  );

CREATE UNIQUE INDEX "canonical_assessment_attempts_assignmentId_attemptNumber_key"
  ON "canonical_assessment_attempts"("assignmentId", "attemptNumber");
CREATE INDEX "canonical_assessment_attempts_assignmentId_status_createdAt_idx"
  ON "canonical_assessment_attempts"("assignmentId", "status", "createdAt");
ALTER TABLE "canonical_assessment_attempts"
  ADD CONSTRAINT "canonical_assessment_attempts_assignment_student_fkey"
  FOREIGN KEY ("assignmentId", "studentId")
  REFERENCES "canonical_assessment_assignments"("id", "studentId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION canonical_bilans_reject_submitted_attempt_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" NOT IN ('IN_PROGRESS', 'DRAFT') THEN
      RAISE EXCEPTION 'canonical assessment attempts are immutable after submission';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" <> NEW."status" AND NOT (
    (OLD."status" IN ('IN_PROGRESS', 'DRAFT')
      AND NEW."status" IN (
        'SUBMITTED', 'PENDING_MANUAL_REVIEW', 'CANCELLED', 'INVALIDATED'
      ))
    OR (OLD."status" = 'PENDING_MANUAL_REVIEW'
      AND NEW."status" IN ('SUBMITTED', 'CANCELLED', 'INVALIDATED'))
    OR (OLD."status" = 'SUBMITTED'
      AND NEW."status" IN (
        'PENDING_MANUAL_REVIEW', 'SCORED', 'SCORING_FAILED', 'CANCELLED', 'INVALIDATED'
      ))
    OR (OLD."status" = 'SCORING_FAILED' AND NEW."status" = 'SUBMITTED')
    OR (OLD."status" = 'SCORED'
      AND NEW."status" IN (
        'REPORT_PENDING_REVIEW', 'REPORT_GENERATION_FAILED', 'INVALIDATED'
      ))
    OR (OLD."status" = 'REPORT_GENERATION_FAILED' AND NEW."status" = 'SCORED')
    OR (OLD."status" = 'REPORT_PENDING_REVIEW'
      AND NEW."status" IN ('COACH_VALIDATED', 'COACH_REJECTED'))
    OR (OLD."status" = 'COACH_REJECTED' AND NEW."status" = 'SCORED')
    OR (OLD."status" = 'COACH_VALIDATED' AND NEW."status" = 'PUBLISHED')
    OR (OLD."status" = 'PUBLISHED' AND NEW."status" = 'SCORED')
  ) THEN
    RAISE EXCEPTION 'illegal canonical assessment attempt lifecycle transition: % -> %',
      OLD."status", NEW."status";
  END IF;

  IF OLD."status" NOT IN ('IN_PROGRESS', 'DRAFT') AND (
    NEW."studentId" IS DISTINCT FROM OLD."studentId"
    OR NEW."assignmentId" IS DISTINCT FROM OLD."assignmentId"
    OR NEW."attemptNumber" IS DISTINCT FROM OLD."attemptNumber"
    OR NEW."subject" IS DISTINCT FROM OLD."subject"
    OR NEW."gradeLevel" IS DISTINCT FROM OLD."gradeLevel"
    OR NEW."answers" IS DISTINCT FROM OLD."answers"
    OR NEW."startedAt" IS DISTINCT FROM OLD."startedAt"
    OR NEW."lastAutosavedAt" IS DISTINCT FROM OLD."lastAutosavedAt"
    OR NEW."sealedAt" IS DISTINCT FROM OLD."sealedAt"
    OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
    OR NEW."submissionHash" IS DISTINCT FROM OLD."submissionHash"
    OR NEW."curriculumId" IS DISTINCT FROM OLD."curriculumId"
    OR NEW."curriculumVersion" IS DISTINCT FROM OLD."curriculumVersion"
    OR NEW."assessmentPackId" IS DISTINCT FROM OLD."assessmentPackId"
    OR NEW."assessmentPackVersion" IS DISTINCT FROM OLD."assessmentPackVersion"
    OR NEW."assessmentPackChecksum" IS DISTINCT FROM OLD."assessmentPackChecksum"
    OR NEW."scoringPolicyId" IS DISTINCT FROM OLD."scoringPolicyId"
    OR NEW."scoringPolicyVersion" IS DISTINCT FROM OLD."scoringPolicyVersion"
  ) THEN
    RAISE EXCEPTION 'submitted canonical assessment provenance is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE "canonical_assessment_responses" (
  "id" TEXT NOT NULL,
  "assessmentAttemptId" TEXT NOT NULL,
  "itemId" VARCHAR(160) NOT NULL,
  "responseType" "CanonicalAssessmentResponseType" NOT NULL,
  "selectedOptionIndex" INTEGER,
  "textValue" VARCHAR(2000),
  "version" INTEGER NOT NULL DEFAULT 1,
  "lastAutosavedAt" TIMESTAMP(3) NOT NULL,
  "sealedAt" TIMESTAMP(3),
  "automaticOutcome" "CanonicalAssessmentAutomaticOutcome",
  "automaticPoints" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "canonical_assessment_responses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canonical_assessment_responses_content_check"
    CHECK (
      "version" >= 1
      AND (
        (
          "responseType" = 'AUTOMATIC_QCM'
          AND "selectedOptionIndex" BETWEEN 0 AND 3
          AND "textValue" IS NULL
          AND (
            ("automaticOutcome" IS NULL AND "automaticPoints" IS NULL)
            OR ("automaticOutcome" = 'AUTOMATIC_CORRECT' AND "automaticPoints" = 1)
            OR ("automaticOutcome" = 'INCORRECT' AND "automaticPoints" = 0)
            OR ("automaticOutcome" = 'TECHNICALLY_INVALID' AND "automaticPoints" IS NULL)
          )
        )
        OR (
          "responseType" = 'MANUAL_SHORT_RESPONSE'
          AND "selectedOptionIndex" IS NULL
          AND "textValue" IS NOT NULL
          AND BTRIM("textValue") <> ''
          AND "automaticOutcome" IS NULL
          AND "automaticPoints" IS NULL
        )
      )
    )
);

CREATE UNIQUE INDEX "canonical_assessment_responses_assessmentAttemptId_itemId_key"
  ON "canonical_assessment_responses"("assessmentAttemptId", "itemId");
CREATE UNIQUE INDEX "canonical_assessment_responses_id_assessmentAttemptId_key"
  ON "canonical_assessment_responses"("id", "assessmentAttemptId");
CREATE INDEX "canonical_assessment_responses_assessmentAttemptId_sealedAt_idx"
  ON "canonical_assessment_responses"("assessmentAttemptId", "sealedAt");
ALTER TABLE "canonical_assessment_responses"
  ADD CONSTRAINT "canonical_assessment_responses_assessmentAttemptId_fkey"
  FOREIGN KEY ("assessmentAttemptId")
  REFERENCES "canonical_assessment_attempts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION canonical_bilans_guard_assessment_response()
RETURNS TRIGGER AS $$
DECLARE
  attempt_status "CanonicalAssessmentAttemptStatus";
  attempt_sealed TIMESTAMP(3);
BEGIN
  SELECT "status", "sealedAt"
  INTO attempt_status, attempt_sealed
  FROM "canonical_assessment_attempts"
  WHERE "id" = COALESCE(NEW."assessmentAttemptId", OLD."assessmentAttemptId")
  FOR UPDATE;

  IF attempt_status IS NULL THEN
    RAISE EXCEPTION 'canonical assessment response attempt is missing';
  END IF;
  IF TG_OP <> 'INSERT' AND OLD."sealedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'sealed canonical assessment responses are immutable';
  END IF;
  IF attempt_status NOT IN ('IN_PROGRESS', 'DRAFT') OR attempt_sealed IS NOT NULL THEN
    RAISE EXCEPTION 'canonical assessment response attempt is sealed';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "canonical_assessment_responses_sealed_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "canonical_assessment_responses"
  FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_assessment_response();

CREATE TABLE "canonical_manual_review_tasks" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "assessmentAttemptId" TEXT NOT NULL,
  "status" "CanonicalManualReviewStatus" NOT NULL DEFAULT 'PENDING',
  "claimedByUserId" TEXT,
  "claimLeaseExpiresAt" TIMESTAMP(3),
  "claimVersion" INTEGER NOT NULL DEFAULT 0,
  "currentDecisionId" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "canonical_manual_review_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canonical_manual_review_tasks_state_check"
    CHECK (
      "claimVersion" >= 0
      AND (
        (
          "status" = 'PENDING'
          AND "claimedByUserId" IS NULL
          AND "claimLeaseExpiresAt" IS NULL
          AND "currentDecisionId" IS NULL
          AND "completedAt" IS NULL
        )
        OR (
          "status" = 'CLAIMED'
          AND "claimedByUserId" IS NOT NULL
          AND "claimLeaseExpiresAt" IS NOT NULL
          AND "currentDecisionId" IS NULL
          AND "completedAt" IS NULL
        )
        OR (
          "status" = 'COMPLETED'
          AND "claimedByUserId" IS NOT NULL
          AND "claimLeaseExpiresAt" IS NULL
          AND "currentDecisionId" IS NOT NULL
          AND "completedAt" IS NOT NULL
        )
      )
    )
);

CREATE TABLE "canonical_manual_review_decisions" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "awardedPoints" DOUBLE PRECISION NOT NULL,
  "maxPoints" DOUBLE PRECISION NOT NULL,
  "internalComment" TEXT,
  "publishableComment" TEXT,
  "rubricVersion" TEXT NOT NULL,
  "supersedesDecisionId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "idempotencyRequestHash" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "canonical_manual_review_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canonical_manual_review_decisions_score_check"
    CHECK (
      "version" > 0
      AND "maxPoints" > 0
      AND "awardedPoints" >= 0
      AND "awardedPoints" <= "maxPoints"
      AND BTRIM("rubricVersion") <> ''
      AND "idempotencyRequestHash" ~ '^sha256:[a-f0-9]{64}$'
    )
);

CREATE UNIQUE INDEX "canonical_manual_review_tasks_responseId_key"
  ON "canonical_manual_review_tasks"("responseId");
CREATE UNIQUE INDEX "canonical_manual_review_tasks_currentDecisionId_key"
  ON "canonical_manual_review_tasks"("currentDecisionId");
CREATE UNIQUE INDEX "canonical_manual_review_tasks_currentDecisionId_id_key"
  ON "canonical_manual_review_tasks"("currentDecisionId", "id");
CREATE UNIQUE INDEX "canonical_manual_review_tasks_responseId_assessmentAttemptI_key"
  ON "canonical_manual_review_tasks"("responseId", "assessmentAttemptId");
CREATE INDEX "canonical_manual_review_tasks_status_claimLeaseExpiresAt_cr_idx"
  ON "canonical_manual_review_tasks"("status", "claimLeaseExpiresAt", "createdAt");
CREATE INDEX "canonical_manual_review_tasks_assessmentAttemptId_status_cr_idx"
  ON "canonical_manual_review_tasks"("assessmentAttemptId", "status", "createdAt");
CREATE INDEX "canonical_manual_review_tasks_claimedByUserId_status_claimL_idx"
  ON "canonical_manual_review_tasks"(
    "claimedByUserId", "status", "claimLeaseExpiresAt"
  );

CREATE UNIQUE INDEX "canonical_manual_review_decisions_supersedesDecisionId_key"
  ON "canonical_manual_review_decisions"("supersedesDecisionId");
CREATE UNIQUE INDEX "canonical_manual_review_decisions_idempotencyKey_key"
  ON "canonical_manual_review_decisions"("idempotencyKey");
CREATE UNIQUE INDEX "canonical_manual_review_decisions_taskId_version_key"
  ON "canonical_manual_review_decisions"("taskId", "version");
CREATE UNIQUE INDEX "canonical_manual_review_decisions_id_taskId_key"
  ON "canonical_manual_review_decisions"("id", "taskId");
CREATE INDEX "canonical_manual_review_decisions_reviewerUserId_decidedAt_idx"
  ON "canonical_manual_review_decisions"("reviewerUserId", "decidedAt");

ALTER TABLE "canonical_manual_review_tasks"
  ADD CONSTRAINT "canonical_manual_review_tasks_response_attempt_fkey"
  FOREIGN KEY ("responseId", "assessmentAttemptId")
  REFERENCES "canonical_assessment_responses"("id", "assessmentAttemptId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_manual_review_tasks"
  ADD CONSTRAINT "canonical_manual_review_tasks_assessmentAttemptId_fkey"
  FOREIGN KEY ("assessmentAttemptId")
  REFERENCES "canonical_assessment_attempts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_manual_review_tasks"
  ADD CONSTRAINT "canonical_manual_review_tasks_claimedByUserId_fkey"
  FOREIGN KEY ("claimedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_manual_review_decisions"
  ADD CONSTRAINT "canonical_manual_review_decisions_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "canonical_manual_review_tasks"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_manual_review_decisions"
  ADD CONSTRAINT "canonical_manual_review_decisions_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_manual_review_decisions"
  ADD CONSTRAINT "canonical_manual_review_decisions_supersedesDecisionId_fkey"
  FOREIGN KEY ("supersedesDecisionId")
  REFERENCES "canonical_manual_review_decisions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_manual_review_tasks"
  ADD CONSTRAINT "canonical_manual_review_tasks_current_decision_fkey"
  FOREIGN KEY ("currentDecisionId", "id")
  REFERENCES "canonical_manual_review_decisions"("id", "taskId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "canonical_manual_review_decisions_append_only"
  BEFORE UPDATE OR DELETE ON "canonical_manual_review_decisions"
  FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();

ALTER TABLE "canonical_score_snapshots"
  ADD COLUMN "inputChecksum" TEXT,
  ADD COLUMN "resultKind" "CanonicalScoreResultKind" NOT NULL DEFAULT 'FINAL',
  -- Historical snapshots did not record their maximum. Keep the backfill NULL
  -- rather than inventing a denominator; every v1 engine write supplies one.
  ADD COLUMN "maxScore" DOUBLE PRECISION,
  ADD COLUMN "calibrationStatus" "CanonicalCalibrationStatus"
    NOT NULL DEFAULT 'PENDING_POLICY_VALIDATION',
  ADD COLUMN "calibrationPolicyId" TEXT,
  ADD COLUMN "calibrationPolicyVersion" TEXT,
  ADD COLUMN "calibrationPolicyChecksum" TEXT,
  ADD COLUMN "recommendation" JSONB;

ALTER TABLE "canonical_score_snapshots"
  ADD CONSTRAINT "canonical_score_snapshots_engine_check"
  CHECK (
    (
      "inputChecksum" IS NULL
      AND "maxScore" IS NULL
    )
    OR (
      "inputChecksum" ~ '^sha256:[a-f0-9]{64}$'
      AND "maxScore" IS NOT NULL
      AND "maxScore" >= 0
      AND "score" >= 0
      AND "score" <= "maxScore"
    )
  );
ALTER TABLE "canonical_score_snapshots"
  ADD CONSTRAINT "canonical_score_snapshots_calibration_check"
  CHECK (
      "calibrationStatus" = 'PENDING_POLICY_VALIDATION'
      OR (
        "calibrationPolicyId" IS NOT NULL
        AND "calibrationPolicyVersion" IS NOT NULL
        AND "calibrationPolicyChecksum" ~ '^sha256:[a-f0-9]{64}$'
      )
  );
CREATE UNIQUE INDEX "canonical_score_snapshots_deterministic_key"
  ON "canonical_score_snapshots"(
    "assessmentAttemptId",
    "scoringPolicyId",
    "scoringPolicyVersion",
    "inputChecksum",
    "resultKind"
  );

CREATE OR REPLACE FUNCTION canonical_bilans_require_manual_review_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."resultKind" = 'FINAL' AND EXISTS (
    SELECT 1
    FROM "canonical_manual_review_tasks"
    WHERE "assessmentAttemptId" = NEW."assessmentAttemptId"
      AND "status" <> 'COMPLETED'
  ) THEN
    RAISE EXCEPTION 'final scoring requires every manual review to be completed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "canonical_score_snapshots_manual_gate"
  BEFORE INSERT ON "canonical_score_snapshots"
  FOR EACH ROW EXECUTE FUNCTION canonical_bilans_require_manual_review_completion();

CREATE OR REPLACE FUNCTION canonical_bilans_require_final_report_score()
RETURNS TRIGGER AS $$
DECLARE score_kind "CanonicalScoreResultKind";
BEGIN
  SELECT "resultKind" INTO score_kind
  FROM "canonical_score_snapshots"
  WHERE "id" = NEW."scoreSnapshotId";
  IF score_kind IS DISTINCT FROM 'FINAL' THEN
    RAISE EXCEPTION 'report generation requires a final score snapshot';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "canonical_report_revisions_final_score_guard"
  BEFORE INSERT OR UPDATE ON "canonical_report_revisions"
  FOR EACH ROW EXECUTE FUNCTION canonical_bilans_require_final_report_score();

CREATE TABLE "canonical_assessment_idempotency" (
  "id" TEXT NOT NULL,
  "scope" "AssessmentIdempotencyScope" NOT NULL,
  "actorKey" VARCHAR(200) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" "AssessmentIdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "resourceId" TEXT,
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "canonical_assessment_idempotency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canonical_assessment_idempotency_values_check"
    CHECK (
      BTRIM("actorKey") <> ''
      AND LENGTH("idempotencyKey") BETWEEN 16 AND 128
      AND "idempotencyKey" ~ '^[A-Za-z0-9_-]+$'
      AND "requestHash" ~ '^sha256:[a-f0-9]{64}$'
      AND (
        ("status" = 'IN_PROGRESS' AND "response" IS NULL)
        OR ("status" = 'COMPLETED' AND "resourceId" IS NOT NULL
          AND "response" IS NOT NULL)
      )
    )
);
CREATE UNIQUE INDEX "canonical_assessment_idempotency_scope_actorKey_idempotency_key"
  ON "canonical_assessment_idempotency"("scope", "actorKey", "idempotencyKey");
CREATE INDEX "canonical_assessment_idempotency_status_createdAt_idx"
  ON "canonical_assessment_idempotency"("status", "createdAt");

CREATE TABLE "canonical_assessment_audit_events" (
  "id" TEXT NOT NULL,
  "bilanRequestId" TEXT NOT NULL,
  "assignmentId" TEXT,
  "assessmentAttemptId" TEXT,
  "eventType" "AssessmentAuditEventType" NOT NULL,
  "actorUserId" TEXT,
  "actor" "BilanRequestActor" NOT NULL,
  "correlationId" VARCHAR(160) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "canonical_assessment_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canonical_assessment_audit_events_correlation_check"
    CHECK (BTRIM("correlationId") <> '')
);
CREATE INDEX "canonical_assessment_audit_events_bilanRequestId_occurredAt_idx"
  ON "canonical_assessment_audit_events"("bilanRequestId", "occurredAt");
CREATE INDEX "canonical_assessment_audit_events_assignmentId_occurredAt_idx"
  ON "canonical_assessment_audit_events"("assignmentId", "occurredAt");
CREATE INDEX "canonical_assessment_audit_events_assessmentAttemptId_occur_idx"
  ON "canonical_assessment_audit_events"("assessmentAttemptId", "occurredAt");
CREATE INDEX "canonical_assessment_audit_events_eventType_occurredAt_idx"
  ON "canonical_assessment_audit_events"("eventType", "occurredAt");
ALTER TABLE "canonical_assessment_audit_events"
  ADD CONSTRAINT "canonical_assessment_audit_events_bilanRequestId_fkey"
  FOREIGN KEY ("bilanRequestId") REFERENCES "canonical_bilan_requests"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_assessment_audit_events"
  ADD CONSTRAINT "canonical_assessment_audit_events_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "canonical_assessment_assignments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_assessment_audit_events"
  ADD CONSTRAINT "canonical_assessment_audit_events_assessmentAttemptId_fkey"
  FOREIGN KEY ("assessmentAttemptId")
  REFERENCES "canonical_assessment_attempts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_assessment_audit_events"
  ADD CONSTRAINT "canonical_assessment_audit_events_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TRIGGER "canonical_assessment_audit_events_append_only"
  BEFORE UPDATE OR DELETE ON "canonical_assessment_audit_events"
  FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();

CREATE TABLE "canonical_report_publications" (
  "id" TEXT NOT NULL,
  "reportArtifactId" TEXT NOT NULL,
  "reportRevisionId" TEXT NOT NULL,
  "audience" "ReportAudience" NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ReportPublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
  "publishedByUserId" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedByUserId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "idempotencyRequestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "canonical_report_publications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canonical_report_publications_state_check"
    CHECK (
      "version" > 0
      AND "idempotencyRequestHash" ~ '^sha256:[a-f0-9]{64}$'
      AND (
        ("status" = 'PUBLISHED'
          AND "revokedByUserId" IS NULL
          AND "revokedAt" IS NULL
          AND "revocationReason" IS NULL)
        OR ("status" = 'REVOKED'
          AND "revokedByUserId" IS NOT NULL
          AND "revokedAt" IS NOT NULL
          AND "revocationReason" IS NOT NULL
          AND BTRIM("revocationReason") <> '')
      )
    )
);
CREATE UNIQUE INDEX "canonical_report_publications_idempotencyKey_key"
  ON "canonical_report_publications"("idempotencyKey");
CREATE UNIQUE INDEX "canonical_report_publications_reportArtifactId_version_key"
  ON "canonical_report_publications"("reportArtifactId", "version");
CREATE UNIQUE INDEX "canonical_report_publications_one_active_idx"
  ON "canonical_report_publications"("reportArtifactId")
  WHERE "status" = 'PUBLISHED';
CREATE INDEX "canonical_report_publications_reportArtifactId_status_publi_idx"
  ON "canonical_report_publications"(
    "reportArtifactId", "status", "publishedAt"
  );
CREATE INDEX "canonical_report_publications_audience_status_publishedAt_idx"
  ON "canonical_report_publications"("audience", "status", "publishedAt");
ALTER TABLE "canonical_report_publications"
  ADD CONSTRAINT "canonical_report_publications_reportArtifactId_fkey"
  FOREIGN KEY ("reportArtifactId") REFERENCES "canonical_report_artifacts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_publications"
  ADD CONSTRAINT "canonical_report_publications_revision_artifact_fkey"
  FOREIGN KEY ("reportRevisionId", "reportArtifactId")
  REFERENCES "canonical_report_revisions"("id", "reportArtifactId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_publications"
  ADD CONSTRAINT "canonical_report_publications_publishedByUserId_fkey"
  FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_publications"
  ADD CONSTRAINT "canonical_report_publications_revokedByUserId_fkey"
  FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION canonical_bilans_guard_report_publication_history()
RETURNS TRIGGER AS $$
DECLARE artifact_audience "ReportAudience";
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical report publication history is immutable';
  END IF;

  SELECT "audience" INTO artifact_audience
  FROM "canonical_report_artifacts"
  WHERE "id" = NEW."reportArtifactId";
  IF artifact_audience IS DISTINCT FROM NEW."audience" THEN
    RAISE EXCEPTION 'canonical report publication audience mismatch';
  END IF;

  IF TG_OP = 'UPDATE' AND NOT (
    OLD."status" = 'PUBLISHED'
    AND NEW."status" = 'REVOKED'
    AND NEW."reportArtifactId" IS NOT DISTINCT FROM OLD."reportArtifactId"
    AND NEW."reportRevisionId" IS NOT DISTINCT FROM OLD."reportRevisionId"
    AND NEW."audience" IS NOT DISTINCT FROM OLD."audience"
    AND NEW."version" IS NOT DISTINCT FROM OLD."version"
    AND NEW."publishedByUserId" IS NOT DISTINCT FROM OLD."publishedByUserId"
    AND NEW."publishedAt" IS NOT DISTINCT FROM OLD."publishedAt"
    AND NEW."idempotencyKey" IS NOT DISTINCT FROM OLD."idempotencyKey"
    AND NEW."idempotencyRequestHash" IS NOT DISTINCT FROM OLD."idempotencyRequestHash"
    AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
    AND NEW."revokedByUserId" IS NOT NULL
    AND NEW."revokedAt" IS NOT NULL
    AND NEW."revocationReason" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'canonical report publication history is immutable outside revocation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "canonical_report_publications_history_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "canonical_report_publications"
  FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_report_publication_history();
