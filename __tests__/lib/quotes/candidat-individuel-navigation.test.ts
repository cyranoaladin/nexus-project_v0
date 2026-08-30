import {
  CANDIDATE_STUDENT_HANDOFF_KEY,
  CANDIDATE_STUDENT_HANDOFF_TTL_MS,
  consumeCandidateStudentHandoff,
  getCandidateSimulatorPath,
  getContextualStudentsPath,
  isValidCandidateStudentId,
  parseStaffStudentsIntent,
  stageCandidateStudentHandoff,
} from '@/lib/quotes/candidat-individuel-navigation';

describe('candidat individuel contextual student navigation', () => {
  test.each([
    ['ADMIN', '/dashboard/admin/candidat-individuel'],
    ['ASSISTANTE', '/dashboard/assistante/candidat-individuel'],
  ] as const)('ferme la destination simulateur pour %s', (role, expected) => {
    expect(getCandidateSimulatorPath(role)).toBe(expected);
    expect(getContextualStudentsPath(role)).toBe(
      `${role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/assistante'}/students?intent=candidat-individuel`,
    );
  });

  test('n’accepte que l’intent exact', () => {
    expect(parseStaffStudentsIntent('candidat-individuel')).toBe('candidat-individuel');
    expect(parseStaffStudentsIntent('https://evil.example')).toBeUndefined();
    expect(parseStaffStudentsIntent('//evil.example')).toBeUndefined();
    expect(parseStaffStudentsIntent('candidat-individuel/../admin')).toBeUndefined();
    expect(parseStaffStudentsIntent(['candidat-individuel'])).toBeUndefined();
    expect(parseStaffStudentsIntent(undefined)).toBeUndefined();
  });

  test('transporte un identifiant opaque en session sans jamais le placer dans la destination', () => {
    const studentId = 'cm1studentopaqueidentifier01';
    const storage = window.sessionStorage;
    storage.clear();

    expect(isValidCandidateStudentId(studentId)).toBe(true);
    stageCandidateStudentHandoff(storage, 'ASSISTANTE', studentId, 1_000);
    expect(storage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain(studentId);
    expect(getCandidateSimulatorPath('ASSISTANTE')).not.toContain(studentId);
    expect(consumeCandidateStudentHandoff(storage, 'ASSISTANTE', 1_001)).toBe(studentId);
    expect(storage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
    expect(consumeCandidateStudentHandoff(storage, 'ASSISTANTE', 1_001)).toBeNull();
  });

  test('rejette et supprime tout handoff invalide sans produire de destination externe', () => {
    const storage = window.sessionStorage;
    storage.clear();
    expect(() => stageCandidateStudentHandoff(storage, 'ADMIN', 'https://evil.example')).toThrow('invalid_student_id');
    storage.setItem(CANDIDATE_STUDENT_HANDOFF_KEY, '../secret');
    expect(() => consumeCandidateStudentHandoff(storage, 'ADMIN')).toThrow('invalid_student_handoff');
    expect(storage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
  });

  test('refuse un handoff expiré ou destiné à un autre rôle', () => {
    const storage = window.sessionStorage;
    storage.clear();
    stageCandidateStudentHandoff(storage, 'ADMIN', 'cm1studentopaqueidentifier01', 10_000);
    expect(() => consumeCandidateStudentHandoff(storage, 'ASSISTANTE', 10_001)).toThrow('invalid_student_handoff');
    expect(storage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();

    stageCandidateStudentHandoff(storage, 'ADMIN', 'cm1studentopaqueidentifier01', 10_000);
    expect(() => consumeCandidateStudentHandoff(
      storage,
      'ADMIN',
      10_000 + CANDIDATE_STUDENT_HANDOFF_TTL_MS + 1,
    )).toThrow('invalid_student_handoff');
    expect(storage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
  });
});
