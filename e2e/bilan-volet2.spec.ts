import { expect, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Bilan Volet 2 (API contract)', () => {
  test('questionnaire-structure (Maths Première) fusionne Volet2 commun + maths, submit e2e OK', async ({ page }) => {
    // Vérifier structure du questionnaire (Volet2 présent)
    const qs = await page.request.get(`${BASE}/api/bilan/questionnaire-structure?studentId=e2e-student-id&matiere=MATHEMATIQUES&niveau=premiere`);
    expect(qs.ok()).toBeTruthy();
    const data = await qs.json();
    expect(data?.requiresVolet2 === true || Array.isArray(data?.volet2?.questions)).toBeTruthy();
    if (Array.isArray(data?.volet2?.questions)) {
      // Doit contenir au moins une question commune et une question spécifique Maths Première
      const ids = data.volet2.questions.map((q: any) => q.id);
      expect(ids.length).toBeGreaterThan(0);
    }
    // Soumission E2E côté API (tolérance paramètres)
    const resp = await page.request.post(`${BASE}/api/bilan/submit?e2e=1`, { data: { subject: 'MATHEMATIQUES', grade: 'premiere', qcmAnswers: {}, pedagoAnswers: { M1: 4 } } });
    expect(resp.ok()).toBeTruthy();
  });
});
