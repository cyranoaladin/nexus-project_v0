/**
 * GET  /api/aria/profile — profil scolaire (lecture) + profil pédagogique ARIA.
 * PUT  /api/aria/profile — met à jour le SEUL profil pédagogique ARIA.
 *
 * ── Sécurité (§28) ───────────────────────────────────────────────────────────
 *  • ELEVE authentifié uniquement (`requireRole`).
 *  • L'élève est résolu EXCLUSIVEMENT par `session.user.id → Student.userId`.
 *    Aucun `studentId` n'est accepté depuis le corps, la query ou l'URL.
 *  • Corps validé par un schéma Zod `.strict()` : toute clé inconnue est rejetée.
 *  • PUT ne peut modifier NI l'abonnement, NI `ariaSubjects`, NI un entitlement,
 *    NI la voie/classe/spécialités de l'élève.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse, type NextRequest } from 'next/server';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { serializeError } from '@/lib/utils/serialize-error';
import { buildAcademicProfile } from '@/lib/aria/curriculum/resolver';
import {
  AriaProfileValidationError,
  ariaProfileUpdateSchema,
  getAriaCockpitProfile,
  upsertAriaCockpitProfile,
} from '@/lib/aria/cockpit/profile-service';
import { resolveLegacySpecialties } from '@/lib/aria/cockpit/legacy-specialties';
import { loadOwnCockpitStudent as loadOwnStudent } from '@/lib/aria/cockpit/student-loader';
import type { AriaSetupState } from '@/lib/aria/cockpit/contracts';

function deriveSetupState(
  academicIncomplete: boolean,
  onboardingCompletedAt: string | null,
  selectedCount: number,
): AriaSetupState {
  if (academicIncomplete) return 'ACADEMIC_PROFILE_INCOMPLETE';
  if (!onboardingCompletedAt) return 'ONBOARDING_REQUIRED';
  if (selectedCount === 0) return 'NO_COURSE_SELECTED';
  return 'READY';
}

export async function GET() {
  const sessionOrError = await requireRole('ELEVE');
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  try {
    const student = await loadOwnStudent(sessionOrError.user.id);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const [ariaProfile, specialties] = await Promise.all([
      getAriaCockpitProfile(student.id),
      resolveLegacySpecialties(student.id),
    ]);
    const academicProfile = buildAcademicProfile({
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      specialties,
      stmgPathway: student.stmgPathway,
      school: student.school,
    });

    return NextResponse.json(
      {
        academicProfile,
        ariaProfile,
        setupState: deriveSetupState(
          academicProfile.incomplete,
          ariaProfile.onboardingCompletedAt,
          ariaProfile.pinnedCourseKeys.length,
        ),
        // Aucune API self-service de modification du profil scolaire n'existe.
        academicProfileReadOnly: true,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (caught) {
    console.error('[aria/profile] GET failed', serializeError(caught));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const sessionOrError = await requireRole('ELEVE');
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ariaProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const student = await loadOwnStudent(sessionOrError.user.id);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const specialties = await resolveLegacySpecialties(student.id);

    const ariaProfile = await upsertAriaCockpitProfile(student.id, parsed.data, {
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      specialties,
      stmgPathway: student.stmgPathway,
    });

    const academicProfile = buildAcademicProfile({
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      specialties,
      stmgPathway: student.stmgPathway,
      school: student.school,
    });

    return NextResponse.json({
      academicProfile,
      ariaProfile,
      setupState: deriveSetupState(
        academicProfile.incomplete,
        ariaProfile.onboardingCompletedAt,
        ariaProfile.pinnedCourseKeys.length,
      ),
      academicProfileReadOnly: true,
    });
  } catch (caught) {
    if (caught instanceof AriaProfileValidationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: { issues: caught.issues } },
        { status: 400 },
      );
    }
    console.error('[aria/profile] PUT failed', serializeError(caught));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
