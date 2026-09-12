export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { listOwnStudentBookings, selfRangeSchema } from '@/lib/core-v2/queries/planning';

/** The signed-in student's own bookings in a range (§AI/§AK). Scoped by the actor; no id is accepted. */
export const GET = defineStaffRoute({
  query: selfRangeSchema,
  handler: async ({ client, ctx, query }) => ({ data: await listOwnStudentBookings(client, ctx, query) }),
});
