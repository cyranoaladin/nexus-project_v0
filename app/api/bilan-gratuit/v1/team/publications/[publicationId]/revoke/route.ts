export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { revokeAssessmentReport } from '@/lib/bilans/engine';
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

type RouteContext = { params: Promise<{ publicationId: string }> };
const bodySchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
}).strict();

export async function POST(request: NextRequest, { params }: RouteContext) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['COACH', 'ADMIN']);
  if (isEngineResponse(actor)) return actor;
  const guard = await guardEngineMutation(request, {
    routeKey: 'report-revoke',
    userId: actor.userId,
  });
  if (guard) return guard;
  const publicationId = parseEngineIdentifier((await params).publicationId);
  const rawBody = await readEngineBody(request, 4_096);
  if (isEngineResponse(rawBody)) return rawBody;
  const body = bodySchema.safeParse(rawBody);
  const idempotencyKey = readIdempotencyKey(request);
  if (!publicationId || !body.success || !idempotencyKey) {
    return engineJson({ error: 'Requête invalide.' }, 400);
  }
  try {
    return engineJson({
      publication: await revokeAssessmentReport(assessmentEngineContext(), {
        actor,
        publicationId,
        reason: body.data.reason,
        idempotencyKey,
      }),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
