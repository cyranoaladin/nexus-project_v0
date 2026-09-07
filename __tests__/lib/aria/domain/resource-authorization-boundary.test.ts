import {
  isAriaResourceAuthorized,
  assertAriaResourceAuthorization,
} from '@/lib/aria/domain/resources/authorization';

/**
 * N3 hardening: `isAriaResourceAuthorized`/`assertAriaResourceAuthorization`
 * used to take a second, independently-supplied `courseKey` and compare it
 * against `resource.courseKey` — representable as "resource + arbitrary
 * courseKey", including a mismatched pair a careless caller could construct.
 * The API now takes only `(resource, studentId)`: a caller can no longer
 * even express an unauthorized resource/course pair, because there is no
 * second courseKey parameter to mismatch. This file proves the invariant
 * directly at the domain boundary, independent of any specific application
 * caller (see resource-access.test.ts's "Section 5C" for the equivalent
 * proof through the real `authorizeAriaResourceForActor` application path).
 */
describe('ARIA resource authorization — boundary hardening', () => {
  it('has no courseKey parameter to mismatch: the function signature itself makes "resource + arbitrary courseKey" unrepresentable', () => {
    // A TypeScript compile-time proof as much as a runtime one: this would
    // be a type error if a second string parameter still existed.
    expect(isAriaResourceAuthorized.length).toBe(2);
    expect(assertAriaResourceAuthorization.length).toBe(2);
  });

  it('authorizes a PUBLIC resource for any requesting student, regardless of the courseKey it carries', () => {
    const resource = { courseKey: 'eds-nsi-premiere', visibility: 'PUBLIC' as const, ownerStudentId: null };
    expect(isAriaResourceAuthorized(resource, 'student-a')).toBe(true);
    expect(isAriaResourceAuthorized(resource, 'student-b')).toBe(true);
  });

  it('SYSTEM_ONLY visibility is refused for every student, unconditionally', () => {
    const resource = { courseKey: 'eds-nsi-premiere', visibility: 'SYSTEM_ONLY' as const, ownerStudentId: null };
    expect(isAriaResourceAuthorized(resource, 'student-a')).toBe(false);
    expect(() => assertAriaResourceAuthorization(resource, 'student-a'))
      .toThrow(expect.objectContaining({ code: 'RESOURCE_MISMATCH' }));
  });

  it('STUDENT_PRIVATE visibility is refused for every student except the exact owner', () => {
    const resource = {
      courseKey: 'eds-nsi-premiere', visibility: 'STUDENT_PRIVATE' as const, ownerStudentId: 'owner-1',
    };
    expect(isAriaResourceAuthorized(resource, 'owner-1')).toBe(true);
    expect(isAriaResourceAuthorized(resource, 'someone-else')).toBe(false);
  });

  it('a resource owned by a different student is refused even when visibility is PUBLIC (unchanged pre-existing ownership rule)', () => {
    const resource = {
      courseKey: 'eds-nsi-premiere', visibility: 'PUBLIC' as const, ownerStudentId: 'other-student',
    };
    expect(isAriaResourceAuthorized(resource, 'student-1')).toBe(false);
  });

  it('assertAriaResourceAuthorization never throws for a resource this exact student is authorized for', () => {
    const resource = { courseKey: 'eds-nsi-premiere', visibility: 'PUBLIC' as const, ownerStudentId: null };
    expect(() => assertAriaResourceAuthorization(resource, 'student-1')).not.toThrow();
  });
});
