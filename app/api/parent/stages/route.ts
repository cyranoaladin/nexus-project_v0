export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const sessionOrError = await requireRole('PARENT');
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  try {
    const parent = await prisma.parentProfile.findUnique({
      where: { userId: sessionOrError.user.id },
      include: {
        children: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!parent) {
      return NextResponse.json({ reservations: [], bilans: [] });
    }

    const childEmails = parent.children.map((c) => c.user.email);
    const childIds = parent.children.map((c) => c.id);

    const reservations = await prisma.stageReservation.findMany({
      where: {
        email: { in: childEmails },
        richStatus: 'CONFIRMED',
      },
      include: {
        stage: {
          include: {
            sessions: { orderBy: { startAt: 'asc' } },
            documents: { where: { isPublic: true } },
          },
        },
      },
    });

    const bilans = await prisma.stageBilan.findMany({
      where: { studentId: { in: childIds }, isPublished: true },
      select: {
        id: true,
        stageId: true,
        studentId: true,
        contentParent: true,
        scoreGlobal: true,
        domainScores: true,
        strengths: true,
        areasForGrowth: true,
        nextSteps: true,
        pdfUrl: true,
        publishedAt: true,
        stage: { select: { title: true, slug: true } },
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    return NextResponse.json({ reservations, bilans });
  } catch (error) {
    console.error('[GET /api/parent/stages]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
