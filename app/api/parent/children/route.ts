import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions).catch(() => null);
  if (!session?.user || session.user.role !== 'PARENT') return NextResponse.json([], { status: 200 });
  try {
    const parent = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: { children: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    const out = (parent?.children || []).map((s) => ({ id: s.id, firstName: s.user.firstName, lastName: s.user.lastName }));
    return NextResponse.json(out, { status: 200 });
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}
