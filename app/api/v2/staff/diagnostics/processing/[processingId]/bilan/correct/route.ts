export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { applyHumanBilanCorrection, applyHumanBilanCorrectionBodySchema } from '@/lib/core-v2/services/diagnostic-bilan';

/**
 * Optimistic-concurrency correction (mission §7): the caller must supply
 * the editVersion it read; a stale write is refused with 409, never
 * silently applied over a concurrent edit.
 */
export const POST = defineStaffRoute({
  body: applyHumanBilanCorrectionBodySchema,
  handler: async ({ client, ctx, params, body }) => ({
    data: await applyHumanBilanCorrection(client, ctx, params.processingId, body),
  }),
});
