export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { setPrimaryContact } from '@/lib/core-v2/services';

export const PUT = defineStaffRoute({
  body: z.object({ parentUserId: z.string() }),
  handler: async ({ client, ctx, body, params }) => ({
    data: await setPrimaryContact(client, ctx, { householdId: params.id, parentUserId: body.parentUserId }),
  }),
});
