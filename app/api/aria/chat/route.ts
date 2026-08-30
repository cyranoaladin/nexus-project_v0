export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { streamAriaConversation } from '@/lib/aria/orchestration';
import { generateAriaResponse, saveAriaConversation } from '@/lib/aria';
import { resolveAriaCourseAccess } from '@/lib/aria/access';
import { isKnownCourseKey, getCourse } from '@/lib/aria/curriculum';
import { mapLegacySubjectToCourseKey } from '@/lib/aria/legacy-adapter';
import { checkAndAwardBadges } from '@/lib/badges';
import { createLogger } from '@/lib/middleware/logger';
import { prisma } from '@/lib/prisma';
import { Subject } from '@/types/enums';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ariaChatRequestSchema = z.object({
  courseKey: z.string().optional(),
  subject: z.nativeEnum(Subject).optional(),
  skillId: z.string().optional(),
  resourceId: z.string().optional(),
  conversationId: z.string().optional(),
  content: z.string().min(1, 'Message requis').max(1500, 'Message trop long'),
});

export async function POST(request: NextRequest) {
  const logger = createLogger(request);
  const acceptHeader = request.headers.get('accept') || '';
  const isStreamingRequest = acceptHeader.includes('text/event-stream');

  try {
    let session: import('next-auth').Session | null = null;
    try {
      session = await auth();
    } catch {
      // Standalone host bypass
    }

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const validated = ariaChatRequestSchema.parse(body);

    // 1. Récupération de l'élève et de ses abonnements
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        academicEnrollments: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Profil élève introuvable' }, { status: 404 });
    }

    // 2. Détermination de la clé de cours canonique (ARIA_RUNTIME_PRIMARY_CONTEXT=COURSE_KEY)
    let courseKey: string;

    if (validated.courseKey) {
      if (!isKnownCourseKey(validated.courseKey)) {
        return NextResponse.json(
          { error: `Clé de cours inconnue : ${validated.courseKey}` },
          { status: 400 }
        );
      }
      courseKey = validated.courseKey;
    } else if (validated.subject) {
      // Résolution rétro-compatible basée sur le cursus réel de l'élève
      try {
        courseKey = mapLegacySubjectToCourseKey(validated.subject, student.gradeLevel);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Matière non couverte';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    } else {
      return NextResponse.json(
        { error: 'Une clé de cours (courseKey) ou une matière (subject) est requise' },
        { status: 400 }
      );
    }

    // 3. Vérification des droits d'accès via le résolveur canonique UNIQUE (ARIA_ACCESS_RESOLVERS=1)
    const activeSub = student.subscriptions[0];
    let ariaSubjects: string[] = [];
    if (activeSub?.ariaSubjects) {
      if (Array.isArray(activeSub.ariaSubjects)) {
        ariaSubjects = activeSub.ariaSubjects as string[];
      } else if (typeof activeSub.ariaSubjects === 'string') {
        try {
          const parsed = JSON.parse(activeSub.ariaSubjects);
          if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
            ariaSubjects = parsed;
          }
        } catch {
          ariaSubjects = [activeSub.ariaSubjects];
        }
      }
    }

    const access = resolveAriaCourseAccess({
      courseKey,
      student,
      entitlements: {
        ariaSubjects,
        hasGlobalAriaAccess: ariaSubjects.includes('ALL'),
      },
    });

    if (!access.academicallyRelevant) {
      return NextResponse.json(
        { error: `Le cours (${courseKey}) ne fait pas partie de votre cursus scolaire.` },
        { status: 403 }
      );
    }

    if (!access.productSupported) {
      return NextResponse.json(
        { error: `Le cours (${courseKey}) n'est pas encore supporté par ARIA.` },
        { status: 422 }
      );
    }

    if (!access.commerciallyEntitled) {
      return NextResponse.json(
        { error: 'Accès ARIA non autorisé pour ce cours. Veuillez vérifier votre formule.' },
        { status: 403 }
      );
    }

    // 4. Vérification d'appartenance de la conversation si spécifiée
    let ownedConversationId: string | undefined;
    if (validated.conversationId) {
      const conv = await prisma.ariaConversation.findFirst({
        where: { id: validated.conversationId, studentId: student.id },
        select: { id: true },
      });
      if (!conv) {
        return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 });
      }
      ownedConversationId = conv.id;
    }

    // 5. Branche Streaming (SSE canonique)
    if (isStreamingRequest) {
      const sseStream = await streamAriaConversation({
        studentId: student.id,
        courseKey,
        skillId: validated.skillId,
        resourceId: validated.resourceId,
        message: validated.content,
        conversationId: ownedConversationId,
        signal: request.signal,
      });

      return new Response(sseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // 6. Branche Synchrone (non-streaming)
    const course = getCourse(courseKey);
    const legacySubject = (course?.legacySubject as Subject) || Subject.MATHEMATIQUES;

    const ariaResponse = await generateAriaResponse(
      student.id,
      legacySubject,
      validated.content
    );

    const { conversation, ariaMessage } = await saveAriaConversation(
      student.id,
      legacySubject,
      validated.content,
      ariaResponse,
      ownedConversationId
    );

    const newBadges = await checkAndAwardBadges(student.id, 'first_aria_question');
    await checkAndAwardBadges(student.id, 'aria_question_count');

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        courseKey,
        subject: conversation.subject,
        title: conversation.title,
      },
      message: {
        id: ariaMessage.id,
        content: ariaResponse,
        createdAt: ariaMessage.createdAt,
      },
      newBadges: newBadges.map((b) => ({
        name: b.badge.name,
        description: b.badge.description,
        icon: b.badge.icon,
      })),
    });
  } catch (error: unknown) {
    logger.error('Erreur chat ARIA:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
