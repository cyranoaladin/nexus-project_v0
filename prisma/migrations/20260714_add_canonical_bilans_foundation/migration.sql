-- Canonical bilans foundation.
-- This migration is additive: it neither changes nor removes legacy assessment,
-- diagnostic, bilan or generated-report tables.

CREATE TYPE "ParentStudentLinkState" AS ENUM ('PENDING_PARENT_CONSENT', 'VERIFIED', 'REVOKED', 'EXPIRED');
CREATE TYPE "CanonicalAssessmentAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'SCORED', 'INVALIDATED');
CREATE TYPE "EvidenceItemKind" AS ENUM ('ANSWER', 'SELF_ASSESSMENT', 'OBSERVATION', 'SCORE_COMPONENT');
CREATE TYPE "ReportArtifactStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ReportRevisionStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "ReportReviewDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');
CREATE TYPE "CanonicalOutboxStatus" AS ENUM ('PENDING', 'LEASED', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "CanonicalJobType" AS ENUM ('SCORE_ATTEMPT', 'GENERATE_REPORT', 'PUBLISH_REPORT', 'SEND_NOTIFICATION');
CREATE TYPE "CanonicalNotificationEventType" AS ENUM ('QUESTIONNAIRE_SUBMITTED', 'REPORT_GENERATED', 'REPORT_REVIEW_REQUESTED', 'REPORT_PUBLISHED');
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP');

CREATE TABLE "canonical_parent_student_links" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "state" "ParentStudentLinkState" NOT NULL DEFAULT 'PENDING_PARENT_CONSENT',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canonical_parent_student_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_assessment_attempts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "CanonicalAssessmentAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "subject" "Subject" NOT NULL,
    "gradeLevel" "GradeLevel" NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "curriculumId" TEXT NOT NULL,
    "curriculumVersion" TEXT NOT NULL,
    "assessmentPackId" TEXT NOT NULL,
    "assessmentPackVersion" TEXT NOT NULL,
    "assessmentPackChecksum" TEXT NOT NULL,
    "scoringPolicyId" TEXT NOT NULL,
    "scoringPolicyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canonical_assessment_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_score_snapshots" (
    "id" TEXT NOT NULL,
    "assessmentAttemptId" TEXT NOT NULL,
    "scoringPolicyId" TEXT NOT NULL,
    "scoringPolicyVersion" TEXT NOT NULL,
    "scoringPolicyChecksum" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "result" JSONB NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_score_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_evidence_items" (
    "id" TEXT NOT NULL,
    "scoreSnapshotId" TEXT NOT NULL,
    "kind" "EvidenceItemKind" NOT NULL,
    "competencyId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_evidence_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_report_artifacts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentAttemptId" TEXT NOT NULL,
    "status" "ReportArtifactStatus" NOT NULL DEFAULT 'DRAFT',
    "currentPublishedRevisionId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canonical_report_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_report_revisions" (
    "id" TEXT NOT NULL,
    "reportArtifactId" TEXT NOT NULL,
    "scoreSnapshotId" TEXT NOT NULL,
    "status" "ReportRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "reportPackId" TEXT NOT NULL,
    "reportPackVersion" TEXT NOT NULL,
    "corpusManifestId" TEXT NOT NULL,
    "corpusManifestVersion" TEXT NOT NULL,
    "promptRevision" TEXT NOT NULL,
    "contextChecksum" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_report_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_report_reviews" (
    "id" TEXT NOT NULL,
    "reportRevisionId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "decision" "ReportReviewDecision" NOT NULL,
    "motif" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_report_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_job_outbox" (
    "id" TEXT NOT NULL,
    "jobType" "CanonicalJobType" NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "sourceEventKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "CanonicalOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canonical_job_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_notification_outbox" (
    "id" TEXT NOT NULL,
    "eventType" "CanonicalNotificationEventType" NOT NULL,
    "sourceEventKey" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "CanonicalOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canonical_notification_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "canonical_parent_student_links_one_active_idx"
ON "canonical_parent_student_links" ("parentUserId", "studentId")
WHERE "state" IN ('PENDING_PARENT_CONSENT', 'VERIFIED');
CREATE INDEX "canonical_parent_student_links_parentUserId_state_idx" ON "canonical_parent_student_links"("parentUserId", "state");
CREATE INDEX "canonical_parent_student_links_studentId_state_idx" ON "canonical_parent_student_links"("studentId", "state");

CREATE INDEX "canonical_assessment_attempts_studentId_status_createdAt_idx" ON "canonical_assessment_attempts"("studentId", "status", "createdAt");
CREATE INDEX "canonical_assessment_attempts_assessmentPackId_assessmentPackVersion_idx" ON "canonical_assessment_attempts"("assessmentPackId", "assessmentPackVersion");
CREATE INDEX "canonical_score_snapshots_assessmentAttemptId_scoredAt_idx" ON "canonical_score_snapshots"("assessmentAttemptId", "scoredAt");
CREATE INDEX "canonical_evidence_items_scoreSnapshotId_kind_idx" ON "canonical_evidence_items"("scoreSnapshotId", "kind");
CREATE UNIQUE INDEX "canonical_report_artifacts_currentPublishedRevisionId_key" ON "canonical_report_artifacts"("currentPublishedRevisionId");
CREATE INDEX "canonical_report_artifacts_studentId_status_createdAt_idx" ON "canonical_report_artifacts"("studentId", "status", "createdAt");
CREATE INDEX "canonical_report_artifacts_assessmentAttemptId_idx" ON "canonical_report_artifacts"("assessmentAttemptId");
CREATE INDEX "canonical_report_revisions_reportArtifactId_createdAt_idx" ON "canonical_report_revisions"("reportArtifactId", "createdAt");
CREATE INDEX "canonical_report_revisions_scoreSnapshotId_idx" ON "canonical_report_revisions"("scoreSnapshotId");
CREATE INDEX "canonical_report_reviews_reportRevisionId_reviewedAt_idx" ON "canonical_report_reviews"("reportRevisionId", "reviewedAt");
CREATE INDEX "canonical_report_reviews_coachId_reviewedAt_idx" ON "canonical_report_reviews"("coachId", "reviewedAt");
CREATE UNIQUE INDEX "canonical_job_outbox_idempotencyKey_key" ON "canonical_job_outbox"("idempotencyKey");
CREATE INDEX "canonical_job_outbox_status_availableAt_idx" ON "canonical_job_outbox"("status", "availableAt");
CREATE INDEX "canonical_job_outbox_status_leaseExpiresAt_idx" ON "canonical_job_outbox"("status", "leaseExpiresAt");
CREATE INDEX "canonical_job_outbox_aggregateType_aggregateId_idx" ON "canonical_job_outbox"("aggregateType", "aggregateId");
CREATE UNIQUE INDEX "canonical_notification_outbox_eventType_sourceEventKey_recipientUserId_key" ON "canonical_notification_outbox"("eventType", "sourceEventKey", "recipientUserId");
CREATE INDEX "canonical_notification_outbox_status_availableAt_idx" ON "canonical_notification_outbox"("status", "availableAt");
CREATE INDEX "canonical_notification_outbox_status_leaseExpiresAt_idx" ON "canonical_notification_outbox"("status", "leaseExpiresAt");
CREATE INDEX "canonical_notification_outbox_recipientUserId_createdAt_idx" ON "canonical_notification_outbox"("recipientUserId", "createdAt");

ALTER TABLE "canonical_parent_student_links"
  ADD CONSTRAINT "canonical_parent_student_links_parentUserId_fkey"
  FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_parent_student_links"
  ADD CONSTRAINT "canonical_parent_student_links_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_assessment_attempts"
  ADD CONSTRAINT "canonical_assessment_attempts_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_score_snapshots"
  ADD CONSTRAINT "canonical_score_snapshots_assessmentAttemptId_fkey"
  FOREIGN KEY ("assessmentAttemptId") REFERENCES "canonical_assessment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_evidence_items"
  ADD CONSTRAINT "canonical_evidence_items_scoreSnapshotId_fkey"
  FOREIGN KEY ("scoreSnapshotId") REFERENCES "canonical_score_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_artifacts"
  ADD CONSTRAINT "canonical_report_artifacts_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_artifacts"
  ADD CONSTRAINT "canonical_report_artifacts_assessmentAttemptId_fkey"
  FOREIGN KEY ("assessmentAttemptId") REFERENCES "canonical_assessment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_revisions"
  ADD CONSTRAINT "canonical_report_revisions_reportArtifactId_fkey"
  FOREIGN KEY ("reportArtifactId") REFERENCES "canonical_report_artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_revisions"
  ADD CONSTRAINT "canonical_report_revisions_scoreSnapshotId_fkey"
  FOREIGN KEY ("scoreSnapshotId") REFERENCES "canonical_score_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_reviews"
  ADD CONSTRAINT "canonical_report_reviews_reportRevisionId_fkey"
  FOREIGN KEY ("reportRevisionId") REFERENCES "canonical_report_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_reviews"
  ADD CONSTRAINT "canonical_report_reviews_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_artifacts"
  ADD CONSTRAINT "canonical_report_artifacts_currentPublishedRevisionId_fkey"
  FOREIGN KEY ("currentPublishedRevisionId") REFERENCES "canonical_report_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "canonical_notification_outbox"
  ADD CONSTRAINT "canonical_notification_outbox_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
