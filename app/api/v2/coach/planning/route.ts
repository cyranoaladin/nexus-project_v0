export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { listOwnCoachBookings, selfRangeSchema } from '@/lib/core-v2/queries/planning';

/** The signed-in coach's own bookings in a range (§AJ/§AK). Scoped by the actor; no id is accepted. */
export const GET = defineStaffRoute({
  query: selfRangeSchema,
  handler: async ({ client, ctx, query }) => ({ data: await listOwnCoachBookings(client, ctx, query) }),
});
