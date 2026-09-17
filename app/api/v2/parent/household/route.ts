export const dynamic = 'force-dynamic';

import { NotFoundError } from '@/lib/core-v2/errors';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { getOwnHousehold } from '@/lib/core-v2/queries/parent';

/**
 * The signed-in parent's own household. Same pipeline as the staff routes
 * (session → Core v2 actor → envelope); the query scopes by the actor's
 * identity, so no id is accepted and none can be forged.
 */
export const GET = defineStaffRoute({
  handler: async ({ client, ctx }) => {
    const household = await getOwnHousehold(client, ctx);
    if (!household) throw new NotFoundError('No household is attached to this account.');
    return { data: household };
  },
});
