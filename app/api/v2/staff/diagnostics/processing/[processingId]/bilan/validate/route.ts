export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { validateBilanDraft, validateBilanDraftBodySchema } from '@/lib/core-v2/services/diagnostic-bilan';

/** DRAFT -> VALIDATED. Same optimistic-concurrency guard as the correct route. */
export const POST = defineStaffRoute({
  body: validateBilanDraftBodySchema,
  handler: async ({ client, ctx, params, body }) => ({
    data: await validateBilanDraft(client, ctx, params.processingId, body),
  }),
});
