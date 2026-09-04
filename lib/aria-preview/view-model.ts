/**
 * Assemble le modèle de vue serialisable consommé par le composant client
 * `AriaPreviewWorkspace`. Toute la lecture des autorités canoniques
 * (curriculum, capacités ARIA, RAG) se fait ici, côté serveur — le composant
 * client ne reçoit que des données déjà résolues.
 */

import {
  listCourses,
  getCourseSources,
  getMaxSpecialties,
  getSpecialtyRuleSources,
  getSpecialtyRuleNote,
} from '@/lib/curriculum/catalog';
import { getCourseAriaSummary, type CourseAriaSummary } from './capability-status';
import { getRagCanonicalVolumetry, type RagCanonicalVolumetry } from './rag-canonical-authority';
import { buildCoverageMatrix, listCoveredGradeLevels, listTracksForGradeLevel, type CoverageRow } from './coverage-matrix';

export interface CourseSourceViewModel {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
}

export interface CoursePreviewViewModel {
  readonly courseKey: string;
  readonly label: string;
  readonly longLabel: string;
  readonly gradeLevel: string;
  readonly tracks: readonly string[];
  readonly kind: string;
  readonly note: string | null;
  readonly sources: readonly CourseSourceViewModel[];
  readonly summary: CourseAriaSummary;
  readonly ragVolumetry: RagCanonicalVolumetry | null;
}

export interface SpecialtyRuleViewModel {
  readonly gradeLevel: string;
  readonly maxSpecialties: number;
  readonly sources: readonly CourseSourceViewModel[];
  readonly note: string | null;
}

export interface AriaPreviewData {
  readonly courses: readonly CoursePreviewViewModel[];
  readonly specialtyRules: readonly SpecialtyRuleViewModel[];
  readonly coverageMatrix: readonly CoverageRow[];
  readonly gradeLevels: readonly string[];
  readonly tracksByGradeLevel: Readonly<Record<string, readonly string[]>>;
}

const SPECIALTY_RULE_GRADE_LEVELS = ['PREMIERE', 'TERMINALE'] as const;

export function buildAriaPreviewData(): AriaPreviewData {
  const courses = listCourses().map((course): CoursePreviewViewModel => {
    const summary = getCourseAriaSummary(course.courseKey);
    return {
      courseKey: course.courseKey,
      label: course.label,
      longLabel: course.longLabel,
      gradeLevel: course.gradeLevel,
      tracks: course.tracks,
      kind: course.kind,
      note: course.note ?? null,
      sources: getCourseSources(course.courseKey).map((source) => ({
        id: source.id,
        label: source.label,
        kind: source.kind,
      })),
      summary,
      ragVolumetry: summary.ragCorpusId ? getRagCanonicalVolumetry(summary.ragCorpusId) : null,
    };
  });

  const courseKeys = courses.map((course) => course.courseKey);
  if (new Set(courseKeys).size !== courseKeys.length) {
    // Le chargeur de catalogue lève déjà en cas de doublon ; ce garde-fou est
    // une seconde ligne de défense pour cet aperçu spécifiquement.
    throw new Error('ARIA preview: courseKey dupliqué dans le catalogue résolu');
  }

  const specialtyRules: SpecialtyRuleViewModel[] = [];
  for (const gradeLevel of SPECIALTY_RULE_GRADE_LEVELS) {
    const maxSpecialties = getMaxSpecialties(gradeLevel);
    if (maxSpecialties === null) continue;
    specialtyRules.push({
      gradeLevel,
      maxSpecialties,
      sources: getSpecialtyRuleSources(gradeLevel).map((source) => ({
        id: source.id,
        label: source.label,
        kind: source.kind,
      })),
      note: getSpecialtyRuleNote(gradeLevel),
    });
  }

  const gradeLevels = listCoveredGradeLevels();
  const tracksByGradeLevel: Record<string, readonly string[]> = {};
  for (const gradeLevel of gradeLevels) {
    tracksByGradeLevel[gradeLevel] = listTracksForGradeLevel(gradeLevel);
  }

  return {
    courses,
    specialtyRules,
    coverageMatrix: buildCoverageMatrix(),
    gradeLevels,
    tracksByGradeLevel,
  };
}
