// app/api/bilan/[bilanId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { bilanId: string } }) {
  try {
    const session = await getServerSession(authOptions as any);
    if (!session || !session.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const bilan = await prisma.bilan.findUnique({
      where: { id: params.bilanId },
      include: { student: { include: { user: true } } },
    });

    if (!bilan) return NextResponse.json({ error: 'Bilan introuvable' }, { status: 404 });

    const isOwner = bilan.student.userId === session.user.id;
    const isParent = session.user.role === 'PARENT';
    const isStaff = ['ADMIN', 'ASSISTANTE', 'COACH'].includes(session.user.role);

    if (!isOwner && !isStaff && !isParent) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    return NextResponse.json(bilan);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur interne' }, { status: 500 });
  }
}

