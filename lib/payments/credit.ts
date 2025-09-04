import { prisma } from '@/lib/prisma';

export async function creditUserFromPack(userId: string, packId: number, provider: string, externalId: string) {
  const pack = await (prisma as any).creditPack.findUnique({ where: { id: packId } });
  if (!pack) throw new Error('Pack introuvable');
  const credits = Number(pack.credits) + Number(pack.bonus || 0);
  await (prisma as any).$transaction(async (tx: any) => {
    // Upsert wallet to avoid unique constraint race conditions
    const wallet = await tx.creditWallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
      select: { id: true },
    });
    await tx.creditWallet.update({ where: { id: wallet.id }, data: { balance: { increment: credits } } });
    await tx.creditTx.create({ data: { walletId: wallet.id, delta: credits, reason: `PACK_${packId}`, provider, externalId, packId } });
  });
}
