export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { setCurrentAcademicYear } from '@/lib/core-v2/services';

export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params }) => ({ data: await setCurrentAcademicYear(client, ctx, params.id) }),
});
