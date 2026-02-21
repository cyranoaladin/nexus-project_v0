export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Retourner l'état de la configuration ClicToPay
    const envVars = ['CLICTOPAY_API_KEY'];

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
    console.error('Erreur GET test payment:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
