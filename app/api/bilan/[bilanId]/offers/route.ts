// app/api/bilan/[bilanId]/offers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recommendOffers } from '@/lib/bilan/offers';

export async function POST(_req: NextRequest, { params }: { params: { bilanId: string } }) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session || !session.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { student: { include: { user: true } } } });
    if (!bilan) return NextResponse.json({ error: 'Bilan introuvable' }, { status: 404 });

    const isOwner = bilan.student.userId === session.user.id;
    const isStaff = ['ADMIN', 'ASSISTANTE', 'COACH'].includes(session.user.role);
    if (!isOwner && !isStaff) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const offers = recommendOffers((bilan.qcmScores as any) || { byDomain: {}, scoreGlobal: 0, weakDomains: 0 }, (bilan.pedagoProfile as any) || {}, bilan.statut || undefined);

    await prisma.bilan.update({ where: { id: bilan.id }, data: { offers: offers as any } });
    return NextResponse.json({ ok: true, offers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur interne' }, { status: 500 });
  }
}

