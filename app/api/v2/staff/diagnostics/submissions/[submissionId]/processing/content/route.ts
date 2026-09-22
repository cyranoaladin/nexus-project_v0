export const dynamic = 'force-dynamic';

import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { getLatestDiagnosticSubmissionExtraction } from '@/lib/core-v2/services/diagnostic-processing';
import { NotFoundError } from '@/lib/core-v2/errors';

/**
 * Academic content (the extracted text itself) — reserved to ADMIN, never
 * ASSISTANTE (mission constraint: staff follow-up without academic-content
 * access; enforced by DIAGNOSTIC_SUBMISSION_CONTENT_READ inside the
 * service, same split already in force for the deposited file in C1).
 */
export const GET = defineStaffRoute({
  handler: async ({ client, ctx, params }) => {
    const extraction = await getLatestDiagnosticSubmissionExtraction(client, ctx, params.submissionId);
    if (!extraction) throw new NotFoundError('No extraction recorded for this submission yet.', { submissionId: params.submissionId });
    return { data: extraction };
  },
});
