export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { upsertLearningProfile, ensureDefaultProfile } from '@/lib/aria/profile/service';

// Invariant ARIA_WRITE_SCHEMAS_STRICT=PASS : schéma strict et typé
const uiPreferencesSchema = z
  .object({
    theme: z.enum(['dark', 'light', 'system']).optional(),
    showCitations: z.boolean().optional(),
    autoScroll: z.boolean().optional(),
    fontSize: z.enum(['sm', 'base', 'lg']).optional(),
    compactMode: z.boolean().optional(),
  })
  .strict();

const updateProfileSchema = z
  .object({
    selectedCourseKeys: z.array(z.string().min(1)).optional(),
    uiPreferences: uiPreferencesSchema.optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  try {
    let session: import('next-auth').Session | null = null;
    try {
      session = await auth();
    } catch {
      // Standalone mode auth fallback
    }

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        academicEnrollments: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Profil élève introuvable', code: 'NOT_FOUND' }, { status: 404 });
    }

    const profile = await ensureDefaultProfile(student);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du profil ARIA', code: 'INTERNAL_ERROR' },
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
      return NextResponse.json({ error: 'Accès non autorisé', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        academicEnrollments: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Profil élève introuvable', code: 'NOT_FOUND' }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateProfileSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Données de profil invalides', code: 'BAD_REQUEST', details: validated.error.format() },
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
    return NextResponse.json({ error: message, code: 'BAD_REQUEST' }, { status: 400 });
  }
}
