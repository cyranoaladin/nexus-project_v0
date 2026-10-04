export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { refuseUnauthorizedParentAriaRead, privateParentAriaResponse } from '@/lib/families/parent-aria-read-boundary';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { listAriaCoursesForParentChild } from '@/lib/aria/application/mastery/list-courses-for-parent';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse } from '@/lib/aria/errors';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  const logger = createLogger(request);
  try {
    const session = await auth();

    if (!session?.user.id || session.user.role !== 'PARENT') {
      return privateParentAriaResponse(unauthorizedAriaResponse(logger));
    }

    const { studentId } = await context.params;
    const refusal = await refuseUnauthorizedParentAriaRead(session.user.id, studentId);
    if (refusal) return refusal;

    const courses = await listAriaCoursesForParentChild({
      actor: { userId: session.user.id, role: session.user.role },
      studentId,
    });
    return privateParentAriaResponse(NextResponse.json({ studentId, courses }));
  } catch (error) {
    return privateParentAriaResponse(toAriaErrorResponse(error, logger));
  }
}
