import {
  CANDIDATE_STUDENT_HANDOFF_KEY,
  CANDIDATE_STUDENT_HANDOFF_TTL_MS,
  clearCandidateStudentHandoff,
  consumeCandidateStudentHandoff,
  getCandidateSimulatorPath,
  getContextualStudentsPath,
  isUnmodifiedCandidateStudentActivation,
  isValidCandidateStudentId,
  navigateCandidateSimulatorSameTab,
  parseStaffStudentsIntent,
  stageCandidateStudentHandoff,
  tryCandidateStudentHandoffStorage,
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

  test.each([
    ['string', '1000'],
    ['null', null],
    ['boolean', true],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('refuse un createdAt %s au staging sans écrire de handoff', (_label, createdAt) => {
    const storage = createStorage();
    expect(() => stageCandidateStudentHandoff(
      storage,
      'ADMIN',
      'student-valid-0001',
      createdAt as number,
    )).toThrow('invalid_student_handoff');
    expect(storage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
  });

  test.each([
    ['string', JSON.stringify({ version: 1, studentId: 'student-valid-0001', role: 'ADMIN', createdAt: '1000' })],
    ['null', JSON.stringify({ version: 1, studentId: 'student-valid-0001', role: 'ADMIN', createdAt: null })],
    ['boolean', JSON.stringify({ version: 1, studentId: 'student-valid-0001', role: 'ADMIN', createdAt: true })],
    ['Infinity', '{"version":1,"studentId":"student-valid-0001","role":"ADMIN","createdAt":1e999}'],
    ['NaN', '{"version":1,"studentId":"student-valid-0001","role":"ADMIN","createdAt":NaN}'],
  ])('refuse et consomme atomiquement un createdAt %s invalide', (_label, payload) => {
    const storage = createStorage();
    storage.setItem(CANDIDATE_STUDENT_HANDOFF_KEY, payload);
    expect(() => consumeCandidateStudentHandoff(storage, 'ADMIN', 1_001)).toThrow('invalid_student_handoff');
    expect(storage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
  });

  test.each([
    [{ button: 0, detail: 1, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, true],
    [{ button: 0, detail: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, true],
    [{ button: 1, detail: 1, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, false],
    [{ button: 0, detail: 1, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, false],
    [{ button: 0, detail: 1, ctrlKey: false, metaKey: true, shiftKey: false, altKey: false }, false],
    [{ button: 0, detail: 1, ctrlKey: false, metaKey: false, shiftKey: true, altKey: false }, false],
    [{ button: 0, detail: 1, ctrlKey: false, metaKey: false, shiftKey: false, altKey: true }, false],
  ])('classe strictement une activation native %#', (activation, expected) => {
    expect(isUnmodifiedCandidateStudentActivation(activation)).toBe(expected);
  });

  test.each([
    ['ADMIN', '/dashboard/admin/candidat-individuel'],
    ['ASSISTANTE', '/dashboard/assistante/candidat-individuel'],
  ] as const)('navigue en dur vers la destination fermée %s', (role, expected) => {
    const assign = jest.fn();
    navigateCandidateSimulatorSameTab({ assign }, role);
    expect(assign).toHaveBeenCalledWith(expected);
  });

  test('isole deux onglets, consomme une fois et rend le dernier identifiant autoritatif', () => {
    const tabA = createStorage();
    const tabB = createStorage();
    stageCandidateStudentHandoff(tabA, 'ADMIN', 'student-first-0001', 1_000);
    stageCandidateStudentHandoff(tabA, 'ADMIN', 'student-second-0002', 1_001);

    expect(consumeCandidateStudentHandoff(tabB, 'ADMIN', 1_002)).toBeNull();
    expect(consumeCandidateStudentHandoff(tabA, 'ADMIN', 1_002)).toBe('student-second-0002');
    expect(consumeCandidateStudentHandoff(tabA, 'ADMIN', 1_002)).toBeNull();
  });

  test.each([
    '{',
    JSON.stringify({ version: 2, studentId: 'student-valid-0001', role: 'ADMIN', createdAt: 1_000 }),
    JSON.stringify({ version: 1, studentId: 'student-valid-0001', role: 'ADMIN', createdAt: 2_000 }),
  ])('supprime atomiquement un payload corrompu, inconnu ou daté du futur', (payload) => {
    const storage = createStorage();
    storage.setItem(CANDIDATE_STUDENT_HANDOFF_KEY, payload);
    expect(() => consumeCandidateStudentHandoff(storage, 'ADMIN', 1_000)).toThrow('invalid_student_handoff');
    expect(storage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
  });

  test('acquiert et utilise le stockage dans une seule frontière fail-closed', () => {
    const storage = createStorage();
    expect(tryCandidateStudentHandoffStorage(
      () => storage,
      (availableStorage) => {
        stageCandidateStudentHandoff(availableStorage, 'ADMIN', 'student-safe-0001', 1_000);
        return consumeCandidateStudentHandoff(availableStorage, 'ADMIN', 1_001);
      },
    )).toEqual({ ok: true, value: 'student-safe-0001' });

    expect(tryCandidateStudentHandoffStorage(
      () => { throw new DOMException('denied', 'SecurityError'); },
      () => 'unreachable',
    )).toEqual({ ok: false });
  });

  test.each(['getItem', 'setItem', 'removeItem'] as const)('absorbe un échec %s sans propager', (method) => {
    const storage = createStorage();
    const failingStorage = {
      ...storage,
      [method]: () => { throw new DOMException('denied', 'SecurityError'); },
    };
    const result = tryCandidateStudentHandoffStorage(
      () => failingStorage,
      (availableStorage) => {
        if (method === 'setItem') {
          stageCandidateStudentHandoff(availableStorage, 'ADMIN', 'student-safe-0001');
        } else if (method === 'getItem') {
          consumeCandidateStudentHandoff(availableStorage, 'ADMIN');
        } else {
          clearCandidateStudentHandoff(availableStorage);
        }
      },
    );
    expect(result).toEqual({ ok: false });
  });
});

function createStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}
