import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { mapPaymentToResponse, paymentResponseInclude } from '@/app/api/sessions/contracts';

type PaymentWithParentRelations = Prisma.PaymentGetPayload<{
  include: {
    user: {
      include: {
        parentProfile: {
          include: {
            children: true;
          };
        };
      };
    };
  };
}>;

type KonnectWebhookPayload = {
  payment_id?: string | number;
  id?: string | number;
  transaction_id?: string | number;
  status?: string;
  [key: string]: unknown;
};

type SubscriptionMetadata = {
  studentId: string;
  itemKey?: string;
};

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractSubscriptionMetadata(metadata: Prisma.JsonObject): SubscriptionMetadata | null {
  const studentIdValue = metadata.studentId;
  if (typeof studentIdValue !== 'string') {
    return null;
  }

  const itemKeyValue = metadata.itemKey;

  return {
    studentId: studentIdValue,
    itemKey: typeof itemKeyValue === 'string' ? itemKeyValue : undefined,
  };
}

function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: NextRequest) {
  try {
    // Lire le corps brut pour vérification de signature. Certaines implémentations
    // de Request en tests lèvent si text() est indisponible, d'où la tentative en try/catch.
    let raw: string;
    const clone = typeof request.clone === 'function' ? request.clone() : request;
    try {
      raw = await clone.text();
    } catch {
      const json = await clone.json();
      raw = JSON.stringify(json);
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

    const body = JSON.parse(raw || '{}') as KonnectWebhookPayload;

    // Validation basique du webhook Konnect (adapter aux champs réels)
    const paymentProviderIdCandidate = body.payment_id ?? body.id ?? body.transaction_id;
    const paymentProviderId = paymentProviderIdCandidate != null ? String(paymentProviderIdCandidate) : null;
    const status = typeof body.status === 'string' ? body.status.toLowerCase() : '';

    if (!paymentProviderId || !status) {
      return NextResponse.json(
        { error: 'Données webhook invalides' },
        { status: 400 }
      );
    }

    // Récupérer le paiement par externalId (méthode préférée) puis fallback par id
    let payment: PaymentWithParentRelations | null = await prisma.payment.findFirst({
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
      });
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
      const existingMetadata = isJsonObject(payment.metadata) ? payment.metadata : {};
      const konnectTransactionId = typeof body.transaction_id === 'string' ? body.transaction_id : paymentProviderId;
      const updatedMetadata: Prisma.InputJsonObject = {
        ...existingMetadata,
        konnectTransactionId,
        completedAt: new Date().toISOString(),
      };

      // Mettre à jour le statut du paiement (idempotent si répété)
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          externalId: String(paymentProviderId),
          method: 'konnect',
          metadata: updatedMetadata,
        },
        include: paymentResponseInclude,
      });

      // Activer le service selon le type de paiement
      const subscriptionMetadata = extractSubscriptionMetadata(existingMetadata);

      if (payment.type === 'SUBSCRIPTION' && subscriptionMetadata) {
        // Activer l'abonnement (idempotent)
        const student = await prisma.student.findUnique({
          where: { id: subscriptionMetadata.studentId }
        });

        if (student) {
          await prisma.subscription.updateMany({
            where: { studentId: subscriptionMetadata.studentId, status: 'ACTIVE' },
            data: { status: 'CANCELLED' }
          });

          const activationFilter: Prisma.SubscriptionWhereInput = {
            studentId: subscriptionMetadata.studentId,
            status: 'INACTIVE'
          };

          if (subscriptionMetadata.itemKey) {
            activationFilter.planName = subscriptionMetadata.itemKey;
          }

          await prisma.subscription.updateMany({
            where: activationFilter,
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
