import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/quotes/candidat-individuel-staff-search-route.server', () => ({
  handleCandidatIndividuelStaffSearch: jest.fn(async () => NextResponse.json({ items: [] })),
}));

jest.mock('@/lib/quotes/persistence.server', () => ({ searchContactLeads: jest.fn() }));
jest.mock('@/lib/planning/staff-student-search.server', () => ({ searchPlanningStudents: jest.fn() }));

import { GET as retiredLeadGet, POST as searchQuoteLeads } from '@/app/api/quotes/leads/search/route';
import { POST as searchPlanningStudentsRoute } from '@/app/api/assistante/stages/planning/students/search/route';
import { handleCandidatIndividuelStaffSearch } from '@/lib/quotes/candidat-individuel-staff-search-route.server';
import { searchContactLeads } from '@/lib/quotes/persistence.server';
import { searchPlanningStudents } from '@/lib/planning/staff-student-search.server';

const mockHandler = handleCandidatIndividuelStaffSearch as jest.Mock;
const mockSearchLeads = searchContactLeads as jest.Mock;

describe('safe POST staff search consumers', () => {
  beforeEach(() => jest.clearAllMocks());

  test('keeps legacy lead GET closed', async () => {
    const response = await retiredLeadGet(new Request('http://localhost/api/quotes/leads/search?q=private@example.test'));
    expect(response.status).toBe(405);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({ error: 'METHOD_NOT_ALLOWED' });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  test('quotes lead POST uses strict transport without the candidate pipeline gate', async () => {
    await searchQuoteLeads(new NextRequest('http://localhost/api/quotes/leads/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'Sonia', limit: 10 }),
    }));
    expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'quotes-lead-search',
      operation: 'quote-lead-search',
      requireInternalPipeline: false,
    }));

    mockSearchLeads.mockResolvedValue([{ id: 'contact-lead-001', name: 'Sonia', email: 'sonia@example.test', phone: '+21699000000', status: 'NEW', notes: 'secret' }]);
    const search = mockHandler.mock.calls[0][0].search;
    await expect(search({ query: 'Sonia', limit: 10 })).resolves.toEqual({
      items: [{ id: 'contact-lead-001', name: 'Sonia', email: 'sonia@example.test', phone: '+21699000000' }],
    });
  });

  test('planning student POST uses its minimal service without the candidate pipeline gate', async () => {
    await searchPlanningStudentsRoute(new NextRequest('http://localhost/api/assistante/stages/planning/students/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'Yasmine', page: 1, limit: 10 }),
    }));
    expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'staff-planning-student-search',
      operation: 'planning-student-search',
      requireInternalPipeline: false,
      search: searchPlanningStudents,
    }));
  });
});
