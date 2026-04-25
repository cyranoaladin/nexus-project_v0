export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { buildStudentDashboardPayload } from '@/lib/dashboard/student-payload';

export async function GET(_req: NextRequest) {
  const sessionOrError = await requireRole(UserRole.ELEVE);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const session = sessionOrError;

  try {
    const t0 = Date.now();
    const payload = await buildStudentDashboardPayload(session.user.id);
    const elapsed = Date.now() - t0;

    if (process.env.NODE_ENV !== 'production' && elapsed > 400) {
      console.warn(`[dashboard] slow payload build: ${elapsed}ms`);
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=10',
        'X-Payload-Build-Ms': String(elapsed),
      },
    });
  } catch (err) {
    console.error('[dashboard] payload build failed', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
