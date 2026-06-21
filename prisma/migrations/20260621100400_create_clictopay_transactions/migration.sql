-- E5: Create clictopay_transactions table (aligns schema.prisma model with DB)
-- Table was defined in Prisma but never deployed; feature pending integration

CREATE TABLE clictopay_transactions (
    id TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TND',
    status TEXT NOT NULL DEFAULT 'PENDING',
    "bankReference" TEXT,
    "paymentId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL,

    CONSTRAINT "clictopay_transactions_pkey" PRIMARY KEY (id)
);

-- Unique constraints
CREATE UNIQUE INDEX "clictopay_transactions_orderId_key" ON clictopay_transactions("orderId");
CREATE UNIQUE INDEX "clictopay_transactions_paymentId_key" ON clictopay_transactions("paymentId");

-- Performance index
CREATE INDEX "clictopay_transactions_userId_idx" ON clictopay_transactions("userId");

-- Foreign keys
ALTER TABLE clictopay_transactions
    ADD CONSTRAINT "clictopay_transactions_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES payments(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE clictopay_transactions
    ADD CONSTRAINT "clictopay_transactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;
