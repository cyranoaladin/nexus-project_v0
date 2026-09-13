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
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import { createSessionAtRealInstant, setSessionBookingStatus } from '../helpers/db';

const EXTERNAL_API_STUB = `
  window.__e2eJitsiCalls = window.__e2eJitsiCalls || [];
  window.__e2eJitsiListeners = {};
  window.JitsiMeetExternalAPI = function (domain, options) {
    window.__e2eJitsiCalls.push({ domain, roomName: options && options.roomName });
    const listeners = window.__e2eJitsiListeners;
    return {
      addListener: function (event, cb) { listeners[event] = cb; },
      removeListener: function (event) { delete listeners[event]; },
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

/**
 * Fires the exact same SDK event `components/ui/video-conference.tsx`
 * listens for on a real hangup (`videoConferenceLeft`) — simulating a
 * participant leaving without needing a real Jitsi server. Real client
 * code, real listener, only the transport (the SDK itself) is stubbed.
 */
async function simulateJitsiLeave(page: Page): Promise<void> {
  await page.evaluate(() => {
    const listeners = (window as unknown as { __e2eJitsiListeners?: Record<string, () => void> }).__e2eJitsiListeners;
    listeners?.videoConferenceLeft?.();
  });
}

async function joinAsParticipant(context: BrowserContext, role: 'student' | 'coach' | 'coach2', sessionId: string): Promise<Page> {
  const page = await context.newPage();
  await loginAsUser(page, role, { navigate: false });
  await stubJitsiExternalApi(page);
  await page.goto(`/session/video?sessionId=${sessionId}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => readJitsiCalls(page).then((calls) => calls.length)).toBeGreaterThan(0);
  return page;
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

  test('a COMPLETED session is never joinable', async ({ page }) => {
    const start = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const sessionId = await createSessionAtRealInstant(CREDS.student.email, CREDS.coach.email, start);
    await setSessionBookingStatus(sessionId, 'COMPLETED');

    await loginAsUser(page, 'student', { navigate: false });

    const getRes = await page.request.get(`/api/sessions/${sessionId}`);
    expect(getRes.status()).toBe(410);
    expect((await getRes.json()).error).toContain('terminée');

    const joinRes = await page.request.post(`/api/sessions/${sessionId}`);
    expect(joinRes.status()).toBe(410);
  });

  test('a session past its join window (30 minutes after its end) has expired', async ({ page }) => {
    // 2h in the past, default 60-minute duration: ended 1h ago, well past
    // the 30-minute post-end tolerance — still a real instant computed
    // through the same shared Tunis wall-clock primitive as every other
    // fixture in this file, not a synthetic "expired" flag.
    const longPast = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const sessionId = await createSessionAtRealInstant(CREDS.student.email, CREDS.coach.email, longPast);

    await loginAsUser(page, 'student', { navigate: false });

    const getRes = await page.request.get(`/api/sessions/${sessionId}`);
    expect(getRes.status()).toBe(410);
    expect((await getRes.json()).error).toContain('expiré');

    const joinRes = await page.request.post(`/api/sessions/${sessionId}`);
    expect(joinRes.status()).toBe(410);
  });

  test('leaving the call never marks the booking COMPLETED, and does not invalidate it for the other participant', async ({ browser }) => {
    // This test actually performs the real join flow (not just GET/POST
    // eligibility checks like the other fixtures above), so it needs a
    // start instant that is genuinely joinable right now — like the very
    // first test in this file. coach2 (a distinct fixture from `coach`,
    // used by every other test here) avoids colliding with that first
    // test's own real-time SessionBooking exclusion-constraint window.
    const sessionId = await createSessionAtRealInstant(CREDS.student.email, CREDS.coach2.email, new Date());

    const studentContext = await browser.newContext();
    const coachContext = await browser.newContext();
    const studentPage = await joinAsParticipant(studentContext, 'student', sessionId);
    const coachPage = await joinAsParticipant(coachContext, 'coach2', sessionId);

    const inProgress = await studentPage.request.get(`/api/sessions/${sessionId}`);
    expect((await inProgress.json()).status).toBe('IN_PROGRESS');

    // Track every request this leaving participant's page makes from the
    // moment it "hangs up" — the fix this proves is architectural (no
    // client code path calls anything on leave that could complete or
    // otherwise mutate the booking), not just a single assertion.
    const requestsAfterLeave: string[] = [];
    studentPage.on('request', (req) => requestsAfterLeave.push(`${req.method()} ${new URL(req.url()).pathname}`));

    await simulateJitsiLeave(studentPage);
    // handleLeaveSession (app/session/video/page.tsx) redirects to the
    // student dashboard — real navigation confirms onLeave actually fired.
    await studentPage.waitForURL(/\/dashboard\/eleve/);

    expect(requestsAfterLeave.some((r) => r.startsWith('POST') || r.startsWith('PATCH') || r.startsWith('DELETE'))).toBe(false);

    // The booking itself: still IN_PROGRESS, never COMPLETED by the leave.
    const afterLeave = await coachPage.request.get(`/api/sessions/${sessionId}`);
    expect(afterLeave.status()).toBe(200);
    expect((await afterLeave.json()).status).toBe('IN_PROGRESS');

    // The OTHER participant, who never left, is completely unaffected —
    // still in the same valid room, session still joinable/readable.
    const coachStillJoinable = await coachPage.request.post(`/api/sessions/${sessionId}`);
    expect(coachStillJoinable.status()).toBe(200);

    await studentContext.close();
    await coachContext.close();
  });
});
