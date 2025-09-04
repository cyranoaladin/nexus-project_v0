import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pages = await prisma.legalPage.findMany({
      select: { slug: true, title: true, updatedAt: true, version: true },
      orderBy: { slug: 'asc' },
    });
    return NextResponse.json(pages);
  } catch (e: any) {
    return NextResponse.json({ error: 'failed', message: String(e?.message || e) }, { status: 500 });
  }
}
