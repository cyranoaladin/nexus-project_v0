import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { validateAndPublishPendingReport } from '../../lib/bilans/staff/review-service';
import { publishReportRevision } from '../../lib/bilans/core/report-service';
import { createBilanPdfRendererSession, BILAN_PDF_ENGINE_VERSION } from '../../lib/bilans/render/pdf';
import seconde from '../../data/bilans/banks/entree-seconde-maths-v1.json';

/**
 * GATE A — proves the PRODUCTION posture: BILAN_WORKER_ENABLED=true,
 * OPENROUTER_API_KEY absent. Unlike bilan-golden-path.spec.ts (which drains
 * both jobs manually, by design, for a deterministic test), this spec never
 * calls drainScoreAttemptJobs/drainGenerateReportJobs itself -- it only
 * polls, so a green run here proves the SERVER's own background scheduler
 * (lib/bilans/worker/scheduler.ts, started from instrumentation.ts) carries
 * a submitted attempt all the way to REPORT_PENDING_REVIEW with nobody
 * hitting drain from outside. The server process this spec targets MUST be
 * started with BILAN_WORKER_ENABLED=true and no OPENROUTER_API_KEY.
 */

const databaseUrl = process.env.DATABASE_URL ?? '';
function assertIsolatedDatabase(): void {
  // postgres-e2e is the docker-compose-internal hostname (see
  // docker-compose.e2e.yml, lib/e2e/seed-guard.ts's own ALLOWED_HOSTS) --
  // as legitimate a target as localhost when this spec runs inside that stack.
  expect(databaseUrl).toMatch(/(?:localhost|127\.0\.0\.1|postgres-e2e)/);
  expect(databaseUrl).toMatch(/nexus_(?:test|e2e|bilan_runtime_test)/);
  expect(databaseUrl).not.toMatch(/nexus_prod|production/i);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const packSlug = 'entree-seconde-maths-v1';
const prefix = 'gate-a-worker-';

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
  await prisma.jobOutbox.deleteMany({ where: { aggregateId: { in: await prisma.canonicalAssessmentAttempt.findMany({ where: { studentId: { in: studentIds } }, select: { id: true } }).then((rows) => rows.map((r) => r.id)) } } });
  await prisma.canonicalApiIdempotencyKey.deleteMany({ where: { userId: { in: childUserIds } } });
  await prisma.canonicalAssessmentAttempt.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.parentStudentLink.deleteMany({ where: { OR: [{ parentUserId: parent.id }, { studentId: { in: studentIds } }] } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.parentProfile.deleteMany({ where: { userId: parent.id } });
  await prisma.user.deleteMany({ where: { id: { in: [...childUserIds, parent.id] } } });
}

async function pollUntil<T>(fn: () => Promise<T | null>, timeoutMs: number, intervalMs: number): Promise<T> {
  const startedAt = Date.now();
  for (;;) {
    const value = await fn();
    if (value !== null) return value;
    if (Date.now() - startedAt > timeoutMs) throw new Error('POLL_TIMEOUT');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

test.describe('GATE A — posture prod (worker ON, sans clé OpenRouter)', () => {
  test.beforeAll(() => {
    assertIsolatedDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('le scheduler autonome du serveur produit seul un bilan plancher, sans drain manuel, zéro zombie', async ({ page }) => {
    test.setTimeout(120_000);
    const nonce = Date.now();
    const parentEmail = `${prefix}${nonce}@example.test`;
    const parentPassword = 'ParentSynthetic!2026';
    const childPassword = 'ChildSynthetic!2026';

    await cleanupFamily(parentEmail);

    await page.goto('/bilan-gratuit');
    await page.locator('#parentFirstName').fill('Parent');
    await page.locator('#parentLastName').fill('Synthétique');
    await page.locator('#parentEmail').fill(parentEmail);
    await page.locator('#parentPhone').fill('+21699000005');
    await page.locator('#studentFirstName').fill('Élève');
    await page.locator('#studentGrade').selectOption('seconde');
    await page.locator('#studentSchool').fill('Établissement synthétique');
    await page.locator('label').filter({ hasText: 'Mathématiques' }).getByRole('checkbox').click();
    await page.locator('#objectives').fill('Prouver la posture worker-ON sans clé OpenRouter.');
    await page.locator('label').filter({ hasText: /J.accepte d.être contacté/ }).getByRole('checkbox').click();
    await page.getByRole('button', { name: /demander mon bilan stratégique gratuit/i }).click();
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
    await expect(page).toHaveURL(/\/dashboard\/eleve/);

    // Passation réelle, 18 réponses toutes correctes (cas doré, score = 100).
    const created = await page.request.post('/api/bilans/attempts', {
      headers: { 'idempotency-key': `gate-a-create-${nonce}` },
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
      headers: { 'idempotency-key': `gate-a-answers-${nonce}` },
      data: { revision: 0, answers },
    });
    expect(patched.status()).toBe(200);

    const submitted = await page.request.post(`/api/bilans/attempts/${attemptId}/submit`, {
      headers: { 'idempotency-key': `gate-a-submit-${nonce}` },
      data: { revision: 1 },
    });
    expect(submitted.status()).toBe(200);
    expect((await submitted.json()).status).toBe('SUBMITTED');

    // Aucun drain manuel ici : on attend seulement que le scheduler du
    // serveur (BILAN_WORKER_ENABLED=true, sans OPENROUTER_API_KEY) fasse le
    // travail seul -- scoring puis génération -- et amène l'attempt à
    // REPORT_PENDING_REVIEW de lui-même.
    const revisionRow = await pollUntil(async () => {
      const attempt = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
      if (attempt.status !== 'REPORT_PENDING_REVIEW') return null;
      return prisma.reportRevision.findFirstOrThrow({ where: { reportArtifact: { assessmentAttemptId: attemptId } } });
    }, 30_000, 500);

    const snapshot = await prisma.scoreSnapshot.findUniqueOrThrow({ where: { assessmentAttemptId: attemptId } });
    expect(snapshot.score).toBe(100);

    // Fallback déterministe : aucun appel réseau, jamais de narration LLM
    // sans clé -- les nombres viennent du FactSheet, jamais d'un bundle.
    const content = revisionRow.content as { NEXUS: { content: { internalFacts: { globalScore: number } } } };
    expect(content.NEXUS.content.internalFacts.globalScore).toBe(100);

    // Zéro zombie : le job GENERATE_REPORT du scheduler autonome a bien
    // terminé, aucun job de ce pipeline ne reste PENDING/LEASED/FAILED.
    const straySoreJobs = await prisma.jobOutbox.count({
      where: { aggregateId: attemptId, status: { in: ['PENDING', 'LEASED', 'FAILED'] } },
    });
    expect(straySoreJobs).toBe(0);

    const assistante = await prisma.user.create({
      data: {
        email: `gate-a-assistante-${nonce}@example.test`,
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
        motif: 'Relecture GATE A — posture worker-ON sans clé.',
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

    const studentReport = await page.request.get(`/api/bilans/attempts/${attemptId}/report`);
    expect(studentReport.status()).toBe(200);

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
