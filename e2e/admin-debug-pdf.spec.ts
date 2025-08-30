import { test, expect } from '@playwright/test';

// Skip this spec when remote PDF microservice is disabled or in E2E mode without infra
test.skip(
  process.env.PDF_REMOTE_DISABLED === '1' || process.env.NEXT_PUBLIC_E2E === '1',
  'Remote PDF microservice is disabled in E2E; skipping remote PDF debug spec.'
);

// E2E: Admin Debug PDF page generates a PDF via microservice and returns a downloadable URL
// Assumes the dev server is running on http://localhost:${E2E_PORT||3000}

test.describe('Admin Debug PDF (ARIA)', () => {
  test('generates a PDF and exposes a valid download URL', async ({ page, request }) => {
    // Go directly to the debug page (middleware bypass enabled in E2E mode)
    await page.goto('/dashboard/admin/debug/pdf');

    // Ensure the page loaded (robust heading match)
    await expect(page.getByRole('heading', { name: /debug pdf/i })).toBeVisible();

    // Optionally edit content or subject; by default the page has preset values
    const generateBtn = page.getByTestId('debug-generate-pdf');
    await generateBtn.click();

    // Wait for the link to appear (robust link match)
    const link = page.getByRole('link', { name: /télécharger|download/i });
    await expect(link).toBeVisible({ timeout: 20000 });

    const href = await link.getAttribute('href');
    expect(href, 'Expected a valid download URL').toBeTruthy();
    expect(href!).toMatch(/\/pdfs\/.+\.pdf$/);

    // Fetch the PDF via APIRequestContext to validate headers and size
    const res = await request.get(href!);
    expect(res.ok(), 'PDF GET should return 200').toBeTruthy();
    const ctype = res.headers()['content-type'] || '';
    expect(ctype.includes('application/pdf')).toBeTruthy();
    const body = await res.body();
    expect(body.length).toBeGreaterThan(5 * 1024); // > 5KB
  });
});
