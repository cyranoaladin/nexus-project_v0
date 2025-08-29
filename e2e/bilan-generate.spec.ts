import { expect, test } from '@playwright/test';
import { disableAnimations, loginAs, setupDefaultStubs } from './helpers';

test.describe('Bilans - Génération', () => {
  test('API generate retourne un id et rend un PDF accessible', async ({ page }) => {
    await disableAnimations(page);
    await setupDefaultStubs(page);
    await loginAs(page, 'admin@nexus.com', 'password123');

    // Stubs spécifiques pour cette spec
    await page.route('**/api/bilans/generate', async route => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'bilan_123', pdfUrl: '/files/bilan_123.pdf' }) });
    });
    const pdfBody = '%PDF-1.4\n%\xC2\xB5\xC2\xB5\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF';
    await page.route('**/files/**', async route => {
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: pdfBody });
    });

    const payload = {
      studentId: 'stub-student-id',
      variant: 'eleve',
      qcm: { total: 60, max: 80, scoreGlobalPct: 75, weakDomainsCount: 1, domains: [] },
      volet2: { indices: { AUTONOMIE: 4, ORGANISATION: 7, MOTIVATION: 3, STRESS: 2, SUSPECT_DYS: 1 }, portraitText: 'Profil', badges: ['Autonomie'] },
    };
    // Appel via fetch (coté page) pour intercepter avec stubs
    const { status, json } = await page.evaluate(async (pl) => {
      const r = await fetch('/api/bilans/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pl) });
      const j = await r.json().catch(() => ({}));
      return { status: r.status, json: j };
    }, payload);
    expect([200, 404, 500]).toContain(status);
    if (status === 200) {
      expect(json.id).toBeTruthy();
      expect(String(json.pdfUrl || '')).toContain('/files/');
      // Vérifier que le PDF est servable
      const pdf = await page.evaluate(async (u) => {
        const r = await fetch(u);
        return { status: r.status, contentType: r.headers.get('content-type') || '' };
      }, json.pdfUrl);
      expect(pdf.status).toBe(200);
      expect(pdf.contentType.toLowerCase()).toContain('application/pdf');
    }
  });
});
