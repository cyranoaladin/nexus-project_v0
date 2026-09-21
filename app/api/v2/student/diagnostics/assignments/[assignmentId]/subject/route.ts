export const dynamic = 'force-dynamic';

import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isErrorResponse } from '@/lib/guards';
import { requireCoreV2Client } from '@/lib/core-v2/client';
import { resolveActor } from '@/lib/core-v2/http/actor';
import { correlationIdFrom, type RouteContext } from '@/lib/core-v2/http/staff-route';
import { CORRELATION_HEADER, failFromError } from '@/lib/core-v2/http/respond';
import { InvalidStateError } from '@/lib/core-v2/errors';
import { logger } from '@/lib/logger';
import { createServiceContext } from '@/lib/core-v2/services/context';
import { getOwnDiagnosticAssignmentForSubjectAccess } from '@/lib/core-v2/services/diagnostics';
import { diagnosticInstrumentSubjectRelativePath, readDiagnosticStorageFile } from '@/lib/core-v2/diagnostics/storage';

/**
 * Streams the sealed subject PDF for ONE of the candidate's own attributions.
 * Access is sealed by attribution + identity (getOwnDiagnosticAssignmentForSubjectAccess
 * scopes strictly to the caller's own Student row) — never a guessable
 * public path, never a directory listing. No corrected/coach content is
 * ever reachable from this route.
 *
 * Integrity (mission §5): the served bytes are checked against
 * `subjectSha256Snapshot`, frozen on the assignment at attribution time —
 * never against the catalog's CURRENT value, which could have moved. A
 * mismatch (missing, altered, or otherwise inconsistent file) is refused
 * outright; the reference is never recomputed to make the discrepancy
 * disappear, and the private storage path is never included in the
 * response, only in the server-side log for operator diagnosis.
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const correlationId = correlationIdFrom(request);
  try {
    const session = await requireAuth();
    if (isErrorResponse(session)) return NextResponse.json({ ok: false }, { status: 401 });

    const client = await requireCoreV2Client();
    const actor = await resolveActor(client, session.user.id);
    const ctx = createServiceContext(actor, { correlationId });

    const { assignmentId } = await context.params;
    const assignment = await getOwnDiagnosticAssignmentForSubjectAccess(client, ctx, assignmentId);

    const relativePath = diagnosticInstrumentSubjectRelativePath(assignment.instrumentRefId);
    const document = await readDiagnosticStorageFile(relativePath);
    let bytes: Buffer;
    try {
      bytes = await document.handle.readFile();
    } finally {
      await document.handle.close();
    }

    const actualSha256 = createHash('sha256').update(bytes).digest('hex');
    if (actualSha256 !== assignment.subjectSha256Snapshot) {
      logger.error(
        {
          correlationId,
          assignmentId: assignment.id,
          instrumentRefId: assignment.instrumentRefId,
          expectedSha256Prefix: assignment.subjectSha256Snapshot.slice(0, 12),
          actualSha256Prefix: actualSha256.slice(0, 12),
        },
        '[diagnostics] subject integrity mismatch — refusing to serve',
      );
      throw new InvalidStateError(
        'The subject on disk no longer matches the version attributed to this candidate; it was not served.',
        { assignmentId: assignment.id },
      );
    }

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="sujet-${assignment.instrumentKeySnapshot}.pdf"`,
        'cache-control': 'private, no-store',
        [CORRELATION_HEADER]: correlationId,
      },
    });
  } catch (error) {
    return failFromError(error, correlationId);
  }
}
