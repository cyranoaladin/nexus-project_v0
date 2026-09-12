export const dynamic = 'force-dynamic';

import { NotFoundError } from '@/lib/core-v2/errors';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { getOwnCoach } from '@/lib/core-v2/queries/coach';

/** The signed-in coach's own capabilities and assignments (§AJ). Scoped by the actor; no id is accepted. */
export const GET = defineStaffRoute({
  handler: async ({ client, ctx }) => {
    const coach = await getOwnCoach(client, ctx);
    if (!coach) throw new NotFoundError('No coach profile is attached to this account.');
    return { data: coach };
  },
});
