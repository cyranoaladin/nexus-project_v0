import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { revokeHouseholdParent } from '@/lib/core-v2/services';

export const POST = defineStaffRoute({
  body: z.object({ expectedRevision: z.number().int().nonnegative() }).strict(),
  handler: async ({ client, ctx, body, params }) => ({
    data: await revokeHouseholdParent(client, ctx, { householdId: params.id, parentUserId: params.parentUserId, ...body }),
  }),
});
