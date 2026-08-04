import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const prefix = 'p0-browser-initial-';

function assertIsolatedDatabase(): void {
  expect(databaseUrl).toMatch(/(?:localhost|127\.0\.0\.1)/);
  expect(databaseUrl).toMatch(/nexus_(?:p0_identity_test|test|e2e|bilan_runtime_test)/);
  expect(databaseUrl).not.toMatch(/nexus_prod|production/i);
}

async function cleanupFamily(parentEmail: string): Promise<void> {
  const parent = await prisma.user.findUnique({
    where: { email: parentEmail },
    include: {
      parentProfile: { include: { children: true } },
    },
  });
  if (!parent) return;

  const studentIds = parent.parentProfile?.children.map((child) => child.id) ?? [];
  const childUserIds = parent.parentProfile?.children.map((child) => child.userId) ?? [];
  await prisma.parentStudentLink.deleteMany({
    where: {
      OR: [
        { parentUserId: parent.id },
        { studentId: { in: studentIds } },
      ],
    },
  });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.parentProfile.deleteMany({ where: { userId: parent.id } });
  await prisma.user.deleteMany({ where: { id: { in: [...childUserIds, parent.id] } } });
}

test.describe('P0 initial student identity', () => {
  test.beforeAll(() => {
    assertIsolatedDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('parent mediates activation, then the initial child authenticates once', async ({ page }) => {
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
      await page.locator('#parentPhone').fill('+21699000002');
      await page.locator('#studentFirstName').fill('Élève');
      await page.locator('#studentGrade').selectOption('seconde');
      await page.locator('#studentSchool').fill('Établissement synthétique');
      await page.locator('label').filter({ hasText: 'Mathématiques' }).getByRole('checkbox').click();
      await page.locator('#objectives').fill('Vérifier le parcours utilisateur réel sans donnée personnelle.');
      await page.locator('label').filter({ hasText: /J.accepte d.être contacté/ }).getByRole('checkbox').click();
      await page.getByRole('button', { name: /demander mon bilan stratégique gratuit/i }).click();
      await expect(page).toHaveURL(/\/bilan-gratuit\/confirmation/);

      const parent = await prisma.user.findUniqueOrThrow({
        where: { email: parentEmail },
        include: {
          parentProfile: {
            include: { children: { include: { user: true } } },
          },
        },
      });
      const child = parent.parentProfile?.children[0];
      expect(child?.user.role).toBe('ELEVE');
      expect(child?.user.password).toBeNull();
      expect(child?.user.activatedAt).toBeNull();
      expect(child?.user.activationToken).toBeNull();

      const historicalIdentifier = `élève.${nonce}@nexus-student.local`;
      await prisma.user.update({
        where: { id: child!.userId },
        data: { email: historicalIdentifier },
      });
      const initialUserCount = await prisma.user.count();
      const initialStudentCount = await prisma.student.count();

      // Strict bootstrap: the E2E environment has no email inbox. Only the Parent
      // account is activated directly; the child must use the real UI flow below.
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
      const displayedIdentifier = page.getByText(/^[a-z0-9.]+@nexus-student\.local$/);
      await expect(displayedIdentifier).toBeVisible();
      const loginIdentifier = (await displayedIdentifier.textContent())!;
      expect(loginIdentifier).not.toBe(historicalIdentifier);
      expect(loginIdentifier).toMatch(/^[a-z0-9]+(?:\.[a-z0-9]+)*@nexus-student\.local$/);
      const activationLink = page.getByRole('link', { name: /ouvrir l.activation/i });
      const activationUrl = await activationLink.getAttribute('href');
      expect(activationUrl).toContain('/auth/activate?token=');
      const rawToken = new URL(activationUrl!).searchParams.get('token');
      expect(rawToken).toMatch(/^sact_/);

      const pending = await prisma.user.findUniqueOrThrow({ where: { id: child!.userId } });
      expect(pending.id).toBe(child!.userId);
      expect(pending.email).toBe(loginIdentifier);
      expect(await prisma.user.count()).toBe(initialUserCount);
      expect(await prisma.student.count()).toBe(initialStudentCount);
      expect(pending.activationToken).not.toBe(rawToken);
      expect(pending.activationExpiry!.getTime()).toBeGreaterThan(Date.now());

      await page.getByRole('button', { name: /déconnexion/i }).click();
      await page.waitForURL((url) => url.pathname === '/');
      await page.goto(activationUrl!);
      await expect(page.getByRole('heading', { name: /activer votre espace élève/i })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Identifiant de connexion' })).toHaveValue(loginIdentifier);
      await page.getByLabel(/^mot de passe$/i).fill(childPassword);
      await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(childPassword);
      await page.getByRole('button', { name: /activer mon compte/i }).click();
      await expect(page.getByRole('heading', { name: /compte activé/i })).toBeVisible();
      await expect(page).toHaveURL(/\/auth\/signin\?activated=true/, { timeout: 10_000 });

      await page.getByRole('textbox', { name: 'Adresse Email' }).fill(loginIdentifier);
      await page.getByLabel(/^mot de passe$/i).fill(childPassword);
      await page.getByRole('button', { name: /accéder à mon espace/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/eleve/);

      const protectedResponse = await page.request.get('/api/student/dashboard');
      expect(protectedResponse.status()).toBe(200);

      const activated = await prisma.user.findUniqueOrThrow({ where: { id: child!.userId } });
      expect(activated.activatedAt).not.toBeNull();
      expect(activated.activationToken).toBeNull();
      expect(activated.activationExpiry).toBeNull();
      expect(await bcrypt.compare(childPassword, activated.password!)).toBe(true);

      await page.getByRole('button', { name: 'Se déconnecter de votre compte' }).click();
      await page.waitForURL((url) => ['/auth/signin', '/'].includes(url.pathname));
      await page.goto(activationUrl!);
      await expect(page.getByRole('heading', { name: /lien invalide/i })).toBeVisible();
    } finally {
      await cleanupFamily(parentEmail);
    }
  });
});
