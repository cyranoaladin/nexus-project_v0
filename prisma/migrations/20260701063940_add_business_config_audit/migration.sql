-- CreateTable: business_config_audit (purely additive — no ALTER/DROP)
CREATE TABLE "business_config_audit" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_config_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_config_audit_namespace_key_idx" ON "business_config_audit"("namespace", "key");

-- CreateIndex
CREATE INDEX "business_config_audit_changedAt_idx" ON "business_config_audit"("changedAt");
