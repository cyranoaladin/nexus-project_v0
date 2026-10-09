export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { normalizeUserEmail } from '@/lib/contact/user-email';
import { requireAnyRole } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { checkCsrf } from '@/lib/csrf';
import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/http/bounded-request-body';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } as const;
const inputSchema = z.object({ email: z.string().trim().min(3).max(320).email() }).strict();

/** Staff lookup only: possession of an email string cannot reveal a family's reservation. */
function privateRefusal(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

async function verifyStaffReservation(request: NextRequest) {
  const session = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (session instanceof NextResponse) return privateRefusal(session);
  const csrfRefusal = checkCsrf(request);
  if (csrfRefusal) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers });
  const rateRefusal = await guardSensitiveRateLimit(request, { scope: 'reservation-verify', identity: session.user.id });
  if (rateRefusal) return privateRefusal(rateRefusal);

  let raw: unknown;
  try {
    raw = JSON.parse(await readBoundedRequestBody(request, 2048));
  } catch (error) {
    return NextResponse.json({ exists: false }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers });
  }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ exists: false }, { status: 400, headers });
  try {
    const reservation = await prisma.stageReservation.findFirst({
      where: { email: normalizeUserEmail(parsed.data.email) }, select: { id: true },
    });
    return NextResponse.json({ exists: reservation !== null }, { headers });
  } catch {
    return NextResponse.json({ exists: false }, { status: 500, headers });
  }
}


export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await verifyStaffReservation(request);
  } catch {
    return NextResponse.json({ error: 'Vérification indisponible.' }, { status: 503, headers });
  }
}
