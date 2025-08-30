// app/api/bilan/[bilanId]/report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { llm_service } from '@/lib/aria/services';
import { REPORT_SYSTEM_PROMPT } from '@/lib/bilan/prompts';
import { requireRole } from '@/lib/server/authz';

export async function POST(req: NextRequest, { params }: { params: { bilanId: string } }) {
  try {
    let user: any;
    try {
      user = await requireRole('ELEVE');
    } catch (err: any) {
      if (err?.status) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }

    const bilan = await prisma.bilan.findUnique({
      where: { id: params.bilanId },
      include: { student: { include: { user: true } } },
    });
    if (!bilan) return NextResponse.json({ error: 'Bilan introuvable' }, { status: 404 });

    const isOwner = bilan.student.userId === user.id;
    const isStaff = ['ADMIN', 'ASSISTANTE', 'COACH'].includes(user.role);
    if (!isOwner && !isStaff) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const qcmScores = (bilan.qcmScores as any) || { byDomain: {}, scoreGlobal: 0 };
    const pedagoProfile = (bilan.pedagoProfile as any) || {};
    const synthesis = (bilan.synthesis as any) || { forces: [], faiblesses: [], feuilleDeRoute: [] };
    const offers = (bilan.offers as any) || { primary: '', alternatives: [], reasoning: '' };

    // Construit le contexte pour le LLM
    const contexte_eleve = {
      profil: {
        prenom: bilan.student.user.firstName,
        nom: bilan.student.user.lastName,
        niveau: bilan.level,
        statut: bilan.statut,
      },
      qcmScores,
      pedagoProfile,
      synthesis,
      offers,
      system_prompt: REPORT_SYSTEM_PROMPT,
    };

    const llm = await llm_service.generate_response(
      {
        contexte_eleve,
        requete_actuelle: 'GEN_BILAN',
        requete_type: 'REPORT',
        system_prompt: REPORT_SYSTEM_PROMPT,
      },
      { timeoutMs: Number(process.env.LLM_PDF_TIMEOUT_MS || '120000') }
    );

    const text = llm?.response || '';
    const newSynthesis = { ...synthesis, text };

    await prisma.bilan.update({ where: { id: bilan.id }, data: { synthesis: newSynthesis as any, status: 'COMPLETED' } });

    return NextResponse.json({ ok: true, text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur interne' }, { status: 500 });
  }
}

