import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { action, amount, testMode = true } = body;

    switch (action) {
      case 'test_connection':
        // Tester la connexion à l'API Konnect
        const apiUrl = testMode
          ? 'https://api.preprod.konnect.network'
          : 'https://api.konnect.network';

        try {
          const response = await fetch(`${apiUrl}/api/v2/payments/init-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.KONNECT_API_KEY || '',
            },
            body: JSON.stringify({
              receiverWalletId: process.env.KONNECT_WALLET_ID,
              amount: 100, // Test avec 100 millimes
              token: 'TND',
              description: 'Test de connexion API',
              acceptedPaymentMethods: ['wallet', 'bank_card'],
              successUrl: `${process.env.NEXTAUTH_URL}/payment/success`,
              failUrl: `${process.env.NEXTAUTH_URL}/payment/failed`,
              theme: 'light',
            }),
          });

          if (response.ok) {
            const data = await response.json();
            return NextResponse.json({
              success: true,
              message: 'Connexion API Konnect réussie',
              paymentRef: data.paymentRef,
              paymentUrl: data.paymentUrl,
            });
          } else {
            const errorData = await response.text();
            return NextResponse.json({
              success: false,
              error: `Erreur API Konnect: ${response.status} - ${errorData}`,
            });
          }
        } catch (error: any) {
          return NextResponse.json({
            success: false,
            error: `Erreur de connexion: ${error.message}`,
          });
        }

      case 'create_test_payment':
        // Créer un paiement de test
        if (!amount || amount < 100) {
          return NextResponse.json(
            {
              success: false,
              error: 'Montant minimum: 100 millimes (0.1 TND)',
            },
            { status: 400 }
          );
        }

        const paymentApiUrl = testMode
          ? 'https://api.preprod.konnect.network'
          : 'https://api.konnect.network';

        try {
          const paymentResponse = await fetch(`${paymentApiUrl}/api/v2/payments/init-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.KONNECT_API_KEY || '',
            },
            body: JSON.stringify({
              receiverWalletId: process.env.KONNECT_WALLET_ID,
              amount: amount,
              token: 'TND',
              description: `Test paiement - ${amount} millimes`,
              acceptedPaymentMethods: ['wallet', 'bank_card'],
              successUrl: `${process.env.NEXTAUTH_URL}/payment/success?test=true`,
              failUrl: `${process.env.NEXTAUTH_URL}/payment/failed?test=true`,
              theme: 'light',
              orderId: `TEST_${Date.now()}`,
            }),
          });

          if (paymentResponse.ok) {
            const paymentData = await paymentResponse.json();
            return NextResponse.json({
              success: true,
              message: 'Paiement de test créé avec succès',
              payment: {
                reference: paymentData.paymentRef,
                url: paymentData.paymentUrl,
                amount: amount,
                currency: 'TND',
                mode: testMode ? 'TEST' : 'PRODUCTION',
              },
            });
          } else {
            const errorData = await paymentResponse.text();
            return NextResponse.json({
              success: false,
              error: `Erreur création paiement: ${paymentResponse.status} - ${errorData}`,
            });
          }
        } catch (error: any) {
          return NextResponse.json({
            success: false,
            error: `Erreur paiement: ${error.message}`,
          });
        }

      case 'check_status':
        // Vérifier le statut d'un paiement
        const { paymentRef } = body;
        if (!paymentRef) {
          return NextResponse.json(
            {
              success: false,
              error: 'Référence de paiement requise',
            },
            { status: 400 }
          );
        }

        const statusApiUrl = testMode
          ? 'https://api.preprod.konnect.network'
          : 'https://api.konnect.network';

        try {
          const statusResponse = await fetch(`${statusApiUrl}/api/v2/payments/${paymentRef}`, {
            method: 'GET',
            headers: {
              'x-api-key': process.env.KONNECT_API_KEY || '',
            },
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            return NextResponse.json({
              success: true,
              payment: statusData,
            });
          } else {
            return NextResponse.json({
              success: false,
              error: `Erreur vérification statut: ${statusResponse.status}`,
            });
          }
        } catch (error: any) {
          return NextResponse.json({
            success: false,
            error: `Erreur vérification: ${error.message}`,
          });
        }

      default:
        return NextResponse.json(
          {
            error: 'Action non reconnue',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Erreur API test paiement:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Retourner l'état de la configuration Konnect
    const konnectConfig = {
      apiKey: !!process.env.KONNECT_API_KEY,
      walletId: !!process.env.KONNECT_WALLET_ID,
      publicKey: !!process.env.NEXT_PUBLIC_KONNECT_PUBLIC_KEY,
      webhookSecret: !!process.env.KONNECT_WEBHOOK_SECRET,
    };

    return NextResponse.json({
      success: true,
      configuration: {
        konnect: konnectConfig,
        wise: {
          apiKey: !!process.env.WISE_API_KEY,
          profileId: !!process.env.WISE_PROFILE_ID,
        },
        allConfigured: Object.values(konnectConfig).every(Boolean),
      },
    });
  } catch (error) {
    console.error('Erreur GET test paiement:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
