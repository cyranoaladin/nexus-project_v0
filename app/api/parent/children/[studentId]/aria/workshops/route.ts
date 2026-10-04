export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { refuseUnauthorizedParentAriaRead, privateParentAriaResponse } from '@/lib/families/parent-aria-read-boundary';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { listAriaWorkshopsForParent } from '@/lib/aria/application/workshop/list-workshops-for-parent';
import { createLogger } from '@/lib/middleware/logger';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';

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
    const { searchParams } = new URL(request.url);
    const courseKey = searchParams.get('courseKey');
    if (!courseKey) {
      throw new AriaError('BAD_REQUEST', 400, 'Clé de cours manquante.', { reasonCode: 'ARIA_PARENT_WORKSHOPS_COURSE_KEY_MISSING' });
    }

    const workshops = await listAriaWorkshopsForParent({
      actor: { userId: session.user.id, role: session.user.role },
      studentId,
      courseKey,
    });
    return privateParentAriaResponse(NextResponse.json({ studentId, courseKey, workshops }));
  } catch (error) {
    return privateParentAriaResponse(toAriaErrorResponse(error, logger));
  }
}
