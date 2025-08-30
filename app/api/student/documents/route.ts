// app/api/student/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ELEVE' || !session.user.studentId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const docs = await prisma.generatedDocument.findMany({
      where: { studentId: session.user.studentId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ documents: docs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur interne' }, { status: 500 });
  }
}
