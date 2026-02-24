export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/bilan-gratuit/status
 * Returns whether the current parent has completed or dismissed the bilan gratuit banner.
 */
export async function GET() {
  try {
    let session: any = null;
    try {
      session = await auth();
    } catch {
      // auth() can throw UntrustedHost in standalone mode
    }

    if (!session?.user?.id) {
      return NextResponse.json({ completed: false, dismissed: false });
    }

    const profile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        bilanGratuitCompletedAt: true,
        bilanGratuitDismissedAt: true,
      },
    });

    return NextResponse.json({
      completed: !!profile?.bilanGratuitCompletedAt,
      dismissed: !!profile?.bilanGratuitDismissedAt,
    });
  } catch {
    return NextResponse.json({ completed: false, dismissed: false });
  }
}
