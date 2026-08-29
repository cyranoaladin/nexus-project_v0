export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

import { startAssessmentAttempt } from '@/lib/bilans/engine';
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

type RouteContext = { params: Promise<{ assignmentId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['PARENT', 'ELEVE']);
  if (isEngineResponse(actor)) return actor;
  const guard = await guardEngineMutation(request, {
    routeKey: 'attempt-start',
    userId: actor.userId,
  });
  if (guard) return guard;
  const assignmentId = parseEngineIdentifier((await params).assignmentId);
  const idempotencyKey = readIdempotencyKey(request);
  if (!assignmentId || !idempotencyKey) {
    return engineJson({ error: 'Requête invalide.' }, 400);
  }
  try {
    return engineJson({
      attempt: await startAssessmentAttempt(assessmentEngineContext(), {
        actor,
        assignmentId,
        idempotencyKey,
      }),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
