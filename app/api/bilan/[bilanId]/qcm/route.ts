// app/api/bilan/[bilanId]/qcm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { evaluateQcm } from '@/lib/bilan/eval';
import { QCMAnswersPayload } from '@/lib/bilan/types';

const AnswersSchema = z.record(z.string(), z.number().int().min(0));

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
    const parsed = AnswersSchema.safeParse(body?.answers);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données QCM invalides', details: parsed.error.flatten() }, { status: 400 });
    }

    const answers = parsed.data as QCMAnswersPayload;
    const scores = evaluateQcm(answers);

    await prisma.bilan.update({ where: { id: bilan.id }, data: { qcmAnswers: answers as any, qcmScores: scores as any } });

    return NextResponse.json({ ok: true, scores });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur interne' }, { status: 500 });
  }
}

