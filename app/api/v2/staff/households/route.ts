export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { publicUser } from '@/lib/core-v2/http/respond';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { pageQuerySchema, searchHouseholds } from '@/lib/core-v2/queries/staff';
import { createHousehold } from '@/lib/core-v2/services';

const newParentBody = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().optional(),
});

export const GET = defineStaffRoute({
  query: pageQuerySchema,
  handler: async ({ client, ctx, query }) => ({ data: await searchHouseholds(client, ctx, query) }),
});

export const POST = defineStaffRoute({
  body: z.object({ parent: newParentBody }),
  handler: async ({ client, ctx, body }) => {
    const { household, parent, membership } = await createHousehold(client, ctx, body);
    return { status: 201, data: { household, parent: publicUser(parent), membership } };
  },
});
