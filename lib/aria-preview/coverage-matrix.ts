/**
 * Matrice de couverture "Carte scolaire" pour l'aperçu produit ARIA.
 *
 * Entièrement dérivée de `lib/curriculum/catalog` et `capability-status` :
 * aucune ligne, aucun total n'est écrit à la main.
 */

import { listCourses, type CourseRecord } from '@/lib/curriculum/catalog';
import { getCourseAriaSummary } from './capability-status';

export interface CoverageRow {
  readonly gradeLevel: string;
  readonly track: string;
  readonly courseCount: number;
  readonly ragReadyCount: number;
  readonly chatReadyCount: number;
  readonly skillGraphReadyCount: number;
}

/** Ordre pédagogique canonique — n'affecte que le tri, jamais l'inclusion. */
const GRADE_LEVEL_ORDER = ['QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE', 'POSTBAC', 'AUTRE'];

function gradeLevelRank(gradeLevel: string): number {
  const index = GRADE_LEVEL_ORDER.indexOf(gradeLevel);
  return index === -1 ? GRADE_LEVEL_ORDER.length : index;
}

/** Niveaux réellement présents dans le catalogue, dans l'ordre pédagogique. */
export function listCoveredGradeLevels(): readonly string[] {
  const levels = new Set(listCourses().map((course) => course.gradeLevel));
  return [...levels].sort((a, b) => gradeLevelRank(a) - gradeLevelRank(b));
}

/** Voies réellement compatibles avec un niveau donné, dérivées du catalogue. */
export function listTracksForGradeLevel(gradeLevel: string): readonly string[] {
  const tracks = new Set<string>();
  for (const course of listCourses()) {
    if (course.gradeLevel !== gradeLevel) continue;
    for (const track of course.tracks) tracks.add(track);
  }
  return [...tracks].sort();
}

function coursesFor(gradeLevel: string, track: string): readonly CourseRecord[] {
  return listCourses().filter(
    (course) => course.gradeLevel === gradeLevel && course.tracks.includes(track as CourseRecord['tracks'][number]),
  );
}

export function buildCoverageMatrix(): readonly CoverageRow[] {
  const rows: CoverageRow[] = [];
  for (const gradeLevel of listCoveredGradeLevels()) {
    for (const track of listTracksForGradeLevel(gradeLevel)) {
      const courses = coursesFor(gradeLevel, track);
      const summaries = courses.map((course) => getCourseAriaSummary(course.courseKey));
      rows.push({
        gradeLevel,
        track,
        courseCount: courses.length,
        ragReadyCount: summaries.filter((s) => s.ragStatus !== 'NOT_CONFIGURED').length,
        chatReadyCount: summaries.filter((s) => s.chatStatus !== 'NOT_CONFIGURED').length,
        skillGraphReadyCount: summaries.filter((s) => s.skillGraphStatus === 'READY').length,
      });
    }
  }
  return rows;
}
