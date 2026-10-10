/** @jest-environment node */

import { cleanupDisposableTestFixture } from '../helpers/real-db-fixture-cleanup';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';
import {
  ARIA_WORKSHOP_REMINDER_OFFSET_HOURS,
  queueDueAriaWorkshopReminders,
} from '@/lib/aria/application/workshop/queue-due-workshop-reminders';
import { notifyParentWorkshopReminder } from '@/lib/aria/notifications/notify-parent-workshop-reminder';
import { scheduleAriaWorkshopSession } from '@/lib/aria/application/workshop/schedule-workshop';
import { registerForAriaWorkshop } from '@/lib/aria/application/workshop/register-for-workshop';
import { combineDateAndTime } from '@/lib/planning/invariants';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';

// deterministic-clock: this suite never reads the wall clock. Every instant is
// derived from a single fixed, injected clock (SESSION_START_INSTANT), and that
// SAME clock is injected into the fixture's entitlement window via
// `seedAriaRealDbFixture(..., { now: REMINDER_DUE_AT })`, so the window always
// brackets the evaluation instant regardless of real UTC time. Previously the
// fixture anchored its window to PostgreSQL NOW() while these instants were
// fixed, so the suite silently turned red once real UTC passed the anchor — a
// time-bomb. Shifting the clock by any offset (see the ±30d/±1y cases below)
// must change nothing.
//
// A workshop starting at 14:00 on 2026-10-10 (pseudo-UTC, same convention as
// combineDateAndTime) — its reminder is due exactly ARIA_WORKSHOP_REMINDER_OFFSET_HOURS
// (24h) before that, and every test below anchors its own `now` off this.
const SESSION_SCHEDULED_DATE = new Date('2026-10-10T00:00:00.000Z');
const SESSION_START_INSTANT = new Date('2026-10-10T14:00:00.000Z');
const REMINDER_DUE_AT = new Date(
  SESSION_START_INSTANT.getTime() - ARIA_WORKSHOP_REMINDER_OFFSET_HOURS * 60 * 60 * 1000,
);
const BEFORE_DUE = new Date(REMINDER_DUE_AT.getTime() - 60 * 1000);
const AFTER_SESSION_START = new Date(SESSION_START_INSTANT.getTime() + 60 * 1000);

async function upgradeToSuiviTier(pool: Pool, entitlementId: string): Promise<void> {
  await pool.query(`UPDATE entitlements SET "ariaTier" = 'ARIA_SUIVI' WHERE id = $1`, [entitlementId]);
}

async function createStaffUser(pool: Pool): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO users (id, email, role, "updatedAt") VALUES ($1, $2, 'ASSISTANTE', NOW())`,
    [id, `assistante-${id}@invalid.test`],
  );
  return id;
}

async function createSession(
  staffUserId: string,
  overrides: Partial<{ status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED'; title: string }> = {},
): Promise<string> {
  const session = await prisma.ariaWorkshopSession.create({
    data: {
      courseKey: REAL_COURSE_KEY,
      title: overrides.title ?? 'Atelier rappel P7c',
      scheduledDate: SESSION_SCHEDULED_DATE,
      startTime: '14:00',
      endTime: '15:00',
      status: overrides.status ?? 'SCHEDULED',
      createdById: staffUserId,
    },
    select: { id: true },
  });
  return session.id;
}

async function createRegisteredAttendee(sessionId: string, studentId: string): Promise<string> {
  const attendee = await prisma.ariaWorkshopAttendee.create({
    data: { sessionId, studentId, status: 'REGISTERED' },
    select: { id: true },
  });
  return attendee.id;
}

async function outboxCountForUser(pool: Pool, userId: string): Promise<number> {
  const rows = await pool.query(
    `SELECT id FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`,
    [userId],
  );
  return rows.rows.length;
}

describe('queueDueAriaWorkshopReminders (P7c)', () => {
  let pool: Pool;
  let staffUserId: string;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    staffUserId = await createStaffUser(pool);
  });

  afterAll(async () => {
    await cleanupDisposableTestFixture(pool, { userIds: [staffUserId] });
    await pool.end();
  });

  it('queues exactly one real reminder for a real, still-eligible, due registration', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Mehdi', family.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Marie', family.parentUser]);
    try {
      const sessionId = await createSession(staffUserId);
      await createRegisteredAttendee(sessionId, family.student);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 1, skippedNotYetEligible: 0, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(1);
      const attendee = await prisma.ariaWorkshopAttendee.findFirst({ where: { sessionId, studentId: family.student } });
      expect(attendee?.reminderQueuedAt).not.toBeNull();
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`, [family.parentUser]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier rappel P7c' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('does not queue a reminder before it is due', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier pas encore dû' });
      await createRegisteredAttendee(sessionId, family.student);

      const result = await queueDueAriaWorkshopReminders(BEFORE_DUE);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
      const attendee = await prisma.ariaWorkshopAttendee.findFirst({ where: { sessionId, studentId: family.student } });
      expect(attendee?.reminderQueuedAt).toBeNull();
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier pas encore dû' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never queues a second reminder for an already-claimed registration (idempotent across scans)', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Karim', family.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Sonia', family.parentUser]);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier double scan' });
      await createRegisteredAttendee(sessionId, family.student);

      const first = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);
      const second = await queueDueAriaWorkshopReminders(new Date(REMINDER_DUE_AT.getTime() + 60 * 1000));

      expect(first.queued).toBe(1);
      expect(second).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(1);
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`, [family.parentUser]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier double scan' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('a genuine concurrent double-scan hits the atomic claim and never double-queues', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Nadia', family.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Fatma', family.parentUser]);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier scan concurrent' });
      await createRegisteredAttendee(sessionId, family.student);

      const [a, b] = await Promise.all([
        queueDueAriaWorkshopReminders(REMINDER_DUE_AT),
        queueDueAriaWorkshopReminders(REMINDER_DUE_AT),
      ]);

      expect(a.queued + b.queued).toBe(1);
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(1);
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`, [family.parentUser]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier scan concurrent' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder once the real session has already started (too late, claimed but suppressed)', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier déjà commencé' });
      await createRegisteredAttendee(sessionId, family.student);

      const result = await queueDueAriaWorkshopReminders(AFTER_SESSION_START);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 1 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
      const attendee = await prisma.ariaWorkshopAttendee.findFirst({ where: { sessionId, studentId: family.student } });
      expect(attendee?.reminderQueuedAt).not.toBeNull();
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier déjà commencé' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder after a scheduled workshop with a real registration is cancelled', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const session = await scheduleAriaWorkshopSession({
        actor: { userId: staffUserId, role: 'ASSISTANTE' }, courseKey: REAL_COURSE_KEY,
        title: 'Atelier annulé', scheduledDate: SESSION_SCHEDULED_DATE,
        startTime: '14:00', endTime: '15:00', modality: 'IN_PERSON',
      });
      const sessionId = session.id;
      await registerForAriaWorkshop({ actor: { userId: family.studentUser, role: 'ELEVE' },
        workshopSessionId: sessionId, now: BEFORE_DUE });
      // This minimal fixture has no names: admission commits without a
      // registration email. A cancelled session must not add a reminder.
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
      // There is no public cancellation service in this V1 workshop module.
      // Set the terminal fixture state only after the public admission commits.
      await prisma.ariaWorkshopSession.update({ where: { id: sessionId }, data: { status: 'CANCELLED' } });
      await expect(registerForAriaWorkshop({ actor: { userId: family.studentUser, role: 'ELEVE' },
        workshopSessionId: sessionId, now: REMINDER_DUE_AT })).rejects.toMatchObject({ status: 404 });

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
      const attendee = await prisma.ariaWorkshopAttendee.findFirst({ where: { sessionId, studentId: family.student } });
      // Never even claimed: a cancelled session's attendees are excluded by
      // the scan's own WHERE clause, never reached at all.
      expect(attendee?.reminderQueuedAt).toBeNull();
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`, [family.parentUser]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier annulé' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder for a real attendee whose registration was cancelled', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier inscription annulée' });
      const attendeeId = await createRegisteredAttendee(sessionId, family.student);
      await prisma.ariaWorkshopAttendee.update({ where: { id: attendeeId }, data: { status: 'CANCELLED' } });

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier inscription annulée' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder for a real student whose tier no longer includes collective workshops (revoked/downgraded since registration)', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier tier révoqué' });
      await createRegisteredAttendee(sessionId, family.student);
      // Downgraded back to AUTONOMIE (e.g. a real plan change) after
      // registering but before the reminder became due.
      await pool.query(`UPDATE entitlements SET "ariaTier" = 'ARIA_AUTONOMIE' WHERE id = $1`, [family.entitlement]);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 1, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
      const attendee = await prisma.ariaWorkshopAttendee.findFirst({ where: { sessionId, studentId: family.student } });
      // Claimed — never re-evaluated on a later scan even if the tier were
      // restored, matching the "claim exactly once" idempotency contract.
      expect(attendee?.reminderQueuedAt).not.toBeNull();
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier tier révoqué' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder for a real entitlement that expired since registration', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier entitlement expiré' });
      await createRegisteredAttendee(sessionId, family.student);
      // Expires between registration and the reminder becoming due.
      await pool.query('UPDATE entitlements SET "endsAt" = $1 WHERE id = $2', [
        new Date(REMINDER_DUE_AT.getTime() - 60 * 60 * 1000),
        family.entitlement,
      ]);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 1, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier entitlement expiré' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder for a real student whose tier never included collective workshops (AUTONOMIE, never upgraded)', async () => {
    // Only reachable by direct DB insertion, since the real registration
    // path itself would have refused this student in the first place —
    // proven here purely as a defense-in-depth boundary on the scan.
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier jamais éligible' });
      await createRegisteredAttendee(sessionId, family.student);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 1, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier jamais éligible' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('scopes each real reminder to its own real family — never cross-mixes two different parents in the same scan', async () => {
    const familyA = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    const familyB = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, familyA.entitlement);
    await upgradeToSuiviTier(pool, familyB.entitlement);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Yasmine', familyA.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Amira', familyA.parentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Wassim', familyB.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Lilia', familyB.parentUser]);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier familles multiples' });
      await createRegisteredAttendee(sessionId, familyA.student);
      await createRegisteredAttendee(sessionId, familyB.student);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result.queued).toBe(2);
      expect(await outboxCountForUser(pool, familyA.parentUser)).toBe(1);
      expect(await outboxCountForUser(pool, familyB.parentUser)).toBe(1);
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = ANY($1) AND "jobType" = 'SEND_EMAIL'`, [[familyA.parentUser, familyB.parentUser]]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: { in: [familyA.student, familyB.student] } } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier familles multiples' } });
      await cleanupAriaRealDbFixture(pool, familyA);
      await cleanupAriaRealDbFixture(pool, familyB);
    }
  });

  it('genuinely uses its real default `now` when none is supplied — a session long in the past is correctly skipped as too late', async () => {
    // Intentionally seeds with the real-now default window (no injected clock):
    // this is the one test that exercises queueDueAriaWorkshopReminders()'s live
    // tunisNowAsPretendUtc() default, and the 2020 session is skipped as too
    // late before eligibility is ever evaluated.
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await prisma.ariaWorkshopSession.create({
        data: {
          courseKey: REAL_COURSE_KEY,
          title: 'Atelier horodatage par défaut',
          scheduledDate: new Date('2020-01-01T00:00:00.000Z'),
          startTime: '09:00',
          endTime: '10:00',
          status: 'SCHEDULED',
          createdById: staffUserId,
        },
        select: { id: true },
      }).then((s) => s.id);
      await createRegisteredAttendee(sessionId, family.student);

      // No explicit `now` — exercises the real tunisNowAsPretendUtc() default.
      const result = await queueDueAriaWorkshopReminders();

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 1 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier horodatage par défaut' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('never sends a reminder for a session filed under an unrecognized course key (defense-in-depth, only reachable via a corrupted/direct row)', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await prisma.ariaWorkshopSession.create({
        data: {
          courseKey: 'not-a-real-course-key',
          title: 'Atelier course key inconnue',
          scheduledDate: SESSION_SCHEDULED_DATE,
          startTime: '14:00',
          endTime: '15:00',
          status: 'SCHEDULED',
          createdById: staffUserId,
        },
        select: { id: true },
      }).then((s) => s.id);
      await createRegisteredAttendee(sessionId, family.student);

      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 1, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { title: 'Atelier course key inconnue' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('a losing racer whose atomic claim affects zero rows is a silent no-op, never a duplicate or an error', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier claim perdant' });
      await createRegisteredAttendee(sessionId, family.student);

      // Deterministically forces the exact race a genuine concurrent
      // double-scan only sometimes reproduces: the claim's own
      // `updateMany` reports zero affected rows for this call, as if
      // another replica's tick had already claimed it a moment earlier.
      const claimSpy = jest.spyOn(prisma.ariaWorkshopAttendee, 'updateMany').mockResolvedValueOnce({ count: 0 });
      const result = await queueDueAriaWorkshopReminders(REMINDER_DUE_AT);
      claimSpy.mockRestore();

      expect(result).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 0 });
      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier claim perdant' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  // --- Time-bomb regression guards (see the deterministic-clock note at the top
  //     of this file). These prove the suite's outcome depends only on the
  //     injected clock, never on real UTC time. ---

  // Standard session (due at REMINDER_DUE_AT), fixture window injected at the
  // same anchor; only the `now` passed to the scan varies.
  const runStandardScenarioAtNow = async (now: Date, title: string) => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const sessionId = await createSession(staffUserId, { title });
      await createRegisteredAttendee(sessionId, family.student);
      return await queueDueAriaWorkshopReminders(now);
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`, [family.parentUser]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  };

  // Whole scenario (session + fixture window + scan `now`) shifted by an
  // arbitrary offset off the fixed clock — the result must be identical.
  const runShiftedDueScenario = async (offsetMs: number, title: string) => {
    const start = new Date(SESSION_START_INSTANT.getTime() + offsetMs);
    const due = new Date(start.getTime() - ARIA_WORKSHOP_REMINDER_OFFSET_HOURS * 60 * 60 * 1000);
    const scheduledDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const pad = (n: number) => String(n).padStart(2, '0');
    const startTime = `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}`;
    const endTime = `${pad((start.getUTCHours() + 1) % 24)}:${pad(start.getUTCMinutes())}`;
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: due });
    await upgradeToSuiviTier(pool, family.entitlement);
    try {
      const session = await prisma.ariaWorkshopSession.create({
        data: { courseKey: REAL_COURSE_KEY, title, scheduledDate, startTime, endTime, status: 'SCHEDULED', createdById: staffUserId },
        select: { id: true },
      });
      await createRegisteredAttendee(session.id, family.student);
      return await queueDueAriaWorkshopReminders(due);
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`, [family.parentUser]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  };

  it('does not queue at exactly 1 ms before the due instant (threshold − 1 ms)', async () => {
    const result = await runStandardScenarioAtNow(new Date(REMINDER_DUE_AT.getTime() - 1), 'Atelier seuil -1ms');
    expect(result).toEqual({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 0 });
  });

  it('queues exactly at the due instant (threshold exact)', async () => {
    const result = await runStandardScenarioAtNow(REMINDER_DUE_AT, 'Atelier seuil exact');
    expect(result).toEqual({ queued: 1, skippedNotYetEligible: 0, skippedTooLate: 0 });
  });

  it('queues at 1 ms after the due instant (threshold + 1 ms)', async () => {
    const result = await runStandardScenarioAtNow(new Date(REMINDER_DUE_AT.getTime() + 1), 'Atelier seuil +1ms');
    expect(result).toEqual({ queued: 1, skippedNotYetEligible: 0, skippedTooLate: 0 });
  });

  it('is unaffected by a +30 day clock shift (wall-clock independence)', async () => {
    const result = await runShiftedDueScenario(30 * 24 * 60 * 60 * 1000, 'Atelier +30j');
    expect(result).toEqual({ queued: 1, skippedNotYetEligible: 0, skippedTooLate: 0 });
  });

  it('is unaffected by a +1 year clock shift (wall-clock independence)', async () => {
    const result = await runShiftedDueScenario(365 * 24 * 60 * 60 * 1000, 'Atelier +1an');
    expect(result).toEqual({ queued: 1, skippedNotYetEligible: 0, skippedTooLate: 0 });
  });

  it('computes the reminder-due instant purely from UTC, identically under UTC and the Africa/Tunis server timezone', () => {
    // combineDateAndTime (lib/planning/invariants.ts) is built on Date.UTC +
    // getUTC* accessors, so it never reads the process timezone — proven here
    // by toggling it. All scenario instants above are explicit UTC Dates, so
    // the whole suite is timezone-independent by construction.
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = 'UTC';
      const utc = combineDateAndTime(SESSION_SCHEDULED_DATE, '14:00').getTime();
      process.env.TZ = 'Africa/Tunis';
      const tunis = combineDateAndTime(SESSION_SCHEDULED_DATE, '14:00').getTime();
      expect(tunis).toBe(utc);
      expect(utc).toBe(SESSION_START_INSTANT.getTime());
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
  });
});

describe('notifyParentWorkshopReminder — real parent notification, direct (P7c)', () => {
  let pool: Pool;
  let staffUserId: string;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    staffUserId = await createStaffUser(pool);
  });

  afterAll(async () => {
    await cleanupDisposableTestFixture(pool, { userIds: [staffUserId] });
    await pool.end();
  });

  it('registration still succeeds in spirit — the notification itself simply queues nothing when the student has no real first name on file', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier rappel sans prénom élève' });
      await createRegisteredAttendee(sessionId, family.student);

      await notifyParentWorkshopReminder({
        studentId: family.student,
        sessionId,
        workshopTitle: 'Atelier rappel sans prénom élève',
        scheduledDate: SESSION_SCHEDULED_DATE,
        startTime: '14:00',
        endTime: '15:00',
        location: null,
      });

      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
    } finally {
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier rappel sans prénom élève' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('queues nothing when the parent has no real name on file', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Yasmine', family.studentUser]);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier rappel sans prénom parent' });
      await createRegisteredAttendee(sessionId, family.student);

      await notifyParentWorkshopReminder({
        studentId: family.student,
        sessionId,
        workshopTitle: 'Atelier rappel sans prénom parent',
        scheduledDate: SESSION_SCHEDULED_DATE,
        startTime: '14:00',
        endTime: '15:00',
        location: null,
      });

      expect(await outboxCountForUser(pool, family.parentUser)).toBe(0);
    } finally {
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier rappel sans prénom parent' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });

  it('a genuine concurrent double-fire hits the outbox\'s own unique constraint and is caught, not thrown', async () => {
    const family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY, { now: REMINDER_DUE_AT });
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Nadia', family.studentUser]);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Fatma', family.parentUser]);
    try {
      const sessionId = await createSession(staffUserId, { title: 'Atelier rappel double-fire' });
      await createRegisteredAttendee(sessionId, family.student);
      const input = {
        studentId: family.student,
        sessionId,
        workshopTitle: 'Atelier rappel double-fire',
        scheduledDate: SESSION_SCHEDULED_DATE,
        startTime: '14:00',
        endTime: '15:00',
        location: null,
      };

      await Promise.all([notifyParentWorkshopReminder(input), notifyParentWorkshopReminder(input)]);

      expect(await outboxCountForUser(pool, family.parentUser)).toBe(1);
    } finally {
      await pool.query(`DELETE FROM canonical_job_outbox WHERE "aggregateId" = $1 AND "jobType" = 'SEND_EMAIL'`, [family.parentUser]);
      await prisma.ariaWorkshopAttendee.deleteMany({ where: { studentId: family.student } });
      await prisma.ariaWorkshopSession.deleteMany({ where: { courseKey: REAL_COURSE_KEY, title: 'Atelier rappel double-fire' } });
      await cleanupAriaRealDbFixture(pool, family);
    }
  });
});
