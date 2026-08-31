import { test, expect } from '@playwright/test';
import { CREDS } from '../helpers/credentials';
import { loginAsUser } from '../helpers/auth';
import {
  setStudentCreditsByEmail,
  ensureCoachAvailabilityByEmail,
  getCoachUserIdByEmail,
  getLatestSessionBooking,
  getStudentCredits,
  disconnectPrisma,
} from '../helpers/db';

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

test.describe.serial('Booking household contract', () => {
  let coachId = '';

  test.beforeAll(async () => {
    coachId = await getCoachUserIdByEmail(CREDS.zenon.email);
    await ensureCoachAvailabilityByEmail(CREDS.zenon.email);
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test('un payload incomplet échoue au schéma, sans legacy gate credits_use', async ({ page }) => {
    await loginAsUser(page, 'student');

    const res = await page.request.post('/api/sessions/book', {
      data: {},
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(422);
    expect(await res.json()).not.toHaveProperty('feature');
  });

  test('foyer actif + zéro crédit => réservation incluse sans consommation', async ({ page }) => {
    await setStudentCreditsByEmail(CREDS.student.email, 0);
    await loginAsUser(page, 'student');

    const sessionResp = await page.request.get('/api/auth/session');
    const sessionJson = await sessionResp.json();
    const studentUserId = sessionJson?.user?.id as string;
    const slot = await getFirstAvailableSlot(page, coachId);

    const res = await page.request.post('/api/sessions/book', {
      data: {
        coachId,
        studentId: studentUserId,
        subject: 'MATHEMATIQUES',
        scheduledDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: 60,
        type: 'INDIVIDUAL',
        modality: 'ONLINE',
        title: 'E2E Booking included session',
        description: 'Household contract without credit consumption',
        creditsToUse: 10,
      },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(201);
    expect(await res.json()).toMatchObject({ session: { creditsUsed: 0 } });

    const booking = await getLatestSessionBooking(studentUserId);
    expect(booking).toMatchObject({ status: 'SCHEDULED', creditsUsed: 0 });

    const cancel = await page.request.post('/api/sessions/cancel', {
      data: { sessionId: booking!.id, reason: 'E2E included-session cleanup' },
      failOnStatusCode: false,
    });
    expect(cancel.status()).toBe(200);
    expect(await getStudentCredits(CREDS.student.email)).toBe(0);
  });

  test('conflit + annulation préservent le solde historique', async ({ page }) => {
    await setStudentCreditsByEmail(CREDS.student.email, 3);
    await loginAsUser(page, 'student');

    const beforeBalance = await getStudentCredits(CREDS.student.email);

    const sessionResp = await page.request.get('/api/auth/session');
    const sessionJson = await sessionResp.json();
    const studentUserId = sessionJson?.user?.id as string;

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
    expect(firstStatus, `booking first attempt failed: ${JSON.stringify(firstBody)}`).toBe(201);
    expect(firstBody).toMatchObject({ session: { creditsUsed: 0 } });

    const second = await page.request.post('/api/sessions/book', {
      data: basePayload,
      failOnStatusCode: false,
    });
    expect(second.status()).toBe(409);

    expect(await getStudentCredits(CREDS.student.email)).toBe(beforeBalance);

    const booking = await getLatestSessionBooking(studentUserId);
    expect(booking).not.toBeNull();
    expect(booking!.status).toBe('SCHEDULED');

    const cancel = await page.request.post('/api/sessions/cancel', {
      data: { sessionId: booking!.id, reason: 'E2E contract cancel' },
      failOnStatusCode: false,
    });
    expect(cancel.status()).toBe(200);
    expect((await cancel.json()).refunded).toBe(true);

    expect(await getStudentCredits(CREDS.student.email)).toBe(beforeBalance);

    const cancelledBooking = await getLatestSessionBooking(studentUserId);
    expect(cancelledBooking?.status).toBe('CANCELLED');
  });
});
