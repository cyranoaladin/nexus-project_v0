export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import {
  enqueueDiagnosticSubmissionProcessing,
  getDiagnosticSubmissionProcessingStatus,
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
 * Registers (or finds) the job and hands back control — it does NOT run
 * the extraction inline (mission §5: a 202 here must not secretly mean
 * "already finished"). The actual work happens in the scheduled drain
 * (lib/core-v2/diagnostics/processing-scheduler.ts); this route requires
 * only DIAGNOSTIC_SUBMISSION_TRACK (ASSISTANTE has it) — since no
 * extraction result exists yet at this point, there is nothing academic
 * to leak through this response either way.
 */
export const POST = defineStaffRoute({
  handler: async ({ client, ctx, params }) => {
    const processing = await enqueueDiagnosticSubmissionProcessing(client, ctx, params.submissionId);
    return { status: 202, data: processing };
  },
});
