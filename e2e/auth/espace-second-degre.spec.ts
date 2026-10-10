/**
 * Espace pédagogique — parcours « Le second degré » (Première générale), dans un vrai navigateur,
 * contre la pile jetable.
 *
 *   audience : proposé au groupe `premiere-generale`, jamais à un groupe de Terminale
 *   vérification : réponse fausse → message ciblé + correction détaillée repliable ; réponse juste → confirmée
 *   écritures : ensemble de racines (avec √), intervalles (réunion, ℝ) ; essais enregistrés ; reprise après rechargement
 *   accessibilité : zéro violation axe, pas de débordement à 360 px
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

import { MATHS_SECOND_DEGRE_ACTIVITY_SLUG } from '../../lib/espace/lesson-routes';
import { applyProvisioning, parseRoster, syncActivities } from '../../lib/espace/provisioning';
import { assertDisposableE2eDatabase } from '../helpers/disposable-database';

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL?.includes('nexus_e2e') ? process.env.DATABASE_URL : undefined);

const run = Math.random().toString(36).slice(2, 8);
const u = (n: string) => `sd${n}.${run}`.slice(0, 32);
const AUDIENCE_GROUP = 'premiere-generale';

type Who = 'prem' | 'term';
type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

let prisma: PrismaClient;
const secrets: Record<string, string> = {};
const ids: Record<string, string> = {};
const states: Partial<Record<Who, StorageState>> = {};
let createdGroup = false;

async function pageAs(browser: Browser, who: Who, viewport?: { width: number; height: number }) {
  if (!states[who]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('/espace/connexion');
    await p.getByTestId('input-username').fill(u(who));
    await p.getByTestId('input-secret').fill(secrets[u(who)]);
    await p.getByTestId('btn-connexion').click();
    await p.waitForURL(/\/espace\/eleve/);
    states[who] = await ctx.storageState();
    await ctx.close();
  }
  const ctx = await browser.newContext({ storageState: states[who], viewport });
  return { ctx, page: await ctx.newPage() };
}

async function expectSaved(page: Page) {
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
}

const verifyButtons = (page: Page) => page.getByRole('button', { name: /^Je vérifie$/ });
const next = async (page: Page, times: number) => {
  for (let i = 0; i < times; i++) await page.getByRole('button', { name: 'Étape suivante' }).click();
};
/** Remplit le champ `step`/`field` (id déterministe du poste de travail), vérifie, retourne le bloc du champ. */
async function answer(page: Page, step: string, field: string, value: string) {
  const input = page.locator(`#f-${step}-${field}`);
  await input.fill(value);
  const block = input.locator('xpath=..');
  await block.getByRole('button', { name: 'Je vérifie' }).click();
  return block;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  if (!DATABASE_URL) throw new Error('E2E_DATABASE_URL (pile jetable nexus_e2e) est requis');
  assertDisposableE2eDatabase(DATABASE_URL);
  prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  await syncActivities(prisma);
  createdGroup = (await prisma.espaceGroup.findUnique({ where: { slug: AUDIENCE_GROUP } })) === null;
  const roster = parseRoster({
    groups: [
      { slug: AUDIENCE_GROUP, name: 'Première générale' },
      { slug: `sd-term-${run}`, name: `Terminale ${run}` },
    ],
    students: [
      { username: u('prem'), firstName: 'Premiere', lastName: `Eleve${run}`, enrollments: [{ group: AUDIENCE_GROUP, subjects: ['MATHS'] }] },
      { username: u('term'), firstName: 'Terminale', lastName: `Eleve${run}`, enrollments: [{ group: `sd-term-${run}`, subjects: ['MATHS'] }] },
    ],
  });
  const { credentials } = await applyProvisioning(prisma, roster, { adopt: false });
  for (const c of credentials) secrets[c.username] = c.secret;
  for (const n of ['prem', 'term'] as const) ids[n] = (await prisma.user.findUniqueOrThrow({ where: { username: u(n) } })).id;
});

test.afterAll(async () => {
  const students = [ids.prem, ids.term].filter(Boolean) as string[];
  await prisma.espaceAnnotation.deleteMany({ where: { work: { studentId: { in: students } } } });
  await prisma.espaceWorkVersion.deleteMany({ where: { work: { studentId: { in: students } } } });
  await prisma.espaceWork.deleteMany({ where: { studentId: { in: students } } });
  await prisma.espaceEnrollment.deleteMany({ where: { userId: { in: students } } });
  await prisma.espaceGroup.deleteMany({ where: { slug: { in: [`sd-term-${run}`, ...(createdGroup ? [AUDIENCE_GROUP] : [])] } } });
  await prisma.user.deleteMany({ where: { id: { in: students } } });
  await prisma.$disconnect();
});

test.describe('Maths — le second degré (Première)', () => {
  test('proposé au groupe de Première, pas à un groupe de Terminale', async ({ browser }) => {
    const first = await pageAs(browser, 'prem');
    try {
      await first.page.goto('/espace/eleve/matieres');
      await expect(first.page.locator('a[href^="/espace/maths/second-degre"]').first()).toBeVisible();
    } finally {
      await first.ctx.close();
    }
    const other = await pageAs(browser, 'term');
    try {
      await other.page.goto('/espace/eleve/matieres');
      await expect(other.page.locator('a[href^="/espace/maths/fonctions-limites"]').first()).toBeVisible();
      await expect(other.page.locator('a[href^="/espace/maths/second-degre"]')).toHaveCount(0);
    } finally {
      await other.ctx.close();
    }
  });

  test('vérification des réponses : écritures libres, messages ciblés, correction détaillée, reprise', async ({ browser }) => {
    test.setTimeout(180_000);
    const { ctx, page } = await pageAs(browser, 'prem');
    try {
      await page.goto('/espace/maths/second-degre');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('second degré');
      await expect(page.locator('.katex').first()).toBeVisible();
      await expect(page.locator('main')).not.toContainText('\\frac');
      await expect(page.locator('figure svg').first()).toBeVisible();

      // Diagnostic : réponse fausse → message ciblé + correction repliée ; juste → confirmée.
      const bad = await answer(page, 'diagnostic', 'f0', '3');
      await expect(bad.getByTestId('check-feedback')).toContainText('Pas encore');
      const solution = bad.getByTestId('check-solution');
      await expect(solution).toBeVisible();
      await expect(solution).not.toHaveAttribute('open', '');
      await solution.getByText('Voir la correction détaillée').click();
      await expect(solution).toHaveAttribute('open', '');
      await expect(solution).toContainText('On retrouve le point');
      const good = await answer(page, 'diagnostic', 'f0', '−3');
      await expect(good.getByTestId('check-feedback')).toContainText('Correct');
      await expect(good.getByTestId('check-solution')).toHaveCount(0);
      const roots = await answer(page, 'diagnostic', 'lecture', '3 et -1');
      await expect(roots.getByTestId('check-feedback')).toContainText('Correct');
      await expectSaved(page);

      // Équations : valeurs exactes avec √ et ensemble vide.
      await next(page, 2);
      await expect(page.locator('#f-equations-sol4')).toBeVisible();
      const exact = await answer(page, 'equations', 'sol4', '(1+√5)/2 ; (1−√5)/2');
      await expect(exact.getByTestId('check-feedback')).toContainText('Correct');
      const approx = await answer(page, 'equations', 'sol4', '1,618 ; -0,618');
      await expect(approx.getByTestId('check-feedback')).toContainText('approximations');
      const empty = await answer(page, 'equations', 'sol3', 'aucune');
      await expect(empty.getByTestId('check-feedback')).toContainText('Correct');

      // Inéquations : réunion d'intervalles, tous les formats usuels, et ℝ.
      await next(page, 1);
      await expect(page.locator('#f-inequations-i1')).toBeVisible();
      const union = await answer(page, 'inequations', 'i1', ']−∞ ; −2[ ∪ ]3 ; +∞[');
      await expect(union.getByTestId('check-feedback')).toContainText('Correct');
      const wrongZone = await answer(page, 'inequations', 'i1', '[-2;3]');
      await expect(wrongZone.getByTestId('check-feedback')).toContainText('entre');
      const all = await answer(page, 'inequations', 'i3', 'ℝ');
      await expect(all.getByTestId('check-feedback')).toContainText('Correct');
      await expectSaved(page);

      // Preuve côté serveur : les essais et la réussite sont enregistrés.
      await expect
        .poll(
          async () => {
            const w = await prisma.espaceWork.findFirst({ where: { studentId: ids.prem, activity: { slug: MATHS_SECOND_DEGRE_ACTIVITY_SLUG } } });
            const steps = (w?.content as { steps?: Record<string, { solved?: Record<string, boolean>; tries?: Record<string, number> }> } | null)?.steps;
            return { f0: [steps?.diagnostic?.tries?.f0, steps?.diagnostic?.solved?.f0], i3: steps?.inequations?.solved?.i3 };
          },
          { timeout: 20_000 },
        )
        .toEqual({ f0: [2, true], i3: true });

      // Reprise après rechargement : la réponse validée est signalée.
      await page.reload();
      await expect(page.getByTestId('check-feedback').filter({ hasText: /déjà validée/ }).first()).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('accessibilité : zéro violation axe et aucun débordement à 360 px, sur les 10 étapes', async ({ browser }) => {
    test.setTimeout(240_000);
    const { ctx, page } = await pageAs(browser, 'prem', { width: 360, height: 800 });
    try {
      await page.goto('/espace/maths/second-degre');
      await expect(page.locator('figure svg').first()).toBeVisible();
      // Une correction dépliée fait partie de l'état à contrôler (étape « Inéquations », la plus longue).
      await page.getByLabel('Étape', { exact: true }).selectOption({ label: '4. Inéquations' });
      await expect(page.locator('#f-inequations-i1')).toBeVisible();
      const bad = await answer(page, 'inequations', 'i1', '[-2;3]');
      await bad.getByTestId('check-solution').getByText('Voir la correction détaillée').click();

      const options = await page.getByLabel('Étape', { exact: true }).locator('option').allTextContents();
      expect(options).toHaveLength(10);
      // Toutes les étapes sont contrôlées avant de conclure : un défaut ne doit pas en masquer un autre.
      const findings: string[] = [];
      for (const label of options) {
        await page.getByLabel('Étape', { exact: true }).selectOption({ label });
        await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
        const { violations } = await new AxeBuilder({ page }).analyze();
        for (const v of violations) {
          const detail = (n: (typeof v.nodes)[number]) => {
            const d = n.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
            return d?.contrastRatio ? ` (${d.fgColor} sur ${d.bgColor}, ratio ${d.contrastRatio})` : '';
          };
          findings.push(`${label} — ${v.id} [${v.impact}] : ${v.nodes.map((n) => n.target.join(' ') + detail(n)).join(' | ')}`);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 0) findings.push(`${label} — débordement horizontal de ${overflow}px`);
      }
      expect(findings).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
});
