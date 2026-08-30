export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { buildAriaCockpitPayload } from '@/lib/aria/cockpit/builder';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    let session: import('next-auth').Session | null = null;
    try {
      session = await auth();
    } catch {
      // Ignorer les erreurs d'hôte non fiable
    }

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        academicEnrollments: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Profil élève introuvable' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const requestedCourseKey = searchParams.get('courseKey');

    const payload = await buildAriaCockpitPayload({
      student,
      requestedCourseKey,
    });

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors de la construction du cockpit ARIA' },
      { status: 500 }
    );
  }
}
