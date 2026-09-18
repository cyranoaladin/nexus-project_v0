export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { listBookings, planningRangeSchema } from '@/lib/core-v2/queries/planning';

/** Bookings in a time range (≤ 120 days), optionally narrowed to a coach, a student or a status. */
export const GET = defineStaffRoute({
  query: planningRangeSchema,
  handler: async ({ client, ctx, query }) => ({ data: await listBookings(client, ctx, query) }),
});
