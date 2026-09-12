export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { auditQuerySchema, listAuditEvents } from '@/lib/core-v2/queries/staff';

export const GET = defineStaffRoute({
  query: auditQuerySchema,
  handler: async ({ client, ctx, query }) => ({ data: await listAuditEvents(client, ctx, query) }),
});
