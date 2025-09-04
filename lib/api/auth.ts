import { verifyDevToken } from '@/lib/auth/dev-token';
// import { getServerSession } from 'next-auth'; // Optionnel si nécessaire

export async function getAuthFromRequest(req: Request): Promise<{ user: { id: string; email?: string; role?: string; }; via: 'session' | 'dev-token'; } | null> {
  // 1) Session classique (si activée ici)
  // try {
  //   const session = await getServerSession(authOptions);
  //   if (session?.user?.id) return { user: session.user as any, via: 'session' };
  // } catch {}

  // 2) Dev token (dev only)
  if (process.env.NODE_ENV !== 'production') {
    const h1 = req.headers.get('authorization') || '';
    const h2 = (req as any)?.headers?.get?.('Authorization') || '';
    const raw = h1 || h2 || '';
    const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
    const token = m ? m[1] : null;
    const dev = verifyDevToken(token || undefined);
    if (dev) return { user: { id: dev.sub, email: dev.email, role: dev.role }, via: 'dev-token' } as any;
  }

  return null;
}
