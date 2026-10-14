export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { lockAriaV1Subject, ariaActivityRepository, ariaLearningEvidenceRecorder, ariaModelCompletionStream } from '@/lib/aria/application/v1-composition';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { makeCorrectAriaPracticeAttempt, type CorrectionAuthority } from '@/lib/aria/application/practice/correct-attempt';
import { authorizePracticeCorrectionForActor } from '@/lib/aria/application/practice/authorize';
import { readBoundPrivateV1Session } from '@/lib/auth/private-v1-session';
import { withV1SessionAuthority } from '@/lib/auth/v1-session-authority';
import { AriaAuthorityRevokedError } from '@/lib/aria/kernel/errors';
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

    const claims = await readBoundPrivateV1Session(request, session);
    if (!claims) throw new AriaAuthorityRevokedError();
    const { attemptId } = await context.params;
    const withAuthority: CorrectionAuthority = operation => {
      let finalScope: (() => void) | undefined;
      return withV1SessionAuthority(claims, async tx => {
      await lockAriaV1Subject(tx, claims.userId, true);
      return await operation({ repository: ariaActivityRepository(tx),
        authorize: async input => {
          const authorization = await authorizePracticeCorrectionForActor(input, tx);
          finalScope = authorization.assertCurrent;
          return authorization;
        },
        recordEvidence: ariaLearningEvidenceRecorder(tx) });
      }, () => finalScope!());
    };
    let response: NextResponse | undefined;
    const correct = makeCorrectAriaPracticeAttempt({
      streamModel: (messages, options) => ariaModelCompletionStream(messages, options), withAuthority,
      present: ({ result, alreadyCorrected }) => {
        // Never the rubric. Projection errors also roll back the correction.
        response = NextResponse.json({ result: {
          id: result.id, attemptId: result.attemptId, outcome: result.outcome,
          feedback: result.feedback, correctedAt: result.correctedAt,
        }, alreadyCorrected }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
      },
    });

    await correct({
      actor: claims,
      attemptId,
    });
    return response!;
  } catch (error: unknown) {
    return toAriaErrorResponse(error, logger);
  }
}
