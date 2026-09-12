/**
 * ARIA_COLLECTIVE_WORKSHOP_GOLDEN_E2E (P7d) — the real Suivi collective
 * workshop journey: staff schedules a real workshop -> a real, eligible
 * (SUIVI-tier) student sees it in her real cockpit and registers -> staff
 * marks real attendance -> the real parent sees the real attendance on
 * her child's page. Real disposable PostgreSQL, real Next.js
 * production-like runtime, real NextAuth sessions at every step.
 *
 * Staff scheduling and attendance-marking go through the real,
 * authenticated API directly (the same real authorization + persistence
 * code the AriaWorkshopsAdmin UI itself calls, already covered by its own
 * component test) — this golden path spends its real-browser budget on
 * the two capabilities the mission requires to be genuinely *seen*:
 * the student's real cockpit view + registration, and the parent's real
 * attendance view.
 */
import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import {
  cleanupAriaWorkshops,
  completeAriaOnboardingByEmail,
  getPendingEmailOutboxCountForUser,
  getStudentId,
  getUserAndStudentIdsByEmail,
  upgradeAriaPersonaToSuiviTier,
} from '../helpers/db';
import { resetFixture } from './helpers';
import { combineDateAndTime } from '../../lib/planning/invariants';
import {
  ARIA_WORKSHOP_REMINDER_OFFSET_HOURS,
  queueDueAriaWorkshopReminders,
} from '../../lib/aria/application/workshop/queue-due-workshop-reminders';

const REAL_COURSE_KEY = 'eds-maths-premiere';
const COCKPIT_COURSE_KEY = 'maths-premiere-eds';
// The negative test's own course (ariaNsi's real academic course) — a
// real AUTONOMIE-tier browse, never touching REAL_COURSE_KEY above.
const AUTONOMIE_COURSE_KEY = 'eds-nsi-premiere';
const WORKSHOP_TITLE = `Atelier P7d ${Date.now()}`;

test.describe.serial('ARIA-P7d real collective workshop golden path', () => {
  test.beforeEach(async ({ request }) => {
    await cleanupAriaWorkshops(REAL_COURSE_KEY);
    await cleanupAriaWorkshops(AUTONOMIE_COURSE_KEY);
    await resetFixture(request);
  });

  test.afterAll(async () => {
    await cleanupAriaWorkshops(REAL_COURSE_KEY);
    await cleanupAriaWorkshops(AUTONOMIE_COURSE_KEY);
  });

  test('E2E_ARIA_COLLECTIVE_WORKSHOP_GOLDEN — staff schedules, real eligible student sees + registers, staff marks attendance, real parent sees it', async ({ browser }) => {
    await upgradeAriaPersonaToSuiviTier(CREDS.ariaPremiereMaths.email);
    await completeAriaOnboardingByEmail(CREDS.ariaPremiereMaths.email);

    // ── Real staff session schedules a real workshop.
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await loginAsUser(staffPage, 'assistante');
    const scheduleResponse = await staffPage.request.post('/api/assistante/aria/workshops', {
      data: {
        courseKey: REAL_COURSE_KEY,
        title: WORKSHOP_TITLE,
        scheduledDate: '2026-10-15T00:00:00.000Z',
        startTime: '14:00',
        endTime: '15:00',
        modality: 'ONLINE',
      },
    });
    expect(scheduleResponse.status()).toBe(200);
    const { workshop } = (await scheduleResponse.json()) as { workshop: { id: string } };
    await staffContext.close();

    // ── Real, eligible (SUIVI-tier) student sees it in her real cockpit
    // and registers through the real UI.
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await loginAsUser(studentPage, 'ariaPremiereMaths');
    await studentPage.goto('/dashboard/eleve/aria', { waitUntil: 'domcontentloaded' });
    await expect(studentPage.getByTestId('aria-cockpit-page')).toBeVisible();
    await studentPage.getByTestId('aria-nav-CURRICULUM').click();
    await studentPage.getByTestId(`aria-course-card-${COCKPIT_COURSE_KEY}`).getByRole('button', { name: 'Ouvrir' }).click();

    const workshopsSection = studentPage.getByTestId('aria-workshops-section');
    await expect(workshopsSection).toBeVisible();
    await expect(workshopsSection).toContainText(WORKSHOP_TITLE);
    await studentPage.getByTestId(`aria-workshop-register-${workshop.id}`).click();
    await expect(studentPage.getByText('Inscrit·e')).toBeVisible();
    await studentContext.close();

    // ── Real staff session marks real attendance.
    const staffContext2 = await browser.newContext();
    const staffPage2 = await staffContext2.newPage();
    await loginAsUser(staffPage2, 'assistante');
    const rosterResponse = await staffPage2.request.get(`/api/assistante/aria/workshops?courseKey=${REAL_COURSE_KEY}`);
    expect(rosterResponse.status()).toBe(200);
    const { workshops } = (await rosterResponse.json()) as {
      workshops: readonly { id: string; attendees: readonly { attendeeId: string }[] }[];
    };
    const session = workshops.find((entry) => entry.id === workshop.id)!;
    const attendeeId = session.attendees[0]!.attendeeId;
    const markResponse = await staffPage2.request.post(
      `/api/assistante/aria/workshops/attendees/${attendeeId}/attendance`,
      { data: { status: 'ATTENDED' } },
    );
    expect(markResponse.status()).toBe(200);
    await staffContext2.close();

    // ── Real, genuinely separate parent session sees the real attendance.
    const studentId = await getStudentId(CREDS.ariaPremiereMaths.email);
    const parentContext = await browser.newContext();
    const parentPage = await parentContext.newPage();
    await loginAsUser(parentPage, 'ariaPersonasParent');
    await parentPage.goto(`/dashboard/parent/enfant/${studentId}`, { waitUntil: 'domcontentloaded' });

    const workshopsCard = parentPage.getByTestId('aria-workshops-card');
    await expect(workshopsCard).toBeVisible();
    await expect(workshopsCard).toContainText(WORKSHOP_TITLE);
    await expect(workshopsCard).toContainText('Présent·e');
    await parentContext.close();
  });

  test('a real student whose tier does not include collective workshops browses a real empty list, but registration is still denied', async ({ browser }) => {
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await loginAsUser(staffPage, 'assistante');
    const scheduleResponse = await staffPage.request.post('/api/assistante/aria/workshops', {
      data: {
        courseKey: AUTONOMIE_COURSE_KEY,
        title: 'Atelier réservé SUIVI',
        scheduledDate: '2026-10-16T00:00:00.000Z',
        startTime: '10:00',
        endTime: '11:00',
        modality: 'ONLINE',
      },
    });
    expect(scheduleResponse.status()).toBe(200);
    const { workshop } = (await scheduleResponse.json()) as { workshop: { id: string } };
    await staffContext.close();

    // ariaNsi is never upgraded to SUIVI in this suite — real AUTONOMIE
    // default, the real tier gate this test exercises.
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsUser(page, 'ariaNsi');
    const listResponse = await page.request.get(`/api/aria/workshops?courseKey=${AUTONOMIE_COURSE_KEY}`);
    expect(listResponse.status()).toBe(200);
    const { workshops } = (await listResponse.json()) as { workshops: readonly unknown[] };
    expect(workshops).toEqual([]);

    const registerResponse = await page.request.post(`/api/aria/workshops/${workshop.id}/register`);
    expect(registerResponse.status()).toBe(403);
    await context.close();
  });

  test('E2E_ARIA_WORKSHOP_REMINDER — a real, still-eligible upcoming registration produces exactly one real reminder once due (P7c)', async ({ browser }) => {
    await upgradeAriaPersonaToSuiviTier(CREDS.ariaPremiereMaths.email);
    await completeAriaOnboardingByEmail(CREDS.ariaPremiereMaths.email);

    const scheduledDate = new Date('2026-11-20T00:00:00.000Z');
    const startTime = '14:00';

    // ── Real staff session schedules a real, upcoming workshop.
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await loginAsUser(staffPage, 'assistante');
    const scheduleResponse = await staffPage.request.post('/api/assistante/aria/workshops', {
      data: {
        courseKey: REAL_COURSE_KEY,
        title: `Atelier rappel P7c ${Date.now()}`,
        scheduledDate: scheduledDate.toISOString(),
        startTime,
        endTime: '15:00',
        modality: 'ONLINE',
      },
    });
    expect(scheduleResponse.status()).toBe(200);
    const { workshop } = (await scheduleResponse.json()) as { workshop: { id: string } };
    await staffContext.close();

    // ── Real, eligible student registers through the real UI (never a
    // page.goto/API call constructed from a staff-known id — the same
    // real click-through the golden path above already proves).
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await loginAsUser(studentPage, 'ariaPremiereMaths');
    await studentPage.goto('/dashboard/eleve/aria', { waitUntil: 'domcontentloaded' });
    await studentPage.getByTestId('aria-nav-CURRICULUM').click();
    await studentPage.getByTestId(`aria-course-card-${COCKPIT_COURSE_KEY}`).getByRole('button', { name: 'Ouvrir' }).click();
    await studentPage.getByTestId(`aria-workshop-register-${workshop.id}`).click();
    await expect(studentPage.getByText('Inscrit·e')).toBeVisible();
    await studentContext.close();

    // Baseline AFTER registration (which itself already queued its own
    // real ARIA_COLLECTIVE_WORKSHOP_SCHEDULED-style notification, P7c) —
    // this shared persona's outbox is not otherwise isolated per test, so
    // the reminder's own effect is measured as a delta, never an absolute
    // count.
    const { userId: parentUserId } = await getUserAndStudentIdsByEmail(CREDS.ariaPersonasParent.email);
    const beforeReminder = await getPendingEmailOutboxCountForUser(parentUserId);

    // ── The reminder becoming due: this scan is deliberately not wired
    // into any live periodic trigger yet (see
    // queue-due-workshop-reminders.ts's own doc comment) — invoked
    // directly here, the same way this suite already invokes real
    // application functions and DB helpers directly from Node.
    const dueAt = new Date(
      combineDateAndTime(scheduledDate, startTime).getTime()
        - ARIA_WORKSHOP_REMINDER_OFFSET_HOURS * 60 * 60 * 1000,
    );
    const result = await queueDueAriaWorkshopReminders(dueAt);
    expect(result.queued).toBe(1);

    expect(await getPendingEmailOutboxCountForUser(parentUserId)).toBe(beforeReminder + 1);
  });
});
