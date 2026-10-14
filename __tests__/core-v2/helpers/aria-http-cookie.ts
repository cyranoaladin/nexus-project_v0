import { encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

/** Real encrypted request cookie, backed by the actual disposable V1 row. */
export async function ariaHttpCookie(userId: string | undefined): Promise<Record<string, string>> {
  if (!userId) return {};
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, sessionVersion: true } });
  if (!user) return {};
  const jwt = await encode({ token: { id: userId, role: user.role, sessionVersion: user.sessionVersion, authority: 'V1' },
    secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' });
  return { cookie: `authjs.session-token=${jwt}` };
}
