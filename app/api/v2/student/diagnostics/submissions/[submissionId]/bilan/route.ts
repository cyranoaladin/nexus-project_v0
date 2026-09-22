export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { getOwnPublishedBilanForSubmission } from '@/lib/core-v2/services/diagnostic-bilan';

/**
 * Self-service: the candidate's own PUBLISHED bilan, reached from their
 * own submissionId (the id their "Diagnostics libres" screen already
 * knows) rather than the internal processingId.
 */
export const GET = defineStaffRoute({
  handler: async ({ client, ctx, params }) => ({
    data: await getOwnPublishedBilanForSubmission(client, ctx, params.submissionId),
  }),
});
