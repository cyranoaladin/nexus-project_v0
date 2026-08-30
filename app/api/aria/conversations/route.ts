export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { createLogger } from '@/lib/middleware/logger';
import { prisma } from '@/lib/prisma';
import { isKnownCourseKey } from '@/lib/curriculum/catalog';
import { mapLegacySubjectToCourseKey } from '@/lib/aria/legacy-adapter';
import { toAriaErrorResponse, AriaError } from '@/lib/aria/errors';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const logger = createLogger(request);

  try {
    let session: import('next-auth').Session | null = null;
    try {
      session = await auth();
    } catch {
      // Standalone mode bypass
    }

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    });

    if (!student) {
      throw new AriaError('NOT_ENROLLED', 404, 'Profil élève non trouvé');
    }

    const { searchParams } = new URL(request.url);
    const queryCourseKey = searchParams.get('courseKey');
    const querySubject = searchParams.get('subject');

    let filterCourseKey: string | undefined;

    // Invariant ARIA_HISTORY_PRIMARY_CONTEXT=COURSE_KEY
    if (queryCourseKey) {
      if (!isKnownCourseKey(queryCourseKey)) {
        throw new AriaError('COURSE_NOT_FOUND', 400, `Cours inconnu : ${queryCourseKey}`);
      }
      filterCourseKey = queryCourseKey;
    } else if (querySubject) {
      filterCourseKey = mapLegacySubjectToCourseKey(querySubject, student.gradeLevel);
    }

    const whereClause: { studentId: string; courseKey?: string } = {
      studentId: student.id,
    };

    if (filterCourseKey) {
      whereClause.courseKey = filterCourseKey;
    }

    const conversations = await prisma.ariaConversation.findMany({
      where: whereClause,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      conversations: conversations.map((conv) => ({
        id: conv.id,
        courseKey: conv.courseKey,
        subject: conv.subject,
        title: conv.title,
        messages: conv.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          status: msg.status,
          feedback: msg.feedback,
          createdAt: msg.createdAt,
        })),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      })),
    });
  } catch (error: unknown) {
    return toAriaErrorResponse(error, logger);
  }
}
