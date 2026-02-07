export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { mergePaymentMetadata, parsePaymentMetadata } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

type PaymentMetadata = {
  studentId: string;
  itemKey?: string;
  itemType?: string;
};

const validatePaymentSchema = z.object({
  paymentId: z.string(),
  action: z.enum(['approve', 'reject']),
  note: z.string().optional()
});

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

    if (action === 'approve') {
      // CRITICAL: Wrap payment validation in atomic transaction to ensure all-or-nothing behavior
      // Without this transaction, payment could be marked COMPLETED but credits never allocated
      // if crash occurs between operations (INV-PAY-2)
      await prisma.$transaction(async (tx) => {
        // Valider le paiement
        const merged = mergePaymentMetadata(payment.metadata, {
          validatedBy: session.user.id,
          validatedAt: new Date().toISOString(),
          validationNote: note
        });
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: 'COMPLETED',
            metadata: merged.value
          }
        });

        // Activer le service selon le type
        const metadata = parsePaymentMetadata(payment.metadata) as PaymentMetadata;

        if (payment.type === 'SUBSCRIPTION') {
          // Activer l'abonnement
          const student = await tx.student.findUnique({
            where: { id: metadata.studentId }
          });

          if (student) {
            // Désactiver l'ancien abonnement
            await tx.subscription.updateMany({
              where: {
                studentId: metadata.studentId,
                status: 'ACTIVE'
              },
              data: { status: 'CANCELLED' }
            });

            // Activer le nouvel abonnement
            await tx.subscription.updateMany({
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

            // Allouer les crédits mensuels
            const subscription = await tx.subscription.findFirst({
              where: {
                studentId: metadata.studentId,
                status: 'ACTIVE'
              }
            });

            if (subscription && subscription.creditsPerMonth > 0) {
              const nextMonth = new Date();
              nextMonth.setMonth(nextMonth.getMonth() + 2);

              await tx.creditTransaction.create({
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
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000  // 10 seconds timeout
      });

      // TODO: Envoyer email de confirmation au client

    } else {
      // Rejeter le paiement
      const mergedReject = mergePaymentMetadata(payment.metadata, {
        rejectedBy: session.user.id,
        rejectedAt: new Date().toISOString(),
        rejectionReason: note
      });
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          metadata: mergedReject.value
        }
      });

      // TODO: Envoyer email d'information au client
    }

    return NextResponse.json({
      success: true,
      message: `Paiement ${action === 'approve' ? 'validé' : 'rejeté'} avec succès`
    });

  } catch (error) {
    console.error('Erreur validation paiement:', error);

    // Handle Prisma transaction errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: Record<string, unknown> };

      // P2034: Transaction failed due to serialization conflict
      if (prismaError.code === 'P2034') {
        return NextResponse.json(
          { error: 'Conflit de validation concurrent détecté. Veuillez réessayer.' },
          { status: 409 }
        );
      }

      // P2025: Record not found
      if (prismaError.code === 'P2025') {
        return NextResponse.json(
          { error: 'Ressource non trouvée lors de la validation' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
