export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

import { submitAssessmentAttempt } from '@/lib/bilans/engine';
import {
  assessmentEngineContext,
  engineDisabledResponse,
  engineErrorResponse,
  engineJson,
  guardEngineMutation,
  isEngineResponse,
  parseEngineIdentifier,
  readIdempotencyKey,
  requireAssessmentActor,
} from '@/lib/bilans/engine/http';

type RouteContext = { params: Promise<{ attemptId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['PARENT', 'ELEVE']);
  if (isEngineResponse(actor)) return actor;
  const guard = await guardEngineMutation(request, {
    routeKey: 'attempt-submit',
    userId: actor.userId,
  });
  if (guard) return guard;
  const attemptId = parseEngineIdentifier((await params).attemptId);
  const idempotencyKey = readIdempotencyKey(request);
  if (!attemptId || !idempotencyKey) {
    return engineJson({ error: 'Requête invalide.' }, 400);
  }
  try {
    return engineJson({
      attempt: await submitAssessmentAttempt(assessmentEngineContext(), {
        actor,
        command: { attemptId },
        idempotencyKey,
      }),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
