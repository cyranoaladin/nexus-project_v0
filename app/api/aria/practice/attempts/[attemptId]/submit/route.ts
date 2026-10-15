export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { lockAriaV1Subject, ariaActivityRepository } from '@/lib/aria/application/v1-composition';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { makeSubmitAriaPracticeAttempt } from '@/lib/aria/application/practice/submit-attempt';
import { readBoundPrivateV1Session } from '@/lib/auth/private-v1-session';
import { withV1SessionAuthority } from '@/lib/auth/v1-session-authority';
import { AriaAuthorityRevokedError } from '@/lib/aria/kernel/errors';
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

    const claims = await readBoundPrivateV1Session(request, session);
    if (!claims) throw new AriaAuthorityRevokedError();
    const { attemptId } = await context.params;
    const body = await readBoundedAriaJson(request);
    const validated = submitAttemptSchema.parse(body);

    return await withV1SessionAuthority(claims, async tx => {
    await lockAriaV1Subject(tx, claims.userId, false);
    const result = await makeSubmitAriaPracticeAttempt(ariaActivityRepository(tx))({
      actor: claims,
      attemptId,
      payload: validated.payload,
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
    });
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
