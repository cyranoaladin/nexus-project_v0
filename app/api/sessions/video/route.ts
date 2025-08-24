import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// Removed import of SessionStatus due to lint error
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
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
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch {
      return NextResponse.json({ error: 'Requête invalide: JSON mal formé.' }, { status: 400 });
    }
    const { sessionId, action } = parsed;

    if (!sessionId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Vérifier que la session existe et que l'utilisateur y a accès
    const bookingSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [
          { studentId: session.user.id },
          { coachId: session.user.id }
        ]
      },
      include: {
        student: {
          include: {
            user: true
          }
        },
        coach: {
          include: {  
            user: true
          }
        }
      }
    });

    if (!bookingSession) {
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    // Vérifier que la session est programmée pour maintenant ou dans le passé récent
    const now = new Date();
    const sessionStart = new Date(bookingSession.scheduledAt);
    const timeDifference = Math.abs(now.getTime() - sessionStart.getTime());
    const fifteenMinutes = 15 * 60 * 1000;

    if (timeDifference > fifteenMinutes && bookingSession.status !== "SCHEDULED") {
      return NextResponse.json({
        error: 'La session n\'est pas encore disponible ou a expiré'
      }, { status: 400 });
    }

    switch (action) {
      case 'JOIN':
        // Marquer la session comme en cours si elle ne l'est pas déjà
        if (bookingSession.status === "SCHEDULED") {
          await prisma.session.update({
            where: { id: sessionId },
            data: {
              status: "SCHEDULED" // Garder SCHEDULED car il n'y a pas IN_PROGRESS
            }
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
            studentName: `${bookingSession.student.user.firstName} ${bookingSession.student.user.lastName}`,
            coachName: `${bookingSession.coach.user.firstName} ${bookingSession.coach.user.lastName}`,
            subject: bookingSession.subject,
            scheduledAt: bookingSession.scheduledAt,
            duration: bookingSession.duration,
            status: "SCHEDULED",
            isHost: session.user.role === 'COACH'
          }
        });

      case 'LEAVE':
        // Marquer la session comme terminée
        await prisma.session.update({
          where: { id: sessionId },
          data: {
              status: "COMPLETED"
          }
        });

        // TODO: Logique de crédits si nécessaire

        return NextResponse.json({
          success: true,
          message: 'Session terminée avec succès'
        });

      default:
        return NextResponse.json({ error: 'Action non supportée' }, { status: 400 });
    }

  } catch (error) {
    console.error('Erreur lors de la gestion de la session vidéo:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
