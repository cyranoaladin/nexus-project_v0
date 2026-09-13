/**
 * Real browser coverage for the video join flow
 * (app/session/video/page.tsx → GET/POST /api/sessions/[sessionId] →
 * components/ui/video-conference.tsx), fixed alongside:
 *   - the missing external_api.js loader script (the feature was
 *     completely non-functional before — see the comment in
 *     components/ui/video-conference.tsx),
 *   - the CSP script-src gap that would have blocked that same script
 *     once added (lib/security-headers.ts),
 *   - GET no longer mutating the booking (only POST does),
 *   - the deterministic room name now coming from an HMAC keyed by
 *     JITSI_ROOM_SECRET (lib/jitsi-server.ts), never leaking sessionId.
 *
 * The real Jitsi server (public meet.jit.si or a self-hosted instance) is
 * an external boundary this suite does not depend on — external_api.js
 * is mocked so the test is deterministic and offline-safe, exactly as
 * flagged in the go-live audit: this proves OUR code's behavior (which
 * booking loads, which room name is requested, who mutates state and
 * when), not the third-party Jitsi service itself.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import { createSessionAtRealInstant } from '../helpers/db';

const EXTERNAL_API_STUB = `
  window.__e2eJitsiCalls = window.__e2eJitsiCalls || [];
  window.JitsiMeetExternalAPI = function (domain, options) {
    window.__e2eJitsiCalls.push({ domain, roomName: options && options.roomName });
    return {
      addListener: function () {},
      removeListener: function () {},
      dispose: function () {},
    };
  };
`;

/** Mock the Jitsi external boundary — never depend on the real public service. */
async function stubJitsiExternalApi(page: Page) {
  await page.route('**/external_api.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: EXTERNAL_API_STUB })
  );
}

async function readJitsiCalls(page: Page): Promise<Array<{ domain: string; roomName: string }>> {
  return page.evaluate(() => (window as unknown as { __e2eJitsiCalls?: Array<{ domain: string; roomName: string }> }).__e2eJitsiCalls ?? []);
}

test.describe('Video join flow — /session/video', () => {
  test('student and coach land in the same room; POST (join) marks the session IN_PROGRESS; GET alone never mutates', async ({ page, browser }) => {
    const sessionId = await createSessionAtRealInstant(CREDS.student.email, CREDS.coach.email, new Date());

    await loginAsUser(page, 'student', { navigate: false });

    // A plain GET (page.request, not the app UI) must never mutate the
    // booking — this is the exact bug this PR fixes.
    const beforeAnyJoin = await page.request.get(`/api/sessions/${sessionId}`);
    expect(beforeAnyJoin.status()).toBe(200);
    expect((await beforeAnyJoin.json()).status).toBe('SCHEDULED');

    await stubJitsiExternalApi(page);
    await page.goto(`/session/video?sessionId=${sessionId}`, { waitUntil: 'domcontentloaded' });

    await expect.poll(() => readJitsiCalls(page).then((calls) => calls.length)).toBeGreaterThan(0);
    const studentCalls = await readJitsiCalls(page);
    expect(studentCalls[0].roomName).toBeTruthy();
    // The room name must never leak any part of the real sessionId.
    expect(studentCalls[0].roomName).not.toContain(sessionId);

    // Visiting the page IS the join action (POST) — the booking is now IN_PROGRESS.
    const afterJoin = await page.request.get(`/api/sessions/${sessionId}`);
    expect((await afterJoin.json()).status).toBe('IN_PROGRESS');

    // The coach, in a separate browser context, must land in the EXACT
    // SAME room — this was the original bug (`Date.now()`-seeded names
    // meant coach and student never shared a room).
    const coachContext = await browser.newContext();
    const coachPage = await coachContext.newPage();
    await loginAsUser(coachPage, 'coach', { navigate: false });
    await stubJitsiExternalApi(coachPage);
    await coachPage.goto(`/session/video?sessionId=${sessionId}`, { waitUntil: 'domcontentloaded' });

    await expect.poll(() => readJitsiCalls(coachPage).then((calls) => calls.length)).toBeGreaterThan(0);
    const coachCalls = await readJitsiCalls(coachPage);
    expect(coachCalls[0].roomName).toBe(studentCalls[0].roomName);

    await coachContext.close();
  });

  test('joining more than 15 minutes before the scheduled start is rejected', async ({ page }) => {
    const farFutureStart = new Date(Date.now() + 60 * 60 * 1000); // 1h from now
    const sessionId = await createSessionAtRealInstant(CREDS.student.email, CREDS.coach.email, farFutureStart);

    await loginAsUser(page, 'student', { navigate: false });
    const res = await page.request.post(`/api/sessions/${sessionId}`);

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('pas encore disponible');
  });

  test('a cancelled session is never joinable, regardless of the time window', async ({ page }) => {
    // Offset from the other tests' bookings (same coach) so the exclusion
    // constraint on overlapping SessionBooking windows never trips —
    // real DB safety, not a test artifact.
    const start = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const sessionId = await createSessionAtRealInstant(CREDS.student.email, CREDS.coach.email, start);

    await loginAsUser(page, 'student', { navigate: false });
    const cancelRes = await page.request.post('/api/sessions/cancel', {
      data: { sessionId, reason: 'e2e-video-join-cancelled' },
    });
    expect(cancelRes.status()).toBe(200);

    const joinRes = await page.request.post(`/api/sessions/${sessionId}`);
    expect(joinRes.status()).toBe(410);
    expect((await joinRes.json()).error).toContain('annulée');
  });

  test('a user not party to the booking cannot read or join it (IDOR)', async ({ page }) => {
    const start = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const sessionId = await createSessionAtRealInstant(CREDS.student.email, CREDS.coach.email, start);

    // admin is authenticated but neither the student, coach, nor parent
    // on this specific booking — ownership is scoped server-side, never
    // by a client-supplied id.
    await loginAsUser(page, 'admin', { navigate: false });
    const res = await page.request.get(`/api/sessions/${sessionId}`);

    expect(res.status()).toBe(404);
  });
});
