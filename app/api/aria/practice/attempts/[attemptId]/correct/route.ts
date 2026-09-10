export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { correctAriaPracticeAttempt } from '@/lib/aria/application/practice/correct-attempt';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse } from '@/lib/aria/errors';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ attemptId: string }> },
) {
  const logger = createLogger(request);
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ELEVE') {
      return unauthorizedAriaResponse(logger);
    }

    const { attemptId } = await context.params;

    const { result, alreadyCorrected } = await correctAriaPracticeAttempt({
      actor: { userId: session.user.id, role: session.user.role },
      attemptId,
    });
    // Never the correctionRubric — only the outcome/feedback a student may see.
    return NextResponse.json({
      result: {
        id: result.id,
        attemptId: result.attemptId,
        outcome: result.outcome,
        feedback: result.feedback,
        correctedAt: result.correctedAt,
      },
      alreadyCorrected,
    });
  } catch (error: unknown) {
    return toAriaErrorResponse(error, logger);
  }
}
