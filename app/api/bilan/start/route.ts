// app/api/bilan/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Subject } from '@prisma/client';
import { z } from 'zod';

const StartSchema = z.object({
  subject: z.nativeEnum(Subject),
  level: z.enum(['premiere', 'terminale']),
  statut: z.enum(['scolarise_fr', 'candidat_libre']),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = StartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }

    // Élève requis (utilisateur élève)
    const { requireRole, HttpError } = await import('@/lib/server/authz');
    let user: any;
    try {
      user = await requireRole('ELEVE');
    } catch (err: any) {
      if (err?.status) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }

    const student = await prisma.student.findUnique({ where: { userId: user.id } });
    if (!student) return NextResponse.json({ error: 'Profil élève introuvable' }, { status: 404 });

    const bilan = await prisma.bilan.create({
      data: {
        studentId: student.id,
        subject: parsed.data.subject,
        level: parsed.data.level,
        statut: parsed.data.statut,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({ bilanId: bilan.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur interne' }, { status: 500 });
  }
}

