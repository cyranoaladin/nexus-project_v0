export const dynamic = 'force-dynamic';

import {
  getAssessmentAttemptStatus,
} from '@/lib/bilans/engine';
import {
  assessmentEngineContext,
  engineDisabledResponse,
  engineErrorResponse,
  engineJson,
  isEngineResponse,
  parseEngineIdentifier,
  requireAssessmentActor,
} from '@/lib/bilans/engine/http';

type RouteContext = { params: Promise<{ attemptId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['PARENT', 'ELEVE']);
  if (isEngineResponse(actor)) return actor;
  const attemptId = parseEngineIdentifier((await params).attemptId);
  if (!attemptId) return engineJson({ error: 'Requête invalide.' }, 400);
  try {
    return engineJson({
      attempt: await getAssessmentAttemptStatus(
        assessmentEngineContext(),
        { actor, attemptId },
      ),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
