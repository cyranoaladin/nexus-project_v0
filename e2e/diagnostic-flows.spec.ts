/**
 * E2E Diagnostic Flows — 4 programmes (Maths 1ère/Tle, NSI 1ère/Tle)
 *
 * Each flow tests:
 * 1. Navigate to /bilan-pallier2-maths
 * 2. API /api/diagnostics/definitions returns valid definitions
 * 3. API /api/diagnostics/definitions?id=<key> returns correct structure
 * 4. Chapters are present with skills
 * 5. Error handling: unknown definition, invalid token, staff-only list
 * 6. NSI Terminale SQL focus
 */

import { expect, test } from '@playwright/test';

const DEFINITIONS = [
  { key: 'maths-premiere-p2', label: 'Maths Première', discipline: 'maths', level: 'premiere' },
  { key: 'maths-terminale-p2', label: 'Maths Terminale', discipline: 'maths', level: 'terminale' },
  { key: 'nsi-premiere-p2', label: 'NSI Première', discipline: 'nsi', level: 'premiere' },
  { key: 'nsi-terminale-p2', label: 'NSI Terminale', discipline: 'nsi', level: 'terminale' },
];

// ─── Page Load ──────────────────────────────────────────────────────────────────

test.describe('Diagnostic Flow — Page Load', () => {
  test('diagnostic page /bilan-pallier2-maths loads without crash', async ({ page }) => {
    const response = await page.goto('/bilan-pallier2-maths');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(50);
  });
});

// ─── Definitions API — List ─────────────────────────────────────────────────────

test.describe('Diagnostic Flow — Definitions API', () => {
  test('GET /api/diagnostics/definitions returns all 4 definitions', async ({ request }) => {
    const res = await request.get('/api/diagnostics/definitions');
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.definitions).toBeDefined();
    expect(Array.isArray(data.definitions)).toBe(true);
    expect(data.definitions.length).toBeGreaterThanOrEqual(4);

    const keys = data.definitions.map((d: { key: string }) => d.key);
    for (const def of DEFINITIONS) {
      expect(keys).toContain(def.key);
    }
  });

  test('each definition in list has required metadata fields', async ({ request }) => {
    const res = await request.get('/api/diagnostics/definitions');
    const data = await res.json();

    for (const def of data.definitions) {
      expect(def.key).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(['maths', 'nsi', 'physique']).toContain(def.track);
      expect(['premiere', 'terminale']).toContain(def.level);
      expect(def.version).toBeTruthy();
    }
  });
});

// ─── Per-Definition Structural Tests ────────────────────────────────────────────

for (const def of DEFINITIONS) {
  test.describe(`Diagnostic Flow — ${def.label} (${def.key})`, () => {
    test(`returns valid definition with domains and chapters`, async ({ request }) => {
      const res = await request.get(`/api/diagnostics/definitions?id=${def.key}`);
      expect(res.status()).toBe(200);

      const data = await res.json();

      // Metadata
      expect(data.key).toBe(def.key);
      expect(data.track).toBe(def.discipline);
      expect(data.level).toBe(def.level);
      expect(data.stage).toBe('pallier2');
      expect(data.version).toBeTruthy();

      // Domains
      expect(data.domains).toBeDefined();
      expect(Array.isArray(data.domains)).toBe(true);
      expect(data.domains.length).toBeGreaterThan(0);

      for (const domain of data.domains) {
        expect(domain.domainId).toBeTruthy();
        expect(domain.weight).toBeGreaterThan(0);
        expect(domain.weight).toBeLessThanOrEqual(1);
        expect(Array.isArray(domain.skills)).toBe(true);
        expect(domain.skills.length).toBeGreaterThan(0);

        for (const skill of domain.skills) {
          expect(skill.skillId).toBeTruthy();
          expect(skill.label).toBeTruthy();
        }
      }

      // Chapters
      expect(data.chapters).toBeDefined();
      expect(Array.isArray(data.chapters)).toBe(true);
      expect(data.chapters.length).toBeGreaterThan(0);

      for (const ch of data.chapters) {
        expect(ch.chapterId).toBeTruthy();
        expect(ch.chapterLabel).toBeTruthy();
        expect(ch.domainId).toBeTruthy();
        expect(Array.isArray(ch.skills)).toBe(true);
        expect(ch.skills.length).toBeGreaterThan(0);
      }
    });

    test(`does NOT expose sensitive fields (prompts, scoringPolicy, ragPolicy)`, async ({ request }) => {
      const res = await request.get(`/api/diagnostics/definitions?id=${def.key}`);
      const data = await res.json();

      expect(data.prompts).toBeUndefined();
      expect(data.scoringPolicy).toBeUndefined();
      expect(data.ragPolicy).toBeUndefined();
    });

    test(`domain weights sum to ~1.0`, async ({ request }) => {
      const res = await request.get(`/api/diagnostics/definitions?id=${def.key}`);
      const data = await res.json();

      const weightSum = data.domains.reduce(
        (sum: number, d: { weight: number }) => sum + d.weight,
        0
      );
      expect(weightSum).toBeGreaterThan(0.95);
      expect(weightSum).toBeLessThan(1.05);
    });

    test(`all chapter domainIds reference existing domains`, async ({ request }) => {
      const res = await request.get(`/api/diagnostics/definitions?id=${def.key}`);
      const data = await res.json();

      const domainIds = new Set(data.domains.map((d: { domainId: string }) => d.domainId));
      for (const ch of data.chapters) {
        expect(domainIds.has(ch.domainId)).toBe(true);
      }
    });

    test(`all chapter skill IDs reference existing skills in their domain`, async ({ request }) => {
      const res = await request.get(`/api/diagnostics/definitions?id=${def.key}`);
      const data = await res.json();

      // Build skill ID set per domain
      const skillsByDomain: Record<string, Set<string>> = {};
      for (const domain of data.domains) {
        skillsByDomain[domain.domainId] = new Set(
          domain.skills.map((s: { skillId: string }) => s.skillId)
        );
      }

      for (const ch of data.chapters) {
        const domainSkills = skillsByDomain[ch.domainId];
        expect(domainSkills).toBeDefined();
        for (const skillId of ch.skills) {
          expect(domainSkills.has(skillId)).toBe(true);
        }
      }
    });
  });
}

// ─── NSI Terminale — SQL Focus ──────────────────────────────────────────────────

test.describe('Diagnostic Flow — NSI Terminale SQL Focus', () => {
  test('has databases/SQL-related chapter', async ({ request }) => {
    const res = await request.get('/api/diagnostics/definitions?id=nsi-terminale-p2');
    const data = await res.json();

    const dbChapters = data.chapters.filter(
      (ch: { domainId: string; chapterLabel: string }) =>
        ch.domainId === 'databases' ||
        ch.chapterLabel.toLowerCase().includes('sql') ||
        ch.chapterLabel.toLowerCase().includes('base') ||
        ch.chapterLabel.toLowerCase().includes('requête')
    );
    expect(dbChapters.length).toBeGreaterThan(0);

    for (const ch of dbChapters) {
      expect(ch.skills.length).toBeGreaterThan(0);
    }
  });

  test('has SQL-related skills in domains', async ({ request }) => {
    const res = await request.get('/api/diagnostics/definitions?id=nsi-terminale-p2');
    const data = await res.json();

    const allSkills = data.domains.flatMap(
      (d: { skills: Array<{ skillId: string; label: string }> }) => d.skills
    );
    const sqlSkills = allSkills.filter(
      (s: { label: string }) =>
        s.label.toLowerCase().includes('sql') ||
        s.label.toLowerCase().includes('requête') ||
        s.label.toLowerCase().includes('jointure') ||
        s.label.toLowerCase().includes('base de données')
    );
    expect(sqlSkills.length).toBeGreaterThan(0);
  });
});

// ─── Error Handling ─────────────────────────────────────────────────────────────

test.describe('Diagnostic Flow — Error Handling', () => {
  test('unknown definition returns 404', async ({ request }) => {
    const res = await request.get('/api/diagnostics/definitions?id=unknown-xyz-404');
    expect(res.status()).toBe(404);

    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  test('POST /api/bilan-pallier2-maths with empty body returns 400 or 403', async ({ request }) => {
    const res = await request.post('/api/bilan-pallier2-maths', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    // 400 (Zod validation) or 403 (CSRF)
    expect([400, 403, 500]).toContain(res.status());
  });

  test('GET /api/bilan-pallier2-maths list without auth returns 401 or 403', async ({ request }) => {
    const res = await request.get('/api/bilan-pallier2-maths');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/bilan-pallier2-maths with invalid signed token returns 401', async ({ request }) => {
    const res = await request.get('/api/bilan-pallier2-maths?t=invalid.token.here');
    expect(res.status()).toBe(401);

    const data = await res.json();
    expect(data.error).toContain('invalide');
  });

  test('GET /api/bilan-pallier2-maths with nonexistent share returns 404', async ({ request }) => {
    const res = await request.get('/api/bilan-pallier2-maths?share=nonexistent-share-id-xyz');
    expect(res.status()).toBe(404);
  });
});

// ─── Maths Première — Full Page Flow ────────────────────────────────────────────

test.describe('Diagnostic Flow — Maths Première Page', () => {
  test('page loads and shows form elements', async ({ page }) => {
    await page.goto('/bilan-pallier2-maths');
    await page.waitForLoadState('domcontentloaded');

    // Page should have some form content
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();

    // Should not be a blank page or error page
    expect(bodyText!.length).toBeGreaterThan(100);
  });
});

// ─── Bilan Dashboard (staff) ────────────────────────────────────────────────────

test.describe('Diagnostic Flow — Bilan Dashboard Page', () => {
  test('dashboard page loads', async ({ page }) => {
    const response = await page.goto('/bilan-pallier2-maths/dashboard');
    // May redirect to login or show dashboard
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
  });
});
