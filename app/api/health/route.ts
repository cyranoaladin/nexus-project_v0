import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Simple probe + small query
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count().catch(() => 0);
    return NextResponse.json({ ok: true, db: 'up', userCount });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'db_down', message: String(e?.message || e) }, { status: 500 });
  }
}
