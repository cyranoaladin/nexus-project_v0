import { getAuthFromRequest } from '@/lib/api/auth';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';

export type Role = 'ADMIN' | 'ASSISTANTE' | 'COACH' | 'PARENT' | 'ELEVE';

export async function requireRole(req: NextRequest, roles: Role[]) {
  try {
    const dev = await getAuthFromRequest(req as unknown as Request);
    const devRole = (dev?.user as any)?.role as Role | undefined;
    if (devRole && roles.includes(devRole)) return { ok: true as const, role: devRole };

    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role as Role | undefined;
    if (role && roles.includes(role)) return { ok: true as const, role };
    return { ok: false as const, status: 403, message: 'Forbidden' };
  } catch {
    return { ok: false as const, status: 401, message: 'Unauthorized' };
  }
}
