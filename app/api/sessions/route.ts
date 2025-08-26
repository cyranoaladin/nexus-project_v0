export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/sessions?role=assistant
// Retourne une liste de sessions pour l'assistante, adaptées au composant SessionManagement
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const takeParam = url.searchParams.get('take');
    const take = Math.min(Math.max(parseInt(takeParam || '100', 10) || 100, 1), 200);

    const sessions = await prisma.session.findMany({
      orderBy: { scheduledAt: 'desc' },
      take,
      include: {
        student: {
          include: {
            user: true,
            parent: { include: { user: true } },
          },
        },
        coach: { include: { user: true } },
      },
    });

    const mapType = (t: string) => {
      // ServiceType -> SessionType attendu par l'UI
      if (t === 'ATELIER_GROUPE') return 'GROUP';
      return 'INDIVIDUAL';
    };

    const mapModality = (t: string) => {
      if (t === 'COURS_PRESENTIEL') return 'IN_PERSON';
      if (t === 'COURS_ONLINE') return 'ONLINE';
      return 'HYBRID';
    };

    const toHHMM = (date: Date) => {
      const d = new Date(date);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    };

    const addMinutes = (date: Date, minutes: number) => {
      const d = new Date(date);
      d.setMinutes(d.getMinutes() + (minutes || 0));
      return d;
    };

    const apiSessions = sessions.map((s) => {
      const start = s.scheduledAt;
      const end = addMinutes(start, s.duration);
      return {
        id: s.id,
        title: s.title,
        subject: s.subject,
        scheduledDate: s.scheduledAt,
        startTime: toHHMM(start),
        endTime: toHHMM(end),
        duration: s.duration,
        status: s.status,
        type: mapType(s.type),
        modality: mapModality(s.type),
        student: {
          id: s.student.id,
          firstName: s.student.user.firstName || '',
          lastName: s.student.user.lastName || '',
          grade: s.student.grade || '',
        },
        coach: {
          id: s.coach.id,
          firstName: s.coach.user.firstName || '',
          lastName: s.coach.user.lastName || '',
          pseudonym: s.coach.pseudonym,
        },
        parent: s.student.parent
          ? {
              id: s.student.parent.id,
              firstName: s.student.parent.user.firstName || '',
              lastName: s.student.parent.user.lastName || '',
            }
          : undefined,
        creditsUsed: Math.max(0, Math.round(Number(s.creditCost) || 0)),
        coachNotes: s.report || undefined,
        studentNotes: undefined,
        rating: undefined,
        createdAt: s.createdAt,
      };
    });

    return NextResponse.json({ sessions: apiSessions });
  } catch (error) {
    console.error('GET /api/sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
