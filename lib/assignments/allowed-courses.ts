/**
 * Périmètre de cours assignable à un coach — dérivation pure, sans accès base.
 *
 * `CoachStudentAssignment.subjects` (matière générique historique) ne dit
 * jamais, à lui seul, QUEL cours du catalogue un coach suit réellement avec
 * un élève : une même matière (ex. MATHEMATIQUES) peut recouvrir plusieurs
 * enseignements simultanément suivis (tronc commun ET spécialité en
 * Première). Ce module calcule l'ensemble des `courseKey` compatibles avec
 * une matière historique donnée, et ne choisit JAMAIS à la place d'un humain
 * quand ce calcul est ambigu ou vide.
 *
 * Algorithme (une matière) :
 *   candidats = coursSuivisParÉlève ∩ coursDeCetteMatière ∩ coursQueLeCoachSaitEnseigner
 *
 * Capacité coach : `CoachProfile.subjects` est un tableau JSON de `Subject`
 * (matière générique — voir `lib/utils/subjects.ts:parseSubjects`). Le
 * catalogue n'exprime la capacité qu'à cette même granularité via
 * `CourseRecord.legacySubject` : aucun champ dédié « courseKey enseignables »
 * n'existe sur `CoachProfile`. La capacité effective sur un `courseKey` se
 * réduit donc à « le coach déclare la matière générique de ce cours » —
 * c'est la seule lecture cohérente des données existantes, reprise ici
 * plutôt que réinventée (voir aussi la même réduction dans
 * `scripts/aria/backfill-entitlements.ts:courseIsAriaCapable`-adjacent code,
 * qui filtre déjà les cours suivis par `legacySubject`).
 */

import type { Subject } from '@prisma/client';
import { listCourses } from '@/lib/curriculum/catalog';
import type { StudentCourseView } from '@/lib/curriculum/enrollment';

/**
 * Cours du catalogue qu'un coach est capable d'enseigner, projetés depuis les
 * matières génériques qu'il déclare. Un cours dont `legacySubject` est `null`
 * n'a aucune matière générique représentative : aucun coach ne peut y être
 * rattaché par cette voie.
 */
export function coachCapableCourseKeys(coachSubjects: readonly string[]): ReadonlySet<string> {
  const declared = new Set(coachSubjects);
  const keys = new Set<string>();
  for (const course of listCourses()) {
    if (course.legacySubject !== null && declared.has(course.legacySubject)) {
      keys.add(course.courseKey);
    }
  }
  return keys;
}

export interface AllowedCourseKeysInput {
  /** Cours réellement suivis par l'élève (ENROLLED ou DERIVED — jamais NOT_ENROLLED). */
  readonly followedCourses: readonly StudentCourseView[];
  /** Matière historique portée par l'assignation. */
  readonly subject: Subject;
  /** Matières génériques déclarées par le coach (`parseSubjects(coach.subjects)`). */
  readonly coachSubjects: readonly string[];
}

/**
 * Clés de cours candidates pour UNE matière historique : intersection des
 * cours suivis par l'élève, des cours de cette matière, et des cours que le
 * coach sait enseigner. Triée pour un résultat stable et testable.
 */
export function allowedCourseKeysForSubject(input: AllowedCourseKeysInput): readonly string[] {
  const capable = coachCapableCourseKeys(input.coachSubjects);
  const keys = new Set<string>();
  for (const view of input.followedCourses) {
    if (view.course.legacySubject !== input.subject) continue;
    if (!capable.has(view.course.courseKey)) continue;
    keys.add(view.course.courseKey);
  }
  return [...keys].sort();
}

export type CourseScopeClassification =
  | Readonly<{ readonly state: 'BACKFILL_AUTO'; readonly courseKey: string }>
  | Readonly<{ readonly state: 'BACKFILL_UNRESOLVED' }>
  | Readonly<{ readonly state: 'BACKFILL_AMBIGUOUS'; readonly candidateCourseKeys: readonly string[] }>;

/**
 * Classe une liste de candidats pour une matière : jamais de choix arbitraire
 * en cas de zéro ou plusieurs candidats.
 */
export function classifyCandidates(candidates: readonly string[]): CourseScopeClassification {
  if (candidates.length === 0) return { state: 'BACKFILL_UNRESOLVED' };
  if (candidates.length === 1) return { state: 'BACKFILL_AUTO', courseKey: candidates[0]! };
  return { state: 'BACKFILL_AMBIGUOUS', candidateCourseKeys: candidates };
}

/** État dérivé d'un backfill — distinct de l'enum Prisma `AssignmentCourseScopeState`, qui porte en plus `STAFF_VERIFIED` (jamais calculé ici). */
export type DerivedCourseScopeState = 'BACKFILL_AUTO' | 'BACKFILL_UNRESOLVED' | 'BACKFILL_AMBIGUOUS';

export interface AssignmentCourseScopeInput {
  /** Matières historiques portées par l'assignation (`CoachStudentAssignment.subjects`). */
  readonly subjects: readonly Subject[];
  readonly followedCourses: readonly StudentCourseView[];
  readonly coachSubjects: readonly string[];
}

export interface AssignmentCourseScopeResult {
  readonly state: DerivedCourseScopeState;
  readonly academicCourseKeys: readonly string[];
  /** Classification individuelle par matière, pour diagnostic/rapport. */
  readonly bySubject: ReadonlyMap<Subject, CourseScopeClassification>;
}

/**
 * Combine les classifications par matière historique en UN état
 * d'assignation.
 *
 * Une assignation peut porter plusieurs `Subject` historiques (ex.
 * MATHEMATIQUES + NSI sur un coach polyvalent). Règle de combinaison : le pire
 * cas l'emporte — AMBIGUOUS > UNRESOLVED > AUTO — et `academicCourseKeys`
 * n'est rempli QUE quand TOUTES les matières sont résolues sans ambiguïté.
 * Écrire les clés des seules matières propres alors qu'une autre matière de
 * la même assignation reste floue donnerait une fausse impression de
 * périmètre complet : c'est exactement le genre de devinette que ce backfill
 * s'interdit.
 *
 * Aucune matière historique du tout est traité comme non résolu : une
 * assignation sans `subjects` ne peut porter aucun cours dérivé.
 */
export function classifyAssignmentCourseScope(
  input: AssignmentCourseScopeInput,
): AssignmentCourseScopeResult {
  if (input.subjects.length === 0) {
    return { state: 'BACKFILL_UNRESOLVED', academicCourseKeys: [], bySubject: new Map() };
  }

  const bySubject = new Map<Subject, CourseScopeClassification>();
  for (const subject of input.subjects) {
    const candidates = allowedCourseKeysForSubject({
      followedCourses: input.followedCourses,
      subject,
      coachSubjects: input.coachSubjects,
    });
    bySubject.set(subject, classifyCandidates(candidates));
  }

  const classifications = [...bySubject.values()];
  if (classifications.some((entry) => entry.state === 'BACKFILL_AMBIGUOUS')) {
    return { state: 'BACKFILL_AMBIGUOUS', academicCourseKeys: [], bySubject };
  }
  if (classifications.some((entry) => entry.state === 'BACKFILL_UNRESOLVED')) {
    return { state: 'BACKFILL_UNRESOLVED', academicCourseKeys: [], bySubject };
  }

  const keys = new Set<string>();
  for (const entry of classifications) {
    if (entry.state === 'BACKFILL_AUTO') keys.add(entry.courseKey);
  }
  return { state: 'BACKFILL_AUTO', academicCourseKeys: [...keys].sort(), bySubject };
}
