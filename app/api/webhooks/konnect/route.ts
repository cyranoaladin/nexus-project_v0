import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { logger } from '@/lib/logger';

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(request: NextRequest) {
  try {
    // Lire le corps brut pour vérifier la signature
    const rawBody = await request.text();

    // Vérification de la signature (sécurité)
    const signatureHeader =
      request.headers.get('x-konnect-signature') || request.headers.get('X-Konnect-Signature');
    const secret = process.env.KONNECT_WEBHOOK_SECRET;

    if (!secret || !signatureHeader) {
      return NextResponse.json({ error: 'Signature manquante' }, { status: 401 });
    }

    const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

    if (!safeEqual(signatureHeader, computed)) {
      return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    const WebhookSchema = z.object({
      event_id: z.string().optional(),
      payment_id: z.string().optional(),
      status: z.string().optional(),
      amount: z.number().optional(),
      currency: z.string().optional(),
      transaction_id: z.string().optional(),
      timestamp: z.string().optional(),
      created_at: z.string().optional(),
    });
    const parsed = WebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload invalide', details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Idempotence & anti-replay (5 minutes window)
    const eventId: string | undefined = body.event_id || body.payment_id;
    const eventTs: number = Date.parse(
      body.timestamp || body.created_at || new Date().toISOString()
    );
    if (!eventId || !isFinite(eventTs)) {
      return NextResponse.json(
        { error: 'Webhook invalide (id/horodatage manquants)' },
        { status: 400 }
      );
    }
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - eventTs > fiveMinutes) {
      return NextResponse.json({ error: 'Webhook expiré (anti-replay)' }, { status: 400 });
    }
    // Empêcher re-traitement du même évènement
    let already: any = null;
    try {
      already = await (prisma as any).payment.findFirst({ where: { externalId: eventId } });
    } catch {
      // Certains mocks n'exposent pas findFirst; fallback sur findUnique par id si cohérent
      try {
        already = await prisma.payment.findUnique({ where: { externalId: eventId } } as any);
      } catch {}
    }
    if (already && already.status === 'COMPLETED' && body.status === 'completed') {
      return NextResponse.json({ success: true, idempotent: true });
    }

    // Validation basique du webhook Konnect
    const { payment_id, status, amount, currency } = body;

    if (!payment_id || !status) {
      return NextResponse.json({ error: 'Données webhook invalides' }, { status: 400 });
    }

    // Récupérer le paiement
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
      include: {
        user: {
          include: {
            parentProfile: {
              include: {
                children: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    if (status === 'completed') {
      // Mettre à jour le statut du paiement
      await prisma.payment.update({
        where: { id: payment_id },
        data: {
          status: 'COMPLETED',
          externalId: eventId,
          metadata: {
            ...((payment.metadata as Record<string, any>) || {}),
            konnectTransactionId: body.transaction_id || payment_id,
            completedAt: new Date().toISOString(),
          },
        },
      });

      // Activer le service selon le type de paiement
      const metadata = payment.metadata as any;

      if (payment.type === 'SUBSCRIPTION') {
        // Activer l'abonnement
        const student = await prisma.student.findUnique({
          where: { id: metadata.studentId },
        });

        if (student) {
          // Désactiver l'ancien abonnement
          await prisma.subscription.updateMany({
            where: {
              studentId: metadata.studentId,
              status: 'ACTIVE',
            },
            data: { status: 'CANCELLED' },
          });

          // Activer le nouvel abonnement
          await prisma.subscription.updateMany({
            where: {
              studentId: metadata.studentId,
              planName: metadata.itemKey,
              status: 'INACTIVE',
            },
            data: {
              status: 'ACTIVE',
              startDate: new Date(),
            },
          });

          // Allouer les crédits mensuels si applicable
          const subscription = await prisma.subscription.findFirst({
            where: {
              studentId: metadata.studentId,
              status: 'ACTIVE',
            },
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
                expiresAt: nextMonth,
              },
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
        data: { status: 'FAILED', externalId: eventId },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Erreur webhook Konnect');

    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
