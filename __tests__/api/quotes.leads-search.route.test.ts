import { GET } from '@/app/api/quotes/leads/search/route';

describe('retired GET /api/quotes/leads/search', () => {
  it('returns 405 without accepting query-string search data', async () => {
    const response = await GET(new Request('http://localhost/api/quotes/leads/search?q=parent@example.test'));

    expect(response.status).toBe(405);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({ error: 'METHOD_NOT_ALLOWED' });
  });
});
