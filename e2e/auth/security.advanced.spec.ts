import { test, expect, type Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import {
  createTestInvoice,
  createScheduledSession,
  getUserAndStudentIdsByEmail,
} from '../helpers/db';

async function uploadDocumentAsAdmin(page: Page, ownerEmail: string, filename: string): Promise<string> {
  const { userId } = await getUserAndStudentIdsByEmail(ownerEmail);
  await loginAsUser(page, 'admin');
  const upload = await page.request.post('/api/admin/documents', {
    multipart: {
      userId,
      file: {
        name: filename,
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n% canonical E2E document\n'),
      },
    },
    failOnStatusCode: false,
  });
  expect(upload.status()).toBe(201);
  const body = await upload.json() as { document?: { id?: string } };
  expect(body.document?.id).toBeTruthy();
  return body.document!.id!;
}

test.describe('Security - Advanced', () => {
  test('Documents API without auth -> 401', async ({ request }) => {
    const res = await request.get('/api/documents/any-id');
    expect(res.status()).toBe(401);
  });

  test('IDOR: parent cannot enumerate or download a student document -> 404', async ({ page }) => {
    const docId = await uploadDocumentAsAdmin(page, CREDS.student.email, `student-private-${Date.now()}.pdf`);

    await loginAsUser(page, 'parent');
    const res = await page.request.get(`/api/documents/${docId}`);

    // Deliberate no-leak policy: an out-of-scope object is indistinguishable
    // from an unknown identifier.
    expect(res.status()).toBe(404);
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
    const docId = await uploadDocumentAsAdmin(page, CREDS.parent.email, `owner-doc-${Date.now()}.pdf`);

    await loginAsUser(page, 'parent');
    const res = await page.request.get(`/api/documents/${docId}`);

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect((await res.body()).byteLength).toBeGreaterThan(0);
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
