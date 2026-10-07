/**
 * Changement autonome du code/mot de passe, réinitialisation par l'enseignant, code temporaire obligatoire —
 * dans un vrai navigateur, contre la pile jetable. Comptes de validation uniquement (jamais un vrai compte).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

import { applyProvisioning, parseRoster, syncActivities } from '../../lib/espace/provisioning';
import { assertDisposableE2eDatabase } from '../helpers/disposable-database';

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL?.includes('nexus_e2e') ? process.env.DATABASE_URL : undefined);

const run = Math.random().toString(36).slice(2, 8);
const u = (n: string) => `k${n}.${run}`.slice(0, 32);
const NEW_CODE = 'Lune8Fox';
const SECOND_CODE = 'Pomme42Kiwi';
const NEW_PASSWORD = 'le cheval gris traverse la vallée';

type Who = 'ada' | 'bob' | 'cleo' | 'prof' | 'prof2';
let prisma: PrismaClient;
const secrets: Record<string, string> = {};
const ids = {} as Record<Who, string>;

async function login(page: Page, who: Who, secret: string) {
  await page.goto('/espace/connexion');
  await page.getByTestId('input-username').fill(u(who));
  await page.getByTestId('input-secret').fill(secret);
  await page.getByTestId('btn-connexion').click();
}

async function changeCredential(page: Page, current: string, next: string, confirm: string = next) {
  await page.getByTestId('input-current').fill(current);
  await page.getByTestId('input-next').fill(next);
  await page.getByTestId('input-confirm').fill(confirm);
  await page.getByTestId('btn-credential').click();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  if (!DATABASE_URL) throw new Error('E2E_DATABASE_URL (pile jetable nexus_e2e) est requis');
  assertDisposableE2eDatabase(DATABASE_URL);
  prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  await syncActivities(prisma);
  const group = `cred-${run}`;
  const roster = parseRoster({
    groups: [{ slug: group, name: `Credentials ${run}` }],
    teachers: [
      { username: u('prof'), firstName: 'Prof', lastName: `Un${run}`, teaches: [{ group, subjects: ['MATHS'] }] },
      { username: u('prof2'), firstName: 'Prof', lastName: `Deux${run}`, teaches: [{ group, subjects: ['MATHS'] }] },
    ],
    students: ['ada', 'bob', 'cleo'].map((n) => ({
      username: u(n), firstName: n.toUpperCase(), lastName: `Cred${run}`, enrollments: [{ group, subjects: ['MATHS'] }],
    })),
  });
  const { credentials } = await applyProvisioning(prisma, roster, { adopt: false });
  for (const c of credentials) secrets[c.username] = c.secret;
  for (const who of ['ada', 'bob', 'cleo', 'prof', 'prof2'] as Who[]) ids[who] = (await prisma.user.findUniqueOrThrow({ where: { username: u(who) } })).id;
});

test.afterAll(async () => {
  const all = Object.values(ids);
  await prisma.espaceSecurityEvent.deleteMany({ where: { OR: [{ userId: { in: all } }, { actorId: { in: all } }] } });
  await prisma.espaceEnrollment.deleteMany({ where: { userId: { in: all } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { teacherId: { in: all } } });
  await prisma.espaceGroup.deleteMany({ where: { slug: `cred-${run}` } });
  await prisma.user.deleteMany({ where: { id: { in: all } } });
  await prisma.$disconnect();
});

test.describe('élève', () => {
  test('Mon compte → Sécurité : messages d’erreur clairs, puis changement, ancien code refusé, nouveau accepté', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await login(page, 'ada', secrets[u('ada')]);
      await page.waitForURL(/\/espace\/eleve/);
      await page.getByRole('link', { name: 'Mon compte' }).click();
      await page.waitForURL(/\/espace\/eleve\/compte/);
      await expect(page.getByRole('heading', { name: /modifier mon code personnel/i })).toBeVisible();
      await expect(page.getByTestId('credential-mandatory')).toHaveCount(0); // code non temporaire ici

      await changeCredential(page, 'ZZZZZZZZ', NEW_CODE);
      await expect(page.getByTestId('credential-error')).toHaveText('Le code personnel actuel est incorrect.');
      await changeCredential(page, secrets[u('ada')], NEW_CODE, 'Autre8Fox');
      await expect(page.getByTestId('credential-error')).toHaveText('Les deux nouveaux codes ne correspondent pas.');
      await changeCredential(page, secrets[u('ada')], '123456');
      await expect(page.getByTestId('credential-error')).toHaveText('Choisissez un code personnel plus difficile à deviner.');
      // Rien n'a changé tant que l'enregistrement n'a pas réussi.
      expect((await prisma.espaceSecurityEvent.count({ where: { userId: ids.ada } }))).toBe(0);

      await changeCredential(page, secrets[u('ada')], NEW_CODE);
      await expect(page.getByTestId('credential-success')).toContainText('Votre code personnel a été modifié.');
      await page.waitForURL(/\/espace\/connexion\?modifie=1/, { timeout: 15_000 });
      await expect(page.getByTestId('connexion-modifie')).toBeVisible();
    } finally {
      await ctx.close();
    }

    // Ancien code refusé, nouveau accepté (vraie connexion).
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    try {
      await login(p2, 'ada', secrets[u('ada')]);
      await expect(p2.getByTestId('connexion-erreur')).toBeVisible();
      await login(p2, 'ada', NEW_CODE);
      await p2.waitForURL(/\/espace\/eleve/);
      await expect(p2.getByTestId('bonjour')).toContainText('Bonjour');
      expect(await prisma.espaceSecurityEvent.count({ where: { userId: ids.ada, type: 'PASSWORD_CHANGED' } })).toBe(1);
    } finally {
      await ctx2.close();
    }
  });

  test('accessibilité : zéro violation axe et pas de débordement à 360 px sur « Mon compte »', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const page = await ctx.newPage();
    try {
      await login(page, 'cleo', secrets[u('cleo')]);
      await page.waitForURL(/\/espace\/eleve/);
      await page.goto('/espace/eleve/compte');
      await expect(page.getByTestId('btn-credential')).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id} [${v.impact}] : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    } finally {
      await ctx.close();
    }
  });
});

test.describe('enseignant', () => {
  test('Mon compte → Sécurité : mot de passe faible refusé, changement, ancien refusé, nouveau accepté', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await login(page, 'prof', secrets[u('prof')]);
      await page.waitForURL(/\/espace\/enseignant/);
      await page.getByRole('link', { name: 'Mon compte' }).click();
      await page.waitForURL(/\/espace\/enseignant\/compte/);
      await expect(page.getByRole('heading', { name: /modifier mon mot de passe/i })).toBeVisible();

      await changeCredential(page, secrets[u('prof')], 'court1234');
      await expect(page.getByTestId('credential-error')).toContainText('12 caractères');
      await changeCredential(page, 'pas-le-bon', NEW_PASSWORD);
      await expect(page.getByTestId('credential-error')).toHaveText('Le mot de passe actuel est incorrect.');

      await changeCredential(page, secrets[u('prof')], NEW_PASSWORD);
      await expect(page.getByTestId('credential-success')).toContainText('Votre mot de passe a été modifié.');
      await page.waitForURL(/\/espace\/connexion\?modifie=1/, { timeout: 15_000 });
    } finally {
      await ctx.close();
    }
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    try {
      await login(p2, 'prof', secrets[u('prof')]);
      await expect(p2.getByTestId('connexion-erreur')).toBeVisible();
      await login(p2, 'prof', NEW_PASSWORD);
      await p2.waitForURL(/\/espace\/enseignant/);
    } finally {
      await ctx2.close();
    }
  });

  test('anonyme : les deux routes sont fermées', async ({ request }) => {
    expect((await request.post('/api/espace/account/credential', { data: { current: 'x', next: NEW_CODE, confirm: NEW_CODE } })).status()).toBe(401);
    expect((await request.post(`/api/espace/teacher/students/${ids.bob}/reset-code`, { data: {} })).status()).toBe(401);
  });
});

test.describe('réinitialisation par l’enseignant puis code obligatoire', () => {
  test('code temporaire affiché une fois → connexion élève → choix obligatoire → nouveau code fonctionne', async ({ browser }) => {
    // 1. L'enseignant réinitialise Bob.
    const tctx = await browser.newContext();
    const teacher = await tctx.newPage();
    let temporary = '';
    try {
      await login(teacher, 'prof2', secrets[u('prof2')]);
      await teacher.waitForURL(/\/espace\/enseignant/);
      await teacher.goto(`/espace/enseignant/eleves/${ids.bob}`);
      await teacher.getByTestId('btn-reset-code').click();
      const dialog = teacher.getByRole('alertdialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Réinitialiser', exact: true }).click();
      await expect(teacher.getByTestId('reset-result')).toBeVisible();
      temporary = (await teacher.getByTestId('temporary-code').innerText()).trim();
      expect(temporary).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      // Une fois le cadre fermé, le code n'est plus nulle part dans la page.
      await teacher.getByTestId('btn-close-code').click();
      await expect(teacher.getByTestId('temporary-code')).toHaveCount(0);
      await expect(teacher.locator('body')).not.toContainText(temporary);
    } finally {
      await tctx.close();
    }
    expect(await prisma.espaceSecurityEvent.count({ where: { userId: ids.bob, actorId: ids.prof2, type: 'PASSWORD_RESET_BY_TEACHER' } })).toBe(1);

    // 2. Bob se connecte avec le code temporaire : il est conduit à choisir le sien, rien d'autre n'est accessible.
    const sctx = await browser.newContext();
    const student = await sctx.newPage();
    try {
      await login(student, 'bob', secrets[u('bob')]);
      await expect(student.getByTestId('connexion-erreur')).toBeVisible(); // l'ancien code ne marche plus
      await login(student, 'bob', temporary);
      await student.waitForURL(/\/espace\/eleve\/compte\?obligatoire=1/);
      await expect(student.getByTestId('credential-mandatory')).toBeVisible();
      await student.goto('/espace/eleve');
      await student.waitForURL(/\/espace\/eleve\/compte\?obligatoire=1/); // pas d'échappatoire vers le reste de l'espace

      await changeCredential(student, temporary, SECOND_CODE);
      await expect(student.getByTestId('credential-success')).toBeVisible();
      await student.waitForURL(/\/espace\/connexion\?modifie=1/, { timeout: 15_000 });

      // 3. Le code temporaire est inutilisable, le nouveau code fonctionne et ouvre l'espace normalement.
      await login(student, 'bob', temporary);
      await expect(student.getByTestId('connexion-erreur')).toBeVisible();
      await login(student, 'bob', SECOND_CODE);
      await student.waitForURL(/\/espace\/eleve$/);
      await expect(student.getByTestId('bonjour')).toBeVisible();
    } finally {
      await sctx.close();
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.bob }, select: { pinMustChange: true } })).pinMustChange).toBe(false);
  });
});
