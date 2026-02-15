export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateResetToken, verifyResetToken } from '@/lib/password-reset-token';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/** Schema for requesting a password reset email */
const requestSchema = z.object({
  email: z.string().email('Email invalide'),
});

/** Schema for confirming a password reset */
const confirmSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
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
    // Rate limiting: strict for password reset (5 req/15min)
    const rateLimitResponse = await checkRateLimit(request, 'auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();

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
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, firstName: true },
    });

    if (!user) {
      // Don't reveal that the user doesn't exist
      return successResponse;
    }

    // Generate signed token (includes password hash → single-use)
    const token = generateResetToken(user.id, user.email, user.password);

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

    // Send email (non-blocking failure)
    try {
      const { sendPasswordResetEmail } = await import('@/lib/email');
      await sendPasswordResetEmail(
        user.email,
        user.firstName || 'Utilisateur',
        resetUrl
      );
    } catch (emailError) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('[reset-password] Email send failed:', emailError instanceof Error ? emailError.message : 'unknown');
      }
    }
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
    data: { password: hashedPassword },
  });

  return NextResponse.json({
    success: true,
    message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
  });
}
