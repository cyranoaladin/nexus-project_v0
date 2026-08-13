import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { drainGenerateReportJobs, drainScoreAttemptJobs } from '../../lib/bilans/worker/drain-outbox';
import { processGenerateReportJob } from '../../lib/bilans/worker/generate-report-job';
import { resolveEnabledPack } from '../../lib/bilans/api/pack-access';
import { MockBilanLlmTransport } from '../../lib/bilans/llm/mock-transport';
import { publishReportRevision } from '../../lib/bilans/core/report-service';
import { validateAndPublishPendingReport } from '../../lib/bilans/staff/review-service';
import { createBilanPdfRendererSession, BILAN_PDF_ENGINE_VERSION } from '../../lib/bilans/render/pdf';
import seconde from '../../data/bilans/banks/entree-seconde-maths-v1.json';
import { assertDisposableE2eDatabase } from '../helpers/disposable-database';
import { waitForAuthenticatedSession } from '../helpers/auth';

const databaseUrl = process.env.DATABASE_URL ?? '';
function assertIsolatedDatabase(): void {
  assertDisposableE2eDatabase(databaseUrl);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const packSlug = 'entree-seconde-maths-v1';
const prefix = 'golden-path-';

async function cleanupFamily(parentEmail: string): Promise<void> {
  const parent = await prisma.user.findUnique({
    where: { email: parentEmail },
    include: { parentProfile: { include: { children: true } } },
  });
  if (!parent) return;
  const studentIds = parent.parentProfile?.children.map(({ id }) => id) ?? [];
  const childUserIds = parent.parentProfile?.children.map(({ userId }) => userId) ?? [];
  await prisma.reportReview.deleteMany({ where: { reportRevision: { reportArtifact: { studentId: { in: studentIds } } } } });
  await prisma.reportMaterialization.deleteMany({ where: { revision: { reportArtifact: { studentId: { in: studentIds } } } } });
  await prisma.evidenceItem.deleteMany({ where: { scoreSnapshot: { assessmentAttempt: { studentId: { in: studentIds } } } } });
  await prisma.reportRevision.deleteMany({ where: { reportArtifact: { studentId: { in: studentIds } } } });
  await prisma.reportArtifact.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.scoreSnapshot.deleteMany({ where: { assessmentAttempt: { studentId: { in: studentIds } } } });
  await prisma.canonicalApiIdempotencyKey.deleteMany({ where: { userId: { in: childUserIds } } });
  await prisma.canonicalAssessmentAttempt.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.parentStudentLink.deleteMany({ where: { OR: [{ parentUserId: parent.id }, { studentId: { in: studentIds } }] } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.parentProfile.deleteMany({ where: { userId: parent.id } });
  await prisma.user.deleteMany({ where: { id: { in: [...childUserIds, parent.id] } } });
}

test.describe('Golden-path — bilan de bout en bout (rapport LLM stubbé)', () => {
  test.beforeAll(() => {
    assertIsolatedDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('passation réelle 18 réponses -> scoring -> rapport LLM (stub) -> publication -> accès parent + élève', async ({ page }) => {
    test.setTimeout(120_000);
    const nonce = Date.now();
    const parentEmail = `${prefix}${nonce}@example.test`;
    const parentPassword = 'ParentSynthetic!2026';
    const childPassword = 'ChildSynthetic!2026';

    await cleanupFamily(parentEmail);

    // 1. Inscription -> activation parent -> activation élève, via l'UI réelle.
    await page.goto('/bilan-gratuit');
    await page.locator('#parentFirstName').fill('Parent');
    await page.locator('#parentLastName').fill('Synthétique');
    await page.locator('#parentEmail').fill(parentEmail);
    await page.locator('#parentPhone').fill('+21699000004');
    await page.locator('#studentFirstName').fill('Élève');
    await page.locator('#studentGrade').selectOption('seconde');
    await page.locator('#studentSchool').fill('Établissement synthétique');
    await page.locator('label').filter({ hasText: 'Mathématiques' }).getByRole('checkbox').click();
    await page.locator('#objectives').fill('Prouver le golden-path bilan de bout en bout.');
    await page.locator('label').filter({ hasText: /J.accepte d.être contacté/ }).getByRole('checkbox').click();
    await page.getByRole('button', { name: /lancer le bilan diagnostic/i }).click();
    await expect(page).toHaveURL(/\/bilan-gratuit\/confirmation/);

    const parent = await prisma.user.findUniqueOrThrow({
      where: { email: parentEmail },
      include: { parentProfile: { include: { children: true } } },
    });
    const child = parent.parentProfile!.children[0];
    await prisma.user.update({
      where: { id: parent.id },
      data: { password: await bcrypt.hash(parentPassword, 12), activatedAt: new Date(), activationToken: null, activationExpiry: null },
    });

    await page.goto('/auth/signin');
    await page.getByTestId('input-email').fill(parentEmail);
    await page.getByTestId('input-password').fill(parentPassword);
    await page.getByRole('button', { name: /accéder à mon espace/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/parent/);
    await page.goto(`/dashboard/parent/enfant/${child.id}`);
    await page.getByRole('checkbox', { name: /consentement explicite/i }).check();
    await page.getByRole('button', { name: /confirmer le rattachement/i }).click();
    await expect(page.getByText(/rattachement vérifié/i)).toBeVisible();

    await page.goto('/dashboard/parent');
    await page.getByRole('button', { name: /activer le compte élève/i }).click();
    const loginIdentifier = (await page.getByText(/^[a-z0-9.]+@nexus-student\.local$/).textContent())!;
    const activationUrl = await page.getByRole('link', { name: /ouvrir l.activation/i }).getAttribute('href');
    await page.getByRole('button', { name: /déconnexion/i }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await page.goto(activationUrl!);
    await page.getByLabel(/^mot de passe$/i).fill(childPassword);
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(childPassword);
    await page.getByRole('button', { name: /activer mon compte/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin\?activated=true/);

    await page.getByRole('textbox', { name: 'Adresse Email' }).fill(loginIdentifier);
    await page.getByLabel(/^mot de passe$/i).fill(childPassword);
    await page.getByRole('button', { name: /accéder à mon espace/i }).click();
    await waitForAuthenticatedSession(page, loginIdentifier);
    await page.goto('/dashboard/eleve', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard\/eleve/);

    // 2. Passation réelle : création de la tentative, 18 réponses réelles (toutes correctes,
    //    confiance maximale) -- réutilise le cas doré "all-correct-confident" (score = 100).
    const created = await page.request.post('/api/bilans/attempts', {
      headers: { 'idempotency-key': `golden-path-create-${nonce}` },
      data: { packSlug },
    });
    expect(created.status()).toBe(201);
    const { attemptId } = await created.json();

    const answers = seconde.questionnaire.items.map((item) => ({
      itemId: item.id,
      optionId: item.options.find((option: { isCorrect: boolean }) => option.isCorrect)!.id,
      confidence: 4 as const,
    }));
    const patched = await page.request.patch(`/api/bilans/attempts/${attemptId}/answers`, {
      headers: { 'idempotency-key': `golden-path-answers-${nonce}` },
      data: { revision: 0, answers },
    });
    expect(patched.status()).toBe(200);
    const { revision } = await patched.json();
    expect(revision).toBe(1);

    // 3. Idempotence : rejouer la création avec la même clé ne duplique pas la tentative.
    const replay = await page.request.post('/api/bilans/attempts', {
      headers: { 'idempotency-key': `golden-path-create-${nonce}` },
      data: { packSlug },
    });
    expect(replay.status()).toBe(201);
    expect((await replay.json()).attemptId).toBe(attemptId);
    expect(await prisma.canonicalAssessmentAttempt.count({ where: { studentId: child.id } })).toBe(1);

    const submitted = await page.request.post(`/api/bilans/attempts/${attemptId}/submit`, {
      headers: { 'idempotency-key': `golden-path-submit-${nonce}` },
      data: { revision: 1 },
    });
    expect(submitted.status()).toBe(200);
    expect((await submitted.json()).status).toBe('SUBMITTED');

    // 4. Le pipeline automatique tourne hors requête HTTP, en deux jobs :
    //    scoring (SCORE_ATTEMPT) puis génération du rapport par un LLM
    //    (GENERATE_REPORT). En production les deux sont drainés par le
    //    scheduler en process (lib/bilans/worker/scheduler.ts, gated par
    //    BILAN_WORKER_ENABLED) ; ici on invoque directement les mêmes
    //    fonctions de drain pour un test déterministe sans polling, avec un
    //    transport LLM stubbé (MockBilanLlmTransport) -- aucun appel réseau
    //    réel dans ce scénario.
    const drainResult = await drainScoreAttemptJobs({}, {});
    expect(drainResult.completed).toBeGreaterThanOrEqual(1);

    const snapshot = await prisma.scoreSnapshot.findUniqueOrThrow({ where: { assessmentAttemptId: attemptId } });
    expect(snapshot.score).toBe(100);

    const generateResult = await drainGenerateReportJobs({}, {
      processJob: (jobId) => processGenerateReportJob(jobId, {
        prisma,
        resolvePack: resolveEnabledPack,
        buildTransport: () => new MockBilanLlmTransport(),
        now: () => new Date(),
        logger: { info: () => {}, error: () => {} },
      }),
    });
    expect(generateResult.completed).toBeGreaterThanOrEqual(1);

    const artifact = await prisma.reportArtifact.findUniqueOrThrow({ where: { assessmentAttemptId: attemptId } });
    expect(artifact.status).toBe('PENDING_REVIEW');
    const revisionRow = await prisma.reportRevision.findFirstOrThrow({ where: { scoreSnapshotId: snapshot.id } });
    // Les nombres viennent toujours du FactSheet, jamais du bundle LLM
    // (buildLlmReports ne fait que narrer -- voir sa documentation).
    const narratedContent = revisionRow.content as { NEXUS: { content: { internalFacts: { globalScore: number } } } };
    expect(narratedContent.NEXUS.content.internalFacts.globalScore).toBe(100);

    // 5. Un pack non activé (flag absent) reste inaccessible même après ce parcours.
    const otherPackAttempt = await page.request.post('/api/bilans/attempts', {
      headers: { 'idempotency-key': `golden-path-other-pack-${nonce}` },
      data: { packSlug: 'entree-terminale-philosophie-v1' },
    });
    expect(otherPackAttempt.status()).toBe(404);

    // 6. Revue humaine puis publication -- seule étape non automatisée du
    //    pipeline. Acteur : une assistante synthétique, jamais un vrai élève,
    //    passant par le même service (review-service.ts) que le dashboard
    //    /dashboard/assistante/bilans -- le coach n'est plus dans ce circuit.
    const assistante = await prisma.user.create({
      data: {
        email: `golden-path-assistante-${nonce}@example.test`,
        role: 'ASSISTANTE',
        firstName: 'Assistante',
        lastName: 'Synthétique',
        activatedAt: new Date(),
      },
    });

    const pdfSession = await createBilanPdfRendererSession();
    try {
      await validateAndPublishPendingReport({
        userId: assistante.id,
        role: 'ASSISTANTE',
        revisionId: revisionRow.id,
        motif: 'Relecture golden-path automatisée.',
      }, {
        publish: (input) => publishReportRevision({
          prisma,
          ...input,
          renderAudience: async (_factSheet, audience) => {
            const html = `<!doctype html><html lang="fr"><body><main><h1>Bilan</h1><p>${audience}</p></main></body></html>`;
            return { status: 'AVAILABLE' as const, html, pdf: await pdfSession.renderHtmlToPdf(html), engineVersion: BILAN_PDF_ENGINE_VERSION };
          },
        }),
      });
    } finally {
      await pdfSession.close();
    }

    // 7. Accès élève au rapport publié.
    const studentReport = await page.request.get(`/api/bilans/attempts/${attemptId}/report`);
    expect(studentReport.status()).toBe(200);

    // 8. Accès parent au rapport publié, via son propre compte.
    await page.getByRole('button', { name: 'Se déconnecter de votre compte' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await page.goto('/auth/signin');
    await page.getByTestId('input-email').fill(parentEmail);
    await page.getByTestId('input-password').fill(parentPassword);
    await page.getByRole('button', { name: /accéder à mon espace/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/parent/);
    const parentReport = await page.request.get(`/api/parent/children/${child.id}/bilans/${attemptId}/report?format=html`);
    expect(parentReport.status()).toBe(200);
  });
});
