export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { promoteCoreAdministrator } from '@/lib/core-v2/services/admin-promotion';
import { assertCapability } from '@/lib/core-v2/rbac';

export const POST = defineStaffRoute({
  body: z.object({ commandId: z.string().uuid(), reason: z.enum(['STAFF_AUTHORIZATION', 'SUCCESSION', 'ACCESS_RECONCILIATION']) }).strict(),
  handler: async ({ client, ctx, session, request, params, body }) => {
    assertCapability(ctx.actor, 'ADMIN_PROMOTE');
    return { data: await promoteCoreAdministrator(client, ctx, session, request, { ...body, targetId: params.id }) };
  },
});
