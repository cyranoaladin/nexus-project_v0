import { prisma } from '@/lib/prisma';

export type UpsertPaymentParams = {
  externalId: string;
  method: string; // e.g., 'konnect' | 'wise' | 'manual'
  type: 'SUBSCRIPTION' | 'CREDIT_PACK' | 'SPECIAL_PACK';
  userId: string;
  amount: number;
  currency?: string;
  description: string;
  metadata?: Record<string, unknown>;
};

// Idempotent create-or-get by (method, externalId)
export async function upsertPaymentByExternalId(params: UpsertPaymentParams) {
  const {
    externalId,
    method,
    type,
    userId,
    amount,
    currency = 'TND',
    description,
    metadata,
  } = params;

  // Fast path
  const existing = await prisma.payment.findFirst({ where: { externalId, method } });
  if (existing) return { payment: existing, created: false as const };

  try {
    const created = await prisma.payment.create({
      data: {
        userId,
        type,
        amount,
        currency,
        description,
        status: 'PENDING',
        method,
        externalId,
        metadata: metadata as Record<string, unknown> | undefined,
      },
    });
    return { payment: created, created: true as const };
  } catch (err: unknown) {
    // Unique constraint violation due to concurrency
    const error = err as { code?: string };
    if (error?.code === 'P2002') {
      const again = await prisma.payment.findFirst({ where: { externalId, method } });
      if (again) return { payment: again, created: false as const };
    }
    throw err;
  }
}

