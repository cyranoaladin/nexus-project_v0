export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolveStudentAriaCourses } from '@/lib/aria/access';
import { ensureDefaultProfile } from '@/lib/aria/profile/service';

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

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        academicEnrollments: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Profil élève introuvable' }, { status: 404 });
    }

    // Récupération ou initialisation du profil ARIA
    const profile = await ensureDefaultProfile(student);

    // Extraction des entitlements de l'abonnement
    const activeSub = student.subscriptions[0];
    let ariaSubjects: string[] = [];
    if (activeSub?.ariaSubjects) {
      if (Array.isArray(activeSub.ariaSubjects)) {
        ariaSubjects = activeSub.ariaSubjects as string[];
      } else if (typeof activeSub.ariaSubjects === 'string') {
        try {
          ariaSubjects = JSON.parse(activeSub.ariaSubjects);
        } catch {
          ariaSubjects = [activeSub.ariaSubjects];
        }
      }
    }

    const courses = resolveStudentAriaCourses({
      student,
      selectedCourseKeys: profile.selectedCourseKeys,
      entitlements: {
        ariaSubjects,
        hasGlobalAriaAccess: ariaSubjects.includes('ALL'),
      },
    });

    return NextResponse.json({ courses, profile });
  } catch {
    return NextResponse.json(
      { error: 'Erreur interne lors de la résolution du curriculum ARIA' },
      { status: 500 }
    );
  }
}
