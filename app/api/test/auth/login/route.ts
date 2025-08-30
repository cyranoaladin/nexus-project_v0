import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function POST() {
  // Actif uniquement en mode E2E
  if (process.env.E2E !== '1') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const email = process.env.E2E_STUDENT_EMAIL || 'e2e-student@nexus.local';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'seed required' }, { status: 400 });

  const token = await encode({
    token: { sub: user.id, email: user.email, role: 'ELEVE' },
    secret: process.env.NEXTAUTH_SECRET!,
  });

  const cookieName =
    process.env.NODE_ENV === 'production'
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

  const res = NextResponse.json({ ok: true, userId: user.id });
  res.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return res;
}
