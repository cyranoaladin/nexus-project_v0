export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { scoreAssessmentAttempt } from '@/lib/bilans/engine';
import {
  assessmentEngineContext,
  engineDisabledResponse,
  engineErrorResponse,
  engineJson,
  guardEngineMutation,
  isEngineResponse,
  parseEngineIdentifier,
  readEngineBody,
  readIdempotencyKey,
  requireAssessmentActor,
} from '@/lib/bilans/engine/http';
import { getBilanFeatureFlags } from '@/lib/bilans/requests/feature-flags';

type RouteContext = { params: Promise<{ attemptId: string }> };
const bodySchema = z.object({
  resultKind: z.enum(['PROVISIONAL', 'FINAL']),
}).strict();

export async function POST(request: NextRequest, { params }: RouteContext) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['ASSISTANTE', 'COACH', 'ADMIN']);
  if (isEngineResponse(actor)) return actor;
  const guard = await guardEngineMutation(request, {
    routeKey: 'attempt-score',
    userId: actor.userId,
  });
  if (guard) return guard;
  const attemptId = parseEngineIdentifier((await params).attemptId);
  const rawBody = await readEngineBody(request, 1_024);
  if (isEngineResponse(rawBody)) return rawBody;
  const body = bodySchema.safeParse(rawBody);
  const idempotencyKey = readIdempotencyKey(request);
  if (!attemptId || !body.success || !idempotencyKey) {
    return engineJson({ error: 'Requête invalide.' }, 400);
  }
  try {
    return engineJson({
      score: await scoreAssessmentAttempt(assessmentEngineContext(), {
        actor,
        attemptId,
        resultKind: body.data.resultKind,
        provisionalResultsEnabled:
          getBilanFeatureFlags().provisionalResultsEnabled,
        idempotencyKey,
      }),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
