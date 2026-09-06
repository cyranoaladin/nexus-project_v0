import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { assertDisposableE2eDatabase } from '../helpers/disposable-database';
import { waitForAuthenticatedSession } from '../helpers/auth';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const prefix = 'p0b-browser-level-';
const packSlug = 'entree-seconde-maths-v1';

function assertIsolatedDatabase(): void {
  assertDisposableE2eDatabase(databaseUrl);
}

async function cleanupFamily(parentEmail: string): Promise<void> {
  const parent = await prisma.user.findUnique({
    where: { email: parentEmail },
    include: { parentProfile: { include: { children: true } } },
  });
  if (!parent) return;

  const studentIds = parent.parentProfile?.children.map(({ id }) => id) ?? [];
  const childUserIds = parent.parentProfile?.children.map(({ userId }) => userId) ?? [];
  await prisma.canonicalApiIdempotencyKey.deleteMany({
    where: { userId: { in: childUserIds } },
  });
  await prisma.canonicalAssessmentAttempt.deleteMany({
    where: { studentId: { in: studentIds } },
  });
  await prisma.parentStudentLink.deleteMany({
    where: { OR: [{ parentUserId: parent.id }, { studentId: { in: studentIds } }] },
  });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.parentProfile.deleteMany({ where: { userId: parent.id } });
  await prisma.user.deleteMany({ where: { id: { in: [...childUserIds, parent.id] } } });
}

test.describe('P0-B Student level to pack guard', () => {
  test.beforeAll(() => {
    assertIsolatedDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('an activated Seconde Student creates the signed Seconde attempt and no cross-level parasite', async ({ page }) => {
    const nonce = Date.now();
    const parentEmail = `${prefix}${nonce}@example.test`;
    const parentPassword = 'ParentSynthetic!2026';
    const childPassword = 'ChildSynthetic!2026';

    await cleanupFamily(parentEmail);
    try {
      await page.goto('/bilan-gratuit');
      await page.locator('#parentFirstName').fill('Parent');
      await page.locator('#parentLastName').fill('Synthétique');
      await page.locator('#parentEmail').fill(parentEmail);
      await page.locator('#parentPhone').fill('+21699000003');
      await page.locator('#studentFirstName').fill('Élève');
      await page.locator('#studentGrade').selectOption('seconde');
      await page.locator('label').filter({ hasText: /J.accepte d.être contacté/ }).getByRole('checkbox').click();
      await page.getByRole('button', { name: /créer mon espace/i }).click();
      await expect(page).toHaveURL(/\/bilan-gratuit\/confirmation/);

      const parent = await prisma.user.findUniqueOrThrow({
        where: { email: parentEmail },
        include: { parentProfile: { include: { children: true } } },
      });
      const child = parent.parentProfile!.children[0];
      await prisma.user.update({
        where: { id: parent.id },
        data: {
          password: await bcrypt.hash(parentPassword, 12),
          activatedAt: new Date(),
          activationToken: null,
          activationExpiry: null,
        },
      });

      await page.goto('/auth/signin');
      await page.getByTestId('input-email').fill(parentEmail);
      await page.getByTestId('input-password').fill(parentPassword);
      await page.getByRole('button', { name: /accéder à mon espace/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/parent/);
      await page.getByRole('button', { name: /activer le compte élève/i }).click();
      const loginIdentifier = (await page.getByText(/^[a-z0-9.]+@nexus-student\.local$/).textContent())!;
      const activationUrl = await page.getByRole('link', { name: /ouvrir l.activation/i }).getAttribute('href');
      expect(activationUrl).toContain('/auth/activate?token=');

      await page.getByRole('button', { name: /déconnexion/i }).click();
      await page.waitForURL((url) => url.pathname === '/');
      await page.goto(activationUrl!);
      await page.getByLabel(/^mot de passe$/i).fill(childPassword);
      await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(childPassword);
      await page.getByRole('button', { name: /activer mon compte/i }).click();
      await expect(page).toHaveURL(/\/auth\/signin\?activated=true/);

      await page.getByRole('textbox', { name: 'Téléphone WhatsApp ou email', exact: true }).fill(loginIdentifier);
      await page.getByLabel(/^mot de passe$/i).fill(childPassword);
      await page.getByRole('button', { name: /accéder à mon espace/i }).click();
      await waitForAuthenticatedSession(page, loginIdentifier);
      await page.goto('/dashboard/eleve', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/dashboard\/eleve/);
      expect((await page.request.get('/api/student/dashboard')).status()).toBe(200);

      const accepted = await page.request.post('/api/bilans/attempts', {
        headers: { 'idempotency-key': `p0b-browser-accepted-${nonce}` },
        data: { packSlug },
      });
      expect(accepted.status()).toBe(201);
      const acceptedBody = await accepted.json();
      expect(acceptedBody.attemptId).toEqual(expect.any(String));
      expect(await prisma.canonicalAssessmentAttempt.count({
        where: { studentId: child.id },
      })).toBe(1);

      // Isolated harness only: simulate a cross-level request without changing a pack or flag.
      await prisma.student.update({ where: { id: child.id }, data: { gradeLevel: 'PREMIERE' } });
      const rejectedKey = `p0b-browser-rejected-${nonce}`;
      const rejected = await page.request.post('/api/bilans/attempts', {
        headers: { 'idempotency-key': rejectedKey },
        data: { packSlug },
      });
      expect(rejected.status()).toBe(409);
      expect(await rejected.json()).toEqual({
        error: { code: 'STUDENT_PACK_LEVEL_MISMATCH' },
      });
      expect(await prisma.canonicalAssessmentAttempt.count({
        where: { studentId: child.id },
      })).toBe(1);
      expect(await prisma.canonicalApiIdempotencyKey.count({
        where: { userId: child.userId, key: rejectedKey },
      })).toBe(0);
      expect((await page.request.get('/api/student/dashboard')).status()).toBe(200);
    } finally {
      await cleanupFamily(parentEmail);
    }
  });
});
