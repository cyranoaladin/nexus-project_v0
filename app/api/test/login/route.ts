import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types/enums';
import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

function isNonProd() {
  // Autoriser en mode E2E même si NODE_ENV=production dans le conteneur
  return process.env.NODE_ENV !== 'production' || process.env.E2E === '1';
}

async function mintSessionJWT(payload: Record<string, any>) {
  // Robust secret resolution for tests: prefer authOptions.secret, then env, then E2E fallback
  const fromAuth = (authOptions as any).secret as string | undefined;
  const fromEnv = (process.env.NEXTAUTH_SECRET || '').trim();
  const fallback = (process.env.PLAYWRIGHT === '1' || process.env.E2E === '1')
    ? 'e2e-test-secret-0123456789abcdef0123456789ab' // >= 32 chars
    : '';
  const secret = (fromAuth && fromAuth.length >= 16)
    ? fromAuth
    : (fromEnv && fromEnv.length >= 16)
      ? fromEnv
      : fallback;
  if (!secret || secret.length < 32) throw new Error('NEXTAUTH_SECRET missing or too short for test login');
  // Use next-auth/jwt encode to produce a token compatible with withAuth/getServerSession (JWE by default)
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  const token = await encode({ token: payload as any, secret, maxAge });
  return token;
}

async function findUserForRole(role: string) {
  // Use first matching seeded user per role (deterministic for tests)
  const user = await prisma.user.findFirst({ where: { role: role as any }, orderBy: { createdAt: 'asc' } });
  if (!user) return null;
  let studentId: string | null = null;
  let parentId: string | null = null;
  if (role === UserRole.ELEVE) {
    const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true, parentId: true } });
    studentId = student?.id || null;
    parentId = student?.parentId || null;
  }
  if (role === UserRole.PARENT) {
    const parent = await prisma.parentProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    parentId = parent?.id || null;
  }
  return { user, studentId, parentId };
}

function isLocalRequest(req: Request): boolean {
  try {
    const url = new URL(req.url);
    const host = url.hostname || '';
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!(isNonProd() || isLocalRequest(req) || process.env.QA_MODE === '1')) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const roleRaw = String(body.role || '').toUpperCase();
    const aliasMap: Record<string, string> = {
      'ASSISTANT': 'ASSISTANTE',
      'ASSISTANTE': 'ASSISTANTE',
      'STUDENT': 'ELEVE',
      'ELEVE': 'ELEVE',
      'PARENT': 'PARENT',
      'PARENTS': 'PARENT',
      'COACH': 'COACH',
      'ADMIN': 'ADMIN',
    };
    const allowed = new Set(Object.values(UserRole).map(String));
    let role = (aliasMap[roleRaw] || (allowed.has(roleRaw) ? roleRaw : null)) as string | null;
    // En E2E, simplifier: défaut ELEVE si non fourni ou non valide
    if ((process.env.E2E === '1' || process.env.NEXT_PUBLIC_E2E === '1')) {
      role = role || 'ELEVE';
    }
    const email = body.email ? String(body.email) : undefined;

    if (role == null) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Resolve user either by provided email or first seeded by role
    const userRecord = email
      ? await prisma.user.findUnique({ where: { email } })
      : (await findUserForRole(role))?.user;

    if (!userRecord) {
      return NextResponse.json({ error: 'Test user not found for role' }, { status: 404 });
    }

    let studentId: string | null = null;
    let parentId: string | null = null;
    if (!email) {
      const enriched = await findUserForRole(role);
      studentId = enriched?.studentId || null;
      parentId = enriched?.parentId || null;
    } else {
      if (role === 'ELEVE') {
        const st = await prisma.student.findUnique({ where: { userId: userRecord.id }, select: { id: true, parentId: true } });
        studentId = st?.id || null;
        parentId = st?.parentId || null;
      }
      if (role === 'PARENT') {
        const pr = await prisma.parentProfile.findUnique({ where: { userId: userRecord.id }, select: { id: true } });
        parentId = pr?.id || null;
      }
    }

    const payload = {
      name: `${userRecord.firstName || ''} ${userRecord.lastName || ''}`.trim() || userRecord.email,
      email: userRecord.email,
      id: userRecord.id,
      role: userRecord.role,
      firstName: userRecord.firstName || null,
      lastName: userRecord.lastName || null,
      studentId,
      parentId,
    };

    const token = await mintSessionJWT(payload);

    // Set NextAuth session cookie
    const res = NextResponse.json({ ok: true, role: userRecord.role, userId: userRecord.id });
    const isSecure = process.env.NODE_ENV === 'production';
    res.cookies.set('next-auth.session-token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
    if (process.env.PLAYWRIGHT === '1') {
      try { console.log('[TEST_LOGIN_COOKIE_SET]', { name: 'next-auth.session-token', length: token.length }); } catch {}
    }
    return res;
  } catch (error) {
    console.error('[TEST_LOGIN_ERROR]', error);
    return NextResponse.json({ error: 'Test login failed' }, { status: 500 });
  }
}
