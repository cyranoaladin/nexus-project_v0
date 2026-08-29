/**
 * Validation académique — fonctions PURES.
 *
 * Séparé du service d'inscriptions parce que ce module ne doit importer NI
 * Prisma NI quoi que ce soit de serveur : il est consommé par les schémas de
 * validation d'API, eux-mêmes atteignables depuis des bundles client.
 */

import {
  getCourse,
  getMaxSpecialties,
  isKnownCourseKey,
  listCoursesFor,
} from './catalog';

/** Identité scolaire minimale nécessaire pour valider un choix d'enseignements. */
export interface StudentAcademicIdentity {
  readonly gradeLevel: string | null;
  readonly academicTrack: string | null;
  readonly stmgPathway: string | null;
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Valide un ensemble de cours choisis pour un élève.
 *
 * Rejette : une clé inconnue, un cours hors du niveau ou de la voie, un cours
 * obligatoire présenté comme un choix, un dépassement du nombre de spécialités,
 * et une option dont le cours support n'est pas suivi.
 */
export function validateChosenCourses(
  identity: StudentAcademicIdentity,
  courseKeys: readonly string[],
): string[] {
  const issues: string[] = [];

  if (!identity.gradeLevel || !identity.academicTrack) {
    if (courseKeys.length > 0) {
      issues.push("le niveau et la voie doivent être connus avant de déclarer des enseignements");
    }
    return issues;
  }

  const unique = [...new Set(courseKeys)];
  if (unique.length !== courseKeys.length) {
    issues.push('doublons dans la liste des enseignements');
  }

  const applicable = new Set(
    listCoursesFor({
      gradeLevel: identity.gradeLevel,
      track: identity.academicTrack,
      stmgPathway: identity.stmgPathway,
    }).map((course) => course.courseKey),
  );

  for (const key of unique) {
    if (!isKnownCourseKey(key)) {
      issues.push(`enseignement inconnu du catalogue: ${key}`);
      continue;
    }
    if (!applicable.has(key)) {
      issues.push(`enseignement hors du niveau ou de la voie de l'élève: ${key}`);
      continue;
    }
    const course = getCourse(key);
    if (course && course.kind !== 'SPECIALTY' && course.kind !== 'OPTION') {
      // Seuls les choix se déclarent. Le tronc commun et les modules de voie
      // sont dérivés : les accepter ici créerait une seconde vérité.
      issues.push(`enseignement obligatoire, il ne se déclare pas comme un choix: ${key}`);
    }
  }

  const specialtyCount = unique.filter((key) => getCourse(key)?.kind === 'SPECIALTY').length;
  const maxSpecialties = getMaxSpecialties(identity.gradeLevel);
  if (maxSpecialties !== null && specialtyCount > maxSpecialties) {
    issues.push(
      `${specialtyCount} spécialités déclarées alors que le niveau ${identity.gradeLevel} en admet au plus ${maxSpecialties}`,
    );
  }

  for (const key of unique) {
    const course = getCourse(key);
    if (course?.requiresCourseKey && !unique.includes(course.requiresCourseKey)) {
      issues.push(`${key} exige également ${course.requiresCourseKey}`);
    }
  }

  return issues;
}
