import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { loginAsUser } from '../helpers/auth';
import {
  createSyntheticFamily,
  disconnectCandidatIndividuelDb,
  getQuoteWithLines,
} from '../helpers/candidat-individuel-db';

const ARTIFACT_DIR = path.join(process.cwd(), 'e2e/.artifacts/candidat-individuel');

async function extractPdfText(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `candidat-e2e-${Date.now()}-${randomUUID()}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  } finally {
    await rm(pdfPath, { force: true });
  }
}

async function setPipelineState(page: Page, value: 'ACTIVE_INTERNAL' | 'OFF') {
  await loginAsUser(page, 'admin', { navigate: false });
  const response = await page.request.patch('/api/admin/config', {
    data: { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value },
  });
  expect(response.status()).toBe(200);
}

async function setMarginPolicy(
  page: Page,
  gate: 'MARGIN_OK' | 'HUMAN_REVIEW_REQUIRED' | 'BLOCKED',
) {
  await loginAsUser(page, 'admin', { navigate: false });
  const marginGates = gate === 'MARGIN_OK'
    ? { warningPct: 0, greenPct: 0 }
    : gate === 'HUMAN_REVIEW_REQUIRED'
      ? { warningPct: 0, greenPct: 100 }
      : { warningPct: 100, greenPct: 100 };
  const response = await page.request.patch('/api/admin/config', {
    data: {
      namespace: 'quotes.costPolicy',
      key: 'default',
      value: {
        teacherCostPerHourTnd: 50,
        variableCostPerStudentMonthTnd: 15,
        marginGates,
      },
    },
  });
  expect(response.status()).toBe(200);
}

async function selectSyntheticIdentity(page: Page, marker: string) {
  const parentFirstName = `Resp${marker}`;
  const studentFirstName = `Eleve${marker}`;
  await createSyntheticFamily(parentFirstName, 'Recette', studentFirstName, 'Recette');

  await page.locator('#lead-search').fill(parentFirstName);
  await page.getByRole('option', { name: new RegExp(parentFirstName, 'i') }).click();
  await expect(page.getByTestId('selected-lead')).toContainText(parentFirstName);

  await page.locator('#student-search').fill(studentFirstName);
  await page.getByRole('option', { name: new RegExp(studentFirstName, 'i') }).click();
  await expect(page.getByTestId('selected-student')).toContainText(studentFirstName);
  await page.getByRole('button', { name: 'Continuer vers le profil' }).click();
  await expect(page.getByText('Profil du candidat', { exact: true })).toBeVisible();
}

async function chooseHeadcount(
  page: Page,
  groupIndex: number,
  choice: 'Individuel' | 'Duo' | 'Petit groupe',
  exactGroupSize?: number,
) {
  const group = page.getByRole('group', { name: /Effectif confirmé/ }).nth(groupIndex);
  await group.getByRole('button', { name: choice, exact: true }).click();
  if (choice === 'Petit groupe') {
    const card = group.locator('xpath=ancestor::article');
    await card.getByRole('spinbutton').fill(String(exactGroupSize ?? 3));
  }
}

const readyDispenses = [
  { epreuveId: 'grand-oral', statut: 'CONFIRMEE', justificatifRef: 'E2E-CI-1' },
  { epreuveId: 'histoire-geographie', statut: 'CONFIRMEE', justificatifRef: 'E2E-CI-2' },
  { epreuveId: 'lva', statut: 'CONFIRMEE', justificatifRef: 'E2E-CI-3' },
  { epreuveId: 'lvb', statut: 'CONFIRMEE', justificatifRef: 'E2E-CI-4' },
  { epreuveId: 'enseignement-scientifique', statut: 'CONFIRMEE', justificatifRef: 'E2E-CI-5' },
  { epreuveId: 'emc', statut: 'CONFIRMEE', justificatifRef: 'E2E-CI-6' },
];

test.describe.serial('Candidat individuel — pipeline staff interne final', () => {
  test.afterAll(async () => {
    await disconnectCandidatIndividuelDb();
  });

  test('RBAC, OFF et états publics restent fail-closed; ADMIN et ASSISTANTE gardent l’accès staff attendu', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/dashboard/assistante/candidat-individuel', { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/auth/signin');

    await setPipelineState(page, 'OFF');
    await loginAsUser(page, 'assistante', { navigate: false });
    await page.goto('/dashboard/assistante/candidat-individuel', { waitUntil: 'domcontentloaded' });
    const offResponse = await page.request.post('/api/assistante/candidat-individuel/simulate', {
      data: {
        publicInput: {
          level: 'TERMINALE', examSession: 2027, modalite: 'A',
          specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE',
        },
        budget: { monthlyBudgetTnd: 2500, strategy: 'MOST_COMPLETE' },
      },
    });
    expect(offResponse.status()).toBe(403);

    await setPipelineState(page, 'ACTIVE_INTERNAL');
    await loginAsUser(page, 'parent', { navigate: false });
    const parentResponse = await page.request.post('/api/assistante/candidat-individuel/simulate', {
      data: {
        publicInput: {
          level: 'TERMINALE', examSession: 2027, modalite: 'A',
          specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE',
        },
        budget: { monthlyBudgetTnd: 2500, strategy: 'MOST_COMPLETE' },
      },
    });
    expect(parentResponse.status()).toBe(403);

    await loginAsUser(page, 'admin', { navigate: false });
    const adminResponse = await page.request.post('/api/assistante/candidat-individuel/simulate', {
      data: {
        publicInput: {
          level: 'TERMINALE', examSession: 2027, modalite: 'A',
          specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE',
        },
        budget: { monthlyBudgetTnd: 2500, strategy: 'MOST_COMPLETE' },
      },
    });
    expect(adminResponse.status()).toBe(200);

    for (const forbiddenState of ['ACTIVE_PUBLIC', 'ACTIVE_PUBLIC_PERCENTAGE']) {
      const publicResponse = await page.request.patch('/api/admin/config', {
        data: {
          namespace: 'pricing.candidatIndividuelPipeline',
          key: 'state',
          value: forbiddenState,
        },
      });
      expect(publicResponse.status()).toBe(400);
    }

    await loginAsUser(page, 'assistante', { navigate: false });
    await page.goto('/dashboard/assistante/candidat-individuel', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Élève et responsable', { exact: true })).toBeVisible();
  });

  test('wizard réel: identité, simulation, GROUP_PENDING, 1/2/3+, trois gates de marge, devis, publication, rotation, famille et PDF', async ({ page, context }) => {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    await setPipelineState(page, 'ACTIVE_INTERNAL');
    await setMarginPolicy(page, 'MARGIN_OK');
    await loginAsUser(page, 'assistante', { navigate: false });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/dashboard/assistante/candidat-individuel', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('navigation', { name: 'Étapes du simulateur' })).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop-1440x1000-step-1.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await selectSyntheticIdentity(page, 'Final');
    await page.locator('#candidate-specialite1').selectOption('MATHEMATIQUES');
    await page.locator('#candidate-specialite2').selectOption('PHYSIQUE_CHIMIE');
    await page.getByText('Options avancées', { exact: true }).click();
    await page.locator('#advanced-dispensations').fill(JSON.stringify(readyDispenses));

    const [simulationResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/api/assistante/candidat-individuel/simulate') && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Enregistrer et simuler' }).click(),
    ]);
    expect(simulationResponse.status()).toBe(200);
    await expect(page.getByText('Besoins et accompagnements', { exact: true })).toBeVisible();

    const headcountGroups = page.getByRole('group', { name: /Effectif confirmé/ });
    await expect(headcountGroups).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Voir la proposition financière' })).toBeDisabled();

    const advancedPanel = page.locator('details').filter({ hasText: 'Options avancées' }).first();
    if (await advancedPanel.evaluate((element) => (element as HTMLDetailsElement).open)) {
      await advancedPanel.locator('summary').click();
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tablet-1024x768-step-3.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await chooseHeadcount(page, 0, 'Individuel');
    await chooseHeadcount(page, 1, 'Duo');
    await chooseHeadcount(page, 2, 'Petit groupe', 3);
    const financialButton = page.getByRole('button', { name: 'Voir la proposition financière' });
    await expect(financialButton).toBeEnabled();
    await financialButton.click();
    await expect(page.getByText('Proposition financière', { exact: true })).toBeVisible();

    const quoteResponsePromise = page.waitForResponse((response) =>
      /\/api\/assistante\/candidat-individuel\/profils\/[^/]+\/quote$/.test(new URL(response.url()).pathname)
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Générer le devis' }).click();
    const quoteResponse = await quoteResponsePromise;
    expect(quoteResponse.status()).toBe(201);
    const quotePayload = quoteResponse.request().postDataJSON() as Record<string, unknown>;
    const quoteBody = await quoteResponse.json();
    const quoteId = String(quoteBody.quote.id);

    await expect(page.getByText('Synthèse du devis', { exact: true })).toBeVisible();
    await expect(page.getByText('Le brouillon de devis a été généré par le serveur.')).toBeVisible();
    await expect(page.getByText('Marge conforme', { exact: false })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile-390x844-step-5.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const dbQuote = await getQuoteWithLines(quoteId);
    expect(dbQuote).not.toBeNull();
    const rules = dbQuote!.snapshotRegles as {
      margin: { gate: string };
      groupState: {
        state: string;
        lineResolutions: Array<{ confirmedHeadcount: number; effectiveModality: string }>;
      };
    };
    expect(rules.margin.gate).toBe('MARGIN_OK');
    expect(rules.groupState.state).toBe('GROUP_CONFIRMED');
    expect(rules.groupState.lineResolutions.map((line) => ({
      confirmedHeadcount: line.confirmedHeadcount,
      effectiveModality: line.effectiveModality,
    }))).toEqual(expect.arrayContaining([
      { confirmedHeadcount: 1, effectiveModality: 'SOLO' },
      { confirmedHeadcount: 2, effectiveModality: 'DUO' },
      { confirmedHeadcount: 3, effectiveModality: 'GROUPE' },
    ]));

    const profileId = String(dbQuote!.profilId);
    await setMarginPolicy(page, 'HUMAN_REVIEW_REQUIRED');
    await loginAsUser(page, 'assistante', { navigate: false });
    const humanResponse = await page.request.post(`/api/assistante/candidat-individuel/profils/${profileId}/quote`, {
      data: { ...quotePayload, idempotencyKey: `e2e-human-${randomUUID()}` },
    });
    expect(humanResponse.status()).toBe(422);
    expect(await humanResponse.json()).toMatchObject({ marginReview: { canOverride: true } });

    const reviewedResponse = await page.request.post(`/api/assistante/candidat-individuel/profils/${profileId}/quote`, {
      data: {
        ...quotePayload,
        idempotencyKey: `e2e-human-reviewed-${randomUUID()}`,
        marginOverride: { reason: 'Validation E2E explicite de la marge' },
      },
    });
    expect(reviewedResponse.status()).toBe(201);
    const reviewedQuote = await reviewedResponse.json();
    const reviewedDbQuote = await getQuoteWithLines(String(reviewedQuote.quote.id));
    expect((reviewedDbQuote!.snapshotRegles as { margin: { gate: string } }).margin.gate).toBe('HUMAN_REVIEW_REQUIRED');

    await setMarginPolicy(page, 'BLOCKED');
    await loginAsUser(page, 'assistante', { navigate: false });
    const blockedResponse = await page.request.post(`/api/assistante/candidat-individuel/profils/${profileId}/quote`, {
      data: { ...quotePayload, idempotencyKey: `e2e-blocked-${randomUUID()}` },
    });
    expect(blockedResponse.status()).toBe(422);
    expect(await blockedResponse.json()).toMatchObject({ marginReview: { canOverride: false } });

    const staffPdf = await page.request.get(`/api/assistante/candidat-individuel/quotes/${quoteId}/pdf`);
    expect(staffPdf.status()).toBe(200);
    expect(await extractPdfText(Buffer.from(await staffPdf.body()))).not.toMatch(/MOD_|costPolicy|marginPct/);

    await page.getByRole('button', { name: 'Valider et publier' }).click();
    await expect(page.getByText('Le devis est validé et prêt pour la création du lien famille.')).toBeVisible();

    const firstLinkPromise = page.waitForResponse((response) => response.url().includes(`/quotes/${quoteId}/family-link`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Créer le lien famille' }).click();
    const firstLinkResponse = await firstLinkPromise;
    expect(firstLinkResponse.status()).toBe(200);
    const firstFamilyUrl = String((await firstLinkResponse.json()).familyUrl);

    const rotatePromise = page.waitForResponse((response) => response.url().includes(`/quotes/${quoteId}/family-link`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Renouveler le lien famille' }).click();
    const rotateResponse = await rotatePromise;
    expect(rotateResponse.status()).toBe(200);
    const secondFamilyUrl = String((await rotateResponse.json()).familyUrl);
    expect(secondFamilyUrl).not.toBe(firstFamilyUrl);

    const familyContext = await context.browser()!.newContext();
    const oldResponse = await familyContext.request.get(firstFamilyUrl);
    expect(oldResponse.status()).toBe(404);
    const familyPage = await familyContext.newPage();
    const familyResponse = await familyPage.goto(secondFamilyUrl, { waitUntil: 'domcontentloaded' });
    expect(familyResponse?.status()).toBe(200);
    await expect(familyPage.getByRole('heading', { name: 'Votre devis Nexus Réussite' })).toBeVisible();
    const publicText = (await familyPage.locator('main').innerText());
    expect(publicText).not.toMatch(/MOD_|marginPct|costPolicy|teacherCost|reason interne|JSON/i);
    expect(publicText).toContain('TND');

    const token = new URL(secondFamilyUrl).pathname.split('/').pop()!;
    const familyPdf = await familyContext.request.get(`/api/quotes/public/${token}/pdf`);
    expect(familyPdf.status()).toBe(200);
    const familyPdfText = await extractPdfText(Buffer.from(await familyPdf.body()));
    expect(familyPdfText).toMatch(/Nexus Réussite/i);
    expect(familyPdfText).not.toMatch(/MOD_|costPolicy|marginPct/);
    await familyContext.close();
  });

  test('SVC_SECOND_GROUPE, modalité réglementaire non mûre, token aléatoire et prix nul échouent fermés', async ({ page }) => {
    await setPipelineState(page, 'ACTIVE_INTERNAL');
    await loginAsUser(page, 'assistante', { navigate: false });

    const secondGroupResponse = await page.request.post('/api/assistante/candidat-individuel/simulate', {
      data: {
        publicInput: {
          level: 'TERMINALE', examSession: 2027, modalite: 'A',
          specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE',
          moyenneRattrapage: 9,
        },
        budget: { monthlyBudgetTnd: 2500, strategy: 'MOST_COMPLETE' },
      },
    });
    expect(secondGroupResponse.status()).toBe(200);
    const secondGroupBody = await secondGroupResponse.json();
    expect(secondGroupBody.result.status).not.toBe('READY');
    expect(JSON.stringify(secondGroupBody)).not.toMatch(/"unitPriceMonthly":0|"grandTotal":0/);

    const unverifiedResponse = await page.request.post('/api/assistante/candidat-individuel/simulate', {
      data: {
        publicInput: {
          level: 'TERMINALE', examSession: 2027, modalite: 'B',
          specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE',
        },
        budget: { monthlyBudgetTnd: 2500, strategy: 'MOST_COMPLETE' },
      },
    });
    expect(unverifiedResponse.status()).toBe(200);
    expect((await unverifiedResponse.json()).result.status).not.toBe('READY');

    const randomTokenResponse = await page.request.get(`/api/quotes/public/${randomUUID()}`);
    expect(randomTokenResponse.status()).toBe(404);
  });
});
