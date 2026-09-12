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
 * Then the auth cutover (§U/§V) and the self-service dashboards: the parent
 * (§AH) and the student (§AI) activate through the mailed link, sign in on
 * Core v2 credentials and see their own household / enrollments; the
 * mirrored coach (§AJ) sees the assignment made to them.
 */
import { expect, test } from '@playwright/test';
import { loginAsUser, resetBrowserSession } from '../helpers/auth';
import { getCred } from '../helpers/credentials';
import { sameOriginHeaders } from '../helpers/same-origin';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3002';
const MAILPIT_API_URL = process.env.MAILPIT_API_URL ?? '';
const nonce = Date.now();
const parentEmail = `corev2-parent-${nonce}@example.test`;
const studentEmail = `corev2-student-${nonce}@example.test`;
const startYear = 2050 + (nonce % 40);

let householdId = '';
let parentUserId = '';
let studentUserId = '';
let enrollmentId = '';
let rawToken = '';
let studentToken = '';

async function findActivationToken(recipient: string): Promise<string> {
  test.skip(!MAILPIT_API_URL, 'MAILPIT_API_URL is required to capture the invitation e-mail');
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const search = await fetch(`${MAILPIT_API_URL}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`);
    const { messages = [] } = (await search.json()) as { messages?: Array<{ ID: string }> };
    for (const message of messages) {
      const detail = await fetch(`${MAILPIT_API_URL}/api/v1/message/${message.ID}`);
      const body = (await detail.json()) as { Text?: string; HTML?: string };
      const match = /purpose=core-v2&(?:amp;)?token=([A-Za-z0-9_-]{40,})/.exec(`${body.Text ?? ''}\n${body.HTML ?? ''}`);
      if (match) return match[1]!;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`CORE_V2_INVITATION_MAIL_NOT_RECEIVED:${recipient}`);
}

/** Activates a Core v2 invitation through the public page, then signs in on the form with the new password. */
async function activateAndSignIn(page: import('@playwright/test').Page, token: string, email: string, password: string, heading: string) {
  await resetBrowserSession(page);
  await page.goto(`/auth/activate?purpose=core-v2&token=${token}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await expect(page.getByLabel('Identifiant de connexion')).toHaveValue(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByLabel('Confirmer le mot de passe').fill(password);
  await page.getByRole('button', { name: 'Activer mon compte' }).click();
  await page.waitForURL(/\/auth\/signin\?activated=true/, { timeout: 15_000 });
  await page.getByRole('textbox', { name: 'Téléphone WhatsApp ou email', exact: true }).fill(email);
  await page.getByLabel(/^mot de passe$/i).fill(password);
  await page.getByRole('button', { name: /accéder à mon espace/i }).click();
  await page.waitForURL((url) => url.pathname !== '/auth/signin', { timeout: 15_000 });
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
    await dialog.getByLabel('E-mail (optionnel)').fill(studentEmail);
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
    await expect(enrollment.getByRole('status').filter({ hasText: 'Inscription approuvée.' })).toBeVisible();
    await expect(enrollment.getByText('Active')).toBeVisible();
    const fiche = await page.request.get(`${BASE_URL}/api/v2/staff/households/${householdId}`);
    const detail = (await fiche.json()) as { data: { parents: Array<{ id: string }>; students: Array<{ user: { id: string }; enrollments: Array<{ id: string }> }> } };
    parentUserId = detail.data.parents[0]!.id;
    studentUserId = detail.data.students[0]!.user.id;
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
    // The seeded `coach` identity (mirrored into Core v2 with the same id) — we sign in as them in §AJ below.
    const coach = list.data.items.find((c) => c.user.email === getCred('coach').email.toLowerCase());
    expect(coach, 'the seeded COACH account must be mirrored into Core v2').toBeTruthy();
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

  const parentPassword = `change_me_e2e_${nonce}`;
  const studentPassword = `change_me_e2e_student_${nonce}`;

  await test.step('invites the student (staff API); the activation e-mail reaches Mailpit', async () => {
    const invited = await page.request.post(`${BASE_URL}/api/v2/staff/accounts/${studentUserId}/invite`, { headers: sameOriginHeaders() });
    expect(invited.status(), await invited.text()).toBe(201);
    expect(await invited.text()).not.toMatch(/rawToken|tokenHash/);
    studentToken = await findActivationToken(studentEmail);
  });

  await test.step('invites the parent; the e-mail reaches Mailpit; the Core v2 activation page activates once', async () => {
    const parents = page.getByRole('heading', { name: 'Parents' }).locator('..').locator('..');
    await parents.getByRole('button', { name: 'Inviter' }).first().click();
    await expect(parents.getByRole('status').filter({ hasText: 'Invitation envoyée.' })).toBeVisible();

    rawToken = await findActivationToken(parentEmail);
    // The invitee opens the mailed link in a fresh browser identity (§W: activation through the UI).
    await resetBrowserSession(page);
    await page.goto(`/auth/activate?purpose=core-v2&token=${rawToken}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Activer votre espace parent' })).toBeVisible();
    await expect(page.getByLabel('Identifiant de connexion')).toHaveValue(parentEmail);
    await page.getByLabel('Mot de passe', { exact: true }).fill(parentPassword);
    await page.getByLabel('Confirmer le mot de passe').fill(parentPassword);
    await page.getByRole('button', { name: 'Activer mon compte' }).click();
    await page.waitForURL(/\/auth\/signin\?activated=true/, { timeout: 15_000 });

    // Single use: the same token is refused by the API and no longer previews.
    const replay = await page.request.post(`${BASE_URL}/api/v2/auth/activate`, {
      headers: sameOriginHeaders(),
      data: { token: rawToken, password: `${parentPassword}_2` },
    });
    expect(replay.status()).toBe(409);
    const preview = await page.request.get(`${BASE_URL}/api/v2/auth/activate?token=${rawToken}`);
    expect(((await preview.json()) as { data: { valid: boolean } }).data.valid).toBe(false);
  });

  await test.step('the parent signs in with Core v2 credentials (no Core v1 account exists for them)', async () => {
    await page.getByRole('textbox', { name: 'Téléphone WhatsApp ou email', exact: true }).fill(parentEmail);
    await page.getByLabel(/^mot de passe$/i).fill(parentPassword);
    await page.getByRole('button', { name: /accéder à mon espace/i }).click();
    await page.waitForURL((url) => url.pathname !== '/auth/signin', { timeout: 15_000 });
    const session = await page.request.get(`${BASE_URL}/api/auth/session`);
    const claims = (await session.json()) as { user?: { id?: string; role?: string; authority?: string } };
    expect(claims.user?.id).toBe(parentUserId);
    expect(claims.user?.role).toBe('PARENT');
    expect(claims.user?.authority).toBe('CORE_V2');
  });

  await test.step('the parent dashboard shows their own household from Core v2 (§AH): child, active enrollment, coach, weekly slot', async () => {
    await page.goto('/dashboard/parent', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Mon foyer' })).toBeVisible();
    await expect(page.getByRole('heading', { name: `Yasmine Corev2-${nonce}` })).toBeVisible();
    await expect(page.getByText(`${startYear}-${startYear + 1} · Inscription active`)).toBeVisible();
    await expect(page.getByText(/chaque mardi 18:00–19:00/)).toBeVisible();
    // The Core v1 family dashboard is not rendered for a Core v2 identity.
    await expect(page.getByText('Espace Famille')).toHaveCount(0);
    // The staff API stays closed to the parent even though they are a Core v2 actor.
    const staff = await page.request.get(`${BASE_URL}/api/v2/staff/households/${householdId}`);
    expect(staff.status()).toBe(403);
  });

  await test.step('the student activates, signs in on Core v2 credentials and sees their own enrollment (§AI)', async () => {
    await activateAndSignIn(page, studentToken, studentEmail, studentPassword, 'Activer votre espace élève');
    const session = await page.request.get(`${BASE_URL}/api/auth/session`);
    const claims = (await session.json()) as { user?: { id?: string; role?: string; authority?: string } };
    expect(claims.user).toMatchObject({ id: studentUserId, role: 'ELEVE', authority: 'CORE_V2' });

    await page.goto('/dashboard/eleve', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Mon parcours' })).toBeVisible();
    await expect(page.getByText(`Yasmine Corev2-${nonce} · Parents : Amel Corev2-${nonce}`)).toBeVisible();
    await expect(page.getByText(`${startYear}-${startYear + 1} · Inscription active`)).toBeVisible();
    await expect(page.getByText(/chaque mardi 18:00–19:00/)).toBeVisible();
    await expect(page.getByText('Espace Élève')).toHaveCount(0);
    // Neither the family endpoint nor the staff API is open to a student.
    expect((await page.request.get(`${BASE_URL}/api/v2/parent/household`)).status()).toBe(403);
    expect((await page.request.get(`${BASE_URL}/api/v2/staff/households/${householdId}`)).status()).toBe(403);
  });

  await test.step('the mirrored coach signs in (Core v2 authority) and sees the assignment made to them (§AJ)', async () => {
    await loginAsUser(page, 'coach', { navigate: false });
    const session = await page.request.get(`${BASE_URL}/api/auth/session`);
    const claims = (await session.json()) as { user?: { role?: string; authority?: string } };
    expect(claims.user).toMatchObject({ role: 'COACH', authority: 'CORE_V2' });

    await page.goto('/dashboard/coach', { waitUntil: 'domcontentloaded' });
    const panel = page.getByRole('heading', { name: 'Mes affectations' }).locator('..').locator('..');
    await expect(panel.getByText(`Yasmine Corev2-${nonce} — maths-premiere`)).toBeVisible();
    await expect(panel.getByText(`${startYear}-${startYear + 1} · PREMIERE · Inscription active`)).toBeVisible();
    await expect(panel.getByText(/chaque mardi 18:00–19:00/)).toBeVisible();
    // A coach is not staff: the back-office surface stays closed.
    expect((await page.request.get(`${BASE_URL}/api/v2/staff/households/${householdId}`)).status()).toBe(403);
  });

  await test.step('ASSISTANTE is denied the ADMIN-only operations', async () => {
    await loginAsUser(page, 'assistante', { navigate: false });
    await page.goto(`/dashboard/assistante/familles/${householdId}`, { waitUntil: 'domcontentloaded' });
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
    expect(actions).toEqual(expect.arrayContaining(['parent.created', 'account.activated']));
    // The invitation is audited on its own subject (Invitation), pointing at the user in metadata.
    const invitations = await page.request.get(`${BASE_URL}/api/v2/staff/audit?subjectType=Invitation&limit=50`);
    const invitationRows = (await invitations.json()) as { data: { items: Array<{ action: string; metadata: { userId?: string } | null }> } };
    expect(invitationRows.data.items.some((r) => r.action === 'account.invited' && r.metadata?.userId === parentUserId)).toBe(true);

    await page.goto(`/dashboard/admin/familles/${householdId}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Suspendre' }).first().click();
    await expect(page.getByRole('status').filter({ hasText: 'Compte suspendu' })).toBeVisible();
    const after = await page.request.get(`${BASE_URL}/api/v2/staff/households/${householdId}`);
    const detail = (await after.json()) as { data: { parents: Array<{ accountStatus: string }> } };
    expect(detail.data.parents[0]!.accountStatus).toBe('SUSPENDED');
  });
});
