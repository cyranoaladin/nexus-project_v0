import type { GradeLevel } from '@prisma/client';

/**
 * Hiérarchie des correspondances de foyer, côté saisie papier.
 *
 * Le défaut corrigé : la suggestion « ce foyer existe peut-être » se déclenchait
 * sur le seul nom du parent et présentait le rattachement au même niveau que la
 * création — une assistante qui enchaîne les saisies rattachait par réflexe
 * l'enfant d'une famille au compte d'une autre famille homonyme, envoyant le
 * bilan chez le mauvais parent.
 *
 * On distingue désormais trois forces de signal :
 *   - PHONE          : téléphone normalisé identique — la clé de contact réelle
 *                      du foyer. Le rattachement est légitime, proposé en premier.
 *   - NAME_AND_LEVEL : mêmes nom et prénom du parent, téléphone différent, ET un
 *                      enfant existant partage un niveau avec un enfant saisi —
 *                      homonymie avec coïncidence, à qualifier explicitement.
 *   - NAME_ONLY      : mêmes nom et prénom du parent, téléphone différent, aucune
 *                      coïncidence de niveau — homonymie probable.
 *
 * Seul PHONE autorise un rattachement d'un simple clic ; tout signal fondé sur
 * le nom exige une confirmation délibérée supplémentaire (cf.
 * `attachRequiresConfirmation`). Le chemin le plus facile reste le plus sûr :
 * la création d'un nouveau foyer.
 */

export type HouseholdMatchStrength = 'PHONE' | 'NAME_AND_LEVEL' | 'NAME_ONLY';

/**
 * Clé de comparaison d'un nom de personne, insensible à la casse, aux accents,
 * aux espaces multiples et aux séparateurs de noms composés (trait d'union,
 * apostrophe droite ou typographique). « Bénard », « BENARD », « be-nard » et
 * « Bénard » collent à la même clé. Une chaîne vide reste vide.
 */
export function normalizeNameKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deux noms de parent correspondent quand leurs prénoms ET leurs noms partagent
 * la même clé normalisée. Jamais une concaténation approximative : chaque champ
 * est comparé séparément, pour qu'« Ali Ben » + « Salah » ne colle pas à « Ali »
 * + « Ben Salah ».
 */
export function parentNamesMatch(
  a: Readonly<{ firstName: string; lastName: string }>,
  b: Readonly<{ firstName: string; lastName: string }>,
): boolean {
  const firstA = normalizeNameKey(a.firstName);
  const lastA = normalizeNameKey(a.lastName);
  if (firstA === '' || lastA === '') return false;
  return firstA === normalizeNameKey(b.firstName) && lastA === normalizeNameKey(b.lastName);
}

export type HouseholdMatchInput = Readonly<{
  parentFirstName: string;
  parentLastName: string;
  phoneNormalized: string;
  childLevels: readonly GradeLevel[];
}>;

export type HouseholdCandidateFacts = Readonly<{
  parentFirstName: string | null;
  parentLastName: string | null;
  /** Téléphone normalisé du compte cible, ou d'un compte source fusionné. */
  phoneNormalized: string | null;
  mergedSourcePhonesNormalized: readonly string[];
  childLevels: readonly GradeLevel[];
}>;

/**
 * Qualifie la force du signal entre le foyer saisi et un foyer candidat, ou
 * `null` si aucun signal ne les relie (le candidat ne devrait alors pas être
 * proposé). Le téléphone prime : un numéro identique classe en PHONE quelles
 * que soient les autres coïncidences.
 */
export function classifyHouseholdMatch(
  input: HouseholdMatchInput,
  candidate: HouseholdCandidateFacts,
): HouseholdMatchStrength | null {
  const phoneMatches = input.phoneNormalized !== ''
    && (candidate.phoneNormalized === input.phoneNormalized
      || candidate.mergedSourcePhonesNormalized.includes(input.phoneNormalized));
  if (phoneMatches) return 'PHONE';

  const nameMatches = candidate.parentFirstName !== null
    && candidate.parentLastName !== null
    && parentNamesMatch(
      { firstName: input.parentFirstName, lastName: input.parentLastName },
      { firstName: candidate.parentFirstName, lastName: candidate.parentLastName },
    );
  if (!nameMatches) return null;

  const enteredLevels = new Set(input.childLevels);
  const levelOverlap = candidate.childLevels.some((level) => enteredLevels.has(level));
  return levelOverlap ? 'NAME_AND_LEVEL' : 'NAME_ONLY';
}

/**
 * Ordre de présentation : le signal fort d'abord, l'homonymie ensuite. Deux
 * candidats de même force gardent leur ordre d'arrivée (tri stable).
 */
const STRENGTH_RANK: Readonly<Record<HouseholdMatchStrength, number>> = {
  PHONE: 0,
  NAME_AND_LEVEL: 1,
  NAME_ONLY: 2,
};

export function compareByStrength(a: HouseholdMatchStrength, b: HouseholdMatchStrength): number {
  return STRENGTH_RANK[a] - STRENGTH_RANK[b];
}

/**
 * Le rattachement délibéré : seul le signal fort (téléphone identique) peut être
 * accepté d'un clic. Toute correspondance fondée sur le nom exige une
 * confirmation explicite supplémentaire — c'est ce qui empêche le rattachement
 * réflexe entre familles homonymes.
 */
export function attachRequiresConfirmation(strength: HouseholdMatchStrength): boolean {
  return strength !== 'PHONE';
}
