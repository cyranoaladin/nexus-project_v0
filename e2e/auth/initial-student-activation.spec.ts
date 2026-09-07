import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { assertDisposableE2eDatabase } from '../helpers/disposable-database';
import { loginAsUser, waitForAuthenticatedSession } from '../helpers/auth';
import { BASE_URL, mutationHeaders } from '../helpers/golden-family';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const prefix = 'p0-browser-initial-';

function assertIsolatedDatabase(): void {
  assertDisposableE2eDatabase(databaseUrl);
}

async function cleanupFamily(parentEmail: string): Promise<void> {
  const parent = await prisma.user.findUnique({
    where: { email: parentEmail },
    include: {
      parentProfile: { include: { children: true } },
    },
  });
  if (!parent) return;

  const studentIds = parent.parentProfile?.children.map((child) => child.id) ?? [];
  const childUserIds = parent.parentProfile?.children.map((child) => child.userId) ?? [];
  await prisma.parentStudentLink.deleteMany({
    where: {
      OR: [
        { parentUserId: parent.id },
        { studentId: { in: studentIds } },
      ],
    },
  });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.parentProfile.deleteMany({ where: { userId: parent.id } });
  // The WHATSAPP-mediated activation fixture (assistante → whatsapp-invitation →
  // /auth/parent-phone) leaves a ParentPhoneChallenge row referencing the parent —
  // same cleanup e2e/helpers/golden-family.ts's cleanupGoldenFamily already does.
  await prisma.parentPhoneChallenge.deleteMany({ where: { userId: parent.id } });
  await prisma.user.deleteMany({ where: { id: { in: [...childUserIds, parent.id] } } });
}

test.describe('P0 initial student identity', () => {
  test.beforeAll(() => {
    assertIsolatedDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('parent mediates activation, then the initial child authenticates once', async ({ page, browser }) => {
    test.setTimeout(90_000);
    const nonce = Date.now();
    const parentEmail = `${prefix}${nonce}@example.test`;
    const parentPassword = 'ParentSynthetic!2026';
    const childPassword = 'ChildSynthetic!2026';
    // 8 local digits, starts with 9 (same convention as core-golden-family.spec.ts) —
    // nonce-derived so a retried/rerun test never collides with a prior run's leftover
    // phone-based duplicate-family detection.
    const parentPhone = `+2169${String(nonce).slice(-7).padStart(7, '0')}`;

    await cleanupFamily(parentEmail);
    try {
      // The old /bilan-gratuit direct-creation shortcut is gone by design (Task 4,
      // Amendement 7: it now creates a FamilyRequest for staff qualification). Note
      // that staff-conversion of a BILAN_GRATUIT request always runs in PAPER_ENTRY
      // mode, which — whenever a parent email is present — ALSO mints an immediate
      // activation token for the child (lib/families/create-family.ts:398), directly
      // contradicting this test's premise that the child starts with NO token until
      // the parent explicitly triggers activation. So this fixture instead uses the
      // canonical assistante-direct route in WHATSAPP mode (the same one
      // core-golden-family.spec.ts drives), which forces activation to null for BOTH
      // parent and child regardless of whether an email is also supplied
      // (create-family.ts:398,573) — preserving the exact starting state this test
      // needs, without any raw Prisma bootstrap of the parent either.
      await loginAsUser(page, 'assistante', { navigate: false });
      const createResponse = await page.request.post(`${BASE_URL}/api/assistante/families`, {
        headers: mutationHeaders({ 'idempotency-key': `p0-initial-${nonce}` }),
        data: {
          parentFirstName: 'Parent',
          // Nonce-suffixed: the assistante-direct route's household duplicate guard
          // (createFamily()'s `nexus_household_name_key(parentFirstName,
          // parentLastName)`) matches on the parent's normalized full name — several
          // OTHER auth E2E specs (bilan-golden-path.spec.ts, bilan-worker-autonomous.
          // spec.ts, canonical-attempt-level-guard.spec.ts) already create a real
          // family literally named "Parent Synthétique" in the same CI run, via
          // /bilan-gratuit + staff conversion (a different code path this guard does
          // not see at intake time). Reusing that literal name here — the one file
          // using the assistante-direct route — collided with theirs (real CI
          // reproduction: 409 POTENTIAL_DUPLICATE, matchStrength NAME_AND_LEVEL).
          parentLastName: `Synthétique P0-${nonce}`,
          parentEmail,
          parentPhone,
          children: [{ firstName: 'Élève', grade: 'seconde' }],
        },
      });
      expect(createResponse.status(), await createResponse.text()).toBe(201);
      const created = await createResponse.json() as {
        parentUserId: string;
        children: Array<{ studentId: string }>;
      };

      const parent = await prisma.user.findUniqueOrThrow({
        where: { id: created.parentUserId },
        include: {
          parentProfile: {
            include: { children: { include: { user: true } } },
          },
        },
      });
      expect(parent.email).toBe(parentEmail);
      const child = parent.parentProfile?.children.find((c) => c.id === created.children[0]!.studentId);
      expect(child?.user.role).toBe('ELEVE');
      expect(child?.user.password).toBeNull();
      expect(child?.user.activatedAt).toBeNull();
      expect(child?.user.activationToken).toBeNull();

      const historicalIdentifier = `élève.${nonce}@nexus-student.local`;
      await prisma.user.update({
        where: { id: child!.userId },
        data: { email: historicalIdentifier },
      });
      const initialUserCount = await prisma.user.count();
      const initialStudentCount = await prisma.student.count();

      // Parent activation is phone-mediated in WHATSAPP mode — issue and consume the
      // real one-time link (same route/flow as core-golden-family.spec.ts) instead of
      // bootstrapping the parent's password/activatedAt directly.
      const inviteResponse = await page.request.post(
        `${BASE_URL}/api/assistante/parents/${parent.id}/whatsapp-invitation`,
        { headers: mutationHeaders() },
      );
      expect(inviteResponse.status(), await inviteResponse.text()).toBe(200);
      const { whatsappUrl } = await inviteResponse.json() as { whatsappUrl: string };
      const messageText = new URL(whatsappUrl).searchParams.get('text') ?? '';
      const match = messageText.match(/https?:\/\/\S+\/auth\/parent-phone\?token=([A-Za-z0-9_-]+)/);
      expect(match, messageText).not.toBeNull();
      const parentPhoneRawToken = match![1]!;

      await page.context().clearCookies();
      await page.goto(`/auth/parent-phone?token=${parentPhoneRawToken}`);
      await page.getByLabel('Nouveau mot de passe').fill(parentPassword);
      await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(parentPassword);
      await page.getByRole('button', { name: /valider mon accès/i }).click();
      await expect(page).toHaveURL(/\/auth\/signin\?activated=true/, { timeout: 10_000 });

      await page.getByTestId('input-email').fill(parentEmail);
      await page.getByTestId('input-password').fill(parentPassword);
      await page.getByRole('button', { name: /accéder à mon espace/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/parent/);

      // A WHATSAPP-created household must be confirmed (registrationCompletedAt) before
      // "activer le compte élève" is available — same milestone core-golden-family.spec.ts
      // exercises for two children; here there is exactly one.
      await page.goto('/dashboard/parent/inscription');
      await expect(page.getByRole('heading', { name: 'Finaliser mon inscription' })).toBeVisible();
      await page.getByText(/Je confirme les informations de Élève/).click();
      await page.getByText(/Je donne mon consentement explicite au rattachement de Élève/).click();
      await page.getByRole('button', { name: 'Confirmer mon dossier' }).click();
      await expect(page.getByRole('heading', { name: 'Votre dossier est confirmé' })).toBeVisible();

      await page.goto('/dashboard/parent');
      await page.getByRole('button', { name: /activer le compte élève/i }).click();
      const displayedIdentifier = page.getByText(/^[a-z0-9.]+@nexus-student\.local$/);
      await expect(displayedIdentifier).toBeVisible();
      const loginIdentifier = (await displayedIdentifier.textContent())!;
      expect(loginIdentifier).not.toBe(historicalIdentifier);
      expect(loginIdentifier).toMatch(/^[a-z0-9]+(?:\.[a-z0-9]+)*@nexus-student\.local$/);
      const activationLink = page.getByRole('link', { name: /ouvrir l.activation/i });
      const activationUrl = await activationLink.getAttribute('href');
      expect(activationUrl).toContain('/auth/activate?token=');
      const rawToken = new URL(activationUrl!).searchParams.get('token');
      expect(rawToken).toMatch(/^sact_/);

      const pending = await prisma.user.findUniqueOrThrow({ where: { id: child!.userId } });
      expect(pending.id).toBe(child!.userId);
      expect(pending.email).toBe(loginIdentifier);
      expect(await prisma.user.count()).toBe(initialUserCount);
      expect(await prisma.student.count()).toBe(initialStudentCount);
      expect(pending.activationToken).not.toBe(rawToken);
      expect(pending.activationExpiry!.getTime()).toBeGreaterThan(Date.now());

      await page.getByRole('button', { name: /déconnexion/i }).click();
      await page.waitForURL((url) => url.pathname === '/');
      await page.goto(activationUrl!);
      await expect(page.getByRole('heading', { name: /activer votre espace élève/i })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Identifiant de connexion' })).toHaveValue(loginIdentifier);
      await page.getByLabel(/^mot de passe$/i).fill(childPassword);
      await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(childPassword);
      await page.getByRole('button', { name: /activer mon compte/i }).click();
      await expect(page.getByRole('heading', { name: /compte activé/i })).toBeVisible();
      await expect(page).toHaveURL(/\/auth\/signin\?activated=true/, { timeout: 10_000 });

      await page.getByRole('textbox', { name: 'Téléphone WhatsApp ou email', exact: true }).fill(loginIdentifier);
      await page.getByLabel(/^mot de passe$/i).fill(childPassword);
      await page.getByRole('button', { name: /accéder à mon espace/i }).click();
      await waitForAuthenticatedSession(page, loginIdentifier);
      await page.goto('/dashboard/eleve', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/dashboard\/eleve/);

      const protectedResponse = await page.request.get('/api/student/dashboard');
      expect(protectedResponse.status()).toBe(200);

      const activated = await prisma.user.findUniqueOrThrow({ where: { id: child!.userId } });
      expect(activated.activatedAt).not.toBeNull();
      expect(activated.activationToken).toBeNull();
      expect(activated.activationExpiry).toBeNull();
      expect(await bcrypt.compare(childPassword, activated.password!)).toBe(true);

      await page.getByRole('button', { name: 'Se déconnecter de votre compte' }).click();
      await page.waitForURL((url) => ['/auth/signin', '/'].includes(url.pathname));
      await page.goto(activationUrl!);
      await expect(page.getByRole('heading', { name: /lien invalide/i })).toBeVisible();
    } finally {
      await cleanupFamily(parentEmail);
    }
  });
});
