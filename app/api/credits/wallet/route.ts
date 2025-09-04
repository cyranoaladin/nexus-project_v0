import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const w = await (prisma as any).creditWallet.findUnique({ where: { userId } });
  const tx = await (prisma as any).creditTx.findMany({ where: { walletId: w?.id || 0 }, orderBy: { at: 'desc' }, take: 50 });
  return NextResponse.json({ balance: w?.balance || 0, tx });
}
