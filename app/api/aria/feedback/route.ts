export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { recordAriaFeedbackForActor } from '@/lib/aria/application/feedback/public';
import { checkAndAwardBadges } from '@/lib/badges';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse, AriaError } from '@/lib/aria/errors';
import { ariaFeedbackResponseSchema } from '@/lib/aria/transport/contracts';
import { requireInternalAriaResponse } from '@/lib/aria/transport/internal-response';
import { readBoundedAriaJson } from '@/lib/aria/transport/read-json-body';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Invariant ARIA_WRITE_SCHEMAS_STRICT=PASS : schéma strict interdisant toute injection
const ariaFeedbackSchema = z
  .object({
    messageId: z.string().min(1, 'messageId requis'),
    useful: z.boolean(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const logger = createLogger(request);

  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await readBoundedAriaJson(request);
    const validatedData = ariaFeedbackSchema.parse(body);

    const feedbackRecord = await recordAriaFeedbackForActor({
      actor: { userId: session.user.id, role: session.user.role },
      messageId: validatedData.messageId,
      useful: validatedData.useful,
      reason: validatedData.reason,
    });

    let newBadges: Awaited<ReturnType<typeof checkAndAwardBadges>> = [];
    try {
      newBadges = await checkAndAwardBadges(feedbackRecord.subjectStudentId, 'aria_feedback');
    } catch {
      logger.warn('ARIA secondary operation failed', {
        requestId: logger.getRequestId(),
        operation: 'award_feedback_badges',
      });
    }

    logger.info('ARIA feedback recorded', {
      requestId: logger.getRequestId(),
      operation: 'record_feedback',
    });

    const publicResult = requireInternalAriaResponse(ariaFeedbackResponseSchema, {
      success: true,
      feedback: {
        id: feedbackRecord.id,
        useful: feedbackRecord.useful,
        reason: feedbackRecord.reason,
        updatedAt: feedbackRecord.updatedAt,
      },
      newBadges: newBadges.map((b) => ({
        name: b.badge.name,
        description: b.badge.description,
        icon: b.badge.icon,
      })),
    });
    return NextResponse.json(publicResult);
  } catch (error: unknown) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return toAriaErrorResponse(
        new AriaError('BAD_REQUEST', 400, 'Requête de feedback ARIA invalide.'),
        logger,
      );
    }
    return toAriaErrorResponse(error, logger);
  }
}
