import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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
    const signatureHeader = request.headers.get('x-konnect-signature') || request.headers.get('X-Konnect-Signature');
    const secret = process.env.KONNECT_WEBHOOK_SECRET;

    if (!secret || !signatureHeader) {
      return NextResponse.json({ error: 'Signature manquante' }, { status: 401 });
    }

    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    if (!safeEqual(signatureHeader, computed)) {
      return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    // Validation basique du webhook Konnect
    const { payment_id, status, amount, currency } = body;

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
        // Activer l'abonnement
        const student = await prisma.student.findUnique({
          where: { id: metadata?.studentId }
        });

        if (student) {
          const planKey = String(metadata?.itemKey || '').trim();
          // Désactiver l'ancien abonnement actif
          await prisma.subscription.updateMany({
            where: {
              studentId: student.id,
              status: 'ACTIVE'
            },
            data: { status: 'CANCELLED' }
          });

          // Tenter d'activer une ligne INACTIVE existante
          const updated = await prisma.subscription.updateMany({
            where: {
              studentId: student.id,
              planName: planKey,
              status: 'INACTIVE'
            },
            data: {
              status: 'ACTIVE',
              startDate: new Date()
            }
          });

          // Si aucune ligne n'a été activée, créer un abonnement ex-nihilo (fallback)
          if (updated.count === 0) {
            await prisma.subscription.create({
              data: {
                studentId: student.id,
                planName: planKey || 'HYBRIDE',
                monthlyPrice: typeof payment.amount === 'number' ? Math.round(payment.amount) : 0,
                creditsPerMonth: 8,
                status: 'ACTIVE',
                startDate: new Date(),
                ariaSubjects: '[]',
                ariaCost: 0,
              }
            });
          }

          // Allouer les crédits mensuels si applicable
          const subscription = await prisma.subscription.findFirst({
            where: {
              studentId: student.id,
              status: 'ACTIVE'
            }
          });

          if (subscription && subscription.creditsPerMonth > 0) {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 2); // Expire dans 2 mois

            await prisma.creditTransaction.create({
              data: {
                studentId: student.id,
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
    try {
      const { logger } = await import('@/lib/logger');
      logger.error({ err: String(error) }, 'Erreur webhook Konnect');
    } catch {
      console.error('Erreur webhook Konnect:', error);
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
