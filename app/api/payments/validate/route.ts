import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { mapPaymentToResponse, paymentResponseInclude } from '@/app/api/sessions/contracts';
import type { PaymentWithRelations } from '@/app/api/sessions/contracts';

const validatePaymentSchema = z.object({
  paymentId: z.string().min(1, 'Identifiant de paiement requis'),
  action: z.enum(['approve', 'reject']),
  note: z.string().optional()
});

const subscriptionPaymentMetadataSchema = z.object({
  studentId: z.string().min(1),
  itemKey: z.string().min(1),
  itemType: z.string().optional(),
});

type SubscriptionPaymentMetadata = z.infer<typeof subscriptionPaymentMetadataSchema>;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { paymentId, action, note } = validatePaymentSchema.parse(body);

    // Récupérer le paiement
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Paiement non trouvé' },
        { status: 404 }
      );
    }

    let updatedPayment: PaymentWithRelations | null = null;

    const existingMetadata = (payment.metadata ?? {}) as Record<string, unknown>;

    let subscriptionMetadata: SubscriptionPaymentMetadata | null = null;

    if (action === 'approve') {
      if (payment.type === 'SUBSCRIPTION') {
        const metadataResult = subscriptionPaymentMetadataSchema.safeParse(payment.metadata ?? {});

        if (!metadataResult.success) {
          return NextResponse.json(
            { error: 'Métadonnées de paiement invalides' },
            { status: 422 }
          );
        }

        subscriptionMetadata = metadataResult.data;
      }

      // Valider le paiement
      updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          metadata: {
            ...existingMetadata,
            validatedBy: session.user.id,
            validatedAt: new Date().toISOString(),
            validationNote: note
          }
        },
        include: paymentResponseInclude,
      });

      if (payment.type === 'SUBSCRIPTION' && subscriptionMetadata) {
        // Activer l'abonnement
        const student = await prisma.student.findUnique({
          where: { id: subscriptionMetadata.studentId }
        });

        if (student) {
          // Désactiver l'ancien abonnement
          await prisma.subscription.updateMany({
            where: {
              studentId: subscriptionMetadata.studentId,
              status: 'ACTIVE'
            },
            data: { status: 'CANCELLED' }
          });

          // Activer le nouvel abonnement
          await prisma.subscription.updateMany({
            where: {
              studentId: subscriptionMetadata.studentId,
              planName: subscriptionMetadata.itemKey,
              status: 'INACTIVE'
            },
            data: {
              status: 'ACTIVE',
              startDate: new Date()
            }
          });

          // Allouer les crédits mensuels
          const subscription = await prisma.subscription.findFirst({
            where: {
              studentId: subscriptionMetadata.studentId,
              status: 'ACTIVE'
            }
          });

          if (subscription && subscription.creditsPerMonth > 0) {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 2);

            await prisma.creditTransaction.create({
              data: {
                studentId: subscriptionMetadata.studentId,
                type: 'MONTHLY_ALLOCATION',
                amount: subscription.creditsPerMonth,
                description: `Allocation mensuelle de ${subscription.creditsPerMonth} crédits`,
                expiresAt: nextMonth
              }
            });
          }
        }
      }

      // TODO: Envoyer email de confirmation au client

    } else {
      // Rejeter le paiement
      updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          metadata: {
            ...existingMetadata,
            rejectedBy: session.user.id,
            rejectedAt: new Date().toISOString(),
            rejectionReason: note
          }
        },
        include: paymentResponseInclude,
      });

      // TODO: Envoyer email d'information au client
    }

    if (!updatedPayment) {
      return NextResponse.json(
        { error: 'Paiement introuvable après mise à jour' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Paiement ${action === 'approve' ? 'validé' : 'rejeté'} avec succès`,
      payment: mapPaymentToResponse(updatedPayment)
    });

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.format() },
        { status: 400 }
      );
    }

    console.error('Erreur validation paiement:', error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
