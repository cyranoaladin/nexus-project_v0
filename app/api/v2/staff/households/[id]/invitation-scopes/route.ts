import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { getInvitationScopeGrants, setInvitationScopeGrant } from '@/lib/core-v2/accounts/invitation-scope';

export const GET = defineStaffRoute({
  handler: async ({ client, ctx, params }) => ({ data: await getInvitationScopeGrants(client, ctx, params.id) }),
});
export const PUT = defineStaffRoute({
  body: z.object({ staffUserId: z.string().min(1).max(128), academicYearId: z.string().min(1).max(128),
    expectedRevision: z.number().int().nonnegative(), active: z.boolean() }).strict(),
  handler: async ({ client, ctx, body, params }) => {
    const grant = await setInvitationScopeGrant(client, ctx, { ...body, householdId: params.id });
    return { data: { staffUserId: grant.staffUserId, academicYearId: grant.academicYearId,
      revision: grant.revision, revokedAt: grant.revokedAt } };
  },
});
export const dynamic = 'force-dynamic';
