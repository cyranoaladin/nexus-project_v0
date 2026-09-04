/**
 * Planning Studio — les règles Nexus tiennent face à une requête forgée.
 *
 * L'interface n'est pas la frontière de sécurité : le serveur l'est. Ces
 * scénarios contournent délibérément l'UI et écrivent directement sur l'API,
 * avec un compte pleinement autorisé. Ils vérifient les deux sens :
 *   - une violation de politique est refusée, même par un ADMIN ;
 *   - une configuration légitime n'est PAS refusée, pour que les nouvelles
 *     portes ne soient ni trop strictes ni trop laxistes.
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

const API = '/api/planning-studio';

interface PlanningDocument {
  document: { revision: number };
  payload: Record<string, unknown>;
}

async function readPlanning(request: APIRequestContext): Promise<PlanningDocument> {
  const res = await request.get(API);
  expect(res.status(), 'lecture du planning partagé').toBe(200);
  return (await res.json()) as PlanningDocument;
}

/** Écrit une charge utile et renvoie le statut + le corps, sans lever. */
async function save(request: APIRequestContext, expectedRevision: number, payload: unknown) {
  const res = await request.put(API, {
    data: { expectedRevision, payload, action: 'SAVE', summary: 'test e2e politique' },
    failOnStatusCode: false,
  });
  let body: Record<string, unknown> = {};
  try { body = (await res.json()) as Record<string, unknown>; } catch { /* corps non JSON */ }
  return { status: res.status(), body };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test.describe('Planning Studio — politique non contournable par l’API', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await loginAsUser(page, 'admin');
  });

  test('un ADMIN ne peut pas s’accorder une capacité plus large', async () => {
    const { document, payload } = await readPlanning(page.request);
    const forged = clone(payload) as { settings: Record<string, unknown> };
    forged.settings.normalSimultaneous = 3;

    const { status, body } = await save(page.request, document.revision, forged);

    expect(status, 'la capacité est une règle de direction, pas une donnée du planning').toBe(422);
    expect(JSON.stringify(body)).toContain('CAPACITY_POLICY_TAMPERING');
  });

  test('un ADMIN ne peut pas relever le maximum de cours simultanés', async () => {
    const { document, payload } = await readPlanning(page.request);
    const forged = clone(payload) as { settings: Record<string, unknown> };
    forged.settings.maxSimultaneous = 4;

    const { status, body } = await save(page.request, document.revision, forged);
    expect(status).toBe(422);
    expect(JSON.stringify(body)).toContain('CAPACITY_POLICY_TAMPERING');
  });

  test('trois salles normales actives sont refusées', async () => {
    const { document, payload } = await readPlanning(page.request);
    const forged = clone(payload) as { rooms: Array<{ exceptional: boolean }> };
    forged.rooms.forEach((room) => { room.exceptional = false; });

    const { status, body } = await save(page.request, document.revision, forged);
    expect(status).toBe(422);
    expect(JSON.stringify(body)).toContain('NORMAL_ROOM_POLICY_VIOLATION');
  });

  test('supprimer une prestation hebdomadaire obligatoire est refusé', async () => {
    const { document, payload } = await readPlanning(page.request);
    const forged = clone(payload) as { sessions: Array<{ subjectId: string; audience: string }> };
    // Philosophie Terminale CL : cours récurrent de l'offre Nexus.
    forged.sessions = forged.sessions.filter((s) => !(s.subjectId === 'PHILO' && s.audience === 'CL'));

    const { status, body } = await save(page.request, document.revision, forged);
    expect(status).toBe(422);
    expect(JSON.stringify(body)).toContain('REQUIRED_COVERAGE_MISSING');
  });

  test('l’absence de séance hebdomadaire Grand Oral est ACCEPTÉE', async () => {
    // Contre-épreuve indispensable : le Grand Oral est une enveloppe annuelle
    // (4 séances de 2 h, data/pricing.canonical.json). Exiger un cours
    // hebdomadaire inventerait une fréquence que l'offre ne prévoit pas — la
    // porte serait alors trop stricte.
    const { document, payload } = await readPlanning(page.request);
    const forged = clone(payload) as { sessions: Array<{ subjectId: string }> };
    const before = forged.sessions.length;
    forged.sessions = forged.sessions.filter((s) => s.subjectId !== 'GRAND_ORAL');

    const { status, body } = await save(page.request, document.revision, forged);

    expect(status, `retrait de ${before - forged.sessions.length} séance(s) Grand Oral`).toBe(200);
    expect(JSON.stringify(body)).not.toContain('REQUIRED_COVERAGE_MISSING');
  });

  test('une séance dupliquée ne peut pas être enregistrée', async () => {
    const { document, payload } = await readPlanning(page.request);
    const forged = clone(payload) as { sessions: Array<Record<string, unknown>> };
    forged.sessions.push({ ...forged.sessions[0] });

    const { status } = await save(page.request, document.revision, forged);
    expect(status).toBe(422);
  });

  test('une référence orpheline ne peut pas être enregistrée', async () => {
    const { document, payload } = await readPlanning(page.request);
    const forged = clone(payload) as { sessions: Array<{ teacherId: string }> };
    forged.sessions[0].teacherId = 'teacher-inexistant';

    const { status, body } = await save(page.request, document.revision, forged);
    expect(status).toBe(422);
    expect(JSON.stringify(body)).toContain('MISSING_TEACHER');
  });

  test('une configuration légitime reste enregistrable', async () => {
    // Sans cette contre-épreuve, une porte cassée qui refuse tout passerait
    // pour une porte parfaitement stricte.
    const { document, payload } = await readPlanning(page.request);
    const valid = clone(payload) as { meta: Record<string, unknown> };
    valid.meta.title = `Planning Nexus — vérification e2e ${Date.now()}`;

    const { status } = await save(page.request, document.revision, valid);
    expect(status).toBe(200);
  });
});

test.describe('Planning Studio — matrice API par rôle', () => {
  test('anonyme : lecture et écriture refusées', async ({ request }) => {
    expect((await request.get(API, { failOnStatusCode: false })).status()).toBe(401);
    const put = await request.put(API, { data: { expectedRevision: 0, payload: {} }, failOnStatusCode: false });
    expect(put.status()).toBe(401);
  });

  for (const role of ['parent', 'student'] as const) {
    test(`${role} : API refusée en lecture comme en écriture`, async ({ page }) => {
      await loginAsUser(page, role);
      expect((await page.request.get(API, { failOnStatusCode: false })).status()).toBe(403);
      const put = await page.request.put(API, { data: { expectedRevision: 0, payload: {} }, failOnStatusCode: false });
      expect(put.status()).toBe(403);
    });
  }

  test('COACH : lecture autorisée, écriture refusée', async ({ page }) => {
    await loginAsUser(page, 'coach');
    const { document, payload } = await readPlanning(page.request);
    const { status } = await save(page.request, document.revision, payload);
    expect(status, 'le Coach consulte, il n’écrit pas').toBe(403);
  });

  for (const role of ['admin', 'assistante'] as const) {
    test(`${role} : lecture et écriture autorisées`, async ({ page }) => {
      await loginAsUser(page, role);
      const { document, payload } = await readPlanning(page.request);
      const next = clone(payload) as { meta: Record<string, unknown> };
      next.meta.title = `Planning Nexus — ${role} ${Date.now()}`;
      const { status } = await save(page.request, document.revision, next);
      expect(status).toBe(200);
    });
  }
});
