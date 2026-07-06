export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse } from '@/lib/guards';
import { enforcePolicy } from '@/lib/rbac';
import { getRateLimitProductionGate, guardRateLimitAsync } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const sessionOrResponse = await enforcePolicy('admin.dashboard');
  if (isErrorResponse(sessionOrResponse)) {
    return sessionOrResponse;
  }

  const blocked = await guardRateLimitAsync(request, {
    preset: 'auth',
    keySuffix: 'internal-rate-limit-probe',
  });
  if (blocked) return blocked;

  const gate = getRateLimitProductionGate();

  return NextResponse.json({
    ok: true,
    probe: 'rate-limit',
    runtime: {
      mode: gate.mode,
      distributed: gate.ok,
      goLiveLarge: gate.decision,
    },
  });
}
