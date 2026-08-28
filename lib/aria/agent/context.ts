/**
 * ARIA Agent Context Builder (SQUELETTE P0).
 *
 * Assemble un `AriaStudentContext` à partir du payload cockpit DÉJÀ construit.
 *
 * ── Ce que ce module NE fait PAS, volontairement ─────────────────────────────
 *  • aucun appel à OpenAI ni à un quelconque fournisseur LLM ;
 *  • aucune écriture en base ;
 *  • aucune requête Prisma (tout vient du cockpit déjà assemblé) ;
 *  • aucune génération de réponse.
 *
 * C'est une fonction PURE. Elle prépare le terrain pour P1.
 */

import type { AriaCockpitDTO, AriaCompetency, AriaCourseKey } from '@/lib/aria/contracts';
import type { AriaStudentContext } from './contracts';

export interface BuildAriaStudentContextInput {
  readonly cockpit: AriaCockpitDTO;
  /** Cours ouvert par l'élève, si applicable. */
  readonly courseKey?: AriaCourseKey | null;
  /** Compétence ciblée, si l'élève en a sélectionné une. */
  readonly competency?: AriaCompetency | null;
}

/**
 * Construit le contexte élève destiné à l'agent P1.
 *
 * Le cours et la compétence sont résolus à l'intérieur du cockpit déjà calculé :
 * une clé inconnue ou non applicable produit `null`, jamais une exception ni un
 * cours fabriqué.
 */
export function buildAriaStudentContext(
  input: BuildAriaStudentContextInput,
): AriaStudentContext {
  const { cockpit } = input;

  const courseView = input.courseKey
    ? (cockpit.curriculum.courses.find((view) => view.course.key === input.courseKey) ?? null)
    : null;

  const resources = courseView
    ? cockpit.resources.filter((resource) => resource.courseKeys.includes(courseView.course.key))
    : cockpit.resources;

  const recentAssessments = cockpit.assessments.filter(
    (assessment) => assessment.state !== 'A_FAIRE',
  );

  return {
    studentProfile: {
      gradeLevel: cockpit.curriculum.academicProfile.gradeLevel,
      academicTrack: cockpit.curriculum.academicProfile.academicTrack,
      specialties: cockpit.curriculum.academicProfile.specialties,
      stmgPathway: cockpit.curriculum.academicProfile.stmgPathway,
      weeklyGoalMinutes: cockpit.profile.weeklyGoalMinutes,
      learningGoals: cockpit.profile.learningGoals,
    },
    course: courseView?.course ?? null,
    selectedCompetency: normaliseCompetency(input.competency ?? null),
    trajectory: cockpit.trajectory,
    todayPlan: cockpit.today,
    resources,
    recentAssessments,
    nextSession: cockpit.nextSession,
  };
}

function normaliseCompetency(competency: AriaCompetency | null): AriaCompetency | null {
  return competency ?? null;
}
