import { PrismaClient } from '@prisma/client';

export type UpsertPaymentRecordParams = {
  provider: string;
  externalId: string;
  userId: string;
  packId: number;
  amountTnd: number;
  currency?: string;
  status?: string;
};

/**
 * Idempotent upsert for payment_records keyed by (provider, externalId).
 * - Creates on first call
 * - Updates amount/status on subsequent calls with the same key
 */
export async function upsertPaymentRecord(prisma: PrismaClient, p: UpsertPaymentRecordParams) {
  const now = new Date();
  return prisma.paymentRecord.upsert({
    where: {
      payment_records_provider_externalId_key: {
        provider: p.provider,
        externalId: p.externalId,
      },
    },
    create: {
      provider: p.provider,
      externalId: p.externalId,
      userId: p.userId,
      packId: p.packId,
      amountTnd: p.amountTnd,
      currency: p.currency ?? 'TND',
      status: p.status ?? 'created',
      createdAt: now,
      updatedAt: now,
    },
    update: {
      amountTnd: p.amountTnd,
      currency: p.currency ?? 'TND',
      status: p.status ?? 'created',
      updatedAt: now,
    },
  });
}

