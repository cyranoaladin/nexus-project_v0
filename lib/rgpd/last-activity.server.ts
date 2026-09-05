import 'server-only';

import { prisma } from '@/lib/prisma';

import { recordStudentActivity, type ActivityRecorder, type StudentActivity } from './last-activity';

/**
 * Enregistrement de l'activité, adossé à la base.
 *
 * Séparé de la logique pure pour rester testable sans base, et pour que le
 * point d'appel applicatif reste une décision explicite.
 */
const recorder: ActivityRecorder = {
  touch: async ({ diagnosticId, at }) => {
    await prisma.candidateDiagnostic.update({
      where: { id: diagnosticId },
      data: { lastActivityAt: at },
    });
  },
};

/**
 * Note une activité de l'étudiant sur son dossier.
 *
 * **N'enregistre rien pour un autre acteur.** Le parent, le coach ou une tâche
 * technique n'ont pas à repousser l'échéance de conservation : celle-ci mesure
 * l'usage que l'étudiant fait de ses propres données, et lui seul. Une
 * consultation par un tiers prolongerait indéfiniment la rétention sans que
 * l'intéressé y soit pour quelque chose.
 */
export async function noteStudentActivity(input: Readonly<{
  diagnosticId: string;
  activity: StudentActivity;
  actorRole: string;
}>): Promise<void> {
  if (input.actorRole !== 'ELEVE') return;
  await recordStudentActivity(recorder, {
    diagnosticId: input.diagnosticId,
    activity: input.activity,
  });
}
