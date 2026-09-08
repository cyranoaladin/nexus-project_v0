import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { ensureCoachAvailabilityByEmail } from '../helpers/db';
import {
  BASE_URL,
  cleanupGoldenFamily,
  createSyntheticCoach,
  disconnectGoldenFamilyPrisma,
  gotoStable,
  mutationHeaders,
  prisma,
  signInAs,
  type GoldenFamilyIds,
} from '../helpers/golden-family';

/** A weekday at least `daysAhead` days out — well past the 14-day specific-date
 * window `ensureCoachAvailabilityByEmail` seeds, so availability resolution
 * (`lib/planning/effective-availability.ts`) falls back to the RECURRING
 * Mon-Fri 10:00-11:00 window, which has no `validUntil`. */
function nextWeekdayIso(daysAhead: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Task 17 (docs/superpowers/plans/2026-09-06-core-family-academic-planning.md,
 * CORE_GO_LIVE_GATE.md) — capstone integration test for Tasks 1-16: one
 * coherent scenario walking the entire family/academic/planning lifecycle
 * exactly as a real family would experience it (assistante-created family,
 * phone-mediated parent activation, household confirmation, per-child
 * academic maps, course-scoped assignments, recurring planning series),
 * then every role-isolation and denial invariant this branch has built.
 *
 * Family creation goes through `createFamily()`'s canonical staff route
 * (`POST /api/assistante/families`, `mode: 'WHATSAPP'` — see
 * `lib/families/create-family.ts`): the request-conversion flow
 * (`FamilyRequest` → convert) already has its own dedicated integration
 * coverage from Task 4, so this E2E exercises the direct canonical path.
 * That route activates the parent EXCLUSIVELY by phone (WHATSAPP mode never
 * sends a parent activation email, regardless of whether an email is
 * supplied — see `createFamily()`'s `activation = ... || mode === 'WHATSAPP'
 * ? null`), so this scenario drives `lib/auth/parent-phone.ts`'s
 * issue/consume challenge flow via the same one-time staff response the
 * production UI uses
 * (`POST /api/assistante/parents/[parentId]/whatsapp-invitation`, whose
 * response embeds the raw token in `whatsappUrl` — there is no real
 * WhatsApp/SMTP delivery to wait on in this sandbox, exactly as that route's
 * docstring "one-time staff response, never an idempotency record or
 * transport outbox" implies).
 */

test.describe.configure({ mode: 'serial' });

const nonce = Date.now();
const localSuffix = String(nonce).slice(-7).padStart(7, '0');
const parent1Phone = `+2169${localSuffix}`; // 8 local digits, starts with 9
const parent2Phone = `+2165${localSuffix}`;
const parent1Password = 'GoldenParent!2026';
const parent2Password = 'GoldenParent2!2026';
const studentAPassword = 'GoldenStudentA!2026';
const studentBPassword = 'GoldenStudentB!2026';
const coach1Password = 'GoldenCoach1!2026';
const coach2Password = 'GoldenCoach2!2026';

const ids: GoldenFamilyIds = {};

// Captured across steps for the idempotency-replay assertions at the end.
let familyCreateBody: Record<string, unknown>;
let familyCreateKey: string;
let familyCreateResponseBody: unknown;

test.afterAll(async () => {
  await cleanupGoldenFamily(ids);
  await disconnectGoldenFamilyPrisma();
});

test('golden family: full lifecycle, then every role-isolation and denial invariant', async ({ page }) => {
  // ── 1. Assistante creates the family (Task 4) ───────────────────────────
  await test.step('assistante login', async () => {
    await loginAsUser(page, 'assistante');
  });

  await test.step('assistante creates a family with two children', async () => {
    familyCreateKey = `golden-family-${nonce}`;
    familyCreateBody = {
      parentFirstName: 'Golden',
      parentLastName: `Family${nonce}`,
      parentPhone: parent1Phone,
      children: [
        { firstName: 'Alpha', lastName: 'Golden', grade: 'premiere' },
        { firstName: 'Beta', lastName: 'Golden', grade: 'terminale' },
      ],
    };
    const response = await page.request.post(`${BASE_URL}/api/assistante/families`, {
      headers: mutationHeaders({ 'idempotency-key': familyCreateKey }),
      data: familyCreateBody,
    });
    expect(response.status(), await response.text()).toBe(201);
    const body = await response.json() as {
      parentUserId: string;
      parentCreated: boolean;
      children: Array<{ studentId: string; firstName: string; gradeLevel: string }>;
      invitationRequired: boolean;
      invitationMode: string;
    };
    familyCreateResponseBody = body;
    expect(body.parentCreated).toBe(true);
    expect(body.children).toHaveLength(2);
    expect(body.invitationMode).toBe('MANUAL');
    expect(body.invitationRequired).toBe(true);

    ids.parent1UserId = body.parentUserId;
    ids.idempotencyOwners = [body.parentUserId];
    const alpha = body.children.find((child) => child.firstName === 'Alpha')!;
    const beta = body.children.find((child) => child.firstName === 'Beta')!;
    expect(alpha.gradeLevel).toBe('PREMIERE');
    expect(beta.gradeLevel).toBe('TERMINALE');
    ids.childAStudentId = alpha.studentId;
    ids.childBStudentId = beta.studentId;

    const studentRows = await prisma.student.findMany({
      where: { id: { in: [alpha.studentId, beta.studentId] } },
      select: { id: true, userId: true },
    });
    ids.childAUserId = studentRows.find((row) => row.id === alpha.studentId)!.userId;
    ids.childBUserId = studentRows.find((row) => row.id === beta.studentId)!.userId;
  });

  // ── 2. Parent activation by phone + household confirmation (Task 3/5) ──
  let parentPhoneRawToken = '';
  await test.step('assistante issues the one-time WhatsApp activation link', async () => {
    const response = await page.request.post(
      `${BASE_URL}/api/assistante/parents/${ids.parent1UserId}/whatsapp-invitation`,
      { headers: mutationHeaders() },
    );
    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json() as { whatsappUrl: string; purpose: string };
    expect(body.purpose).toBe('ACTIVATION');
    // buildParentWhatsAppUrl embeds the message (with the activation link) as `text=`.
    const messageText = new URL(body.whatsappUrl).searchParams.get('text') ?? '';
    const match = messageText.match(/https?:\/\/\S+\/auth\/parent-phone\?token=([A-Za-z0-9_-]+)/);
    expect(match, messageText).not.toBeNull();
    parentPhoneRawToken = match![1]!;
    expect(parentPhoneRawToken).toMatch(/^ppact_/);
  });

  await test.step('parent sets a password via the phone-activation link', async () => {
    await page.context().clearCookies();
    await gotoStable(page, `/auth/parent-phone?token=${parentPhoneRawToken}`);
    await expect(page.getByRole('heading', { name: 'Activer mon espace parent' })).toBeVisible();
    await page.getByLabel('Nouveau mot de passe').fill(parent1Password);
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(parent1Password);
    await page.getByRole('button', { name: /valider mon accès/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin\?activated=true/, { timeout: 10_000 });
  });

  await test.step('parent logs in by phone', async () => {
    await signInAs(page, parent1Phone, parent1Password, ids.parent1UserId!);
    await gotoStable(page, '/dashboard/parent');
    await expect(page).toHaveURL(/\/dashboard\/parent/);
  });

  await test.step('parent confirms the household (registrationCompletedAt)', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: ids.parent1UserId! } });
    expect(before.registrationCompletedAt).toBeNull();

    await gotoStable(page, '/dashboard/parent/inscription');
    await expect(page.getByRole('heading', { name: 'Finaliser mon inscription' })).toBeVisible();

    await page.getByText(/Je confirme les informations de Alpha/).click();
    await page.getByText(/Je confirme les informations de Beta/).click();
    await page.getByText(/Je donne mon consentement explicite au rattachement de Alpha/).click();
    await page.getByText(/Je donne mon consentement explicite au rattachement de Beta/).click();

    await page.getByRole('button', { name: 'Confirmer mon dossier' }).click();
    await expect(page.getByRole('heading', { name: 'Votre dossier est confirmé' })).toBeVisible();

    const after = await prisma.user.findUniqueOrThrow({ where: { id: ids.parent1UserId! } });
    expect(after.registrationCompletedAt).not.toBeNull();
  });

  await test.step('accessibility spot-check (axe) on the confirmed parent dashboard', async () => {
    await gotoStable(page, '/dashboard/parent');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);
  });

  // ── 3. Two academic-map writes (Task 6/7) ───────────────────────────────
  await test.step('assistante enrolls each child in their maths specialty', async () => {
    await loginAsUser(page, 'assistante');

    const putEnrollment = async (studentId: string, courseKey: string) => {
      const current = await page.request.get(
        `${BASE_URL}/api/assistante/students/${studentId}/academic-enrollments`,
      );
      expect(current.status(), await current.text()).toBe(200);
      const currentBody = await current.json() as { academicRevision: number };

      const response = await page.request.put(
        `${BASE_URL}/api/assistante/students/${studentId}/academic-enrollments`,
        {
          headers: mutationHeaders(),
          data: { courseKeys: [courseKey], expectedRevision: currentBody.academicRevision },
        },
      );
      expect(response.status(), await response.text()).toBe(200);
      const body = await response.json() as { courses: Array<{ course: { courseKey: string }; academicStatus: string }> };
      const enrolled = body.courses.find((c) => c.course.courseKey === courseKey);
      expect(enrolled?.academicStatus).toBe('ENROLLED');
    };

    await putEnrollment(ids.childAStudentId!, 'eds-maths-premiere');
    await putEnrollment(ids.childBStudentId!, 'eds-maths-terminale');
  });

  // ── 4. Two synthetic coaches — fixture, not the subject under test ──────
  await test.step('provision two coaches capable of teaching MATHEMATIQUES', async () => {
    const coach1 = await createSyntheticCoach({
      emailPrefix: `coach1-${nonce}`,
      pseudonym: `GoldenCoach1_${nonce}`,
      password: coach1Password,
      subjects: ['MATHEMATIQUES'],
    });
    const coach2 = await createSyntheticCoach({
      emailPrefix: `coach2-${nonce}`,
      pseudonym: `GoldenCoach2_${nonce}`,
      password: coach2Password,
      subjects: ['MATHEMATIQUES'],
    });
    ids.coach1UserId = coach1.userId;
    ids.coach1ProfileId = coach1.coachProfileId;
    ids.coach2UserId = coach2.userId;
    ids.coach2ProfileId = coach2.coachProfileId;
    await ensureCoachAvailabilityByEmail(coach1.email);
    await ensureCoachAvailabilityByEmail(coach2.email);
  });

  // ── 5. Two course-scoped assignments (Task 9) ───────────────────────────
  await test.step('assistante assigns each child to a different coach, scoped to their maths course', async () => {
    await loginAsUser(page, 'assistante');

    const responseA = await page.request.post(`${BASE_URL}/api/assistante/assignments`, {
      headers: mutationHeaders(),
      data: {
        coachId: ids.coach1ProfileId,
        studentIds: [ids.childAStudentId],
        courseKeys: ['eds-maths-premiere'],
      },
    });
    expect(responseA.status(), await responseA.text()).toBe(201);
    const bodyA = await responseA.json() as { assignments: Array<{ id: string }> };
    ids.assignmentAId = bodyA.assignments[0]!.id;

    const responseB = await page.request.post(`${BASE_URL}/api/assistante/assignments`, {
      headers: mutationHeaders(),
      data: {
        coachId: ids.coach2ProfileId,
        studentIds: [ids.childBStudentId],
        courseKeys: ['eds-maths-terminale'],
      },
    });
    expect(responseB.status(), await responseB.text()).toBe(201);
    const bodyB = await responseB.json() as { assignments: Array<{ id: string }> };
    ids.assignmentBId = bodyB.assignments[0]!.id;
  });

  // ── 6. Two weekly recurring series (Task 11) ────────────────────────────
  const seriesADate = nextWeekdayIso(21);
  const seriesBDate = nextWeekdayIso(22);
  await test.step('assistante materializes a weekly series per assignment', async () => {
    const responseA = await page.request.post(`${BASE_URL}/api/assistante/sessions`, {
      headers: mutationHeaders(),
      data: {
        coachProfileId: ids.coach1ProfileId,
        studentProfileId: ids.childAStudentId,
        assignmentId: ids.assignmentAId,
        academicCourseKey: 'eds-maths-premiere',
        scheduledDate: seriesADate,
        startTime: '10:00',
        endTime: '10:45',
        duration: 45,
        title: 'Golden Family — Maths Alpha',
        recurrence: { frequency: 'WEEKLY', intervalWeeks: 1, count: 3 },
      },
    });
    expect(responseA.status(), await responseA.text()).toBe(201);
    const bodyA = await responseA.json() as { seriesId: string; sessions: Array<{ id: string; scheduledDate: string }> };
    ids.seriesAId = bodyA.seriesId;
    expect(bodyA.sessions).toHaveLength(3);

    const responseB = await page.request.post(`${BASE_URL}/api/assistante/sessions`, {
      headers: mutationHeaders(),
      data: {
        coachProfileId: ids.coach2ProfileId,
        studentProfileId: ids.childBStudentId,
        assignmentId: ids.assignmentBId,
        academicCourseKey: 'eds-maths-terminale',
        scheduledDate: seriesBDate,
        startTime: '10:00',
        endTime: '10:45',
        duration: 45,
        title: 'Golden Family — Maths Beta',
        recurrence: { frequency: 'WEEKLY', intervalWeeks: 1, count: 3 },
      },
    });
    expect(responseB.status(), await responseB.text()).toBe(201);
    const bodyB = await responseB.json() as { seriesId: string; sessions: Array<{ id: string; scheduledDate: string }> };
    ids.seriesBId = bodyB.seriesId;
    expect(bodyB.sessions).toHaveLength(3);
  });

  // ── 7. ASSISTANTE and ADMIN operational assertions ──────────────────────
  await test.step('assistante sees the created assignments without SQL/admin-CRUD access', async () => {
    const response = await page.request.get(
      `${BASE_URL}/api/assistante/assignments?studentId=${ids.childAStudentId}`,
    );
    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json() as { assignments: Array<{ id: string; academicCourseKeys: string[] }> };
    const found = body.assignments.find((a) => a.id === ids.assignmentAId);
    expect(found?.academicCourseKeys).toEqual(['eds-maths-premiere']);
  });

  await test.step('empty assignment scope is rejected without changing the assignment', async () => {
    const url = `${BASE_URL}/api/assistante/assignments/${ids.assignmentAId}`;
    const before = await page.request.get(url);
    expect(before.status()).toBe(200);
    const previous = await before.json();
    const response = await page.request.patch(url, {
      headers: mutationHeaders(), data: { courseKeys: [] },
    });
    expect(response.status(), await response.text()).toBe(400);
    const after = await page.request.get(url);
    expect(after.status()).toBe(200);
    expect(await after.json()).toEqual(previous);
    const valid = await page.request.patch(url, {
      headers: mutationHeaders(), data: { courseKeys: ['eds-maths-premiere'] },
    });
    expect(valid.status(), await valid.text()).toBe(200);
    expect((await valid.json()).assignment).toMatchObject({
      academicCourseKeys: ['eds-maths-premiere'], courseScopeState: 'STAFF_VERIFIED',
    });
  });

  await test.step('admin sees child B academic map through the same governed route', async () => {
    await loginAsUser(page, 'admin');
    const response = await page.request.get(
      `${BASE_URL}/api/assistante/students/${ids.childBStudentId}/academic-enrollments`,
    );
    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json() as { courses: Array<{ course: { courseKey: string }; academicStatus: string }> };
    const enrolled = body.courses.find((c) => c.course.courseKey === 'eds-maths-terminale');
    expect(enrolled?.academicStatus).toBe('ENROLLED');
  });

  // ── 8. PARENT visibility, independently, per child (Task 13) ───────────
  await test.step('parent dashboard shows child A and child B independently, never merged', async () => {
    await signInAs(page, parent1Phone, parent1Password, ids.parent1UserId!);
    const response = await page.request.get(`${BASE_URL}/api/parent/dashboard`);
    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json() as {
      children: Array<{ id: string; gradeLevel: string; academicTrack: string; sessions: Array<{ academicCourseKey: string | null }> }>;
    };
    const childA = body.children.find((c) => c.id === ids.childAStudentId)!;
    const childB = body.children.find((c) => c.id === ids.childBStudentId)!;
    expect(childA.gradeLevel).toBe('PREMIERE');
    expect(childA.sessions.map((s) => s.academicCourseKey)).toEqual(['eds-maths-premiere', 'eds-maths-premiere', 'eds-maths-premiere']);
    expect(childB.gradeLevel).toBe('TERMINALE');
    expect(childB.sessions.map((s) => s.academicCourseKey)).toEqual(['eds-maths-terminale', 'eds-maths-terminale', 'eds-maths-terminale']);
  });

  // ── 9. Student A isolation, then Student B isolation (Task 13) ─────────
  let childAIdentifier = '';
  let childBIdentifier = '';
  await test.step('student A activates and sees only her own schedule/academic map', async () => {
    const activationA = await page.request.post(
      `${BASE_URL}/api/parent/children/${ids.childAStudentId}/activation`,
      { headers: mutationHeaders() },
    );
    expect(activationA.status(), await activationA.text()).toBe(200);
    const bodyA = await activationA.json() as { activation: { activationUrl: string; loginIdentifier: string } };
    childAIdentifier = bodyA.activation.loginIdentifier;

    await page.context().clearCookies();
    await gotoStable(page, bodyA.activation.activationUrl);
    await expect(page.getByRole('heading', { name: 'Activer votre espace élève' })).toBeVisible();
    await page.getByLabel(/^mot de passe$/i).fill(studentAPassword);
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(studentAPassword);
    await page.getByRole('button', { name: /activer mon compte/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin\?activated=true/, { timeout: 10_000 });

    await signInAs(page, childAIdentifier, studentAPassword, ids.childAUserId!);
    const response = await page.request.get(`${BASE_URL}/api/student/dashboard`);
    expect(response.status(), await response.text()).toBe(200);
    const text = await response.text();
    expect(text).not.toContain('Beta');
    // /api/student/dashboard projects the academic map by Subject/skillGraphRef
    // (lib/dashboard/student-payload.ts), never the raw courseKey — assert on
    // the correctly per-grade-resolved skillGraphRef field. NOT asserted here:
    // that same payload's `trackContent.specialties[].diagnosticKey` is
    // hardcoded to `'maths-premiere-p2'` for EVERY MATHEMATIQUES specialty
    // regardless of gradeLevel (lib/dashboard/student-payload.ts ~line 1117) —
    // a content-correctness bug this scenario surfaced (a TERMINALE student
    // is pointed at the PREMIERE diagnostic bank), not a cross-student
    // isolation leak (same wrong value for every student, not another
    // student's value) — reported separately, not fixed here (out of Task
    // 17's scope) or asserted on (would pin the bug as expected behavior).
    const dashboardA = JSON.parse(text) as { trackContent: { specialties: Array<{ skillGraphRef: string }> } };
    expect(dashboardA.trackContent.specialties.map((s) => s.skillGraphRef)).toEqual(['maths-premiere-p2']);
  });

  await test.step('student B activates and sees only his own schedule/academic map', async () => {
    await signInAs(page, parent1Phone, parent1Password, ids.parent1UserId!);
    const activationB = await page.request.post(
      `${BASE_URL}/api/parent/children/${ids.childBStudentId}/activation`,
      { headers: mutationHeaders() },
    );
    expect(activationB.status(), await activationB.text()).toBe(200);
    const bodyB = await activationB.json() as { activation: { activationUrl: string; loginIdentifier: string } };
    childBIdentifier = bodyB.activation.loginIdentifier;

    await page.context().clearCookies();
    await gotoStable(page, bodyB.activation.activationUrl);
    await expect(page.getByRole('heading', { name: 'Activer votre espace élève' })).toBeVisible();
    await page.getByLabel(/^mot de passe$/i).fill(studentBPassword);
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(studentBPassword);
    await page.getByRole('button', { name: /activer mon compte/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin\?activated=true/, { timeout: 10_000 });

    await signInAs(page, childBIdentifier, studentBPassword, ids.childBUserId!);
    const response = await page.request.get(`${BASE_URL}/api/student/dashboard`);
    expect(response.status(), await response.text()).toBe(200);
    const text = await response.text();
    expect(text).not.toContain('Alpha');
    const dashboardB = JSON.parse(text) as { trackContent: { specialties: Array<{ skillGraphRef: string }> } };
    expect(dashboardB.trackContent.specialties.map((s) => s.skillGraphRef)).toEqual(['maths-terminale-p2']);
  });

  // ── 10. Coach C1 isolation, then Coach C2 isolation (Task 14) ──────────
  await test.step('coach C1 sees only student A dossier, never student B', async () => {
    await signInAs(page, 'coach1-' + nonce + '@e2e-golden-family.test.local', coach1Password, ids.coach1UserId!);
    const okResponse = await page.request.get(`${BASE_URL}/api/coach/students/${ids.childAStudentId}/dossier`);
    expect(okResponse.status(), await okResponse.text()).toBe(200);
    const okBody = await okResponse.json() as { student: { academicCourses: Array<{ courseKey: string }> } };
    expect(okBody.student.academicCourses.some((c) => c.courseKey === 'eds-maths-premiere')).toBe(true);

    const forbidden = await page.request.get(`${BASE_URL}/api/coach/students/${ids.childBStudentId}/dossier`);
    expect(forbidden.status(), await forbidden.text()).toBe(403);
  });

  await test.step('coach C2 sees only student B dossier, never student A', async () => {
    await signInAs(page, 'coach2-' + nonce + '@e2e-golden-family.test.local', coach2Password, ids.coach2UserId!);
    const okResponse = await page.request.get(`${BASE_URL}/api/coach/students/${ids.childBStudentId}/dossier`);
    expect(okResponse.status(), await okResponse.text()).toBe(200);

    const forbidden = await page.request.get(`${BASE_URL}/api/coach/students/${ids.childAStudentId}/dossier`);
    expect(forbidden.status(), await forbidden.text()).toBe(403);
  });

  // ── 11. Cross-parent and cross-child IDOR denials ───────────────────────
  await test.step('assistante creates a second, entirely unrelated family', async () => {
    await loginAsUser(page, 'assistante');
    const response = await page.request.post(`${BASE_URL}/api/assistante/families`, {
      headers: mutationHeaders({ 'idempotency-key': `golden-family-2-${nonce}` }),
      data: {
        parentFirstName: 'GoldenOther',
        parentLastName: `Family${nonce}`,
        parentPhone: parent2Phone,
        children: [{ firstName: 'Gamma', lastName: 'GoldenOther', grade: 'seconde' }],
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    const body = await response.json() as { parentUserId: string; children: Array<{ studentId: string }> };
    ids.parent2UserId = body.parentUserId;
    ids.idempotencyOwners = [...(ids.idempotencyOwners ?? []), body.parentUserId];
    ids.child2StudentId = body.children[0]!.studentId;
    const studentRow = await prisma.student.findUniqueOrThrow({ where: { id: ids.child2StudentId }, select: { userId: true } });
    ids.child2UserId = studentRow.userId;

    const invitation = await page.request.post(
      `${BASE_URL}/api/assistante/parents/${ids.parent2UserId}/whatsapp-invitation`,
      { headers: mutationHeaders() },
    );
    expect(invitation.status(), await invitation.text()).toBe(200);
    const invitationBody = await invitation.json() as { whatsappUrl: string };
    const messageText = new URL(invitationBody.whatsappUrl).searchParams.get('text') ?? '';
    const match = messageText.match(/https?:\/\/\S+\/auth\/parent-phone\?token=([A-Za-z0-9_-]+)/)!;

    await page.context().clearCookies();
    await gotoStable(page, `/auth/parent-phone?token=${match[1]}`);
    await page.getByLabel('Nouveau mot de passe').fill(parent2Password);
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(parent2Password);
    await page.getByRole('button', { name: /valider mon accès/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin\?activated=true/, { timeout: 10_000 });
  });

  await test.step('neither parent can reach the other family\'s child via direct id manipulation', async () => {
    await signInAs(page, parent1Phone, parent1Password, ids.parent1UserId!);
    const parent1CrossChild = await page.request.get(
      `${BASE_URL}/api/parent/children/${ids.child2StudentId}/canonical-consent`,
    );
    expect(parent1CrossChild.status(), await parent1CrossChild.text()).toBe(404);

    await signInAs(page, parent2Phone, parent2Password, ids.parent2UserId!);
    const parent2CrossChild = await page.request.get(
      `${BASE_URL}/api/parent/children/${ids.childAStudentId}/canonical-consent`,
    );
    expect(parent2CrossChild.status(), await parent2CrossChild.text()).toBe(404);
  });

  // ── 12. Cross-coach and ended-assignment denials (Task 14) ─────────────
  await test.step('ending assignment A immediately revokes coach C1 dossier access', async () => {
    await loginAsUser(page, 'assistante');
    const response = await page.request.patch(`${BASE_URL}/api/assistante/assignments/${ids.assignmentAId}`, {
      headers: mutationHeaders(),
      data: { status: 'ENDED' },
    });
    expect(response.status(), await response.text()).toBe(200);

    const active = await page.request.get(`${BASE_URL}/api/assistante/assignments?studentId=${ids.childAStudentId}`);
    expect(active.status()).toBe(200);
    expect((await active.json()).assignments).toEqual([]);
    const ended = await page.request.get(`${BASE_URL}/api/assistante/assignments?studentId=${ids.childAStudentId}&status=ENDED`);
    expect(ended.status()).toBe(200);
    expect((await ended.json()).assignments.map((assignment: { id: string }) => assignment.id)).toContain(ids.assignmentAId);
    const reopen = await page.request.patch(`${BASE_URL}/api/assistante/assignments/${ids.assignmentAId}`, {
      headers: mutationHeaders(), data: { status: 'ACTIVE', courseKeys: ['eds-maths-premiere'] },
    });
    expect(reopen.status(), await reopen.text()).toBe(409);

    await signInAs(page, 'coach1-' + nonce + '@e2e-golden-family.test.local', coach1Password, ids.coach1UserId!);
    const dossier = await page.request.get(`${BASE_URL}/api/coach/students/${ids.childAStudentId}/dossier`);
    expect(dossier.status(), await dossier.text()).toBe(403);
  });

  // ── 13. Wrong-course and conflicting-schedule denials (Task 9/10/11) ───
  // Assignment A is now ENDED — these use assignment B (still ACTIVE) so the
  // failure asserted is genuinely course-scope/conflict, not ASSIGNMENT_NOT_ACTIVE.
  await test.step('wrong-course-scope session creation is rejected', async () => {
    await loginAsUser(page, 'assistante');
    const response = await page.request.post(`${BASE_URL}/api/assistante/sessions`, {
      headers: mutationHeaders(),
      data: {
        coachProfileId: ids.coach2ProfileId,
        studentProfileId: ids.childBStudentId,
        assignmentId: ids.assignmentBId,
        // Student A's course — never in Student B's academic map or assignment B's scope.
        academicCourseKey: 'eds-maths-premiere',
        scheduledDate: nextWeekdayIso(28),
        startTime: '10:00',
        endTime: '10:45',
        duration: 45,
        title: 'Golden Family — wrong course probe',
      },
    });
    expect(response.status(), await response.text()).toBe(400);
  });

  await test.step('a genuinely conflicting session is rejected', async () => {
    const response = await page.request.post(`${BASE_URL}/api/assistante/sessions`, {
      headers: mutationHeaders(),
      data: {
        coachProfileId: ids.coach2ProfileId,
        studentProfileId: ids.childBStudentId,
        assignmentId: ids.assignmentBId,
        academicCourseKey: 'eds-maths-terminale',
        // Exact same coach/student/time as the first occurrence of series B.
        scheduledDate: seriesBDate,
        startTime: '10:00',
        endTime: '10:45',
        duration: 45,
        title: 'Golden Family — conflict probe',
      },
    });
    expect(response.status(), await response.text()).toBe(409);
  });

  // ── 14. Duplicate-idempotency conflict and replay (Task 4) ─────────────
  await test.step('replaying the family-creation request is a clean, stable success replay', async () => {
    const response = await page.request.post(`${BASE_URL}/api/assistante/families`, {
      headers: mutationHeaders({ 'idempotency-key': familyCreateKey }),
      data: familyCreateBody,
    });
    expect(response.status(), await response.text()).toBe(201);
    const body = await response.json();
    expect(body).toEqual(familyCreateResponseBody);

    const childrenCount = await prisma.student.count({
      where: { parent: { userId: ids.parent1UserId! } },
    });
    expect(childrenCount).toBe(2);
  });

  await test.step('replaying the same key with a different payload is a clean conflict', async () => {
    const response = await page.request.post(`${BASE_URL}/api/assistante/families`, {
      headers: mutationHeaders({ 'idempotency-key': familyCreateKey }),
      data: { ...familyCreateBody, parentFirstName: 'GoldenChanged' },
    });
    expect(response.status(), await response.text()).toBe(409);
    const text = await response.text();
    expect(text).toContain('IDEMPOTENCY_CONFLICT');

    const childrenCount = await prisma.student.count({
      where: { parent: { userId: ids.parent1UserId! } },
    });
    expect(childrenCount).toBe(2);
  });

  // ── 15. Cleanup and zero-synthetic-rows verification ────────────────────
  await test.step('cleanup removes every synthetic row this scenario created', async () => {
    await cleanupGoldenFamily(ids);
    const remainingUsers = await prisma.user.count({
      where: {
        id: {
          in: [
            ids.parent1UserId!, ids.parent2UserId!,
            ids.childAUserId!, ids.childBUserId!, ids.child2UserId!,
            ids.coach1UserId!, ids.coach2UserId!,
          ],
        },
      },
    });
    expect(remainingUsers).toBe(0);
    const remainingAssignments = await prisma.coachStudentAssignment.count({
      where: { id: { in: [ids.assignmentAId!, ids.assignmentBId!] } },
    });
    expect(remainingAssignments).toBe(0);
    const remainingSeries = await prisma.planningSeries.count({
      where: { id: { in: [ids.seriesAId!, ids.seriesBId!] } },
    });
    expect(remainingSeries).toBe(0);
    // CanonicalApiIdempotencyKey has no FK relation to User (plain String
    // column) — nothing at the DB level would force this cleanup, so it
    // needs its own explicit check rather than relying on the User count.
    if (ids.idempotencyOwners && ids.idempotencyOwners.length > 0) {
      const remainingIdempotencyKeys = await prisma.canonicalApiIdempotencyKey.count({
        where: { userId: { in: ids.idempotencyOwners } },
      });
      expect(remainingIdempotencyKeys).toBe(0);
    }
  });
});
