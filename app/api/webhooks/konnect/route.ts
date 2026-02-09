export const dynamic = 'force-dynamic';

import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { mergePaymentMetadata, parsePaymentMetadata } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

type PaymentMetadata = {
  studentId: string;
  itemKey?: string;
  itemType?: string;
};

function verifyWebhookSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');
  try {
    const sigBuffer = Buffer.from(signatureHeader, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Read raw body for signature verification
    const rawBody = await request.text();

    // Webhook signature verification
    const webhookSecret = process.env.KONNECT_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature =
        request.headers.get('x-konnect-signature') ||
        request.headers.get('x-webhook-signature') ||
        request.headers.get('signature');

      if (!signature) {
        console.error('Webhook signature missing from request headers');
        return NextResponse.json(
          { error: 'Signature manquante' },
          { status: 401 }
        );
      }

      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        console.error('Webhook signature verification failed');
        return NextResponse.json(
          { error: 'Signature invalide' },
          { status: 401 }
        );
      }
    } else {
      console.warn('KONNECT_WEBHOOK_SECRET is not set — skipping signature verification. Configure it for production use.');
    }

    const body = JSON.parse(rawBody);

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

    if (status === 'completed') {
      // Mettre à jour le statut du paiement
      const merged = mergePaymentMetadata(payment.metadata, {
        konnectTransactionId: body.transaction_id || payment_id,
        completedAt: new Date().toISOString()
      });
      await prisma.payment.update({
        where: { id: payment_id },
        data: {
          status: 'COMPLETED',
          metadata: merged.value
        }
      });

      // Activer le service selon le type de paiement
      const metadata = parsePaymentMetadata(payment.metadata) as PaymentMetadata;

      if (payment.type === 'SUBSCRIPTION') {
        // Activer l'abonnement
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

          // Allouer les crédits mensuels si applicable
          const subscription = await prisma.subscription.findFirst({
            where: {
              studentId: metadata.studentId,
              status: 'ACTIVE'
            }
          });

          if (subscription && subscription.creditsPerMonth > 0) {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 2); // Expire dans 2 mois

            await prisma.creditTransaction.create({
              data: {
                studentId: metadata.studentId,
                type: 'MONTHLY_ALLOCATION',
                amount: subscription.creditsPerMonth,
                description: `Allocation mensuelle de ${subscription.creditsPerMonth} crédits`,
                expiresAt: nextMonth
              }
            });
          }
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
