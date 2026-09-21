export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isErrorResponse } from '@/lib/guards';
import { requireCoreV2Client } from '@/lib/core-v2/client';
import { resolveActor } from '@/lib/core-v2/http/actor';
import { correlationIdFrom, type RouteContext } from '@/lib/core-v2/http/staff-route';
import { CORRELATION_HEADER, failFromError } from '@/lib/core-v2/http/respond';
import { createServiceContext } from '@/lib/core-v2/services/context';
import { getOwnDiagnosticAssignmentForSubjectAccess } from '@/lib/core-v2/services/diagnostics';
import { diagnosticInstrumentSubjectRelativePath, readDiagnosticStorageFile } from '@/lib/core-v2/diagnostics/storage';

/**
 * Streams the sealed subject PDF for ONE of the candidate's own attributions.
 * Access is sealed by attribution + identity (getOwnDiagnosticAssignmentForSubjectAccess
 * scopes strictly to the caller's own Student row) — never a guessable
 * public path, never a directory listing. No corrected/coach content is
 * ever reachable from this route.
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
    try {
      const bytes = await document.handle.readFile();
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `inline; filename="sujet-${assignment.instrumentKeySnapshot}.pdf"`,
          'cache-control': 'private, no-store',
          [CORRELATION_HEADER]: correlationId,
        },
      });
    } finally {
      await document.handle.close();
    }
  } catch (error) {
    return failFromError(error, correlationId);
  }
}
