export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { capabilitiesForActor } from '@/lib/core-v2/rbac';

/** The signed-in staff actor as Core v2 sees it, with the capabilities the UI may offer. */
export const GET = defineStaffRoute({
  handler: async ({ ctx }) => ({
    data: { actor: ctx.actor, capabilities: capabilitiesForActor(ctx.actor) },
  }),
});
