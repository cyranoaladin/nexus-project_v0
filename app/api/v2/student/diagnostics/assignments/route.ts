export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { getOwnDiagnosticAssignments } from '@/lib/core-v2/services/diagnostics';

/** Self-service: the signed-in candidate's own diagnostic attributions. No id is ever accepted on this path. */
export const GET = defineStaffRoute({
  handler: async ({ client, ctx }) => ({ data: await getOwnDiagnosticAssignments(client, ctx) }),
});
