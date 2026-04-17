export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const sessionOrError = await requireRole('COACH');
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: sessionOrError.user.id },
    });
    if (!coachProfile) {
      return NextResponse.json({ error: 'Profil coach introuvable' }, { status: 404 });
    }

    const stageAssignments = await prisma.stageCoach.findMany({
      where: { coachId: coachProfile.id },
      include: {
        stage: {
          include: {
            sessions: {
              where: { coachId: coachProfile.id },
              orderBy: { startAt: 'asc' },
            },
            reservations: {
              where: { richStatus: 'CONFIRMED' },
              select: {
                id: true,
                studentName: true,
                email: true,
                studentId: true,
              },
            },
            bilans: {
              where: { coachId: coachProfile.id },
              select: { studentId: true, isPublished: true, updatedAt: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ stageAssignments });
  } catch (error) {
    console.error('[GET /api/coach/stages]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
