export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const bilanCreateSchema = z.object({
  studentId: z.string().min(1),
  contentEleve: z.string().min(1),
  contentParent: z.string().min(1),
  contentInterne: z.string().optional(),
  scoreGlobal: z.number().min(0).max(20).optional(),
  domainScores: z.record(z.number()).optional(),
  strengths: z.array(z.string()).default([]),
  areasForGrowth: z.array(z.string()).default([]),
  nextSteps: z.string().optional(),
  isPublished: z.boolean().default(false),
});

// Vérifier l'accès au stage pour COACH
async function verifyStageAccess(
  user: { id: string; role: string },
  stageId: string
): Promise<{ allowed: boolean; error?: string }> {
  if (user.role === 'ADMIN' || user.role === 'ASSISTANTE') {
    return { allowed: true };
  }
  if (user.role === 'COACH') {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: user.id },
    });
    if (!coachProfile) {
      return { allowed: false, error: 'Profil coach introuvable' };
    }
    const assignment = await prisma.stageCoach.findFirst({
      where: {
        coachId: coachProfile.id,
        stageId: stageId,
      },
    });
    if (!assignment) {
      return { allowed: false, error: 'Stage non assigné à ce coach' };
    }
    return { allowed: true };
  }
  return { allowed: false, error: 'Accès refusé' };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string }> }
) {
  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  const { stageSlug } = await params;

  const stage = await prisma.stage.findUnique({
    where: { slug: stageSlug },
    select: { id: true, title: true },
  });

  if (!stage) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
  }

  if (sessionOrError.user.role === 'COACH') {
    const accessCheck = await verifyStageAccess(sessionOrError.user, stage.id);
    if (!accessCheck.allowed) {
      return NextResponse.json({ error: accessCheck.error }, { status: 403 });
    }
  }

  try {
    const bilans = await prisma.stageBilan.findMany({
      where: { stageId: stage.id },
      include: {
        student: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        coach: { select: { pseudonym: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const safeBilans = bilans.map(({ contentInterne: _ci, ...b }) => b);

    return NextResponse.json({ bilans: safeBilans });
  } catch (error) {
    console.error('[GET bilans]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string }> }
) {
  const sessionOrError = await requireAnyRole(['COACH', 'ADMIN', 'ASSISTANTE']);
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  const { stageSlug } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = bilanCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const stage = await prisma.stage.findUnique({ where: { slug: stageSlug } });
    if (!stage) return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: sessionOrError.user.id },
    });
    if (!coachProfile) return NextResponse.json({ error: 'Profil coach introuvable' }, { status: 404 });

    // Vérifier l'assignation au stage pour COACH
    if (sessionOrError.user.role === 'COACH') {
      const assignment = await prisma.stageCoach.findFirst({
        where: {
          coachId: coachProfile.id,
          stageId: stage.id,
        },
      });
      if (!assignment) {
        return NextResponse.json({ error: 'Stage non assigné à ce coach' }, { status: 403 });
      }
    }

    // Vérifier que l'élève a une réservation CONFIRMED sur ce stage
    const reservation = await prisma.stageReservation.findFirst({
      where: {
        studentId: parsed.data.studentId,
        stageId: stage.id,
        richStatus: 'CONFIRMED',
      },
    });
    if (!reservation) {
      return NextResponse.json({ error: 'Élève sans réservation confirmée sur ce stage' }, { status: 403 });
    }

    const bilan = await prisma.stageBilan.upsert({
      where: { stageId_studentId: { stageId: stage.id, studentId: parsed.data.studentId } },
      create: {
        stageId: stage.id,
        studentId: parsed.data.studentId,
        coachId: coachProfile.id,
        contentEleve: parsed.data.contentEleve,
        contentParent: parsed.data.contentParent,
        contentInterne: parsed.data.contentInterne,
        scoreGlobal: parsed.data.scoreGlobal,
        domainScores: parsed.data.domainScores,
        strengths: parsed.data.strengths,
        areasForGrowth: parsed.data.areasForGrowth,
        nextSteps: parsed.data.nextSteps,
        isPublished: parsed.data.isPublished,
        publishedAt: parsed.data.isPublished ? new Date() : null,
      },
      update: {
        contentEleve: parsed.data.contentEleve,
        contentParent: parsed.data.contentParent,
        contentInterne: parsed.data.contentInterne,
        scoreGlobal: parsed.data.scoreGlobal,
        domainScores: parsed.data.domainScores,
        strengths: parsed.data.strengths,
        areasForGrowth: parsed.data.areasForGrowth,
        nextSteps: parsed.data.nextSteps,
        isPublished: parsed.data.isPublished,
        publishedAt: parsed.data.isPublished ? new Date() : undefined,
      },
    });

    return NextResponse.json({ success: true, bilan: { id: bilan.id, isPublished: bilan.isPublished } });
  } catch (error) {
    console.error('[POST bilans]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
