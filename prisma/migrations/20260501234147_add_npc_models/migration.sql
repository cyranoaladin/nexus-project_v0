-- NPC - Nexus Pedagogy Cockpit Migration
-- Created: 2026-05-01
-- PR#1: Data Model for AI-driven pedagogical diagnostics

-- Create ENUMs
CREATE TYPE "CopySubmissionStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'PROCESSING_OCR', 'OCR_FAILED', 'READY_FOR_AI', 'QUEUED_FOR_ANALYSIS', 'ANALYZING', 'ANALYSIS_FAILED', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "AssessmentSourceType" AS ENUM ('DS', 'DM', 'BILAN', 'STAGE', 'ANNALES', 'EXERCICE', 'COMPOSITION', 'AUTRE');
CREATE TYPE "CopyPageStatus" AS ENUM ('UPLOADED', 'PENDING_CONVERSION', 'CONVERTING', 'CONVERSION_FAILED', 'READY', 'PROCESSING', 'ERROR');
CREATE TYPE "AiJobType" AS ENUM ('VISION_OCR', 'PEDAGOGICAL_DIAGNOSIS', 'COMPETENCE_MATRIX', 'REMEDIATION_ROADMAP', 'MENTOR_ADVICE');
CREATE TYPE "AiJobStatus" AS ENUM ('PENDING', 'QUEUED', 'CLAIMED', 'PROCESSING', 'RETRYING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "AiJobPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "PedagogicalReportStatus" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'SENT_TO_STUDENT', 'READ_BY_STUDENT', 'ARCHIVED');
CREATE TYPE "ReportVisibility" AS ENUM ('COACH_ONLY', 'COACH_AND_STUDENT', 'STUDENT_SUMMARY_ONLY');
CREATE TYPE "FeedbackType" AS ENUM ('TECHNICAL_ERROR', 'PEDAGOGICAL_INACCURACY', 'MISSING_REMEDIATION', 'OVERLY_GENERIC', 'STUDENT_MISUNDERSTOOD', 'COACH_DISAGREES', 'POSITIVE', 'OTHER');

-- Create CopySubmission table
CREATE TABLE "copy_submissions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "studentId" TEXT NOT NULL,
    "coachId" TEXT,
    "subject" "Subject" NOT NULL,
    "gradeLevel" "GradeLevel",
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" "AssessmentSourceType" NOT NULL DEFAULT 'AUTRE',
    "sourceId" TEXT,
    "status" "CopySubmissionStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "ocrText" TEXT,
    "ocrError" TEXT,
    "aiJobId" TEXT,
    "storedFilePath" TEXT,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT,

    CONSTRAINT "copy_submissions_pkey" PRIMARY KEY ("id")
);

-- Create AssessmentSource table
CREATE TABLE "assessment_sources" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssessmentSourceType" NOT NULL,
    "isOfficialAnnale" BOOLEAN NOT NULL DEFAULT false,
    "year" INTEGER,
    "examType" TEXT,
    "subject" "Subject" NOT NULL,
    "gradeLevel" "GradeLevel",
    "academicTrack" "AcademicTrack",

    CONSTRAINT "assessment_sources_pkey" PRIMARY KEY ("id")
);

-- Create CopyPage table
CREATE TABLE "copy_pages" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submissionId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "status" "CopyPageStatus" NOT NULL DEFAULT 'UPLOADED',
    "originalFilePath" TEXT NOT NULL,
    "convertedFilePaths" TEXT[],
    "ocrText" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "copy_pages_pkey" PRIMARY KEY ("id")
);

-- Create AiProcessingJob table
CREATE TABLE "ai_processing_jobs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "AiJobType" NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "AiJobPriority" NOT NULL DEFAULT 'NORMAL',
    "copySubmissionId" TEXT,
    "inputData" JSONB,
    "outputData" JSONB,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "processingDurationMs" INTEGER,
    "chutesRequestId" TEXT,
    "tokensUsed" INTEGER,
    "modelVersion" TEXT,

    CONSTRAINT "ai_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- Create PedagogicalReport table
CREATE TABLE "pedagogical_reports" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "copySubmissionId" TEXT,
    "studentId" TEXT NOT NULL,
    "coachId" TEXT,
    "status" "PedagogicalReportStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ReportVisibility" NOT NULL DEFAULT 'COACH_ONLY',
    "diagnostic" JSONB NOT NULL,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "rawAiOutput" JSONB,
    "validatedAiOutput" JSONB,
    "sentToStudentAt" TIMESTAMP(3),
    "readByStudentAt" TIMESTAMP(3),
    "coachNotes" TEXT,
    "studentSummary" TEXT,

    CONSTRAINT "pedagogical_reports_pkey" PRIMARY KEY ("id")
);

-- Create CompetenceMatrix table
CREATE TABLE "competence_matrices" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reportId" TEXT NOT NULL,
    "matrixData" JSONB NOT NULL,
    "globalScore" DOUBLE PRECISION,
    "confidenceLevel" DOUBLE PRECISION,

    CONSTRAINT "competence_matrices_pkey" PRIMARY KEY ("id")
);

-- Create RemediationRoadmap table
CREATE TABLE "remediation_roadmaps" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reportId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimatedDuration" TEXT,
    "difficultyLevel" TEXT,

    CONSTRAINT "remediation_roadmaps_pkey" PRIMARY KEY ("id")
);

-- Create RoadmapTask table
CREATE TABLE "roadmap_tasks" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "resourceIds" TEXT[],
    "externalUrls" TEXT[],
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "roadmap_tasks_pkey" PRIMARY KEY ("id")
);

-- Create ReportFeedback table
CREATE TABLE "report_feedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "comment" TEXT,
    "severity" INTEGER DEFAULT 1,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "report_feedback_pkey" PRIMARY KEY ("id")
);

-- Create NpcAuditLog table
CREATE TABLE "npc_audit_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,

    CONSTRAINT "npc_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Create UNIQUE indexes
CREATE UNIQUE INDEX "copy_pages_submissionId_pageNumber_key" ON "copy_pages"("submissionId", "pageNumber");
CREATE UNIQUE INDEX "ai_processing_jobs_copySubmissionId_key" ON "ai_processing_jobs"("copySubmissionId");
CREATE UNIQUE INDEX "pedagogical_reports_copySubmissionId_key" ON "pedagogical_reports"("copySubmissionId");
CREATE UNIQUE INDEX "competence_matrices_reportId_key" ON "competence_matrices"("reportId");
CREATE UNIQUE INDEX "remediation_roadmaps_reportId_key" ON "remediation_roadmaps"("reportId");

-- Create foreign keys
ALTER TABLE "copy_submissions" ADD CONSTRAINT "copy_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copy_submissions" ADD CONSTRAINT "copy_submissions_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "copy_submissions" ADD CONSTRAINT "copy_submissions_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "assessment_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "copy_pages" ADD CONSTRAINT "copy_pages_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "copy_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_processing_jobs" ADD CONSTRAINT "ai_processing_jobs_copySubmissionId_fkey" FOREIGN KEY ("copySubmissionId") REFERENCES "copy_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pedagogical_reports" ADD CONSTRAINT "pedagogical_reports_copySubmissionId_fkey" FOREIGN KEY ("copySubmissionId") REFERENCES "copy_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pedagogical_reports" ADD CONSTRAINT "pedagogical_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogical_reports" ADD CONSTRAINT "pedagogical_reports_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "competence_matrices" ADD CONSTRAINT "competence_matrices_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "pedagogical_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "remediation_roadmaps" ADD CONSTRAINT "remediation_roadmaps_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "pedagogical_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "roadmap_tasks" ADD CONSTRAINT "roadmap_tasks_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "remediation_roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_feedback" ADD CONSTRAINT "report_feedback_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "pedagogical_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "npc_audit_logs" ADD CONSTRAINT "npc_audit_logs_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "pedagogical_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create performance indexes
CREATE INDEX "copy_submissions_studentId_status_idx" ON "copy_submissions"("studentId", "status");
CREATE INDEX "copy_submissions_coachId_status_idx" ON "copy_submissions"("coachId", "status");
CREATE INDEX "copy_submissions_sourceId_idx" ON "copy_submissions"("sourceId");
CREATE INDEX "copy_submissions_subject_status_idx" ON "copy_submissions"("subject", "status");
CREATE INDEX "copy_submissions_createdAt_idx" ON "copy_submissions"("createdAt");

CREATE INDEX "assessment_sources_type_subject_idx" ON "assessment_sources"("type", "subject");
CREATE INDEX "assessment_sources_year_idx" ON "assessment_sources"("year");

CREATE INDEX "copy_pages_submissionId_pageNumber_idx" ON "copy_pages"("submissionId", "pageNumber");

CREATE INDEX "ai_processing_jobs_status_priority_createdAt_idx" ON "ai_processing_jobs"("status", "priority", "createdAt");
CREATE INDEX "ai_processing_jobs_status_nextRetryAt_idx" ON "ai_processing_jobs"("status", "nextRetryAt");
CREATE INDEX "ai_processing_jobs_claimedBy_status_idx" ON "ai_processing_jobs"("claimedBy", "status");

CREATE INDEX "pedagogical_reports_studentId_status_idx" ON "pedagogical_reports"("studentId", "status");
CREATE INDEX "pedagogical_reports_coachId_status_idx" ON "pedagogical_reports"("coachId", "status");
CREATE INDEX "pedagogical_reports_createdAt_idx" ON "pedagogical_reports"("createdAt");

CREATE INDEX "roadmap_tasks_roadmapId_order_idx" ON "roadmap_tasks"("roadmapId", "order");

CREATE INDEX "report_feedback_reportId_type_idx" ON "report_feedback"("reportId", "type");
CREATE INDEX "report_feedback_submittedById_idx" ON "report_feedback"("submittedById");

CREATE INDEX "npc_audit_logs_reportId_createdAt_idx" ON "npc_audit_logs"("reportId", "createdAt");
CREATE INDEX "npc_audit_logs_actorId_createdAt_idx" ON "npc_audit_logs"("actorId", "createdAt");
CREATE INDEX "npc_audit_logs_action_createdAt_idx" ON "npc_audit_logs"("action", "createdAt");
