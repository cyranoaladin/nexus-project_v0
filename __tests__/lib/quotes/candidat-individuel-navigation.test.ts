import {
  buildCandidateSimulatorStudentUrl,
  getCandidateSimulatorPath,
  getContextualStudentsPath,
  isValidCandidateStudentId,
  parseStaffStudentsIntent,
  removeStudentIdFromPath,
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

  test('transporte uniquement un identifiant opaque sûr', () => {
    const studentId = 'cm1studentopaqueidentifier01';
    expect(isValidCandidateStudentId(studentId)).toBe(true);
    expect(buildCandidateSimulatorStudentUrl('ASSISTANTE', studentId)).toBe(
      `/dashboard/assistante/candidat-individuel?studentId=${studentId}`,
    );
    expect(buildCandidateSimulatorStudentUrl('ADMIN', studentId)).toBe(
      `/dashboard/admin/candidat-individuel?studentId=${studentId}`,
    );
    expect(() => buildCandidateSimulatorStudentUrl('ADMIN', 'https://evil.example')).toThrow('invalid_student_id');
    expect(() => buildCandidateSimulatorStudentUrl('ADMIN', '../secret')).toThrow('invalid_student_id');
  });

  test('nettoie studentId sans perdre les paramètres internes autorisés déjà présents', () => {
    expect(removeStudentIdFromPath(
      '/dashboard/admin/candidat-individuel',
      new URLSearchParams('studentId=cm1studentopaqueidentifier01&view=compact'),
    )).toBe('/dashboard/admin/candidat-individuel?view=compact');
    expect(removeStudentIdFromPath(
      '/dashboard/assistante/candidat-individuel',
      new URLSearchParams('studentId=cm1studentopaqueidentifier01&returnTo=https%3A%2F%2Fevil.example&email=pii%40example.test'),
    )).toBe('/dashboard/assistante/candidat-individuel');
  });
});
