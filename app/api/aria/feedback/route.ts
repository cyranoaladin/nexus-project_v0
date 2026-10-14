export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { lockAriaV1Subject, ariaFeedbackRepository } from '@/lib/aria/application/v1-composition';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { makeRecordAriaFeedback } from '@/lib/aria/application/feedback/public';
import { readBoundPrivateV1Session } from '@/lib/auth/private-v1-session';
import { withV1SessionAuthority } from '@/lib/auth/v1-session-authority';
import { AriaAuthorityRevokedError } from '@/lib/aria/kernel/errors';
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
      return unauthorizedAriaResponse(logger);
    }

    const claims = await readBoundPrivateV1Session(request, session);
    if (!claims) throw new AriaAuthorityRevokedError();
    const body = await readBoundedAriaJson(request);
    const validatedData = ariaFeedbackSchema.parse(body);

    let badgeFailed = false;
    const response = await withV1SessionAuthority(claims, async tx => {
    await lockAriaV1Subject(tx, claims.userId, false);
    const feedbackRecord = await makeRecordAriaFeedback(ariaFeedbackRepository(tx))({
      actor: claims,
      messageId: validatedData.messageId,
      useful: validatedData.useful,
      reason: validatedData.reason,
    });
    let newBadges: Awaited<ReturnType<typeof checkAndAwardBadges>> = [];
    await tx.$executeRawUnsafe('SAVEPOINT aria_feedback_badges');
    try {
      newBadges = await checkAndAwardBadges(feedbackRecord.subjectStudentId, 'aria_feedback', undefined, tx);
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT aria_feedback_badges');
    } catch {
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT aria_feedback_badges');
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT aria_feedback_badges');
      badgeFailed = true;
    }

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
    return NextResponse.json(publicResult, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
    });
    if (badgeFailed) logger.warn('ARIA secondary operation failed', {
      requestId: logger.getRequestId(), operation: 'award_feedback_badges',
    });
    logger.info('ARIA feedback recorded', { requestId: logger.getRequestId(), operation: 'record_feedback' });
    return response;
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
