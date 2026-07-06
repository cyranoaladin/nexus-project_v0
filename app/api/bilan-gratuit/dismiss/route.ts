import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const dismissPayloadSchema = z.object({}).strict();

/**
 * POST /api/bilan-gratuit/dismiss
 * Marks the bilan gratuit banner as dismissed for the current parent.
 */
export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get('content-length');
    if (contentLength && contentLength !== '0') {
      const parsedPayload = dismissPayloadSchema.safeParse(await request.json().catch(() => null));
      if (!parsedPayload.success) {
        return NextResponse.json({ error: 'Invalid dismiss payload' }, { status: 400 });
      }
    }

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
    console.error('Error dismissing bilan gratuit banner:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
