/**
 * Espace pédagogique — parcours NSI « Récursivité et programmation récursive », dans un vrai navigateur,
 * contre la pile jetable (moteur Python Pyodide réel).
 *
 *   élève   : connexion → parcours → premières étapes → programme défectueux (RecursionError maîtrisée) → réparation
 *             → trace de la pile d'appels → fonctions récursives sous Pyodide → autosave → rafraîchissement → remise
 *   arrêt   : une récursion exponentielle est interrompue (Worker détruit) et l'interface reste utilisable
 *   enseignant : parcours visible, travail, code, tests, commentaire, compétence, « À reprendre »
 *   non-régression : TP POO 1, TP POO 2, Maths (Suites, Fonctions/limites), regroupement NSI, isolation, a11y
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

import { RECURSIVITE_ACTIVITY_SLUG } from '../../lib/espace/lesson-routes';
import { applyProvisioning, parseRoster, syncActivities } from '../../lib/espace/provisioning';
import { assertDisposableE2eDatabase } from '../helpers/disposable-database';

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL?.includes('nexus_e2e') ? process.env.DATABASE_URL : undefined);

const run = Math.random().toString(36).slice(2, 8);
const u = (n: string) => `r${n}.${run}`.slice(0, 32);
const COMMENT = `Bonne trace des appels ${run}`;

type Who = 'lea' | 'max' | 'prof';
type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

let prisma: PrismaClient;
const secrets: Record<string, string> = {};
const ids: Record<string, string> = {};
const states: Partial<Record<Who, StorageState>> = {};
let workId = '';

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

/** Solutions de référence du dépôt (jamais servies à l'élève) — lues côté test uniquement. */
function reference(name: 'DECOUVERTE_SOLUTION' | 'ECRIRE_SOLUTION' | 'PILE_APPELS_SOLUTION' | 'MISSION_SOLUTION'): string {
  const dir = path.join(process.cwd(), 'content/espace/nsi-recursivite');
  return execFileSync('python3', ['-c', `import solutions; print(solutions.${name}, end="")`], { cwd: dir, encoding: 'utf8' });
}

const goToStep = (page: Page, label: RegExp) => page.getByRole('navigation', { name: 'Étapes du TP' }).getByRole('button', { name: label }).click();

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  if (!DATABASE_URL) throw new Error('E2E_DATABASE_URL (pile jetable nexus_e2e) est requis');
  assertDisposableE2eDatabase(DATABASE_URL);
  prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  await syncActivities(prisma);
  const group = `rec-${run}`;
  const roster = parseRoster({
    groups: [{ slug: group, name: `Récursivité ${run}` }],
    teachers: [{ username: u('prof'), firstName: 'Prof', lastName: `Rec${run}`, teaches: [{ group, subjects: ['NSI', 'MATHS'] }] }],
    students: [
      { username: u('lea'), firstName: 'Lea', lastName: `Alpha${run}`, enrollments: [{ group, subjects: ['NSI', 'MATHS'] }] },
      { username: u('max'), firstName: 'Max', lastName: `Beta${run}`, enrollments: [{ group, subjects: ['MATHS'] }] },
    ],
  });
  const { credentials } = await applyProvisioning(prisma, roster, { adopt: false });
  for (const c of credentials) secrets[c.username] = c.secret;
  for (const n of ['prof', 'lea', 'max'] as const) ids[n] = (await prisma.user.findUniqueOrThrow({ where: { username: u(n) } })).id;
});

test.afterAll(async () => {
  const students = [ids.lea, ids.max];
  await prisma.espaceAnnotation.deleteMany({ where: { work: { studentId: { in: students } } } });
  await prisma.espaceWorkVersion.deleteMany({ where: { work: { studentId: { in: students } } } });
  await prisma.espaceWork.deleteMany({ where: { studentId: { in: students } } });
  await prisma.espaceEnrollment.deleteMany({ where: { userId: { in: students } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { teacherId: ids.prof } });
  await prisma.espaceGroup.deleteMany({ where: { slug: `rec-${run}` } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.prof, ...students] } } });
  await prisma.$disconnect();
});

test.describe('tableau de bord élève', () => {
  test('NSI est organisé en trois thèmes : POO (TP 1 et 2), Algorithmique et programmation (Récursivité), Préparation de l’évaluation', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'lea');
    try {
      await page.goto('/espace/eleve/matieres');
      const themes = page.getByTestId('theme');
      await expect(themes).toHaveCount(3);
      await expect(themes.nth(0)).toContainText('Programmation orientée objet');
      await expect(themes.nth(0).getByRole('link')).toHaveText(['TP POO 1 — Des objets qui agissent', 'TP POO 2 — Listes, piles et files']);
      await expect(themes.nth(1)).toContainText('Algorithmique et programmation');
      await expect(themes.nth(1).getByRole('link')).toHaveText(['Récursivité et programmation récursive']);
      await expect(themes.nth(2)).toContainText('Préparation de l’évaluation');
      await expect(themes.nth(2).getByRole('link')).toHaveText(['TAD, POO et récursivité — sujets d’entraînement corrigés']);
      // Les maths restent sans thème et gardent leurs liens.
      await expect(page.locator('a[href="/espace/maths/suites"]')).toBeVisible();
      await expect(page.locator('a[href^="/espace/maths/fonctions-limites"]')).toBeVisible();

      await page.goto('/espace/eleve');
      await expect(page.locator('a[href="/espace/nsi/recursivite"]')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('un élève de Maths seul n’accède pas au parcours (message sobre, aucun travail créé)', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'max');
    try {
      const res = await page.goto('/espace/nsi/recursivite');
      expect(res?.status()).toBeLessThan(500);
      await expect(page.getByText(/n’est pas dans tes matières/)).toBeVisible();
      expect(await prisma.espaceWork.count({ where: { studentId: ids.max, activity: { slug: RECURSIVITE_ACTIVITY_SLUG } } })).toBe(0);
    } finally {
      await ctx.close();
    }
  });
});

test.describe('parcours élève — Récursivité', () => {
  test('premières étapes, programme défectueux (RecursionError maîtrisée), réparation, tests Pyodide', async ({ browser, request }) => {
    test.setTimeout(300_000);
    const reachable = await request.get('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs', { timeout: 10_000 }).then((r) => r.ok(), () => false);
    expect(reachable, 'cdn.jsdelivr.net doit être joignable : le moteur Python (Pyodide) est exercé pour de vrai').toBe(true);

    const { ctx, page } = await pageAs(browser, 'lea');
    try {
      await page.goto('/espace/nsi/recursivite');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Récursivité et programmation récursive');
      await expect(page.getByRole('navigation', { name: 'Étapes du TP' }).getByRole('button')).toHaveCount(10);

      // Étape 1 — diagnostic : une réponse, une phrase ; autosave.
      await page.getByRole('radio').first().check();
      await page.getByRole('textbox').first().fill(`Elle finit si une variable progresse vers l’arrêt ${run}`);
      await expectSaved(page);

      // Étape 2 — le programme défectueux est dans l'éditeur ; il échoue proprement.
      await page.getByRole('button', { name: 'Étape suivante' }).click();
      const editor = page.getByTestId('code-editor');
      await expect(editor).toBeVisible();
      await expect(editor).toHaveValue(/compte_a_rebours\(n\)/);
      await page.getByRole('button', { name: 'Exécuter' }).click();
      const results = page.getByTestId('run-results');
      await expect(results).toContainText('RecursionError', { timeout: 150_000 });
      await expect(results).toContainText('cas de base');
      await expect(results).toContainText('n’exécute pas une infinité d’appels');

      // Les contrôles échouent tant que le programme n'est pas réparé…
      await page.getByRole('button', { name: 'Vérifier mon code' }).click();
      await expect(results).toContainText('À revoir', { timeout: 60_000 });

      // … et réussissent avec la réparation (cas de base + n - 1).
      await editor.fill(reference('DECOUVERTE_SOLUTION'));
      await expectSaved(page);
      await page.getByRole('button', { name: 'Vérifier mon code' }).click();
      await expect(results).toContainText('Réussi', { timeout: 60_000 });
      await expect(results).not.toContainText('À revoir');
      await expect(results).toContainText('Terminaison');
    } finally {
      await ctx.close();
    }
  });

  test('la trace de la pile d’appels distingue descente et remontée (LIFO visible)', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'lea');
    try {
      await page.goto('/espace/nsi/recursivite');
      await goToStep(page, /4\. Pile d’appels/);
      const trace = page.getByTestId('trace-trace-somme');
      await expect(trace).toBeVisible();
      for (let i = 0; i < 5; i++) await trace.getByRole('button', { name: 'Étape suivante' }).click();
      await expect(trace.getByTestId('trace-phase')).toContainText('Descente');
      await expect(trace.getByTestId('trace-stack').getByRole('listitem').first()).toContainText('somme(0)');
      await trace.getByRole('button', { name: 'Étape suivante' }).click();
      await expect(trace.getByTestId('trace-phase')).toContainText('Remontée');
      await expect(trace.getByTestId('trace-message')).toContainText('Le dernier appel créé est le premier terminé');
      for (let i = 0; i < 4; i++) await trace.getByRole('button', { name: 'Étape suivante' }).click();
      await expect(trace.getByTestId('trace-events')).toContainText('RETOUR 10');
      await expect(trace.getByText('La pile est vide.', { exact: true })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('écrire des fonctions récursives : contrôles Pyodide, autosave, rafraîchissement, progression restaurée, remise', async ({ browser }) => {
    test.setTimeout(300_000);
    const { ctx, page } = await pageAs(browser, 'lea');
    try {
      await page.goto('/espace/nsi/recursivite');
      await goToStep(page, /5\. Écrire/);
      const editor = page.getByTestId('code-editor');
      await expect(editor).toBeVisible();

      // Le code de départ ne passe rien ; une version avec une boucle donne des valeurs justes mais n'est pas récursive.
      await editor.fill('def somme(n):\n    return n * (n + 1) // 2\n\n\ndef factorielle(n):\n    pass\n\n\ndef puissance(a, n):\n    pass\n');
      await page.getByRole('button', { name: 'Vérifier mon code' }).click();
      const results = page.getByTestId('run-results');
      await expect(results).toContainText('s’appelle elle-même', { timeout: 150_000 });
      await expect(results).toContainText('RÉCURSIVE');

      // Solution de référence : tous les contrôles passent.
      await editor.fill(reference('ECRIRE_SOLUTION'));
      await expectSaved(page);
      await page.getByRole('button', { name: 'Vérifier mon code' }).click();
      await expect(results).toContainText('Réussi', { timeout: 60_000 });
      await expect(results).not.toContainText('À revoir');
      await expect(results.getByRole('listitem')).toHaveCount(10);
      await expectSaved(page);

      // Côté serveur : code, étape courante, résultat des contrôles et brouillon enregistrés.
      const work = await prisma.espaceWork.findFirstOrThrow({ where: { studentId: ids.lea, activity: { slug: RECURSIVITE_ACTIVITY_SLUG } } });
      workId = work.id;
      const content = work.content as { steps?: Record<string, { code?: string; tests?: { passed: number; total: number } }> };
      expect(content.steps?.ecrire?.code).toBe(reference('ECRIRE_SOLUTION'));
      expect(content.steps?.ecrire?.tests).toMatchObject({ passed: 10, total: 10 });
      expect(content.steps?.decouverte?.code).toBe(reference('DECOUVERTE_SOLUTION'));
      expect(work.currentStep).toBe(4);
      // « Étape renseignée » = toutes ses questions et champs remplis : aucune ici, la progression reste donc honnête.
      expect(work.progressSteps).toBe(0);

      // Rafraîchissement : code et progression restaurés.
      await page.reload();
      await expect(page.getByRole('navigation', { name: 'Étapes du TP' }).getByRole('button', { name: /5\. Écrire/ })).toHaveAttribute('aria-current', 'step');
      await expect(page.getByTestId('code-editor')).toHaveValue(reference('ECRIRE_SOLUTION'));
      await goToStep(page, /2\. Découvrir/);
      await expect(page.getByTestId('code-editor')).toHaveValue(reference('DECOUVERTE_SOLUTION'));

      // Remise volontaire.
      await page.getByTestId('btn-remettre').click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Remettre', exact: true }).click();
      await expect(page.getByTestId('work-banner')).toContainText(/remis/i, { timeout: 15_000 });
      const after = await prisma.espaceWork.findUniqueOrThrow({ where: { id: workId } });
      expect(after.status).toBe('SUBMITTED');
      await expect(page.getByTestId('code-editor')).not.toBeEditable();
    } finally {
      await ctx.close();
    }
  });
});

test.describe('terminaison : une récursion qui ne s’arrête pas ne gèle pas l’interface', () => {
  test('une récursion exponentielle est interrompue puis l’exécution redevient possible', async ({ browser }) => {
    test.setTimeout(300_000);
    // Le travail de Lea est remis (lecture seule) : un élève NSI jetable sert à cette preuve.
    const group = await prisma.espaceGroup.findUniqueOrThrow({ where: { slug: `rec-${run}` } });
    const roster = parseRoster({
      groups: [{ slug: group.slug, name: group.name }],
      teachers: [],
      students: [{ username: u('zoe'), firstName: 'Zoe', lastName: `Gamma${run}`, enrollments: [{ group: group.slug, subjects: ['NSI'] }] }],
    });
    const { credentials } = await applyProvisioning(prisma, roster, { adopt: false });
    for (const c of credentials) secrets[c.username] = c.secret;
    ids.zoe = (await prisma.user.findUniqueOrThrow({ where: { username: u('zoe') } })).id;

    const zctx = await browser.newContext();
    const zpage = await zctx.newPage();
    try {
      await zpage.goto('/espace/connexion');
      await zpage.getByTestId('input-username').fill(u('zoe'));
      await zpage.getByTestId('input-secret').fill(secrets[u('zoe')]);
      await zpage.getByTestId('btn-connexion').click();
      await zpage.waitForURL(/\/espace\/eleve/);
      await zpage.goto('/espace/nsi/recursivite');
      await goToStep(zpage, /5\. Écrire/);
      const editor = zpage.getByTestId('code-editor');
      // Récursion à deux appels sur une profondeur de 60 : correcte mais d'une durée pratiquement infinie.
      await editor.fill('def f(n):\n    if n == 0:\n        return 1\n    return f(n - 1) + f(n - 1)\n\n\nprint(f(60))\n');
      await zpage.getByRole('button', { name: 'Exécuter' }).click();
      const results = zpage.getByTestId('run-results');
      await expect(results).toContainText('Temps d’exécution dépassé', { timeout: 180_000 });
      // L'interface répond : le moteur est recréé et un programme simple s'exécute.
      await editor.fill('def somme(n):\n    if n == 0:\n        return 0\n    return n + somme(n - 1)\n\n\nprint(somme(10))\n');
      await zpage.getByRole('button', { name: 'Exécuter' }).click();
      await expect(results).toContainText('55', { timeout: 150_000 });
    } finally {
      await zctx.close();
      await prisma.espaceWorkVersion.deleteMany({ where: { work: { studentId: ids.zoe } } });
      await prisma.espaceWork.deleteMany({ where: { studentId: ids.zoe } });
      await prisma.espaceEnrollment.deleteMany({ where: { userId: ids.zoe } });
      await prisma.user.deleteMany({ where: { id: ids.zoe } });
    }
  });
});

test.describe('espace enseignant — Récursivité', () => {
  test('le parcours est visible comme les autres, avec progression, code, tests et statut', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'prof');
    try {
      await page.goto('/espace/enseignant');
      const tabs = page.getByRole('navigation', { name: 'Choisir l’activité' });
      await expect(tabs.getByRole('link')).toHaveCount(11); // POO 1, Suites, POO 2, Récursivité, Fonctions/limites, Second degré, Entraînement évaluation NSI + 4 bilans de septembre (3e, 2nde, Tle maths, Tle NSI)
      await tabs.getByRole('link', { name: 'Récursivité et programmation récursive' }).click();
      await page.waitForURL(/activite=nsi-recursivite/);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Récursivité');

      const row = page.getByTestId('roster-row').filter({ hasText: `Alpha${run}` });
      await expect(row).toBeVisible();
      await expect(row).toContainText('À corriger');
      await row.getByRole('link').click();

      await page.waitForURL(/\/espace\/enseignant\/corriger\//);
      const viewer = page.getByTestId('work-viewer');
      await expect(viewer).toContainText('Elle finit si une variable progresse vers l’arrêt');
      // Code lisible (texte, jamais exécuté côté enseignant) et tests formatifs visibles.
      await expect(page.getByTestId('code-ecrire')).toContainText('return n + somme(n - 1)');
      await expect(page.getByTestId('tests-ecrire')).toContainText('10/10');
      await expect(page.getByTestId('code-decouverte')).toContainText('compte_a_rebours(n - 1)');
    } finally {
      await ctx.close();
    }
  });

  test('commentaire, annotation de compétence, puis « À reprendre » ; l’élève voit le retour', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'prof');
    try {
      await page.goto(`/espace/enseignant/corriger/${workId}`);
      await page.getByLabel('Commentaire', { exact: true }).fill(COMMENT);
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByTestId('annotation').filter({ hasText: COMMENT })).toBeVisible();

      // Compétence suivie : réutilise le champ de commentaire existant.
      await page.getByLabel('Compétence', { exact: true }).selectOption({ label: 'Identifier le cas de base' });
      await page.getByRole('button', { name: 'À consolider' }).first().click();
      await expect(page.getByLabel('Commentaire', { exact: true })).toHaveValue(/Compétence «\u00a0Identifier le cas de base\u00a0»\u00a0: à consolider\./);
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByTestId('annotation').filter({ hasText: 'à consolider' })).toBeVisible();

      await page.getByRole('button', { name: 'À reprendre' }).click();
      await expect.poll(async () => (await prisma.espaceWork.findUniqueOrThrow({ where: { id: workId } })).status, { timeout: 10_000 }).toBe('REOPENED');
      // L'enseignant ne modifie jamais le contenu de l'élève.
      const work = await prisma.espaceWork.findUniqueOrThrow({ where: { id: workId } });
      expect(JSON.stringify(work.content)).toContain('return n + somme(n - 1)');
    } finally {
      await ctx.close();
    }

    const student = await pageAs(browser, 'lea');
    try {
      await student.page.goto('/espace/nsi/recursivite');
      await expect(student.page.getByTestId('work-banner')).toContainText(/reprendre/i);
      await expect(student.page.getByTestId('annotation').filter({ hasText: COMMENT })).toBeVisible();
      await expect(student.page.getByTestId('code-editor')).toBeEditable();
    } finally {
      await student.ctx.close();
    }
  });
});

test.describe('non-régression — les parcours déjà en production', () => {
  for (const [name, url, h1] of [
    ['TP POO 1', '/espace/nsi/poo', 'Des objets qui agissent'],
    ['TP POO 2', '/espace/nsi/structures-lineaires', 'POO 2'],
    ['Maths — Suites', '/espace/maths/suites', ''],
    ['Maths — Fonctions et limites', '/espace/maths/fonctions-limites', 'limites'],
  ] as const) {
    test(`${name} reste accessible et fonctionnel`, async ({ browser }) => {
      const { ctx, page } = await pageAs(browser, 'lea');
      try {
        const res = await page.goto(url);
        expect(res?.status()).toBeLessThan(400);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        if (h1) await expect(page.getByRole('heading', { level: 1 })).toContainText(h1);
        await expect(page.getByText(/Une erreur est survenue|Application error/)).toHaveCount(0);
      } finally {
        await ctx.close();
      }
    });
  }

  test('TP POO 2 : autosave toujours opérationnel (réponse enregistrée puis restaurée)', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'lea');
    try {
      await page.goto('/espace/nsi/structures-lineaires');
      await page.getByRole('textbox').first().fill(`Réponse POO2 ${run}`);
      await expectSaved(page);
      await page.reload();
      await expect(page.getByRole('textbox').first()).toHaveValue(`Réponse POO2 ${run}`);
    } finally {
      await ctx.close();
    }
  });
});

test.describe('accessibilité et mobile', () => {
  test('parcours Récursivité : zéro violation axe, aucun débordement horizontal à 360 px', async ({ browser }) => {
    test.setTimeout(120_000);
    const { ctx, page } = await pageAs(browser, 'lea', { width: 360, height: 800 });
    try {
      await page.goto('/espace/nsi/recursivite');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      for (const step of ['diagnostic', 'pile-appels', 'synthese']) {
        const index = ['diagnostic', 'decouverte', 'cas-de-base', 'pile-appels', 'ecrire', 'structures', 'iteratif', 'mission', 'synthese', 'bonus'].indexOf(step);
        await page.getByLabel('Étape', { exact: true }).selectOption(String(index));
        await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.map((v) => `${step}: ${v.id} [${v.impact}] : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `débordement horizontal à l’étape ${step}`).toBeLessThanOrEqual(0);
      }
    } finally {
      await ctx.close();
    }
  });

  test('la fiche de synthèse est imprimable', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'lea');
    try {
      await page.goto('/espace/nsi/recursivite');
      await goToStep(page, /9\. Synthèse/);
      await expect(page.locator('#print-sheet')).toContainText('Une fonction récursive');
      await expect(page.locator('#print-sheet')).toContainText('Dernier appel créé = premier appel terminé');
      await expect(page.getByRole('button', { name: 'Imprimer la fiche' })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
