jest.mock('server-only', () => ({}));

import { readFileSync } from 'fs';
import { join } from 'path';

const mockCreate = jest.fn();
const mockLeadFindUnique = jest.fn();
const mockStudentFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      profilCandidat: { create: (...args: unknown[]) => mockCreate(...args) },
      contactLead: { findUnique: (...args: unknown[]) => mockLeadFindUnique(...args) },
      student: { findUnique: (...args: unknown[]) => mockStudentFindUnique(...args) },
    }),
  },
}));

import { createProfilCandidat } from '@/lib/quotes/profil-candidat.server';

const draft = {
  contactLeadId: 'lead-1',
  studentId: 'student-1',
  publicInput: {
    level: 'TERMINALE',
    examSession: 2027,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'PHYSIQUE_CHIMIE',
    moyenneRattrapage: 8.5,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'profil-1', moyenneRattrapage: 8.5 });
  mockLeadFindUnique.mockResolvedValue({ id: 'lead-1', email: 'parent@example.test' });
  mockStudentFindUnique.mockResolvedValue({
    id: 'student-1', user: { id: 'student-user-1', mergedIntoUserId: null },
    parent: { user: { id: 'parent-user-1', email: 'parent@example.test', mergedIntoUserId: null } },
  });
});

test('persists a valid decimal rattrapage average without rounding', async () => {
  await expect(createProfilCandidat(draft, 'staff-1')).resolves.toMatchObject({
    ok: true,
    profil: { moyenneRattrapage: 8.5 },
  });
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ moyenneRattrapage: 8.5 }),
  }));
});

test('the pending creation migration and Prisma schema both use floating-point storage', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260824090000_add_profil_candidat/migration.sql'),
    'utf8',
  );

  expect(schema).toMatch(/moyenneRattrapage\s+Float\?/);
  expect(migration).toMatch(/"moyenneRattrapage" DOUBLE PRECISION/);
  expect(migration).not.toMatch(/"moyenneRattrapage" INTEGER/);
});
