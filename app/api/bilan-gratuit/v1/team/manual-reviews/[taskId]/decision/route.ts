export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

import {
  completeManualReviewTask,
  manualReviewDecisionCommandSchema,
  manualReviewRevisionCommandSchema,
  reviseManualReviewDecision,
} from '@/lib/bilans/engine';
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

type RouteContext = { params: Promise<{ taskId: string }> };

async function prepare(request: NextRequest, context: RouteContext) {
  const disabled = engineDisabledResponse();
  if (disabled) return { response: disabled } as const;
  const actor = await requireAssessmentActor(['COACH', 'ADMIN']);
  if (isEngineResponse(actor)) return { response: actor } as const;
  const guard = await guardEngineMutation(request, {
    routeKey: 'manual-decision',
    userId: actor.userId,
  });
  if (guard) return { response: guard } as const;
  const taskId = parseEngineIdentifier((await context.params).taskId);
  const rawBody = await readEngineBody(request, 8_192);
  if (isEngineResponse(rawBody)) return { response: rawBody } as const;
  const idempotencyKey = readIdempotencyKey(request);
  if (!taskId || !idempotencyKey) {
    return { response: engineJson({ error: 'Requête invalide.' }, 400) } as const;
  }
  return { actor, idempotencyKey, rawBody, taskId } as const;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const prepared = await prepare(request, context);
  if ('response' in prepared) return prepared.response;
  const command = manualReviewDecisionCommandSchema.safeParse({
    ...(prepared.rawBody as object),
    taskId: prepared.taskId,
  });
  if (!command.success) return engineJson({ error: 'Requête invalide.' }, 400);
  try {
    return engineJson({
      decision: await completeManualReviewTask(assessmentEngineContext(), {
        actor: prepared.actor,
        command: command.data,
        idempotencyKey: prepared.idempotencyKey,
      }),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const prepared = await prepare(request, context);
  if ('response' in prepared) return prepared.response;
  const command = manualReviewRevisionCommandSchema.safeParse({
    ...(prepared.rawBody as object),
    taskId: prepared.taskId,
  });
  if (!command.success) return engineJson({ error: 'Requête invalide.' }, 400);
  try {
    return engineJson({
      decision: await reviseManualReviewDecision(assessmentEngineContext(), {
        actor: prepared.actor,
        command: command.data,
        idempotencyKey: prepared.idempotencyKey,
      }),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
