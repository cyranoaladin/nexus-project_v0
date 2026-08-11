export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { normalizeUserEmail } from '@/lib/contact/user-email';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/reservation/verify
 *
 * Verifies that an email has an existing stage reservation.
 * Returns { exists: boolean } without leaking reservation details.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? normalizeUserEmail(body.email) : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ exists: false }, { status: 400 });
    }

    const reservation = await prisma.stageReservation.findFirst({
      where: { email },
      select: { id: true },
    });

    return NextResponse.json({ exists: !!reservation });
  } catch {
    return NextResponse.json({ exists: false }, { status: 500 });
  }
}
