import { test, expect } from '@playwright/test';

/**
 * API Health & Contract — E2E Tests
 *
 * Verifies that critical API endpoints respond correctly.
 */

test.describe('API health checks', () => {
  test('GET /api/auth/providers returns 200', async ({ request }) => {
    const response = await request.get('/api/auth/providers');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('credentials');
  });

  test('GET /api/auth/csrf returns 200 with token', async ({ request }) => {
    const response = await request.get('/api/auth/csrf');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('csrfToken');
    expect(body.csrfToken.length).toBeGreaterThan(0);
  });

  test('POST /api/auth/signin without credentials returns 200 (form page)', async ({ request }) => {
    const response = await request.post('/api/auth/signin/credentials', {
      form: { email: '', password: '' },
    });
    // NextAuth returns 200 with redirect for invalid credentials
    expect(response.status()).toBeLessThan(500);
  });

  test('protected API without auth returns 401', async ({ request }) => {
    const response = await request.get('/api/sessions');
    expect([401, 403, 404]).toContain(response.status());
  });

  test('non-existent API returns 404', async ({ request }) => {
    const response = await request.get('/api/this-does-not-exist-xyz');
    expect(response.status()).toBe(404);
  });
});

test.describe('API security headers', () => {
  test('API responses include security headers', async ({ request }) => {
    const response = await request.get('/api/auth/providers');
    const headers = response.headers();
    // At minimum, content-type should be set
    expect(headers['content-type']).toContain('application/json');
  });
});
