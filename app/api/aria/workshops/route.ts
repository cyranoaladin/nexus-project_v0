export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { listAriaWorkshopsForActor } from '@/lib/aria/application/workshop/list-workshops-for-student';
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
      throw new AriaError('BAD_REQUEST', 400, 'Clé de cours manquante.', { reasonCode: 'ARIA_WORKSHOPS_COURSE_KEY_MISSING' });
    }

    const workshops = await listAriaWorkshopsForActor({
      actor: { userId: session.user.id, role: session.user.role },
      courseKey,
    });
    return NextResponse.json({ courseKey, workshops });
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
