/**
 * Enregistrement de la dernière activité de l'étudiant sur son dossier.
 *
 * C'est cette date, et elle seule, que la conservation mesure : douze mois
 * après, les données sont anonymisées. Elle doit donc refléter un **usage
 * réel** — l'étudiant est revenu, a répondu, a consulté — et jamais une
 * écriture technique. `updatedAt` ne pouvait pas convenir : une migration le
 * déplace, et l'effacement se serait mis à suivre la maintenance plutôt que la
 * personne.
 *
 * Le geste est **délibérément explicite** à chaque point d'appel plutôt
 * qu'automatique : c'est en décidant, cas par cas, ce qui compte comme une
 * activité qu'on garde la mesure honnête.
 */

/** Interactions comptant comme une activité réelle de l'étudiant. */
export type StudentActivity =
  /** Ouverture du dossier par l'étudiant. */
  | 'DOSSIER_CONSULTE'
  /** Enregistrement ou soumission d'un module. */
  | 'MODULE_RENSEIGNE'
  /** Dépôt d'un document. */
  | 'DOCUMENT_DEPOSE'
  /** Consultation de ses résultats. */
  | 'RESULTATS_CONSULTES'
  /** Soumission du dossier complet. */
  | 'DOSSIER_SOUMIS';

export type ActivityRecorder = Readonly<{
  touch(input: Readonly<{ diagnosticId: string; at: Date }>): Promise<void>;
}>;

/**
 * Enregistre une activité. Ne lève jamais : une interaction réelle ne doit pas
 * échouer parce que l'horodatage de conservation n'a pas pu être écrit. Une
 * date manquante repousse la purge, ce qui est le sens sûr de l'erreur.
 */
export async function recordStudentActivity(
  recorder: ActivityRecorder,
  input: Readonly<{ diagnosticId: string; activity: StudentActivity; at?: Date }>,
): Promise<void> {
  try {
    await recorder.touch({ diagnosticId: input.diagnosticId, at: input.at ?? new Date() });
  } catch {
    // Silencieux à dessein : perdre un horodatage retarde une purge, alors
    // qu'interrompre l'interaction pénaliserait l'étudiant pour rien.
  }
}

/** Activités déclenchées par l'étudiant seul — le parent n'en produit aucune. */
export const STUDENT_ONLY_ACTIVITIES: readonly StudentActivity[] = Object.freeze([
  'DOSSIER_CONSULTE',
  'MODULE_RENSEIGNE',
  'DOCUMENT_DEPOSE',
  'RESULTATS_CONSULTES',
  'DOSSIER_SOUMIS',
]);
