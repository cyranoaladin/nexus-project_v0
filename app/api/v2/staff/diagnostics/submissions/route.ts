export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { diagnosticQueueQuerySchema, listDiagnosticSubmissionsQueue } from '@/lib/core-v2/queries/diagnostics-queue';

/**
 * ADMIN/ASSISTANTE diagnostics queue — logistics-only list so staff can find
 * a submission needing action without knowing its id in advance. Never
 * returns academic content (extractedText/aiProposal/humanReview): see
 * `lib/core-v2/queries/diagnostics-queue.ts`'s explicit select allow-list.
 */
export const GET = defineStaffRoute({
  query: diagnosticQueueQuerySchema,
  handler: async ({ client, ctx, query }) => ({
    data: await listDiagnosticSubmissionsQueue(client, ctx, query),
  }),
});
