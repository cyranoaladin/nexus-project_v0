import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: { id: string; }; }) {
  const bilan = await prisma.bilan.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!bilan || !bilan.pdfUrl) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.redirect(new URL(bilan.pdfUrl, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
}
