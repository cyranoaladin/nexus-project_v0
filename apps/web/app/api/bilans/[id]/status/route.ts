import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: { id: string; }; }) {
  const bilan = await prisma.bilan.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!bilan) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ status: 'READY', pdfUrl: bilan.pdfUrl ?? null });
}
