export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { upsertLearningProfile, ensureDefaultProfile } from '@/lib/aria/profile/service';

const updateProfileSchema = z.object({
  selectedCourseKeys: z.array(z.string().min(1)).optional(),
  uiPreferences: z.record(z.unknown()).optional(),
});

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
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Profil élève introuvable' }, { status: 404 });
    }

    const profile = await ensureDefaultProfile(student);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du profil ARIA' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Profil élève introuvable' }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateProfileSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Données de profil invalides', details: validated.error.format() },
        { status: 400 }
      );
    }

    const updated = await upsertLearningProfile(
      student.id,
      validated.data,
      student
    );

    return NextResponse.json({ profile: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur lors de la mise à jour du profil';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
