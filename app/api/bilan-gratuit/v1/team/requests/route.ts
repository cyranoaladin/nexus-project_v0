export const dynamic = 'force-dynamic';

import { listTeamBilanRequests } from '@/lib/bilans/engine';
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
  const actor = await requireAssessmentActor(['ASSISTANTE', 'COACH', 'ADMIN']);
  if (isEngineResponse(actor)) return actor;
  try {
    return engineJson({
      requests: await listTeamBilanRequests(
        assessmentEngineContext(),
        { actor },
      ),
    });
  } catch (error) {
    return engineErrorResponse(error);
  }
}
