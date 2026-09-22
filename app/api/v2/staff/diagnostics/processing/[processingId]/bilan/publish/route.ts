export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { publishBilanDraft, publishBilanDraftBodySchema } from '@/lib/core-v2/services/diagnostic-bilan';

/**
 * VALIDATED -> PUBLISHED, for exactly the audience named — always this
 * explicit, human-triggered call, never a model action (mission §7).
 */
export const POST = defineStaffRoute({
  body: publishBilanDraftBodySchema,
  handler: async ({ client, ctx, params, body }) => ({
    data: await publishBilanDraft(client, ctx, params.processingId, body),
  }),
});
