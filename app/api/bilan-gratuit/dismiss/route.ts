import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { parseJsonBody, JSON_BODY_EMPTY } from '@/lib/api/helpers';
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

    // Empty body = valid dismiss. Non-empty must be valid empty JSON {}.
    // Malformed JSON = 400.
    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody(request);
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }
    if (rawBody !== JSON_BODY_EMPTY) {
      const parsed = dismissPayloadSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Le corps de la requête doit être vide' }, { status: 400 });
      }
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
