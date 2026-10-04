/** @jest-environment node */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/core-v2/queries/family-authority', () => ({
  getFamilyAuthorityMode: jest.fn().mockReturnValue('HYBRID'),
  readCoreFamilyAuthority: jest.fn().mockResolvedValue({
    parentOwned: true, students: [{ id: 'synthetic-core-student', owned: true, allowed: true }],
  }),
}));
jest.mock('@/lib/guards', () => ({
  ...jest.requireActual('@/lib/guards'), requireAuth: jest.fn(),
}));
jest.mock('@/lib/quotes/persistence.server', () => ({ createQuote: jest.fn() }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quotes/route';
import { requireAuth } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { createQuote } from '@/lib/quotes/persistence.server';

test.each(['student', 'diagnostic'])('a verified Core family read never authorizes creation of a V1 quote through %s', async attachment => {
  jest.mocked(requireAuth).mockResolvedValue({
    user: { id: 'synthetic-core-parent', role: 'PARENT', email: 'parent@example.test' }, expires: '2027-01-01T00:00:00Z',
  });
  jest.mocked(prisma.student.findUnique).mockResolvedValue({
    id: 'synthetic-core-student', userId: 'synthetic-core-student-user', parent: { userId: 'synthetic-core-parent' },
  } as never);
  jest.mocked(prisma.candidateDiagnostic.findUnique).mockResolvedValue({
    id: 'synthetic-core-diagnostic', studentId: 'synthetic-core-student', modules: [], documents: [],
    student: { id: 'synthetic-core-student', userId: 'synthetic-core-student-user', user: {} },
  } as never);
  jest.mocked(createQuote).mockResolvedValue({
    quote: { id: 'synthetic-quote', validUntil: new Date('2027-01-01T00:00:00Z'), lines: [] },
    rawToken: null, alreadyExisted: false,
  } as never);
  const response = await POST(new NextRequest('http://localhost:3000/api/quotes', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: 'synthetic-family-quote-key',
      ...(attachment === 'student' ? { studentId: 'synthetic-core-student' } : { diagnosticId: 'synthetic-core-diagnostic' }),
      situation: { level: 'terminale', examSession: 2027, specialites: ['MATHEMATIQUES', 'NSI'] },
      budget: { monthlyBudgetTnd: 1000, strategy: 'BEST_BALANCE' }, scenarioTier: 'RECOMMANDE',
      contact: {
        parentName: 'Parent Synthétique', studentFirstName: 'Élève Synthétique',
        whatsapp: '+21699000000', email: 'parent@example.test', consent: true,
      },
    }),
  }));
  expect(response.status).toBe(403);
  expect(createQuote).not.toHaveBeenCalled();
});
