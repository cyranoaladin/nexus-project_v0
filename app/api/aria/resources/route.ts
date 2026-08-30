export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listAriaResourcesForActor } from '@/lib/aria/application/resources/public';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse } from '@/lib/aria/errors';

export async function GET(request: NextRequest) {
  const logger = createLogger(request);
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseKey = searchParams.get('courseKey');

    if (!courseKey) {
      return NextResponse.json({ error: 'Clé de cours manquante', code: 'BAD_REQUEST' }, { status: 400 });
    }

    const result = await listAriaResourcesForActor({
      actor: { userId: session.user.id, role: session.user.role },
      courseKey,
    });
    return NextResponse.json(result);
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
