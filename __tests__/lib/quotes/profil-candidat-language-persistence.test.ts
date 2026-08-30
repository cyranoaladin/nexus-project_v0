jest.mock('server-only', () => ({}));

const mockCreate = jest.fn();
const mockLeadFindUnique = jest.fn();
const mockStudentFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockQuoteFindFirst = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      profilCandidat: {
        create: (...args: unknown[]) => mockCreate(...args),
        update: (...args: unknown[]) => mockUpdate(...args),
      },
      quote: { findFirst: (...args: unknown[]) => mockQuoteFindFirst(...args) },
      contactLead: { findUnique: (...args: unknown[]) => mockLeadFindUnique(...args) },
      student: { findUnique: (...args: unknown[]) => mockStudentFindUnique(...args) },
    }),
  },
}));

import { createProfilCandidat, updateProfilCandidat } from '@/lib/quotes/profil-candidat.server';

const baseDraft = {
  contactLeadId: 'lead-1',
  studentId: 'student-1',
  publicInput: {
    level: 'TERMINALE', examSession: 2027, modalite: 'A',
    specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'profil-1' });
  mockUpdate.mockResolvedValue({ id: 'profil-1' });
  mockQuoteFindFirst.mockResolvedValue(null);
  mockQueryRaw.mockResolvedValue([{ id: 'profil-1', updatedAt: new Date('2026-08-30T12:00:00.000Z') }]);
  mockLeadFindUnique.mockResolvedValue({ id: 'lead-1', email: 'parent@example.test' });
  mockStudentFindUnique.mockResolvedValue({
    id: 'student-1', user: { id: 'student-user-1', mergedIntoUserId: null },
    parent: { user: { id: 'parent-user-1', email: 'parent@example.test', mergedIntoUserId: null } },
  });
});

test('persiste deux langues autorisees distinctes', async () => {
  await expect(createProfilCandidat({
    ...baseDraft,
    publicInput: { ...baseDraft.publicInput, langueA: 'ARABE', langueB: 'ALLEMAND' },
  }, 'staff-1')).resolves.toMatchObject({ ok: true });
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ langueA: 'ARABE', langueB: 'ALLEMAND' }),
  }));
});

test.each([
  ['PORTUGAIS', undefined, 'LANGUE_CODE_INVALIDE', 'langueA'],
  ['MATHEMATIQUES', undefined, 'LANGUE_CODE_INVALIDE', 'langueA'],
  [undefined, 'PORTUGAIS', 'LANGUE_CODE_INVALIDE', 'langueB'],
  [undefined, 'MATHEMATIQUES', 'LANGUE_CODE_INVALIDE', 'langueB'],
  ['ANGLAIS', 'ANGLAIS', 'LANGUES_IDENTIQUES', 'langueB'],
])('refuse avant Prisma le couple LVA=%s LVB=%s', async (langueA, langueB, code, field) => {
  const result = await createProfilCandidat({
    ...baseDraft,
    publicInput: { ...baseDraft.publicInput, langueA, langueB },
  }, 'staff-1');
  expect(result).toMatchObject({
    ok: false,
    unresolvedFields: [],
    validationIssues: [expect.objectContaining({ code, field, message: expect.any(String) })],
  });
  expect(mockCreate).not.toHaveBeenCalled();
});

test.each([
  ['PORTUGAIS', undefined, 'LANGUE_CODE_INVALIDE', 'langueA'],
  [undefined, 'MATHEMATIQUES', 'LANGUE_CODE_INVALIDE', 'langueB'],
  ['ESPAGNOL', 'ESPAGNOL', 'LANGUES_IDENTIQUES', 'langueB'],
])('refuse aussi une mise a jour invalide avant Prisma LVA=%s LVB=%s', async (langueA, langueB, code, field) => {
  const result = await updateProfilCandidat('profil-1', {
    ...baseDraft,
    publicInput: { ...baseDraft.publicInput, langueA, langueB },
  });
  expect(result).toMatchObject({
    ok: false,
    unresolvedFields: [],
    validationIssues: [expect.objectContaining({ code, field, message: expect.any(String) })],
  });
  expect(mockUpdate).not.toHaveBeenCalled();
});

test('refuse ARABE comme specialite avant Prisma', async () => {
  const result = await createProfilCandidat({
    ...baseDraft,
    publicInput: { ...baseDraft.publicInput, specialite1: 'ARABE' },
  }, 'staff-1');
  expect(result).toMatchObject({
    ok: false,
    unresolvedFields: [],
    validationIssues: [{
      code: 'SPECIALITE_CODE_INCONNU',
      field: 'specialite1',
      message: "La spécialité indiquée n'est pas reconnue.",
    }],
  });
  expect(mockCreate).not.toHaveBeenCalled();
});

test('refuse aussi ARABE comme specialite avant une mise a jour Prisma', async () => {
  const result = await updateProfilCandidat('profil-1', {
    ...baseDraft,
    publicInput: { ...baseDraft.publicInput, specialite2: 'ARABE' },
  });
  expect(result).toMatchObject({
    ok: false,
    unresolvedFields: [],
    validationIssues: [{
      code: 'SPECIALITE_CODE_INCONNU',
      field: 'specialite2',
      message: "La spécialité indiquée n'est pas reconnue.",
    }],
  });
  expect(mockUpdate).not.toHaveBeenCalled();
});

test.each(['MATHS_EXPERTES', 'FRANCAIS', 'PHILOSOPHIE', 'HISTOIRE_GEO'])(
  'refuse %s comme specialite hors V1 avant Prisma',
  async (specialite1) => {
    const result = await createProfilCandidat({
      ...baseDraft,
      publicInput: { ...baseDraft.publicInput, specialite1 },
    }, 'staff-1');
    expect(result).toMatchObject({
      ok: false,
      unresolvedFields: [],
      validationIssues: [{
        code: 'SPECIALITE_CODE_INCONNU',
        field: 'specialite1',
        message: "La spécialité indiquée n'est pas reconnue.",
      }],
    });
    expect(mockCreate).not.toHaveBeenCalled();
  },
);
