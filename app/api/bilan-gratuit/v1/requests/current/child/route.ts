export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import {
  attachChildToVerifiedRequest,
} from '@/lib/bilans/requests/attach-child';
import { bilanVerifiedParentChildCommandSchema } from '@/lib/bilans/requests/schemas';
import {
  BILAN_FLOW_COOKIE_NAME,
  hashBilanToken,
} from '@/lib/bilans/requests/tokens';
import { checkBodySize, checkCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';

const INVALID_RESPONSE = { error: 'Requête invalide.' } as const;
const DENIED_RESPONSE = { error: 'Accès refusé.' } as const;
const INTERNAL_RESPONSE = { error: 'Service temporairement indisponible.' } as const;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;

function denied(): NextResponse {
  return NextResponse.json(DENIED_RESPONSE, { status: 403 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrfResponse = checkCsrf(request);
  if (csrfResponse) return csrfResponse;

  const bodySizeResponse = checkBodySize(request);
  if (bodySizeResponse) return bodySizeResponse;

  let session;
  try {
    session = await auth();
  } catch {
    return denied();
  }
  const sessionUser = session?.user;
  if (
    !sessionUser
    || sessionUser.role !== 'PARENT'
    || typeof sessionUser.id !== 'string'
    || !IDENTIFIER.test(sessionUser.id)
  ) {
    return denied();
  }

  const rateLimitResponse = await guardRateLimitAsync(request, {
    preset: 'api',
    keySuffix: 'bilan-gratuit-v1-child',
    userId: sessionUser.id,
  });
  if (rateLimitResponse) return rateLimitResponse;

  let requestId: string | null = null;
  let existingSessionFlowTokenHash: string | undefined;
  const rawFlowToken = request.cookies.get(BILAN_FLOW_COOKIE_NAME)?.value;
  if (rawFlowToken) {
    try {
      const flowTokenHash = hashBilanToken(rawFlowToken);
      const flowSession = await prisma.bilanFlowSession.findFirst({
        where: {
          tokenHash: flowTokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { requestId: true },
      });
      if (!flowSession) return denied();
      requestId = flowSession.requestId;
      existingSessionFlowTokenHash = flowTokenHash;
    } catch {
      return denied();
    }
  } else if (
    typeof sessionUser.bilanRequestId === 'string'
    && IDENTIFIER.test(sessionUser.bilanRequestId)
  ) {
    requestId = sessionUser.bilanRequestId;
  } else {
    return denied();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(INVALID_RESPONSE, { status: 400 });
  }
  const command = bilanVerifiedParentChildCommandSchema.safeParse(body);
  if (!command.success) {
    return NextResponse.json(INVALID_RESPONSE, { status: 400 });
  }

  try {
    await attachChildToVerifiedRequest({
      prisma,
      requestId,
      parentUserId: sessionUser.id,
      command: command.data,
      existingSessionFlowTokenHash,
    });
    return NextResponse.json({
      success: true,
      next: 'ASSESSMENT',
    });
  } catch (error) {
    if (
      typeof error === 'object'
        && error !== null
        && 'code' in error
        && typeof error.code === 'string'
        && error.code.startsWith('BILAN_')
    ) {
      return denied();
    }
    return NextResponse.json(INTERNAL_RESPONSE, { status: 500 });
  }
}
