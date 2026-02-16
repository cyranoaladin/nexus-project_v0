export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getNextStep } from '@/lib/next-step-engine';
import { NextResponse } from 'next/server';

/**
 * GET /api/me/next-step
 *
 * Returns the recommended next action for the authenticated user.
 * Role-agnostic endpoint — the engine determines the step based on user role.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

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
    console.error('[API] Next Step error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
