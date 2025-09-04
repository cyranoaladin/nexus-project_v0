import { prisma } from '@/lib/prisma';

export async function ensureWallet(userId: string) {
  let w = await (prisma as any).creditWallet.findUnique({ where: { userId } });
  if (!w) w = await (prisma as any).creditWallet.create({ data: { userId, balance: 0 } });
  return w;
}

export async function spendCredits({ userId, credits, reason, provider, externalId }: { userId: string; credits: number; reason: string; provider?: string; externalId?: string; }) {
  const w = await ensureWallet(userId);
  if (externalId) {
    const dup = await (prisma as any).creditTx.findFirst({ where: { walletId: w.id, externalId } });
    if (dup) return { balance: (await (prisma as any).creditWallet.findUnique({ where: { id: w.id } }))!.balance, already: true };
  }
  return await (prisma as any).$transaction(async (tx: any) => {
    const fresh = await tx.creditWallet.findUnique({ where: { id: w.id }, select: { id: true, balance: true } });
    if (!fresh || fresh.balance < credits) {
      const err: any = new Error('Crédits insuffisants');
      err.code = 'INSUFFICIENT_CREDITS';
      err.balance = fresh?.balance ?? 0;
      err.needed = credits;
      throw err;
    }
    const updated = await tx.creditWallet.update({ where: { id: w.id }, data: { balance: { decrement: credits } }, select: { balance: true } });
    await tx.creditTx.create({ data: { walletId: w.id, delta: -credits, reason, provider, externalId } });
    return { balance: updated.balance };
  });
}

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

// Attribution des crédits mensuels
export async function allocateMonthlyCredits(studentId: string, credits: number) {

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

// Logique d'annulation de réservation
export function canCancelBooking(sessionDate: Date, serviceType: ServiceType): boolean {
  const now = new Date();
  const sessionTime = sessionDate.getTime();
  const currentTime = now.getTime();
  const hoursDifference = (sessionTime - currentTime) / (1000 * 60 * 60);

  if (serviceType === 'ATELIER_GROUPE') {
    // Annulation possible jusqu'à 48h avant pour les ateliers de groupe
    return hoursDifference > 48;
  } else {
    // Annulation possible jusqu'à 24h avant pour les autres cours
    return hoursDifference > 24;
  }
}
