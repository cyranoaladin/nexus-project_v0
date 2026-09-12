export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { setCoachCapability } from '@/lib/core-v2/services';

export const PUT = defineStaffRoute({
  body: z.object({ courseKey: z.string(), granted: z.boolean() }),
  handler: async ({ client, ctx, body, params }) => ({
    data: { capability: await setCoachCapability(client, ctx, { coachId: params.id, ...body }) },
  }),
});
