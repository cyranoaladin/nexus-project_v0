export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { listCoaches, pageQuerySchema } from '@/lib/core-v2/queries/staff';

export const GET = defineStaffRoute({
  query: pageQuerySchema,
  handler: async ({ client, ctx, query }) => ({ data: await listCoaches(client, ctx, query) }),
});
