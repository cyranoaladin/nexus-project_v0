/**
 * Core v2 golden STAFF workflow (go-live §AT, staff subset) on the disposable
 * stack, through the real UI and the real /api/v2 surface:
 *
 *   assistante: Familles → create family (duplicate gate) → student →
 *   academic year (API) → enrollment → approve → courses → coach capability
 *   (API) → coach assignment → weekly planning series → invite parent →
 *   activation mail captured by Mailpit → public activation → replay refused
 *   → ADMIN-only operations DENIED for the assistante → ADMIN reads the audit
 *   trail and suspends the account.
 *
 * Parent/student LOGIN on Core v2 credentials is deliberately out of scope
 * until the auth cutover (§U/§V): the invitation → activation contract is
 * proven here at the API level.
 */
import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { sameOriginHeaders } from '../helpers/same-origin';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3002';
const MAILPIT_API_URL = process.env.MAILPIT_API_URL ?? '';
const nonce = Date.now();
const parentEmail = `corev2-parent-${nonce}@example.test`;
const startYear = 2050 + (nonce % 40);

let householdId = '';
let parentUserId = '';
let enrollmentId = '';
let rawToken = '';

async function findActivationToken(): Promise<string> {
  test.skip(!MAILPIT_API_URL, 'MAILPIT_API_URL is required to capture the invitation e-mail');
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const search = await fetch(`${MAILPIT_API_URL}/api/v1/search?query=${encodeURIComponent(`to:${parentEmail}`)}`);
    const { messages = [] } = (await search.json()) as { messages?: Array<{ ID: string }> };
    for (const message of messages) {
      const detail = await fetch(`${MAILPIT_API_URL}/api/v1/message/${message.ID}`);
      const body = (await detail.json()) as { Text?: string; HTML?: string };
      const match = /purpose=core-v2&(?:amp;)?token=([A-Za-z0-9_-]{40,})/.exec(`${body.Text ?? ''}\n${body.HTML ?? ''}`);
      if (match) return match[1]!;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`CORE_V2_INVITATION_MAIL_NOT_RECEIVED:${parentEmail}`);
}

test('golden staff workflow on Core v2: family → enrollment → coach → planning → invitation → activation → RBAC', async ({ page }) => {
  await test.step('assistante opens Familles', async () => {
    await loginAsUser(page, 'assistante', { navigate: false });
    await page.goto('/dashboard/assistante/familles', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Familles' })).toBeVisible();
  });

  await test.step('a CURRENT academic year exists (staff API)', async () => {
    const created = await page.request.post(`${BASE_URL}/api/v2/staff/academic-years`, {
      headers: sameOriginHeaders(),
      data: { startYear, startsAt: `${startYear}-09-01`, endsAt: `${startYear + 1}-07-15` },
    });
    expect(created.status(), await created.text()).toBe(201);
    const year = (await created.json()) as { data: { id: string } };
    const promoted = await page.request.post(`${BASE_URL}/api/v2/staff/academic-years/${year.data.id}/current`, { headers: sameOriginHeaders() });
    expect(promoted.status(), await promoted.text()).toBe(200);
  });

  await test.step('creates the family through the duplicate-gated dialog', async () => {
    await page.getByRole('button', { name: 'Nouvelle famille' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Prénom', { exact: true }).fill('Amel');
    await dialog.getByLabel('Nom', { exact: true }).fill(`Corev2-${nonce}`);
    await dialog.getByLabel('E-mail', { exact: true }).fill(parentEmail);
    await dialog.getByLabel('Téléphone (optionnel)').fill('+216 20 000 001');
    await dialog.getByRole('button', { name: 'Vérifier et créer' }).click();
    await page.waitForURL(/\/dashboard\/assistante\/familles\/[A-Za-z0-9]+$/);
    householdId = page.url().split('/').pop()!;
    await expect(page.getByRole('heading', { name: /Foyer Amel Corev2/ })).toBeVisible();
    await expect(page.getByText(parentEmail)).toBeVisible();
  });

  await test.step('creating the same e-mail again is blocked by the hard conflict', async () => {
    await page.goto('/dashboard/assistante/familles', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Nouvelle famille' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Prénom', { exact: true }).fill('Doublon');
    await dialog.getByLabel('Nom', { exact: true }).fill('Test');
    await dialog.getByLabel('E-mail', { exact: true }).fill(parentEmail.toUpperCase());
    await dialog.getByRole('button', { name: 'Vérifier et créer' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Un compte existe déjà');
    await expect(dialog.getByRole('button', { name: 'Créer la famille' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.goto(`/dashboard/assistante/familles/${householdId}`, { waitUntil: 'domcontentloaded' });
  });

  await test.step('adds a student', async () => {
    await page.getByRole('button', { name: 'Ajouter un élève' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Prénom', { exact: true }).fill('Yasmine');
    await dialog.getByLabel('Nom', { exact: true }).fill(`Corev2-${nonce}`);
    await dialog.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByRole('heading', { name: `Yasmine Corev2-${nonce}` })).toBeVisible();
  });

  await test.step('enrolls the student for the year, then approves', async () => {
    await page.getByRole('button', { name: 'Nouvelle inscription' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Niveau', { exact: true }).selectOption('PREMIERE');
    await dialog.getByRole('button', { name: 'Créer l’inscription' }).click();
    const enrollment = page.getByRole('article', { name: `Inscription ${startYear}-${startYear + 1}` });
    await expect(enrollment.getByText('En attente')).toBeVisible();
    await enrollment.getByRole('button', { name: 'Approuver' }).click();
    await expect(enrollment.getByRole('status')).toContainText('Inscription approuvée.');
    await expect(enrollment.getByText('Active')).toBeVisible();
    const fiche = await page.request.get(`${BASE_URL}/api/v2/staff/households/${householdId}`);
    const detail = (await fiche.json()) as { data: { parents: Array<{ id: string }>; students: Array<{ enrollments: Array<{ id: string }> }> } };
    parentUserId = detail.data.parents[0]!.id;
    enrollmentId = detail.data.students[0]!.enrollments[0]!.id;
    expect(enrollmentId).toBeTruthy();
  });

  await test.step('records the course choice', async () => {
    const enrollment = page.getByRole('article', { name: `Inscription ${startYear}-${startYear + 1}` });
    await enrollment.getByLabel('Clé de cours').fill('maths-premiere');
    await enrollment.getByRole('button', { name: 'Ajouter' }).click();
    await enrollment.getByRole('button', { name: 'Enregistrer les cours' }).click();
    await expect(enrollment.getByRole('status').filter({ hasText: 'Cours enregistrés.' })).toBeVisible();
  });

  await test.step('grants the seeded coach the capability (staff API) and assigns them through the UI', async () => {
    const coaches = await page.request.get(`${BASE_URL}/api/v2/staff/coaches?limit=100`);
    const list = (await coaches.json()) as { data: { items: Array<{ id: string; user: { email: string | null } }> } };
    const coach = list.data.items[0];
    expect(coach, 'a mirrored COACH account must exist in Core v2').toBeTruthy();
    const granted = await page.request.put(`${BASE_URL}/api/v2/staff/coaches/${coach!.id}/capabilities`, {
      headers: sameOriginHeaders(),
      data: { courseKey: 'maths-premiere', granted: true },
    });
    expect(granted.status(), await granted.text()).toBe(200);

    await page.reload({ waitUntil: 'domcontentloaded' });
    const enrollment = page.getByRole('article', { name: `Inscription ${startYear}-${startYear + 1}` });
    await enrollment.getByLabel('Cours', { exact: true }).selectOption('maths-premiere');
    await enrollment.getByLabel('Coach habilité').selectOption({ index: 1 });
    await enrollment.getByRole('button', { name: 'Affecter' }).click();
    await expect(enrollment.getByRole('status').filter({ hasText: 'Coach affecté.' })).toBeVisible();
  });

  await test.step('creates a weekly planning series', async () => {
    const enrollment = page.getByRole('article', { name: `Inscription ${startYear}-${startYear + 1}` });
    await enrollment.getByRole('button', { name: 'Planifier' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Première séance').fill(`${startYear}-09-15`);
    await dialog.getByLabel('Jour', { exact: true }).selectOption('TU');
    await dialog.getByRole('button', { name: 'Créer la série' }).click();
    await expect(enrollment.getByText(/FREQ=WEEKLY;BYDAY=TU · 18:00–19:00/)).toBeVisible();
  });

  await test.step('invites the parent; the e-mail reaches Mailpit; activation succeeds once', async () => {
    const parents = page.getByRole('heading', { name: 'Parents' }).locator('..').locator('..');
    await parents.getByRole('button', { name: 'Inviter' }).first().click();
    await expect(parents.getByRole('status').filter({ hasText: 'Invitation envoyée.' })).toBeVisible();

    rawToken = await findActivationToken();
    const activated = await page.request.post(`${BASE_URL}/api/v2/auth/activate`, {
      headers: sameOriginHeaders(),
      data: { token: rawToken, password: `change_me_e2e_${nonce}` },
    });
    expect(activated.status(), await activated.text()).toBe(200);
    const body = (await activated.json()) as { data: { user: { accountStatus: string; password?: unknown } } };
    expect(body.data.user.accountStatus).toBe('ACTIVE');
    expect(body.data.user).not.toHaveProperty('password');

    const replay = await page.request.post(`${BASE_URL}/api/v2/auth/activate`, {
      headers: sameOriginHeaders(),
      data: { token: rawToken, password: `change_me_e2e_${nonce}_2` },
    });
    expect(replay.status()).toBe(409);
  });

  await test.step('ASSISTANTE is denied the ADMIN-only operations', async () => {
    const suspend = await page.request.post(`${BASE_URL}/api/v2/staff/accounts/${parentUserId}/suspend`, { headers: sameOriginHeaders() });
    expect(suspend.status()).toBe(403);
    const audit = await page.request.get(`${BASE_URL}/api/v2/staff/audit?subjectId=${parentUserId}`);
    expect(audit.status()).toBe(403);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Suspendre' })).toHaveCount(0);
  });

  await test.step('ADMIN reads the audit trail and suspends the account', async () => {
    await loginAsUser(page, 'admin', { navigate: false });
    const audit = await page.request.get(`${BASE_URL}/api/v2/staff/audit?subjectId=${parentUserId}&limit=50`);
    expect(audit.status(), await audit.text()).toBe(200);
    const rows = (await audit.json()) as { data: { items: Array<{ action: string; actorUserId: string | null }> } };
    const actions = rows.data.items.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['parent.created', 'account.invited', 'account.activated']));

    await page.goto(`/dashboard/admin/familles/${householdId}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Suspendre' }).first().click();
    await expect(page.getByRole('status').filter({ hasText: 'Compte suspendu' })).toBeVisible();
    const after = await page.request.get(`${BASE_URL}/api/v2/staff/households/${householdId}`);
    const detail = (await after.json()) as { data: { parents: Array<{ accountStatus: string }> } };
    expect(detail.data.parents[0]!.accountStatus).toBe('SUSPENDED');
  });
});
