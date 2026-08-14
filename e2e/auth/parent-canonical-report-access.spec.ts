import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { assertDisposableE2eDatabase } from '../helpers/disposable-database';
import { waitForAuthenticatedSession } from '../helpers/auth';

import { SECONDE_ENTRY_RECIPE_FACT_SHEETS } from '../../__tests__/bilans/fixtures/recipe-fact-sheets';
import { publishReportRevision } from '../../lib/bilans/core/report-service';
import {
  BILAN_PDF_ENGINE_VERSION,
  createBilanPdfRendererSession,
} from '../../lib/bilans/render/pdf';

const databaseUrl = process.env.DATABASE_URL ?? '';
assertDisposableE2eDatabase(databaseUrl);

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const packSlug = 'entree-seconde-maths-v1';
const parentMarker = '__PARENT_CHANNEL__';
const forbiddenMarkers = [
  '__STUDENT_CHANNEL__',
  '__NEXUS_CHANNEL__',
  '__VERIFIER_CHANNEL__',
  '__INTERNAL_CHANNEL__',
] as const;

async function signIn(page: import('@playwright/test').Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/signin');
  await page.getByRole('textbox', { name: 'Adresse Email' }).fill(email);
  await page.getByLabel(/^mot de passe$/i).fill(password);
  await page.getByRole('button', { name: /accéder à mon espace/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/parent/);
}

async function prepareReviewFixture(attemptId: string, studentId: string, nonce: number) {
  const attempt = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  await prisma.canonicalAssessmentAttempt.update({
    where: { id: attemptId },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });

  const factSheet = SECONDE_ENTRY_RECIPE_FACT_SHEETS[0];
  const score = await prisma.scoreSnapshot.create({
    data: {
      assessmentAttemptId: attemptId,
      scoringPolicyId: attempt.scoringPolicyId,
      scoringPolicyVersion: attempt.scoringPolicyVersion,
      scoringPolicyChecksum: attempt.assessmentPackChecksum,
      score: 0,
      result: JSON.parse(JSON.stringify(factSheet)),
    },
  });
  await prisma.canonicalAssessmentAttempt.update({ where: { id: attemptId }, data: { status: 'SCORED' } });

  const report = await prisma.reportArtifact.create({
    data: { studentId, assessmentAttemptId: attemptId, status: 'PENDING_REVIEW' },
  });
  const revision = await prisma.reportRevision.create({
    data: {
      reportArtifactId: report.id,
      scoreSnapshotId: score.id,
      status: 'PENDING_REVIEW',
      reportPackId: 'p0c-e2e-report-pack',
      reportPackVersion: '1',
      corpusManifestId: 'p0c-e2e-corpus',
      corpusManifestVersion: '1',
      promptRevision: 'p0c-e2e-fixture',
      contextChecksum: `p0c-e2e-${nonce}`,
      content: {
        NEXUS: {
          identity: {
            displayName: 'ELEVE_SYNTHETIQUE',
            level: 'SECONDE',
            subject: 'MATHS',
            date: '4 août 2026',
            stageLabel: 'Stage de pré-rentrée — Entrée en Seconde, Mathématiques',
          },
          marker: '__NEXUS_CHANNEL__',
        },
        verifier: '__VERIFIER_CHANNEL__',
        internal: '__INTERNAL_CHANNEL__',
      },
    },
  });
  await prisma.canonicalAssessmentAttempt.update({
    where: { id: attemptId },
    data: { status: 'REPORT_PENDING_REVIEW' },
  });

  const assistante = await prisma.user.create({
    data: {
      email: `p0c-assistante-${nonce}@example.test`,
      role: 'ASSISTANTE',
      firstName: 'Assistante',
      lastName: 'Synthétique',
      activatedAt: new Date(),
    },
  });
  await prisma.reportReview.create({
    data: {
      reportRevisionId: revision.id,
      reviewerId: assistante.id,
      decision: 'APPROVED',
      motif: 'Fixture contrôlée de consultation Parent.',
    },
  });
  await prisma.reportRevision.update({ where: { id: revision.id }, data: { status: 'COACH_VALIDATED' } });
  await prisma.canonicalAssessmentAttempt.update({
    where: { id: attemptId },
    data: { status: 'COACH_VALIDATED' },
  });
  return { revisionId: revision.id, reviewerId: assistante.id };
}

async function publishFixture(revisionId: string, reviewerId: string): Promise<void> {
  const pdfSession = await createBilanPdfRendererSession();
  try {
    await publishReportRevision({
      prisma,
      revisionId,
      reviewerId,
      publishedAt: new Date(),
      renderAudience: async (_factSheet, audience) => {
        const marker = audience === 'PARENTS'
          ? parentMarker
          : audience === 'ELEVE'
            ? '__STUDENT_CHANNEL__'
            : '__NEXUS_CHANNEL__ __INTERNAL_CHANNEL__';
        const html = `<!doctype html><html lang="fr"><body><main><h1>Bilan synthétique</h1><p>${marker}</p></main></body></html>`;
        return {
          status: 'AVAILABLE' as const,
          html,
          pdf: await pdfSession.renderHtmlToPdf(html),
          engineVersion: BILAN_PDF_ENGINE_VERSION,
        };
      },
    });
  } finally {
    await pdfSession.close();
  }
}

async function createLegacyPublishedBilan(studentId: string, studentEmail: string, nonce: number) {
  return prisma.bilan.create({
    data: {
      type: 'DIAGNOSTIC_PRE_STAGE',
      subject: 'MATHEMATIQUES',
      studentId,
      studentEmail,
      studentName: 'Élève A1 Synthétique',
      parentsMarkdown: `${parentMarker} legacy-${nonce}`,
      studentMarkdown: `__STUDENT_CHANNEL__ legacy-${nonce}`,
      nexusMarkdown: `__NEXUS_CHANNEL__ legacy-${nonce}`,
      analysisJson: { marker: `__INTERNAL_CHANNEL__ legacy-${nonce}` },
      status: 'COMPLETED',
      isPublished: true,
      publishedAt: new Date(),
      ragCollections: [],
    },
  });
}

function expectPrivateNoStore(headers: Record<string, string>): void {
  expect(headers['cache-control']).toContain('private');
  expect(headers['cache-control']).toContain('no-store');
  expect(headers['cache-control']).toContain('max-age=0');
  expect(headers.pragma).toBe('no-cache');
  expect(headers.expires).toBe('0');
  expect(headers.etag).toBeUndefined();
}

test.describe('P0-C — consultation Parent sécurisée', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('le Parent voit uniquement sa restitution publiée', async ({ page, browser }) => {
    const nonce = Date.now();
    const parentEmail = `p0c-parent-a-${nonce}@example.test`;
    const parentPassword = 'ParentSynthetic!2026';
    const childPassword = 'ChildSynthetic!2026';

    await page.goto('/bilan-gratuit');
    await page.locator('#parentFirstName').fill('Parent');
    await page.locator('#parentLastName').fill('A Synthétique');
    await page.locator('#parentEmail').fill(parentEmail);
    await page.locator('#parentPhone').fill('+21699000004');
    await page.locator('#studentFirstName').fill('Élève A1');
    await page.locator('#studentGrade').selectOption('seconde');
    await page.locator('label').filter({ hasText: /J.accepte d.être contacté/ }).getByRole('checkbox').click();
    await page.getByRole('button', { name: /créer mon espace/i }).click();
    await expect(page).toHaveURL(/\/bilan-gratuit\/confirmation/);

    const parent = await prisma.user.findUniqueOrThrow({
      where: { email: parentEmail },
      include: { parentProfile: { include: { children: { include: { user: true } } } } },
    });
    const child = parent.parentProfile?.children[0];
    expect(child).toBeDefined();
    await prisma.user.update({
      where: { id: parent.id },
      data: {
        password: await bcrypt.hash(parentPassword, 12),
        activatedAt: new Date(),
        activationToken: null,
        activationExpiry: null,
      },
    });

    await signIn(page, parentEmail, parentPassword);
    await expect(page).toHaveURL(/\/dashboard\/parent/);
    await page.goto(`/dashboard/parent/enfant/${child!.id}`);
    await page.getByRole('checkbox', { name: /consentement explicite/i }).check();
    await page.getByRole('button', { name: /confirmer le rattachement/i }).click();
    await expect(page.getByText(/rattachement vérifié/i)).toBeVisible();
    await page.getByRole('button', { name: /actualiser les bilans/i }).click();
    await expect(page.getByText(/aucun bilan de positionnement/i)).toBeVisible();

    await page.goto('/dashboard/parent');
    await page.getByRole('button', { name: /activer le compte élève/i }).click();
    const loginIdentifier = (await page.getByText(/^[a-z0-9.]+@nexus-student\.local$/).textContent())!;
    const activationUrl = await page.getByRole('link', { name: /ouvrir l.activation/i }).getAttribute('href');
    expect(activationUrl).toContain('/auth/activate?token=');
    await page.getByRole('button', { name: 'Se déconnecter de votre compte' }).click();
    await page.waitForURL((url) => ['/auth/signin', '/'].includes(url.pathname));

    await page.goto(activationUrl!);
    await page.getByLabel(/^mot de passe$/i).fill(childPassword);
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(childPassword);
    await page.getByRole('button', { name: /activer mon compte/i }).click();
    await expect(page.getByRole('heading', { name: /compte activé/i })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/signin\?activated=true/, { timeout: 10_000 });
    await page.getByRole('textbox', { name: 'Adresse Email' }).fill(loginIdentifier);
    await page.getByLabel(/^mot de passe$/i).fill(childPassword);
    await page.getByRole('button', { name: /accéder à mon espace/i }).click();
    await waitForAuthenticatedSession(page, child!.user.email!);
    await page.goto('/dashboard/eleve', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard\/eleve/);

    const attemptResponse = await page.request.post('/api/bilans/attempts', {
      headers: { 'idempotency-key': `p0c-browser-${nonce}` },
      data: { packSlug },
    });
    expect(attemptResponse.status()).toBe(201);
    const attemptPayload = await attemptResponse.json() as { attempt?: { id?: string }; attemptId?: string; id?: string };
    const attemptId = attemptPayload.attempt?.id ?? attemptPayload.attemptId ?? attemptPayload.id;
    expect(attemptId).toBeTruthy();
    const prepared = await prepareReviewFixture(attemptId!, child!.id, nonce);

    await page.getByRole('button', { name: 'Se déconnecter de votre compte' }).click();
    await page.waitForURL((url) => ['/auth/signin', '/'].includes(url.pathname));
    await signIn(page, parentEmail, parentPassword);
    await page.goto(`/dashboard/parent/enfant/${child!.id}`);
    await expect(page.getByText(/relecture pédagogique en cours/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /lire le bilan/i })).toHaveCount(0);
    const draftDirect = await page.request.get(
      `/api/parent/children/${child!.id}/bilans/${attemptId}/report?format=html`,
    );
    expect(draftDirect.status()).toBe(404);
    expectPrivateNoStore(draftDirect.headers());

    await publishFixture(prepared.revisionId, prepared.reviewerId);
    await page.getByRole('button', { name: /actualiser les bilans/i }).click();
    await expect(page.getByText(/bilan publié/i)).toBeVisible();
    await page.getByRole('button', { name: /lire le bilan/i }).click();
    const reportFrame = page.frameLocator('iframe');
    await expect(reportFrame.getByText(parentMarker)).toBeVisible();

    const publishedResponse = await page.request.get(
      `/api/parent/children/${child!.id}/bilans/${attemptId}/report?format=html`,
    );
    expect(publishedResponse.status()).toBe(200);
    expectPrivateNoStore(publishedResponse.headers());
    const publishedHtml = await publishedResponse.text();
    expect(publishedHtml).toContain(parentMarker);
    for (const marker of forbiddenMarkers) expect(publishedHtml).not.toContain(marker);
    const pdfResponse = await page.request.get(
      `/api/parent/children/${child!.id}/bilans/${attemptId}/report?format=pdf`,
    );
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
    expectPrivateNoStore(pdfResponse.headers());
    expect((await pdfResponse.body()).subarray(0, 4).toString('ascii')).toBe('%PDF');

    if (child!.user.email === null) throw new Error('E2E_STUDENT_EMAIL_REQUIRED');
    const legacyBilan = await createLegacyPublishedBilan(child!.id, child!.user.email, nonce);
    const legacyPdf = await page.request.get(`/api/parent/bilans/${legacyBilan.id}/pdf`);
    expect(legacyPdf.status()).toBe(200);
    expect(legacyPdf.headers()['content-type']).toContain('application/pdf');
    expectPrivateNoStore(legacyPdf.headers());
    expect((await legacyPdf.body()).subarray(0, 4).toString('ascii')).toBe('%PDF');

    const parentBEmail = `p0c-parent-b-${nonce}@example.test`;
    const parentBPassword = 'ParentBSynthetic!2026';
    await prisma.user.create({
      data: {
        email: parentBEmail,
        password: await bcrypt.hash(parentBPassword, 12),
        role: 'PARENT',
        firstName: 'Parent',
        lastName: 'B Synthétique',
        activatedAt: new Date(),
        parentProfile: { create: {} },
      },
    });
    const parentBContext = await browser.newContext({ baseURL: page.url().startsWith('http') ? new URL(page.url()).origin : undefined });
    const parentBPage = await parentBContext.newPage();
    await signIn(parentBPage, parentBEmail, parentBPassword);
    await expect(parentBPage.getByText('Parent B Synthétique').first()).toBeVisible();
    const parentBList = await parentBPage.request.get(`/api/parent/children/${child!.id}/bilans`);
    const parentBReport = await parentBPage.request.get(
      `/api/parent/children/${child!.id}/bilans/${attemptId}/report?format=html`,
    );
    const parentBLegacyPdf = await parentBPage.request.get(`/api/parent/bilans/${legacyBilan.id}/pdf`);
    expect(parentBList.status()).toBe(404);
    expect(parentBReport.status()).toBe(404);
    expect(parentBLegacyPdf.status()).toBe(404);
    expectPrivateNoStore(parentBList.headers());
    expectPrivateNoStore(parentBReport.headers());
    expectPrivateNoStore(parentBLegacyPdf.headers());
    await parentBPage.goto(`/dashboard/parent/enfant/${child!.id}`);
    await expect(parentBPage).toHaveURL(/\/dashboard\/parent\/?$/);
    await expect(parentBPage.getByText('Élève A1 A Synthétique')).toHaveCount(0);
    await parentBContext.close();

    await prisma.parentStudentLink.updateMany({
      where: { parentUserId: parent.id, studentId: child!.id },
      data: { state: 'REVOKED', revokedAt: new Date(), revokedReason: 'P0C_E2E_REVOCATION' },
    });
    await page.reload();
    await expect(page.getByRole('alert')).toBeVisible();
    const revokedList = await page.request.get(`/api/parent/children/${child!.id}/bilans`);
    const revokedLegacyPdf = await page.request.get(`/api/parent/bilans/${legacyBilan.id}/pdf`);
    expect(revokedList.status()).toBe(404);
    expect(revokedLegacyPdf.status()).toBe(404);
    expectPrivateNoStore(revokedList.headers());
    expectPrivateNoStore(revokedLegacyPdf.headers());

    await page.getByRole('button', { name: 'Se déconnecter de votre compte' }).click();
    await page.waitForURL((url) => ['/auth/signin', '/'].includes(url.pathname));
    const loggedOut = await page.request.get(`/api/parent/children/${child!.id}/bilans`);
    expect(loggedOut.status()).toBe(404);
    expectPrivateNoStore(loggedOut.headers());
  });
});
