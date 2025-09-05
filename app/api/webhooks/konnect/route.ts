import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validation basique du webhook Konnect
    const { payment_id, status, amount: _amount, currency: _currency } = body;

    if (!payment_id || !status) {
      return NextResponse.json(
        { error: 'Données webhook invalides' },
        { status: 400 }
      );
    }

    // Récupérer le paiement
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
      include: {
        user: {
          include: {
            parentProfile: {
              include: {
                children: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Paiement non trouvé' },
        { status: 404 }
      );
    }

    // Idempotence: si déjà complété, ne rien refaire
    if (payment.status === 'COMPLETED') {
      return NextResponse.json({ success: true });
    }

    if (status === 'completed') {
      // Mettre à jour le statut du paiement (idempotent si répété)
      await prisma.payment.update({
        where: { id: payment_id },
        data: {
          status: 'COMPLETED',
          metadata: {
            ...(payment.metadata as Record<string, any> || {}),
            konnectTransactionId: body.transaction_id || payment_id,
            completedAt: new Date().toISOString()
          }
        }
      });

      // Activer le service selon le type de paiement
      const metadata = payment.metadata as any;

      if (payment.type === 'SUBSCRIPTION') {
        // Activer l'abonnement (idempotent: rejoue sans effet si déjà ACTIVE/INACTIVE corrects)
        const student = await prisma.student.findUnique({
          where: { id: metadata.studentId }
        });

        if (student) {
          // Désactiver l'ancien abonnement
          await prisma.subscription.updateMany({
            where: {
              studentId: metadata.studentId,
              status: 'ACTIVE'
            },
            data: { status: 'CANCELLED' }
          });

          // Activer le nouvel abonnement
          await prisma.subscription.updateMany({
            where: {
              studentId: metadata.studentId,
              planName: metadata.itemKey,
              status: 'INACTIVE'
            },
            data: {
              status: 'ACTIVE',
              startDate: new Date()
            }
          });

          // Note: allocation mensuelle déclenchée côté validation assistante pour éviter doublons
        }
      } else if (payment.type === 'CREDIT_PACK') {
        // Ajouter les crédits du pack
        // TODO: Implémenter selon les spécifications des packs
      }

      // TODO: Envoyer email de confirmation

      return NextResponse.json({ success: true });
    } else if (status === 'failed') {
      // Mettre à jour le statut du paiement
      await prisma.payment.update({
        where: { id: payment_id },
        data: { status: 'FAILED' }
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erreur webhook Konnect:', error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
