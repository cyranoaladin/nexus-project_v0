export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { approveEnrollment } from '@/lib/core-v2/services';

export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params }) => ({ data: await approveEnrollment(client, ctx, params.id) }),
});
