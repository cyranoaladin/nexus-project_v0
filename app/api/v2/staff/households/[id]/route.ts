export const dynamic = 'force-dynamic';

import { NotFoundError } from '@/lib/core-v2/errors';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { getHouseholdDetail } from '@/lib/core-v2/queries/staff';

export const GET = defineStaffRoute({
  handler: async ({ client, ctx, params }) => {
    const household = await getHouseholdDetail(client, ctx, params.id);
    if (!household) throw new NotFoundError('Household not found.', { householdId: params.id });
    return { data: household };
  },
});
