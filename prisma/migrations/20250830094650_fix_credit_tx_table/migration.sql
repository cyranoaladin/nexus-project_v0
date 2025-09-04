-- CreateTable
CREATE TABLE "public"."credit_packs" (
    "id" SERIAL NOT NULL,
    "credits" INTEGER NOT NULL,
    "priceTnd" DOUBLE PRECISION NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_usage" (
    "key" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_usage_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."payment_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "allowCard" BOOLEAN NOT NULL DEFAULT true,
    "allowWire" BOOLEAN NOT NULL DEFAULT true,
    "allowCash" BOOLEAN NOT NULL DEFAULT true,
    "iban" TEXT,
    "cashNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_policy" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "annualDepositPct" INTEGER NOT NULL DEFAULT 20,
    "scheduleEndISO" TEXT NOT NULL DEFAULT '2026-06-30',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."offer_bindings" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "includeAria" BOOLEAN NOT NULL DEFAULT false,
    "refs" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_bindings_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" SERIAL NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "diff" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_wallets" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_tx" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "provider" TEXT,
    "externalId" TEXT,
    "packId" INTEGER,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_tx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_records" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" INTEGER NOT NULL,
    "amountTnd" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_wallets_userId_key" ON "public"."credit_wallets"("userId");

-- AddForeignKey
ALTER TABLE "public"."credit_tx" ADD CONSTRAINT "credit_tx_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."credit_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
