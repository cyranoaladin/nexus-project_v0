export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { listPendingEnrollments, pageQuerySchema } from '@/lib/core-v2/queries/staff';

export const GET = defineStaffRoute({
  query: pageQuerySchema,
  handler: async ({ client, ctx, query }) => ({ data: await listPendingEnrollments(client, ctx, query) }),
});
