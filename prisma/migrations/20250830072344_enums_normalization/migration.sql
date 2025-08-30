/*
  Warnings:

  - The `method` column on the `payments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `category` on the `badges` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `credit_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `notifications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `requestType` on the `subscription_requests` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `status` on the `subscription_requests` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('KONNECT', 'WISE', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."BadgeCategory" AS ENUM ('ASSIDUITE', 'PROGRESSION', 'CURIOSITE');

-- CreateEnum
CREATE TYPE "public"."CreditTransactionType" AS ENUM ('MONTHLY_ALLOCATION', 'PURCHASE', 'USAGE', 'REFUND', 'EXPIRATION', 'CREDIT_REQUEST', 'CREDIT_ADD', 'CREDIT_REJECTED');

-- CreateEnum
CREATE TYPE "public"."SubscriptionRequestType" AS ENUM ('PLAN_CHANGE', 'ARIA_ADDON', 'INVOICE_DETAILS');

-- CreateEnum
CREATE TYPE "public"."SubscriptionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."GenericNotificationType" AS ENUM ('SUBSCRIPTION_REQUEST', 'CREDIT_REQUEST');

-- AlterTable
ALTER TABLE "public"."badges" DROP COLUMN "category",
ADD COLUMN     "category" "public"."BadgeCategory" NOT NULL;

-- AlterTable
ALTER TABLE "public"."credit_transactions" DROP COLUMN "type",
ADD COLUMN     "type" "public"."CreditTransactionType" NOT NULL;

-- AlterTable
ALTER TABLE "public"."notifications" DROP COLUMN "type",
ADD COLUMN     "type" "public"."GenericNotificationType" NOT NULL;

-- AlterTable
ALTER TABLE "public"."payments" DROP COLUMN "method",
ADD COLUMN     "method" "public"."PaymentMethod";

-- AlterTable
ALTER TABLE "public"."subscription_requests" DROP COLUMN "requestType",
ADD COLUMN     "requestType" "public"."SubscriptionRequestType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "public"."SubscriptionRequestStatus" NOT NULL;
