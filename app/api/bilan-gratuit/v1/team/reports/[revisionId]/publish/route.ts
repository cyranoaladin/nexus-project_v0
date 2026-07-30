export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

import { publishAssessmentReport } from '@/lib/bilans/engine';
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

type RouteContext = { params: Promise<{ revisionId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['COACH', 'ADMIN']);
  if (isEngineResponse(actor)) return actor;
  const guard = await guardEngineMutation(request, {
    routeKey: 'report-publish',
    userId: actor.userId,
  });
  if (guard) return guard;
  const revisionId = parseEngineIdentifier((await params).revisionId);
  const idempotencyKey = readIdempotencyKey(request);
  if (!revisionId || !idempotencyKey) {
    return engineJson({ error: 'Requête invalide.' }, 400);
  }
  try {
    return engineJson({
      publication: await publishAssessmentReport(
        assessmentEngineContext(),
        { actor, revisionId, idempotencyKey },
      ),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
