/**
 * Orientation d'un élève de l'espace perdu sur le mauvais formulaire — trajet réel, vrai navigateur.
 *
 * Reproduit les cas terrain (sarra.b 05/10, fares.laajili 10/10) : l'élève suit « Se connecter »
 * depuis le site public, tombe sur le formulaire e-mail `/auth/signin`, échoue — et doit maintenant
 * être ramené en un clic vers `/espace/connexion`, où ses identifiants fonctionnent.
 */
import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

import { applyProvisioning, parseRoster, syncActivities } from '../../lib/espace/provisioning';
import { assertDisposableE2eDatabase } from '../helpers/disposable-database';

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL?.includes('nexus_e2e') ? process.env.DATABASE_URL : undefined);

const run = Math.random().toString(36).slice(2, 8);
const USERNAME = `oriente.${run}`.slice(0, 32);

let prisma: PrismaClient;
let secret = '';
let studentId = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  if (!DATABASE_URL) throw new Error('E2E_DATABASE_URL (pile jetable nexus_e2e) est requis');
  assertDisposableE2eDatabase(DATABASE_URL);
  prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  await syncActivities(prisma);
  const roster = parseRoster({
    groups: [{ slug: `or-${run}`, name: `Orientation ${run}` }],
    students: [{ username: USERNAME, firstName: 'Oriente', lastName: `Eleve${run}`, enrollments: [{ group: `or-${run}`, subjects: ['MATHS'] }] }],
  });
  const { credentials } = await applyProvisioning(prisma, roster, { adopt: false });
  secret = credentials[0]!.secret;
  studentId = (await prisma.user.findUniqueOrThrow({ where: { username: USERNAME } })).id;
});

test.afterAll(async () => {
  await prisma.espaceEnrollment.deleteMany({ where: { userId: studentId } });
  await prisma.espaceGroup.deleteMany({ where: { slug: `or-${run}` } });
  await prisma.user.deleteMany({ where: { id: studentId } });
  await prisma.$disconnect();
});

test('depuis le site public, le menu Connexion propose « Espace élève » (desktop et mobile)', async ({ page }) => {
  await page.goto('/offres');
  await page.getByRole('button', { name: /^Connexion$/ }).click();
  const item = page.getByRole('menuitem', { name: /Espace élève/ });
  await expect(item).toBeVisible();
  await expect(item).toHaveAttribute('href', '/espace/connexion');

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/offres');
  await page.getByRole('button', { name: /ouvrir le menu/i }).click();
  const mobile = page.getByRole('link', { name: /Espace élève/ });
  await expect(mobile).toBeVisible();
  await mobile.click();
  await page.waitForURL(/\/espace\/connexion/);
  await expect(page.getByTestId('input-username')).toBeVisible();
});

test('un élève qui échoue sur le formulaire e-mail est ramené vers l’espace, où il se connecte', async ({ page }) => {
  await page.goto('/auth/signin');
  // Le panneau d'aide oriente déjà avant tout échec.
  await expect(page.getByRole('link', { name: /connectez-vous sur l'espace élève/i })).toBeVisible();

  // L'élève tape son identifiant d'espace dans le champ e-mail/téléphone : échec, rappel ciblé.
  await page.getByTestId('input-email').fill(USERNAME);
  await page.getByTestId('input-password').fill('pas-le-bon-secret');
  await page.getByTestId('btn-signin').click();
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  const rescue = alert.getByRole('link', { name: /espace élève/i });
  await expect(rescue).toBeVisible();

  // Un clic, et ses identifiants fonctionnent.
  await rescue.click();
  await page.waitForURL(/\/espace\/connexion/);
  await page.getByTestId('input-username').fill(USERNAME);
  await page.getByTestId('input-secret').fill(secret);
  await page.getByTestId('btn-connexion').click();
  await page.waitForURL(/\/espace\/eleve/);
  await expect(page.getByRole('link', { name: 'Mes matières' })).toBeVisible();
});

test('un parent qui échoue avec un e-mail ne reçoit PAS le rappel élève', async ({ page }) => {
  await page.goto('/auth/signin');
  await page.getByTestId('input-email').fill(`parent.${run}@example.invalid`);
  await page.getByTestId('input-password').fill('pas-le-bon-secret');
  await page.getByTestId('btn-signin').click();
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('link', { name: /espace élève/i })).toHaveCount(0);
});

test('l’inverse : /espace/connexion renvoie parents et administration vers /auth/signin', async ({ page }) => {
  await page.goto('/espace/connexion');
  const back = page.getByRole('link', { name: /Connexion par e-mail ou téléphone/ });
  await expect(back).toBeVisible();
  await back.click();
  await page.waitForURL(/\/auth\/signin/);
  await expect(page.getByTestId('input-email')).toBeVisible();
});
