jest.mock('server-only', () => ({}));

import { readFileSync } from 'fs';
import { join } from 'path';

const mockCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    profilCandidat: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

import { createProfilCandidat } from '@/lib/quotes/profil-candidat.server';

const draft = {
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
