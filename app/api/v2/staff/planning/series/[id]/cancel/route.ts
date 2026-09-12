export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { cancelPlanningSeries } from '@/lib/core-v2/services';

/** Future-only cancellation of a series (optimistic: the caller states the revision it read). */
export const POST = defineStaffRoute({
  body: z.object({ expectedRevision: z.number().int() }),
  handler: async ({ client, ctx, body, params }) => ({
    data: await cancelPlanningSeries(client, ctx, { seriesId: params.id, expectedRevision: body.expectedRevision }),
  }),
});
