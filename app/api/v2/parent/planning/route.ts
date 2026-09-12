export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { listOwnHouseholdBookings, selfRangeSchema } from '@/lib/core-v2/queries/planning';

/** The bookings of the signed-in parent's own household in a range (§AH/§AK). Scoped by the actor; no id is accepted. */
export const GET = defineStaffRoute({
  query: selfRangeSchema,
  handler: async ({ client, ctx, query }) => ({ data: await listOwnHouseholdBookings(client, ctx, query) }),
});
