import {
  evaluateCandidateIdentity,
  normalizeStaffStudentSearchResult,
} from '@/lib/quotes/candidat-individuel-identity';

const lead = { id: 'lead-1', email: ' Parent@Example.Test ' };
const student = {
  studentId: 'student-profile-1',
  userId: 'student-user-1',
  user: { firstName: 'Yasmine', lastName: 'Ben Salah', email: 'student@example.test', mergedIntoUserId: null },
  responsible: {
    parentProfileId: 'parent-profile-1',
    userId: 'parent-user-1',
    firstName: 'Sonia',
    lastName: 'Ben Salah',
    email: 'parent@example.test',
    mergedIntoUserId: null,
  },
};

describe('candidate individual identity contract', () => {
  it.each([
    [null, null, false],
    [lead, null, false],
    [null, student, false],
    [lead, student, true],
  ] as const)('identityComplete(%p, %p) => %s', (selectedLead, selectedStudent, complete) => {
    expect(evaluateCandidateIdentity({ selectedLead, selectedStudent })).toMatchObject({ complete });
  });

  it('keeps Student.id and User.id distinct when normalizing the real API payload', () => {
    expect(normalizeStaffStudentSearchResult(student)).toMatchObject({
      studentId: 'student-profile-1',
      userId: 'student-user-1',
    });
  });

  it('rejects an ambiguous legacy payload instead of guessing which id is Student.id', () => {
    expect(normalizeStaffStudentSearchResult({ id: 'ambiguous-id', user: student.user })).toBeNull();
  });

  it('blocks while validation/search is loading or failed', () => {
    expect(evaluateCandidateIdentity({ selectedLead: lead, selectedStudent: student, validating: true })).toMatchObject({ complete: false, code: 'VALIDATING' });
    expect(evaluateCandidateIdentity({ selectedLead: lead, selectedStudent: student, validationError: true })).toMatchObject({ complete: false, code: 'VALIDATION_ERROR' });
  });

  it('blocks a student attached to another responsible', () => {
    expect(evaluateCandidateIdentity({
      selectedLead: { id: 'lead-other', email: 'other@example.test' },
      selectedStudent: student,
    })).toMatchObject({ complete: false, code: 'RESPONSIBLE_MISMATCH' });
  });

  it('blocks merged or incomplete canonical parent identities', () => {
    expect(evaluateCandidateIdentity({
      selectedLead: lead,
      selectedStudent: { ...student, responsible: { ...student.responsible, mergedIntoUserId: 'canonical-user' } },
    })).toMatchObject({ complete: false, code: 'RESPONSIBLE_UNAVAILABLE' });
    expect(evaluateCandidateIdentity({
      selectedLead: lead,
      selectedStudent: { ...student, responsible: { ...student.responsible, email: null } },
    })).toMatchObject({ complete: false, code: 'RESPONSIBLE_UNAVAILABLE' });
  });

  it('blocks a merged student account even when the parent email matches', () => {
    expect(evaluateCandidateIdentity({
      selectedLead: lead,
      selectedStudent: { ...student, user: { ...student.user, mergedIntoUserId: 'canonical-student-user' } },
    })).toMatchObject({ complete: false, code: 'STUDENT_UNAVAILABLE' });
  });
});
