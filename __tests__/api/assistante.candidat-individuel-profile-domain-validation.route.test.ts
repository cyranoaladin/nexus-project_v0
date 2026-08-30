jest.mock('server-only', () => ({}));

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockQuoteFindFirst = jest.fn().mockResolvedValue(null);
const mockQueryRaw = jest.fn().mockResolvedValue([
  { id: 'profil-1', updatedAt: new Date('2026-08-30T12:00:00.000Z') },
]);

jest.mock('@/lib/quotes/candidat-individuel-guard.server', () => ({
  requireInternalPipelineAccess: jest.fn().mockResolvedValue({
    user: { id: 'staff-1', role: 'ADMIN', email: 'admin@example.test' },
  }),
}));

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
    }),
  },
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/assistante/candidat-individuel/profils/route';
import { PATCH } from '@/app/api/assistante/candidat-individuel/profils/[id]/route';

const BASE = {
  contactLeadId: 'lead-1',
  studentId: 'student-1',
  publicInput: {
    level: 'TERMINALE',
    examSession: 2027,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'NSI',
  },
};

function request(body: unknown, method: 'POST' | 'PATCH' = 'POST') {
  return new NextRequest('http://localhost/api/assistante/candidat-individuel/profils/profil-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQuoteFindFirst.mockResolvedValue(null);
  mockQueryRaw.mockResolvedValue([{ id: 'profil-1', updatedAt: new Date('2026-08-30T12:00:00.000Z') }]);
});

test('POST conserve le contrat service structure 422 pour un vrai payload langue invalide', async () => {
  const response = await POST(request({
    ...BASE,
    publicInput: { ...BASE.publicInput, langueA: 'ANGLAIS', langueB: 'ANGLAIS' },
  }));
  expect(response.status).toBe(422);
  await expect(response.json()).resolves.toEqual(expect.objectContaining({
    error: 'LANGUES_IDENTIQUES',
    message: 'La LVA et la LVB doivent être deux langues différentes.',
    validationIssues: [expect.objectContaining({ code: 'LANGUES_IDENTIQUES', field: 'langueB' })],
  }));
  expect(mockCreate).not.toHaveBeenCalled();
});

test('PATCH conserve le contrat service structure 422 pour un vrai payload specialite invalide', async () => {
  const response = await PATCH(request({
    ...BASE,
    publicInput: { ...BASE.publicInput, specialite1: 'FRANCAIS' },
  }, 'PATCH'), { params: Promise.resolve({ id: 'profil-1' }) });
  expect(response.status).toBe(422);
  await expect(response.json()).resolves.toEqual(expect.objectContaining({
    error: 'SPECIALITE_CODE_INCONNU',
    message: "La spécialité indiquée n'est pas reconnue.",
    validationIssues: [expect.objectContaining({ code: 'SPECIALITE_CODE_INCONNU', field: 'specialite1' })],
  }));
  expect(mockUpdate).not.toHaveBeenCalled();
});
