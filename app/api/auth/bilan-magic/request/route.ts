export const dynamic = 'force-dynamic';

import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  appendBilanRequestEvent,
  type BilanRequestEventClient,
} from '@/lib/bilans/requests/events';
import { createBilanMagicLinkToken } from '@/lib/bilans/requests/tokens';
import {
  buildBilanMagicLinkEmail,
  resolveBilanPublicOrigin,
} from '@/lib/bilans/notifications/templates';
import { checkBodySize, checkCsrf } from '@/lib/csrf';
import { sendMail } from '@/lib/email/mailer';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
}).strict();

const NEUTRAL_RESPONSE = {
  success: true,
  message: 'Si une demande éligible existe, un lien de connexion a été envoyé.',
} as const;

type Delivery = Readonly<{
  email: string;
  rawToken: string;
}>;

function neutralResponse(): NextResponse {
  return NextResponse.json(NEUTRAL_RESPONSE);
}

async function rotateEligibleMagicLink(
  normalizedEmail: string,
  now: Date,
): Promise<Delivery | null> {
  const token = createBilanMagicLinkToken({ now });

  return prisma.$transaction(async (transaction) => {
    const users = await transaction.user.findMany({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      select: { id: true, email: true, role: true },
      take: 2,
    });
    if (users.length !== 1 || users[0].role !== 'PARENT') return null;
    const parent = users[0];

    const request = await transaction.bilanRequest.findFirst({
      where: {
        parentUserId: parent.id,
        accountVerificationState: 'VERIFICATION_PENDING',
        status: {
          notIn: ['CANCELLED', 'HUMAN_FOLLOWUP_REQUIRED'],
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!request) return null;

    await transaction.bilanMagicLink.updateMany({
      where: {
        requestId: request.id,
        parentUserId: parent.id,
        consumedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
    await transaction.bilanMagicLink.create({
      data: {
        requestId: request.id,
        parentUserId: parent.id,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
      },
      select: { id: true },
    });
    await appendBilanRequestEvent(
      transaction as unknown as BilanRequestEventClient,
      {
        requestId: request.id,
        type: 'ACCOUNT_VERIFICATION_REQUESTED',
        actor: 'SYSTEM',
        correlationId: randomUUID(),
        payload: { deliveryChannelCode: 'EMAIL' },
      },
      { now },
    );

    return {
      email: parent.email,
      rawToken: token.rawToken,
    };
  }, {
    isolationLevel: 'Serializable',
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrfResponse = checkCsrf(request);
  if (csrfResponse) return csrfResponse;

  const bodySizeResponse = checkBodySize(request);
  if (bodySizeResponse) return bodySizeResponse;

  const rateLimitResponse = await guardRateLimitAsync(request, {
    preset: 'auth',
    keySuffix: 'bilan-magic-request',
  });
  if (rateLimitResponse) return rateLimitResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });
  }

  try {
    const publicOrigin = resolveBilanPublicOrigin();
    const delivery = await rotateEligibleMagicLink(parsed.data.email, new Date());
    if (!delivery) return neutralResponse();

    const email = buildBilanMagicLinkEmail({
      publicOrigin,
      rawToken: delivery.rawToken,
    });

    // Direct SMTP is intentionally best-effort here. Durable notification delivery
    // is introduced by the canonical notification worker in the following task.
    try {
      await sendMail({
        to: delivery.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    } catch {
      // Keep the public contract neutral and never log email addresses or raw tokens.
    }
  } catch {
    // Account, database and configuration failures share the same public response.
  }

  return neutralResponse();
}
