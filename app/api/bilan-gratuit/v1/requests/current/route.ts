export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import {
  createAuthenticatedBilanPrincipal,
  createTemporaryBilanPrincipal,
  findAccessibleBilanRequest,
} from '@/lib/bilans/requests/access';
import {
  BILAN_FLOW_COOKIE_NAME,
  hashBilanToken,
} from '@/lib/bilans/requests/tokens';
import { prisma } from '@/lib/prisma';

const DENIED_RESPONSE = { error: 'Dossier indisponible.' } as const;

function denied(): NextResponse {
  return NextResponse.json(DENIED_RESPONSE, {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function publicCurrentRequest(request: unknown) {
  const record = request as Readonly<Record<string, unknown>>;
  return {
    status: record.status,
    accountVerificationState: record.accountVerificationState,
    subject: record.subject,
    gradeLevel: record.gradeLevel,
    schoolYear: record.schoolYear,
    hasChild: typeof record.studentId === 'string',
    hasAssessment: typeof record.canonicalAttemptId === 'string',
    lastActivityAt: record.lastActivityAt,
    submittedAt: record.submittedAt,
    publishedAt: record.publishedAt,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const now = new Date();
  let principal = null;
  const rawFlowToken = request.cookies.get(BILAN_FLOW_COOKIE_NAME)?.value;

  if (rawFlowToken) {
    try {
      const tokenHash = hashBilanToken(rawFlowToken);
      const flowSession = await prisma.bilanFlowSession.findUnique({
        where: { tokenHash },
        select: { requestId: true },
      });
      if (flowSession) {
        principal = createTemporaryBilanPrincipal({
          requestId: flowSession.requestId,
          tokenHash,
          now,
        });
      }
    } catch {
      return denied();
    }
  } else {
    try {
      const session = await auth();
      const requestId = session?.user?.bilanRequestId;
      if (requestId) {
        principal = createAuthenticatedBilanPrincipal({
          requestId,
          sessionUser: session.user,
          now,
        });
      }
    } catch {
      return denied();
    }
  }

  if (!principal) return denied();

  const accessible = await findAccessibleBilanRequest(prisma, principal);
  if (!accessible || !accessible.capabilities.readCurrentRequest) return denied();

  return NextResponse.json(
    { request: publicCurrentRequest(accessible.request) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
