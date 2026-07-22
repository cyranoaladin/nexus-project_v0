import type { CurriculumVersion } from '../schemas/curriculum';
import { MATHEMATICS_CURRICULA } from './math';
import { PHYSICS_CURRICULA } from './physics';
import { NSI_CURRICULA } from './nsi';
import { SNT_CURRICULA } from './snt';
import { FRENCH_CURRICULA } from './french';

export const CURRICULUM_REGISTRY_VALIDATED_THROUGH = '2028-2029' as const;

function freezeCurriculumVersion(curriculum: CurriculumVersion): CurriculumVersion {
  for (const source of curriculum.officialSources) {
    Object.freeze(source);
  }
  Object.freeze(curriculum.officialSources);
  Object.freeze(curriculum);
  return curriculum;
}

export const CURRICULUM_REGISTRY: readonly CurriculumVersion[] = Object.freeze([
  ...MATHEMATICS_CURRICULA,
  ...PHYSICS_CURRICULA,
  ...NSI_CURRICULA,
  ...SNT_CURRICULA,
  ...FRENCH_CURRICULA,
].map(freezeCurriculumVersion));

function academicYearStart(academicYear: string): number {
  return Number(academicYear.slice(0, 4));
}

function selectorKey(curriculum: CurriculumVersion): string {
  return [
    curriculum.subject,
    curriculum.level,
    curriculum.track,
    curriculum.subjectVariant,
  ].join(':');
}

export function assertCurriculumRegistryIntegrity(
  registry: readonly CurriculumVersion[],
): void {
  const ids = new Set<string>();
  const bySelector = new Map<string, CurriculumVersion[]>();

  for (const curriculum of registry) {
    if (ids.has(curriculum.id)) {
      throw new Error(`Duplicate curriculum id: ${curriculum.id}`);
    }
    ids.add(curriculum.id);

    const key = selectorKey(curriculum);
    const versions = bySelector.get(key) ?? [];
    versions.push(curriculum);
    bySelector.set(key, versions);
  }

  for (const [key, versions] of bySelector) {
    const sorted = [...versions].sort(
      (left, right) => academicYearStart(left.effectiveFromAcademicYear)
        - academicYearStart(right.effectiveFromAcademicYear),
    );

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const previousEnd = previous.effectiveToAcademicYear === undefined
        ? Number.POSITIVE_INFINITY
        : academicYearStart(previous.effectiveToAcademicYear);

      if (academicYearStart(current.effectiveFromAcademicYear) <= previousEnd) {
        throw new Error(
          `Curriculum effective range overlap for ${key}: ${previous.id} and ${current.id}`,
        );
      }
    }
  }
}

assertCurriculumRegistryIntegrity(CURRICULUM_REGISTRY);

export { MATHEMATICS_CURRICULA } from './math';
export { PHYSICS_CURRICULA } from './physics';
export { NSI_CURRICULA } from './nsi';
export { SNT_CURRICULA } from './snt';
export { FRENCH_CURRICULA } from './french';
