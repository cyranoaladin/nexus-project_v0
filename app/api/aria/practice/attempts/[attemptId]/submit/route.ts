export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { submitAriaPracticeAttempt } from '@/lib/aria/application/practice/submit-attempt';
import { createLogger } from '@/lib/middleware/logger';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';
import { readBoundedAriaJson } from '@/lib/aria/transport/read-json-body';

const submitAttemptSchema = z.object({
  payload: z.unknown(),
}).strict();

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
    const body = await readBoundedAriaJson(request);
    const validated = submitAttemptSchema.parse(body);

    const result = await submitAriaPracticeAttempt({
      actor: { userId: session.user.id, role: session.user.role },
      attemptId,
      payload: validated.payload,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return toAriaErrorResponse(
        new AriaError('BAD_REQUEST', 400, 'Requête de soumission ARIA invalide.'),
        logger,
      );
    }
    return toAriaErrorResponse(error, logger);
  }
}
