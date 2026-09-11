export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { listAriaCourseMasteryForParent } from '@/lib/aria/application/mastery/list-course-mastery-for-parent';
import { createLogger } from '@/lib/middleware/logger';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';

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
    const { searchParams } = new URL(request.url);
    const courseKey = searchParams.get('courseKey');

    if (!courseKey) {
      throw new AriaError('BAD_REQUEST', 400, 'Clé de cours manquante.', { reasonCode: 'ARIA_PARENT_MASTERY_COURSE_KEY_MISSING' });
    }

    const skills = await listAriaCourseMasteryForParent({
      actor: { userId: session.user.id, role: session.user.role },
      studentId,
      courseKey,
    });
    return NextResponse.json({ studentId, courseKey, skills });
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
