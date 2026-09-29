export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { defineStaffRoute } from '@/lib/core-v2/http/staff-route';
import { InvalidStateError } from '@/lib/core-v2/errors';
import { readRunningReleaseSha } from '@/lib/core-v2/diagnostics/release-identity';
import {
  authorizeDiagnosticProcessingRetry,
  PDFJS_RETRY_AUTHORIZATION_REASON,
} from '@/lib/core-v2/services/diagnostic-processing-recovery';

const bodySchema = z.object({
  submissionId: z.string().trim().min(1).max(64),
  submissionVersion: z.number().int().positive(),
  submissionSha256: z.string().regex(/^[a-f0-9]{64}$/),
  subjectVersion: z.string().trim().min(1).max(100),
  lastExtractionId: z.string().trim().min(1).max(64),
  lastExtractionRevision: z.number().int().positive(),
  attemptCount: z.literal(5),
  reason: z.literal(PDFJS_RETRY_AUTHORIZATION_REASON),
  operationId: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
}).strict();

/**
 * Incident-scoped control-plane action. Authorization is not a new processing
 * cycle: it adds exactly one bounded claim to an existing exhausted row.
 */
export const POST = defineStaffRoute({
  body: bodySchema,
  handler: async ({ client, ctx, body, params }) => {
    const releaseSha = await readRunningReleaseSha();
    if (!releaseSha) throw new InvalidStateError('The immutable running release identity is unavailable.');
    const authorized = await authorizeDiagnosticProcessingRetry(client, ctx, {
      ...body,
      processingId: params.processingId,
    }, releaseSha);
    return {
      status: 201,
      data: {
        processingId: authorized.id,
        operationId: authorized.retryAuthorizationOperationId,
        attemptCountSnapshot: authorized.retryAttemptCountSnapshot,
        authorizationConsumed: authorized.retryAuthorizationConsumedAt !== null,
      },
    };
  },
});
