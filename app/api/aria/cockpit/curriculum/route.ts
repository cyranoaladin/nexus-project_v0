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
import { isErrorResponse, requireRole } from '@/lib/guards';
import { getUserEntitlements } from '@/lib/entitlement';
import { serializeError } from '@/lib/utils/serialize-error';
import { resolveAriaCurriculum } from '@/lib/aria/curriculum/resolver';
import { getCockpitSkillGraphSummary } from '@/lib/aria/cockpit/skill-views';
import { getAriaCockpitProfile } from '@/lib/aria/cockpit/profile-service';
import { resolveLegacySpecialties } from '@/lib/aria/cockpit/legacy-specialties';
import { loadOwnCockpitStudent } from '@/lib/aria/cockpit/student-loader';

export async function GET() {
  const sessionOrError = await requireRole('ELEVE');
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  try {
    const student = await loadOwnCockpitStudent(sessionOrError.user.id);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const [profile, entitlements, specialties] = await Promise.all([
      getAriaCockpitProfile(student.id),
      getUserEntitlements(sessionOrError.user.id).catch(() => []),
      resolveLegacySpecialties(student.id),
    ]);

    const curriculum = resolveAriaCurriculum({
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      specialties,
      stmgPathway: student.stmgPathway,
      school: student.school,
      pinnedCourseKeys: profile.pinnedCourseKeys,
      entitlements: entitlements.flatMap((entitlement) => entitlement.features),
    });

    // Résumés de graphes limités aux cours réellement présents dans la carte.
    const skillGraphs = curriculum.courses
      .filter((view) => view.course.hasSkillGraph)
      .map((view) => getCockpitSkillGraphSummary(view.course.key));

    return NextResponse.json(
      { ...curriculum, skillGraphs },
      { headers: { 'Cache-Control': 'private, max-age=10' } },
    );
  } catch (caught) {
    console.error('[aria/curriculum] GET failed', serializeError(caught));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
