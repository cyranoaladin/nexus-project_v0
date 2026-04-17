export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { sendMail } from '@/lib/email/mailer';
import { prisma } from '@/lib/prisma';

const bodySchema = z.object({
  email: z.string().email('Email invalide'),
});

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const lastSentByEmail = new Map<string, number>();

function successResponse() {
  return NextResponse.json({
    success: true,
    message: 'Si ce compte existe, un nouveau lien d’activation a été envoyé.',
  });
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildActivationEmailHtml(firstName: string, activationUrl: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2563EB, #7C3AED); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Activation de votre compte</h1>
      </div>

      <div style="padding: 30px; background: #f9f9f9;">
        <h2>Bonjour ${firstName},</h2>

        <p>Vous avez demandé un nouveau lien d'activation pour votre compte Nexus Réussite.</p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563EB;">
          <p>Cliquez sur le bouton ci-dessous pour activer votre compte et choisir votre mot de passe :</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${activationUrl}"
             style="background: #2563EB; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
            Activer mon compte
          </a>
        </div>

        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            ⏰ Ce lien expire dans <strong>72 heures</strong>.<br>
            🔒 Si vous n'avez pas demandé ce lien, ignorez cet email.
          </p>
        </div>

        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
          <a href="${activationUrl}" style="color: #2563EB; word-break: break-all;">${activationUrl}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p>Une question ? Contactez-nous :</p>
        <ul>
          <li>📞 +216 99 19 28 29</li>
          <li>📧 contact@nexusreussite.academy</li>
        </ul>

        <p>Cordialement,<br><strong>L'équipe Nexus Réussite</strong></p>
      </div>
    </div>
  `;
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const response = successResponse();

  const lastSentAt = lastSentByEmail.get(email);
  if (lastSentAt && Date.now() - lastSentAt < RATE_LIMIT_WINDOW_MS) {
    return response;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        activatedAt: true,
        role: true,
      },
    });

    if (!user || user.activatedAt) {
      return response;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        activationToken: hashedToken,
        activationExpiry: expiresAt,
      },
    });

    lastSentByEmail.set(email, Date.now());

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

    const baseUrl = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';
    const sourceSuffix = stageReservation ? '&source=stage' : '';
    const activationUrl = `${baseUrl}/auth/activate?token=${encodeURIComponent(rawToken)}${sourceSuffix}`;

    await sendMail({
      to: email,
      subject: '🔐 Activation de votre compte — Nexus Réussite',
      html: buildActivationEmailHtml(user.firstName || 'Utilisateur', activationUrl),
      text: `Bonjour ${user.firstName || 'Utilisateur'}, activez votre compte: ${activationUrl}`,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[resend-activation] Error:', error instanceof Error ? error.message : 'unknown');
    }
  }

  return response;
}
