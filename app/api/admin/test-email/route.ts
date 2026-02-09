export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { sendWelcomeEmail, testEmailConfiguration } from '@/lib/email-service';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Vérifier que l'utilisateur est admin ou assistante
    if (!session?.user || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = (await request.json()) as {
      action?: 'test_config' | 'send_test';
      testEmail?: string;
    };
    const { action, testEmail } = body;

    switch (action) {
      case 'test_config':
        // Tester la configuration SMTP
        const configResult = await testEmailConfiguration();
        return NextResponse.json(configResult);

      case 'send_test':
        // Envoyer un email de test
        if (!testEmail) {
          return NextResponse.json({
            success: false,
            error: 'Adresse email requise pour le test'
          }, { status: 400 });
        }

        try {
          await sendWelcomeEmail({
            firstName: 'Test',
            lastName: 'User',
            email: testEmail
          });

          return NextResponse.json({
            success: true,
            message: `Email de test envoyé à ${testEmail}`
          });
        } catch (emailError: unknown) {
          const message =
            emailError instanceof Error ? emailError.message : 'Erreur inconnue';
          return NextResponse.json({
            success: false,
            error: `Erreur envoi email: ${message}`
          });
        }

      default:
        return NextResponse.json({
          error: 'Action non reconnue'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Erreur API test email:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

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
    console.error('Erreur GET test email:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
