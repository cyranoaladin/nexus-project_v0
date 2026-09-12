export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { registerForAriaWorkshop } from '@/lib/aria/application/workshop/register-for-workshop';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse } from '@/lib/aria/errors';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workshopId: string }> },
) {
  const logger = createLogger(request);
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ELEVE') {
      return unauthorizedAriaResponse(logger);
    }

    const { workshopId } = await context.params;
    const result = await registerForAriaWorkshop({
      actor: { userId: session.user.id, role: session.user.role },
      workshopSessionId: workshopId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
