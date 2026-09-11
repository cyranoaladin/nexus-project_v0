export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { listAriaCourseMasteryForActor } from '@/lib/aria/application/mastery/list-course-mastery';
import { createLogger } from '@/lib/middleware/logger';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';

export async function GET(request: NextRequest) {
  const logger = createLogger(request);
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ELEVE') {
      return unauthorizedAriaResponse(logger);
    }

    const { searchParams } = new URL(request.url);
    const courseKey = searchParams.get('courseKey');

    if (!courseKey) {
      throw new AriaError('BAD_REQUEST', 400, 'Clé de cours manquante.', { reasonCode: 'ARIA_COURSE_MASTERY_COURSE_KEY_MISSING' });
    }

    const skills = await listAriaCourseMasteryForActor({
      actor: { userId: session.user.id, role: session.user.role },
      courseKey,
    });
    return NextResponse.json({ courseKey, skills });
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
