import { NextRequest } from 'next/server';
import { isErrorResponse, requireAuth } from '@/lib/guards';
import { readOwnCoreMembership } from '@/lib/core-v2/queries/self-membership';
import { correlationIdFrom } from '@/lib/core-v2/http/staff-route';
import { fail, ok, privateResponse } from '@/lib/core-v2/http/respond';

export const dynamic = 'force-dynamic';
/** No client identity, email or scope is accepted; no business data is read. */
export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  const session = await requireAuth();
  if (isErrorResponse(session)) return privateResponse(fail(correlationId, 401, 'UNAUTHENTICATED', 'Sign in required.'));
  if (session.user.authority !== 'V1') return privateResponse(fail(correlationId, 401, 'UNAUTHENTICATED', 'Sign in required.'));
  try {
    const membership = await readOwnCoreMembership(session.user.id);
    return privateResponse(ok(membership, correlationId));
  } catch {
    return privateResponse(fail(correlationId, 503, 'CORE_V2_UNAVAILABLE', 'Core access is temporarily unavailable.'));
  }
}
