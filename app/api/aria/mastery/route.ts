export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { getAriaSkillMasteryForActor } from '@/lib/aria/application/mastery/get-mastery';
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
    const skillId = searchParams.get('skillId');

    if (!courseKey) {
      throw new AriaError('BAD_REQUEST', 400, 'Clé de cours manquante.', { reasonCode: 'ARIA_MASTERY_COURSE_KEY_MISSING' });
    }
    if (!skillId) {
      throw new AriaError('BAD_REQUEST', 400, 'Identifiant de compétence manquant.', { reasonCode: 'ARIA_MASTERY_SKILL_ID_MISSING' });
    }

    const mastery = await getAriaSkillMasteryForActor({
      actor: { userId: session.user.id, role: session.user.role },
      courseKey,
      skillId,
    });
    return NextResponse.json(mastery);
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
