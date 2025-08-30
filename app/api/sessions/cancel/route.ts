import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { refundCredits } from '@/lib/credits';
import { z } from 'zod';

const cancelSessionSchema = z.object({
  sessionId: z.string(),
  reason: z.string().optional(),
});

function combineDateTime(date: Date, time: string): Date {
  const dateStr = date.toISOString().split('T')[0];
  return new Date(`${dateStr}T${time}`);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !['ELEVE', 'COACH', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, reason } = cancelSessionSchema.parse(body);

    // Try SessionBooking first
    const booking = await prisma.sessionBooking.findUnique({ where: { id: sessionId } });
    if (booking) {
      // Permissions: if student, must be their booking
      if (session.user.role === 'ELEVE' && booking.studentId !== session.user.id) {
        return NextResponse.json({ error: 'Accès non autorisé à cette session' }, { status: 403 });
      }

      // Cancellation window
      const now = new Date();
      const scheduledDateTime = combineDateTime(booking.scheduledDate, booking.startTime);
      const hoursUntil = (scheduledDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      let canRefund = false;
      if (booking.type === 'GROUP' || booking.type === 'MASTERCLASS') canRefund = hoursUntil >= 48;
      else canRefund = hoursUntil >= 24;
      if (session.user.role === 'ASSISTANTE') canRefund = true;

      // Cancel booking
      await prisma.sessionBooking.update({
        where: { id: sessionId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          coachNotes: reason ? `Annulée: ${reason}` : (booking.coachNotes || undefined),
        },
      });

      if (canRefund) {
        await refundCredits(
          booking.studentId,
          booking.creditsUsed,
          booking.id,
          `Remboursement annulation: ${booking.title}`
        );
      }

      return NextResponse.json({
        success: true,
        refunded: canRefund,
        message: canRefund
          ? 'Session annulée et crédits remboursés'
          : 'Session annulée (pas de remboursement - délai dépassé)',
        model: 'SessionBooking',
      });
    }

    // Fallback to legacy Session
    const sessionToCancel = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { student: true },
    });

    if (!sessionToCancel) {
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    if (session.user.role === 'ELEVE') {
      const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
      if (!student || student.id !== sessionToCancel.studentId) {
        return NextResponse.json({ error: 'Accès non autorisé à cette session' }, { status: 403 });
      }
    }

    const now = new Date();
    const sessionDate = new Date(sessionToCancel.scheduledAt);
    const hoursUntilSession = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    let canRefund = false;
    if (sessionToCancel.type === 'COURS_ONLINE' || sessionToCancel.type === 'COURS_PRESENTIEL') {
      canRefund = hoursUntilSession >= 24;
    } else if (sessionToCancel.type === 'ATELIER_GROUPE') {
      canRefund = hoursUntilSession >= 48;
    }
    if (session.user.role === 'ASSISTANTE') {
      canRefund = true;
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED',
        report: reason ? `Annulée: ${reason}` : 'Annulée',
      },
    });

    if (canRefund) {
      await refundCredits(
        sessionToCancel.studentId,
        sessionToCancel.creditCost,
        sessionId,
        `Remboursement annulation: ${sessionToCancel.title}`
      );
    }

    return NextResponse.json({
      success: true,
      refunded: canRefund,
      message: canRefund
        ? 'Session annulée et crédits remboursés'
        : 'Session annulée (pas de remboursement - délai dépassé)',
      model: 'Session',
    });
  } catch (error) {
    console.error('Erreur annulation session:', error);

    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
