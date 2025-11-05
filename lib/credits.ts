import { ServiceType } from '@/types/enums';

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

// Vérification du solde de crédits
export async function checkCreditBalance(studentId: string, requiredCredits: number): Promise<boolean> {
  const { prisma } = await import('./prisma');

  const transactions = await prisma.creditTransaction.findMany({
    where: {
      studentId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    }
  });

  const totalCredits = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  return totalCredits >= requiredCredits;
}

// Débit des crédits pour une session
export async function debitCredits(studentId: string, amount: number, sessionId: string, description: string) {
  const { prisma } = await import('./prisma');

  return await prisma.creditTransaction.create({
    data: {
      studentId,
      type: 'USAGE',
      amount: -amount,
      description,
      sessionId
    }
  });
}

// Remboursement de crédits (annulation)
export async function refundCredits(studentId: string, amount: number, sessionId: string, description: string) {
  const { prisma } = await import('./prisma');

  return await prisma.creditTransaction.create({
    data: {
      studentId,
      type: 'REFUND',
      amount,
      description,
      sessionId
    }
  });
}

// Remboursement basé sur une SessionBooking (idempotent et sûr en concurrence)
export async function refundSessionBookingById(sessionBookingId: string, reason?: string) {
  const { prisma } = await import('./prisma');

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Charger la réservation dans la même transaction
      const booking = await tx.sessionBooking.findUnique({ where: { id: sessionBookingId } });
      if (!booking) return { ok: false, reason: 'SESSION_NOT_FOUND' as const };

      // Règle: rembourser seulement si annulée
      if (booking.status !== 'CANCELLED') {
        return { ok: false, reason: 'NOT_CANCELLED' as const };
      }

      // Vérifier l'idempotence (un seul REFUND par session)
      const existing = await tx.creditTransaction.findFirst({ where: { sessionId: sessionBookingId, type: 'REFUND' } });
      if (existing) {
        return { ok: true, alreadyRefunded: true as const };
      }

      // Trouver l'entité Student (id) via userId de la booking
      const studentEntity = await tx.student.findFirst({ where: { userId: booking.studentId } });
      if (!studentEntity) return { ok: false, reason: 'STUDENT_NOT_FOUND' as const };

      const created = await tx.creditTransaction.create({
        data: {
          studentId: studentEntity.id,
          type: 'REFUND',
          amount: booking.creditsUsed,
          description: reason ? `Refund: ${reason}` : `Refund: cancellation ${booking.title ?? ''}`,
          sessionId: sessionBookingId
        }
      });

      return { ok: true, transaction: created };
    }, { isolationLevel: 'Serializable' });

    return result;
  } catch (err: unknown) {
    // En cas de conflit de sérialisation (écriture concurrente), considérer comme idempotent
    const prismaError = err as { code?: string; message?: string } | undefined;
    const code = prismaError?.code;
    const message = prismaError?.message ?? '';

    if (code === 'P2034' || /serialization/i.test(message) || /deadlock/i.test(message)) {
      // Vérifier si le remboursement a été créé par l'autre transaction
      const existing = await prisma.creditTransaction.findFirst({ where: { sessionId: sessionBookingId, type: 'REFUND' } });
      if (existing) {
        return { ok: true, alreadyRefunded: true as const };
      }
    }

    throw err;
  }
}

// Attribution des crédits mensuels
export async function allocateMonthlyCredits(studentId: string, credits: number) {
  const { prisma } = await import('./prisma');

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 2); // Expire dans 2 mois (report 1 mois)

  return await prisma.creditTransaction.create({
    data: {
      studentId,
      type: 'MONTHLY_ALLOCATION',
      amount: credits,
      description: `Allocation mensuelle de ${credits} crédits`,
      expiresAt: nextMonth
    }
  });
}

// Expiration des crédits reportés
export async function expireOldCredits() {
  const { prisma } = await import('./prisma');

  const expiredTransactions = await prisma.creditTransaction.findMany({
    where: {
      expiresAt: { lt: new Date() },
      type: 'MONTHLY_ALLOCATION'
    }
  });

  for (const transaction of expiredTransactions) {
    await prisma.creditTransaction.create({
      data: {
        studentId: transaction.studentId,
        type: 'EXPIRATION',
        amount: -transaction.amount,
        description: `Expiration de ${transaction.amount} crédits reportés`
      }
    });
  }
}
