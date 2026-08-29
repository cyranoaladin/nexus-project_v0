export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { autosaveAssessmentResponse } from '@/lib/bilans/engine';
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

type RouteContext = {
  params: Promise<{ attemptId: string; itemId: string }>;
};
const bodySchema = z.object({
  expectedVersion: z.number().int().min(0),
  response: z.union([
    z.object({ selectedOptionIndex: z.number().int().min(0).max(3) }).strict(),
    z.object({ textValue: z.string().trim().min(1).max(2_000) }).strict(),
  ]),
}).strict();

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['PARENT', 'ELEVE']);
  if (isEngineResponse(actor)) return actor;
  const guard = await guardEngineMutation(request, {
    routeKey: 'response-autosave',
    userId: actor.userId,
  });
  if (guard) return guard;
  const routeParams = await params;
  const attemptId = parseEngineIdentifier(routeParams.attemptId);
  const itemId = parseEngineIdentifier(routeParams.itemId);
  const idempotencyKey = readIdempotencyKey(request);
  const rawBody = await readEngineBody(request, 4_096);
  if (isEngineResponse(rawBody)) return rawBody;
  const body = bodySchema.safeParse(rawBody);
  if (!attemptId || !itemId || !idempotencyKey || !body.success) {
    return engineJson({ error: 'Requête invalide.' }, 400);
  }
  try {
    return engineJson({
      response: await autosaveAssessmentResponse(
        assessmentEngineContext(),
        {
          actor,
          command: {
            attemptId,
            itemId,
            expectedVersion: body.data.expectedVersion,
            response: body.data.response,
          },
          idempotencyKey,
        },
      ),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
