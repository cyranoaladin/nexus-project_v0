import { expect, test, type APIResponse, type Page, type Response as PlaywrightResponse } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { loginAsUser } from '../helpers/auth';
import { SPECIALITE_ABANDONNEE_WARNING } from '../../lib/quotes/warnings';
import {
  type BusinessConfigMutationRef,
  cleanupSyntheticFamilies,
  countQuotesByProfilId,
  createSyntheticFamily,
  disconnectCandidatIndividuelDb,
  getCandidatIndividuelBusinessConfigMutation,
  getSyntheticFamilyFixtureFromStaffCreation,
  getQuoteWithLines,
  removeBusinessConfigRowsCreatedByE2e,
  type RawBusinessConfigSnapshot,
  snapshotCandidatIndividuelBusinessConfig,
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
  /\bmarge\b|marginPct|marginReview/i,
  /cost\s*policy|costPolicy|teacherCost|variableCost|warningPct|greenPct/i,
  /sourceReglementaire|pricingVersion|examPolicyVersion/i,
  /\breason\b|raison interne|diagnostic|marginGates|confirmedHeadcount/i,
  /BLENDED_FALLBACK|BUSINESS_CONFIG|\bJSON\b/i,
  /profilId|contactLeadId|studentId|parentUserId|studentUserId|createdByUserId|byUserId|idempotencyKey|publicTokenHash|rawToken/i,
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
  raw: RawBusinessConfigSnapshot[];
};

const EMPTY_DATABASE_EFFECTIVE_CONFIG: CandidatIndividuelConfigSnapshot = {
  pipelineState: 'OFF',
  costPolicy: {
    teacherCostPerHourTnd: 100,
    variableCostPerStudentMonthTnd: 10,
    marginGates: { greenPct: 40, warningPct: 30 },
  },
  raw: [],
};

type SimulationCommercialLine = {
  offerId?: string | null;
  label: string;
  subject: string;
  modality: string;
  unitPriceMonthly: number;
  hoursPerMonth: number | null;
  reason: string;
};

const ABANDONED_SPECIALTY_COMMERCIAL_LABEL = 'NSI — spécialité de Première non poursuivie';

function expectIncludedV1Only(identifiers: string[]) {
  expect(identifiers.length).toBeGreaterThan(0);
  for (const identifier of identifiers) {
    expect(INCLUDED_V1_IDENTIFIERS.has(identifier), `${identifier} doit appartenir au périmètre commercial V1`).toBe(true);
    expect(DEFERRED_FROM_V1_IDENTIFIERS.has(identifier), `${identifier} ne doit pas être différé de la V1`).toBe(false);
  }
}

function expectTextWithoutInternals(text: string, technicalIds: string[], rawToken?: string) {
  for (const pattern of PDF_INTERNAL_PATTERNS) expect(text).not.toMatch(pattern);
  for (const technicalId of technicalIds) expect(text.includes(technicalId)).toBe(false);
  if (rawToken) expect(text.includes(rawToken)).toBe(false);
}

function formatTndForAssertion(value: number) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value).replace(/\u202f/g, ' ')} TND`;
}

function normalizeRenderedText(value: string) {
  return value.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function expectAbandonedSpecialtyCommercialPdfLine(text: string, unitPriceMonthly: number) {
  const normalizedText = normalizeRenderedText(text).toLocaleLowerCase('fr-FR');
  const prefix = normalizeRenderedText(
    ABANDONED_SPECIALTY_COMMERCIAL_LABEL.replace(/ poursuivie$/, ''),
  ).toLocaleLowerCase('fr-FR');
  const suffix = 'poursuivie — 8 h/mois';
  const modality = '(petit groupe)';
  const expectedPrice = formatTndForAssertion(unitPriceMonthly).toLocaleLowerCase('fr-FR');
  const escapedPrice = expectedPrice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const monthlyPricePattern = new RegExp(`${escapedPrice}\\s*\\/\\s*mois`, 'i');
  const candidateWindows: string[] = [];
  let prefixIndex = normalizedText.indexOf(prefix);
  while (prefixIndex >= 0) {
    candidateWindows.push(normalizedText.slice(prefixIndex, prefixIndex + 600));
    prefixIndex = normalizedText.indexOf(prefix, prefixIndex + prefix.length);
  }
  const commercialWindow = candidateWindows.find((candidate) => {
    const suffixIndex = candidate.indexOf(suffix, prefix.length);
    if (suffixIndex < prefix.length) return false;
    const modalityIndex = candidate.indexOf(modality, suffixIndex + suffix.length);
    return modalityIndex > suffixIndex && monthlyPricePattern.test(candidate) && !/MOD_/i.test(candidate);
  });
  expect(
    commercialWindow,
    `ligne commerciale abandonnée absente; fenêtres expurgées: ${redactDiagnosticPayload(candidateWindows)}`,
  ).toBeDefined();
}

async function expectAbandonedSpecialtyCommercialHtmlLine(page: Page, unitPriceMonthly: number) {
  const main = page.locator('main');
  const diagnosticCandidates = (await main.locator('p').allInnerTexts())
    .map(normalizeRenderedText)
    .filter((candidate) => /NSI|spécialité de Première non poursuivie|Petit groupe|8 h \/ mois/i.test(candidate));
  const diagnostic = redactDiagnosticPayload(diagnosticCandidates.slice(0, 20));
  const subject = main.getByText(ABANDONED_SPECIALTY_COMMERCIAL_LABEL, { exact: true });
  await expect(subject, `sujet commercial abandonné absent ou ambigu; HTML expurgé: ${diagnostic}`).toHaveCount(1);
  await expect(subject).toBeVisible();

  const lineContainer = subject.locator('..');
  const lineText = normalizeRenderedText(await lineContainer.innerText()).toLocaleLowerCase('fr-FR');
  const expectedSubject = ABANDONED_SPECIALTY_COMMERCIAL_LABEL.toLocaleLowerCase('fr-FR');
  const expectedPrice = `${formatTndForAssertion(unitPriceMonthly)} / mois`.toLocaleLowerCase('fr-FR');
  const subjectIndex = lineText.indexOf(expectedSubject);
  const modalityIndex = lineText.indexOf('petit groupe', subjectIndex + expectedSubject.length);
  const hoursIndex = lineText.indexOf('8 h / mois', modalityIndex + 'petit groupe'.length);
  const priceIndex = lineText.indexOf(expectedPrice, hoursIndex + '8 h / mois'.length);
  expect(subjectIndex, `sujet absent du conteneur commercial; ligne expurgée: ${redactDiagnosticPayload(lineText)}`).toBe(0);
  expect(modalityIndex, `modalité absente ou mal ordonnée; ligne expurgée: ${redactDiagnosticPayload(lineText)}`).toBeGreaterThan(subjectIndex);
  expect(hoursIndex, `volume absent ou mal ordonné; ligne expurgée: ${redactDiagnosticPayload(lineText)}`).toBeGreaterThan(modalityIndex);
  expect(priceIndex, `prix absent ou mal ordonné; ligne expurgée: ${redactDiagnosticPayload(lineText)}`).toBeGreaterThan(hoursIndex);
  expect(lineText).not.toMatch(/MOD_/i);
}

function redactDiagnosticPayload(value: unknown) {
  const serialized = JSON.stringify(value, (key, nestedValue) => {
    if (/(?:token|secret|password|email|phone|contactId|studentId|profileId|profilId|quoteId)/i.test(key)) {
      return '[REDACTED]';
    }
    if (typeof nestedValue === 'string') {
      return nestedValue
        .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, '[REDACTED_EMAIL]')
        .replace(/\+?\d[\d\s().-]{7,}\d/g, '[REDACTED_PHONE]')
        .replace(/[A-Za-z0-9_-]{40,}/g, '[REDACTED_TOKEN]');
    }
    return nestedValue;
  });
  return serialized.length > 4_000 ? `${serialized.slice(0, 4_000)}...[TRUNCATED]` : serialized;
}

let initialSuiteConfigSnapshot: CandidatIndividuelConfigSnapshot | null = null;
const configMutationJournal: BusinessConfigMutationRef[] = [];

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
  if (initialSuiteConfigSnapshot) return initialSuiteConfigSnapshot;
  const raw = await snapshotCandidatIndividuelBusinessConfig();
  await loginAsConfigAdmin(page);
  const response = await page.request.get('/api/admin/config');
  await expectHttpStatus(response, 200, 'GET snapshot /api/admin/config');
  const body = await response.json() as { entries?: ConfigEntry[] };
  const pipelineState = body.entries?.find((entry) =>
    entry.namespace === 'pricing.candidatIndividuelPipeline' && entry.key === 'state');
  const costPolicy = body.entries?.find((entry) =>
    entry.namespace === 'quotes.costPolicy' && entry.key === 'default');
  const pipelineRaw = raw.find((entry) => entry.namespace === 'pricing.candidatIndividuelPipeline' && entry.key === 'state');
  const costPolicyRaw = raw.find((entry) => entry.namespace === 'quotes.costPolicy' && entry.key === 'default');
  expect(pipelineRaw).toBeDefined();
  expect(costPolicyRaw).toBeDefined();
  initialSuiteConfigSnapshot = {
    pipelineState: pipelineRaw!.row?.value ?? pipelineState?.value ?? EMPTY_DATABASE_EFFECTIVE_CONFIG.pipelineState,
    costPolicy: costPolicyRaw!.row?.value ?? costPolicy?.value ?? EMPTY_DATABASE_EFFECTIVE_CONFIG.costPolicy,
    raw,
  };
  return initialSuiteConfigSnapshot;
}

async function patchAuditedConfig(
  page: Page,
  entry: ConfigEntry,
  operation: string,
) {
  const response = await page.request.patch('/api/admin/config', { data: entry });
  await expectHttpStatus(response, 200, operation);
  const body = await response.json() as {
    entry: { id: string; namespace: BusinessConfigMutationRef['namespace']; key: BusinessConfigMutationRef['key']; version: number };
  };
  configMutationJournal.push({
    rowId: body.entry.id,
    namespace: body.entry.namespace,
    key: body.entry.key,
    version: body.entry.version,
  });
}

async function restoreCandidatIndividuelConfig(
  page: Page,
  snapshot: CandidatIndividuelConfigSnapshot,
  finalRestore = false,
) {
  if (!finalRestore) return;
  await loginAsConfigAdmin(page);
  for (const entry of [
    { namespace: 'quotes.costPolicy', key: 'default', value: snapshot.costPolicy },
    { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: snapshot.pipelineState },
  ] satisfies ConfigEntry[]) {
    await patchAuditedConfig(page, entry, `PATCH restore ${entry.namespace}/${entry.key}`);
  }

  await removeBusinessConfigRowsCreatedByE2e(snapshot.raw, configMutationJournal);

  const expectedEffective = {
    pipelineState: snapshot.pipelineState,
    pipelineSource: snapshot.raw.find((entry) => entry.namespace === 'pricing.candidatIndividuelPipeline')?.row ? 'BUSINESS_CONFIG' : 'FALLBACK',
    costPolicy: snapshot.costPolicy,
    costPolicySource: snapshot.raw.find((entry) => entry.namespace === 'quotes.costPolicy')?.row ? 'BUSINESS_CONFIG' : 'BLENDED_FALLBACK',
  };
  await expect.poll(async () => {
    const response = await page.request.get('/api/admin/config');
    if (response.status() !== 200) return null;
    const body = await response.json() as { entries?: Array<ConfigEntry & { source: 'override' | 'fallback' }> };
    const pipeline = body.entries?.find((entry) => entry.namespace === 'pricing.candidatIndividuelPipeline' && entry.key === 'state');
    const costPolicy = body.entries?.find((entry) => entry.namespace === 'quotes.costPolicy' && entry.key === 'default');
    return {
      pipelineState: pipeline?.value ?? EMPTY_DATABASE_EFFECTIVE_CONFIG.pipelineState,
      pipelineSource: pipeline?.source === 'override' ? 'BUSINESS_CONFIG' : 'FALLBACK',
      costPolicy: costPolicy?.value ?? EMPTY_DATABASE_EFFECTIVE_CONFIG.costPolicy,
      costPolicySource: costPolicy?.source === 'override' ? 'BUSINESS_CONFIG' : 'BLENDED_FALLBACK',
    };
  }, {
    message: 'le cache config doit retrouver la valeur et la provenance initiales après le TTL',
    timeout: 70_000,
    intervals: [1_000],
  }).toEqual(expectedEffective);

  const rawAfter = await snapshotCandidatIndividuelBusinessConfig();
  for (const before of snapshot.raw) {
    const after = rawAfter.find((entry) => entry.namespace === before.namespace && entry.key === before.key)!;
    if (before.row === null) {
      expect(after.row).toBeNull();
      expect(after.audits).toEqual(before.audits);
    } else {
      expect(after.row?.id).toBe(before.row.id);
      expect(after.row?.value).toEqual(before.row.value);
      expect(after.row!.version).toBeGreaterThan(before.row.version);
      expect(after.audits.map((audit) => audit.id)).toEqual(expect.arrayContaining(before.audits.map((audit) => audit.id)));
      expect(after.audits.at(-1)?.newValue).toEqual(before.row.value);
    }
  }
}

async function setPipelineState(page: Page, value: 'ACTIVE_INTERNAL' | 'OFF') {
  await loginAsConfigAdmin(page);
  await patchAuditedConfig(
    page,
    { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value },
    `PATCH pipeline state=${value}`,
  );
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
  await patchAuditedConfig(
    page,
    {
      namespace: 'quotes.costPolicy',
      key: 'default',
      value: {
        teacherCostPerHourTnd: 50,
        variableCostPerStudentMonthTnd: 15,
        marginGates,
      },
    },
    `PATCH margin policy gate=${gate}`,
  );
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

type BrowserDiagnosticClassification = 'APPLICATION' | 'THIRD_PARTY' | 'NETWORK';

type BrowserDiagnostic = {
  classification: BrowserDiagnosticClassification;
  kind: 'pageerror' | 'console' | 'requestfailed';
  url: string;
  message: string;
};

const browserDiagnosticsByTestId = new Map<string, BrowserDiagnostic[]>();
const browserDiagnosticCounts: Record<BrowserDiagnosticClassification, number> = {
  APPLICATION: 0,
  THIRD_PARTY: 0,
  NETWORK: 0,
};
const browserNetworkDetailCounts = {
  NETWORK_CONSOLE: 0,
  APP_REQUESTFAILED_EXPECTED_ABORT: 0,
  APP_REQUESTFAILED_UNEXPECTED: 0,
  THIRD_PARTY_REQUESTFAILED: 0,
};

function recordBrowserDiagnostic(records: BrowserDiagnostic[], diagnostic: BrowserDiagnostic) {
  records.push(diagnostic);
  browserDiagnosticCounts[diagnostic.classification] += 1;
  if (diagnostic.kind === 'console' && diagnostic.classification === 'NETWORK') {
    browserNetworkDetailCounts.NETWORK_CONSOLE += 1;
  }
  if (diagnostic.kind === 'requestfailed') {
    if (diagnostic.classification === 'THIRD_PARTY') {
      browserNetworkDetailCounts.THIRD_PARTY_REQUESTFAILED += 1;
    } else if (/ERR_ABORTED|cancel(?:l?ed|lation)|target (?:page, context or browser|page|context|browser)?\s*(?:has been )?closed/i.test(diagnostic.message)) {
      browserNetworkDetailCounts.APP_REQUESTFAILED_EXPECTED_ABORT += 1;
    } else {
      browserNetworkDetailCounts.APP_REQUESTFAILED_UNEXPECTED += 1;
    }
  }
}

function classifyBrowserDiagnostic(
  kind: BrowserDiagnostic['kind'],
  url: string,
  message: string,
): BrowserDiagnosticClassification {
  if (kind === 'requestfailed') return /^https?:/i.test(url) && new URL(url).origin !== new URL(process.env.BASE_URL ?? 'http://localhost:3002').origin
    ? 'THIRD_PARTY'
    : 'NETWORK';
  // A same-origin console URL does not make an explicit fetch/network failure an application exception.
  if (/Failed to (?:load resource|fetch)|net::ERR_|NetworkError|network error|fetch failed/i.test(message)) return 'NETWORK';
  if (/^https?:/i.test(url) && new URL(url).origin !== new URL(process.env.BASE_URL ?? 'http://localhost:3002').origin) return 'THIRD_PARTY';
  return 'APPLICATION';
}

function attachBrowserDiagnostics(page: Page, records: BrowserDiagnostic[], attached: WeakSet<Page>) {
  if (attached.has(page)) return;
  attached.add(page);
  page.on('pageerror', (error) => recordBrowserDiagnostic(records, {
    classification: 'APPLICATION',
    kind: 'pageerror',
    url: page.url(),
    message: error.message,
  }));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const url = message.location().url || page.url();
    recordBrowserDiagnostic(records, {
      classification: classifyBrowserDiagnostic('console', url, message.text()),
      kind: 'console',
      url,
      message: message.text(),
    });
  });
  page.on('requestfailed', (request) => {
    const message = request.failure()?.errorText ?? 'request failed';
    recordBrowserDiagnostic(records, {
      classification: classifyBrowserDiagnostic('requestfailed', request.url(), message),
      kind: 'requestfailed',
      url: request.url(),
      message,
    });
  });
}

async function expectExactPath(page: Page, expectedPath: string) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(expectedPath);
}

async function expectSurfaceHygiene(page: Page) {
  const text = normalizeRenderedText(await page.locator('body').innerText());
  expect(text).not.toMatch(/(?:MOD_|P7_)/i);
  expect(text).not.toMatch(/\{\s*"[A-Za-z0-9_]+"\s*:/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function recordAuditedPipelineUiPatch(response: PlaywrightResponse, expectedValue: 'OFF' | 'ACTIVE_INTERNAL') {
  expect(response.status()).toBe(200);
  const persisted = await getCandidatIndividuelBusinessConfigMutation(
    'pricing.candidatIndividuelPipeline',
    'state',
  );
  configMutationJournal.push(persisted.mutation);

  expect(persisted.mutation).toMatchObject({
    namespace: 'pricing.candidatIndividuelPipeline',
    key: 'state',
  });
  expect(persisted.value).toBe(expectedValue);
  expect(persisted.mutation.rowId).toBeTruthy();
  expect(persisted.mutation.version).toBeGreaterThan(0);
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
  test.beforeEach(async ({ context }, testInfo) => {
    const records: BrowserDiagnostic[] = [];
    const attached = new WeakSet<Page>();
    browserDiagnosticsByTestId.set(testInfo.testId, records);
    context.pages().forEach((page) => attachBrowserDiagnostics(page, records, attached));
    context.on('page', (page) => attachBrowserDiagnostics(page, records, attached));
  });

  test.afterEach(async ({}, testInfo) => {
    const records = browserDiagnosticsByTestId.get(testInfo.testId) ?? [];
    const applicationErrors = records.filter((record) => record.classification === 'APPLICATION');
    browserDiagnosticsByTestId.delete(testInfo.testId);
    expect(
      applicationErrors,
      `erreurs Chromium APPLICATION: ${redactDiagnosticPayload(applicationErrors)}`,
    ).toEqual([]);
  });

  test.afterAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    process.stdout.write(
      `CANDIDAT_CHROMIUM_DIAGNOSTICS APPLICATION=${browserDiagnosticCounts.APPLICATION} THIRD_PARTY=${browserDiagnosticCounts.THIRD_PARTY} NETWORK=${browserDiagnosticCounts.NETWORK} NETWORK_CONSOLE=${browserNetworkDetailCounts.NETWORK_CONSOLE} APP_REQUESTFAILED_EXPECTED_ABORT=${browserNetworkDetailCounts.APP_REQUESTFAILED_EXPECTED_ABORT} APP_REQUESTFAILED_UNEXPECTED=${browserNetworkDetailCounts.APP_REQUESTFAILED_UNEXPECTED} THIRD_PARTY_REQUESTFAILED=${browserNetworkDetailCounts.THIRD_PARTY_REQUESTFAILED}\n`,
    );
    const restoreContext = await browser.newContext();
    const restorePage = await restoreContext.newPage();
    try {
      if (initialSuiteConfigSnapshot) {
        await restoreCandidatIndividuelConfig(restorePage, initialSuiteConfigSnapshot, true);
      }
    } finally {
      await restoreContext.close();
      await disconnectCandidatIndividuelDb();
    }
    expect(
      browserNetworkDetailCounts.APP_REQUESTFAILED_UNEXPECTED,
      'échecs réseau applicatifs inattendus (hors ERR_ABORTED/annulation/fermeture de cible)',
    ).toBe(0);
  });

  test('navigation ADMIN et ASSISTANTE ouvre la surface candidat exacte sans rebond', async ({ page, context }) => {
    await snapshotCandidatIndividuelConfig(page);
    await setPipelineState(page, 'OFF');

    for (const actor of [
      { role: 'admin' as const, dashboard: '/dashboard/admin', candidate: '/dashboard/admin/candidat-individuel' },
      { role: 'assistante' as const, dashboard: '/dashboard/assistante', candidate: '/dashboard/assistante/candidat-individuel' },
    ]) {
      await context.clearCookies();
      await loginAsUser(page, actor.role);
      await expectExactPath(page, actor.dashboard);
      const menuLink = page.getByRole('link', { name: 'Devis candidat individuel', exact: true });
      await expect(menuLink).toBeVisible();
      await expect(menuLink).toHaveAttribute('href', actor.candidate);
      await menuLink.click();
      await expectExactPath(page, actor.candidate);
      await expect(page.getByRole('heading', { level: 1, name: 'Simulateur de devis — Candidat individuel', exact: true })).toBeVisible();
      await expectSurfaceHygiene(page);
    }
  });

  test('OFF reste explicite puis ADMIN active et désactive réellement le workspace pour les deux rôles', async ({ page, context, browser }, testInfo) => {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await snapshotCandidatIndividuelConfig(page);
    await setPipelineState(page, 'OFF');

    await context.clearCookies();
    await loginAsUser(page, 'admin', { targetPath: '/dashboard/admin/candidat-individuel' });
    await expectExactPath(page, '/dashboard/admin/candidat-individuel');
    const candidateMain = page.locator('#main-content');
    await expect(candidateMain.getByText('Désactivé', { exact: true })).toBeVisible();
    await expect(candidateMain.getByRole('heading', { name: 'Le simulateur candidat individuel est désactivé.', exact: true })).toBeVisible();
    await expect(candidateMain.getByRole('button', { name: "Activer pour l'équipe", exact: true })).toBeVisible();
    await expect(candidateMain.getByRole('navigation', { name: 'Étapes du simulateur' })).toHaveCount(0);
    await expectSurfaceHygiene(page);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'admin-off-desktop-1440x1000.png'), fullPage: true });

    const records = browserDiagnosticsByTestId.get(testInfo.testId);
    if (!records) throw new Error('Collecteur Chromium du test indisponible');
    const assistantContext = await browser.newContext({
      baseURL: process.env.BASE_URL ?? 'http://localhost:3002',
      viewport: { width: 1440, height: 1000 },
    });
    const assistantAttachedPages = new WeakSet<Page>();
    assistantContext.on('page', (candidatePage) => attachBrowserDiagnostics(candidatePage, records, assistantAttachedPages));
    const assistantPage = await assistantContext.newPage();
    attachBrowserDiagnostics(assistantPage, records, assistantAttachedPages);

    try {
      await loginAsUser(assistantPage, 'assistante', { targetPath: '/dashboard/assistante/candidat-individuel' });
      const assistantMain = assistantPage.locator('#main-content');
      await expect(assistantMain.getByRole('heading', { name: "Le simulateur n'est pas encore activé par un administrateur.", exact: true })).toBeVisible();
      await expect(assistantMain.getByRole('button', { name: /Activer|Réessayer l'activation/ })).toHaveCount(0);
      await expect(assistantMain.getByRole('navigation', { name: 'Étapes du simulateur' })).toHaveCount(0);

      const [activationResponse] = await Promise.all([
        page.waitForResponse((response) => response.url().endsWith('/api/admin/config') && response.request().method() === 'PATCH'),
        candidateMain.getByRole('button', { name: "Activer pour l'équipe", exact: true }).click(),
      ]);
      await recordAuditedPipelineUiPatch(activationResponse, 'ACTIVE_INTERNAL');
      await expect(candidateMain.getByRole('status').filter({ hasText: "Le simulateur est actif pour l'équipe." })).toHaveText("Le simulateur est actif pour l'équipe.");
      await expect(candidateMain.getByRole('navigation', { name: 'Étapes du simulateur' })).toBeVisible();
      await expectSurfaceHygiene(page);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'admin-active-desktop-1440x1000.png'), fullPage: true });

      await assistantPage.goto('/dashboard/assistante/candidat-individuel', { waitUntil: 'domcontentloaded' });
      await expect(assistantMain.getByText("Actif pour l'équipe", { exact: true })).toBeVisible();
      await expect(assistantMain.getByRole('navigation', { name: 'Étapes du simulateur' })).toBeVisible();
      await expectSurfaceHygiene(assistantPage);
      await assistantPage.screenshot({ path: path.join(ARTIFACT_DIR, 'assistante-active-desktop-1440x1000.png'), fullPage: true });

      const [deactivationResponse] = await Promise.all([
        page.waitForResponse((response) => response.url().endsWith('/api/admin/config') && response.request().method() === 'PATCH'),
        candidateMain.getByRole('button', { name: 'Désactiver', exact: true }).click(),
      ]);
      await recordAuditedPipelineUiPatch(deactivationResponse, 'OFF');
      await expect(candidateMain.getByRole('status').filter({ hasText: 'Le simulateur a été désactivé.' })).toHaveText('Le simulateur a été désactivé.');
      await expect(candidateMain.getByRole('navigation', { name: 'Étapes du simulateur' })).toHaveCount(0);
    } finally {
      await assistantContext.close();
    }
  });

  test('PARENT, ELEVE, COACH et anonyme sont redirigés exactement hors des deux surfaces staff', async ({ page, context }) => {
    const surfaces = ['/dashboard/admin/candidat-individuel', '/dashboard/assistante/candidat-individuel'];
    for (const actor of [
      { role: 'parent' as const, expected: '/dashboard/parent' },
      { role: 'student' as const, expected: '/dashboard/eleve' },
      { role: 'coach' as const, expected: '/dashboard/coach' },
    ]) {
      for (const surface of surfaces) {
        await context.clearCookies();
        await loginAsUser(page, actor.role, { navigate: false });
        await page.goto(surface, { waitUntil: 'domcontentloaded' });
        await expectExactPath(page, actor.expected);
      }
    }
    for (const surface of surfaces) {
      await context.clearCookies();
      await page.goto(surface, { waitUntil: 'domcontentloaded' });
      await expectExactPath(page, '/auth/signin');
      expect(new URL(page.url()).searchParams.get('callbackUrl')).toBe(surface);
    }
  });

  test('ACTIVE_PUBLIC est rejeté par la vraie API ADMIN et ne rend jamais le pipeline public', async ({ page }) => {
    await snapshotCandidatIndividuelConfig(page);
    await setPipelineState(page, 'OFF');
    await loginAsConfigAdmin(page);
    const rejected = await page.request.patch('/api/admin/config', {
      data: { namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_PUBLIC' },
    });
    const rejectedBody = await rejected.json();
    expect(rejected.status(), `rejet ACTIVE_PUBLIC: ${redactDiagnosticPayload(rejectedBody)}`).toBe(400);
    const effectiveResponse = await page.request.get('/api/admin/config');
    await expectHttpStatus(effectiveResponse, 200, 'GET config après rejet ACTIVE_PUBLIC');
    const effectiveBody = await effectiveResponse.json() as { entries?: ConfigEntry[] };
    const pipelineState = effectiveBody.entries?.find((entry) =>
      entry.namespace === 'pricing.candidatIndividuelPipeline' && entry.key === 'state')?.value;
    expect(pipelineState).toBe('OFF');
    expect(['ACTIVE_PUBLIC', 'ACTIVE_PUBLIC_PERCENTAGE'].includes(String(pipelineState))).toBe(false);
  });

  test("le CTA ADMIN crée une famille réelle puis la retrouve dans l'identité du simulateur", async ({ page, context }) => {
    await snapshotCandidatIndividuelConfig(page);
    await setPipelineState(page, 'ACTIVE_INTERNAL');
    const syntheticFamilies: SyntheticFamilyFixture[] = [];
    const marker = randomUUID().slice(0, 8);
    const parentFirstName = `RespUi${marker}`;
    const studentFirstName = `EleveUi${marker}`;
    const parentEmail = `resp.ui.${marker}@nexus-e2e-test.com`;
    const studentEmail = `eleve.ui.${marker}@nexus-e2e-test.com`;
    try {
      await context.clearCookies();
      await loginAsUser(page, 'admin', { targetPath: '/dashboard/admin/candidat-individuel' });
      await expect(page.getByRole('heading', { name: 'Élève et responsable', exact: true })).toBeVisible();
      const studentsCta = page.getByRole('link', { name: "Ouvrir l'espace Élèves", exact: true });
      await expect(studentsCta).toHaveAttribute('href', '/dashboard/admin/students');
      await studentsCta.click();
      await expectExactPath(page, '/dashboard/admin/students');
      await expect(page.getByRole('heading', { level: 1, name: 'Gestion des Élèves', exact: true })).toBeVisible();
      await expectSurfaceHygiene(page);

      await page.getByRole('button', { name: '+ Créer parent + élève', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Créer un parent et un élève' });
      await dialog.locator('#parentEmail').fill(parentEmail);
      await dialog.locator('#parentFirstName').fill(parentFirstName);
      await dialog.locator('#parentLastName').fill('Recette');
      await dialog.locator('#parentPhone').fill('+216 99 000 000');
      await dialog.locator('#studentEmail').fill(studentEmail);
      await dialog.locator('#studentFirstName').fill(studentFirstName);
      await dialog.locator('#studentLastName').fill('Recette');
      await dialog.locator('#studentGrade').fill('Terminale');
      await dialog.locator('#studentSchool').fill('Lycée E2E Test');
      const [creationResponse] = await Promise.all([
        page.waitForResponse((response) => response.url().endsWith('/api/assistante/students') && response.request().method() === 'POST'),
        dialog.getByRole('button', { name: 'Créer', exact: true }).click(),
      ]);
      const creationBody = await creationResponse.json() as { studentId?: string; contactLeadId?: string };
      expect(
        creationResponse.status(),
        `création staff parent+élève: ${redactDiagnosticPayload(creationBody)}`,
      ).toBe(201);
      expect(typeof creationBody.studentId).toBe('string');
      expect(typeof creationBody.contactLeadId).toBe('string');
      syntheticFamilies.push(await getSyntheticFamilyFixtureFromStaffCreation(
        creationBody.contactLeadId!,
        creationBody.studentId!,
      ));
      await expect(dialog).toHaveCount(0);

      await page.getByRole('link', { name: 'Retour au simulateur', exact: true }).click();
      await expectExactPath(page, '/dashboard/admin/candidat-individuel');
      await page.locator('#lead-search').fill(parentFirstName);
      const leadOption = page.getByRole('option', { name: new RegExp(parentFirstName, 'i') });
      await expect(leadOption).toBeVisible();
      await leadOption.click();
      await expect(page.getByTestId('selected-lead')).toContainText(parentFirstName);
      await page.locator('#student-search').fill(studentFirstName);
      const studentOption = page.getByRole('option', { name: new RegExp(studentFirstName, 'i') });
      await expect(studentOption).toBeVisible();
      await studentOption.click();
      await expect(page.getByTestId('selected-student')).toContainText(studentFirstName);
      await expectSurfaceHygiene(page);
    } finally {
      await cleanupSyntheticFamilies(syntheticFamilies);
      await setPipelineState(page, 'OFF');
    }
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
    await page.locator('#candidate-specialiteAbandonnee').selectOption('NSI');
    await page.getByLabel('Un changement de spécialité est déclaré', { exact: true }).check();
    await page.getByText('Options avancées', { exact: true }).click();
    await page.locator('#advanced-dispensations').fill(JSON.stringify(readyDispenses));
    const commercialDiagnosticRaw = {
      nsi: { points: 2, maxPoints: 20, percentage: 10 },
    };
    const commercialMonthlyBudgetTnd = 1_300;
    await page.locator('#advanced-diagnostic').fill(JSON.stringify(commercialDiagnosticRaw));
    await page.locator('#monthly-budget').fill(String(commercialMonthlyBudgetTnd));

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
          groupHeadcountRequirements?: Array<{ subject: string }>;
          monthlyTotal: number;
          grandTotal: number;
          deposit: number;
          lastInstallmentAmount: number;
          paymentPolicy: string;
          months: number;
          matchedOfferId: string | null;
        }>;
      };
    };
    expect(
      simulationBody.result.status,
      `la simulation doit être READY; réponse expurgée: ${redactDiagnosticPayload(simulationBody)}`,
    ).toBe('READY');
    const selectedModuleIds = (simulationBody.result.selection?.modules ?? [])
      .filter((module) => module.status === 'SELECTED')
      .map((module) => module.moduleId);
    expect(selectedModuleIds).toContain('MOD_SPECIALITE_ABANDONNEE');
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
    const selectedSimulationScenarioCandidate = simulationScenarios.find((scenario) =>
      scenario.paymentPolicy === 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS'
      && scenario.deposit > 0
      && scenario.monthlyTotal > 0
      && scenario.lastInstallmentAmount > 0
      && scenario.months > 0
      && scenario.lines.some((line) =>
        line.subject === 'specialite-abandonnee'
        && normalizeRenderedText(line.reason).includes(normalizeRenderedText(SPECIALITE_ABANDONNEE_WARNING))));
    expect(
      selectedSimulationScenarioCandidate,
      `un scénario annuel sur-mesure avec acompte et spécialité abandonnée est requis; réponse expurgée: ${redactDiagnosticPayload(simulationBody)}`,
    ).toBeDefined();
    const selectedSimulationScenario = selectedSimulationScenarioCandidate!;
    const selectedTierLabel = {
      ESSENTIEL: 'Essentiel',
      RECOMMANDE: 'Recommandé',
      COMPLET: 'Complet',
    }[selectedSimulationScenario.tier];
    const selectedTierButton = page.getByRole('button', { name: selectedTierLabel, exact: true });
    await selectedTierButton.click();
    await expect(selectedTierButton).toHaveAttribute('aria-pressed', 'true');
    const selectedGroupRequirements = selectedSimulationScenario.groupHeadcountRequirements
      ?? selectedSimulationScenario.lines
        .filter((line) => line.modality === 'GROUPE')
        .map((line) => ({ subject: line.subject }));
    const fixtureConfirmedHeadcounts = selectedGroupRequirements.map((_requirement, index) => Math.min(index + 1, 3));
    expect(fixtureConfirmedHeadcounts.length).toBeGreaterThanOrEqual(3);
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
    await expect(headcountGroups).toHaveCount(selectedGroupRequirements.length);
    await expect(page.getByRole('button', { name: 'Voir la proposition financière' })).toBeDisabled();

    const quoteCountBeforePending = await countQuotesByProfilId(profileId);
    expect(quoteCountBeforePending).toBe(0);
    const pendingResponse = await page.request.post(`/api/assistante/candidat-individuel/profils/${profileId}/quote`, {
      data: {
        idempotencyKey: `e2e-group-pending-${randomUUID()}`,
        budget: { monthlyBudgetTnd: commercialMonthlyBudgetTnd, strategy: 'MOST_COMPLETE' },
        diagnostic: { raw: commercialDiagnosticRaw },
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

    for (const [index, confirmedHeadcount] of fixtureConfirmedHeadcounts.entries()) {
      if (confirmedHeadcount === 1) await chooseHeadcount(page, index, 'Individuel');
      else if (confirmedHeadcount === 2) await chooseHeadcount(page, index, 'Duo');
      else await chooseHeadcount(page, index, 'Petit groupe', confirmedHeadcount);
    }
    const financialButton = page.getByRole('button', { name: 'Voir la proposition financière' });
    await expect(financialButton).toBeEnabled();
    await financialButton.click();
    await expect(page.getByRole('heading', { name: 'Proposition financière', exact: true })).toBeVisible();

    const quoteResponsePromise = page.waitForResponse((response) =>
      /\/api\/assistante\/candidat-individuel\/profils\/[^/]+\/quote$/.test(new URL(response.url()).pathname)
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Générer le devis' }).click();
    const quoteResponse = await quoteResponsePromise;
    const quoteBody = await quoteResponse.json();
    expect(
      quoteResponse.status(),
      `la création du devis doit réussir; réponse expurgée: ${redactDiagnosticPayload(quoteBody)}`,
    ).toBe(201);
    const quotePayload = quoteResponse.request().postDataJSON() as Record<string, unknown>;
    expect(quotePayload).toMatchObject({
      budget: { monthlyBudgetTnd: commercialMonthlyBudgetTnd, strategy: 'MOST_COMPLETE' },
      diagnostic: { raw: commercialDiagnosticRaw },
      scenarioTier: selectedSimulationScenario.tier,
    });
    const quoteId = String(quoteBody.quote.id);
    expect(quoteBody.quote.totals.annualTnd).toBeGreaterThan(0);
    expect(quoteBody.quote.totals.depositTnd).toBeGreaterThan(0);
    expect(quoteBody.quote.totals.installmentTnd).toBeGreaterThan(0);
    expect(quoteBody.quote.totals.installmentCount).toBeGreaterThan(0);
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
    expect(dbQuote!.deposit).not.toBeNull();
    expect(dbQuote!.deposit!).toBeGreaterThan(0);
    expect(dbQuote!.lastInstallmentAmount).not.toBeNull();
    expect(dbQuote!.lastInstallmentAmount!).toBeGreaterThan(0);
    expect(dbQuote!.paymentPolicy).toBe('ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS');
    expect(Math.max(...dbQuote!.lines.map((line) => line.months))).toBeGreaterThan(0);
    expect(dbQuote!.matchedOfferId).toBe(selectedSimulationScenario.matchedOfferId);
    expect(dbQuote!.lines.map((line) => line.subject)).toEqual(
      selectedSimulationScenario.lines.map((line) => line.label),
    );
    expect(dbQuote!.lines).toHaveLength(selectedSimulationScenario.lines.length);
    const abandonedSpecialtyLineIndex = selectedSimulationScenario.lines.findIndex(
      (line) => line.subject === 'specialite-abandonnee',
    );
    expect(abandonedSpecialtyLineIndex).toBeGreaterThanOrEqual(0);
    const abandonedSpecialtyMonthlyPriceTnd = dbQuote!.lines[abandonedSpecialtyLineIndex]!.unitPrice;
    expect(abandonedSpecialtyMonthlyPriceTnd).toBeGreaterThan(0);
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
    const expectedLineResolutions = fixtureConfirmedHeadcounts.map((confirmedHeadcount) => ({
      confirmedHeadcount,
      effectiveModality: confirmedHeadcount === 1 ? 'SOLO' : confirmedHeadcount === 2 ? 'DUO' : 'GROUPE',
    })).sort((left, right) => left.confirmedHeadcount - right.confirmedHeadcount);
    expect(rules.groupState.lineResolutions).toHaveLength(expectedLineResolutions.length);
    expect(rules.groupState.lineResolutions.map((line) => ({
      confirmedHeadcount: line.confirmedHeadcount,
      effectiveModality: line.effectiveModality,
    })).sort((left, right) => left.confirmedHeadcount - right.confirmedHeadcount)).toEqual(expectedLineResolutions);

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
    const staffPdfText = normalizeRenderedText(await extractPdfText(Buffer.from(await staffPdf.body())));
    expect(staffPdfText.trim().length).toBeGreaterThan(1000);
    expect(staffPdfText).toMatch(/Nexus Réussite/i);
    expect(staffPdfText).toContain('RespFinal Recette');
    expect(staffPdfText).toContain('EleveFinal Recette');
    expect(staffPdfText).toContain(quoteId);
    expect(staffPdfText).toMatch(/Mathématiques/i);
    expect(staffPdfText).toMatch(/Physique(?:-| )chimie/i);
    expect(staffPdfText).toMatch(/TND/i);
    expect(staffPdfText).toMatch(/BROUILLON INTERNE/i);
    expect(staffPdfText).toContain(formatTndForAssertion(dbQuote!.grandTotal));
    expect(staffPdfText).toContain(formatTndForAssertion(dbQuote!.deposit!));
    expect(staffPdfText).toContain(formatTndForAssertion(dbQuote!.monthlyTotal));
    expect(staffPdfText).toMatch(/Échéancier/i);
    expect(staffPdfText).toMatch(/Mensualité 1\/10/i);
    expect(staffPdfText).toContain(normalizeRenderedText(SPECIALITE_ABANDONNEE_WARNING));
    expectAbandonedSpecialtyCommercialPdfLine(staffPdfText, abandonedSpecialtyMonthlyPriceTnd);
    expect(staffPdfText).toMatch(/(?:Individuel|Duo|Petit groupe|Parcours combiné)/i);
    expect(staffPdfText).toMatch(/\d+ h\/mois/i);
    expectTextWithoutInternals(staffPdfText, [
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
      const publicText = normalizeRenderedText(await familyPage.locator('main').innerText());
      expect(publicText).toContain('RespFinal Recette');
      expect(publicText).toContain('EleveFinal Recette');
      expect(publicText).toMatch(/Terminale · Mathématiques · Physique-chimie/i);
      await expectAbandonedSpecialtyCommercialHtmlLine(familyPage, abandonedSpecialtyMonthlyPriceTnd);
      expect(publicText).toMatch(/(?:Individuel|Duo|Petit groupe|Parcours combiné)/i);
      expect(publicText).toMatch(/\d+ h \/ mois/i);
      expect(publicText).toMatch(/TND \/ mois/i);
      expect(publicText).toMatch(/(?<![\p{L}\p{N}])TOTAL ANNUEL(?![\p{L}\p{N}])/iu);
      expect(publicText).toContain(formatTndForAssertion(dbQuote!.grandTotal));
      expect(publicText).toMatch(/(?<![\p{L}\p{N}])ACOMPTE(?![\p{L}\p{N}])/iu);
      expect(publicText).toContain(formatTndForAssertion(dbQuote!.deposit!));
      expect(publicText).toMatch(/(?<![\p{L}\p{N}])MENSUALITÉ(?![\p{L}\p{N}])/iu);
      expect(publicText).toContain(formatTndForAssertion(dbQuote!.monthlyTotal));
      expect(publicText).toMatch(/(?<![\p{L}\p{N}])10 MENSUALITÉS(?![\p{L}\p{N}])/iu);
      expect(publicText).toMatch(/(?<![\p{L}\p{N}])ÉCHÉANCIER(?![\p{L}\p{N}])/iu);
      expect(publicText).toMatch(/(?<![\p{L}\p{N}])MENSUALITÉ 1\/10(?![\p{L}\p{N}])/iu);
      expect(publicText).toContain(normalizeRenderedText(SPECIALITE_ABANDONNEE_WARNING));

      const token = new URL(secondFamilyUrl).pathname.split('/').pop()!;
      const familyPdf = await familyContext.request.get(`/api/quotes/public/${token}/pdf`);
      expect(familyPdf.status()).toBe(200);
      const familyPdfText = normalizeRenderedText(await extractPdfText(Buffer.from(await familyPdf.body())));
      expect(familyPdfText.trim().length).toBeGreaterThan(1000);
      expect(familyPdfText).toMatch(/Nexus Réussite/i);
      expect(familyPdfText).toContain('RespFinal Recette');
      expect(familyPdfText).toContain('EleveFinal Recette');
      expect(familyPdfText).toContain(quoteId);
      expect(familyPdfText).toMatch(/Mathématiques/i);
      expect(familyPdfText).toMatch(/Physique(?:-| )chimie/i);
      expect(familyPdfText).toMatch(/TND/i);
      expect(familyPdfText).not.toMatch(/BROUILLON INTERNE|NE PAS ENVOYER/i);
      expect(familyPdfText).toContain(formatTndForAssertion(dbQuote!.grandTotal));
      expect(familyPdfText).toContain(formatTndForAssertion(dbQuote!.deposit!));
      expect(familyPdfText).toContain(formatTndForAssertion(dbQuote!.monthlyTotal));
      expect(familyPdfText).toMatch(/Échéancier/i);
      expect(familyPdfText).toMatch(/Mensualité 1\/10/i);
      expect(familyPdfText).toContain(normalizeRenderedText(SPECIALITE_ABANDONNEE_WARNING));
      expectAbandonedSpecialtyCommercialPdfLine(familyPdfText, abandonedSpecialtyMonthlyPriceTnd);
      expect(familyPdfText).toMatch(/(?:Individuel|Duo|Petit groupe|Parcours combiné)/i);
      expect(familyPdfText).toMatch(/\d+ h\/mois/i);
      expectTextWithoutInternals(familyPdfText, [
        profileId,
        syntheticFamily.contactLeadId,
        syntheticFamily.studentId,
        syntheticFamily.parentProfileId,
        syntheticFamily.parentUserId,
        syntheticFamily.studentUserId,
      ], token);
      expectTextWithoutInternals(publicText, [
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
