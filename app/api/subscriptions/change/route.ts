import { authOptions } from '@/lib/auth';
import { SUBSCRIPTION_PLANS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const changeSubscriptionSchema = z.object({
  studentId: z.string(),
  newPlan: z.string()
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

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type invalide. Utilisez application/json.' }, { status: 415 });
    }
    let raw = '';
    try { raw = await request.text(); } catch { raw = ''; }
    if (!raw || raw.trim().length === 0) {
      return NextResponse.json({ error: 'Requête invalide: corps vide.' }, { status: 400 });
    }
    let body: unknown;
    try { body = JSON.parse(raw); } catch {
      return NextResponse.json({ error: 'Requête invalide: JSON mal formé.' }, { status: 400 });
    }
    const { studentId, newPlan } = changeSubscriptionSchema.parse(body);

    // Vérifier que le plan existe
    if (!SUBSCRIPTION_PLANS[newPlan as keyof typeof SUBSCRIPTION_PLANS]) {
      return NextResponse.json(
        { error: 'Plan d\'abonnement invalide' },
        { status: 400 }
      );
    }

    // Vérifier que l'élève appartient au parent connecté
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        parent: {
          userId: session.user.id
        }
      },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Élève non trouvé ou non autorisé' },
        { status: 404 }
      );
    }

    const planData = SUBSCRIPTION_PLANS[newPlan as keyof typeof SUBSCRIPTION_PLANS];

    // Créer une demande de changement d'abonnement
    // (sera activée après paiement)
    const pendingSubscription = await prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          studentId,
          planName: newPlan,
          monthlyPrice: planData.price,
          creditsPerMonth: planData.credits,
          status: 'INACTIVE',
          startDate: new Date(),
          ariaSubjects: JSON.stringify(['MATHEMATIQUES'])
        }
      });
      // Eligibilité garantie: plans annuels
      const isAnnual = /ANNUEL/i.test(newPlan) || ['IMMERSION_ANNUEL', 'HYBRIDE_ANNUEL', 'PREMIUM_ANNUEL'].includes(newPlan);
      if (isAnnual) {
        await tx.student.update({
          where: { id: student.id },
          data: { guaranteeEligible: true }
        });
      }
      return created;
    });

    return NextResponse.json({
      success: true,
      subscriptionId: pendingSubscription.id,
      message: 'Demande de changement créée, procédez au paiement'
    });

  } catch (error) {
    console.error('Erreur changement abonnement:', error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
