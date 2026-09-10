/**
 * Regression test for P3_FINDING_B (Foundation PR #227, Review A finding on
 * lib/core-v2/repositories/coach-student-course-assignment.ts): the
 * partial-unique-index violation for the ACTIVE (coach, enrollment,
 * courseKey) triple was detected only by matching Prisma's reported
 * `meta.target` as an exact column-name array. Verified empirically against
 * Postgres 16 today, but this is a forward-compatibility fragility — a
 * future Prisma engine version reporting the constraint/index *name*
 * instead of the column array would silently fail OPEN to a generic
 * re-thrown error instead of the friendly DuplicateActiveAssignmentError.
 * No DB needed: constructs synthetic P2002-shaped errors for both forms.
 */
import { isActiveTripleUniqueViolation } from '@/lib/core-v2/repositories/coach-student-course-assignment';

const ACTIVE_TRIPLE_INDEX_NAME = 'coach_student_course_assignments_active_triple_key';

function knownRequestError(
  code: string,
  target: unknown,
): { code: string; meta?: { target?: unknown } } {
  return { code, meta: { target } };
}

describe('isActiveTripleUniqueViolation — detects the ACTIVE-triple partial unique index violation regardless of how Prisma reports it', () => {
  test('column-array form (verified current Postgres 16 / Prisma behavior) is detected', () => {
    const error = knownRequestError('P2002', [
      'academicYearEnrollmentId',
      'coachId',
      'courseKey',
    ]);
    expect(isActiveTripleUniqueViolation(error)).toBe(true);
  });

  test('column-array form in a different order is still detected', () => {
    const error = knownRequestError('P2002', ['courseKey', 'coachId', 'academicYearEnrollmentId']);
    expect(isActiveTripleUniqueViolation(error)).toBe(true);
  });

  test('index-name string form (forward-compatibility case, P3_FINDING_B) is detected', () => {
    const error = knownRequestError('P2002', ACTIVE_TRIPLE_INDEX_NAME);
    expect(isActiveTripleUniqueViolation(error)).toBe(true);
  });

  test('index-name reported as a single-element array is detected', () => {
    const error = knownRequestError('P2002', [ACTIVE_TRIPLE_INDEX_NAME]);
    expect(isActiveTripleUniqueViolation(error)).toBe(true);
  });

  test('an unrelated P2002 violation (different column set) is NOT detected', () => {
    const error = knownRequestError('P2002', ['coachId', 'courseKey']);
    expect(isActiveTripleUniqueViolation(error)).toBe(false);
  });

  test('an unrelated P2002 violation (different index name) is NOT detected', () => {
    const error = knownRequestError('P2002', 'some_other_constraint_key');
    expect(isActiveTripleUniqueViolation(error)).toBe(false);
  });

  test('a non-P2002 error is NOT detected', () => {
    const error = knownRequestError('P2025', ['coachId', 'academicYearEnrollmentId', 'courseKey']);
    expect(isActiveTripleUniqueViolation(error)).toBe(false);
  });

  test('a value with no code/meta shape at all is NOT detected', () => {
    expect(isActiveTripleUniqueViolation(new Error('boom'))).toBe(false);
    expect(isActiveTripleUniqueViolation(undefined)).toBe(false);
    expect(isActiveTripleUniqueViolation(null)).toBe(false);
  });
});
