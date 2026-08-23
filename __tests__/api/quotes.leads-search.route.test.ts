jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: (v: unknown) => v instanceof Response,
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  searchContactLeads: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/quotes/leads/search/route';
import { requireAnyRole } from '@/lib/guards';
import { searchContactLeads } from '@/lib/quotes/persistence.server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockSearch = searchContactLeads as jest.Mock;

function makeRequest(q: string | null) {
  const url = new URL('http://localhost:3000/api/quotes/leads/search');
  if (q != null) url.searchParams.set('q', q);
  return new NextRequest(url);
}

describe('GET /api/quotes/leads/search', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects a non-staff caller', async () => {
    mockRequireAnyRole.mockResolvedValue(new Response('forbidden', { status: 403 }));
    const res = await GET(makeRequest('dupont'));
    expect(res.status).toBe(403);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  test('rejects a query shorter than 2 characters', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    const res = await GET(makeRequest('d'));
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  test('rejects a missing query', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(400);
  });

  test('returns matching leads for a staff caller', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    mockSearch.mockResolvedValue([
      { id: 'lead-1', name: 'Jean Dupont', email: 'jean@example.com', phone: '+21699000000', status: 'NEW' },
    ]);
    const res = await GET(makeRequest('dupont'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.leads).toHaveLength(1);
    expect(json.leads[0].id).toBe('lead-1');
    expect(mockSearch).toHaveBeenCalledWith('dupont');
  });

  test('never returns a "notes" field even if the persistence layer accidentally included one', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    mockSearch.mockResolvedValue([
      {
        id: 'lead-1',
        name: 'Jean Dupont',
        email: 'jean@example.com',
        phone: null,
        status: 'NEW',
        notes: 'internal note that must never reach the client',
      },
    ]);
    const res = await GET(makeRequest('dupont'));
    const json = await res.json();
    expect(JSON.stringify(json)).not.toContain('internal note');
  });

  test('sets Cache-Control: private, no-store', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    mockSearch.mockResolvedValue([]);
    const res = await GET(makeRequest('dupont'));
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/);
  });
});
