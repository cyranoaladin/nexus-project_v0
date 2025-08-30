import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { SessionStatus } from '@prisma/client';

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

    // Vérifier que la session existe et que l'utilisateur y a accès
    const bookingSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [
          { student: { userId: session.user.id } },
          { coach: { userId: session.user.id } },
        ],
      },
      include: {
        student: { include: { user: true } },
        coach: { include: { user: true } },
      },
    });

    if (!bookingSession) {
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    // Vérifier que la session est proche de l'horaire prévu ou déjà en cours
    const now = new Date();
    const sessionStart = new Date(bookingSession.scheduledAt);
    const timeDifference = Math.abs(now.getTime() - sessionStart.getTime());
    const fifteenMinutes = 15 * 60 * 1000;

    if (timeDifference > fifteenMinutes && bookingSession.status !== SessionStatus.IN_PROGRESS) {
      return NextResponse.json({ error: "La session n'est pas encore disponible ou a expiré" }, { status: 400 });
    }

    switch (action) {
      case 'JOIN': {
        // Marquer la session comme en cours si elle ne l'est pas déjà
        if (bookingSession.status === SessionStatus.SCHEDULED) {
          await prisma.session.update({
            where: { id: sessionId },
            data: { status: SessionStatus.IN_PROGRESS },
          });
        }

        // Générer les informations de la room Jitsi
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
            studentName: `${bookingSession.student.user.firstName} ${bookingSession.student.user.lastName}`,
            coachName: `${bookingSession.coach.user.firstName} ${bookingSession.coach.user.lastName}`,
            subject: bookingSession.subject,
            scheduledAt: bookingSession.scheduledAt,
            duration: bookingSession.duration,
            status: SessionStatus.IN_PROGRESS,
            isHost: session.user.role === 'COACH',
          },
        });
      }
      case 'LEAVE': {
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: SessionStatus.COMPLETED },
        });
        return NextResponse.json({ success: true, message: 'Session terminée avec succès' });
      }
      default:
        return NextResponse.json({ error: 'Action non supportée' }, { status: 400 });
    }
  } catch (error) {
    console.error('Erreur lors de la gestion de la session vidéo:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
