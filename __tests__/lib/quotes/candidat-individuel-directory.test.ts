import { normalizeCandidateStudentDirectoryItem } from '@/lib/quotes/candidat-individuel-directory';

const complete = {
  studentId: 'student-profile-1',
  userId: 'student-user-1',
  grade: 'Terminale',
  school: 'Lycée test',
  user: { firstName: 'Yasmine', lastName: 'Ben Salah', email: 'student@example.test', mergedIntoUserId: null },
  responsible: {
    parentProfileId: 'parent-profile-1', userId: 'parent-user-1', firstName: 'Sonia', lastName: 'Ben Salah',
    email: 'parent@example.test', mergedIntoUserId: null,
  },
};

describe('candidate student contextual directory', () => {
  test('conserve le Student.id autoritatif et rend un dossier complet sélectionnable', () => {
    expect(normalizeCandidateStudentDirectoryItem(complete)).toMatchObject({
      id: 'student-profile-1',
      firstName: 'Yasmine',
      selectable: true,
      unavailableReason: null,
    });
  });

  test.each([
    [{ ...complete, user: { ...complete.user, mergedIntoUserId: 'student-canonical' } }, 'Compte élève fusionné'],
    [{ ...complete, responsible: null }, 'Responsable absent'],
    [{ ...complete, responsible: { ...complete.responsible, mergedIntoUserId: 'parent-canonical' } }, 'Compte responsable fusionné'],
    [{ ...complete, responsible: { ...complete.responsible, email: null } }, 'Adresse email du responsable manquante'],
    [{ ...complete, responsible: { ...complete.responsible, email: '   ' } }, 'Adresse email du responsable manquante'],
  ])('désactive les dossiers que le resolver refusera: %s', (payload, reason) => {
    expect(normalizeCandidateStudentDirectoryItem(payload)).toMatchObject({
      id: 'student-profile-1',
      selectable: false,
      unavailableReason: reason,
    });
  });

  test('rejette un payload sans vrai Student.id au lieu de confondre avec User.id', () => {
    expect(normalizeCandidateStudentDirectoryItem({ ...complete, studentId: null })).toBeNull();
    expect(normalizeCandidateStudentDirectoryItem({ ...complete, studentId: complete.userId })).toBeNull();
    expect(normalizeCandidateStudentDirectoryItem({ ...complete, studentId: '../bad' })).toBeNull();
    expect(normalizeCandidateStudentDirectoryItem({ ...complete, studentId: ' short-id ' })).toBeNull();
    expect(normalizeCandidateStudentDirectoryItem({ ...complete, userId: null })).toBeNull();
    expect(normalizeCandidateStudentDirectoryItem({ ...complete, responsible: { ...complete.responsible, userId: null } })).toBeNull();
    expect(normalizeCandidateStudentDirectoryItem({ ...complete, responsible: { ...complete.responsible, parentProfileId: ' ' } })).toBeNull();
  });

  test('désactive un responsable sans nom exploitable', () => {
    expect(normalizeCandidateStudentDirectoryItem({
      ...complete,
      responsible: { ...complete.responsible, firstName: null, lastName: '   ' },
    })).toMatchObject({ selectable: false, unavailableReason: 'Nom du responsable manquant' });
  });
});
