import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { mapPaymentToResponse, paymentResponseInclude } from '@/app/api/sessions/contracts';

function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: NextRequest) {
  try {
    // Lire le corps brut pour vérification de signature
    let raw: string
    // Some test environments do not implement request.text()
    // Try .text(), fallback to JSON serialization
    // @ts-ignore
    if (typeof request.text === 'function') {
      // @ts-ignore
      raw = await request.text()
    } else {
      const json = await request.json()
      raw = JSON.stringify(json)
    }

    const secret = process.env.KONNECT_WEBHOOK_SECRET || '';
    const headerSig = request.headers.get('x-konnect-signature') || request.headers.get('x-signature') || '';

    // Vérification HMAC (en prod obligatoire)
    if (process.env.NODE_ENV === 'production') {
      if (!secret || !headerSig) {
        return NextResponse.json({ error: 'Signature manquante' }, { status: 403 });
      }
      const hmac = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      if (!timingSafeEqual(hmac, headerSig)) {
        return NextResponse.json({ error: 'Signature invalide' }, { status: 403 });
      }
    }

    const body = JSON.parse(raw || '{}');

    // Validation basique du webhook Konnect (adapter aux champs réels)
    const paymentProviderId = body.payment_id || body.id || body.transaction_id;
    const status = body.status;

    if (!paymentProviderId || !status) {
      return NextResponse.json(
        { error: 'Données webhook invalides' },
        { status: 400 }
      );
    }

    // Récupérer le paiement par externalId (méthode préférée) puis fallback par id
    let payment = await prisma.payment.findFirst({
      where: { method: 'konnect', externalId: String(paymentProviderId) },
      include: {
        user: {
          include: {
            parentProfile: { include: { children: true } }
          }
        }
      }
    });

    if (!payment) {
      payment = await prisma.payment.findUnique({
        where: { id: String(paymentProviderId) },
        include: {
          user: {
            include: {
              parentProfile: { include: { children: true } }
            }
          }
        }
      }) as any;
    }

    if (!payment) {
      return NextResponse.json(
        { error: 'Paiement non trouvé' },
        { status: 404 }
      );
    }

    if (payment.status === 'COMPLETED') {
      const normalized = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: paymentResponseInclude,
      });

      if (!normalized) {
        return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
      }

      return NextResponse.json({ success: true, payment: mapPaymentToResponse(normalized) });
    }

    if (status === 'completed' || status === 'succeeded' || status === 'paid') {
      // Mettre à jour le statut du paiement (idempotent si répété)
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          externalId: String(paymentProviderId),
          method: 'konnect',
          metadata: {
            ...(payment.metadata as Record<string, any> || {}),
            konnectTransactionId: body.transaction_id || paymentProviderId,
            completedAt: new Date().toISOString()
          } as any
        },
        include: paymentResponseInclude,
      });

      // Activer le service selon le type de paiement
      const metadata = payment.metadata as any;

      if (payment.type === 'SUBSCRIPTION') {
        // Activer l'abonnement (idempotent)
        const student = await prisma.student.findUnique({
          where: { id: metadata?.studentId }
        });

        if (student) {
          await prisma.subscription.updateMany({
            where: { studentId: metadata.studentId, status: 'ACTIVE' },
            data: { status: 'CANCELLED' }
          });

          await prisma.subscription.updateMany({
            where: { studentId: metadata.studentId, planName: metadata.itemKey, status: 'INACTIVE' },
            data: { status: 'ACTIVE', startDate: new Date() }
          });
        }
      } else if (payment.type === 'CREDIT_PACK') {
        // TODO: Ajouter des crédits en fonction du pack
      }

      return NextResponse.json({ success: true, payment: mapPaymentToResponse(updatedPayment) });
    } else if (status === 'failed' || status === 'canceled') {
      const failedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
        include: paymentResponseInclude,
      });

      return NextResponse.json({ success: true, payment: mapPaymentToResponse(failedPayment) });
    }

    const normalized = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: paymentResponseInclude,
    });

    if (!normalized) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, payment: mapPaymentToResponse(normalized) });

  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('Erreur webhook Konnect', { error: String(error) });

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
