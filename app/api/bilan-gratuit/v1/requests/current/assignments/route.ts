export const dynamic = 'force-dynamic';

import {
  assessmentEngineContext,
  engineDisabledResponse,
  engineErrorResponse,
  engineJson,
  isEngineResponse,
  requireAssessmentActor,
} from '@/lib/bilans/engine/http';
import { listAssessmentAssignments } from '@/lib/bilans/engine';

export async function GET() {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['PARENT', 'ELEVE']);
  if (isEngineResponse(actor)) return actor;
  try {
    return engineJson({
      assignments: await listAssessmentAssignments(
        assessmentEngineContext(),
        { actor },
      ),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
