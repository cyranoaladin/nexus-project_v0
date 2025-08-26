import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const konnectPaymentSchema = z.object({
  type: z.enum(['subscription', 'addon', 'pack']),
  key: z.string(),
  studentId: z.string(),
  amount: z.number(),
  description: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit: payments init should be limited per IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const { rateLimit } = await import('@/lib/rate-limit');
    const { getRateLimitConfig } = await import('@/lib/rate-limit.config');
    const rlConf = getRateLimitConfig('PAYMENTS_KONNECT', { windowMs: 60_000, max: 3 });
    const rl = await rateLimit(rlConf)(`konnect_init:${ip}`);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Trop de requêtes, réessayez plus tard.' },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = konnectPaymentSchema.parse(body);

    // Vérifier que l'élève appartient au parent
    const student = await prisma.student.findFirst({
      where: {
        id: validatedData.studentId,
        parent: {
          userId: session.user.id,
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Élève non trouvé ou non autorisé' }, { status: 404 });
    }

    // Créer l'enregistrement de paiement
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        type: validatedData.type.toUpperCase() as any,
        amount: validatedData.amount,
        currency: 'TND',
        description: validatedData.description,
        status: 'PENDING',
        method: 'konnect',
        metadata: {
          studentId: validatedData.studentId,
          itemKey: validatedData.key,
          itemType: validatedData.type,
        },
      },
    });

    // TODO: Intégrer avec l'API Konnect réelle
    // Pour le MVP, on simule la création d'une session de paiement
    const konnectPaymentUrl = `https://api.konnect.network/api/v2/payments/${payment.id}/init`;

    // En production, vous feriez un appel à l'API Konnect ici
    // const konnectResponse = await fetch('https://api.konnect.network/api/v2/payments/init', {
    //   method: 'POST',
    //   headers: {
    //     'x-api-key': process.env.KONNECT_API_SECRET!,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     receiverWalletId: process.env.KONNECT_WALLET_ID,
    //     amount: validatedData.amount * 1000, // Konnect utilise les millimes
    //     token: "TND",
    //     type: "immediate",
    //     description: validatedData.description,
    //     acceptedPaymentMethods: ["wallet", "bank_card", "e_DINAR"],
    //     successUrl: `${process.env.NEXTAUTH_URL}/dashboard/parent/paiement/success?paymentId=${payment.id}`,
    //     failUrl: `${process.env.NEXTAUTH_URL}/dashboard/parent/paiement/failed?paymentId=${payment.id}`,
    //     theme: "light"
    //   })
    // })

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      paymentUrl: `${process.env.NEXTAUTH_URL}/dashboard/parent/paiement/konnect-demo?paymentId=${payment.id}`,
      message: 'Session de paiement Konnect créée',
    });
  } catch (error) {
    logger.error({ error }, 'Erreur paiement Konnect');

    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
