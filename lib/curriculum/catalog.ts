/**
 * Catalogue canonique des enseignements — chargeur typé et validé.
 *
 * SOURCE DE VÉRITÉ UNIQUE des cours de l'établissement. Aucun composant, aucune
 * route et aucun autre module ne redéfinit sa propre liste d'enseignements.
 *
 * Discipline reprise de `lib/exams/catalog.ts` : la donnée vit dans
 * `data/curriculum/`, elle est validée une fois par un schéma Zod, mise en
 * cache, et une clé inconnue retourne `null` — jamais un repli silencieux.
 */

import { CURRICULUM_REGISTRY } from '@/lib/curriculum/registry';
import type { CurriculumVersion } from '@/lib/curriculum/schemas/curriculum';
import coursesData from '@/data/curriculum/v1/courses.json';
import sourcesData from '@/data/curriculum/v1/sources.json';
import {
  curriculumCoursesFileSchema,
  curriculumSourcesFileSchema,
  type CourseKind,
  type CourseRecord,
  type CurriculumSource,
} from './schema';

export type { CourseKind, CourseRecord, CurriculumSource };

/** Version du catalogue, persistée avec les profils qui en dépendent. */
export const CURRICULUM_VERSION = 'v1';

// Une donnée malformée est un bug du dépôt, pas une entrée inconnue : elle doit
// faire échouer bruyamment au chargement du module, pas dégrader silencieusement.
const sourcesFile = curriculumSourcesFileSchema.parse(sourcesData);
const coursesFile = curriculumCoursesFileSchema.parse(coursesData);

const SOURCES_BY_ID: ReadonlyMap<string, CurriculumSource> = new Map(
  sourcesFile.sources.map((source) => [source.id, source]),
);

const COURSES_BY_KEY: ReadonlyMap<string, CourseRecord> = new Map(
  coursesFile.courses.map((course) => [course.courseKey, course]),
);

// ── Invariants du registre ───────────────────────────────────────────────────
// Vérifiés au chargement pour qu'aucune incohérence ne puisse atteindre un élève.

if (COURSES_BY_KEY.size !== coursesFile.courses.length) {
  throw new Error('Catalogue curriculum : clés de cours dupliquées');
}
if (SOURCES_BY_ID.size !== sourcesFile.sources.length) {
  throw new Error('Catalogue curriculum : identifiants de source dupliqués');
}
for (const course of coursesFile.courses) {
  for (const ref of course.sourceRefs) {
    if (!SOURCES_BY_ID.has(ref)) {
      throw new Error(`Catalogue curriculum : source inconnue "${ref}" référencée par "${course.courseKey}"`);
    }
  }
  if (course.requiresCourseKey && !COURSES_BY_KEY.has(course.requiresCourseKey)) {
    throw new Error(
      `Catalogue curriculum : "${course.courseKey}" dépend d'un cours inconnu "${course.requiresCourseKey}"`,
    );
  }
}

// ── Lecture ──────────────────────────────────────────────────────────────────

export function listCourses(): readonly CourseRecord[] {
  return coursesFile.courses;
}

/** `null` pour une clé inconnue : une entrée client ne doit jamais lever. */
export function getCourse(courseKey: string): CourseRecord | null {
  return COURSES_BY_KEY.get(courseKey) ?? null;
}

export function isKnownCourseKey(courseKey: string): boolean {
  return COURSES_BY_KEY.has(courseKey);
}

export function listCourseKeys(): readonly string[] {
  return coursesFile.courses.map((course) => course.courseKey);
}

export function getSource(sourceId: string): CurriculumSource | null {
  return SOURCES_BY_ID.get(sourceId) ?? null;
}

export function listSources(): readonly CurriculumSource[] {
  return sourcesFile.sources;
}

/** Sources prouvant un cours donné. Jamais vide (invariant du schéma). */
export function getCourseSources(courseKey: string): readonly CurriculumSource[] {
  const course = getCourse(courseKey);
  if (!course) return [];
  return course.sourceRefs
    .map((ref) => SOURCES_BY_ID.get(ref))
    .filter((source): source is CurriculumSource => source !== undefined);
}

/** `true` si au moins une source du cours émane réellement du ministère. */
export function hasOfficialProvenance(courseKey: string): boolean {
  return getCourseSources(courseKey).some(
    (source) =>
      source.kind === 'OFFICIAL_PROGRAMME' ||
      source.kind === 'REPO_OFFICIAL_DOCUMENT' ||
      source.kind === 'OFFICIAL_EXAM_POLICY',
  );
}

// ── Sélecteurs ───────────────────────────────────────────────────────────────

export interface CourseFilter {
  gradeLevel?: string;
  track?: string;
  kind?: CourseKind;
  stmgPathway?: string | null;
}

/**
 * Cours applicables à un couple (niveau × voie), éventuellement restreints à un
 * type et à un parcours STMG.
 *
 * Ne dit RIEN de ce que l'élève suit réellement : c'est l'univers des cours
 * possibles. Ce que l'élève suit est porté par ses inscriptions.
 */
export function listCoursesFor(filter: CourseFilter): readonly CourseRecord[] {
  return coursesFile.courses.filter((course) => {
    if (filter.gradeLevel && course.gradeLevel !== filter.gradeLevel) return false;
    if (filter.track && !course.tracks.includes(filter.track as CourseRecord['tracks'][number])) {
      return false;
    }
    if (filter.kind && course.kind !== filter.kind) return false;
    if (course.stmgPathways && course.stmgPathways.length > 0) {
      if (!filter.stmgPathway) return false;
      if (!course.stmgPathways.includes(filter.stmgPathway as 'RHC')) return false;
    }
    return true;
  });
}

/** Univers des spécialités réellement proposées pour un niveau. */
export function listSpecialtyCourses(gradeLevel: string): readonly CourseRecord[] {
  return listCoursesFor({ gradeLevel, kind: 'SPECIALTY' });
}

/**
 * Nombre maximal de spécialités pour un niveau, ou `null` si le niveau n'a pas
 * de système de spécialités (collège, seconde).
 */
export function getMaxSpecialties(gradeLevel: string): number | null {
  const rule = coursesFile.specialtyRules[gradeLevel];
  return rule ? rule.maxSpecialties : null;
}

export function getSpecialtyRuleSources(gradeLevel: string): readonly CurriculumSource[] {
  const rule = coursesFile.specialtyRules[gradeLevel];
  if (!rule) return [];
  return rule.sourceRefs
    .map((ref) => SOURCES_BY_ID.get(ref))
    .filter((source): source is CurriculumSource => source !== undefined);
}

/**
 * Traduit une matière historique (`Subject`) en cours du catalogue, pour un
 * niveau et un type donnés.
 *
 * Utilisé UNIQUEMENT par le backfill et les adaptateurs de données héritées.
 * Retourne `null` dès que la correspondance n'est pas univoque — on préfère
 * ne rien conclure plutôt que d'inventer un rattachement.
 */
export function findCourseByLegacySubject(
  legacySubject: string,
  gradeLevel: string,
  kind: CourseKind,
): CourseRecord | null {
  const matches = coursesFile.courses.filter(
    (course) =>
      course.legacySubject === legacySubject &&
      course.gradeLevel === gradeLevel &&
      course.kind === kind,
  );
  return matches.length === 1 ? matches[0] : null;
}

/** Libellé court d'un cours, ou la clé si elle est inconnue (jamais d'exception). */
export function courseLabel(courseKey: string): string {
  return getCourse(courseKey)?.label ?? courseKey;
}

/**
 * Projection d'affichage des inscriptions d'un élève.
 * Utilisée par les surfaces qui montraient auparavant `Student.specialties`.
 */
export function projectEnrollmentsForDisplay(
  enrollments: readonly { courseKey: string; kind: string }[],
): { courseKey: string; label: string; kind: string }[] {
  return enrollments.map((entry) => ({
    courseKey: entry.courseKey,
    label: courseLabel(entry.courseKey),
    kind: entry.kind,
  }));
}

// ── Passerelle vers le registre de programmes versionnés ─────────────────────

/**
 * Version de programme applicable à un cours pour une année scolaire donnée.
 *
 * Consomme `CURRICULUM_REGISTRY` (`lib/curriculum/registry`), qui porte les
 * références BO datées, l'autorité émettrice et les plages de validité.
 *
 * Retourne `null` quand le cours ne déclare pas de sélecteur, ou quand aucune
 * version publiée ne couvre l'année demandée — jamais un repli silencieux sur
 * une version voisine.
 *
 * @throws {Error} si plusieurs versions publiées couvrent la même année pour le
 * même sélecteur : c'est une incohérence du registre, pas une entrée inconnue.
 */
export function resolveCourseProgramme(
  courseKey: string,
  academicYear: string,
): CurriculumVersion | null {
  const course = getCourse(courseKey);
  if (!course?.programmeSelector) return null;

  const selector = course.programmeSelector;
  const matches = CURRICULUM_REGISTRY.filter(
    (entry) =>
      entry.status === 'PUBLISHED' &&
      entry.subject === selector.subject &&
      entry.level === selector.level &&
      entry.track === selector.track &&
      entry.subjectVariant === selector.subjectVariant &&
      entry.effectiveFromAcademicYear <= academicYear &&
      (entry.effectiveToAcademicYear === undefined ||
        academicYear <= entry.effectiveToAcademicYear),
  );

  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new Error(
      `Registre de programmes incohérent : ${matches.length} versions publiées couvrent ${academicYear} pour ${courseKey}`,
    );
  }
  return matches[0];
}

/** Cours reliés au registre de programmes versionnés. */
export function listCoursesWithProgrammeSelector(): readonly CourseRecord[] {
  return coursesFile.courses.filter((course) => course.programmeSelector !== undefined);
}
