export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listAriaCurriculumForActor } from '@/lib/aria/application/curriculum/public';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse } from '@/lib/aria/errors';

export async function GET(request: NextRequest) {
  const logger = createLogger(request);
  try {
    let session: import('next-auth').Session | null = null;
    try {
      session = await auth();
    } catch {
      // Standalone mode auth fallback
    }

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const result = await listAriaCurriculumForActor({
      actor: { userId: session.user.id, role: session.user.role },
    });
    return NextResponse.json(result);
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
