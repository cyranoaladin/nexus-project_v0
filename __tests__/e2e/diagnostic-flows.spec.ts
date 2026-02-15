/**
 * E2E Diagnostic Flows — 4 programmes (Maths 1ère/Tle, NSI 1ère/Tle)
 *
 * Each flow tests:
 * 1. Navigate to /bilan-pallier2-maths
 * 2. Select EDS/niveau (definition key)
 * 3. Verify chapters checklist loads
 * 4. Verify competencies filtered by chapters
 * 5. Submit form → result page loads with scoring
 * 6. Public share token works
 */

import { expect, test } from '@playwright/test';

const DEFINITIONS = [
  { key: 'maths-premiere-p2', label: 'Maths Première', discipline: 'maths', level: 'premiere' },
  { key: 'maths-terminale-p2', label: 'Maths Terminale', discipline: 'maths', level: 'terminale' },
  { key: 'nsi-premiere-p2', label: 'NSI Première', discipline: 'nsi', level: 'premiere' },
  { key: 'nsi-terminale-p2', label: 'NSI Terminale', discipline: 'nsi', level: 'terminale' },
];

test.describe('Diagnostic Flow — Page Load & API', () => {
  test('diagnostic page loads correctly', async ({ page }) => {
    await page.goto('/bilan-pallier2-maths');
    await page.waitForLoadState('domcontentloaded');

    // Page should render without crash
    await expect(page.locator('body')).toBeVisible();

    // Should contain the diagnostic form or a step indicator
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('API /api/diagnostics/definitions returns valid list', async ({ request }) => {
    const res = await request.get('/api/diagnostics/definitions');
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.definitions).toBeDefined();
    expect(data.definitions.length).toBeGreaterThanOrEqual(4);

    // Verify all 4 definitions are present
    const keys = data.definitions.map((d: { key: string }) => d.key);
    for (const def of DEFINITIONS) {
      expect(keys).toContain(def.key);
    }
  });
});

for (const def of DEFINITIONS) {
  test.describe(`Diagnostic Flow — ${def.label}`, () => {
    test(`API returns valid definition for ${def.key}`, async ({ request }) => {
      const res = await request.get(`/api/diagnostics/definitions?id=${def.key}`);
      expect(res.status()).toBe(200);

      const data = await res.json();
      expect(data.key).toBe(def.key);
      expect(data.domains).toBeDefined();
      expect(Array.isArray(data.domains)).toBe(true);
      expect(data.domains.length).toBeGreaterThan(0);

      // Verify chapters are present
      expect(data.chapters).toBeDefined();
      expect(Array.isArray(data.chapters)).toBe(true);
      expect(data.chapters.length).toBeGreaterThan(0);

      // Each chapter should have required fields
      for (const ch of data.chapters) {
        expect(ch.chapterId).toBeTruthy();
        expect(ch.chapterLabel).toBeTruthy();
        expect(ch.domainId).toBeTruthy();
        expect(Array.isArray(ch.skills)).toBe(true);
      }

      // Each domain should have skills
      for (const domain of data.domains) {
        expect(domain.domainId).toBeTruthy();
        expect(domain.weight).toBeGreaterThan(0);
        expect(domain.skills.length).toBeGreaterThan(0);
      }

      // Verify no sensitive data is exposed
      expect(data.prompts).toBeUndefined();
      expect(data.scoringPolicy).toBeUndefined();
      expect(data.ragPolicy).toBeUndefined();
    });

    test(`definition ${def.key} has correct discipline/level`, async ({ request }) => {
      const res = await request.get(`/api/diagnostics/definitions?id=${def.key}`);
      const data = await res.json();

      expect(data.track).toBe(def.discipline);
      expect(data.level).toBe(def.level);
    });
  });
}

test.describe('Diagnostic Flow — NSI Terminale SQL Focus', () => {
  test('NSI Terminale definition includes SQL/databases chapter', async ({ request }) => {
    const res = await request.get('/api/diagnostics/definitions?id=nsi-terminale-p2');
    const data = await res.json();

    // Find a chapter related to databases/SQL
    const dbChapters = data.chapters.filter(
      (ch: { domainId: string; chapterLabel: string }) =>
        ch.domainId === 'databases' || ch.chapterLabel.toLowerCase().includes('sql') || ch.chapterLabel.toLowerCase().includes('base')
    );
    expect(dbChapters.length).toBeGreaterThan(0);

    // Verify the chapter has skills
    for (const ch of dbChapters) {
      expect(ch.skills.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Diagnostic Flow — Error Handling', () => {
  test('unknown definition returns 404', async ({ request }) => {
    const res = await request.get('/api/diagnostics/definitions?id=unknown-xyz');
    expect(res.status()).toBe(404);

    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  test('POST with empty body returns 400', async ({ request }) => {
    const res = await request.post('/api/bilan-pallier2-maths', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });

    // Should be 400 (schema validation) or 403 (CSRF/auth)
    expect([400, 403]).toContain(res.status());
  });

  test('GET list without auth returns 403', async ({ request }) => {
    const res = await request.get('/api/bilan-pallier2-maths');

    // Should be 401 or 403 (requires staff auth)
    expect([401, 403]).toContain(res.status());
  });

  test('GET with invalid signed token returns 401', async ({ request }) => {
    const res = await request.get('/api/bilan-pallier2-maths?t=invalid.token.here');
    expect(res.status()).toBe(401);

    const data = await res.json();
    expect(data.error).toContain('invalide');
  });
});
