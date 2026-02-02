export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { mergePaymentMetadata } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const wiseConfirmSchema = z.object({
  orderId: z.string(),
  transferReference: z.string(),
  transferDate: z.string(),
  transferAmount: z.string()
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

    const formData = await request.formData();

    const validatedData = wiseConfirmSchema.parse({
      orderId: formData.get('orderId'),
      transferReference: formData.get('transferReference'),
      transferDate: formData.get('transferDate'),
      transferAmount: formData.get('transferAmount')
    });

    // Vérifier que la commande appartient au parent
    const payment = await prisma.payment.findFirst({
      where: {
        id: validatedData.orderId,
        userId: session.user.id,
        method: 'wise',
        status: 'PENDING'
      }
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Commande non trouvée ou déjà traitée' },
        { status: 404 }
      );
    }

    // Mettre à jour le paiement avec les informations de virement
    const merged = mergePaymentMetadata(payment.metadata, {
      transferReference: validatedData.transferReference,
      transferDate: validatedData.transferDate,
      transferAmount: validatedData.transferAmount,
      submittedAt: new Date().toISOString()
    });
    await prisma.payment.update({
      where: { id: validatedData.orderId },
      data: {
        metadata: merged.value
      }
    });

    // TODO: Gérer l'upload du fichier de preuve
    // TODO: Notifier l'assistante qu'un nouveau virement est à valider

    return NextResponse.json({
      success: true,
      message: 'Preuve de virement enregistrée. Validation sous 24-48h.'
    });

  } catch (error) {
    console.error('Erreur confirmation Wise:', error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
