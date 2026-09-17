/** @jest-environment node */

/**
 * Real-DB proof that POST /api/sessions/[sessionId] (app/api/sessions/
 * [sessionId]/route.ts) can no longer resurrect a terminal SessionBooking.
 *
 * The route used to do: read status (SCHEDULED) -> later, unconditionally
 * write status=IN_PROGRESS. A concurrent CANCEL/COMPLETE committing in that
 * gap was silently overwritten back to IN_PROGRESS. The fix makes the
 * SCHEDULED->IN_PROGRESS transition a single atomic conditional UPDATE
 * (`updateMany` with `status: SCHEDULED` in its WHERE clause), so it can only
 * ever apply to a row that is genuinely still SCHEDULED at the instant
 * Postgres executes it; a miss re-resolves to the real, current state.
 *
 * These are real, concurrent HTTP-shaped calls into the actual exported
 * route handlers, against a real Postgres connection pool (via the real
 * Prisma client) — only the NextAuth session and the Redis-backed rate
 * limiter are mocked (neither is what this race is about).
 */
// jest.setup.js globally auto-mocks @/lib/prisma for every test (a Proxy
// returning jest.fn() for any model.method access) — this test needs the
// real client against a real disposable Postgres, so opt out exactly like
// the established real-DB concurrency precedent
// (__tests__/integration/assignment-concurrency.real.test.ts).
jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';
import { SessionStatus, Subject } from '@prisma/client';

import { auth } from '@/auth';
import { GET, POST } from '@/app/api/sessions/[sessionId]/route';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

function makeRequest(): Request {
  return { headers: new Headers() } as unknown as Request;
}

function params(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

async function asStudent<T>(studentId: string, fn: () => Promise<T>): Promise<T> {
  (auth as jest.Mock).mockResolvedValue({ user: { id: studentId, role: 'ELEVE' } });
  return fn();
}

describe('SessionBooking join-state race on PostgreSQL', () => {
  let pool: Pool;
  const studentId = randomUUID();
  const coachId = randomUUID();

  // A start instant well inside the joinable window (now, 60-minute
  // duration) — every test below creates its own fresh booking id so the
  // exclusion constraint (SessionBooking_no_overlap_excl, WHERE status IN
  // (SCHEDULED, CONFIRMED, IN_PROGRESS)) never trips between test cases:
  // each one immediately transitions its booking to a terminal status.
  function bookingWindow() {
    const now = new Date();
    const scheduledDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const pad = (n: number) => String(n).padStart(2, '0');
    const startTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
    const endDate = new Date(now.getTime() + 60 * 60 * 1000);
    const endTime =
      endDate.getUTCDate() === now.getUTCDate()
        ? `${pad(endDate.getUTCHours())}:${pad(endDate.getUTCMinutes())}`
        : '23:59';
    return { scheduledDate, startTime, endTime };
  }

  async function createBooking(): Promise<string> {
    const { scheduledDate, startTime, endTime } = bookingWindow();
    const booking = await prisma.sessionBooking.create({
      data: {
        id: randomUUID(),
        studentId,
        coachId,
        subject: Subject.MATHEMATIQUES,
        title: 'E2E race fixture',
        scheduledDate,
        startTime,
        endTime,
        duration: 60,
        status: SessionStatus.SCHEDULED,
      },
    });
    return booking.id;
  }

  async function currentStatus(sessionId: string): Promise<SessionStatus> {
    const row = await prisma.sessionBooking.findUniqueOrThrow({
      where: { id: sessionId },
      select: { status: true },
    });
    return row.status;
  }

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl, max: 4 });
    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
       ($1, $2, 'ELEVE', NOW()), ($3, $4, 'COACH', NOW())`,
      [studentId, `student-${studentId}@invalid.test`, coachId, `coach-${coachId}@invalid.test`],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM "SessionBooking" WHERE "studentId" = $1', [studentId]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [[studentId, coachId]]);
    await pool.end();
    await prisma.$disconnect();
  });

  it('JOIN vs JOIN: 20 concurrent joins on the same SCHEDULED booking all end IN_PROGRESS, never erroring and never double-transitioning', async () => {
    for (let trial = 0; trial < 20; trial += 1) {
      const sessionId = await createBooking();

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => asStudent(studentId, () => POST(makeRequest() as any, params(sessionId)))),
      );

      for (const response of responses) {
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.status).toBe(SessionStatus.IN_PROGRESS);
      }
      expect(await currentStatus(sessionId)).toBe(SessionStatus.IN_PROGRESS);

      await prisma.sessionBooking.update({ where: { id: sessionId }, data: { status: SessionStatus.CANCELLED } });
    }
  });

  it('JOIN vs CANCEL: racing a join against a real cancel-shaped write never resurrects the booking to IN_PROGRESS', async () => {
    let joinWonCount = 0;
    let cancelWonCount = 0;

    for (let trial = 0; trial < 20; trial += 1) {
      const sessionId = await createBooking();

      // JOIN does its own read (resolveJoinableBooking's findFirst) before
      // ever reaching the conditional write, so a bare Promise.all here lets
      // CANCEL's single unconditional write win every single time — that
      // would only ever exercise one branch of the race. Alternate a tiny
      // head start between the two sides across trials so BOTH orderings
      // are genuinely reached and the guard is proven in both directions,
      // not just the one Node's natural scheduling happens to favor.
      const cancelGoesFirst = trial % 2 === 0;
      const cancelWrite = async () => {
        if (!cancelGoesFirst) await new Promise(resolve => setTimeout(resolve, 5));
        return prisma.sessionBooking.update({
          where: { id: sessionId },
          data: { status: SessionStatus.CANCELLED, cancelledAt: new Date() },
        });
      };
      const joinCall = async () => {
        if (cancelGoesFirst) await new Promise(resolve => setTimeout(resolve, 5));
        return asStudent(studentId, () => POST(makeRequest() as any, params(sessionId)));
      };

      const [joinResponse] = await Promise.all([joinCall(), cancelWrite()]);
      const finalStatus = await currentStatus(sessionId);

      // Cancel's write is unconditional (mirrors the real cancel route), so
      // — unlike the invariant this fix actually guards — it always applies
      // in the end regardless of which side's UPDATE statement acquired the
      // row lock first; a real cancel legitimately overriding an
      // already-started session is a separate, pre-existing business
      // decision, not this task's concern. The signal this test needs is
      // NOT finalStatus (which only ever reflects the LAST write) but
      // joinResponse.status: it is the direct proof of whether the join's
      // OWN atomic conditional write found the row still SCHEDULED (200) or
      // correctly observed it was already gone (410) — i.e. whether
      // Postgres's row lock ordering resolved in join's favor or cancel's.
      expect(finalStatus).toBe(SessionStatus.CANCELLED);

      if (joinResponse.status === 410) {
        cancelWonCount += 1;
        // Cancel's write committed before join's conditional UPDATE ran (or
        // join's UPDATE blocked behind cancel's row lock and, once
        // unblocked, correctly re-evaluated its WHERE clause against the
        // now-CANCELLED row and matched 0 rows) — join must report the
        // booking as cancelled, never silently claim success while having
        // actually resurrected nothing.
        const body = await joinResponse.json();
        expect(body.error).toContain('annulée');
      } else {
        joinWonCount += 1;
        // Join's conditional write ran while the row was still genuinely
        // SCHEDULED and legitimately transitioned it — proven by requiring
        // response 200 (never anything else) here.
        expect(joinResponse.status).toBe(200);
        const body = await joinResponse.json();
        expect(body.status).toBe(SessionStatus.IN_PROGRESS);
      }
    }

    // Both orderings must be genuinely reachable in this environment —
    // otherwise this test would only ever exercise one branch and prove
    // nothing about the race itself.
    expect(joinWonCount).toBeGreaterThan(0);
    expect(cancelWonCount).toBeGreaterThan(0);
  });

  it('JOIN vs COMPLETE: racing a join against a real complete-shaped write never resurrects the booking to IN_PROGRESS', async () => {
    let joinWonCount = 0;
    let completeWonCount = 0;

    for (let trial = 0; trial < 20; trial += 1) {
      const sessionId = await createBooking();

      const completeGoesFirst = trial % 2 === 0;
      const completeWrite = async () => {
        if (!completeGoesFirst) await new Promise(resolve => setTimeout(resolve, 5));
        // Mirrors app/api/coach/sessions/[sessionId]/report/route.ts's own
        // unconditional status: COMPLETED write.
        return prisma.sessionBooking.update({
          where: { id: sessionId },
          data: { status: SessionStatus.COMPLETED },
        });
      };
      const joinCall = async () => {
        if (completeGoesFirst) await new Promise(resolve => setTimeout(resolve, 5));
        return asStudent(studentId, () => POST(makeRequest() as any, params(sessionId)));
      };

      const [joinResponse] = await Promise.all([joinCall(), completeWrite()]);
      const finalStatus = await currentStatus(sessionId);

      // Same reasoning as the CANCEL test above: complete's write is
      // unconditional and always applies in the end regardless of lock
      // ordering — the real signal is joinResponse.status.
      expect(finalStatus).toBe(SessionStatus.COMPLETED);

      if (joinResponse.status === 410) {
        completeWonCount += 1;
        const body = await joinResponse.json();
        expect(body.error).toContain('terminée');
      } else {
        joinWonCount += 1;
        expect(joinResponse.status).toBe(200);
        const body = await joinResponse.json();
        expect(body.status).toBe(SessionStatus.IN_PROGRESS);
      }
    }

    expect(joinWonCount).toBeGreaterThan(0);
    expect(completeWonCount).toBeGreaterThan(0);
  });

  it('a plain GET never mutates, even while a concurrent join is in flight', async () => {
    const sessionId = await createBooking();

    const [getResponse] = await Promise.all([
      asStudent(studentId, () => GET(makeRequest() as any, params(sessionId))),
      asStudent(studentId, () => POST(makeRequest() as any, params(sessionId))),
    ]);

    expect(getResponse.status).toBe(200);
    expect(await currentStatus(sessionId)).toBe(SessionStatus.IN_PROGRESS);
  });
});
