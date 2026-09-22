export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { generateBilanDraft, getCurrentBilanDraftForReview } from '@/lib/core-v2/services/diagnostic-bilan';
import { NotFoundError } from '@/lib/core-v2/errors';

/** ADMIN review read: the current (latest-revision) bilan draft — DIAGNOSTIC_BILAN_REVIEW only. */
export const GET = defineStaffRoute({
  handler: async ({ client, ctx, params }) => {
    const draft = await getCurrentBilanDraftForReview(client, ctx, params.processingId);
    if (!draft) throw new NotFoundError('No bilan draft has been generated for this processing yet.', { processingId: params.processingId });
    return { data: draft };
  },
});

/**
 * Generates a new bilan-draft revision: deterministic correction always
 * runs, the AI proposal runs only if the pilot's preflight/budget gates
 * clear — its absence stays visible in the response, never hidden.
 */
export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params }) => {
    const draft = await generateBilanDraft(client, ctx, params.processingId);
    return { status: 201, data: draft };
  },
});
