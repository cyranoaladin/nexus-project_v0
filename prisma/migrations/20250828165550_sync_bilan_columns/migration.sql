/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."bilans" ADD COLUMN     "niveau" TEXT,
ADD COLUMN     "statut" TEXT,
ADD COLUMN     "subject" TEXT;

-- CreateTable
CREATE TABLE "public"."product_pricing" (
    "id" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_pricing_itemType_itemKey_key" ON "public"."product_pricing"("itemType", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "payments_externalId_key" ON "public"."payments"("externalId");
