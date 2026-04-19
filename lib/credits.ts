import { ServiceType } from '@/types/enums';
import { prisma } from '@/lib/prisma';
import { Prisma, SessionType, SessionModality } from '@prisma/client';

// Defensive access: Prisma enums may be absent when @prisma/client is mocked in unit tests
const SERIALIZABLE = (Prisma as unknown as { TransactionIsolationLevel?: { Serializable?: Prisma.TransactionIsolationLevel } })
  ?.TransactionIsolationLevel?.Serializable ?? undefined;

// Coûts des prestations en crédits
const CREDIT_COSTS = {
  COURS_ONLINE: 1,
  COURS_PRESENTIEL: 1.25,
  ATELIER_GROUPE: 1.5
} as const;

// Calcul du coût en crédits selon le type de prestation
export function calculateCreditCost(serviceType: ServiceType): number {
  switch (serviceType) {
    case 'COURS_ONLINE':
      return CREDIT_COSTS.COURS_ONLINE;
    case 'COURS_PRESENTIEL':
      return CREDIT_COSTS.COURS_PRESENTIEL;
    case 'ATELIER_GROUPE':
      return CREDIT_COSTS.ATELIER_GROUPE;
    default:
      return 1;
  }
}

export async function checkCreditBalance(studentId: string, requiredCredits: number): Promise<boolean> {
  const transactions = await prisma.creditTransaction.findMany({
    where: {
      studentId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  const balance = transactions.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);
  return balance >= requiredCredits;
}

export async function debitCredits(
  studentId: string,
  amount: number,
  sessionId: string,
  description: string
): Promise<{ transaction: Prisma.CreditTransactionGetPayload<object> | null; created: boolean }> {
  const existing = await prisma.creditTransaction.findFirst({
    where: { sessionId, type: 'USAGE' },
  });
  if (existing) return { transaction: existing, created: false };

  try {
    const created = await prisma.creditTransaction.create({
      data: { studentId, type: 'USAGE', amount: -Math.abs(amount), description, sessionId },
    });
    return { transaction: created, created: true };
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') {
      const found = await prisma.creditTransaction.findFirst({
        where: { sessionId, type: 'USAGE' },
      });
      if (found) return { transaction: found, created: false };
    }
    throw e;
  }
}

export async function refundCredits(
  studentId: string,
  amount: number,
  sessionId: string,
  description: string
): Promise<{ transaction: Prisma.CreditTransactionGetPayload<object> | null; created: boolean }> {
  const existing = await prisma.creditTransaction.findFirst({
    where: { sessionId, type: 'REFUND' },
  });
  if (existing) return { transaction: existing, created: false };

  try {
    const created = await prisma.creditTransaction.create({
      data: { studentId, type: 'REFUND', amount: Math.abs(amount), description, sessionId },
    });
    return { transaction: created, created: true };
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') {
      const found = await prisma.creditTransaction.findFirst({
        where: { sessionId, type: 'REFUND' },
      });
      if (found) return { transaction: found, created: false };
    }
    throw e;
  }
}

export async function refundSessionBookingById(sessionBookingId: string, reason?: string) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const booking = await tx.sessionBooking.findUnique({
          where: { id: sessionBookingId },
          select: { id: true, status: true, creditsUsed: true, studentId: true, title: true },
        });
        if (!booking) return { ok: false, reason: 'SESSION_NOT_FOUND' as const };
        if (booking.status !== 'CANCELLED') return { ok: false, reason: 'NOT_CANCELLED' as const };

        const existingRefund = await tx.creditTransaction.findFirst({
          where: { sessionId: booking.id, type: 'REFUND' },
        });
        if (existingRefund) return { ok: true, alreadyRefunded: true as const };

        const studentEntity = await tx.student.findFirst({
          where: { userId: booking.studentId },
          select: { id: true },
        });
        if (!studentEntity) return { ok: false, reason: 'STUDENT_NOT_FOUND' as const };

        const created = await tx.creditTransaction.create({
          data: {
            studentId: studentEntity.id,
            type: 'REFUND',
            amount: Math.abs(booking.creditsUsed ?? 0),
            description: `Refund: ${reason ?? booking.title ?? 'Session cancelled'}`,
            sessionId: booking.id,
          },
        });
        return { ok: true, transaction: created };
      },
      SERIALIZABLE ? { isolationLevel: SERIALIZABLE } : undefined
    );
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2034') {
      const existingRefund = await prisma.creditTransaction.findFirst({
        where: { sessionId: sessionBookingId, type: 'REFUND' },
      });
      if (existingRefund) return { ok: true, alreadyRefunded: true as const };
    }
    throw e;
  }
}

export async function allocateMonthlyCredits(studentId: string, credits: number) {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 2);
  return prisma.creditTransaction.create({
    data: {
      studentId,
      type: 'MONTHLY_ALLOCATION',
      amount: Math.abs(credits),
      description: `Allocation mensuelle de ${credits} crédits`,
      expiresAt,
    },
  });
}

export async function expireOldCredits() {
  const expired = await prisma.creditTransaction.findMany({
    where: { type: 'MONTHLY_ALLOCATION', expiresAt: { lt: new Date() } },
  });
  if (!expired.length) return;
  for (const tx of expired) {
    await prisma.creditTransaction.create({
      data: {
        studentId: tx.studentId,
        type: 'EXPIRATION',
        amount: -Math.abs(tx.amount),
        description: `Expiration crédits (allocation ${tx.id})`,
      },
    });
  }
}

/**
 * Check if a booking can be cancelled with refund based on cancellation policy
 * 
 * Cancellation policy:
 * - Individual/Online/Hybrid: Must cancel 24h before
 * - Group/Masterclass: Must cancel 48h before
 * 
 * @param sessionType - Type of session (INDIVIDUAL, GROUP, MASTERCLASS)
 * @param modality - Session modality (ONLINE, HYBRID, IN_PERSON)
 * @param sessionDate - Scheduled date and time of the session
 * @param now - Current date/time (defaults to new Date(), can be overridden for testing)
 * @returns true if cancellation is eligible for refund, false otherwise
 */
export function canCancelBooking(
  sessionType: SessionType,
  modality: SessionModality,
  sessionDate: Date,
  now: Date = new Date()
): boolean {
  const hoursUntilSession = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Individual/Online/Hybrid: 24h notice required
  if (
    sessionType === 'INDIVIDUAL' ||
    modality === 'HYBRID' ||
    modality === 'ONLINE'
  ) {
    return hoursUntilSession >= 24;
  }

  // Group/Masterclass: 48h notice required
  if (sessionType === 'GROUP' || sessionType === 'MASTERCLASS') {
    return hoursUntilSession >= 48;
  }

  return false;
}
