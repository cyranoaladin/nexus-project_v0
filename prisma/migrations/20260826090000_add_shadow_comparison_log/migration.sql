-- CreateTable
CREATE TABLE "shadow_comparison_logs" (
    "id" TEXT NOT NULL,
    "situationChecksum" TEXT NOT NULL,
    "divergenceCategory" TEXT NOT NULL,
    "legacySummary" JSONB NOT NULL,
    "newSummary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shadow_comparison_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shadow_comparison_logs_divergenceCategory_createdAt_idx" ON "shadow_comparison_logs"("divergenceCategory", "createdAt");
