export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { listAriaPeriodicBilansForParent } from '@/lib/aria/bilans/periodic/list-for-parent';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse } from '@/lib/aria/errors';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  const logger = createLogger(request);
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'PARENT') {
      return unauthorizedAriaResponse(logger);
    }

    const { studentId } = await context.params;
    const bilans = await listAriaPeriodicBilansForParent({
      actor: { userId: session.user.id, role: session.user.role },
      studentId,
    });
    return NextResponse.json({ studentId, bilans });
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
