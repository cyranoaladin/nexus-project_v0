/**
 * Nexus Planning Studio — état partagé, verrou optimiste, lecture seule,
 * historique (vrais comptes seedés, vraie API, vrai middleware).
 *
 * Scénarios :
 *   1. ADMIN renomme M1 et enregistre → ASSISTANTE et COACH voient le nom.
 *   2. ADMIN et ASSISTANTE partent de la révision N ; ADMIN enregistre N+1 ;
 *      ASSISTANTE tente d'enregistrer N → 409, aucune perte.
 *   3. COACH : interface en lecture seule, PUT forgé refusé (403).
 *   4. ADMIN : historique visible, restauration crée une nouvelle révision.
 *   5. PARENT : API refusée (403).
 *
 * Pré-requis : voir planning-studio-access.spec.ts.
 */
import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { CREDS } from '../helpers/credentials';
import { loginAsUser, waitForAuthenticatedSession, type UserType } from '../helpers/auth';
import { sameOriginHeaders } from '../helpers/same-origin';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

/**
 * Connexion via le chemin canonique du depot plutot qu'une reimplementation
 * locale : `loginAsUser` remet a zero les quotas jetables, nettoie les cookies
 * d'une identite precedente et ATTEND que la session soit reellement etablie.
 * La version locale se contentait d'un 200/302 sur le callback, ce qui laissait
 * passer une session absente et produisait un 401 a la requete suivante.
 */
async function login(page: Page, role: UserType) {
  await loginAsUser(page, role, { navigate: false });
  await waitForAuthenticatedSession(page, CREDS[role].email);
}

async function api(page: Page): Promise<APIRequestContext> {
  return page.request;
}

async function getDoc(page: Page) {
  const res = await (await api(page)).get(`${BASE_URL}/api/planning-studio`);
  expect(res.status()).toBe(200);
  return (await res.json()) as { document: { revision: number }; payload: { teachers: Array<{ id: string; name: string }>; [k: string]: unknown }; permissions: Record<string, boolean> };
}

async function newContextPage(browser: Browser, role: UserType) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await login(page, role);
  return { context, page };
}

const STAMP = 'Alaeddine ' + Date.now().toString(36);

test.describe.configure({ mode: 'serial' });

test('1. état partagé : le nom enregistré par ADMIN est vu par ASSISTANTE et COACH', async ({ browser }) => {
  const admin = await newContextPage(browser, 'admin');
  const doc = await getDoc(admin.page);
  const payload = doc.payload;
  const m1 = payload.teachers.find((t) => t.id === 'teacher-m1')!;
  m1.name = STAMP;
  const put = await admin.page.request.put(`${BASE_URL}/api/planning-studio`, { headers: sameOriginHeaders(), data: { expectedRevision: doc.document.revision, payload } });
  expect(put.status(), await put.text()).toBe(200);
  const saved = (await put.json()) as { revision: number };
  expect(saved.revision).toBe(doc.document.revision + 1);

  for (const role of ['assistante', 'coach'] as UserType[]) {
    const other = await newContextPage(browser, role);
    const seen = await getDoc(other.page);
    expect(seen.document.revision).toBe(saved.revision);
    expect(seen.payload.teachers.find((t) => t.id === 'teacher-m1')!.name).toBe(STAMP);
    await other.page.goto('/planning');
    await expect(other.page.locator('.card').first()).toBeVisible();
    await expect(other.page.locator('#saveStatus')).toContainText('rév. ' + saved.revision);
    // La carte porte le CODE court de l'enseignant depuis le durcissement UI :
    // « Enseignant HGGSP / Histoire-Géo / EMC » y était tronqué. Le nom complet
    // reste exposé dans l'infobulle et l'aria-label, c'est donc là qu'on vérifie
    // la propagation — l'intention du test est inchangée.
    const cardsWithStamp = other.page.locator(`.card[title*="${STAMP}"]`);
    expect(await cardsWithStamp.count(), 'le nom enregistré est visible sur les cartes').toBeGreaterThan(0);
    expect(await other.page.locator(`.card[aria-label*="${STAMP}"]`).count()).toBeGreaterThan(0);
    await other.context.close();
  }
  await admin.context.close();
});

test('2. verrou optimiste : ASSISTANTE sur une révision périmée reçoit 409, rien n\'est perdu', async ({ browser }) => {
  const admin = await newContextPage(browser, 'admin');
  const assist = await newContextPage(browser, 'assistante');
  const adminDoc = await getDoc(admin.page);
  const assistDoc = await getDoc(assist.page);
  expect(assistDoc.document.revision).toBe(adminDoc.document.revision);
  const N = adminDoc.document.revision;

  const adminPayload = adminDoc.payload;
  adminPayload.teachers.find((t) => t.id === 'teacher-m2')!.name = 'Admin ' + N;
  const adminPut = await admin.page.request.put(`${BASE_URL}/api/planning-studio`, { headers: sameOriginHeaders(), data: { expectedRevision: N, payload: adminPayload } });
  expect(adminPut.status()).toBe(200);

  const assistPayload = assistDoc.payload;
  assistPayload.teachers.find((t) => t.id === 'teacher-f1')!.name = 'Assistante ' + N;
  const assistPut = await assist.page.request.put(`${BASE_URL}/api/planning-studio`, { headers: sameOriginHeaders(), data: { expectedRevision: N, payload: assistPayload } });
  expect(assistPut.status()).toBe(409);
  const conflict = (await assistPut.json()) as { error: string; currentRevision: number; message: string };
  expect(conflict.error).toBe('PLANNING_REVISION_CONFLICT');
  expect(conflict.currentRevision).toBe(N + 1);
  expect(conflict.message).toMatch(/modifié par un autre utilisateur/);

  const after = await getDoc(assist.page);
  expect(after.document.revision).toBe(N + 1);
  expect(after.payload.teachers.find((t) => t.id === 'teacher-m2')!.name).toBe('Admin ' + N);
  expect(after.payload.teachers.find((t) => t.id === 'teacher-f1')!.name).not.toBe('Assistante ' + N);

  // Dans l'interface : l'assistante qui rejoue son enregistrement voit le conflit
  await assist.page.goto('/planning');
  await expect(assist.page.locator('.card').first()).toBeVisible();
  await assist.page.evaluate((n) => {
    const app = (window as unknown as { Nexus: { app: { state: { revision: number } } } }).Nexus.app;
    app.state.revision = n; // simule un écran resté sur l'ancienne révision
  }, N);
  await assist.page.click('.card[data-id="SAT-0900-P1-F"]');
  await assist.page.fill('#sess-title', 'Modification tardive');
  await assist.page.click('#btnApply');
  await expect(assist.page.locator('.modal', { hasText: 'Conflit de version' })).toBeVisible({ timeout: 15000 });
  await expect(assist.page.locator('#saveStatus')).toContainText('Conflit de version');
  await admin.context.close();
  await assist.context.close();
});

test('3. COACH : lecture seule dans l\'interface et refus serveur en écriture', async ({ browser }) => {
  const coach = await newContextPage(browser, 'coach');
  const doc = await getDoc(coach.page);
  expect(doc.permissions.canEdit).toBe(false);
  const put = await coach.page.request.put(`${BASE_URL}/api/planning-studio`, { headers: sameOriginHeaders(), data: { expectedRevision: doc.document.revision, payload: doc.payload } });
  expect(put.status()).toBe(403);
  expect((await coach.page.request.get(`${BASE_URL}/api/planning-studio/revisions`)).status()).toBe(403);
  expect((await coach.page.request.post(`${BASE_URL}/api/planning-studio/restore`, { headers: sameOriginHeaders(), data: { revision: 1, expectedRevision: doc.document.revision } })).status()).toBe(403);

  await coach.page.goto('/planning');
  await expect(coach.page.locator('.card').first()).toBeVisible();
  await expect(coach.page.locator('#saveStatus')).toContainText('Lecture seule');
  await expect(coach.page.locator('#btnNewSession')).toBeHidden();
  // Menu ouvert, aucune affordance d'ecriture ne doit apparaitre pour le Coach.
  await coach.page.click('#btnMore');
  await expect(coach.page.locator('#btnImport')).toBeHidden();
  await expect(coach.page.locator('#btnReset')).toBeHidden();
  await coach.page.keyboard.press('Escape');
  await expect(coach.page.locator('#btnSave')).toBeHidden();
  await coach.page.click('.card[data-id="SAT-0900-P1-F"]');
  await expect(coach.page.locator('#sideBody .readonly-card')).toBeVisible();
  await expect(coach.page.locator('#btnApply')).toHaveCount(0);
  // Aucune mutation possible même par l'API interne de l'application
  const blocked = await coach.page.evaluate(() => {
    const app = (window as unknown as { Nexus: { app: { commit: (l: string, f: () => void) => boolean } } }).Nexus.app;
    return app.commit('tentative', () => {});
  });
  expect(blocked).toBe(false);
  // Filtres, vues et export restent utilisables
  await coach.page.click('#viewSwitch button[data-view="teacher"]');
  await expect(coach.page.locator('#teacherBanner')).toBeVisible();
  await coach.context.close();
});

test('4. ADMIN : historique et restauration créent une nouvelle révision', async ({ browser }) => {
  const admin = await newContextPage(browser, 'admin');
  const list = await admin.page.request.get(`${BASE_URL}/api/planning-studio/revisions?limit=10`);
  expect(list.status()).toBe(200);
  const { revisions } = (await list.json()) as { revisions: Array<{ revision: number; action: string; summary: string | null; createdBy: { name: string } | null }> };
  expect(revisions.length).toBeGreaterThanOrEqual(3);
  // L'historique est pagine : exiger la revision INIT dans la page courante
  // rendait le test dependant du nombre de revisions accumulees, donc instable
  // des que le document vit un peu. On verifie ce qui est vrai en permanence :
  // la page est ordonnee du plus recent au plus ancien, ses numeros sont
  // contigus, et chaque revision est attribuee a un acteur.
  const numbers = revisions.map((r) => r.revision);
  expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
  for (let i = 1; i < numbers.length; i += 1) {
    expect(numbers[i - 1] - numbers[i], 'numeros de revision contigus').toBe(1);
  }
  expect(revisions[0].createdBy).not.toBeNull();
  // La revision 1 est l'initialisation, quelle que soit la page consultee.
  const first = await admin.page.request.get(`${BASE_URL}/api/planning-studio/revisions/1`);
  expect(first.status()).toBe(200);
  expect(((await first.json()) as { revision: number; action: string }).action).toBe('INIT');

  const current = await getDoc(admin.page);
  const restore = await admin.page.request.post(`${BASE_URL}/api/planning-studio/restore`, { headers: sameOriginHeaders(), data: { revision: 1, expectedRevision: current.document.revision } });
  expect(restore.status(), await restore.text()).toBe(200);
  const restored = (await restore.json()) as { revision: number };
  expect(restored.revision).toBe(current.document.revision + 1);
  const after = await getDoc(admin.page);
  expect(after.payload.teachers.find((t) => t.id === 'teacher-m1')!.name).not.toBe(STAMP);

  // Historique dans l'interface
  await admin.page.goto('/planning');
  await expect(admin.page.locator('.card').first()).toBeVisible();
  // Les actions secondaires vivent desormais dans le menu « ... » : elles ne
  // sont plus rognees par un defilement horizontal, mais il faut l'ouvrir.
  await admin.page.click('#btnMore');
  await admin.page.click('#btnSettings');
  await admin.page.locator('.modal-tabs button', { hasText: 'Historique' }).click();
  await expect(admin.page.locator('.history-item').first()).toBeVisible();
  await expect(admin.page.locator('.history-item.current')).toContainText('rév. ' + restored.revision);
  await expect(admin.page.locator('.history-item .action-tag.RESTORE').first()).toBeVisible();
  await admin.context.close();
});

test('5. PARENT et anonyme : API refusée', async ({ browser }) => {
  const parent = await newContextPage(browser, 'parent');
  expect((await parent.page.request.get(`${BASE_URL}/api/planning-studio`)).status()).toBe(403);
  expect((await parent.page.request.put(`${BASE_URL}/api/planning-studio`, { headers: sameOriginHeaders(), data: { expectedRevision: 1, payload: {} } })).status()).toBe(403);
  await parent.context.close();
  const anon = await browser.newContext({ baseURL: BASE_URL });
  const res = await anon.request.get(`${BASE_URL}/api/planning-studio`);
  expect(res.status()).toBe(401);
  await anon.close();
});

test('6. autosave dans l\'interface : une modification ADMIN crée une révision serveur', async ({ browser }) => {
  const admin = await newContextPage(browser, 'admin');
  const before = await getDoc(admin.page);
  await admin.page.goto('/planning');
  await expect(admin.page.locator('.card').first()).toBeVisible();
  await expect(admin.page.locator('#saveStatus')).toContainText('Enregistré');
  await admin.page.click('.card[data-id="SUN-1115-T-SVT"]');
  await admin.page.fill('#sess-notes', 'Note autosave ' + STAMP);
  await admin.page.click('#btnApply');
  await expect(admin.page.locator('#saveStatus')).toContainText('rév. ' + (before.document.revision + 1), { timeout: 15000 });
  const after = await getDoc(admin.page);
  expect(after.document.revision).toBe(before.document.revision + 1);
  const session = (after.payload.sessions as Array<{ id: string; notes: string }>).find((s) => s.id === 'SUN-1115-T-SVT')!;
  expect(session.notes).toBe('Note autosave ' + STAMP);
  await admin.context.close();
});
