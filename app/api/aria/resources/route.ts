export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isKnownCourseKey } from '@/lib/curriculum/catalog';
import { listResourcesForCourse } from '@/lib/aria/resources';
import { resolveAriaCourseAccess } from '@/lib/aria/access';

export async function GET(request: NextRequest) {
  try {
    let session: import('next-auth').Session | null = null;
    try {
      session = await auth();
    } catch {
      // Standalone mode auth fallback
    }

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseKey = searchParams.get('courseKey');

    if (!courseKey || !isKnownCourseKey(courseKey)) {
      return NextResponse.json({ error: 'Clé de cours manquante ou inconnue' }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        academicEnrollments: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Profil élève introuvable' }, { status: 404 });
    }

    const access = resolveAriaCourseAccess({
      courseKey,
      student,
    });

    if (!access.academicallyRelevant) {
      return NextResponse.json(
        { error: 'Ce cours ne fait pas partie de votre scolarité' },
        { status: 403 }
      );
    }

    const resources = listResourcesForCourse(courseKey);
    return NextResponse.json({ resources });
  } catch {
    return NextResponse.json(
      { error: 'Erreur interne lors de la récupération des ressources' },
      { status: 500 }
    );
  }
}
