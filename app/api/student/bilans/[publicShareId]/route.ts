import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ publicShareId: string }>;
}

/**
 * GET /api/student/bilans/[publicShareId]
 * Returns a published canonical bilan for the authenticated student.
 * Only returns studentMarkdown — never parentsMarkdown or nexusMarkdown.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { publicShareId } = await params;

    const sessionOrError = await requireRole('ELEVE');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    const student = await prisma.student.findUnique({
      where: { userId: authSession.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const bilan = await prisma.bilan.findFirst({
      where: {
        publicShareId,
        studentId: student.id,
        isPublished: true,
        studentMarkdown: { not: null },
      },
      select: {
        id: true,
        publicShareId: true,
        type: true,
        subject: true,
        studentMarkdown: true,
        globalScore: true,
        createdAt: true,
        publishedAt: true,
        coach: {
          select: {
            user: { select: { firstName: true, lastName: true } },
            pseudonym: true,
          },
        },
      },
    });

    if (!bilan) {
      return NextResponse.json({ error: 'Bilan non trouvé ou non disponible' }, { status: 404 });
    }

    return NextResponse.json({ bilan });
  } catch (error) {
    console.error('[API student/bilans/[publicShareId] GET]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
