-- CreateTable: business_configs (purely additive — no ALTER/DROP on existing tables)
CREATE TABLE "business_configs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousValue" JSONB,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_configs_namespace_key_key" ON "business_configs"("namespace", "key");

-- CreateIndex
CREATE INDEX "business_configs_namespace_idx" ON "business_configs"("namespace");

-- CreateIndex
CREATE INDEX "business_configs_updatedAt_idx" ON "business_configs"("updatedAt");
