import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
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
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 401 }
      );
    }

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

    // TODO: Intégrer avec l'API Konnect réelle (si besoin, initialiser la session via l'API Konnect)
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
