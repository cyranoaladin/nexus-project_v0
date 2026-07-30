export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { approveAssessmentReport } from '@/lib/bilans/engine';
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

type RouteContext = { params: Promise<{ revisionId: string }> };
const bodySchema = z.object({
  motif: z.string().trim().min(1).max(2_000),
}).strict();

export async function POST(request: NextRequest, { params }: RouteContext) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['COACH', 'ADMIN']);
  if (isEngineResponse(actor)) return actor;
  const guard = await guardEngineMutation(request, {
    routeKey: 'report-approve',
    userId: actor.userId,
  });
  if (guard) return guard;
  const revisionId = parseEngineIdentifier((await params).revisionId);
  const rawBody = await readEngineBody(request, 4_096);
  if (isEngineResponse(rawBody)) return rawBody;
  const body = bodySchema.safeParse(rawBody);
  const idempotencyKey = readIdempotencyKey(request);
  if (!revisionId || !body.success || !idempotencyKey) {
    return engineJson({ error: 'Requête invalide.' }, 400);
  }
  try {
    return engineJson({
      revision: await approveAssessmentReport(assessmentEngineContext(), {
        actor,
        revisionId,
        motif: body.data.motif,
        idempotencyKey,
      }),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
