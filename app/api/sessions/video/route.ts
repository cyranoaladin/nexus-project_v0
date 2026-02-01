import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SessionStatus } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { sessionId, action } = await request.json();

    if (!sessionId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Vérifier que la session existe et que l'utilisateur y a accès (SessionBooking canonique)
    const bookingSession = await prisma.sessionBooking.findFirst({
      where: {
        id: sessionId,
        OR: [
          { studentId: session.user.id },
          { coachId: session.user.id },
          { parentId: session.user.id }
        ]
      },
      include: {
        student: true,
        coach: true,
        parent: true
      }
    });

    if (!bookingSession) {
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    // Vérifier que la session est accessible temporellement (±15 min autour du début)
    const now = new Date();
    const sessionStart = new Date(
      `${bookingSession.scheduledDate.toISOString().split('T')[0]}T${bookingSession.startTime}`
    );
    const fifteenMinutes = 15 * 60 * 1000;

    if (now.getTime() < sessionStart.getTime() - fifteenMinutes) {
      return NextResponse.json({
        error: 'La session n\'est pas encore disponible ou a expiré'
      }, { status: 400 });
    }

    switch (action) {
      case 'JOIN':
        // Marquer la session comme en cours si elle ne l'est pas déjà
        if (bookingSession.status === 'SCHEDULED') {
          await prisma.sessionBooking.update({
            where: { id: sessionId },
            data: { status: SessionStatus.IN_PROGRESS }
          });
        }

        // Générer les informations de la room Jitsi selon les directives CTO
        const uuid = crypto.randomUUID();
        const roomName = `nexus-reussite-session-${sessionId}-${uuid}`;
        const jitsiServerUrl = process.env.NEXT_PUBLIC_JITSI_SERVER_URL || 'https://meet.jit.si';
        const jitsiUrl = `${jitsiServerUrl}/${roomName}`;

        return NextResponse.json({
          success: true,
          sessionData: {
            id: bookingSession.id,
            roomName,
            jitsiUrl,
            studentName: `${bookingSession.student.firstName ?? ''} ${bookingSession.student.lastName ?? ''}`.trim(),
            coachName: `${bookingSession.coach.firstName ?? ''} ${bookingSession.coach.lastName ?? ''}`.trim(),
            subject: bookingSession.subject,
            scheduledAt: sessionStart,
            duration: bookingSession.duration,
            status: bookingSession.status,
            isHost: session.user.role === 'COACH'
          }
        });

      case 'LEAVE':
        // Marquer la session comme terminée
        await prisma.sessionBooking.update({
          where: { id: sessionId },
          data: { status: SessionStatus.COMPLETED, completedAt: new Date() }
        });

        // TODO: Logique de crédits si nécessaire

        return NextResponse.json({
          success: true,
          message: 'Session completed successfully'
        });

      default:
        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Erreur lors de la gestion de la session vidéo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
