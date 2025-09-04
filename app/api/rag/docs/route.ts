import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const docs = await prisma.userDocument.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, originalName: true, status: true, meta: true, createdAt: true },
    });
    return NextResponse.json({ docs });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
