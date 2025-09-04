-- Ensure pgvector extension exists (required for vector type)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "public"."MemoryKind" AS ENUM ('EPISODIC', 'SEMANTIC', 'PLAN');

-- CreateTable
CREATE TABLE "public"."memories" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" "public"."MemoryKind" NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_documents" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "ownerRole" TEXT,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."knowledge_assets" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "chunk" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "meta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingest_jobs" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "step" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingest_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memories_studentId_kind_idx" ON "public"."memories"("studentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "user_documents_storageKey_key" ON "public"."user_documents"("storageKey");

-- CreateIndex
CREATE INDEX "knowledge_assets_docId_idx" ON "public"."knowledge_assets"("docId");

-- CreateIndex
CREATE INDEX "ingest_jobs_docId_status_idx" ON "public"."ingest_jobs"("docId", "status");

-- AddForeignKey
ALTER TABLE "public"."memories" ADD CONSTRAINT "memories_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."knowledge_assets" ADD CONSTRAINT "knowledge_assets_docId_fkey" FOREIGN KEY ("docId") REFERENCES "public"."user_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
