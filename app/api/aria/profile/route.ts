export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { lockAriaV1Subject, ariaProfileRepository } from '@/lib/aria/application/v1-composition';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import {
  makeGetAriaLearningProfile,
  makeReplaceAriaLearningProfile,
} from '@/lib/aria/application/profile/public';
import { ariaLearningPreferencesV1Schema } from '@/lib/aria/domain/profile/preferences';
import { AriaError, toAriaErrorResponse } from '@/lib/aria/errors';
import { createLogger } from '@/lib/middleware/logger';
import { readBoundedAriaJson } from '@/lib/aria/transport/read-json-body';
import { readBoundPrivateV1Session } from '@/lib/auth/private-v1-session';
import { withV1SessionAuthority } from '@/lib/auth/v1-session-authority';
import { AriaAuthorityRevokedError } from '@/lib/aria/kernel/errors';

const updateProfileSchema = ariaLearningPreferencesV1Schema;

export async function GET(request: NextRequest) {
  const logger = createLogger(request);
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ELEVE') {
      return unauthorizedAriaResponse(logger);
    }

    const claims = await readBoundPrivateV1Session(request, session);
    if (!claims) throw new AriaAuthorityRevokedError();
    return await withV1SessionAuthority(claims, async tx => {
    await lockAriaV1Subject(tx, claims.userId, false);
    const profile = await makeGetAriaLearningProfile(ariaProfileRepository(tx))({
      actor: claims,
    });
    return NextResponse.json({ profile }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
    });
  } catch (error: unknown) {
    return toAriaErrorResponse(error, logger);
  }
}

export async function PUT(request: NextRequest) {
  const logger = createLogger(request);
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ELEVE') {
      return unauthorizedAriaResponse(logger);
    }

    const claims = await readBoundPrivateV1Session(request, session);
    if (!claims) throw new AriaAuthorityRevokedError();
    const body = await readBoundedAriaJson(request);
    const validated = updateProfileSchema.parse(body);
    return await withV1SessionAuthority(claims, async tx => {
    await lockAriaV1Subject(tx, claims.userId, false);
    const updated = await makeReplaceAriaLearningProfile(ariaProfileRepository(tx))({
      actor: claims,
      preferences: validated,
    });

    return NextResponse.json({ profile: updated }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
    });
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
