export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { hasUserEmail } from '@/lib/contact/user-email';
import {
  currentParentLinkIsVerified,
  currentParentLinkOrderBy,
  type CurrentParentLink,
} from '@/lib/bilans/api/parent-access';

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
      return NextResponse.json({ reservations: [], bilans: [], coachBilans: [] });
    }

    const childEmails = parent.children.map((c) => c.user.email).filter(hasUserEmail);
    const childIds = parent.children.map((c) => c.id);

    // The unified Bilan model (coachBilans below) is served through
    // GET /api/parent/bilans/[id]/pdf, which requires a currently VERIFIED
    // canonical ParentStudentLink (see resolveParentOwnedStudent). A legacy
    // child (Student.parentId FK) with no such link would otherwise show a
    // PDF button here that 404s when clicked. Scope coachBilans visibility to
    // the same guard so the button never appears when it would fail.
    const now = new Date();
    const links = childIds.length === 0 ? [] : await prisma.parentStudentLink.findMany({
      where: { parentUserId: sessionOrError.user.id, studentId: { in: childIds } },
      orderBy: currentParentLinkOrderBy(),
      select: { id: true, studentId: true, state: true, verifiedAt: true, revokedAt: true, expiresAt: true },
    });
    const latestLinkByStudent = new Map<string, CurrentParentLink & { studentId: string }>();
    for (const link of links) {
      if (!latestLinkByStudent.has(link.studentId)) {
        latestLinkByStudent.set(link.studentId, link);
      }
    }
    const canonicalVerifiedChildIds = childIds.filter((id) =>
      currentParentLinkIsVerified(latestLinkByStudent.get(id) ?? null, now)
    );

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

    // Legacy: StageBilan (older stages)
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

    // Unified Bilan model (maths-premiere-stage-printemps + eaf-stage-printemps).
    // Scoped to canonicalVerifiedChildIds (not the raw legacy childIds) so the
    // dashboard never shows a PDF/report button for a child whose canonical
    // parent-student consent isn't currently VERIFIED — see the guard note above.
    const coachBilans = canonicalVerifiedChildIds.length === 0 ? [] : await prisma.bilan.findMany({
      where: {
        studentId: { in: canonicalVerifiedChildIds },
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
        parentsMarkdown: true,
        publishedAt: true,
        createdAt: true,
        stage: { select: { title: true, slug: true } },
        coach: { select: { pseudonym: true } },
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { publishedAt: 'desc' },
    });

    return NextResponse.json({ reservations, bilans, coachBilans });
  } catch (error) {
    console.error('[GET /api/parent/stages]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
