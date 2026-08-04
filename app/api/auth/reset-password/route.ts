export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { checkCsrf, checkBodySize } from '@/lib/csrf';
import { generateResetToken, verifyResetToken } from '@/lib/password-reset-token';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { escapeHtml } from '@/lib/email/templates';
import { getTrustedApplicationOrigin } from '@/lib/auth/parent-activation';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';

/** Common weak passwords to reject */
const COMMON_PASSWORDS = new Set([
  'password', '12345678', '123456789', 'qwerty123', 'admin123',
  'nexus123', 'password1', 'iloveyou', 'sunshine1', 'princess1',
  'football1', 'charlie1', 'access14', 'master12', 'dragon12',
]);

/** Schema for requesting a password reset email */
const requestSchema = z.object({
  email: z.string().email('Email invalide'),
});

/** Schema for confirming a password reset */
const confirmSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  newPassword: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .refine(
      (pw) => !COMMON_PASSWORDS.has(pw.toLowerCase()),
      'Ce mot de passe est trop courant. Choisissez un mot de passe plus sécurisé.'
    ),
});

/**
 * POST /api/auth/reset-password
 *
 * Two actions based on request body:
 *   - { email } → Request reset (sends email with token link)
 *   - { token, newPassword } → Confirm reset (changes password)
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF protection — verify same-origin
    const csrfResponse = checkCsrf(request);
    if (csrfResponse) return csrfResponse;

    // Body size limit — reject oversized payloads (1MB)
    const bodySizeResponse = checkBodySize(request);
    if (bodySizeResponse) return bodySizeResponse;

    const body = await request.json();

    const isConfirmation = typeof body?.token === 'string' && typeof body?.newPassword === 'string';
    const blocked = await guardSensitiveRateLimit(request, {
      scope: isConfirmation ? 'password-reset-confirm' : 'password-reset-request',
      identity: isConfirmation
        ? body.token
        : typeof body?.email === 'string'
          ? body.email
          : null,
    });
    if (blocked) return blocked;

    // Determine action: request or confirm
    if (body.token && body.newPassword) {
      return handleConfirmReset(body);
    }
    return handleRequestReset(body, request);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[reset-password] Error:', error instanceof Error ? error.message : 'unknown');
    }
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

/**
 * Handle reset request: validate email, generate token, send email.
 * Always returns success to prevent email enumeration.
 */
async function handleRequestReset(body: unknown, request: NextRequest) {
  const parseResult = requestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Email invalide' },
      { status: 400 }
    );
  }

  const { email } = parseResult.data;

  // Always respond with success to prevent email enumeration
  const successResponse = NextResponse.json({
    success: true,
    message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
  });

  try {
    const queued = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { email },
        select: { id: true, email: true, password: true, firstName: true },
      });
      if (!user) return false;
      const token = generateResetToken(user.id, user.email, user.password);
      const resetUrl = new URL('/auth/reset-password', getTrustedApplicationOrigin());
      resetUrl.searchParams.set('token', token);
      const name = escapeHtml(user.firstName || 'Utilisateur');
      const safeUrl = escapeHtml(resetUrl.toString());
      await enqueueEmailIntent(transaction, {
        aggregateId: user.id,
        messageType: 'PASSWORD_RESET',
        dedupeKey: token,
        to: user.email,
        subject: 'Réinitialisation de votre mot de passe — Nexus Réussite',
        html: `<p>Bonjour ${name},</p><p>Utilisez ce lien personnel et temporaire pour réinitialiser votre mot de passe :</p><p><a href="${safeUrl}">Réinitialiser mon mot de passe</a></p>`,
        text: `Bonjour ${user.firstName || 'Utilisateur'},\n\nRéinitialisez votre mot de passe :\n${resetUrl.toString()}\n\nCe lien est personnel et temporaire.`,
      });
      return true;
    });
    if (queued) kickEmailOutboxDrain();
  } catch (dbError) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[reset-password] DB error:', dbError instanceof Error ? dbError.message : 'unknown');
    }
  }

  return successResponse;
}

/**
 * Handle reset confirmation: verify token, update password.
 */
async function handleConfirmReset(body: unknown) {
  const parseResult = confirmSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parseResult.error.errors[0]?.message },
      { status: 400 }
    );
  }

  const { token, newPassword } = parseResult.data;

  // Decode token to get userId (without verification yet — need password hash)
  let payloadB64: string;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) throw new Error('Invalid token format');
    payloadB64 = parts[0];
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadStr);
    if (!payload.userId) throw new Error('Missing userId');
  } catch {
    return NextResponse.json(
      { error: 'Token invalide ou expiré. Veuillez demander un nouveau lien.' },
      { status: 400 }
    );
  }

  // Extract userId from payload
  const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
  const { userId } = JSON.parse(payloadStr);

  // Fetch user to get current password hash for verification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'Token invalide ou expiré. Veuillez demander un nouveau lien.' },
      { status: 400 }
    );
  }

  // Verify token with current password hash (ensures single-use)
  const payload = verifyResetToken(token, user.password);
  if (!payload) {
    return NextResponse.json(
      { error: 'Token invalide ou expiré. Veuillez demander un nouveau lien.' },
      { status: 400 }
    );
  }

  // Hash new password and update
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      sessionVersion: { increment: 1 },
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
  });
}
