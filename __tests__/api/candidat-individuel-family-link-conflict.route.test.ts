import { NextRequest, NextResponse } from 'next/server';

const mockIssue = jest.fn();
const mockFindUnique = jest.fn();

jest.mock('@/lib/quotes/candidat-individuel-guard.server', () => ({
  requireInternalPipelineAccess: jest.fn(async () => ({ user: { id: 'staff-1', role: 'ASSISTANTE' } })),
}));

jest.mock('@/lib/guards', () => ({
  isErrorResponse: (value: unknown) => value instanceof NextResponse,
}));

jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn(async () => null),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    quote: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

jest.mock('@/lib/quotes/persistence.server', () => ({
  issueOrRotateFamilyLink: (...args: unknown[]) => mockIssue(...args),
}));

import { POST } from '@/app/api/assistante/candidat-individuel/quotes/[quoteId]/family-link/route';

const UPDATED_AT = new Date('2026-08-29T12:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  mockFindUnique.mockResolvedValue({
    profilId: 'profil-1',
    updatedAt: UPDATED_AT,
    publicTokenHash: 'server-only-expected-hash',
  });
});

test('maps a stale concurrent rotation to an explicit 409 without returning a URL', async () => {
  mockIssue.mockResolvedValue({ ok: false, conflict: true });

  const response = await POST(
    new NextRequest('https://nexus.test/api/assistante/candidat-individuel/quotes/quote-1/family-link', { method: 'POST' }),
    { params: Promise.resolve({ quoteId: 'quote-1' }) },
  );

  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toEqual({
    error: 'Le devis a changé. Actualisez avant de renouveler le lien famille.',
  });
  expect(mockIssue).toHaveBeenCalledWith('quote-1', 'staff-1', {
    updatedAt: UPDATED_AT,
    publicTokenHash: 'server-only-expected-hash',
  });
});
