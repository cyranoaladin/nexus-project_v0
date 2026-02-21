-- AlterTable
ALTER TABLE "SessionBooking" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SessionBooking_idempotencyKey_key" ON "SessionBooking"("idempotencyKey");
