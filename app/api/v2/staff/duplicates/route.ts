export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { duplicateQuerySchema, findPossibleDuplicates } from '@/lib/core-v2/queries/staff';

/** §AE — shown to staff BEFORE creating a person: hard email conflict + possible phone/name matches. */
export const GET = defineStaffRoute({
  query: duplicateQuerySchema,
  handler: async ({ client, ctx, query }) => ({ data: await findPossibleDuplicates(client, ctx, query) }),
});
