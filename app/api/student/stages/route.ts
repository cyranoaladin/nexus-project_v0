export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { familyStageReservationSelect, privateStageReadHeaders } from '@/lib/stages/family-read-projection';

export async function GET() {
  const sessionOrError = await requireRole('ELEVE');
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  const userId = sessionOrError.user.id;
  if (!userId) return NextResponse.json({ error: 'Identité élève invalide.' }, { status: 401, headers: privateStageReadHeaders });

  try {
    const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: 'Profil élève introuvable.' }, { status: 404, headers: privateStageReadHeaders });
    const reservations = await prisma.stageReservation.findMany({
      where: {
        studentId: student.id,
        richStatus: 'CONFIRMED',
      },
      select: familyStageReservationSelect,
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

    // Unified Bilan model (maths-premiere-stage-printemps + eaf-stage-printemps)
    const coachBilans = student
      ? await prisma.bilan.findMany({
          where: {
            studentId: student.id,
            type: 'STAGE_POST',
            isPublished: true,
          },
          select: {
            id: true,
            type: true,
            subject: true,
            studentId: true,
            studentName: true,
            globalScore: true,
            domainScores: true,
            studentMarkdown: true,
            publishedAt: true,
            createdAt: true,
            stage: { select: { title: true, slug: true } },
            coach: { select: { pseudonym: true } },
          },
          orderBy: { publishedAt: 'desc' },
        })
      : [];

    return NextResponse.json({ reservations, bilans, coachBilans }, { headers: privateStageReadHeaders });
  } catch {
    console.error('[GET /api/student/stages]', { code: 'STUDENT_STAGE_READ_FAILED' });
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500, headers: privateStageReadHeaders });
  }
}
