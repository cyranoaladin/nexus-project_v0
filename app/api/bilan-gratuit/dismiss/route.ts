export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/bilan-gratuit/dismiss
 * Marks the bilan gratuit banner as dismissed for the current parent.
 */
export async function POST() {
  try {
    let session: any = null;
    try {
      session = await auth();
    } catch {
      // auth() can throw UntrustedHost in standalone mode
    }

    if (!session?.user?.id || session.user.role !== 'PARENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.parentProfile.update({
      where: { userId: session.user.id },
      data: { bilanGratuitDismissedAt: new Date() },
    });

    return NextResponse.json({ dismissed: true });
  } catch (error) {
    console.error('Error dismissing bilan gratuit banner:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
