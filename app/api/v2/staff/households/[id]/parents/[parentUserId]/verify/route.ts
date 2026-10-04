import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { verifyHouseholdParent } from '@/lib/core-v2/services';

export const POST = defineStaffRoute({
  body: z.object({ expectedRevision: z.number().int().nonnegative(), evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  handler: async ({ client, ctx, body, params }) => ({
    data: await verifyHouseholdParent(client, ctx, { householdId: params.id, parentUserId: params.parentUserId, ...body }),
  }),
});
