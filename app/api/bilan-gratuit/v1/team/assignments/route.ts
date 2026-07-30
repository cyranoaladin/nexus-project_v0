export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

import {
  assignmentCommandSchema,
  createAssessmentAssignment,
} from '@/lib/bilans/engine';
import {
  assessmentEngineContext,
  engineDisabledResponse,
  engineErrorResponse,
  engineJson,
  guardEngineMutation,
  isEngineResponse,
  readEngineBody,
  readIdempotencyKey,
  requireAssessmentActor,
} from '@/lib/bilans/engine/http';

export async function POST(request: NextRequest) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['ASSISTANTE', 'ADMIN']);
  if (isEngineResponse(actor)) return actor;
  const guard = await guardEngineMutation(request, {
    routeKey: 'assignment-create',
    userId: actor.userId,
  });
  if (guard) return guard;
  const rawBody = await readEngineBody(request);
  if (isEngineResponse(rawBody)) return rawBody;
  const command = assignmentCommandSchema.safeParse(rawBody);
  const idempotencyKey = readIdempotencyKey(request);
  if (!command.success || !idempotencyKey) {
    return engineJson({ error: 'Requête invalide.' }, 400);
  }
  try {
    return engineJson({
      assignment: await createAssessmentAssignment(
        assessmentEngineContext(),
        { actor, command: command.data, idempotencyKey },
      ),
    }, 201);
  } catch (error) {
    return engineErrorResponse(error);
  }
}
