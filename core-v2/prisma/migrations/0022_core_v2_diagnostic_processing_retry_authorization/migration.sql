-- One additional extraction is allowed only by a fully snapshotted,
-- audited operator authorization. Nullable columns preserve compatibility
-- with the previous application release and all existing processing rows.
ALTER TABLE "diagnostic_submission_processings"
  ADD COLUMN "retryAuthorizationOperationId" TEXT,
  ADD COLUMN "retryAuthorizationActorId" TEXT,
  ADD COLUMN "retryAuthorizationAt" TIMESTAMP(3),
  ADD COLUMN "retryAuthorizationReason" TEXT,
  ADD COLUMN "retryAuthorizationReleaseSha" TEXT,
  ADD COLUMN "retrySubmissionIdSnapshot" TEXT,
  ADD COLUMN "retrySubmissionVersionSnapshot" INTEGER,
  ADD COLUMN "retrySubmissionSha256Snapshot" TEXT,
  ADD COLUMN "retrySubjectVersionSnapshot" TEXT,
  ADD COLUMN "retryExtractionIdSnapshot" TEXT,
  ADD COLUMN "retryExtractionRevisionSnapshot" INTEGER,
  ADD COLUMN "retryExtractionErrorSnapshot" TEXT,
  ADD COLUMN "retryAttemptCountSnapshot" INTEGER,
  ADD COLUMN "retryAuthorizationConsumedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "diagnostic_submission_processings_retry_operation_key"
  ON "diagnostic_submission_processings"("retryAuthorizationOperationId");

ALTER TABLE "diagnostic_submission_processings"
  ADD CONSTRAINT "diagnostic_processing_retry_authorization_all_or_none"
  CHECK (
    ("retryAuthorizationOperationId" IS NULL
      AND "retryAuthorizationActorId" IS NULL
      AND "retryAuthorizationAt" IS NULL
      AND "retryAuthorizationReason" IS NULL
      AND "retryAuthorizationReleaseSha" IS NULL
      AND "retrySubmissionIdSnapshot" IS NULL
      AND "retrySubmissionVersionSnapshot" IS NULL
      AND "retrySubmissionSha256Snapshot" IS NULL
      AND "retrySubjectVersionSnapshot" IS NULL
      AND "retryExtractionIdSnapshot" IS NULL
      AND "retryExtractionRevisionSnapshot" IS NULL
      AND "retryExtractionErrorSnapshot" IS NULL
      AND "retryAttemptCountSnapshot" IS NULL
      AND "retryAuthorizationConsumedAt" IS NULL)
    OR
    ("retryAuthorizationOperationId" IS NOT NULL
      AND "retryAuthorizationActorId" IS NOT NULL
      AND "retryAuthorizationAt" IS NOT NULL
      AND "retryAuthorizationReason" IS NOT NULL
      AND "retryAuthorizationReleaseSha" IS NOT NULL
      AND "retrySubmissionIdSnapshot" IS NOT NULL
      AND "retrySubmissionVersionSnapshot" IS NOT NULL
      AND "retrySubmissionSha256Snapshot" IS NOT NULL
      AND "retrySubjectVersionSnapshot" IS NOT NULL
      AND "retryExtractionIdSnapshot" IS NOT NULL
      AND "retryExtractionRevisionSnapshot" IS NOT NULL
      AND "retryExtractionErrorSnapshot" IS NOT NULL
      AND "retryAttemptCountSnapshot" = 5)
  );
