export const dynamic = 'force-dynamic';

import { listManualReviewQueue } from '@/lib/bilans/engine';
import {
  assessmentEngineContext,
  engineDisabledResponse,
  engineErrorResponse,
  engineJson,
  isEngineResponse,
  requireAssessmentActor,
} from '@/lib/bilans/engine/http';

export async function GET() {
  const disabled = engineDisabledResponse();
  if (disabled) return disabled;
  const actor = await requireAssessmentActor(['COACH', 'ADMIN']);
  if (isEngineResponse(actor)) return actor;
  try {
    return engineJson({
      tasks: await listManualReviewQueue(assessmentEngineContext(), { actor }),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
