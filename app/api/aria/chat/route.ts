export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { streamAriaConversation, executeAriaConversationJson } from '@/lib/aria/orchestration';
import { mapLegacySubjectToCourseKey } from '@/lib/aria/legacy-adapter';
import { createLogger } from '@/lib/middleware/logger';
import { prisma } from '@/lib/prisma';
import { toAriaErrorResponse, AriaError } from '@/lib/aria/errors';
import { Subject } from '@/types/enums';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Invariant ARIA_WRITE_SCHEMAS_STRICT=PASS : schéma strict interdisant toute injection
const ariaChatRequestSchema = z
  .object({
    courseKey: z.string().min(1).optional(),
    subject: z.nativeEnum(Subject).optional(),
    skillId: z.string().min(1).optional(),
    resourceId: z.string().min(1).optional(),
    conversationId: z.string().min(1).optional(),
    content: z
      .string()
      .min(1, 'Message requis')
      .max(1500, 'Message trop long')
      .refine((s) => s.trim().length > 0, 'Message vide non autorisé'),
  })
  .strict();

export async function POST(request: NextRequest) {
  const logger = createLogger(request);
  const acceptHeader = request.headers.get('accept') || '';
  const isStreamingRequest = acceptHeader.includes('text/event-stream');

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

    const body = await request.json();
    const validated = ariaChatRequestSchema.parse(body);

    // 1. Chargement du profil élève
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
      throw new AriaError('NOT_ENROLLED', 404, 'Profil élève introuvable.');
    }

    // 2. Détermination de la clé de cours canonique (ARIA_RUNTIME_PRIMARY_CONTEXT=COURSE_KEY)
    let resolvedCourseKey: string;

    if (validated.courseKey) {
      resolvedCourseKey = validated.courseKey;
    } else if (validated.subject) {
      // Résolution explicite via le niveau réel de l'élève (aucun niveau par défaut)
      resolvedCourseKey = mapLegacySubjectToCourseKey(validated.subject, student.gradeLevel);
    } else {
      throw new AriaError(
        'BAD_REQUEST',
        400,
        'Une clé de cours (courseKey) ou une matière (subject) est requise.'
      );
    }

    // 3. Branche Streaming SSE unifiée (consomme executeAriaConversation via l'adaptateur streamAriaConversation)
    if (isStreamingRequest) {
      const sseStream = await streamAriaConversation({
        studentId: student.id,
        courseKey: resolvedCourseKey,
        skillId: validated.skillId,
        resourceId: validated.resourceId,
        message: validated.content,
        conversationId: validated.conversationId,
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

    // 4. Branche JSON unifiée (consomme executeAriaConversation via l'adaptateur executeAriaConversationJson)
    // Invariant ARIA_GENERATION_PIPELINES=1 : même moteur, même RAG, même persistance
    const result = await executeAriaConversationJson({
      studentId: student.id,
      courseKey: resolvedCourseKey,
      skillId: validated.skillId,
      resourceId: validated.resourceId,
      message: validated.content,
      conversationId: validated.conversationId,
      signal: request.signal,
    });

    return NextResponse.json({
      success: true,
      conversation: {
        id: result.conversationId,
        courseKey: resolvedCourseKey,
      },
      message: {
        id: result.messageId,
        content: result.fullText,
        citations: result.citations,
      },
      newBadges: result.newBadges,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données de requête invalides', code: 'BAD_REQUEST', issues: error.issues },
        { status: 400 }
      );
    }
    return toAriaErrorResponse(error, logger);
  }
}
