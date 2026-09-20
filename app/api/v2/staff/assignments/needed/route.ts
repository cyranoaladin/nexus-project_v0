export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { indicatorQuerySchema, listUnassignedCourseEnrollments } from '@/lib/core-v2/queries/staff';

export const GET = defineStaffRoute({
  query: indicatorQuerySchema,
  handler: async ({ client, ctx, query }) => ({ data: await listUnassignedCourseEnrollments(client, ctx, query) }),
});
