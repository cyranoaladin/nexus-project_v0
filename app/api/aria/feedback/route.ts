export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { recordAriaFeedback } from '@/lib/aria/feedback';
import { checkAndAwardBadges } from '@/lib/badges';
import { createLogger } from '@/lib/middleware/logger';
import { prisma } from '@/lib/prisma';
import { toAriaErrorResponse, AriaError } from '@/lib/aria/errors';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Invariant ARIA_WRITE_SCHEMAS_STRICT=PASS : schéma strict interdisant toute injection
const ariaFeedbackSchema = z
  .object({
    messageId: z.string().min(1, 'messageId requis'),
    feedback: z.boolean(),
    reason: z.string().max(500).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const logger = createLogger(request);

  try {
    let session: import('next-auth').Session | null = null;
    try {
      session = await auth();
    } catch {
      // Bypass pour build standalone
    }

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = ariaFeedbackSchema.parse(body);

    // Vérifier que le message existe et appartient à l'élève
    const message = await prisma.ariaMessage.findFirst({
      where: {
        id: validatedData.messageId,
        conversation: {
          student: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message non trouvé', code: 'NOT_FOUND' }, { status: 404 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    });

    if (!student) {
      throw new AriaError('NOT_ENROLLED', 404, 'Profil élève introuvable.');
    }

    // Invariant ARIA_FEEDBACK_SOURCES_OF_TRUTH=1 : persistance canonique
    const feedbackRecord = await recordAriaFeedback({
      messageId: validatedData.messageId,
      studentId: student.id,
      useful: validatedData.feedback,
      reason: validatedData.reason,
    });

    // Attribution de badges de participation
    const newBadges = await checkAndAwardBadges(student.id, 'aria_feedback').catch(() => []);

    logger.info('ARIA feedback recorded', {
      studentId: student.id,
      messageId: validatedData.messageId,
      useful: validatedData.feedback,
      feedbackId: feedbackRecord.id,
    });

    return NextResponse.json({
      success: true,
      feedback: {
        id: feedbackRecord.id,
        useful: feedbackRecord.useful,
      },
      newBadges: newBadges.map((b) => ({
        name: b.badge.name,
        description: b.badge.description,
        icon: b.badge.icon,
      })),
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
