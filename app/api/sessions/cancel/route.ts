import { authOptions } from '@/lib/auth';
import { refundSessionBookingById } from '@/lib/credits';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const cancelSessionSchema = z.object({
  sessionId: z.string(),
  reason: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !['ELEVE', 'COACH', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sessionId, reason } = cancelSessionSchema.parse(body);

    // Récupérer la session (SessionBooking canonique)
    const sessionToCancel = await prisma.sessionBooking.findUnique({
      where: { id: sessionId }
    });

    if (!sessionToCancel) {
      return NextResponse.json(
        { error: 'Session non trouvée' },
        { status: 404 }
      );
    }

    // Vérifier les permissions
    if (session.user.role === 'ELEVE') {
      if (session.user.id !== sessionToCancel.studentId) {
        return NextResponse.json(
          { error: 'Accès non autorisé à cette session' },
          { status: 403 }
        );
      }
    }

    // Vérifier si l'annulation est dans les délais
    const now = new Date();
    const sessionDate = new Date(`${sessionToCancel.scheduledDate.toISOString().split('T')[0]}T${sessionToCancel.startTime}`);
    const hoursUntilSession = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    let canRefund = false;

    // Politique d'annulation selon le type/modality
    if (sessionToCancel.type === 'INDIVIDUAL' || sessionToCancel.modality === 'HYBRID' || sessionToCancel.modality === 'ONLINE') {
      canRefund = hoursUntilSession >= 24; // 24h avant
    } else if (sessionToCancel.type === 'GROUP' || sessionToCancel.type === 'MASTERCLASS') {
      canRefund = hoursUntilSession >= 48; // 48h avant
    }

    // Les assistantes peuvent toujours rembourser (cas exceptionnels)
    if (session.user.role === 'ASSISTANTE') {
      canRefund = true;
    }

    // Annuler la session
    await prisma.sessionBooking.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED' as any,
        cancelledAt: new Date(),
        coachNotes: reason ? `Annulée: ${reason}` : 'Annulée'
      }
    });

    // Rembourser les crédits si dans les délais (idempotent)
    if (canRefund) {
      await refundSessionBookingById(sessionId, reason);
    }

    return NextResponse.json({
      success: true,
      refunded: canRefund,
      message: canRefund
        ? 'Session annulée et crédits remboursés'
        : 'Session annulée (pas de remboursement - délai dépassé)'
    });

  } catch (error) {
    console.error('Erreur annulation session:', error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
