import { prisma } from '@/lib/prisma';

export async function getUserEmail(userId: string, fallback?: string) {
  try {
    const u = await (prisma as any).user.findUnique({ where: { id: userId }, select: { email: true } });
    if (u?.email) return u.email as string;
  } catch {}
  return fallback;
}
