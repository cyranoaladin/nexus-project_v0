export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { cancelOccurrence } from '@/lib/core-v2/services';

/** Exception: this one occurrence will not take place; the series continues. */
export const POST = defineStaffRoute({
  body: z.object({ reason: z.string() }),
  handler: async ({ client, ctx, body, params }) => ({
    data: await cancelOccurrence(client, ctx, { bookingId: params.id, reason: body.reason }),
  }),
});
