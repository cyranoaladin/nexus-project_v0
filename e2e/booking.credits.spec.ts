import { test, expect } from '@playwright/test';
import { CREDS } from './helpers/credentials';
import { loginAsUser } from './helpers/auth';
import {
  clearEntitlementsByUserEmail,
  setEntitlementByUserEmail,
  setStudentCreditsByEmail,
  setStudentCreditsByUserId,
  ensureCoachAvailabilityByEmail,
  getCoachUserIdByEmail,
  getLatestSessionBooking,
  disconnectPrisma,
} from './helpers/db';

function nextWeekdayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextWeekdayIsoWithOffset(daysOffset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysOffset);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getFirstAvailableSlot(
  page: import('@playwright/test').Page,
  coachId: string
): Promise<{ date: string; startTime: string; endTime: string }> {
  const start = nextWeekdayIsoWithOffset(14);
  const end = nextWeekdayIsoWithOffset(90);
  const resp = await page.request.get(
    `/api/coaches/availability?coachId=${coachId}&startDate=${start}&endDate=${end}`
  );
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  const slot = json?.availableSlots?.[0];
  if (!slot) {
    throw new Error(`No available slot found for coach ${coachId} between ${start} and ${end}`);
  }
  return {
    date: String(slot.date),
    startTime: String(slot.startTime).slice(0, 5),
    endTime: String(slot.endTime).slice(0, 5),
  };
}

test.describe.serial('Booking + credits workflow', () => {
  let coachId = '';

  test.beforeAll(async () => {
    coachId = await getCoachUserIdByEmail(CREDS.zenon.email);
    await ensureCoachAvailabilityByEmail(CREDS.zenon.email);
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test('sans entitlement credits_use => 403', async ({ page }) => {
    await clearEntitlementsByUserEmail(CREDS.student.email);
    await setStudentCreditsByEmail(CREDS.student.email, 2);
    await loginAsUser(page, 'student');

    const res = await page.request.post('/api/sessions/book', {
      data: {},
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(403);
    expect((await res.json()).feature).toBe('credits_use');
  });

  test('entitlement ON + 0 credits => erreur métier', async ({ page }) => {
    await setEntitlementByUserEmail(CREDS.student.email, 'ABONNEMENT_HYBRIDE');
    await setStudentCreditsByEmail(CREDS.student.email, 0);
    await loginAsUser(page, 'student');

    const sessionResp = await page.request.get('/api/auth/session');
    const sessionJson = await sessionResp.json();
    const studentUserId = sessionJson?.user?.id as string;

    const res = await page.request.post('/api/sessions/book', {
      data: {
        coachId,
        studentId: studentUserId,
        subject: 'MATHEMATIQUES',
        scheduledDate: nextWeekdayIso(),
        startTime: '10:00',
        endTime: '11:00',
        duration: 60,
        type: 'INDIVIDUAL',
        modality: 'ONLINE',
        title: 'E2E Booking no credits',
        description: 'Expected insufficient credits',
        creditsToUse: 1,
      },
      failOnStatusCode: false,
    });

    expect([400, 409]).toContain(res.status());
  });

  test('booking + idempotence + annulation avec refund', async ({ page }) => {
    await setEntitlementByUserEmail(CREDS.student.email, 'ABONNEMENT_HYBRIDE');
    await setStudentCreditsByEmail(CREDS.student.email, 3);
    await loginAsUser(page, 'student');

    const before = await page.request.get('/api/student/credits');
    expect(before.ok()).toBeTruthy();
    const beforeBalance = (await before.json()).balance as number;

    const sessionResp = await page.request.get('/api/auth/session');
    const sessionJson = await sessionResp.json();
    const studentUserId = sessionJson?.user?.id as string;
    await setStudentCreditsByUserId(studentUserId, 3);

    const slot = await getFirstAvailableSlot(page, coachId);

    const basePayload = {
      coachId,
      studentId: studentUserId,
      subject: 'MATHEMATIQUES',
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: 60,
      type: 'INDIVIDUAL',
      modality: 'ONLINE',
      title: 'E2E Booking success',
      description: 'Contract test booking',
      creditsToUse: 1,
      scheduledDate: slot.date,
    };

    const first = await page.request.post('/api/sessions/book', {
      data: basePayload,
      failOnStatusCode: false,
    });
    const firstStatus = first.status();
    const firstBody = await first.json().catch(() => ({}));
    expect([200, 201], `booking first attempt failed: ${JSON.stringify(firstBody)}`).toContain(firstStatus);

    const second = await page.request.post('/api/sessions/book', {
      data: basePayload,
      failOnStatusCode: false,
    });
    expect(second.status()).toBe(409);

    const afterBook = await page.request.get('/api/student/credits');
    const afterBookBalance = (await afterBook.json()).balance as number;
    expect(afterBookBalance).toBe(beforeBalance - 1);

    const booking = await getLatestSessionBooking(studentUserId);
    expect(booking).not.toBeNull();
    expect(booking!.status).toBe('SCHEDULED');

    const cancel = await page.request.post('/api/sessions/cancel', {
      data: { sessionId: booking!.id, reason: 'E2E contract cancel' },
      failOnStatusCode: false,
    });
    expect(cancel.status()).toBe(200);

    const afterCancel = await page.request.get('/api/student/credits');
    const afterCancelBalance = (await afterCancel.json()).balance as number;
    expect(afterCancelBalance).toBe(beforeBalance);

    const cancelledBooking = await getLatestSessionBooking(studentUserId);
    expect(cancelledBooking?.status).toBe('CANCELLED');
  });
});
