export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PaymentType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * POST /api/payments/bank-transfer/confirm
 *
 * Appelé par le parent après avoir effectué un virement bancaire.
 * Crée un Payment PENDING + notifie ADMIN/ASSISTANTE.
 */

const confirmBankTransferSchema = z.object({
  type: z.enum(['subscription', 'addon', 'pack']),
  key: z.string().trim().min(1),
  studentId: z.string().trim().optional().nullable(),
  amount: z.number().positive(),
  description: z.string().trim().min(1).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Authentification requise (rôle PARENT)' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = confirmBankTransferSchema.parse(body);

    // Map frontend type to Prisma PaymentType
    const paymentType: PaymentType =
      data.type === 'subscription'
        ? PaymentType.SUBSCRIPTION
        : data.type === 'addon'
          ? PaymentType.SPECIAL_PACK
          : PaymentType.CREDIT_PACK;

    // Vérifier qu'il n'y a pas déjà un paiement PENDING identique (anti-doublon)
    const existingPending = await prisma.payment.findFirst({
      where: {
        userId: session.user.id,
        method: 'bank_transfer',
        status: 'PENDING',
        type: paymentType,
        amount: data.amount,
        description: data.description,
      },
    });

    if (existingPending) {
      return NextResponse.json({
        success: true,
        paymentId: existingPending.id,
        message: 'Un virement est déjà en attente de validation pour cette commande.',
        alreadyExists: true,
      });
    }

    // Créer le Payment en statut PENDING
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        type: paymentType,
        amount: data.amount,
        currency: 'TND',
        description: data.description,
        status: 'PENDING',
        method: 'bank_transfer',
        metadata: {
          itemKey: data.key,
          itemType: data.type,
          studentId: data.studentId ?? null,
          declaredAt: new Date().toISOString(),
          declaredBy: session.user.id,
        },
      },
    });

    // Notifier tous les ADMIN et ASSISTANTE
    const staffUsers = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'ASSISTANTE'] } },
      select: { id: true, role: true },
    });

    if (staffUsers.length > 0) {
      const parentName = [session.user.firstName, session.user.lastName]
        .filter(Boolean)
        .join(' ') || session.user.email;

      await prisma.notification.createMany({
        data: staffUsers.map((staff) => ({
          userId: staff.id,
          userRole: staff.role,
          type: 'BANK_TRANSFER_DECLARED',
          title: 'Nouveau virement déclaré',
          message: `${parentName} a déclaré un virement de ${data.amount} TND pour « ${data.description} ». En attente de validation.`,
          data: {
            paymentId: payment.id,
            parentId: session.user.id,
            parentName,
            amount: data.amount,
            description: data.description,
          },
        })),
      });
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      message: 'Votre déclaration de virement a été transmise. Elle sera validée sous 24/48h.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[BankTransfer Confirm] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
