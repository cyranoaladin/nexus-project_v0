/**
 * Espace pédagogique — nouvelles leçons (TP POO 2 et Maths « Fonctions, limites et lecture graphique »),
 * dans un vrai navigateur, contre la pile jetable.
 *
 *   NSI   : accès par inscription, moteur Python réel (solution de référence → tests verts), autosave, reprise
 *   Maths : formules et figure rendues, vérification pédagogique, autosave, reprise, lecture enseignant
 *   isolation : un élève non inscrit à la matière est renvoyé proprement ; aucun corrigé côté élève
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

import { MATHS_LIMITES_ACTIVITY_SLUG, POO2_ACTIVITY_SLUG } from '../../lib/espace/lesson-routes';
import { applyProvisioning, parseRoster, syncActivities } from '../../lib/espace/provisioning';
import { assertDisposableE2eDatabase } from '../helpers/disposable-database';

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL?.includes('nexus_e2e') ? process.env.DATABASE_URL : undefined);

const run = Math.random().toString(36).slice(2, 8);
const u = (n: string) => `l${n}.${run}`.slice(0, 32);

type Who = 'cleo' | 'dan' | 'prof';
type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

let prisma: PrismaClient;
const secrets: Record<string, string> = {};
const ids: Record<string, string> = {};
const states: Partial<Record<Who, StorageState>> = {};

async function pageAs(browser: Browser, who: Who, viewport?: { width: number; height: number }) {
  if (!states[who]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('/espace/connexion');
    await p.getByTestId('input-username').fill(u(who));
    await p.getByTestId('input-secret').fill(secrets[u(who)]);
    await p.getByTestId('btn-connexion').click();
    await p.waitForURL(/\/espace\/(eleve|enseignant)/);
    states[who] = await ctx.storageState();
    await ctx.close();
  }
  const ctx = await browser.newContext({ storageState: states[who], viewport });
  return { ctx, page: await ctx.newPage() };
}

async function expectSaved(page: Page) {
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
}

/** Solution de référence du dépôt (jamais servie à l'élève) — lue côté test uniquement. */
function referenceSolution(name: 'LISTE_SOLUTION'): string {
  const dir = path.join(process.cwd(), 'content/espace/nsi-structures-lineaires');
  return execFileSync('python3', ['-c', `import solutions; print(solutions.${name}, end="")`], { cwd: dir, encoding: 'utf8' });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  if (!DATABASE_URL) throw new Error('E2E_DATABASE_URL (pile jetable nexus_e2e) est requis');
  assertDisposableE2eDatabase(DATABASE_URL);
  prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  await syncActivities(prisma);
  const group = `lec-${run}`;
  const roster = parseRoster({
    groups: [{ slug: group, name: `Leçons ${run}` }],
    teachers: [{ username: u('prof'), firstName: 'Prof', lastName: `Lecons${run}`, teaches: [{ group, subjects: ['NSI', 'MATHS'] }] }],
    students: [
      { username: u('cleo'), firstName: 'Cleo', lastName: `Alpha${run}`, enrollments: [{ group, subjects: ['NSI', 'MATHS'] }] },
      { username: u('dan'), firstName: 'Dan', lastName: `Beta${run}`, enrollments: [{ group, subjects: ['MATHS'] }] },
    ],
  });
  const { credentials } = await applyProvisioning(prisma, roster, { adopt: false });
  for (const c of credentials) secrets[c.username] = c.secret;
  for (const n of ['prof', 'cleo', 'dan'] as const) ids[n] = (await prisma.user.findUniqueOrThrow({ where: { username: u(n) } })).id;
});

test.afterAll(async () => {
  const students = [ids.cleo, ids.dan];
  await prisma.espaceAnnotation.deleteMany({ where: { work: { studentId: { in: students } } } });
  await prisma.espaceWorkVersion.deleteMany({ where: { work: { studentId: { in: students } } } });
  await prisma.espaceWork.deleteMany({ where: { studentId: { in: students } } });
  await prisma.espaceEnrollment.deleteMany({ where: { userId: { in: students } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { teacherId: ids.prof } });
  await prisma.espaceGroup.deleteMany({ where: { slug: `lec-${run}` } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.prof, ...students] } } });
  await prisma.$disconnect();
});

test.describe('Maths — fonctions, limites et lecture graphique', () => {
  test('formules et figure rendues, vérification pédagogique, autosave et reprise', async ({ browser }) => {
    test.setTimeout(120_000);
    const { ctx, page } = await pageAs(browser, 'cleo');
    try {
      await page.goto('/espace/eleve');
      await expect(page.locator('a[href^="/espace/maths/fonctions-limites"]').first()).toBeVisible();

      await page.goto('/espace/maths/fonctions-limites');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('limites');
      // Formules rendues (KaTeX), aucune balise TeX brute visible.
      await expect(page.locator('.katex').first()).toBeVisible();
      await expect(page.locator('main')).not.toContainText('\\frac');
      // Figure de fonction rendue en SVG accessible.
      await expect(page.locator('figure svg').first()).toBeVisible();

      // Étape « diagnostic » : réponse fausse → message ciblé ; réponse juste → confirmée.
      const field = page.getByRole('textbox').first();
      await field.fill('7');
      await page.getByRole('button', { name: /vérifie|Vérifier ma réponse/ }).first().click();
      await expect(page.getByTestId('check-feedback').first()).not.toContainText(/^Correct/);
      await field.fill('3');
      await page.getByRole('button', { name: /vérifie|Vérifier ma réponse/ }).first().click();
      await expect(page.getByTestId('check-feedback').first()).toContainText('Correct');
      await expectSaved(page);

      // Preuve côté serveur (et non seulement l'indicateur) : l'essai juste est enregistré en base.
      await expect
        .poll(
          async () => {
            const w = await prisma.espaceWork.findFirst({ where: { studentId: ids.cleo, activity: { slug: MATHS_LIMITES_ACTIVITY_SLUG } } });
            const step = (w?.content as { steps?: Record<string, { solved?: Record<string, boolean>; tries?: Record<string, number> }> } | null)?.steps?.diagnostic;
            return { solved: step?.solved?.['lim-droite'], tries: step?.tries?.['lim-droite'] };
          },
          { timeout: 20_000 },
        )
        .toEqual({ solved: true, tries: 2 });

      await page.reload();
      await expect(page.getByRole('textbox').first()).toHaveValue('3');
      await expect(page.getByTestId('check-feedback').first()).toContainText(/déjà validée/);
    } finally {
      await ctx.close();
    }
  });

  test('l’enseignant relit le travail avec les essais et les formules rendues', async ({ browser }) => {
    const work = await prisma.espaceWork.findFirstOrThrow({ where: { studentId: ids.cleo, activity: { slug: MATHS_LIMITES_ACTIVITY_SLUG } } });
    const { ctx, page } = await pageAs(browser, 'prof');
    try {
      await page.goto(`/espace/enseignant/corriger/${work.id}`);
      await expect(page.locator('.katex').first()).toBeVisible();
      await expect(page.getByText(/essai/).first()).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('accessibilité : zéro violation axe, pas de débordement à 360 px', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'cleo', { width: 360, height: 800 });
    try {
      await page.goto('/espace/maths/fonctions-limites');
      await expect(page.locator('figure svg').first()).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id} [${v.impact}] : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    } finally {
      await ctx.close();
    }
  });
});

test.describe('NSI — TP POO 2 : listes, piles et files', () => {
  test('un élève de Maths seul ne voit pas le TP de NSI (message sobre, pas d’erreur)', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'dan');
    try {
      const res = await page.goto('/espace/nsi/structures-lineaires');
      expect(res?.status()).toBeLessThan(500);
      await expect(page.getByText(/n’est pas dans tes matières/)).toBeVisible();
      expect(await prisma.espaceWork.count({ where: { studentId: ids.dan, activity: { slug: POO2_ACTIVITY_SLUG } } })).toBe(0);
    } finally {
      await ctx.close();
    }
  });

  test('autosave, reprise, puis moteur Python réel : la solution de référence passe tous les contrôles', async ({ browser, request }) => {
    test.setTimeout(240_000);
    const { ctx, page } = await pageAs(browser, 'cleo');
    try {
      await page.goto('/espace/nsi/structures-lineaires');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('POO 2');

      // Première étape (réactivation) : saisie libre enregistrée et restaurée.
      const first = page.getByRole('textbox').first();
      await first.fill(`Réponse E2E ${run}`);
      await expectSaved(page);
      await page.reload();
      await expect(page.getByRole('textbox').first()).toHaveValue(`Réponse E2E ${run}`);

      // Étape « Liste » : le code de départ échoue, la solution de référence passe (moteur Python réel).
      const reachable = await request.get('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs', { timeout: 10_000 }).then((r) => r.ok(), () => false);
      test.skip(!reachable, 'cdn.jsdelivr.net injoignable depuis cet environnement : exécution Python non vérifiable');
      await page.getByRole('button', { name: 'Étape suivante' }).click();
      await page.getByRole('button', { name: 'Étape suivante' }).click();
      const editor = page.getByTestId('code-editor');
      await expect(editor).toBeVisible();
      await page.getByRole('button', { name: 'Vérifier mon code' }).click();
      await expect(page.getByTestId('run-results')).toContainText('À revoir', { timeout: 150_000 });

      await editor.fill(referenceSolution('LISTE_SOLUTION'));
      await expectSaved(page);
      await page.getByRole('button', { name: 'Vérifier mon code' }).click();
      const results = page.getByTestId('run-results');
      await expect(results).toContainText('Réussi', { timeout: 150_000 });
      await expect(results).not.toContainText('À revoir');
    } finally {
      await ctx.close();
    }
  });
});
