// app/api/bilan/[bilanId]/profil/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { buildHeuristicSynthesis } from '@/lib/bilan/synthesis';
import { recommendOffers } from '@/lib/bilan/offers';

const ProfilSchema = z.object({
  style: z.string().optional(),
  organisation: z.string().optional(),
  rythme: z.string().optional(),
  motivation: z.string().optional(),
  difficultes: z.string().optional(),
  attentes: z.string().optional(),
  objectif: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { bilanId: string } }) {
  try {
    const { requireRole } = await import('@/lib/server/authz');
    let user: any;
    try {
      user = await requireRole('ELEVE');
    } catch (err: any) {
      if (err?.status) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }

    const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { student: { include: { user: true } } } });
    if (!bilan) return NextResponse.json({ error: 'Bilan introuvable' }, { status: 404 });

    const isOwner = bilan.student.userId === user.id;
    const isStaff = ['ADMIN', 'ASSISTANTE', 'COACH'].includes(user.role);
    if (!isOwner && !isStaff) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const body = await req.json();
    const parsed = ProfilSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });

    const pedago = parsed.data as any;

    // Construire une synthèse heuristique minimale dès maintenant (avant IA)
    let synthesis = (bilan.synthesis as any) || undefined;
    if (!synthesis && bilan.qcmScores) {
      synthesis = buildHeuristicSynthesis(bilan.qcmScores as any, pedago);
    }

    // Matrice d'offres locale
    const offers = recommendOffers((bilan.qcmScores as any) || { byDomain: {}, scoreGlobal: 0, weakDomains: 0 }, pedago, bilan.statut || undefined, pedago?.objectif || undefined);

    await prisma.bilan.update({
      where: { id: bilan.id },
      data: {
        pedagoProfile: pedago as any,
        synthesis: synthesis as any,
        offers: offers as any,
      },
    });

    return NextResponse.json({ ok: true, pedago: pedago, synthesis, offers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur interne' }, { status: 500 });
  }
}

