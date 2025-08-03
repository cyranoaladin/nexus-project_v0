import { authOptions } from '@/lib/auth';
import { calculateCreditCost, checkCreditBalance, debitCredits } from '@/lib/credits';
import { prisma } from '@/lib/prisma';
import { ServiceType, Subject } from '@/types/enums';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema de validation pour la réservation de session
const sessionBookingSchema = z.object({
  coachId: z.string().optional(),
  subject: z.nativeEnum(Subject),
  type: z.nativeEnum(ServiceType),
  scheduledAt: z.string().datetime(),
  duration: z.number().min(30).max(180),
  title: z.string().min(1, 'Titre requis'),
  description: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = sessionBookingSchema.parse(body);

    // Récupérer l'élève
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
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
        { error: 'Profil élève non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier l'abonnement actif
    const activeSubscription = student.subscriptions[0];
    if (!activeSubscription) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif' },
        { status: 403 }
      );
    }

    // Calculer le coût en crédits
    const creditCost = calculateCreditCost(validatedData.type as ServiceType);

    // Vérifier le solde de crédits
    const hasEnoughCredits = await checkCreditBalance(student.id, creditCost);
    if (!hasEnoughCredits) {
      return NextResponse.json(
        { error: 'Solde de crédits insuffisant' },
        { status: 400 }
      );
    }

    // Vérifier la disponibilité du coach si spécifié
    if (validatedData.coachId) {
      const conflictingSession = await prisma.session.findFirst({
        where: {
          coachId: validatedData.coachId,
          scheduledAt: new Date(validatedData.scheduledAt),
          status: { in: ['SCHEDULED'] }
        }
      });

      if (conflictingSession) {
        return NextResponse.json(
          { error: 'Ce créneau n\'est pas disponible' },
          { status: 400 }
        );
      }
    }

    // Vérifier et attribuer un coach si nécessaire
    let assignedCoachId = validatedData.coachId;

    if (!assignedCoachId) {
      // Trouver un coach disponible pour cette matière
      const availableCoach = await prisma.coachProfile.findFirst({
        where: {
          user: { role: 'COACH' },
          subjects: { contains: validatedData.subject },
          availableOnline: true
        }
      });

      if (!availableCoach) {
        return NextResponse.json(
          { error: 'Aucun coach disponible pour cette matière' },
          { status: 400 }
        );
      }

      assignedCoachId = availableCoach.id;
    }

    // Créer la session
    const newSession = await prisma.session.create({
      data: {
        studentId: student.id,
        coachId: assignedCoachId,
        type: validatedData.type as ServiceType,
        subject: validatedData.subject,
        title: validatedData.title,
        description: validatedData.description,
        scheduledAt: new Date(validatedData.scheduledAt),
        duration: validatedData.duration,
        creditCost
      },
      include: {
        coach: {
          include: {
            user: true
          }
        }
      }
    });

    // Débiter les crédits
    await debitCredits(
      student.id,
      creditCost,
      newSession.id,
      `Réservation: ${newSession.title}`
    );

    return NextResponse.json({
      success: true,
      session: {
        id: newSession.id,
        title: newSession.title,
        scheduledAt: newSession.scheduledAt,
        duration: newSession.duration,
        creditCost: newSession.creditCost,
        coach: newSession.coach ? {
          name: `${newSession.coach.user.firstName} ${newSession.coach.user.lastName}`,
          pseudonym: newSession.coach.pseudonym
        } : null
      }
    });

  } catch (error) {
    console.error('Erreur réservation session:', error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
