export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { sendMail } from '@/lib/email/mailer';
import { prisma } from '@/lib/prisma';
import { createActivationToken } from '@/lib/auth/activation-token';
import {
  buildAccountActivationEmail,
  createParentActivationToken,
  normalizeParentEmail,
  withActivationSecurityHeaders,
} from '@/lib/auth/parent-activation';

const bodySchema = z.object({
  email: z.string().email('Email invalide'),
});

function successResponse() {
  return withActivationSecurityHeaders(NextResponse.json({
    success: true,
    message: 'Si ce compte existe, un nouveau lien d’activation a été envoyé.',
  }));
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return withActivationSecurityHeaders(NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 }));
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return withActivationSecurityHeaders(NextResponse.json({ error: 'Email invalide' }, { status: 400 }));
  }

  const email = normalizeParentEmail(parsed.data.email);
  const response = successResponse();

  const accountBlocked = await guardSensitiveRateLimit(request, {
    scope: 'activation-resend',
    identity: email,
  });
  if (accountBlocked) return withActivationSecurityHeaders(accountBlocked);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        activatedAt: true,
        activationToken: true,
        activationExpiry: true,
        role: true,
      },
    });

    if (!user || user.activatedAt || (user.role !== 'PARENT' && user.role !== 'ELEVE')) {
      return response;
    }

    const { rawToken, tokenHash, expiresAt } = user.role === 'PARENT'
      ? createParentActivationToken()
      : createActivationToken('student');

    const transition = await prisma.user.updateMany({
      where: {
        id: user.id,
        activatedAt: null,
        activationToken: user.activationToken,
        activationExpiry: user.activationExpiry,
      },
      data: {
        activationToken: tokenHash,
        activationExpiry: expiresAt,
      },
    });
    if (transition.count !== 1) return response;

    const stageReservation = await prisma.stageReservation.findFirst({
      where: {
        email,
        richStatus: 'CONFIRMED',
      },
      select: {
        id: true,
      },
      orderBy: { confirmedAt: 'desc' },
    });

    const message = buildAccountActivationEmail({
      displayName: user.firstName || 'Utilisateur',
      rawToken,
      accountRole: user.role,
      ...(stageReservation ? { source: 'stage' as const } : {}),
    });

    await sendMail({
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[resend-activation] Delivery failed', {
        code: 'ACTIVATION_EMAIL_DELIVERY_FAILED',
        at: new Date().toISOString(),
      });
    }
  }

  return response;
}
