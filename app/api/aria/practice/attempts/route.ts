export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { startAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { createLogger } from '@/lib/middleware/logger';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';
import { readBoundedAriaJson } from '@/lib/aria/transport/read-json-body';

const startAttemptSchema = z.object({
  activityId: z.string().min(1),
}).strict();

export async function POST(request: NextRequest) {
  const logger = createLogger(request);
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ELEVE') {
      return unauthorizedAriaResponse(logger);
    }

    const body = await readBoundedAriaJson(request);
    const validated = startAttemptSchema.parse(body);

    const attempt = await startAriaPracticeAttempt({
      actor: { userId: session.user.id, role: session.user.role },
      activityId: validated.activityId,
    });
    return NextResponse.json({ attempt });
  } catch (error: unknown) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return toAriaErrorResponse(
        new AriaError('BAD_REQUEST', 400, 'Requête de démarrage de tentative ARIA invalide.'),
        logger,
      );
    }
    return toAriaErrorResponse(error, logger);
  }
}
