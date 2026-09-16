export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { endCoachAssignment } from '@/lib/core-v2/services';

export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params }) => ({ data: await endCoachAssignment(client, ctx, params.id) }),
});
