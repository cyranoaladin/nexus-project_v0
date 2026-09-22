export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { getOwnPublishedBilan } from '@/lib/core-v2/services/diagnostic-bilan';

/**
 * Self-service: the signed-in candidate's own PUBLISHED bilan, for the
 * "own-student" audience only. A DRAFT or VALIDATED (not yet published)
 * revision is a 404 here — its existence is never leaked to the candidate.
 */
export const GET = defineStaffRoute({
  handler: async ({ client, ctx, params }) => ({
    data: await getOwnPublishedBilan(client, ctx, params.processingId),
  }),
});
