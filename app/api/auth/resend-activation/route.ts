export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { prisma } from '@/lib/prisma';
import { createActivationToken } from '@/lib/auth/activation-token';
import {
  buildAccountActivationEmail,
  createParentActivationToken,
  normalizeParentEmail,
  withActivationSecurityHeaders,
} from '@/lib/auth/parent-activation';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';

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
    const queued = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { email },
        select: {
          id: true, email: true, firstName: true, activatedAt: true,
          activationToken: true, activationExpiry: true, role: true,
        },
      });
      if (!user || user.activatedAt || (user.role !== 'PARENT' && user.role !== 'ELEVE')) return false;
      const { rawToken, tokenHash, expiresAt } = user.role === 'PARENT'
        ? createParentActivationToken()
        : createActivationToken('student');
      const transition = await transaction.user.updateMany({
        where: {
          id: user.id,
          email: user.email,
          role: user.role,
          ...(user.role === 'PARENT' ? { mergedIntoUserId: null } : {}),
          activatedAt: null,
          activationToken: user.activationToken,
          activationExpiry: user.activationExpiry,
        },
        data: { activationToken: tokenHash, activationExpiry: expiresAt },
      });
      if (transition.count !== 1) return false;
      const stageReservation = await transaction.stageReservation.findFirst({
        where: { email, richStatus: 'CONFIRMED' },
        select: { id: true },
        orderBy: { confirmedAt: 'desc' },
      });
      const message = buildAccountActivationEmail({
        displayName: user.firstName || 'Utilisateur',
        rawToken,
        accountRole: user.role,
        ...(stageReservation ? { source: 'stage' as const } : {}),
      });
      await enqueueEmailIntent(transaction, {
        aggregateId: user.id,
        messageType: user.role === 'PARENT' ? 'PARENT_ACTIVATION' : 'STUDENT_ACTIVATION',
        dedupeKey: tokenHash,
        to: email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return true;
    });
    if (queued) kickEmailOutboxDrain();
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
