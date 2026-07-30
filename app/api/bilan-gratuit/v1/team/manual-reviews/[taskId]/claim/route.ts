export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { claimManualReviewTask } from '@/lib/bilans/engine';
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
const bodySchema = z.object({
  leaseSeconds: z.number().int().min(30).max(1_800).default(300),
}).strict();

export async function POST(request: NextRequest, { params }: RouteContext) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['COACH', 'ADMIN']);
  if (isEngineResponse(actor)) return actor;
  const guard = await guardEngineMutation(request, {
    routeKey: 'manual-claim',
    userId: actor.userId,
  });
  if (guard) return guard;
  const taskId = parseEngineIdentifier((await params).taskId);
  const rawBody = await readEngineBody(request, 1_024);
  if (isEngineResponse(rawBody)) return rawBody;
  const body = bodySchema.safeParse(rawBody);
  const idempotencyKey = readIdempotencyKey(request);
  if (!taskId || !body.success || !idempotencyKey) {
    return engineJson({ error: 'Requête invalide.' }, 400);
  }
  try {
    return engineJson({
      task: await claimManualReviewTask(assessmentEngineContext(), {
        actor,
        taskId,
        leaseSeconds: body.data.leaseSeconds,
        idempotencyKey,
      }),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
