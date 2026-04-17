export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const sessionOrError = await requireRole('ELEVE');
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  const userEmail = sessionOrError.user.email;

  try {
    const reservations = await prisma.stageReservation.findMany({
      where: {
        email: userEmail,
        richStatus: 'CONFIRMED',
      },
      include: {
        stage: {
          include: {
            sessions: { orderBy: { startAt: 'asc' } },
            documents: { where: { isPublic: true } },
            coaches: { include: { coach: { select: { pseudonym: true } } } },
          },
        },
      },
    });

    const student = await prisma.student.findFirst({
      where: { user: { email: userEmail } },
    });

    const bilans = student
      ? await prisma.stageBilan.findMany({
          where: { studentId: student.id, isPublished: true },
          select: {
            id: true,
            stageId: true,
            coachId: true,
            contentEleve: true,
            scoreGlobal: true,
            domainScores: true,
            strengths: true,
            areasForGrowth: true,
            nextSteps: true,
            pdfUrl: true,
            publishedAt: true,
            stage: { select: { title: true, slug: true } },
          },
        })
      : [];

    return NextResponse.json({ reservations, bilans });
  } catch (error) {
    console.error('[GET /api/student/stages]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
