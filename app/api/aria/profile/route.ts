export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  getAriaLearningProfileForActor,
  replaceAriaLearningProfileForActor,
} from '@/lib/aria/application/profile/public';
import { ariaLearningPreferencesV1Schema } from '@/lib/aria/domain/profile/preferences';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';
import { createLogger } from '@/lib/middleware/logger';
import { readBoundedAriaJson } from '@/lib/aria/transport/read-json-body';

const updateProfileSchema = ariaLearningPreferencesV1Schema;

export async function GET(request: NextRequest) {
  const logger = createLogger(request);
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const profile = await getAriaLearningProfileForActor({
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ profile });
  } catch (error: unknown) {
    return toAriaErrorResponse(error, logger);
  }
}

export async function PUT(request: NextRequest) {
  const logger = createLogger(request);
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await readBoundedAriaJson(request);
    const validated = updateProfileSchema.parse(body);
    const updated = await replaceAriaLearningProfileForActor({
      actor: { userId: session.user.id, role: session.user.role },
      preferences: validated,
    });

    return NextResponse.json({ profile: updated });
  } catch (error: unknown) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return toAriaErrorResponse(
        new AriaError('BAD_REQUEST', 400, 'Préférences ARIA invalides.'),
        logger,
      );
    }
    return toAriaErrorResponse(error, logger);
  }
}
