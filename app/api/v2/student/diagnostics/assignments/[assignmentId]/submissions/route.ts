export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
// The global `File` exists under `next dev` but is not injected into the
// standalone production route-handler sandbox — reproduced against a real
// standalone build (`ReferenceError: File is not defined`), fixed by
// importing it explicitly rather than relying on the ambient global.
import { File } from 'node:buffer';
import { checkBodySize, checkCsrf } from '@/lib/csrf';
import { requireAuth, isErrorResponse } from '@/lib/guards';
import { requireCoreV2Client } from '@/lib/core-v2/client';
import { resolveActor } from '@/lib/core-v2/http/actor';
import { correlationIdFrom, type RouteContext } from '@/lib/core-v2/http/staff-route';
import { ok, failFromError } from '@/lib/core-v2/http/respond';
import { ValidationError } from '@/lib/core-v2/errors';
import { createServiceContext } from '@/lib/core-v2/services/context';
import { getOwnDiagnosticAssignmentForSubjectAccess } from '@/lib/core-v2/services/diagnostics';
import { depositOwnDiagnosticSubmission } from '@/lib/core-v2/diagnostics/submission-pipeline';

const ACCEPTED_MIME_TYPES = new Set(['application/pdf']);
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MiB — a scanned answer booklet, not a video.
const PDF_MAGIC = Buffer.from('%PDF-');

/**
 * Self-service deposit (§4/§7): declared type, effective size, and
 * effective content are all validated here; the reception → write-verify →
 * antivirus → fingerprint → DB-row pipeline itself lives in
 * lib/core-v2/diagnostics/submission-pipeline.ts, so it can be exercised
 * (and its failure/quarantine paths tested) independently of HTTP parsing.
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const correlationId = correlationIdFrom(request);
  try {
    const tooLarge = checkBodySize(request, MAX_SIZE_BYTES);
    if (tooLarge) return tooLarge;
    const csrf = checkCsrf(request);
    if (csrf) return csrf;

    const session = await requireAuth();
    if (isErrorResponse(session)) return NextResponse.json({ ok: false }, { status: 401 });

    const client = await requireCoreV2Client();
    const actor = await resolveActor(client, session.user.id);
    const ctx = createServiceContext(actor, { correlationId });

    const { assignmentId } = await context.params;

    // Ownership + not-revoked is checked BEFORE any input validation of the
    // uploaded file: a cross-candidate attempt must get the same 404
    // regardless of what file it sends, never a different status code
    // depending on whether the file happens to look like a real PDF
    // (which would let a caller distinguish "wrong assignment" from
    // "wrong assignment AND wrong format" — a needless signal to leak).
    await getOwnDiagnosticAssignmentForSubjectAccess(client, ctx, assignmentId);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ValidationError('A "file" field is required.');
    }
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      throw new ValidationError('Only PDF deposits are accepted.', { declaredMimeType: file.type });
    }
    if (file.size <= 0 || file.size > MAX_SIZE_BYTES) {
      throw new ValidationError('File size is out of the accepted range.', { sizeBytes: file.size, maxSizeBytes: MAX_SIZE_BYTES });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      throw new ValidationError('File content does not match its declared type (not a real PDF).');
    }

    const { submission, idempotentReplay } = await depositOwnDiagnosticSubmission(client, ctx, {
      assignmentId,
      originalFilename: file.name || 'reponses.pdf',
      mimeType: 'application/pdf',
      bytes,
    });

    return ok(
      { submissionId: submission.id, version: submission.version, sha256: submission.sha256, idempotentReplay },
      correlationId,
      idempotentReplay ? 200 : 201,
    );
  } catch (error) {
    return failFromError(error, correlationId);
  }
}
