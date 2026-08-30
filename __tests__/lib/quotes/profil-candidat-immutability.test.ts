jest.mock('server-only', () => ({}));

const mockProfilFindUnique = jest.fn();
const mockProfilUpdate = jest.fn();
const mockQuoteFindFirst = jest.fn();
const mockQueryRaw = jest.fn();
const mockLeadFindUnique = jest.fn();
const mockStudentFindUnique = jest.fn();

const mockTx = {
  $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  profilCandidat: {
    findUnique: (...args: unknown[]) => mockProfilFindUnique(...args),
    update: (...args: unknown[]) => mockProfilUpdate(...args),
  },
  quote: {
    findFirst: (...args: unknown[]) => mockQuoteFindFirst(...args),
  },
  contactLead: { findUnique: (...args: unknown[]) => mockLeadFindUnique(...args) },
  student: { findUnique: (...args: unknown[]) => mockStudentFindUnique(...args) },
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: async (callback: (transaction: typeof mockTx) => Promise<unknown>) => callback(mockTx),
    profilCandidat: {
      findUnique: (...args: unknown[]) => mockProfilFindUnique(...args),
      update: (...args: unknown[]) => mockProfilUpdate(...args),
    },
    quote: {
      findFirst: (...args: unknown[]) => mockQuoteFindFirst(...args),
    },
  },
}));

import { updateProfilCandidat } from '@/lib/quotes/profil-candidat.server';

const VALID_DRAFT = {
  contactLeadId: 'lead-1',
  studentId: 'student-1',
  publicInput: {
    level: 'TERMINALE',
    examSession: 2027,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'PHYSIQUE_CHIMIE',
  },
};

describe('updateProfilCandidat — quote immutability boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRaw.mockResolvedValue([{ id: 'profil-1', updatedAt: new Date('2026-08-29T08:00:00.000Z') }]);
    mockProfilFindUnique.mockResolvedValue({ id: 'profil-1' });
    mockLeadFindUnique.mockResolvedValue({ id: 'lead-1', email: 'parent@example.test' });
    mockStudentFindUnique.mockResolvedValue({ id: 'student-1', user: { id: 'student-user-1', mergedIntoUserId: null }, parent: { user: { id: 'parent-user-1', email: 'parent@example.test', mergedIntoUserId: null } } });
  });

  test('rejects an in-place mutation once a Quote references the profil', async () => {
    mockQuoteFindFirst.mockResolvedValue({ id: 'quote-1' });

    const result = await updateProfilCandidat('profil-1', VALID_DRAFT);

    expect(mockQuoteFindFirst).toHaveBeenCalledWith({
      where: { profilId: 'profil-1' },
      select: { id: true },
    });
    expect(result).toEqual({ ok: false, quoteExists: true });
    expect(mockProfilUpdate).not.toHaveBeenCalled();
  });

  test('preserves normal in-place updates before the first Quote exists', async () => {
    mockQuoteFindFirst.mockResolvedValue(null);
    mockProfilUpdate.mockResolvedValue({ id: 'profil-1', specialite2: 'PHYSIQUE_CHIMIE' });

    const result = await updateProfilCandidat('profil-1', VALID_DRAFT);

    expect(result).toEqual({ ok: true, profil: expect.objectContaining({ id: 'profil-1' }) });
    expect(mockProfilUpdate).toHaveBeenCalledTimes(1);
  });
});
