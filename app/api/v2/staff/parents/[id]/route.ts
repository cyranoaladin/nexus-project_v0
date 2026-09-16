export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { correctParentContact } from '@/lib/core-v2/services';

export const PATCH = defineStaffRoute({
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().nullable().optional(),
  }),
  handler: async ({ client, ctx, body, params }) => ({
    data: publicUser(await correctParentContact(client, ctx, { parentUserId: params.id, changes: body })),
  }),
});
