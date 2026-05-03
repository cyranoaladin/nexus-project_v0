export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/eleve/stages
 * Returns the student's own stage bilans (published only).
 * Includes the unified Bilan model (type=STAGE_POST) so maths-premiere + EAF both work.
 */
export async function GET() {
  const sessionOrError = await requireRole('ELEVE');
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  try {
    const student = await prisma.student.findUnique({
      where: { userId: sessionOrError.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ coachBilans: [] });
    }

    const coachBilans = await prisma.bilan.findMany({
      where: {
        studentId: student.id,
        type: 'STAGE_POST',
        isPublished: true,
      },
      select: {
        id: true,
        subject: true,
        studentMarkdown: true,
        publishedAt: true,
        createdAt: true,
        stage: { select: { title: true, slug: true } },
        coach: { select: { pseudonym: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });

    return NextResponse.json({ coachBilans });
  } catch (error) {
    console.error('[GET /api/eleve/stages]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
