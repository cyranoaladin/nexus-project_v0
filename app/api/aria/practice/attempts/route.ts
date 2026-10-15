export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { lockAriaV1Subject, ariaActivityRepository } from '@/lib/aria/application/v1-composition';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { makeStartAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { authorizePracticeCourseForActor } from '@/lib/aria/application/practice/authorize';
import { readBoundPrivateV1Session } from '@/lib/auth/private-v1-session';
import { withV1SessionAuthority } from '@/lib/auth/v1-session-authority';
import { AriaAuthorityRevokedError } from '@/lib/aria/kernel/errors';
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

    const claims = await readBoundPrivateV1Session(request, session);
    if (!claims) throw new AriaAuthorityRevokedError();
    const body = await readBoundedAriaJson(request);
    const validated = startAttemptSchema.parse(body);

    let finalScope: (() => void) | undefined;
    return await withV1SessionAuthority(claims, async tx => {
    await lockAriaV1Subject(tx, claims.userId, true);
    const start = makeStartAriaPracticeAttempt(ariaActivityRepository(tx), input => authorizePracticeCourseForActor(input, tx));
    const attempt = await start({
      actor: claims,
      activityId: validated.activityId,
    });
    const authorization = await authorizePracticeCourseForActor({ actor: claims, courseKey: attempt.courseKey }, tx);
    finalScope = authorization.assertCurrent;
    return NextResponse.json({ attempt }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
    }, () => finalScope!());
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
