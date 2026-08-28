/**
 * GET /api/aria/curriculum — carte scolaire dérivée + état de support ARIA.
 *
 * ── Sécurité (§28) ───────────────────────────────────────────────────────────
 *  • ELEVE authentifié uniquement ; élève résolu par `session.user.id`.
 *  • Aucun `studentId` accepté depuis la requête.
 *
 * ── Projection sûre (§13) ────────────────────────────────────────────────────
 * La réponse ne contient AUCUN chemin filesystem et AUCUN contenu de programme :
 * la provenance est symbolique (`COMPILED_SKILL_GRAPH`, `RAG_CAPABILITY`, …) et
 * les graphes ne sont exposés que sous forme de compteurs.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { getUserEntitlements } from '@/lib/entitlement';
import { serializeError } from '@/lib/utils/serialize-error';
import { resolveAriaCurriculum } from '@/lib/aria/curriculum/resolver';
import { getSkillGraphSummary } from '@/lib/aria/curriculum/skill-graph';
import { getAriaLearningProfile } from '@/lib/aria/profile/service';

export async function GET() {
  const sessionOrError = await requireRole(UserRole.ELEVE);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  try {
    const student = await prisma.student.findUnique({
      where: { userId: sessionOrError.user.id },
      select: {
        id: true,
        gradeLevel: true,
        academicTrack: true,
        specialties: true,
        stmgPathway: true,
        school: true,
      },
    });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const [profile, entitlements] = await Promise.all([
      getAriaLearningProfile(student.id),
      getUserEntitlements(sessionOrError.user.id).catch(() => []),
    ]);

    const curriculum = resolveAriaCurriculum({
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      specialties: student.specialties,
      stmgPathway: student.stmgPathway,
      school: student.school,
      selectedCourseKeys: profile.selectedCourseKeys,
      entitlements: entitlements.flatMap((entitlement) => entitlement.features),
    });

    // Résumés de graphes limités aux cours réellement présents dans la carte.
    const skillGraphs = curriculum.courses
      .filter((view) => view.course.hasSkillGraph)
      .map((view) => getSkillGraphSummary(view.course.key));

    return NextResponse.json(
      { ...curriculum, skillGraphs },
      { headers: { 'Cache-Control': 'private, max-age=10' } },
    );
  } catch (error) {
    console.error('[aria/curriculum] GET failed', serializeError(error));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
