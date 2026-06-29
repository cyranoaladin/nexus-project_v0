export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { getNextStep } from '@/lib/next-step-engine';
import { serializeError } from '@/lib/utils/serialize-error';
import { NextResponse } from 'next/server';

/**
 * GET /api/me/next-step
 *
 * Returns the recommended next action for the authenticated user.
 * Role-agnostic endpoint — the engine determines the step based on user role.
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      );
    }

    const step = await getNextStep(session.user.id);

    return NextResponse.json({
      success: true,
      step,
    });
  } catch (error) {
    console.error('[API] Next Step error:', serializeError(error));
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
