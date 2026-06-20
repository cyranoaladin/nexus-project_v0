import { test, expect } from '@playwright/test';

test('EAF Preparation Report Smoke Test - Raja Coach', async ({ page, request }) => {
  const email = process.env.RAJA_COACH_EMAIL;
  const password = process.env.RAJA_COACH_PASSWORD;

  if (!email || !password) {
    throw new Error('RAJA_COACH_EMAIL and RAJA_COACH_PASSWORD must be set');
  }

  const BASE_URL = 'https://nexusreussite.academy';

  // 1. Login using API
  const csrfResponse = await request.get(`${BASE_URL}/api/auth/csrf`);
  const csrfJson = await csrfResponse.json();

  const authResponse = await request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: {
      csrfToken: csrfJson.csrfToken,
      email,
      password,
      callbackUrl: `${BASE_URL}/dashboard/coach`,
      json: 'true',
    },
  });

  if (!authResponse.ok()) {
    const body = await authResponse.text();
    throw new Error(`Auth failed: ${body}`);
  }

  const setCookieHeaders = authResponse.headers()['set-cookie'];
  if (!setCookieHeaders) {
    throw new Error('No session cookies returned from auth');
  }

  const cookies = [];
  for (const cookieHeader of setCookieHeaders) {
    const parts = cookieHeader.split(';');
    const [nameValue] = parts;
    const [name, value] = nameValue.split('=');
    if (name && value) {
      cookies.push({ name, value, domain: 'nexusreussite.academy', path: '/' });
    }
  }

  await page.context().addCookies(cookies);

  // Capture API responses to debug
  const apiResponses: any[] = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/coach/students/') && url.includes('/dossier')) {
      try {
        const json = await response.json();
        const safeData = {
          url: url.replace(/localhost:3001/g, '<PROD_URL>'),
          status: response.status(),
          student: json.student ? {
            id: json.student.id,
            name: '***MASKED***',
            gradeLevel: json.student.gradeLevel,
            academicTrack: json.student.academicTrack,
          } : undefined,
        };
        apiResponses.push(safeData);
        console.log('API Response:', JSON.stringify(safeData, null, 2));
      } catch (e) {
        console.log('Failed to parse JSON from:', url);
      }
    }
  });

  // 2. Navigate to coach dashboard
  await page.goto(`${BASE_URL}/dashboard/coach`);
  await page.waitForLoadState('domcontentloaded');

  // 3. Open assigned student dossier directly
  // Use a known Première student ID from database query
  const studentId = 'cherif_student_001';
  await page.goto(`${BASE_URL}/dashboard/coach/students/${studentId}`);
  await page.waitForLoadState('domcontentloaded');

  // Check if we're on the right page
  const currentUrl = page.url();
  const pageTitle = await page.title();
  console.log('\n=== PAGE NAVIGATION CHECK ===');
  console.log(`Current URL: ${currentUrl}`);
  console.log(`Page title: ${pageTitle}`);

  // Log API responses captured
  console.log('\n=== API RESPONSES SUMMARY ===');
  console.log(`Total API responses captured: ${apiResponses.length}`);
  if (apiResponses.length > 0) {
    console.log('First response:', JSON.stringify(apiResponses[0], null, 2));
  }

  // Check page content for debugging
  const pageContent = await page.content();
  const hasEAFText = pageContent.includes('Bilan de préparation à l\'EAF');
  const hasEafPreparationReport = pageContent.includes('EafPreparationReport');
  const hasPremiereText = pageContent.includes('PREMIERE') || pageContent.includes('Première');
  
  console.log('\n=== PAGE CONTENT CHECK ===');
  console.log(`Has "Bilan de préparation à l\'EAF" text: ${hasEAFText}`);
  console.log(`Has "EafPreparationReport" component: ${hasEafPreparationReport}`);
  console.log(`Has "PREMIERE" or "Première" text: ${hasPremiereText}`);

  // 4. Verify EAF section is visible using data-testid
  const eafSection = page.locator('[data-testid="eaf-preparation-report"]');
  await expect(eafSection).toBeVisible({ timeout: 5000 });

  // 5. Fill two rubrics
  const linearReadingTextarea = page.locator('textarea[placeholder*="Lecture linéaire"], textarea[aria-label*="Lecture"], textarea').first();
  await linearReadingTextarea.fill('[TEST GO-LIVE EAF - À SUPPRIMER] Lecture linéaire : test de persistance.');

  const goalsTextarea = page.locator('textarea[placeholder*="Objectifs"], textarea[aria-label*="Objectifs"], textarea').nth(1);
  await goalsTextarea.fill('[TEST GO-LIVE EAF - À SUPPRIMER] Objectif prochaine séance : test de persistance.');

  // 6. Save the report
  const saveButton = page.locator('button:has-text("Enregistrer"), button[type="submit"]').first();
  await saveButton.click();

  // 7. Verify success message
  await expect(page.locator('text=Bilan enregistré, text=Enregistré avec succès')).toBeVisible({ timeout: 5000 });

  // 8. Refresh the page
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // 9. Verify persistence
  await expect(linearReadingTextarea).toHaveValue('[TEST GO-LIVE EAF - À SUPPRIMER] Lecture linéaire : test de persistance.');
  await expect(goalsTextarea).toHaveValue('[TEST GO-LIVE EAF - À SUPPRIMER] Objectif prochaine séance : test de persistance.');

  // 10. Clean up - clear the test data
  await linearReadingTextarea.fill('');
  await goalsTextarea.fill('');
  await saveButton.click();

  console.log('✅ Smoke test passed: EAF section visible, save works, persistence verified');
});
