export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createBilanRequestIntake } from '@/lib/bilans/requests/create-request';
import { bilanRequestAdmissionSchema } from '@/lib/bilans/requests/schemas';
import {
  buildBilanMagicLinkEmail,
  resolveBilanPublicOrigin,
} from '@/lib/bilans/notifications/templates';
import { checkBodySize, checkCsrf } from '@/lib/csrf';
import { sendMail } from '@/lib/email/mailer';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';

const idempotencyKeySchema = z.string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const HONEYPOT_FIELDS = ['website', 'url', 'honeypot'] as const;
const INVALID_RESPONSE = { error: 'Requête invalide.' } as const;
const INTERNAL_ERROR_RESPONSE = {
  error: 'Service temporairement indisponible.',
} as const;

function hasFilledHoneypot(body: unknown): boolean {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  return HONEYPOT_FIELDS.some((field) => Boolean(
    (body as Readonly<Record<string, unknown>>)[field],
  ));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrfResponse = checkCsrf(request);
  if (csrfResponse) return csrfResponse;

  const bodySizeResponse = checkBodySize(request);
  if (bodySizeResponse) return bodySizeResponse;

  const rateLimitResponse = await guardRateLimitAsync(request, {
    preset: 'api',
    keySuffix: 'bilan-gratuit-v1-intake',
    requireDistributed: true,
  });
  if (rateLimitResponse) return rateLimitResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(INVALID_RESPONSE, { status: 400 });
  }

  if (hasFilledHoneypot(body)) {
    const { BILAN_REQUEST_CREATED_PUBLIC_RESPONSE } = await import(
      '@/lib/bilans/requests/create-request'
    );
    return NextResponse.json(BILAN_REQUEST_CREATED_PUBLIC_RESPONSE);
  }

  const admission = bilanRequestAdmissionSchema.safeParse(body);
  const idempotencyKey = idempotencyKeySchema.safeParse(
    request.headers.get('idempotency-key'),
  );
  if (!admission.success || !idempotencyKey.success) {
    return NextResponse.json(INVALID_RESPONSE, { status: 400 });
  }

  try {
    const result = await createBilanRequestIntake({
      prisma,
      admission: admission.data,
      idempotencyKey: idempotencyKey.data,
      production: process.env.NODE_ENV === 'production',
    });
    const response = NextResponse.json(result.public);
    const flowSession = result.internal.flowSessionToken;
    if (!result.internal.replayed && flowSession) {
      response.cookies.set(
        flowSession.cookie.name,
        flowSession.cookie.value,
        flowSession.cookie.options,
      );
    }
    const magicLink = result.internal.magicLinkToken;
    if (!result.internal.replayed && magicLink) {
      try {
        const email = buildBilanMagicLinkEmail({
          publicOrigin: resolveBilanPublicOrigin(),
          rawToken: magicLink.rawToken,
        });
        await sendMail({
          to: admission.data.parent.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
      } catch {
        // Initial parent delivery is best-effort until the durable worker owns it.
        // Never log the destination, the raw token, or provider error payloads.
      }
    }
    return response;
  } catch {
    return NextResponse.json(INTERNAL_ERROR_RESPONSE, { status: 500 });
  }
}
