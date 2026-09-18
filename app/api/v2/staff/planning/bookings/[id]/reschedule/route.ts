export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { rescheduleOccurrence } from '@/lib/core-v2/services';

/** Exception: this one occurrence moves to another slot (series zone); a new booking overrides the original. */
export const POST = defineStaffRoute({
  body: z.object({ localDate: z.string(), localStartTime: z.string(), localEndTime: z.string(), reason: z.string() }),
  handler: async ({ client, ctx, body, params }) => ({
    status: 201,
    data: await rescheduleOccurrence(client, ctx, { bookingId: params.id, ...body }),
  }),
});
