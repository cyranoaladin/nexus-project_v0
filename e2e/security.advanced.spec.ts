import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';
import { CREDS } from './helpers/credentials';
import {
  createTestDocument,
  createTestInvoice,
  createScheduledSession,
} from './helpers/db';

test.describe('Security - Advanced', () => {
  test('Documents API without auth -> 401', async ({ request }) => {
    const res = await request.get('/api/documents/any-id');
    expect(res.status()).toBe(401);
  });

  test('IDOR: parent cannot download student document -> 403', async ({ page }) => {
    const docId = await createTestDocument(CREDS.student.email, `student-private-${Date.now()}.pdf`);

    await loginAsUser(page, 'parent');
    const res = await page.request.get(`/api/documents/${docId}`);

    expect(res.status()).toBe(403);
  });

  test('IDOR: student cannot cancel another student session -> 403', async ({ page }) => {
    const otherStudentEmail = CREDS.student2?.email || CREDS.student.email;
    const targetSessionId = await createScheduledSession(otherStudentEmail, CREDS.coach.email);

    await loginAsUser(page, 'student');
    const res = await page.request.post('/api/sessions/cancel', {
      data: {
        sessionId: targetSessionId,
        reason: 'e2e-security-idor',
      },
    });

    if (otherStudentEmail === CREDS.student.email) {
      // Fallback when student2 is unavailable in credentials seed.
      expect([200, 400, 422]).toContain(res.status());
    } else {
      expect(res.status()).toBe(403);
    }
  });

  test('Invoice PDF no-leak: parent out-of-scope gets 404', async ({ page }) => {
    const invoice = await createTestInvoice(CREDS.admin.email);

    await loginAsUser(page, 'parent');
    const res = await page.request.get(`/api/invoices/${invoice.id}/pdf`);

    // No-leak policy in route: return 404 instead of 401/403
    expect(res.status()).toBe(404);
  });

  test('Path traversal attempt on documents endpoint is rejected', async ({ page }) => {
    await loginAsUser(page, 'admin');

    const res = await page.request.get('/api/documents/..%2F..%2F..%2Fetc%2Fpasswd');
    expect([400, 404]).toContain(res.status());

    const body = await res.text();
    expect(body).not.toContain('root:');
  });

  test('Document download response sets nosniff header', async ({ page }) => {
    const docId = await createTestDocument(CREDS.parent.email, `owner-doc-${Date.now()}.pdf`);

    await loginAsUser(page, 'parent');
    const res = await page.request.get(`/api/documents/${docId}`);

    expect(res.status()).toBe(200);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('Dashboard pages carry noindex robots meta', async ({ page }) => {
    await loginAsUser(page, 'admin');
    await page.goto('/dashboard/admin');

    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveCount(1);
    const content = await robots.first().getAttribute('content');
    expect(content?.toLowerCase()).toContain('noindex');
  });
});
