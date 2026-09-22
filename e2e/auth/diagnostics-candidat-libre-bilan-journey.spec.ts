/**
 * Real-browser rehearsal of the full C2 bilan journey (mission
 * "FINALISATION CIBLÉE DE #316" §8): a synthetic candidate deposits a real
 * PDF through the real upload form, an ADMIN starts and follows the real
 * treatment, generates the bilan through the real button (this job's
 * server has no OPENROUTER_API_KEY, so this is a real, honestly-reported
 * PREFLIGHT_BLOCKED — never a fabricated success), corrects one item
 * through the real per-item textarea, previews, validates the exact
 * draft, publishes, and the candidate opens the published revision from
 * their own "Diagnostics libres" screen.
 *
 * No processing row, no ledger row, and no bilan draft is ever created by
 * a direct SQL/Prisma call standing in for a missing UI action — every
 * one of those transitions happens through a real button click against
 * the real standalone server this job already runs.
 *
 * The ONE exception, clearly labeled: this job's server has no
 * OPENROUTER_API_KEY (mission §5/§6 — "ne provoque pas un nouvel appel
 * payant pour chaque rejeu d'interface"), so the real "Générer le bilan"
 * click cannot itself produce an AI proposal to correct. After that real,
 * honest PREFLIGHT_BLOCKED generation, this spec writes a SIMULATED_FIXTURE
 * aiProposal directly onto that exact draft row (never claimed as a real
 * provider call) purely so the per-item correction UI has content to
 * exercise — every subsequent step (correct, preview, validate, publish,
 * candidate read) is then driven by real UI interaction only.
 *
 * That injection is confined to this isolated test file (mission
 * "TERMINER LA LIVRAISON DE #316" §2): it exists nowhere in application
 * source — no endpoint accepts it, no option in the review screen
 * activates it — and it never writes to DiagnosticAiBudgetLedger, so it
 * can never inflate or otherwise touch the pilot's real spend/cap
 * accounting. It requires no provider key at all, in this file or in CI.
 *
 * Confidentiality is checked with a genuine, unique sentinel string
 * written into the real internal-note field and saved through the real
 * "Enregistrer la correction" button — never by checking for the absence
 * of the generic label "Note interne", which would prove nothing about
 * whether the actual content leaked.
 *
 * Uses this job's own DEMO_FIXTURE demo-mode allowlist (ci.yml), fixed to
 * one well-known Student.id this spec always tears down and recreates —
 * never a wildcard, never derived from NODE_ENV.
 */
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { expect, test, type Page } from '@playwright/test';
import { PrismaClient, Prisma } from '@/core-v2/generated/client';
import { diagnosticInstrumentSubjectRelativePath, writeDiagnosticStorageFixture } from '@/lib/core-v2/diagnostics/storage';
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import { DEMO_ANSWER_HTML, DEMO_SUBJECT_HTML } from '@/lib/core-v2/diagnostics/demo-content';
import { gotoSignInForm, loginViaSigninForm, logoutUser } from '../helpers/auth';
import { resetDisposableE2ERateLimits } from '../helpers/rate-limit';
import { sameOriginHeaders } from '../helpers/same-origin';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const coreV2DatabaseUrl = process.env.CORE_V2_DATABASE_URL || '';
const prisma = new PrismaClient({ datasources: { db: { url: coreV2DatabaseUrl } } });

// A genuine sentinel, unique per run — never a generic label like "Note
// interne" (mission §2: the label's absence proves nothing about the
// CONTENT; this exact string is what gets checked, both on the rendered
// candidate page and in the raw API response body).
const INTERNAL_NOTE_SENTINEL = `SENTINEL-INTERNAL-NOTE-${Date.now()}-do-not-leak`;

// Fixed, well-known values (mirroring ci.yml's DIAGNOSTIC_DEMO_STUDENT_IDS) —
// never a nonce, since the demo-mode allowlist is static per server process.
const FIXED_STUDENT_ID = 'e2e-bilan-journey-fixed-student-001';
const nonce = Date.now();
const E2E_KNOWN_SECRET = `E2eBilanJourney.${nonce}.Aa1`;
const studentEmail = `e2e-bilan-journey-student-${nonce}@example.test`;
const instrumentKey = `E2E-BILAN-JOURNEY-${nonce}`;

let householdId = '';
let instrumentId = '';
let assignmentId = '';
let submissionId = '';
let processingId = '';
let draftId = '';

async function cleanupFixedStudent(): Promise<void> {
  const existingStudent = await prisma.student.findUnique({ where: { id: FIXED_STUDENT_ID } });
  if (!existingStudent) return;
  const assignments = await prisma.diagnosticAssignment.findMany({ where: { studentId: FIXED_STUDENT_ID }, select: { id: true } });
  for (const { id } of assignments) {
    const submissions = await prisma.diagnosticSubmission.findMany({ where: { assignmentId: id }, select: { id: true } });
    for (const { id: subId } of submissions) {
      const processing = await prisma.diagnosticSubmissionProcessing.findUnique({ where: { submissionId: subId } });
      if (processing) {
        await prisma.diagnosticBilanDraft.deleteMany({ where: { processingId: processing.id } });
        await prisma.diagnosticAiBudgetLedger.deleteMany({ where: { processingId: processing.id } });
        await prisma.diagnosticSubmissionExtraction.deleteMany({ where: { processingId: processing.id } });
        await prisma.diagnosticSubmissionProcessing.deleteMany({ where: { id: processing.id } });
      }
    }
    await prisma.diagnosticSubmission.deleteMany({ where: { assignmentId: id } });
  }
  await prisma.diagnosticAssignment.deleteMany({ where: { studentId: FIXED_STUDENT_ID } });
  await prisma.student.deleteMany({ where: { id: FIXED_STUDENT_ID } });
  await prisma.user.deleteMany({ where: { id: existingStudent.userId } });
  await prisma.household.deleteMany({ where: { id: existingStudent.householdId } }).catch(() => undefined);
}

test.beforeAll(async () => {
  await cleanupFixedStudent();

  const subjectPdf = await renderHtmlToPdf(DEMO_SUBJECT_HTML);
  const subjectSha256 = createHash('sha256').update(subjectPdf).digest('hex');
  const instrument = await prisma.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: 'E2E bilan journey — DEMO_FIXTURE',
      subject: 'Test',
      level: 'Toutes',
      targetSession: 'E2E',
      form: 'FORM_E2E',
      durationMinutes: 10,
      modalities: 'E2E bilan journey fixture — jamais un instrument réel.',
      catalogStatus: 'DEMO_FIXTURE',
      manifestChecksum: createHash('sha256').update(`${instrumentKey}@1.0.0`).digest('hex'),
      manifestVersion: 'e2e/1.0',
      subjectSha256,
    },
  });
  instrumentId = instrument.id;
  await writeDiagnosticStorageFixture(diagnosticInstrumentSubjectRelativePath(instrument.id), subjectPdf);

  const household = await prisma.household.create({
    data: {
      parents: {
        create: {
          user: { create: { email: `e2e-bilan-journey-parent-${nonce}@example.test`, role: 'PARENT', accountStatus: 'ACTIVE', activatedAt: new Date() } },
          isPrimaryContact: true,
        },
      },
    },
  });
  householdId = household.id;

  const studentUser = await prisma.user.create({
    data: {
      email: studentEmail,
      role: 'ELEVE',
      firstName: 'E2eBilanJourney',
      lastName: 'Student',
      password: await bcrypt.hash(E2E_KNOWN_SECRET, 4),
      accountStatus: 'ACTIVE',
      activatedAt: new Date(),
    },
  });
  await prisma.student.create({ data: { id: FIXED_STUDENT_ID, userId: studentUser.id, householdId: household.id } });

  const assignment = await prisma.diagnosticAssignment.create({
    data: {
      studentId: FIXED_STUDENT_ID,
      instrumentRefId: instrument.id,
      instrumentKeySnapshot: instrument.instrumentKey,
      instrumentVersionSnapshot: instrument.version,
      formSnapshot: instrument.form,
      manifestChecksumSnapshot: instrument.manifestChecksum,
      subjectSha256Snapshot: instrument.subjectSha256,
      studentProfileSnapshot: { available: false },
      assignedById: null,
    },
  });
  assignmentId = assignment.id;
});

test.afterAll(async () => {
  await cleanupFixedStudent();
  await prisma.diagnosticInstrumentRef.deleteMany({ where: { id: instrumentId } }).catch(() => undefined);
  await prisma.$disconnect();
});

async function loginAsCandidate(page: Page): Promise<void> {
  await resetDisposableE2ERateLimits();
  await gotoSignInForm(page);
  await page.locator('#email').fill(studentEmail);
  await page.locator('#password').fill(E2E_KNOWN_SECRET);
  await Promise.all([
    page.waitForURL((url) => url.pathname.startsWith('/dashboard'), { timeout: 30_000 }),
    page.getByTestId('btn-signin').click(),
  ]);
}

test('candidate deposits a real answer PDF through the real upload form', async ({ page }) => {
  await loginAsCandidate(page);
  await page.goto(`${BASE_URL}/dashboard/eleve/diagnostics-libres`, { waitUntil: 'domcontentloaded' });

  const answerPdf = await renderHtmlToPdf(DEMO_ANSWER_HTML);
  await page.locator('input[type="file"]').setInputFiles({ name: 'reponses.pdf', mimeType: 'application/pdf', buffer: answerPdf });
  await page.getByRole('button', { name: 'Déposer', exact: true }).click();
  await expect(page.getByText(/Réponses déposées avec succès/)).toBeVisible({ timeout: 15_000 });

  const submission = await prisma.diagnosticSubmission.findFirstOrThrow({ where: { assignmentId }, orderBy: { version: 'desc' } });
  submissionId = submission.id;
  expect(submission.sha256).toBe(createHash('sha256').update(answerPdf).digest('hex'));

  await logoutUser(page);
});

test('ADMIN starts the treatment, follows it to EXTRACTED, and generates the bilan (real, honest PREFLIGHT_BLOCKED)', async ({ page }) => {
  await loginViaSigninForm(page, 'admin');
  await page.goto(`${BASE_URL}/dashboard/admin/familles/${householdId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  await page.getByTestId('link-view-bilan-review').click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/admin/diagnostics-candidat-libre/${submissionId}$`));

  await page.getByTestId('btn-start-processing').click();
  // The component re-fetches and re-renders immediately on success — by
  // design it shows the new QUEUED/EXTRACTING status right away rather
  // than a transient toast that would then be replaced a moment later.
  // Real, actually-rendered evidence the click worked: the "none" card
  // (with its own start button) is gone, replaced by the pending-status
  // view with its "Actualiser" button.
  await expect(page.getByTestId('btn-start-processing')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Actualiser' })).toBeVisible({ timeout: 10_000 });

  // Bounded polling via the real "Actualiser" button — never an
  // indefinite loop: at most 20 tries, ~1s apart, matching the worker's
  // own poll interval in this job's server env.
  let ready = false;
  for (let i = 0; i < 20; i += 1) {
    if (await page.getByTestId('btn-generate-bilan').isVisible().catch(() => false)) {
      ready = true;
      break;
    }
    const refresh = page.getByRole('button', { name: 'Actualiser' });
    if (await refresh.isVisible().catch(() => false)) await refresh.click();
    await page.waitForTimeout(1_000);
  }
  expect(ready).toBe(true);

  await page.getByTestId('btn-generate-bilan').click();
  await expect(page.getByText(/Brouillon/)).toBeVisible({ timeout: 15_000 });
  // Real, honest outcome for this job's server (no OPENROUTER_API_KEY):
  await expect(page.getByText(/PREFLIGHT_BLOCKED/)).toBeVisible();

  const processing = await prisma.diagnosticSubmissionProcessing.findUniqueOrThrow({ where: { submissionId } });
  processingId = processing.id;
  expect(processing.status).toBe('EXTRACTED');
  const draft = await prisma.diagnosticBilanDraft.findFirstOrThrow({ where: { processingId }, orderBy: { revision: 'desc' } });
  draftId = draft.id;
  expect(draft.aiProposal).toBeNull();
});

test('SIMULATED_FIXTURE: inject a synthetic AI proposal onto that exact draft — never a real provider call', async () => {
  // Clearly labeled test double (mission §5/§8): this job's server has no
  // OPENROUTER_API_KEY, so the real button above cannot itself produce a
  // proposal. This write never touches the ledger and is never presented
  // anywhere as a real generation — it exists only so the per-item
  // correction UI below has real content to correct through real clicks.
  const simulatedProposal = {
    items: [
      { itemId: 'item-2', constat: 'SIMULATED_FIXTURE — constat de démonstration.', preuve: 'Ce document sert uniquement à vérifier', incertitude: false },
      { itemId: 'item-3', constat: 'SIMULATED_FIXTURE — constat de démonstration.', preuve: 'Je me suis connecté avec mon compte', incertitude: false },
    ],
    pointsAppui: ['SIMULATED_FIXTURE — point d’appui.'],
    difficultesObservees: [],
    prioritesTravail: [],
    propositionsRemediation: [],
  };
  await prisma.diagnosticBilanDraft.update({
    where: { id: draftId },
    data: {
      aiProposal: simulatedProposal as unknown as Prisma.InputJsonValue,
      aiProvenance: { outcome: 'SIMULATED_FIXTURE', reason: 'no OPENROUTER_API_KEY in this CI job' } as unknown as Prisma.InputJsonValue,
    },
  });
});

test('ADMIN corrects one item, previews, validates the exact draft, and publishes — all through real clicks', async ({ page }) => {
  await loginViaSigninForm(page, 'admin');
  await page.goto(`${BASE_URL}/dashboard/admin/diagnostics-candidat-libre/${submissionId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('btn-validate-bilan')).toBeVisible();

  // Correct item-2's constat through the real per-item textarea, AND fill a
  // genuine sentinel internal note (mission §2: absence of the LABEL "Note
  // interne" does not prove the CONTENT is confidential — the sentinel
  // string itself is checked below, on the candidate's page and on the raw
  // API response body).
  const correctionField = page.getByTestId('item-correction-item-2');
  await correctionField.fill('Constat corrigé par l’enseignant — E2E.');
  await page.getByTestId('internal-note').fill(INTERNAL_NOTE_SENTINEL);
  await page.getByTestId('btn-save-correction').click();
  await expect(page.getByText('Correction enregistrée.')).toBeVisible({ timeout: 10_000 });

  // Preview before validating, reusing the shared render component.
  await page.getByTestId('btn-toggle-preview').click();
  await expect(page.getByTestId('bilan-preview').getByText('Constat corrigé par l’enseignant — E2E.')).toBeVisible();
  await expect(page.getByTestId('bilan-preview').getByText('SIMULATED_FIXTURE — constat de démonstration.')).toHaveCount(1); // item-3, uncorrected, still AI text

  await page.getByTestId('btn-validate-bilan').click();
  await expect(page.getByText('Bilan validé.')).toBeVisible({ timeout: 10_000 });

  await expect(page.getByTestId('btn-publish-bilan')).toBeVisible();
  await page.getByTestId('btn-toggle-preview').click();
  await expect(page.getByTestId('bilan-preview')).toBeVisible();

  await page.getByTestId('btn-publish-bilan').click();
  await expect(page.getByText('Bilan publié.')).toBeVisible({ timeout: 10_000 });

  const published = await prisma.diagnosticBilanDraft.findUniqueOrThrow({ where: { id: draftId } });
  expect(published.status).toBe('PUBLISHED');
  expect(published.publishedAudienceScope).toBe('own-student');

  await logoutUser(page);
});

test('the candidate opens the published bilan from their own Diagnostics libres screen — the sentinel internal note is absent from both the page and the raw API response', async ({ page }) => {
  await loginAsCandidate(page);
  await page.goto(`${BASE_URL}/dashboard/eleve/diagnostics-libres`, { waitUntil: 'domcontentloaded' });

  const bilanSection = page.getByTestId('own-bilan-section');
  await expect(bilanSection).toBeVisible({ timeout: 15_000 });
  await expect(bilanSection.getByText('Constat corrigé par l’enseignant — E2E.')).toBeVisible();

  // The rendered page never shows the sentinel — not just the generic label "Note interne".
  await expect(page.getByText(INTERNAL_NOTE_SENTINEL)).toHaveCount(0);

  // Stronger check: the sentinel is absent from the RAW response body of
  // the exact API route the candidate's page itself calls — proves the
  // server never serializes it into this response at all, not merely that
  // the current UI happens not to render a field that holds it.
  const rawResponse = await page.request.get(`${BASE_URL}/api/v2/student/diagnostics/submissions/${submissionId}/bilan`, {
    headers: sameOriginHeaders(BASE_URL),
  });
  expect(rawResponse.status()).toBe(200);
  const rawBody = await rawResponse.text();
  expect(rawBody).not.toContain(INTERNAL_NOTE_SENTINEL);
  expect(rawBody).not.toContain('humanReview');

  await logoutUser(page);
});
