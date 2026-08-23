jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/guards', () => ({
  requireAuth: jest.fn(),
  requireParentOwnsStudent: jest.fn(),
  requireAnyRole: jest.fn(),
  isErrorResponse: (v: unknown) => v instanceof Response,
}));
jest.mock('@/lib/quotes/diagnostic.server', () => ({
  loadRawDomainScores: jest.fn(),
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  createQuote: jest.fn(),
  listQuotesForLeadOrStudent: jest.fn(),
}));
jest.mock('@/lib/crm/contact-leads', () => {
  const actual = jest.requireActual('@/lib/crm/contact-leads');
  return { ...actual, captureContactLead: jest.fn() };
});

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/quotes/route';
import { requireAnyRole } from '@/lib/guards';
import { listQuotesForLeadOrStudent } from '@/lib/quotes/persistence.server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockListQuotes = listQuotesForLeadOrStudent as jest.Mock;

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/quotes');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new NextRequest(url);
}

describe('GET /api/quotes (history)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects a non-staff caller', async () => {
    mockRequireAnyRole.mockResolvedValue(new Response('forbidden', { status: 403 }));
    const res = await GET(makeRequest({ contactLeadId: 'lead-1' }));
    expect(res.status).toBe(403);
    expect(mockListQuotes).not.toHaveBeenCalled();
  });

  test('rejects a query with neither contactLeadId nor studentId', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockListQuotes).not.toHaveBeenCalled();
  });

  test('returns the quote history for a lead', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    mockListQuotes.mockResolvedValue([
      {
        id: 'quote-1',
        status: 'DEVIS_ENVOYE',
        monthlyTotal: 620,
        grandTotal: 6200,
        examSession: 2027,
        createdAt: new Date('2027-01-01'),
        updatedAt: new Date('2027-01-01'),
        validUntil: new Date('2027-02-01'),
      },
    ]);
    const res = await GET(makeRequest({ contactLeadId: 'lead-1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.quotes).toHaveLength(1);
    expect(json.quotes[0]).not.toHaveProperty('revisionNumber');
    expect(json.quotes[0]).not.toHaveProperty('previousRevisionId');
    expect(mockListQuotes).toHaveBeenCalledWith({ contactLeadId: 'lead-1', studentId: undefined });
  });

  test('never leaks a teacher-cost/margin key even if the persistence layer accidentally returned one', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    mockListQuotes.mockResolvedValue([
      {
        id: 'quote-1',
        status: 'ESTIMATION',
        monthlyTotal: 620,
        grandTotal: 6200,
        examSession: 2027,
        createdAt: new Date('2027-01-01'),
        updatedAt: new Date('2027-01-01'),
        validUntil: new Date('2027-02-01'),
        teacherCost: 999,
      },
    ]);
    const res = await GET(makeRequest({ studentId: 'student-1' }));
    const json = await res.json();
    expect(JSON.stringify(json).toLowerCase()).not.toContain('teachercost');
  });

  test('sets Cache-Control: private, no-store', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    mockListQuotes.mockResolvedValue([]);
    const res = await GET(makeRequest({ studentId: 'student-1' }));
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/);
  });
});
