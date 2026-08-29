import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { loginAsUser } from '../helpers/auth';
import {
  cleanupSyntheticFamilies,
  countQuotesByProfilId,
  createSyntheticFamily,
  disconnectCandidatIndividuelDb,
  getQuoteWithLines,
  type SyntheticFamilyFixture,
} from '../helpers/candidat-individuel-db';

const ARTIFACT_DIR = path.join(process.cwd(), 'e2e/.artifacts/candidat-individuel');

const INCLUDED_V1_IDENTIFIERS = new Set([
  'MOD_EAF_ECRIT_ORAL',
  'MOD_EAM',
  'MOD_EDS1',
  'MOD_EDS2',
  'MOD_PHILOSOPHIE',
  'MOD_GRAND_ORAL',
  'MOD_LVA',
  'MOD_LVB',
  'MOD_SPECIALITE_ABANDONNEE',
  'SVC_PILOTAGE',
]);

const DEFERRED_FROM_V1_IDENTIFIERS = new Set([
  'MOD_HG_ARIA',
  'MOD_ES_ARIA',
  'MOD_EMC_ARIA',
  'MOD_EAF_DESCRIPTIF',
  'MOD_MATHS_EXPERTES',
  'MOD_MATHS_COMPLEMENTAIRES',
  'MOD_DGEMC',
  'MOD_LCA',
  'SVC_BACS_BLANCS',
  'SVC_SECOND_GROUPE',
]);

const DEFERRED_FROM_V1_UI_LABELS = [
  'Histoire-Géographie (autonomie guidée ARIA)',
  'Enseignement scientifique (autonomie guidée ARIA)',
  'EMC (autonomie guidée ARIA)',
  'Aide au récapitulatif des activités EAF',
  'Option Mathématiques expertes',
  'Option Mathématiques complémentaires',
  'Option DGEMC (droit et grands enjeux du monde contemporain)',
  "Options Langues et cultures de l'Antiquité (latin/grec)",
  'Bacs blancs',
  'Second groupe (P11) — produit autonome',
];

const PDF_INTERNAL_PATTERNS = [
  /(?:MOD|SVC|GROUP|MARGIN)_/i,
  /\bmarge\b/i,
  /cost\s*policy|costPolicy|teacherCost|variableCost|warningPct|greenPct/i,
  /sourceReglementaire|pricingVersion|examPolicyVersion/i,
  /\breason\b|raison interne|diagnostic|marginGates|confirmedHeadcount/i,
  /profilId|contactLeadId|studentId|parentUserId|studentUserId|createdByUserId|byUserId|idempotencyKey/i,
  /snapshot(?:Regles|Carte)/i,
];

type ConfigEntry = {
  namespace: string;
  key: string;
  value: unknown;
};

type CandidatIndividuelConfigSnapshot = {
  pipelineState: unknown;
  costPolicy: unknown;
};

const EMPTY_DATABASE_EFFECTIVE_CONFIG: CandidatIndividuelConfigSnapshot = {
  pipelineState: 'OFF',
  costPolicy: {
    teacherCostPerHourTnd: 100,
    variableCostPerStudentMonthTnd: 10,
    marginGates: { greenPct: 40, warningPct: 30 },
  },
};

type SimulationCommercialLine = {
  offerId?: string | null;
  label: string;
  subject: string;
  unitPriceMonthly: number;
  hoursPerMonth: number | null;
};

function expectIncludedV1Only(identifiers: string[]) {
  expect(identifiers.length).toBeGreaterThan(0);
  for (const identifier of identifiers) {
    expect(INCLUDED_V1_IDENTIFIERS.has(identifier), `${identifier} doit appartenir au périmètre commercial V1`).toBe(true);
    expect(DEFERRED_FROM_V1_IDENTIFIERS.has(identifier), `${identifier} ne doit pas être différé de la V1`).toBe(false);
  }
}

function expectPdfWithoutInternals(text: string, technicalIds: string[], rawToken?: string) {
  for (const pattern of PDF_INTERNAL_PATTERNS) expect(text).not.toMatch(pattern);
  for (const technicalId of technicalIds) expect(text.includes(technicalId)).toBe(false);
  if (rawToken) expect(text.includes(rawToken)).toBe(false);
}

async function expectHttpStatus(
  response: APIResponse,
  expectedStatus: number,
  operation: string,
) {
  let diagnostic = '';
  if (response.status() !== expectedStatus) {
    const rawBody = (await response.text()).slice(0, 500);
    diagnostic = rawBody.replace(/[A-Za-z0-9_-]{40,}/g, '[redacted]');
  }
  expect(
    response.status(),
    `${operation} — HTTP ${response.status()}${diagnostic ? ` — ${diagnostic}` : ''}`,
  ).toBe(expectedStatus);
}

async function loginAsConfigAdmin(page: Page) {
  // Role changes in this serial spec must never reuse a previous actor's
  // auth/CSRF cookie. loginAsUser still exercises the real credentials flow.
  await page.context().clearCookies();
  await loginAsUser(page, 'admin', { navigate: false });
}

async function extractPdfText(buffer: Buffer) {
  const pdfPath = path.join('/tmp', `candidat-e2e-${Date.now()}-${randomUUID()}.pdf`);
  await writeFile(pdfPath, buffer);
  try {
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  } finally {
    await rm(pdfPath, { force: true });
  }
}

async function snapshotCandidatIndividuelConfig(page: Page): Promise<CandidatIndividuelConfigSnapshot> {
  await loginAsConfigAdmin(page);
  const response = await page.request.get('/api/admin/config');
  await expectHttpStatus(response, 200, 'GET snapshot /api/admin/config');
  const body = await response.json() as { entries?: ConfigEntry[] };
  const pipelineState = body.entries?.find((entry) =>
    entry.namespace === 'pricing.candidatIndividuelPipeline' && entry.key === 'state');
  const costPolicy = body.entries?.find((entry) =>
    entry.namespace === 'quotes.costPolicy' && entry.key === 'default');
  return {
    pipelineState: pipelineState?.value ?? EMPTY_DATABASE_EFFECTIVE_CONFIG.pipelineState,
    costPolicy: costPolicy?.value ?? EMPTY_DATABASE_EFFECTIVE_CONFIG.costPolicy,
  };
}

async function restoreCandidatIndividuelConfig(
  page: Page,
  snapshot: CandidatIndividuelConfigSnapshot,
) {
  await loginAsConfigAdmin(page);
  for (const entry of [
    { namespace: 'quotes.costPolicy', key: 'default', value: snapshot.costPolicy },
    { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: snapshot.pipelineState },
  ]) {
    const response = await page.request.patch('/api/admin/config', { data: entry });
    await expectHttpStatus(
      response,
      200,
      `PATCH restore ${entry.namespace}/${entry.key}`,
    );
  }
}

async function setPipelineState(page: Page, value: 'ACTIVE_INTERNAL' | 'OFF') {
  await loginAsConfigAdmin(page);
  const response = await page.request.patch('/api/admin/config', {
    data: { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value },
  });
  await expectHttpStatus(response, 200, `PATCH pipeline state=${value}`);
}

async function setMarginPolicy(
  page: Page,
  gate: 'MARGIN_OK' | 'HUMAN_REVIEW_REQUIRED' | 'BLOCKED',
) {
  await loginAsConfigAdmin(page);
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
  await expectHttpStatus(response, 200, `PATCH margin policy gate=${gate}`);
}

async function selectSyntheticIdentity(
  page: Page,
  marker: string,
  fixtures: SyntheticFamilyFixture[],
) {
  const parentFirstName = `Resp${marker}`;
  const studentFirstName = `Eleve${marker}`;
  const fixture = await createSyntheticFamily(parentFirstName, 'Recette', studentFirstName, 'Recette');
  fixtures.push(fixture);

  await page.locator('#lead-search').fill(parentFirstName);
  await page.getByRole('option', { name: new RegExp(parentFirstName, 'i') }).click();
  await expect(page.getByTestId('selected-lead')).toContainText(parentFirstName);

  await page.locator('#student-search').fill(studentFirstName);
  await page.getByRole('option', { name: new RegExp(studentFirstName, 'i') }).click();
  await expect(page.getByTestId('selected-student')).toContainText(studentFirstName);
  await page.getByRole('button', { name: 'Continuer vers le profil' }).click();
  await expect(page.getByRole('heading', { name: 'Profil du candidat', exact: true })).toBeVisible();
  return fixture;
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
    const configSnapshot = await snapshotCandidatIndividuelConfig(page);
    try {
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
      await expect(page.getByRole('heading', { name: 'Élève et responsable', exact: true })).toBeVisible();
    } finally {
      await restoreCandidatIndividuelConfig(page, configSnapshot);
    }
  });

  test('wizard réel: identité, simulation, GROUP_PENDING, 1/2/3+, trois gates de marge, devis, publication, rotation, famille et PDF', async ({ page, context }) => {
    const configSnapshot = await snapshotCandidatIndividuelConfig(page);
    const syntheticFamilies: SyntheticFamilyFixture[] = [];
    try {
      await mkdir(ARTIFACT_DIR, { recursive: true });
      await setPipelineState(page, 'ACTIVE_INTERNAL');
      await setMarginPolicy(page, 'MARGIN_OK');
      await loginAsUser(page, 'assistante', { navigate: false });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('/dashboard/assistante/candidat-individuel', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('navigation', { name: 'Étapes du simulateur' })).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop-1440x1000-step-1.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const syntheticFamily = await selectSyntheticIdentity(page, 'Final', syntheticFamilies);
    await page.locator('#candidate-specialite1').selectOption('MATHEMATIQUES');
    await page.locator('#candidate-specialite2').selectOption('PHYSIQUE_CHIMIE');
    await page.getByText('Options avancées', { exact: true }).click();
    await page.locator('#advanced-dispensations').fill(JSON.stringify(readyDispenses));

    const [profileResponse, simulationResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/api/assistante/candidat-individuel/profils') && response.request().method() === 'POST'),
      page.waitForResponse((response) => response.url().endsWith('/api/assistante/candidat-individuel/simulate') && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Enregistrer et simuler' }).click(),
    ]);
    expect(profileResponse.status()).toBe(201);
    expect(simulationResponse.status()).toBe(200);
    const profileId = String((await profileResponse.json()).profil.id);
    const simulationBody = await simulationResponse.json() as {
      result: {
        status: string;
        selection?: {
          pilotageIncluded?: boolean;
          modules?: Array<{ moduleId: string; status: string }>;
        };
        scenarios?: Array<{
          tier: 'ESSENTIEL' | 'RECOMMANDE' | 'COMPLET';
          lines: SimulationCommercialLine[];
          monthlyTotal: number;
          grandTotal: number;
          months: number;
          matchedOfferId: string | null;
        }>;
      };
    };
    expect(simulationBody.result.status).toBe('READY');
    const selectedModuleIds = (simulationBody.result.selection?.modules ?? [])
      .filter((module) => module.status === 'SELECTED')
      .map((module) => module.moduleId);
    const selectedCommercialIdentifiers = [
      ...(simulationBody.result.selection?.pilotageIncluded === true ? ['SVC_PILOTAGE'] : []),
      ...selectedModuleIds,
    ];
    expectIncludedV1Only(selectedCommercialIdentifiers);
    const simulationScenarios = simulationBody.result.scenarios ?? [];
    expect(simulationScenarios.length).toBeGreaterThan(0);
    const simulationCommercialLines = simulationScenarios.flatMap((scenario) => scenario.lines);
    for (const line of simulationCommercialLines) expect(line.unitPriceMonthly).toBeGreaterThan(0);
    for (const scenario of simulationScenarios) {
      expect(scenario.monthlyTotal).toBeGreaterThan(0);
      expect(scenario.grandTotal).toBeGreaterThan(0);
    }
    const selectedSimulationScenario = simulationScenarios.find((scenario) => scenario.tier === 'RECOMMANDE') ?? simulationScenarios[0]!;
    await expect(page.getByRole('heading', { name: 'Besoins et accompagnements', exact: true })).toBeVisible();
    for (const line of selectedSimulationScenario.lines) {
      const accompanimentCard = page.getByRole('article', { name: line.label, exact: true });
      await expect(accompanimentCard).toHaveCount(1);
      await expect(accompanimentCard.getByRole('heading', { level: 3, name: line.label, exact: true })).toBeVisible();
    }
    for (const deferredLabel of DEFERRED_FROM_V1_UI_LABELS) {
      await expect(page.getByRole('article', { name: deferredLabel, exact: true })).toHaveCount(0);
    }

    const headcountGroups = page.getByRole('group', { name: /Effectif confirmé/ });
    await expect(headcountGroups).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Voir la proposition financière' })).toBeDisabled();

    const quoteCountBeforePending = await countQuotesByProfilId(profileId);
    expect(quoteCountBeforePending).toBe(0);
    const pendingResponse = await page.request.post(`/api/assistante/candidat-individuel/profils/${profileId}/quote`, {
      data: {
        idempotencyKey: `e2e-group-pending-${randomUUID()}`,
        budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
        scenarioTier: selectedSimulationScenario.tier,
      },
    });
    expect(pendingResponse.status()).toBe(422);
    expect(await pendingResponse.json()).toMatchObject({
      error: expect.stringMatching(/Effectif/i),
      groupState: 'GROUP_PENDING',
    });
    expect(await countQuotesByProfilId(profileId)).toBe(quoteCountBeforePending);

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
    await expect(page.getByRole('heading', { name: 'Proposition financière', exact: true })).toBeVisible();

    const quoteResponsePromise = page.waitForResponse((response) =>
      /\/api\/assistante\/candidat-individuel\/profils\/[^/]+\/quote$/.test(new URL(response.url()).pathname)
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Générer le devis' }).click();
    const quoteResponse = await quoteResponsePromise;
    expect(quoteResponse.status()).toBe(201);
    const quotePayload = quoteResponse.request().postDataJSON() as Record<string, unknown>;
    const quoteBody = await quoteResponse.json();
    const quoteId = String(quoteBody.quote.id);
    expect(quoteBody.quote.totals.annualTnd).toBeGreaterThan(0);
    expect(quoteBody.quote.totals.installmentTnd).toBeGreaterThan(0);
    for (const line of quoteBody.quote.lines) expect(line.monthlyAmountTnd).toBeGreaterThan(0);

    await expect(page.getByRole('heading', { name: 'Synthèse du devis', exact: true })).toBeVisible();
    await expect(page.getByText('Le brouillon de devis a été généré par le serveur.')).toBeVisible();
    await expect(page.getByText('Marge conforme', { exact: false })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile-390x844-step-5.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const dbQuote = await getQuoteWithLines(quoteId);
    expect(dbQuote).not.toBeNull();
    expect(dbQuote!.monthlyTotal).toBeGreaterThan(0);
    expect(dbQuote!.grandTotal).toBeGreaterThan(0);
    expect(dbQuote!.matchedOfferId).toBe(selectedSimulationScenario.matchedOfferId);
    expect(dbQuote!.lines.map((line) => line.subject)).toEqual(
      selectedSimulationScenario.lines.map((line) => line.label),
    );
    expect(dbQuote!.lines).toHaveLength(selectedSimulationScenario.lines.length);
    dbQuote!.lines.forEach((line, index) => {
      const simulatedLine = selectedSimulationScenario.lines[index]!;
      expect(line.unitPrice).toBeGreaterThan(0);
      expect(line.months).toBe(selectedSimulationScenario.months);
      expect(line.lineTotal).toBeGreaterThan(0);
      expect(line.lineTotal).toBe(line.unitPrice * line.months);
      expect(line.hoursPerMonth).toBe(simulatedLine.hoursPerMonth);
      expect(line.offerId ?? null).toBe(simulatedLine.offerId ?? null);
    });
    const persistedCommercialSnapshot = JSON.stringify({
      matchedOfferId: dbQuote!.matchedOfferId,
      snapshotCarte: dbQuote!.snapshotCarte,
      snapshotRegles: dbQuote!.snapshotRegles,
      lines: dbQuote!.lines.map((line) => ({
        subject: line.subject,
        modality: line.modality,
        offerId: line.offerId,
        priority: line.priority,
        reason: line.reason,
      })),
    });
    for (const deferredIdentifier of DEFERRED_FROM_V1_IDENTIFIERS) {
      expect(persistedCommercialSnapshot).not.toContain(deferredIdentifier);
    }
    for (const deferredLabel of DEFERRED_FROM_V1_UI_LABELS) {
      expect(persistedCommercialSnapshot).not.toContain(deferredLabel);
    }
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

    expect(String(dbQuote!.profilId)).toBe(profileId);
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
    const staffPdfText = await extractPdfText(Buffer.from(await staffPdf.body()));
    expect(staffPdfText.trim().length).toBeGreaterThan(1000);
    expect(staffPdfText).toMatch(/Nexus Réussite/i);
    expect(staffPdfText).toContain('RespFinal Recette');
    expect(staffPdfText).toContain('EleveFinal Recette');
    expect(staffPdfText).toContain(quoteId);
    expect(staffPdfText).toMatch(/Mathématiques/i);
    expect(staffPdfText).toMatch(/Physique(?:-| )chimie/i);
    expect(staffPdfText).toMatch(/TND/i);
    expect(staffPdfText).toMatch(/BROUILLON INTERNE/i);
    expectPdfWithoutInternals(staffPdfText, [
      profileId,
      syntheticFamily.contactLeadId,
      syntheticFamily.studentId,
      syntheticFamily.parentProfileId,
      syntheticFamily.parentUserId,
      syntheticFamily.studentUserId,
    ]);

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
    try {
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
      expect(familyPdfText.trim().length).toBeGreaterThan(1000);
      expect(familyPdfText).toMatch(/Nexus Réussite/i);
      expect(familyPdfText).toContain('RespFinal Recette');
      expect(familyPdfText).toContain('EleveFinal Recette');
      expect(familyPdfText).toContain(quoteId);
      expect(familyPdfText).toMatch(/Mathématiques/i);
      expect(familyPdfText).toMatch(/Physique(?:-| )chimie/i);
      expect(familyPdfText).toMatch(/TND/i);
      expect(familyPdfText).not.toMatch(/BROUILLON INTERNE|NE PAS ENVOYER/i);
      expectPdfWithoutInternals(familyPdfText, [
        profileId,
        syntheticFamily.contactLeadId,
        syntheticFamily.studentId,
        syntheticFamily.parentProfileId,
        syntheticFamily.parentUserId,
        syntheticFamily.studentUserId,
      ], token);
    } finally {
      await familyContext.close();
    }
    } finally {
      try {
        await cleanupSyntheticFamilies(syntheticFamilies);
      } finally {
        await restoreCandidatIndividuelConfig(page, configSnapshot);
      }
    }
  });

  test('SVC_SECOND_GROUPE, modalité réglementaire non mûre, token aléatoire et prix nul échouent fermés', async ({ page }) => {
    const configSnapshot = await snapshotCandidatIndividuelConfig(page);
    try {
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
    } finally {
      await restoreCandidatIndividuelConfig(page, configSnapshot);
    }
  });
});
