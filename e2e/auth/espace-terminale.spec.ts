/**
 * Espace pédagogique Terminale — parcours complets dans un vrai navigateur, contre
 * la pile jetable (vraie base, vraie authentification, vrai rate-limit).
 *
 *   élève NSI      : connexion → tableau de bord → TP → autosave → rafraîchissement → remise
 *   enseignant     : suivi → relecture → commentaire → « À reprendre »
 *   retour élève   : reconnexion → retour visible → travail rouvert
 *   isolation      : un second élève ne voit rien du premier ; un élève ne voit pas l'espace enseignant
 *   a11y / mobile  : zéro violation axe, aucun débordement horizontal à 360 px
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

import { getPooContent, POO_ACTIVITY_SLUG } from '../../lib/espace/catalog';
import { applyProvisioning, parseRoster, syncActivities } from '../../lib/espace/provisioning';
import { assertDisposableE2eDatabase } from '../helpers/disposable-database';

// Aucune valeur par défaut avec identifiants : la pile jetable fournit l'URL (fail-closed sinon).
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL?.includes('nexus_e2e') ? process.env.DATABASE_URL : undefined);

const run = Math.random().toString(36).slice(2, 8);
const u = (n: string) => `e${n}.${run}`.slice(0, 32);
const poo = getPooContent();
const step0 = poo.steps[0];
const step1 = poo.steps[1];
const FIRST_FIELD = step0.fields[0];
const ANSWER = `Réponse E2E ${run}`;
const COMMENT = `Revois la différence entre alias et nouvel objet (${run}).`;

type Who = 'ada' | 'bob' | 'prof';
type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

let prisma: PrismaClient;
const secrets: Record<string, string> = {};
const ids: Record<string, string> = {};
const states: Partial<Record<Who, StorageState>> = {};
let workId = '';
let sessionId = '';

async function login(page: Page, username: string, secret: string) {
  await page.goto('/espace/connexion');
  await page.getByTestId('input-username').fill(username);
  await page.getByTestId('input-secret').fill(secret);
  await page.getByTestId('btn-connexion').click();
}

/**
 * Une seule connexion par utilisateur (le limiteur autorise 5 essais / 15 min par identifiant et reste
 * actif) ; les tests réutilisent ensuite l'état de session obtenu par le vrai formulaire de connexion.
 */
async function pageAs(browser: Browser, who: Who, viewport?: { width: number; height: number }) {
  if (!states[who]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await login(p, u(who), secrets[u(who)]);
    await p.waitForURL(/\/espace\/(eleve|enseignant)/);
    states[who] = await ctx.storageState();
    await ctx.close();
  }
  const ctx = await browser.newContext({ storageState: states[who], viewport });
  return { ctx, page: await ctx.newPage() };
}

/** Résumé lisible d'une analyse axe : « règle : cible | cible ». Vide = aucune violation. */
async function axeViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.map((v) => `${v.id} [${v.impact}] : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

async function expectSaved(page: Page) {
  const indicator = page.getByTestId('save-indicator');
  await expect(indicator).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
  await expect(indicator).toContainText(/Enregistré|Tout est enregistré/);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  if (!DATABASE_URL) throw new Error('E2E_DATABASE_URL (pile jetable nexus_e2e) est requis');
  assertDisposableE2eDatabase(DATABASE_URL);
  prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  await syncActivities(prisma);

  const roster = parseRoster({
    groups: [{ slug: `e2e-${run}`, name: `E2E ${run}` }],
    teachers: [
      { username: u('prof'), firstName: 'Prof', lastName: `E2E${run}`, teaches: [{ group: `e2e-${run}`, subjects: ['NSI', 'MATHS'] }] },
    ],
    students: [
      { username: u('ada'), firstName: 'Ada', lastName: `Alpha${run}`, enrollments: [{ group: `e2e-${run}`, subjects: ['NSI', 'MATHS'] }] },
      { username: u('bob'), firstName: 'Bob', lastName: `Beta${run}`, enrollments: [{ group: `e2e-${run}`, subjects: ['MATHS'] }] },
    ],
  });
  const { credentials } = await applyProvisioning(prisma, roster, { adopt: false });
  for (const c of credentials) secrets[c.username] = c.secret;
  for (const name of ['prof', 'ada', 'bob'] as const) {
    ids[name] = (await prisma.user.findUniqueOrThrow({ where: { username: u(name) } })).id;
  }

  // Séance publiée par l'enseignant : « À faire maintenant » apparaît chez Ada. (Écrite directement avec le
  // client du test : le fixture ne dépend pas du client Prisma global de l'application.)
  const group = await prisma.espaceGroup.findUniqueOrThrow({ where: { slug: `e2e-${run}` } });
  const activity = await prisma.espaceActivity.findUniqueOrThrow({ where: { slug: POO_ACTIVITY_SLUG } });
  const nsi = await prisma.espaceEnrollment.findMany({ where: { groupId: group.id, subject: 'NSI' }, select: { userId: true } });
  const created = await prisma.espaceSession.create({
    data: {
      groupId: group.id,
      subject: 'NSI',
      activityId: activity.id,
      teacherId: ids.prof,
      title: 'TP POO',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      participants: { create: nsi.map((e) => ({ userId: e.userId })) },
    },
  });
  sessionId = created.id;
});

test.afterAll(async () => {
  const students = [ids.ada, ids.bob];
  await prisma.espaceAnnotation.deleteMany({ where: { work: { studentId: { in: students } } } });
  await prisma.espaceWorkVersion.deleteMany({ where: { work: { studentId: { in: students } } } });
  await prisma.espaceWork.deleteMany({ where: { studentId: { in: students } } });
  await prisma.espaceSession.deleteMany({ where: { teacherId: ids.prof } });
  await prisma.espaceEnrollment.deleteMany({ where: { userId: { in: students } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { teacherId: ids.prof } });
  await prisma.espaceGroup.deleteMany({ where: { slug: `e2e-${run}` } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.prof, ...students] } } });
  await prisma.$disconnect();
});

test.describe('connexion', () => {
  test('un mauvais code est refusé avec un message sobre, le bon code ouvre le tableau de bord', async ({ page }) => {
    await login(page, u('ada'), 'ZZZZ9999');
    await expect(page.getByTestId('connexion-erreur')).toContainText('Identifiant ou code incorrect');
    await expect(page).toHaveURL(/\/espace\/connexion/);

    await page.getByTestId('input-secret').fill(secrets[u('ada')].toLowerCase()); // casse indifférente
    await page.getByTestId('btn-connexion').click();
    await page.waitForURL('**/espace/eleve');
    await expect(page.getByTestId('bonjour')).toContainText('Bonjour Ada');
  });

  test('un visiteur anonyme est renvoyé vers la connexion, sans fuite de contenu', async ({ page }) => {
    await page.goto('/espace/eleve');
    await expect(page).toHaveURL(/\/espace\/connexion\?callbackUrl=/);
    const api = await page.request.get('/api/espace/works/quelconque');
    expect(api.status()).toBe(401);
  });
});

test.describe('parcours élève NSI', () => {
  test('tableau de bord → TP → autosave → rafraîchissement → remise', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'ada');
    try {
      await page.goto('/espace/eleve');
      await expect(page.getByTestId('bonjour')).toContainText('Bonjour Ada');

      // « À faire maintenant » vient de la séance publiée ; seules les matières inscrites apparaissent.
      const next = page.getByTestId('a-faire-maintenant');
      await expect(next).toContainText('Des objets qui agissent');
      await expect(next).toContainText(/Étape \d+ sur 7/);
      await expect(page.getByTestId('matiere')).toHaveCount(2); // NSI + Mathématiques
      await next.getByRole('link').first().click();

      await page.waitForURL(/\/espace\/nsi\/poo/);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Des objets qui agissent');
      // Aucun reste du workflow historique.
      await expect(page.getByText(/code de séance|exporter|importer|JSON/i)).toHaveCount(0);

      // Autosave : la saisie est enregistrée côté serveur, indicateur véridique.
      await page.getByLabel(FIRST_FIELD.label).fill(ANSWER);
      await expectSaved(page);

      const work = await prisma.espaceWork.findFirstOrThrow({ where: { studentId: ids.ada } });
      workId = work.id;
      expect(work.status).toBe('IN_PROGRESS');
      expect(JSON.stringify(work.content)).toContain(ANSWER);

      // Reprise après rafraîchissement : la réponse est restaurée.
      await page.reload();
      await expect(page.getByLabel(FIRST_FIELD.label)).toHaveValue(ANSWER);

      // Changement d'étape, saisie de code, puis remise volontaire.
      await page.getByRole('button', { name: 'Étape suivante' }).click();
      await page.locator('#editeur-code').fill(`${step1.starter ?? ''}\n# modifié par ${run}`);
      await expectSaved(page);

      await page.getByTestId('btn-remettre').click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Remettre', exact: true }).click();
      await expect(page.getByTestId('work-banner')).toContainText(/remis/i, { timeout: 15_000 });

      const after = await prisma.espaceWork.findUniqueOrThrow({ where: { id: workId } });
      expect(after.status).toBe('SUBMITTED');
      expect(after.submittedAt).not.toBeNull();
      // Lecture seule après remise (champs en `readonly` : le texte reste lisible et focalisable).
      await expect(page.locator('#editeur-code')).not.toBeEditable();
      await expect(page.getByLabel(step1.fields[0].label)).not.toBeEditable(); // champ de l'étape affichée
    } finally {
      await ctx.close();
    }
  });
});

test.describe('parcours enseignant', () => {
  test('suivi de la classe → travail remis → commentaire → « À reprendre »', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'prof');
    try {
      await page.goto('/espace/enseignant');
      const row = page.getByTestId('roster-row').filter({ hasText: `Alpha${run}` });
      await expect(row).toBeVisible();
      await expect(row).toContainText('À corriger');
      await row.getByRole('link').click();

      await page.waitForURL(/\/espace\/enseignant\/corriger\//);
      await expect(page.getByTestId('work-viewer')).toContainText(ANSWER);

      await page.getByLabel('Commentaire', { exact: true }).fill(COMMENT);
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByTestId('annotation').filter({ hasText: COMMENT })).toBeVisible();

      await page.getByRole('button', { name: 'À reprendre' }).click();
      await expect
        .poll(async () => (await prisma.espaceWork.findUniqueOrThrow({ where: { id: workId } })).status, { timeout: 10_000 })
        .toBe('REOPENED');

      // L'enseignant ne modifie jamais le contenu de l'élève.
      const work = await prisma.espaceWork.findUniqueOrThrow({ where: { id: workId } });
      expect(JSON.stringify(work.content)).toContain(ANSWER);
    } finally {
      await ctx.close();
    }
  });

  test('élèves, séances et archives POO sont accessibles à l’enseignant', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'prof');
    try {
      await page.goto('/espace/enseignant/eleves');
      await expect(page.getByTestId('student-row').filter({ hasText: `Alpha${run}` })).toBeVisible();
      await page.goto('/espace/enseignant/seances');
      await expect(page.getByTestId('session-row').first()).toContainText('TP POO');
      await page.goto('/espace/enseignant/archives-poo');
      await expect(page.getByTestId('archives-empty')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});

test.describe('retour élève', () => {
  test('le retour de l’enseignant est visible et le travail est rouvert', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'ada');
    try {
      await page.goto(`/espace/nsi/poo?seance=${sessionId}`);
      await expect(page.getByTestId('work-banner')).toContainText(/reprendre/i);
      await expect(page.getByTestId('annotation').filter({ hasText: COMMENT })).toBeVisible();

      // Édition de nouveau possible, et enregistrée.
      // Elle reprend là où elle s'était arrêtée (étape 2) : on édite le champ de l'étape affichée.
      const field = page.getByLabel(step1.fields[0].label);
      await expect(field).toBeEnabled();
      await field.fill(`${ANSWER} — reprise`);
      await expectSaved(page);
      const work = await prisma.espaceWork.findUniqueOrThrow({ where: { id: workId } });
      expect(work.status).toBe('REOPENED');
      expect(JSON.stringify(work.content)).toContain('— reprise');
    } finally {
      await ctx.close();
    }
  });
});

test.describe('hors connexion et plusieurs onglets', () => {
  test('hors connexion : l’indicateur le dit, le travail reste sur l’appareil, la synchronisation reprend au retour du réseau', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'ada');
    try {
      await page.goto(`/espace/nsi/poo?seance=${sessionId}`);
      const field = page.getByLabel(step1.fields[0].label);
      await expect(field).toBeEnabled();
      const OFFLINE = `Saisie hors connexion ${run}`;

      await ctx.setOffline(true);
      await field.fill(OFFLINE);
      const indicator = page.getByTestId('save-indicator');
      await expect(indicator).toHaveAttribute('data-state', /offline|error/, { timeout: 15_000 });
      await expect(indicator).not.toContainText('✓'); // jamais « enregistré » sans accusé du serveur
      await expect(field).toHaveValue(OFFLINE); // la saisie n'est pas perdue à l'écran
      const during = await prisma.espaceWork.findUniqueOrThrow({ where: { id: workId } });
      expect(JSON.stringify(during.content)).not.toContain(OFFLINE); // et rien n'est encore côté serveur

      await ctx.setOffline(false);
      await expectSaved(page);
      const after = await prisma.espaceWork.findUniqueOrThrow({ where: { id: workId } });
      expect(JSON.stringify(after.content)).toContain(OFFLINE);
    } finally {
      await ctx.close();
    }
  });

  test('deux onglets : une modification concurrente de la même étape ne s’écrase jamais en silence', async ({ browser }) => {
    const { ctx, page: tabA } = await pageAs(browser, 'ada');
    try {
      const tabB = await ctx.newPage();
      const url = `/espace/nsi/poo?seance=${sessionId}`;
      await tabA.goto(url);
      await tabB.goto(url);
      const fieldA = tabA.getByLabel(step1.fields[0].label);
      const fieldB = tabB.getByLabel(step1.fields[0].label);
      await expect(fieldA).toBeEnabled();
      await expect(fieldB).toBeEnabled();
      const VALUE_A = `Onglet A ${run}`;
      const VALUE_B = `Onglet B ${run}`;

      await fieldA.fill(VALUE_A);
      await expectSaved(tabA);

      await fieldB.fill(VALUE_B); // l'onglet B est périmé : il ignore la sauvegarde de A
      await expect(tabB.getByRole('alertdialog')).toBeVisible({ timeout: 15_000 });
      const kept = await prisma.espaceWork.findUniqueOrThrow({ where: { id: workId } });
      expect(JSON.stringify(kept.content)).toContain(VALUE_A); // la version de A n'a pas été écrasée
      expect(JSON.stringify(kept.content)).not.toContain(VALUE_B);

      await tabB.getByRole('button', { name: 'Garder ma version' }).click(); // choix explicite de l'élève
      await expect
        .poll(async () => JSON.stringify((await prisma.espaceWork.findUniqueOrThrow({ where: { id: workId } })).content), { timeout: 15_000 })
        .toContain(VALUE_B);
      await expectSaved(tabB);
    } finally {
      await ctx.close();
    }
  });
});

test.describe('isolation', () => {
  test('un second élève ne peut accéder ni au travail ni à l’espace enseignant', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'bob');
    try {
      await page.goto('/espace/eleve');
      // Accès direct à l'API par identifiant : 404 indiscernable d'un identifiant inexistant.
      const stolen = await page.request.get(`/api/espace/works/${workId}`);
      const missing = await page.request.get('/api/espace/works/cl-inexistant');
      expect(stolen.status()).toBe(404);
      expect(await stolen.json()).toEqual(await missing.json());
      expect((await page.request.get(`/api/espace/works/${workId}/annotations`)).status()).toBe(404);
      expect((await page.request.get(`/api/espace/teacher/export?workId=${workId}`)).status()).toBe(403);

      // Les pages enseignant ramènent à l'espace élève, sans rien afficher.
      await page.goto(`/espace/enseignant/corriger/${workId}`);
      await expect(page).toHaveURL(/\/espace\/eleve$/);
      await expect(page.getByTestId('work-viewer')).toHaveCount(0);

      // Bob n'est pas inscrit en NSI : le TP lui est refusé proprement.
      await page.goto('/espace/nsi/poo');
      await expect(page.getByText(ANSWER)).toHaveCount(0);
      await expect(page.getByTestId('code-editor')).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});

test.describe('accessibilité et mobile', () => {
  test('connexion : zéro violation axe et aucun débordement horizontal à 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/espace/connexion');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('tableau de bord élève et TP : zéro violation axe, pas de débordement à 360 px', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'ada', { width: 360, height: 740 });
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (const route of ['/espace/eleve', '/espace/eleve/travaux', `/espace/nsi/poo?seance=${sessionId}`]) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${route} déborde`).toBe(false);
        expect(await axeViolations(page), route).toEqual([]);
      }
    } finally {
      await ctx.close();
    }
  });

  test('espace enseignant : zéro violation axe', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'prof');
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (const route of ['/espace/enseignant', '/espace/enseignant/eleves', '/espace/enseignant/seances', `/espace/enseignant/corriger/${workId}`]) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        expect(await axeViolations(page), route).toEqual([]);
      }
    } finally {
      await ctx.close();
    }
  });
});

test.describe('déconnexion', () => {
  test('revient à la connexion et ferme l’accès', async ({ browser }) => {
    const { ctx, page } = await pageAs(browser, 'bob');
    try {
      await page.goto('/espace/eleve');
      await page.getByRole('button', { name: 'Se déconnecter' }).click();
      await page.waitForURL('**/espace/connexion');
      await page.goto('/espace/eleve');
      await expect(page).toHaveURL(/\/espace\/connexion/);
    } finally {
      await ctx.close();
    }
  });
});

test.describe('moteur Python (réseau requis)', () => {
  test('« Vérifier mon code » exécute le harnais dans le navigateur', async ({ browser, request }) => {
    test.setTimeout(180_000);
    const reachable = await request.get('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs', { timeout: 10_000 }).then((r) => r.ok(), () => false);
    expect(reachable, 'cdn.jsdelivr.net doit être joignable : le moteur Python (Pyodide) est exercé pour de vrai').toBe(true);

    // Ada a rouvert son travail (REOPENED) : l'éditeur est actif.
    const { ctx, page } = await pageAs(browser, 'ada');
    try {
      await page.goto(`/espace/nsi/poo?seance=${sessionId}`);
      await page.getByRole('button', { name: 'Vérifier mon code' }).click();
      await expect(page.getByTestId('run-results')).toContainText('Attributs d’instance', { timeout: 150_000 });
    } finally {
      await ctx.close();
    }
  });
});
