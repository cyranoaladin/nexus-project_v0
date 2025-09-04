import { expect, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3003';

async function waitStatus(page, id: string, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await page.request.get(`${BASE}/api/bilans/${id}/status`);
    if (!r.ok()) throw new Error('status endpoint failed');
    const js = await r.json();
    if (js.status === 'done') return 'done';
    if (js.status === 'error') throw new Error('job error');
    await page.waitForTimeout(500);
  }
  throw new Error('status timeout');
}

test.describe('Bilan PDF download', () => {
  test('start → status → download (eleve)', async ({ page }) => {
    const start = await page.request.post(`${BASE}/api/bilan/start?variant=eleve`);
    expect(start.ok()).toBeTruthy();
    const js = await start.json();
    const id = js.id as string;
    expect(typeof id).toBe('string');
    await waitStatus(page, id);
    const dl = await page.request.get(`${BASE}/api/bilans/${id}/download`);
    expect(dl.ok()).toBeTruthy();
    expect((dl.headers()['content-type'] || '').includes('application/pdf')).toBeTruthy();
    const buf = Buffer.from(await dl.body());
    expect(buf.length).toBeGreaterThan(50_000);
  });
});
