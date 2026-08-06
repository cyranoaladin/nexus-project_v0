import { GradeLevel } from '@prisma/client';

import { CanonicalApiError } from './errors';

const CANONICAL_GRADE_LEVELS: ReadonlySet<string> = new Set(Object.values(GradeLevel));

export function resolvePrismaGradeLevel(level: string): GradeLevel {
  if (!CANONICAL_GRADE_LEVELS.has(level)) {
    throw CanonicalApiError.incompatible(`PACK_LEVEL_UNMAPPED:${level}`);
  }
  return level as GradeLevel;
}

export function assertStudentPackLevel(
  studentLevel: unknown,
  packLevel: string,
): GradeLevel {
  const canonicalPackLevel = resolvePrismaGradeLevel(packLevel);
  if (
    typeof studentLevel !== 'string'
    || !CANONICAL_GRADE_LEVELS.has(studentLevel)
    || studentLevel !== canonicalPackLevel
  ) {
    throw CanonicalApiError.conflict('STUDENT_PACK_LEVEL_MISMATCH');
  }
  return canonicalPackLevel;
}
