import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const dismissPayloadSchema = z.object({}).strict();

/**
 * POST /api/bilan-gratuit/dismiss
 * Marks the bilan gratuit banner as dismissed for the current parent.
 * Body must be empty (Zod strict: rejects non-empty payloads).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionOrError = await requireRole(UserRole.PARENT);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    // Enforce empty body — reject stray fields
    const rawBody = await request.json().catch(() => ({}));
    const parsed = dismissPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Le corps de la requête doit être vide' }, { status: 400 });
    }

    await prisma.parentProfile.update({
      where: { userId: sessionOrError.user.id },
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
