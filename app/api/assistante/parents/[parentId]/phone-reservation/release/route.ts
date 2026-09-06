import { auth } from '@/auth';
import { ParentPhoneError, releaseExpiredParentPhoneReservation } from '@/lib/auth/parent-phone';
import { validParentResourceId, withParentPrivateNoStore } from '@/lib/bilans/api/parent-access';
import { checkCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const inputSchema = z.object({ expectedPhoneVersion: z.number().int().min(0).max(2147483647) }).strict();
const respond = (body: unknown, status = 200) => withParentPrivateNoStore(NextResponse.json(body, { status }));

/** parentId is User.id, never ParentProfile.id. This only releases a login reservation. */
export async function POST(request: NextRequest, context: { params: Promise<{ parentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) return respond({ error: 'Not found' }, 404);
    const csrf = checkCsrf(request);
    if (csrf) return withParentPrivateNoStore(csrf);
    const { parentId } = await context.params;
    if (!validParentResourceId(parentId)) return respond({ error: 'Données invalides.' }, 400);
    const blocked = await guardSensitiveRateLimit(request, { scope: 'parent-phone-reservation-release', identity: session.user.id, resource: parentId });
    if (blocked) return withParentPrivateNoStore(blocked);
    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return respond({ error: 'Données invalides.' }, 400);
    const released = await prisma.$transaction(tx => releaseExpiredParentPhoneReservation(tx, parentId, new Date(), input.data.expectedPhoneVersion));
    if (!released) return respond({ code: 'RESERVATION_NOT_RELEASABLE', error: 'Cette réservation ne peut pas être libérée. Actualisez le dossier.' }, 409);
    return respond({ released: true });
  } catch (error) {
    if (error instanceof ParentPhoneError || (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034')) {
      return respond({ code: 'PHONE_IDENTITY_CHANGED', error: 'La réservation a changé. Actualisez le dossier.' }, 409);
    }
    return respond({ error: 'Le service est momentanément indisponible.' }, 500);
  }
}
