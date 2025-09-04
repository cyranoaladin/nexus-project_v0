/*
  Warnings:

  - A unique constraint covering the columns `[provider,externalId]` on the table `payment_records` will be added. If there are existing duplicate values, this will fail.

*/

-- Deduplicate existing rows by keeping the latest updatedAt for each (provider, externalId)
WITH ranked AS (
  SELECT
    id,
    provider,
    "externalId",
    "updatedAt",
    ROW_NUMBER() OVER (PARTITION BY provider, "externalId" ORDER BY "updatedAt" DESC, id DESC) AS rn
  FROM "public"."payment_records"
)
DELETE FROM "public"."payment_records" pr
USING ranked r
WHERE pr.id = r.id
  AND r.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "payment_records_provider_externalId_key" ON "public"."payment_records"("provider", "externalId");
