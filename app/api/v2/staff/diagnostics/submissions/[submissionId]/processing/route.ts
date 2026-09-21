export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import {
  getDiagnosticSubmissionProcessingStatus,
  processDiagnosticSubmission,
  toExtractionLogisticsView,
} from '@/lib/core-v2/services/diagnostic-processing';
import { NotFoundError } from '@/lib/core-v2/errors';

/**
 * C2, first increment — logistics view only (status/revision count, never
 * the extracted text: see the sibling `content` route for that, reserved
 * to ADMIN). getDiagnosticSubmissionProcessingStatus's own return type has
 * no extractedText field at all, so there is nothing to strip here.
 */
export const GET = defineStaffRoute({
  handler: async ({ client, ctx, params }) => {
    const processing = await getDiagnosticSubmissionProcessingStatus(client, ctx, params.submissionId);
    if (!processing) throw new NotFoundError('No processing record for this submission yet.', { submissionId: params.submissionId });
    return { data: processing };
  },
});

/**
 * Triggers (or retries, after a failure) bounded text extraction for this
 * submission. This route requires only DIAGNOSTIC_SUBMISSION_TRACK
 * (ASSISTANTE has it) — the extraction's own `extractedText` must never
 * ride along in this response even though the underlying service result
 * carries it for direct/internal callers; see toExtractionLogisticsView.
 */
export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params }) => {
    const result = await processDiagnosticSubmission(client, ctx, params.submissionId);
    return { status: 202, data: { processing: result.processing, extraction: toExtractionLogisticsView(result.extraction) } };
  },
});
