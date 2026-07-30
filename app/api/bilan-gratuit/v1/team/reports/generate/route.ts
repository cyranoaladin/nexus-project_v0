export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { generateAssessmentReport } from '@/lib/bilans/engine';
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

const bodySchema = z.object({
  attemptId: z.string().trim().min(1).max(160),
  audience: z.enum(['STUDENT', 'PARENT', 'NEXUS']),
}).strict();

export async function POST(request: NextRequest) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['ASSISTANTE', 'COACH', 'ADMIN']);
  if (isEngineResponse(actor)) return actor;
  const guard = await guardEngineMutation(request, {
    routeKey: 'report-generate',
    userId: actor.userId,
  });
  if (guard) return guard;
  const rawBody = await readEngineBody(request, 2_048);
  if (isEngineResponse(rawBody)) return rawBody;
  const body = bodySchema.safeParse(rawBody);
  const idempotencyKey = readIdempotencyKey(request);
  if (!body.success || !idempotencyKey) {
    return engineJson({ error: 'Requête invalide.' }, 400);
  }
  try {
    return engineJson({
      revision: await generateAssessmentReport(assessmentEngineContext(), {
        actor,
        ...body.data,
        idempotencyKey,
      }),
    }, 201);
  } catch (error) {
    return engineErrorResponse(error);
  }
}
