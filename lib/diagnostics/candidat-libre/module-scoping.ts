import { CANDIDATE_DIAGNOSTIC_MODULES } from './definition.public';

/**
 * Portée des modules exigés pour un dossier candidat libre.
 *
 * Le questionnaire parent recueille l'avis du titulaire de l'autorité
 * parentale. Pour un étudiant majeur, cette autorité n'existe pas : l'exiger
 * bloquerait son dossier sur une pièce sans objet, et solliciterait un tiers
 * qui n'a aucun rôle légal ici.
 *
 * Le reste demeure exigé. Un candidat libre passe le baccalauréat complet :
 * ses spécialités ne sont pas la totalité de ses épreuves, et les modules
 * académiques le concernent tous. Une sélection de matières par dossier — utile
 * à d'autres profils, partiels — reste une évolution produit distincte.
 */

/** Module dont l'objet disparaît lorsque l'étudiant est majeur. */
const PARENTAL_AUTHORITY_MODULE = 'questionnaire-parent';

const LEGAL_AGE_YEARS = 18;

/**
 * L'étudiant est-il majeur à cette date ?
 *
 * **Échoue fermé** : sans date de naissance connue, on ne présume pas la
 * majorité — le questionnaire parent reste alors exigé.
 */
export function isStudentAdultAt(birthDate: Date | null | undefined, now: Date): boolean {
  if (!birthDate) return false;
  // Comparaison de dates civiles, pas d'instants : les accesseurs UTC évitent
  // qu'un décalage de fuseau fasse basculer la majorité d'un jour.
  const eighteenth = new Date(birthDate);
  eighteenth.setUTCFullYear(eighteenth.getUTCFullYear() + LEGAL_AGE_YEARS);
  return eighteenth.getTime() <= now.getTime();
}

/** Modules dont l'achèvement conditionne la soumission du dossier. */
export function requiredModuleKeysForDossier(
  context: Readonly<{ studentIsAdult: boolean }>,
): readonly string[] {
  return CANDIDATE_DIAGNOSTIC_MODULES
    .filter((module) => module.requiredForSubmission)
    .filter((module) => !(context.studentIsAdult && module.key === PARENTAL_AUTHORITY_MODULE))
    .map((module) => module.key);
}
