import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { sendWelcomeEmail, testEmailConfiguration } from '@/lib/email-service';
import type { AuthSession } from '@/lib/guards';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const testEmailBodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('test_config') }).strict(),
  z.object({
    action: z.literal('send_test'),
    testEmail: z.string().trim().email().max(254),
  }).strict(),
]);

function requireAdmin(session: AuthSession | null) {
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const guard = requireAdmin(session as AuthSession | null);
    if (guard) return guard;

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: 'Payload invalide' }, { status: 400 });
    }
    const parsedBody = testEmailBodySchema.safeParse(json);
    if (!parsedBody.success) {
      return NextResponse.json({ success: false, error: 'Payload invalide' }, { status: 400 });
    }
    const body = parsedBody.data;
    const { action } = body;

    switch (action) {
      case 'test_config':
        // Tester la configuration SMTP
        const configResult = await testEmailConfiguration();
        return NextResponse.json(configResult);

      case 'send_test':
        // Envoyer un email de test
        try {
          await sendWelcomeEmail({
            firstName: 'Test',
            lastName: 'User',
            email: body.testEmail
          });

          return NextResponse.json({
            success: true,
            message: 'Email de test envoyé'
          });
        } catch (emailError: unknown) {
          console.error('Erreur envoi email test:', serializeError(emailError));
          return NextResponse.json({
            success: false,
            error: 'Erreur envoi email'
          }, { status: 502 });
        }

      default:
        return NextResponse.json({
          error: 'Action non reconnue'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Erreur API test email:', serializeError(error));
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const guard = requireAdmin(session as AuthSession | null);
    if (guard) return guard;

    // Retourner l'état de la configuration email
    const envVars = [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'SMTP_FROM',
      'SMTP_SECURE'
    ];

    const configStatus = envVars.map(varName => ({
      variable: varName,
      configured: !!process.env[varName],
    }));

    return NextResponse.json({
      success: true,
      configuration: configStatus,
      allConfigured: configStatus.every(config => config.configured)
    });

  } catch (error) {
    console.error('Erreur GET test email:', serializeError(error));
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
