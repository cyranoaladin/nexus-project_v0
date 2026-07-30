export const dynamic = 'force-dynamic';

import {
  assessmentEngineContext,
  engineDisabledResponse,
  engineErrorResponse,
  engineJson,
  isEngineResponse,
  parseEngineIdentifier,
  requireAssessmentActor,
} from '@/lib/bilans/engine/http';
import { getAssignmentPublicDefinition } from '@/lib/bilans/engine';

type RouteContext = { params: Promise<{ assignmentId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['PARENT', 'ELEVE']);
  if (isEngineResponse(actor)) return actor;
  const assignmentId = parseEngineIdentifier((await params).assignmentId);
  if (!assignmentId) return engineJson({ error: 'Requête invalide.' }, 400);
  try {
    return engineJson({
      definition: await getAssignmentPublicDefinition(
        assessmentEngineContext(),
        { actor, assignmentId },
      ),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
