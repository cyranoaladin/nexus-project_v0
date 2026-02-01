import { requireRole, isErrorResponse } from '@/lib/guards';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { upsertPaymentByExternalId } from '@/lib/payments';
import { prisma } from '@/lib/prisma';

const konnectPaymentSchema = z.object({
  type: z.enum(['subscription', 'addon', 'pack']),
  key: z.string(),
  studentId: z.string(),
  amount: z.number(),
  description: z.string()
});

export async function POST(request: NextRequest) {
  try {
    // Require PARENT role
    const session = await requireRole('PARENT');
    if (isErrorResponse(session)) return session;

    const body = await request.json();
    const validatedData = konnectPaymentSchema.parse(body);

    // Vérifier que l'élève appartient au parent
    const student = await prisma.student.findFirst({
      where: {
        id: validatedData.studentId,
        parent: {
          userId: session.user.id
        }
      }
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Élève non trouvé ou non autorisé' },
        { status: 404 }
      );
    }

    // Construire un externalId déterministe pour l'idempotence (même requête => même externalId)
    const idempotencyKey = `konnect:${session.user.id}:${validatedData.studentId}:${validatedData.type}:${validatedData.key}:${validatedData.amount}`;
    const externalId = crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 32);

    // Créer ou récupérer l'enregistrement de paiement (idempotent)
    const mappedType = validatedData.type === 'subscription'
      ? 'SUBSCRIPTION'
      : validatedData.type === 'addon'
        ? 'SPECIAL_PACK'
        : 'CREDIT_PACK';

    const { payment } = await upsertPaymentByExternalId({
      externalId,
      method: 'konnect',
      type: mappedType,
      userId: session.user.id,
      amount: validatedData.amount,
      currency: 'TND',
      description: validatedData.description,
      metadata: {
        studentId: validatedData.studentId,
        itemKey: validatedData.key,
        itemType: validatedData.type,
      },
    });

    // TODO: Intégrer avec l'API Konnect réelle
    // Pour le MVP, on simule la création d'une session de paiement
    // const konnectPaymentUrl = `https://api.konnect.network/api/v2/payments/${payment.id}/init`;

    // En production, vous feriez un appel à l'API Konnect ici
    // const konnectResponse = await fetch(`${process.env.KONNECT_BASE_URL}/api/v2/payments/init`, {
    //   method: 'POST',
    //   headers: {
    //     'x-api-key': process.env.KONNECT_API_KEY!,
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
      message: 'Session de paiement Konnect créée'
    });

  } catch (error) {
    console.error('Erreur paiement Konnect:', error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}