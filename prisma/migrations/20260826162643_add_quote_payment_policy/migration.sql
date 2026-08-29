-- CreateEnum
CREATE TYPE "QuotePaymentPolicy" AS ENUM ('ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS', 'PAY_IN_FULL_AT_BOOKING');

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "paymentPolicy" "QuotePaymentPolicy";
