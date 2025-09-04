import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3003';

test.describe('RAG UI', () => {
  test('search API returns results (text fallback ok)', async ({ request }) => {
    const url = new URL(`${BASE}/api/rag/search`);
    url.searchParams.set('q', 'graphes');
    url.searchParams.set('subject', 'NSI');
    url.searchParams.set('level', 'terminale');
    url.searchParams.set('k', '5');
    const r = await request.get(url.toString());
    expect(r.ok()).toBeTruthy();
    const js = await r.json();
    expect(js).toHaveProperty('ok', true);
    expect(Array.isArray(js.hits)).toBeTruthy();
  });
});

